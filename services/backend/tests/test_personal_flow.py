from dataclasses import replace
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft7Validator, FormatChecker
from app.adapters import AsrFailure, AsrSettings, MemoryBlobs
from app.config import Settings
from app.errors import DomainError
from app.main import create_app
from app.service import Service
from app.store import MemoryStore
from app.worker import run_once

AUDIO = b"artificial-audio-contract-input"
CHECKSUM = hashlib.sha256(AUDIO).hexdigest()
NOW = datetime(2026, 9, 14, 3, tzinfo=timezone.utc)
ROOT = Path(__file__).resolve().parents[3]
SCHEMA = json.loads((ROOT / "contracts/mvp-v1.schema.json").read_text(encoding="utf-8"))


class TestAuth:
    __test__ = False

    def actor(self, token):
        if token not in ("token-a", "token-b"):
            raise DomainError("unauthenticated", 401)
        return "person-" + token[-1]


class TestProbe:
    __test__ = False
    calls = 0

    def inspect(self, audio):
        self.calls += 1
        assert audio == AUDIO
        return 1000


class TestAsr:
    __test__ = False
    settings = AsrSettings(
        "artificial", "fixture-v1", "config-v1", True, 2, 2, 0.5, 300000
    )

    def __init__(self):
        self.calls = 0
        self.result = [
            {
                "text": "人工の発言🌱",
                "start_ms": 0,
                "end_ms": 900,
                "speaker_label": None,
            }
        ]
        self.callback = None

    def transcribe(self, audio, request_key):
        self.calls += 1
        if self.callback:
            self.callback()
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


@pytest.fixture
def system():
    clock = [NOW]
    asr = TestAsr()
    settings = Settings(
        ticket_secret="test-only-" * 8,
        pc_destination="unit-test-pc",
        asr_destination="artificial-asr",
        asr_retention="Artificial adapter. No network.",
    )
    service = Service(
        MemoryStore(), MemoryBlobs(), settings, TestProbe(), asr, lambda: clock[0]
    )
    client = TestClient(create_app(service, TestAuth(), settings))
    client.headers["Authorization"] = "Bearer token-a"
    return service, client, asr, clock


def create(client, key="create-recording-a"):
    payload = {
        "request_key": key,
        "expected_version": 0,
        "installation_id": "installation-a",
        "mode": "normal",
        "duration_ms": 1000,
        "stopped_at": "2026-09-14T02:59:00.000Z",
        "capture_status": "saved",
        "checksum": CHECKSUM,
        "size": len(AUDIO),
    }
    response = client.post("/v1/recordings", json=payload)
    assert response.status_code == 201, response.text
    return response.json()["id"], payload


def consent(client, rid, external=True, transfer=True):
    policy = client.get("/v1/processing-policy").json()
    response = client.post(
        f"/v1/recordings/{rid}/processing-consents",
        json={
            "request_key": "consent-key-" + rid,
            "expected_version": 1,
            "checksum": CHECKSUM,
            "policy_version": policy["policy_version"],
            "destinations": policy["destinations"],
            "pc_audio_transfer": transfer,
            "external_audio_transcription": external,
            "external_text_generation": False,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["consent_id"]


def upload(client, rid, cid):
    ticket = client.post(
        f"/v1/recordings/{rid}/uploads",
        json={
            "request_key": "ticket-key-" + rid,
            "expected_version": 1,
            "consent_id": cid,
            "checksum": CHECKSUM,
        },
    )
    assert ticket.status_code == 201, ticket.text
    headers = {
        "X-Upload-Ticket": ticket.json()["ticket"],
        "X-Audio-Checksum": CHECKSUM,
        "Content-Type": "audio/mp4",
    }
    response = client.put(f"/v1/recordings/{rid}/audio", content=AUDIO, headers=headers)
    assert response.status_code == 200, response.text
    return headers


def enqueue(client, rid, cid):
    response = client.post(
        f"/v1/recordings/{rid}/transcription-jobs",
        json={
            "request_key": "transcription-" + rid,
            "expected_version": 2,
            "consent_id": cid,
        },
    )
    assert response.status_code == 202, response.text
    return response.json()["job_id"]


def ready(system):
    service, client, _, _ = system
    rid, _ = create(client)
    cid = consent(client, rid)
    upload(client, rid, cid)
    job_id = enqueue(client, rid, cid)
    run_once(service)
    return rid, cid, job_id


def test_upload_transcribe_poll_sources_and_contract(system):
    service, client, asr, _ = system
    rid, _, job_id = ready(system)
    assert asr.calls == 1
    assert client.get(f"/v1/jobs/{job_id}").json()["status"] == "ready"
    response = client.get(f"/v1/recordings/{rid}/sources")
    assert response.headers["Cache-Control"] == "private, no-store"
    for source in response.json():
        Draft7Validator(
            {"$ref": "#/definitions/Source", "definitions": SCHEMA["definitions"]},
            format_checker=FormatChecker(),
        ).validate(source)
    Draft7Validator(
        {"$ref": "#/definitions/Recording", "definitions": SCHEMA["definitions"]},
        format_checker=FormatChecker(),
    ).validate(client.get(f"/v1/recordings/{rid}").json())
    assert client.get(f"/v1/recordings/{rid}/audio").content == AUDIO
    assert not run_once(service)


def test_idempotent_create_and_changed_payload_rejected(system):
    _, client, _, _ = system
    rid, payload = create(client)
    assert client.post("/v1/recordings", json=payload).json()["id"] == rid
    payload["duration_ms"] = 900
    assert client.post("/v1/recordings", json=payload).status_code == 409


def test_subject_is_token_and_errors_do_not_echo_private_input(system):
    _, client, _, _ = system
    rid, payload = create(client)
    payload["owner_id"] = "private-forged-person"
    response = client.post("/v1/recordings", json=payload)
    assert response.status_code == 422
    assert "private-forged-person" not in response.text
    client.headers["Authorization"] = "Bearer token-b"
    assert client.get(f"/v1/recordings/{rid}/sources").status_code == 404
    assert client.get("/v1/recordings/nonexistent/sources").status_code == 404


def test_no_ticket_or_transfer_consent_rejects_before_storage(system):
    service, client, _, _ = system
    rid, _ = create(client)
    response = client.put(
        f"/v1/recordings/{rid}/audio",
        content=AUDIO,
        headers={"X-Upload-Ticket": "invalid", "X-Audio-Checksum": CHECKSUM},
    )
    assert response.status_code == 409
    assert not service.blobs.values
    assert service.probe.calls == 0
    cid = consent(client, rid, transfer=False)
    assert (
        client.post(
            f"/v1/recordings/{rid}/uploads",
            json={
                "request_key": "upload-denied-key",
                "expected_version": 1,
                "consent_id": cid,
                "checksum": CHECKSUM,
            },
        ).status_code
        == 409
    )


def test_pc_only_consent_does_not_enable_asr(system):
    service, client, asr, _ = system
    rid, _ = create(client)
    cid = consent(client, rid, external=False)
    upload(client, rid, cid)
    response = client.post(
        f"/v1/recordings/{rid}/transcription-jobs",
        json={
            "request_key": "should-not-run-asr",
            "expected_version": 2,
            "consent_id": cid,
        },
    )
    assert response.status_code == 409
    assert not run_once(service)
    assert asr.calls == 0


def test_policy_change_invalidates_existing_ticket(system):
    service, client, _, _ = system
    rid, _ = create(client)
    cid = consent(client, rid)
    ticket = client.post(
        f"/v1/recordings/{rid}/uploads",
        json={
            "request_key": "ticket-before-change",
            "expected_version": 1,
            "consent_id": cid,
            "checksum": CHECKSUM,
        },
    ).json()["ticket"]
    service.settings = replace(service.settings, policy_version="new-policy")
    response = client.put(
        f"/v1/recordings/{rid}/audio",
        content=AUDIO,
        headers={"X-Upload-Ticket": ticket, "X-Audio-Checksum": CHECKSUM},
    )
    assert response.status_code == 409
    assert not service.blobs.values


def test_zero_budget_blocks_without_calling_provider(system):
    service, client, asr, _ = system
    asr.settings = replace(asr.settings, max_cost=0)
    assert (
        client.get("/v1/processing-policy").json()["transcription_configured"] is False
    )
    assert not run_once(service)
    assert asr.calls == 0


@pytest.mark.parametrize(
    "result", [[], [{"text": "時刻不明", "start_ms": None, "end_ms": None}]]
)
def test_empty_and_unknown_times_are_distinct(system, result):
    _, client, asr, _ = system
    asr.result = result
    rid, _, _ = ready(system)
    record = client.get(f"/v1/recordings/{rid}").json()
    assert record["upload_status"] == ("empty" if not result else "ready")
    if result:
        assert client.get(f"/v1/recordings/{rid}/sources").json()[0]["start_ms"] is None


@pytest.mark.parametrize(
    "failure,expected_calls",
    [
        (AsrFailure("rate_limited", retryable=True), 2),
        (AsrFailure("result_unknown", retryable=True, result_unknown=True), 1),
        (AsrFailure("unauthorized"), 1),
    ],
)
def test_retry_is_bounded_and_unknown_is_never_replayed(
    system, failure, expected_calls
):
    service, client, asr, _ = system
    asr.result = failure
    rid, _, job_id = ready(system)
    for _ in range(4):
        run_once(service)
    assert asr.calls == expected_calls
    assert client.get(f"/v1/jobs/{job_id}").json()["status"] == "failed"
    assert client.get(f"/v1/recordings/{rid}/sources").json() == []


def test_invalid_timing_does_not_publish_partial_result(system):
    _, client, asr, _ = system
    asr.result.append({"text": "bad", "start_ms": 500, "end_ms": 2000})
    rid, _, job_id = ready(system)
    assert client.get(f"/v1/jobs/{job_id}").json()["status"] == "failed"
    assert client.get(f"/v1/recordings/{rid}/sources").json() == []


def test_delete_during_external_call_discards_late_result(system):
    service, client, asr, _ = system
    rid, _ = create(client)
    cid = consent(client, rid)
    upload(client, rid, cid)
    enqueue(client, rid, cid)
    asr.callback = lambda: service.delete_recording(
        "person-a",
        rid,
        {"request_key": "delete-while-processing", "expected_version": 2},
    )
    run_once(service)
    assert client.get(f"/v1/recordings/{rid}/sources").status_code == 410
    with service.store.transaction() as state:
        assert not state.table("sources")
    service.cleanup()
    assert not service.blobs.values


def test_audio_expiry_retains_text_then_text_expires(system):
    service, client, _, clock = system
    rid, _, _ = ready(system)
    clock[0] = NOW + timedelta(days=8)
    assert client.get(f"/v1/recordings/{rid}/audio").status_code == 410
    assert client.get(f"/v1/recordings/{rid}/sources").status_code == 200
    service.cleanup()
    assert not service.blobs.values
    clock[0] = NOW + timedelta(days=31)
    assert client.get(f"/v1/recordings/{rid}/sources").status_code == 410
    service.cleanup()
    with service.store.transaction() as state:
        assert not state.table("sources")


def test_correction_keeps_original_and_rejects_wrong_version_or_owner(system):
    _, client, _, _ = system
    rid, _, _ = ready(system)
    source = client.get(f"/v1/recordings/{rid}/sources").json()[0]
    path = f'/v1/sources/{source["id"]}/corrections'
    payload = {
        "request_key": "correct-this-source",
        "expected_version": 1,
        "replacement": "訂正した人工文",
    }
    client.headers["Authorization"] = "Bearer token-b"
    assert client.post(path, json=payload).status_code == 404
    client.headers["Authorization"] = "Bearer token-a"
    assert client.post(path, json=payload).status_code == 201
    assert client.post(path, json=payload).status_code == 201
    payload["request_key"] = "stale-correction-key"
    assert client.post(path, json=payload).status_code == 409


def test_unconfigured_factory_is_not_an_authenticated_demo():
    client = TestClient(create_app(settings=Settings()))
    assert client.get("/health").json()["configured"] is False
    assert (
        client.get(
            "/v1/recordings", headers={"Authorization": "Bearer token-a"}
        ).status_code
        == 503
    )
