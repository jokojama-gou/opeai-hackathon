from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
import secrets
import uuid
from .errors import DomainError

RECORDING_KEYS = (
    "id",
    "owner_id",
    "installation_id",
    "mode",
    "duration_ms",
    "stopped_at",
    "capture_status",
    "upload_status",
    "audio_expires_at",
    "text_expires_at",
    "version",
)


def identifier():
    return str(uuid.uuid4())


def utcnow():
    return datetime.now(timezone.utc)


def iso(value):
    return value.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def parse(value):
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if result.tzinfo is None:
            raise ValueError()
        return result
    except (ValueError, AttributeError):
        raise DomainError("invalid_timestamp", 422) from None


def require_version(entity, expected):
    if entity.get("version", entity.get("revision")) != expected:
        raise DomainError("version_conflict")


class Service:
    def __init__(self, store, blobs, settings, probe, asr=None, clock=utcnow):
        self.store, self.blobs, self.settings, self.probe, self.asr, self.clock = (
            store,
            blobs,
            settings,
            probe,
            asr,
            clock,
        )

    def mutate(self, actor, operation, payload, action):
        key = payload.get("request_key")
        if (
            not isinstance(key, str)
            or not 8 <= len(key) <= 128
            or type(payload.get("expected_version")) is not int
        ):
            raise DomainError("invalid_mutation", 422)
        fingerprint = hashlib.sha256(
            json.dumps(
                [operation, payload], sort_keys=True, ensure_ascii=False
            ).encode()
        ).hexdigest()
        cached_id = hashlib.sha256((actor + ":" + key).encode()).hexdigest()
        with self.store.transaction() as state:
            cached = state.get("requests", cached_id)
            if cached:
                if cached["fingerprint"] != fingerprint:
                    raise DomainError("request_key_conflict")
                return deepcopy(cached["result"])
            # Mutation results contain IDs/status only. Read current authorized body separately.
            result = action(state)
            state.put(
                "requests",
                {
                    "id": cached_id,
                    "fingerprint": fingerprint,
                    "result": deepcopy(result),
                },
            )
            return deepcopy(result)

    def recording(self, state, actor, rid, audio=False, allow_expired=False):
        record = state.get("recordings", rid)
        if not record or record["owner_id"] != actor:
            raise DomainError("not_found", 404)
        if not allow_expired and (
            record.get("deleted_at")
            or parse(record["audio_expires_at" if audio else "text_expires_at"])
            <= self.clock()
        ):
            raise DomainError("expired", 410)
        return record

    def recording_dto(self, record):
        return {key: record[key] for key in RECORDING_KEYS}

    def create_recording(self, actor, payload):
        def action(state):
            if (
                payload["expected_version"] != 0
                or payload.get("mode") != "normal"
                or payload.get("capture_status") not in ("saved", "interrupted")
            ):
                raise DomainError("invalid_recording", 422)
            duration = payload.get("duration_ms")
            if (
                type(duration) is not int
                or not 0 < duration <= 300000
                or not 0 < payload.get("size", 0) <= 25 * 1024 * 1024
            ):
                raise DomainError("invalid_recording", 422)
            stopped = parse(payload.get("stopped_at"))
            if (
                stopped > self.clock() + timedelta(minutes=2)
                or stopped + timedelta(days=7) <= self.clock()
            ):
                raise DomainError("invalid_recording_time", 422)
            checksum = payload.get("checksum", "")
            if len(checksum) != 64 or any(
                char not in "0123456789abcdef" for char in checksum
            ):
                raise DomainError("invalid_checksum", 422)
            record = {
                "id": identifier(),
                "owner_id": actor,
                "installation_id": payload["installation_id"],
                "mode": "normal",
                "duration_ms": duration,
                "stopped_at": iso(stopped),
                "capture_status": payload["capture_status"],
                "upload_status": "local",
                "audio_expires_at": iso(stopped + timedelta(days=7)),
                "text_expires_at": iso(stopped + timedelta(days=30)),
                "version": 1,
                "checksum": checksum,
                "size": payload["size"],
                "deleted_at": None,
            }
            state.put("recordings", record)
            return {"id": record["id"], "version": record["version"]}

        return self.mutate(actor, "create-recording", payload, action)

    def list_recordings(self, actor):
        with self.store.transaction() as state:
            return [
                self.recording_dto(r)
                for r in state.table("recordings").values()
                if r["owner_id"] == actor
                and not r.get("deleted_at")
                and parse(r["text_expires_at"]) > self.clock()
            ]

    def get_recording(self, actor, rid):
        with self.store.transaction() as state:
            return self.recording_dto(self.recording(state, actor, rid))

    def sources(self, actor, rid):
        with self.store.transaction() as state:
            self.recording(state, actor, rid)
            values = [
                deepcopy(source)
                for source in state.table("sources").values()
                if source["recording_id"] == rid
            ]
            values.sort(key=lambda source: (source.get("ordinal", 0), source["id"]))
            for source in values:
                source.pop("ordinal", None)
            return values

    def policy(self):
        config = self.asr.settings if self.asr else None
        enabled = bool(
            config
            and config.retention_verified
            and config.call_limit > 0
            and config.max_cost > 0
            and 0 < config.reserved_cost_per_call <= config.max_cost
        )
        return {
            "policy_version": self.settings.policy_version,
            "destinations": {
                "pc_audio_transfer": self.settings.pc_destination,
                "external_audio_transcription": (
                    self.settings.asr_destination if enabled else None
                ),
                "external_text_generation": self.settings.generation_destination,
            },
            "descriptions": {
                "pc_audio_transfer": "開発PCへ音声を送り、非公開で保存します。音声は録音終了から7日、文字と派生物は原則30日です。",
                "external_audio_transcription": self.settings.asr_retention,
                "external_text_generation": self.settings.generation_retention,
            },
            "transcription_configured": enabled and bool(self.settings.asr_destination),
            "generation_configured": False,
        }

    def processing_configuration(self, purpose):
        policy = self.policy()
        destination = policy["destinations"][purpose]
        configured = bool(destination)
        if purpose == "external_audio_transcription":
            configured = configured and policy["transcription_configured"]
        if not configured:
            raise DomainError("processor_not_configured", 503)
        configuration = {
            "policy_version": policy["policy_version"],
            "destination": destination,
        }
        if purpose == "external_audio_transcription":
            config = self.asr.settings
            configuration.update(
                provider=config.provider_id,
                model=config.model_version,
                version=config.config_version,
            )
        return configuration

    def check_processing_configuration(self, value, purpose):
        if value != self.processing_configuration(purpose):
            raise DomainError("processor_configuration_changed")

    def ticket(self, actor, rid, payload):
        def action(state):
            record = self.recording(state, actor, rid, audio=True)
            require_version(record, payload["expected_version"])
            configuration = self.processing_configuration("pc_audio_transfer")
            if payload["checksum"] != record["checksum"]:
                raise DomainError("checksum_conflict")
            token = secrets.token_urlsafe(32)
            expires = min(
                self.clock() + timedelta(minutes=10), parse(record["audio_expires_at"])
            )
            state.put(
                "tickets",
                {
                    "id": hashlib.sha256(token.encode()).hexdigest(),
                    "actor_id": actor,
                    "recording_id": rid,
                    "processing_configuration": configuration,
                    "checksum": record["checksum"],
                    "version": record["version"],
                    "expires_at": iso(expires),
                },
            )
            return {
                "ticket": token,
                "expires_at": iso(expires),
                "version": record["version"],
            }

        return self.mutate(actor, "ticket:" + rid, payload, action)

    def check_upload(self, state, actor, rid, token, checksum):
        record = self.recording(state, actor, rid, audio=True)
        ticket = state.get("tickets", hashlib.sha256(token.encode()).hexdigest())
        if (
            not ticket
            or ticket["actor_id"] != actor
            or ticket["recording_id"] != rid
            or parse(ticket["expires_at"]) <= self.clock()
            or ticket["checksum"] != checksum
            or record["checksum"] != checksum
        ):
            raise DomainError("invalid_upload_ticket")
        self.check_processing_configuration(
            ticket.get("processing_configuration"), "pc_audio_transfer"
        )
        if (
            record["upload_status"] != "uploaded"
            and record["version"] != ticket["version"]
        ):
            raise DomainError("version_conflict")
        return record

    def upload(self, actor, rid, token, checksum, audio):
        with self.store.transaction() as state:
            record = self.check_upload(state, actor, rid, token, checksum)
            if (
                len(audio) != record["size"]
                or hashlib.sha256(audio).hexdigest() != checksum
            ):
                raise DomainError("invalid_audio_checksum")
            if record["upload_status"] == "uploaded":
                return {"id": rid, "version": record["version"]}
            expected_size, expected_duration = record["size"], record["duration_ms"]
        if len(audio) != expected_size or hashlib.sha256(audio).hexdigest() != checksum:
            raise DomainError("invalid_audio_checksum")
        duration = self.probe.inspect(audio)
        if abs(duration - expected_duration) > 2000:
            raise DomainError("audio_metadata_mismatch", 422)
        # Isolated object per attempt: a losing concurrent request must never delete
        # another request's published object.
        key = actor + "/" + rid + "/" + identifier() + ".m4a"
        with self.store.transaction() as state:
            self.check_upload(state, actor, rid, token, checksum)
        self.blobs.put(key, audio)
        published = False
        try:
            with self.store.transaction() as state:
                record = self.check_upload(state, actor, rid, token, checksum)
                if record["upload_status"] != "uploaded":
                    record["upload_status"] = "uploaded"
                    record["version"] += 1
                    record["blob_key"] = key
                    published = True
                return {"id": rid, "version": record["version"]}
        finally:
            if not published:
                self.blobs.delete(key)

    def transcription(self, actor, rid, payload):
        def action(state):
            record = self.recording(state, actor, rid, audio=True)
            require_version(record, payload["expected_version"])
            configuration = self.processing_configuration(
                "external_audio_transcription"
            )
            if not self.policy()["transcription_configured"]:
                raise DomainError("asr_not_configured", 503)
            if record["upload_status"] not in (
                "uploaded",
                "transcribing",
                "ready",
                "empty",
            ):
                raise DomainError("audio_not_uploaded")
            config = self.asr.settings
            if record["duration_ms"] > config.max_input_ms:
                raise DomainError("chunking_configuration_required", 503)
            key = hashlib.sha256(
                json.dumps(
                    [
                        rid,
                        record["checksum"],
                        config.provider_id,
                        config.model_version,
                        config.config_version,
                    ]
                ).encode()
            ).hexdigest()
            existing = next(
                (
                    job
                    for job in state.table("jobs").values()
                    if job.get("base_key") == key
                ),
                None,
            )
            if existing:
                return {"job_id": existing["id"], "version": record["version"]}
            job = {
                "id": identifier(),
                "owner_id": actor,
                "recording_id": rid,
                "recording_version": record["version"],
                "processing_configuration": configuration,
                "base_key": key,
                "status": "queued",
                "stage": "transcription",
                "attempts": 0,
                "cost_reserved": 0,
                "error_code": None,
                "retryable": False,
                "result_revision": None,
                "lease_until": None,
                "deadline": iso(self.clock() + timedelta(minutes=15)),
                "request_key": payload["request_key"],
                "processor_version": config.config_version,
            }
            state.put("jobs", job)
            record["upload_status"] = "transcribing"
            return {"job_id": job["id"], "version": record["version"]}

        return self.mutate(actor, "transcription:" + rid, payload, action)

    def job(self, actor, job_id):
        with self.store.transaction() as state:
            job = state.get("jobs", job_id)
            if not job or job["owner_id"] != actor:
                raise DomainError("not_found", 404)
            self.recording(state, actor, job["recording_id"])
            return {
                key: job[key]
                for key in (
                    "id",
                    "status",
                    "stage",
                    "attempts",
                    "error_code",
                    "retryable",
                    "result_revision",
                )
            }

    def correct(self, actor, source_id, payload):
        def action(state):
            source = state.get("sources", source_id)
            if not source:
                raise DomainError("not_found", 404)
            record = self.recording(state, actor, source["recording_id"])
            require_version(source, payload["expected_version"])
            text = payload.get("replacement", "")
            if (
                not isinstance(text, str)
                or not 1 <= len(text.strip()) <= 1000
                or text == source["original_text"]
            ):
                raise DomainError("invalid_correction", 422)
            state.put(
                "corrections",
                {
                    "id": identifier(),
                    "source_id": source_id,
                    "base_version": source["version"],
                    "actor_id": actor,
                    "original_text": source["original_text"],
                    "text": text,
                    "status": "saved",
                    "created_at": iso(self.clock()),
                },
            )
            source["original_text"] = text
            source["version"] += 1
            record["version"] += 1
            self.invalidate(state, record["id"], "stale")
            return {
                "source_id": source_id,
                "version": source["version"],
                "status": "stale",
            }

        return self.mutate(actor, "correction:" + source_id, payload, action)

    def delete_recording(self, actor, rid, payload):
        def action(state):
            record = self.recording(state, actor, rid, allow_expired=True)
            require_version(record, payload["expected_version"])
            record["deleted_at"] = iso(self.clock())
            record["version"] += 1
            self.invalidate(state, rid, "unavailable")
            return {"id": rid, "version": record["version"], "status": "deleting"}

        return self.mutate(actor, "delete:" + rid, payload, action)

    def invalidate(self, state, rid, status):
        for job in state.table("jobs").values():
            if job.get("recording_id") == rid:
                job.update(status="stale", error_code="source_changed", retryable=False)
        for match in state.table("matches").values():
            if rid in match["recording_ids"]:
                match["status"] = "pending" if status == "stale" else "cancelled"
                match["version"] += 1
                match["confirmations"] = {}
        for conversation in state.table("conversations").values():
            if rid in conversation["recording_ids"]:
                conversation.update(status="stale", script=[], highlights=[])
                conversation["access_revision"] += 1
        for kind in ("saved", "todos", "daily"):
            for item in state.table(kind).values():
                if rid in item.get("recording_ids", []):
                    item["source_state"] = (
                        "needs_review" if status == "stale" else "unavailable"
                    )
                    item.setdefault("invalidated_at", iso(self.clock()))
                    for field in (
                        "text",
                        "private_note",
                        "action",
                        "title",
                        "sections",
                        "due",
                    ):
                        item.pop(field, None)

    def read_audio(self, actor, rid):
        with self.store.transaction() as state:
            record = self.recording(state, actor, rid, audio=True)
            key = record.get("blob_key")
            if not key:
                raise DomainError("audio_unavailable", 404)
        audio = self.blobs.get(key)
        with self.store.transaction() as state:
            self.recording(state, actor, rid, audio=True)
        return audio

    def cleanup(self):
        removed = []
        with self.store.transaction() as state:
            for record in state.table("recordings").values():
                if (
                    record.get("deleted_at")
                    or parse(record["audio_expires_at"]) <= self.clock()
                ):
                    if record.get("blob_key"):
                        removed.append((record["id"], record["blob_key"]))
                if (
                    record.get("deleted_at")
                    or parse(record["text_expires_at"]) <= self.clock()
                ) and not record.get("text_purged_at"):
                    self.invalidate(state, record["id"], "unavailable")
                    source_ids = {
                        source["id"]
                        for source in state.table("sources").values()
                        if source["recording_id"] == record["id"]
                    }
                    for source_id in source_ids:
                        state.table("sources").pop(source_id)
                    for kind in ("corrections", "issues"):
                        for key, value in list(state.table(kind).items()):
                            if value.get("source_id") in source_ids:
                                del state.table(kind)[key]
                    record["text_purged_at"] = iso(self.clock())
        for rid, key in removed:
            self.blobs.delete(key)
            with self.store.transaction() as state:
                record = state.get("recordings", rid)
                if record.get("blob_key") == key:
                    record.pop("blob_key")
        return len(removed)
