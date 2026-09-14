from datetime import timedelta
from test_personal_flow import (
    system,
    ready,
    create,
    consent,
    upload,
    AUDIO,
    CHECKSUM,
    NOW,
)


def test_replayed_upload_still_validates_body(system):
    _, client, _, _ = system
    rid, _ = create(client)
    cid = consent(client, rid)
    headers = upload(client, rid, cid)
    assert (
        client.put(
            f"/v1/recordings/{rid}/audio", content=b"changed-body", headers=headers
        ).status_code
        == 409
    )


def test_concurrent_upload_loser_does_not_delete_published_audio(system):
    service, client, _, _ = system
    rid, _ = create(client)
    cid = consent(client, rid)
    ticket = client.post(
        f"/v1/recordings/{rid}/uploads",
        json={
            "request_key": "concurrent-upload",
            "expected_version": 1,
            "consent_id": cid,
            "checksum": CHECKSUM,
        },
    ).json()["ticket"]
    original_put = service.blobs.put
    entered = False

    def put(key, value):
        nonlocal entered
        original_put(key, value)
        if not entered:
            entered = True
            service.upload("person-a", rid, ticket, CHECKSUM, AUDIO)

    service.blobs.put = put
    assert service.upload("person-a", rid, ticket, CHECKSUM, AUDIO)["version"] == 2
    assert service.read_audio("person-a", rid) == AUDIO
    assert len(service.blobs.values) == 1


def test_cleanup_is_idempotent(system):
    service, _, _, clock = system
    rid, _, _ = ready(system)
    clock[0] = NOW + timedelta(days=31)
    service.cleanup()
    with service.store.transaction() as state:
        before = dict(state.get("recordings", rid))
    service.cleanup()
    with service.store.transaction() as state:
        assert state.get("recordings", rid) == before
