from datetime import timedelta
import pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app.personal import PersonalService
from test_personal_flow import system, ready, TestAuth, NOW


@pytest.fixture
def saved(system):
    old, original_client, _, clock = system
    rid, _, _ = ready(system)
    source = original_client.get(f"/v1/recordings/{rid}/sources").json()[0]
    service = PersonalService(
        old.store, old.blobs, old.settings, old.probe, old.asr, old.clock
    )
    client = TestClient(create_app(service, TestAuth(), old.settings))
    client.headers["Authorization"] = "Bearer token-a"
    payload = {
        "request_key": "save-first-source",
        "expected_version": 0,
        "target_kind": "source",
        "target_id": source["id"],
        "target_version": source["version"],
        "tag": "idea",
        "private_note": "本人だけの人工メモ",
    }
    response = client.post("/v1/saved-items", json=payload)
    assert response.status_code == 201, response.text
    return service, client, clock, rid, source, response.json()["id"], payload


def test_save_dedup_note_private_and_removal_does_not_delete_source(saved):
    _, client, _, rid, source, sid, payload = saved
    assert client.post("/v1/saved-items", json=payload).json()["id"] == sid
    payload["request_key"] = "same-target-new-key"
    assert client.post("/v1/saved-items", json=payload).json()["id"] == sid
    assert len(client.get("/v1/saved-items").json()) == 1
    client.headers["Authorization"] = "Bearer token-b"
    assert client.get("/v1/saved-items").json() == []
    assert (
        client.patch(
            "/v1/saved-items/" + sid,
            json={
                "request_key": "peer-edit-attempt",
                "expected_version": 1,
                "tag": "other",
                "private_note": "overwrite",
            },
        ).status_code
        == 404
    )
    client.headers["Authorization"] = "Bearer token-a"
    for confirmed, expected in ((False, 409), (True, 200)):
        result = client.request(
            "DELETE",
            "/v1/saved-items/" + sid,
            json={
                "request_key": "delete-saved-" + str(confirmed),
                "expected_version": 1,
                "confirm_note_deletion": confirmed,
            },
        )
        assert result.status_code == expected
    assert client.get("/v1/saved-items").json() == []
    assert client.get(f"/v1/recordings/{rid}/sources").json()[0]["id"] == source["id"]


def test_correction_hides_quote_and_note_until_explicit_rebind(saved):
    _, client, _, _, source, sid, _ = saved
    response = client.post(
        "/v1/sources/" + source["id"] + "/corrections",
        json={
            "request_key": "correction-saved-source",
            "expected_version": 1,
            "replacement": "訂正した人工の発言",
        },
    )
    assert response.status_code == 201
    values = client.get("/v1/saved-items").json()
    assert values == [{"id": sid, "version": 1, "source_state": "needs_review"}]
    response = client.post(
        "/v1/saved-items/" + sid + "/rebind",
        json={
            "request_key": "rebind-to-current-source",
            "expected_version": 1,
            "target_kind": "source",
            "target_id": source["id"],
            "target_version": 2,
            "tag": "idea",
            "private_note": "",
        },
    )
    assert response.status_code == 200, response.text
    item = client.get("/v1/saved-items").json()[0]
    assert item["id"] == sid and item["version"] == 2
    assert item["text"] == "訂正した人工の発言"
    assert item["private_note"] == ""


def test_expiry_has_only_tombstone_then_disappears(saved):
    service, client, clock, _, _, sid, _ = saved
    clock[0] = NOW + timedelta(days=31)
    assert client.get("/v1/saved-items").json() == [
        {"id": sid, "version": 1, "source_state": "unavailable"}
    ]
    clock[0] = NOW + timedelta(days=38)
    service.cleanup()
    assert client.get("/v1/saved-items").json() == []
    with service.store.transaction() as state:
        assert not state.table("manifests")
