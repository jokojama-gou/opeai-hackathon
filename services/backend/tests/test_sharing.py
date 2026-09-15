from datetime import timedelta
import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft7Validator, FormatChecker
from app.main import create_app
from app.sharing import SharingService
from app.worker import run_once
from test_personal_flow import (
    system,
    ready,
    create,
    upload,
    enqueue,
    TestAuth,
    SCHEMA,
    NOW,
)


@pytest.fixture
def pair(system):
    old, _, asr, clock = system
    service = SharingService(
        old.store, old.blobs, old.settings, old.probe, asr, old.clock
    )
    client = TestClient(create_app(service, TestAuth(), old.settings))
    records = {}
    for actor in ("a", "b"):
        client.headers["Authorization"] = "Bearer token-" + actor
        rid, _ = create(client, "recording-person-" + actor)
        upload(client, rid)
        enqueue(client, rid)
        run_once(service)
        records[actor] = client.get(f"/v1/recordings/{rid}").json()
        records[actor]["source"] = client.get(f"/v1/recordings/{rid}/sources").json()[0]
    client.headers["Authorization"] = "Bearer token-a"
    result = client.post(
        "/v1/connections",
        json={
            "request_key": "create-connection-a",
            "expected_version": records["a"]["version"],
            "recording_id": records["a"]["id"],
        },
    )
    assert result.status_code == 201, result.text
    return service, client, clock, records, result.json()


def join(pair):
    _, client, _, records, connection = pair
    client.headers["Authorization"] = "Bearer token-b"
    response = client.post(
        "/v1/connections/accept",
        json={
            "request_key": "accept-" + connection["connection_id"],
            "expected_version": records["b"]["version"],
            "recording_id": records["b"]["id"],
            "code": connection["code"],
        },
    )
    assert response.status_code == 200, response.text
    return client.get("/v1/connections/" + connection["connection_id"]).json()


def confirm(pair, snapshot, actor):
    _, client, _, records, _ = pair
    client.headers["Authorization"] = "Bearer token-" + actor
    source = records[actor]["source"]
    body = {
        "request_key": "confirm-"
        + actor
        + snapshot["match_id"]
        + str(snapshot["match_version"]),
        "expected_version": snapshot["match_version"],
        "selection": [
            {
                "source_id": source["id"],
                "source_version": source["version"],
                "char_start": 0,
                "char_end": len(source["original_text"]),
                "start_ms": 0,
                "end_ms": 900,
            }
        ],
        "participation_ranges": {
            "self": {"start_ms": 0, "end_ms": 900},
            "peer": {"start_ms": 0, "end_ms": 900},
        },
        "same_conversation": True,
        "only_two_people": True,
        "attribution_confirmed": True,
        "participation_confirmed": True,
    }
    response = client.post(
        "/v1/matches/" + snapshot["match_id"] + "/confirmations", json=body
    )
    assert response.status_code == 200, response.text
    return body


def allow(pair, snapshot, actor, continuing=False):
    _, client, _, _, _ = pair
    client.headers["Authorization"] = "Bearer token-" + actor
    return client.post(
        "/v1/share-scopes/" + snapshot["scope_id"] + "/responses",
        json={
            "request_key": "allow-" + actor + snapshot["scope_id"],
            "expected_version": snapshot["scope_version"],
            "decision": "allowed",
            "continuing_opt_in": continuing,
        },
    )


def mutually_confirm(pair):
    snapshot = join(pair)
    confirm(pair, snapshot, "a")
    confirm(pair, snapshot, "b")
    return pair[1].get("/v1/connections/" + snapshot["connection_id"]).json()


def test_revision_keeps_conversation_but_requires_new_permissions(pair):
    _, client, _, _, connection = pair
    snapshot = mutually_confirm(pair)
    allow(pair, snapshot, "a")
    cid = allow(pair, snapshot, "b").json()["conversation_id"]
    with pair[0].store.transaction() as state:
        old_body = state.get("matches", snapshot["match_id"])["confirmations"][
            "person-a"
        ]
    client.headers["Authorization"] = "Bearer token-a"
    body = {
        "request_key": "explicit-revision",
        "expected_version": snapshot["match_version"],
        "selection": old_body["selection"],
        "participation_ranges": old_body["participation_ranges"],
        "same_conversation": True,
        "only_two_people": True,
        "attribution_confirmed": True,
        "participation_confirmed": True,
    }
    response = client.post(
        "/v1/matches/" + snapshot["match_id"] + "/revisions", json=body
    )
    assert response.status_code == 200, response.text
    revised = response.json()
    assert revised["match_version"] == snapshot["match_version"] + 1
    assert revised["scope_id"] != snapshot["scope_id"]
    assert revised["conversation_id"] is None
    assert revised["share_states"]["person-b"] == "pending"
    assert client.get("/v1/conversations/" + cid).status_code == 404
    confirm(pair, revised, "b")
    revised = client.get("/v1/connections/" + connection["connection_id"]).json()
    allow(pair, revised, "a")
    assert allow(pair, revised, "b").json()["conversation_id"] == cid


def test_continuing_requires_both_and_revoke_preserves_explicit_scope(pair):
    _, client, _, _, _ = pair
    snapshot = mutually_confirm(pair)
    assert allow(pair, snapshot, "a", True).status_code == 200
    assert client.get("/v1/continuing-grants").json() == []
    cid = allow(pair, snapshot, "b", True).json()["conversation_id"]
    grant = client.get("/v1/continuing-grants").json()[0]
    assert grant["status"] == "active"
    response = client.post(
        "/v1/continuing-grants/" + grant["id"] + "/revoke",
        json={"request_key": "revoke-continuing", "expected_version": grant["version"]},
    )
    assert response.status_code == 200
    assert client.get("/v1/conversations/" + cid).status_code == 200
    assert (
        client.get("/v1/connections/" + snapshot["connection_id"]).json()[
            "continuing_state"
        ]
        == "revoked"
    )


def test_cancelling_match_allows_new_connection_and_keeps_own_input(pair):
    _, client, _, records, _ = pair
    snapshot = join(pair)
    response = client.post(
        "/v1/matches/" + snapshot["match_id"] + "/cancel",
        json={
            "request_key": "cancel-current-match",
            "expected_version": snapshot["match_version"],
        },
    )
    assert response.status_code == 200
    assert (
        client.get("/v1/recordings/" + records["b"]["id"] + "/sources").status_code
        == 200
    )
    response = client.post(
        "/v1/connections",
        json={
            "request_key": "new-connection-after-cancel",
            "expected_version": records["b"]["version"],
            "recording_id": records["b"]["id"],
        },
    )
    assert response.status_code == 201, response.text


def test_old_opt_in_cannot_reactivate_revoked_continuing_permission(pair):
    _, client, _, _, _ = pair
    snapshot = mutually_confirm(pair)
    allow(pair, snapshot, "a", True)
    allow(pair, snapshot, "b", True)
    grant = client.get("/v1/continuing-grants").json()[0]
    client.post(
        "/v1/continuing-grants/" + grant["id"] + "/revoke",
        json={
            "request_key": "revoke-before-new-opt-in",
            "expected_version": grant["version"],
        },
    )
    client.headers["Authorization"] = "Bearer token-a"
    response = client.post(
        "/v1/share-scopes/" + snapshot["scope_id"] + "/responses",
        json={
            "request_key": "only-one-new-opt-in",
            "expected_version": snapshot["scope_version"],
            "decision": "allowed",
            "continuing_opt_in": True,
        },
    )
    assert response.status_code == 200
    assert client.get("/v1/continuing-grants").json()[0]["status"] == "revoked"


def test_next_pair_uses_grant_after_both_confirm_and_cancelled_scope_cannot_revive(
    pair,
):
    service, client, clock, _, _ = pair
    snapshot = mutually_confirm(pair)
    allow(pair, snapshot, "a", True)
    allow(pair, snapshot, "b", True)
    records = {}
    for actor in ("a", "b"):
        client.headers["Authorization"] = "Bearer token-" + actor
        rid, _ = create(client, "next-recording-" + actor)
        upload(client, rid)
        enqueue(client, rid)
        run_once(service)
        records[actor] = client.get(f"/v1/recordings/{rid}").json()
        records[actor]["source"] = client.get(f"/v1/recordings/{rid}/sources").json()[0]
    client.headers["Authorization"] = "Bearer token-a"
    connection = client.post(
        "/v1/connections",
        json={
            "request_key": "next-connection",
            "expected_version": records["a"]["version"],
            "recording_id": records["a"]["id"],
        },
    ).json()
    next_pair = service, client, clock, records, connection
    snapshot = mutually_confirm(next_pair)
    assert snapshot["conversation_id"]
    assert set(snapshot["share_states"].values()) == {"allowed"}
    client.post(
        "/v1/share-scopes/" + snapshot["scope_id"] + "/revoke",
        json={
            "request_key": "revoke-only-new-scope",
            "expected_version": snapshot["scope_version"],
        },
    )
    with service.store.transaction() as state:
        confirmation = state.get("matches", snapshot["match_id"])["confirmations"][
            "person-a"
        ]
    client.headers["Authorization"] = "Bearer token-a"
    body = {
        "request_key": "reconfirm-revoked-scope",
        "expected_version": snapshot["match_version"],
        "selection": confirmation["selection"],
        "participation_ranges": confirmation["participation_ranges"],
        "same_conversation": True,
        "only_two_people": True,
        "attribution_confirmed": True,
        "participation_confirmed": True,
    }
    revised = client.post(
        "/v1/matches/" + snapshot["match_id"] + "/revisions", json=body
    ).json()
    confirm(next_pair, revised, "b")
    result = client.get("/v1/connections/" + connection["connection_id"]).json()
    assert result["conversation_id"] is None
    assert set(result["share_states"].values()) == {"pending"}
    assert result["continuing_state"] == "mutual_active"


def test_pending_snapshot_has_no_peer_body_or_recording_identifiers(pair):
    snapshot = join(pair)
    _, client, _, records, connection = pair
    Draft7Validator(
        {
            "$ref": "#/definitions/ConnectionSnapshot",
            "definitions": SCHEMA["definitions"],
        },
        format_checker=FormatChecker(),
    ).validate(snapshot)
    response = client.get("/v1/connections/" + connection["connection_id"])
    assert records["a"]["id"] not in response.text
    assert records["a"]["source"]["original_text"] not in response.text
    assert snapshot["own_selection"] == []
    assert client.get("/v1/conversations").json() == []
    assert (
        client.get("/v1/recordings/" + records["a"]["id"] + "/sources").status_code
        == 404
    )
    assert allow(pair, snapshot, "a").status_code == 409


def test_both_confirmations_and_permissions_required_then_revocation_blocks(pair):
    snapshot = join(pair)
    _, client, _, records, connection = pair
    confirm(pair, snapshot, "a")
    snapshot = client.get("/v1/connections/" + connection["connection_id"]).json()
    assert allow(pair, snapshot, "a").status_code == 409
    confirm(pair, snapshot, "b")
    snapshot = client.get("/v1/connections/" + connection["connection_id"]).json()
    assert allow(pair, snapshot, "a").status_code == 200
    assert client.get("/v1/conversations").json() == []
    response = allow(pair, snapshot, "b")
    assert response.status_code == 200, response.text
    cid = response.json()["conversation_id"]
    conversation = client.get("/v1/conversations/" + cid).json()
    # No model adapter means an explicit failure, never a made-up successful merge.
    assert conversation["status"] == "failed"
    assert conversation["script"] == conversation["highlights"] == []
    assert (
        client.get(
            f"/v1/conversations/{cid}/sources/" + records["a"]["source"]["id"]
        ).status_code
        == 404
    )
    response = client.post(
        "/v1/share-scopes/" + snapshot["scope_id"] + "/revoke",
        json={
            "request_key": "revoke-sharing-b",
            "expected_version": snapshot["scope_version"],
        },
    )
    assert response.status_code == 200, response.text
    for actor in ("a", "b"):
        client.headers["Authorization"] = "Bearer token-" + actor
        assert client.get("/v1/conversations/" + cid).status_code == 404
        assert client.get("/v1/conversations").json() == []
        assert (
            client.get(
                "/v1/recordings/" + records[actor]["id"] + "/sources"
            ).status_code
            == 200
        )


def test_wrong_codes_rate_limit_and_expiry(pair):
    _, client, clock, records, connection = pair
    client.headers["Authorization"] = "Bearer token-b"
    for attempt in range(6):
        response = client.post(
            "/v1/connections/accept",
            json={
                "request_key": "wrong-code-" + str(attempt),
                "expected_version": records["b"]["version"],
                "recording_id": records["b"]["id"],
                "code": "ZZZZZZZZ",
            },
        )
        assert response.status_code == (404 if attempt < 5 else 429), response.text
    clock[0] = NOW + timedelta(minutes=11)
    response = client.post(
        "/v1/connections/accept",
        json={
            "request_key": "expired-code-test",
            "expected_version": records["b"]["version"],
            "recording_id": records["b"]["id"],
            "code": connection["code"],
        },
    )
    assert response.status_code == 404


def test_confirmation_rejects_foreign_source_and_stale_version(pair):
    snapshot = join(pair)
    _, client, _, records, _ = pair
    body = confirm(pair, snapshot, "a")
    client.headers["Authorization"] = "Bearer token-b"
    body["request_key"] = "forged-source-test"
    response = client.post(
        "/v1/matches/" + snapshot["match_id"] + "/confirmations", json=body
    )
    assert response.status_code == 409
    body["expected_version"] += 1
    assert (
        client.post(
            "/v1/matches/" + snapshot["match_id"] + "/confirmations", json=body
        ).status_code
        == 409
    )
