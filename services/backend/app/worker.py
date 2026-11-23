"""Persistent single-worker ASR loop. No default provider or implicit external calls."""

from datetime import timedelta
from .adapters import AsrFailure
from .errors import DomainError
from .service import identifier, iso, parse


def run_once(service):
    if not service.asr or not service.policy()["transcription_configured"]:
        return False
    settings = service.asr.settings
    with service.store.transaction() as state:
        for old in state.table("jobs").values():
            if (
                old["status"] == "processing"
                and old["lease_until"]
                and parse(old["lease_until"]) <= service.clock()
            ):
                # An interrupted external call might already have been billed.
                old.update(
                    status="failed", error_code="result_unknown", retryable=False
                )
                state.get("recordings", old["recording_id"])["upload_status"] = "failed"
        job = next(
            (
                j
                for j in state.table("jobs").values()
                if j["status"] == "queued" and j["stage"] == "transcription"
            ),
            None,
        )
        if not job:
            return False
        try:
            record = service.recording(
                state, job["owner_id"], job["recording_id"], audio=True
            )
            service.check_processing_configuration(
                job.get("processing_configuration"), "external_audio_transcription"
            )
            if record["version"] != job["recording_version"]:
                raise DomainError("source_changed")
            if job["processor_version"] != settings.config_version:
                raise DomainError("processor_configuration_changed")
            if parse(job["deadline"]) <= service.clock():
                raise DomainError("processing_timeout")
            if (
                job["attempts"] >= min(2, settings.call_limit)
                or job["cost_reserved"] + settings.reserved_cost_per_call
                > settings.max_cost
            ):
                raise DomainError("processing_limit_reached")
        except DomainError as error:
            job.update(status="failed", error_code=error.code, retryable=False)
            return True
        job["status"] = "processing"
        job["attempts"] += 1
        job["cost_reserved"] += settings.reserved_cost_per_call
        job["lease_until"] = job["deadline"]
        job_id, owner, rid, key = (
            job["id"],
            job["owner_id"],
            record["id"],
            record["blob_key"],
        )
        request_key = job["base_key"] + ":" + str(job["attempts"])
    try:
        audio = service.blobs.get(key)
        # Recheck after storage retrieval, immediately before sending externally.
        with service.store.transaction() as state:
            current = state.get("jobs", job_id)
            record = service.recording(state, owner, rid, audio=True)
            service.check_processing_configuration(
                current.get("processing_configuration"), "external_audio_transcription"
            )
            if (
                current["status"] != "processing"
                or record["version"] != current["recording_version"]
                or parse(current["deadline"]) <= service.clock()
            ):
                raise DomainError("source_changed")
        segments = service.asr.transcribe(audio, request_key)
        if not isinstance(segments, list):
            raise AsrFailure("invalid_asr_output")
        sources = []
        for segment in segments:
            text, start, end = (
                segment.get("text"),
                segment.get("start_ms"),
                segment.get("end_ms"),
            )
            if (
                not isinstance(text, str)
                or not text.strip()
                or (start is None) != (end is None)
            ):
                raise AsrFailure("invalid_asr_output")
            if start is not None and (
                type(start) is not int
                or type(end) is not int
                or not 0 <= start < end <= record["duration_ms"]
            ):
                raise AsrFailure("invalid_asr_timing")
            speaker = segment.get("speaker_label")
            if speaker is not None and not isinstance(speaker, str):
                raise AsrFailure("invalid_asr_output")
            sources.append(
                {
                    "id": identifier(),
                    "recording_id": rid,
                    "original_text": text,
                    "start_ms": start,
                    "end_ms": end,
                    "timing_quality": "unknown" if start is None else "estimated",
                    "speaker_label": speaker,
                    "version": 1,
                    "ordinal": len(sources),
                }
            )
        with service.store.transaction() as state:
            current = state.get("jobs", job_id)
            record = service.recording(state, owner, rid, audio=True)
            service.check_processing_configuration(
                current.get("processing_configuration"), "external_audio_transcription"
            )
            if (
                current["status"] != "processing"
                or record["version"] != current["recording_version"]
                or parse(current["deadline"]) <= service.clock()
            ):
                raise DomainError("source_changed")
            for source in sources:
                state.put("sources", source)
            record["upload_status"] = "ready" if sources else "empty"
            record["version"] += 1
            current.update(
                status="ready",
                result_revision=record["version"],
                error_code=None,
                retryable=False,
                lease_until=None,
            )
    except (AsrFailure, DomainError) as error:
        with service.store.transaction() as state:
            current = state.get("jobs", job_id)
            if current["status"] == "stale":
                return True
            can_retry = (
                isinstance(error, AsrFailure)
                and error.retryable
                and not error.result_unknown
                and current["attempts"] < min(2, settings.call_limit)
                and current["cost_reserved"] + settings.reserved_cost_per_call
                <= settings.max_cost
                and parse(current["deadline"]) > service.clock()
            )
            current.update(
                status="queued" if can_retry else "failed",
                error_code=error.code,
                retryable=False,
                lease_until=None,
            )
            if not can_retry:
                state.get("recordings", rid)["upload_status"] = "failed"
    except Exception:
        with service.store.transaction() as state:
            current = state.get("jobs", job_id)
            if current["status"] != "stale":
                current.update(
                    status="failed",
                    error_code="result_unknown",
                    retryable=False,
                    lease_until=None,
                )
                state.get("recordings", rid)["upload_status"] = "failed"
    return True


if __name__ == "__main__":
    import time
    from .main import build_service

    service = build_service()
    if not service:
        raise SystemExit("Configure backend environment before starting worker.")
    while True:
        service.cleanup()
        from .generation import run_generation_once

        if not run_once(service) and not run_generation_once(service):
            time.sleep(2)
