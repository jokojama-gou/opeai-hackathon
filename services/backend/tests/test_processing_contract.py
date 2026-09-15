"""AC19: artificial input only; processing has no app consent state."""

from dataclasses import replace
from datetime import timedelta
import json
import pytest
from test_personal_flow import system, create, upload, enqueue, CHECKSUM, AUDIO, ROOT
from app.worker import run_once


def test_processing_without_consent(system):
    service, client, asr, _ = system
    rid, _ = create(client)
    response = client.post(
        f"/v1/recordings/{rid}/uploads",
        json={
            "request_key": "without-consent-ticket",
            "expected_version": 1,
            "checksum": CHECKSUM,
        },
    )
    assert response.status_code == 201, response.text
    response = client.put(
        f"/v1/recordings/{rid}/audio",
        content=AUDIO,
        headers={
            "X-Upload-Ticket": response.json()["ticket"],
            "X-Audio-Checksum": CHECKSUM,
        },
    )
    assert response.status_code == 200, response.text
    response = client.post(
        f"/v1/recordings/{rid}/transcription-jobs",
        json={
            "request_key": "without-consent-job",
            "expected_version": 2,
        },
    )
    assert response.status_code == 202, response.text
    assert run_once(service)
    assert asr.calls == 1
    assert (
        client.get(f"/v1/jobs/{response.json()['job_id']}").json()["status"] == "ready"
    )
    with service.store.transaction() as state:
        assert not state.table("consents")


def test_removed_consent_endpoints(system):
    _, client, _, _ = system
    schema = client.get("/openapi.json").json()
    paths = schema["paths"]
    assert not any("consents" in path for path in paths)
    exported = json.loads((ROOT / "contracts/openapi.json").read_text(encoding="utf-8"))
    assert exported["paths"] == paths
    assert exported["components"]["schemas"] == schema["components"]["schemas"]


@pytest.mark.parametrize(
    "case,expected",
    [
        ("owner", 404),
        ("authentication", 401),
        ("version", 409),
        ("expired", 410),
    ],
)
def test_consent_removal_preserves_upload_boundaries(system, case, expected):
    _, client, _, clock = system
    rid, _ = create(client)
    payload = {
        "request_key": "boundary-check",
        "expected_version": 1,
        "checksum": CHECKSUM,
    }
    if case == "owner":
        client.headers["Authorization"] = "Bearer token-b"
    elif case == "authentication":
        client.headers["Authorization"] = "Bearer invalid-token"
    elif case == "version":
        payload["expected_version"] = 999
    else:
        clock[0] += timedelta(days=8)
    assert (
        client.post(f"/v1/recordings/{rid}/uploads", json=payload).status_code
        == expected
    )


def test_unconfigured_storage_destination_rejects_ticket(system):
    service, client, _, _ = system
    rid, _ = create(client)
    service.settings = replace(service.settings, pc_destination="")
    response = client.post(
        f"/v1/recordings/{rid}/uploads",
        json={
            "request_key": "missing-destination",
            "expected_version": 1,
            "checksum": CHECKSUM,
        },
    )
    assert response.status_code == 503, response.text
    assert not service.blobs.values


def test_legacy_ticket_requires_new_ticket(system):
    service, client, _, _ = system
    rid, _ = create(client)
    response = client.post(
        f"/v1/recordings/{rid}/uploads",
        json={
            "request_key": "legacy-ticket-input",
            "expected_version": 1,
            "checksum": CHECKSUM,
        },
    )
    with service.store.transaction() as state:
        ticket = next(iter(state.table("tickets").values()))
        ticket.pop("processing_configuration")
        ticket["consent_id"] = "historical-only"
    response = client.put(
        f"/v1/recordings/{rid}/audio",
        content=AUDIO,
        headers={
            "X-Upload-Ticket": response.json()["ticket"],
            "X-Audio-Checksum": CHECKSUM,
        },
    )
    assert response.status_code == 409
    assert service.probe.calls == 0
    assert not service.blobs.values


@pytest.mark.parametrize("change", ["legacy", "destination", "model"])
def test_queued_configuration_change_stops_before_external_call(system, change):
    service, client, asr, _ = system
    rid, _ = create(client)
    upload(client, rid)
    jid = enqueue(client, rid)
    if change == "legacy":
        with service.store.transaction() as state:
            state.get("jobs", jid).pop("processing_configuration")
    elif change == "destination":
        service.settings = replace(service.settings, asr_destination="changed-adapter")
    else:
        asr.settings = replace(asr.settings, model_version="changed-model")
    assert run_once(service)
    result = client.get(f"/v1/jobs/{jid}").json()
    assert result["status"] == "failed"
    assert result["error_code"] == "processor_configuration_changed"
    assert asr.calls == 0


def test_configuration_change_during_asr_does_not_publish(system):
    service, client, asr, _ = system
    rid, _ = create(client)
    upload(client, rid)
    jid = enqueue(client, rid)

    def change():
        asr.settings = replace(asr.settings, model_version="late-model-change")

    asr.callback = change
    assert run_once(service)
    assert client.get(f"/v1/jobs/{jid}").json()["status"] == "failed"
    assert client.get(f"/v1/recordings/{rid}/sources").json() == []


def test_old_consent_fields_are_rejected(system):
    _, client, _, _ = system
    rid, _ = create(client)
    response = client.post(
        f"/v1/recordings/{rid}/uploads",
        json={
            "request_key": "old-client-request",
            "expected_version": 1,
            "checksum": CHECKSUM,
            "consent_id": "old-client-value",
        },
    )
    assert response.status_code == 422
