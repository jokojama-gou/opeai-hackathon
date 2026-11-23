"""Artificial adapters only. No audio/model/network calls or real-person text."""

from dataclasses import replace
from datetime import timedelta
import json
import pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app.reviews import ReviewService
from app.generation import GenerationSettings, GenerationFailure, run_generation_once
from test_personal_flow import system, ready, TestAuth, create, CHECKSUM


class ArtificialGenerator:
    settings = GenerationSettings(
        "fixture-model-v1",
        "prompt-v1",
        "schema-v1",
        "artificial-generation",
        True,
        100000,
        20000,
        5000,
        60,
        "test-budget",
        100,
        1,
    )

    def __init__(self):
        self.calls = []
        self.callback = None
        self.result = None

    def generate(self, **request):
        self.calls.append(request)
        if self.callback:
            self.callback()
        if isinstance(self.result, Exception):
            raise self.result
        if self.result is not None:
            return self.result
        context = request["contexts"][0]
        source = context["sources"][0]
        evidence = [
            {
                "context_id": context["context_id"],
                "context_revision": context["context_revision"],
                "source_id": source["source_id"],
                "source_version": source["source_version"],
                "char_start": 0,
                "char_end": len(source["text"]),
                "target_kind": "source",
            }
        ]
        if request["role"] == "G2":
            return {
                "candidates": [
                    {
                        "intent_key": "send_material",
                        "kind": "task",
                        "action": "人工の資料を送る",
                        "assignee": "other",
                        "evidence": evidence,
                    }
                ]
            }
        keys = (
            ("contents", "reasons", "decisions", "unresolved")
            if request["role"] == "G1"
            else ("topics", "ideas", "promises", "questions")
        )
        return {k: [{"text": "人工の振り返り", "evidence": evidence}] for k in keys}


@pytest.fixture
def derived(system):
    old, _, asr, clock = system
    generator = ArtificialGenerator()
    settings = replace(
        old.settings,
        generation_destination="artificial-generation",
        generation_retention="Artificial adapter only. No network.",
    )
    service = ReviewService(
        old.store, old.blobs, settings, old.probe, asr, old.clock, generation=generator
    )
    client = TestClient(create_app(service, TestAuth(), settings))
    client.headers["Authorization"] = "Bearer token-a"
    return service, client, asr, clock, generator


def prepare(derived):
    service, client, asr, clock, _ = derived
    rid, _, _ = ready((service, client, asr, clock))
    return client.get("/v1/contexts").json()[0]


def start(client, context, role="G2", key="generate-candidates"):
    response = client.post(
        f"/v1/contexts/{context['id']}/agent-runs",
        json={
            "request_key": key,
            "expected_version": context["context_revision"],
            "expected_manifest_hash": context["manifest_hash"],
            "role": role,
        },
    )
    assert response.status_code == 202, response.text
    return response.json()["id"]


def candidate(derived):
    context = prepare(derived)
    service, client, _, _, _ = derived
    run = start(client, context)
    assert run_generation_once(service)
    assert client.get(f"/v1/agent-runs/{run}").json()["status"] == "ready"
    return context, client.get("/v1/action-candidates").json()[0], run


def adopt(client, value, **overrides):
    payload = {
        "request_key": "adopt-artificial",
        "expected_version": value["version"],
        "action": "自分で資料を確認する",
        "due": None,
        "as_own_task": True,
    } | overrides
    return client.post(f"/v1/action-candidates/{value['id']}/adopt", json=payload)


def set_zone(client, zone="Asia/Tokyo", key="zone-confirmed"):
    version = client.get("/v1/preferences").json()["version"]
    response = client.patch(
        "/v1/preferences/review-time-zone",
        json={
            "request_key": key,
            "expected_version": version,
            "review_time_zone": zone,
        },
    )
    assert response.status_code == 200, response.text


def daily(
    client,
    contexts,
    selection_hash,
    key="create-daily",
    day="2026-09-14",
    zone="Asia/Tokyo",
):
    return client.post(
        "/v1/daily-reviews",
        json={
            "request_key": key,
            "expected_version": 0,
            "date": day,
            "zone": zone,
            "selected_context_ids": contexts,
            "expected_manifest_hash": selection_hash,
        },
    )


def test_personal_context_full_manifest_and_evidence_owner(derived):
    service, client, _, _, _ = derived
    c = prepare(derived)
    assert c["kind"] == "personal" and "conversation_id" not in c
    assert "_dependencies" not in c
    source = c["sources"][0]
    path = f"/v1/contexts/{c['id']}/evidence?source_id={source['id']}&version=1"
    assert client.get(path).json()["recording_id"] == c["recording_id"]
    assert client.get(path.replace("version=1", "version=2")).status_code == 409
    client.headers["Authorization"] = "Bearer token-b"
    assert client.get(path).status_code == 404
    assert client.get("/v1/contexts").json() == []


def test_explicit_adopt_edit_done_undo_no_regeneration_overwrite(derived):
    service, client, _, _, generator = derived
    c, value, run = candidate(derived)
    assert value["assignee"] == "other" and value["due"] is None
    assert client.get("/v1/todos").json() == []
    assert adopt(client, value, as_own_task=False).status_code == 422
    response = adopt(client, value)
    assert response.status_code == 201, response.text
    tid = response.json()["id"]
    assert adopt(client, value).json()["id"] == tid
    for version, status in ((1, "done"), (2, "open")):
        changed = client.patch(
            f"/v1/todos/{tid}",
            json={
                "request_key": "edit-todo-" + status,
                "expected_version": version,
                "action": "本人の編集内容",
                "due": {"kind": "date", "value": "2026-09-20", "time_zone": None},
                "todo_status": status,
            },
        )
        assert changed.status_code == 200
    assert start(client, c, key="same-input-new-request") == run
    assert not run_generation_once(service)
    assert len(generator.calls) == 1
    assert client.get("/v1/todos").json()[0]["action"] == "本人の編集内容"
    client.headers["Authorization"] = "Bearer token-b"
    assert client.get("/v1/todos").json() == []
    assert (
        client.request(
            "DELETE",
            f"/v1/todos/{tid}",
            json={"request_key": "other-delete", "expected_version": 3},
        ).status_code
        == 404
    )


def test_background_source_correction_hides_todo_and_reconfirm_keeps_id_done(derived):
    service, client, asr, _, _ = derived
    asr.result.append(
        {
            "text": "引用されない背景",
            "start_ms": 900,
            "end_ms": 1000,
            "speaker_label": None,
        }
    )
    c, value, _ = candidate(derived)
    tid = adopt(client, value).json()["id"]
    assert (
        client.patch(
            f"/v1/todos/{tid}",
            json={
                "request_key": "complete-todo",
                "expected_version": 1,
                "action": "旧派生本文",
                "due": None,
                "todo_status": "done",
            },
        ).status_code
        == 200
    )
    background = c["sources"][1]
    assert (
        client.post(
            f"/v1/sources/{background['id']}/corrections",
            json={
                "request_key": "background-correction",
                "expected_version": 1,
                "replacement": "背景の訂正版",
            },
        ).status_code
        == 201
    )
    old = client.get("/v1/todos").json()[0]
    assert (
        old["source_state"] == "needs_review"
        and "action" not in old
        and "due" not in old
    )
    assert client.get("/v1/action-candidates").json() == []
    current = client.get(f"/v1/contexts/{c['id']}").json()
    start(client, current, key="new-version-candidates")
    run_generation_once(service)
    new_candidate = client.get("/v1/action-candidates").json()[0]
    assert new_candidate["id"] == value["id"]
    response = client.post(
        f"/v1/todos/{tid}/reconfirm",
        json={
            "request_key": "reconfirm-current",
            "expected_version": old["version"],
            "candidate_id": new_candidate["id"],
            "candidate_version": new_candidate["version"],
            "action": "新版を本人が確認",
            "due": None,
            "as_own_task": True,
        },
    )
    assert response.status_code == 200, response.text
    current_todo = client.get("/v1/todos").json()[0]
    assert current_todo["id"] == tid and current_todo["todo_status"] == "done"


def test_excessive_candidates_reject_all_and_nonretryable(derived):
    service, client, _, _, generator = derived
    c = prepare(derived)
    generator.result = {"candidates": [{} for _ in range(11)]}
    run = start(client, c)
    run_generation_once(service)
    result = client.get(f"/v1/agent-runs/{run}").json()
    assert result["error_code"] == "too_many_candidates" and not result["retryable"]
    assert client.get("/v1/action-candidates").json() == []
    assert start(client, c, key="try-normal-post-again") == run
    assert not run_generation_once(service)


def test_four_call_cap_manual_retry_idempotency_and_unknown_no_retry(derived):
    service, client, _, _, generator = derived
    c = prepare(derived)
    generator.result = GenerationFailure("temporarily_unavailable", retryable=True)
    rid = start(client, c)
    run_generation_once(service)
    run_generation_once(service)
    run = client.get(f"/v1/agent-runs/{rid}").json()
    assert run["status"] == "failed" and run["retryable"]
    payload = {"request_key": "retry-once-only", "expected_version": run["version"]}
    retry = client.post(f"/v1/agent-runs/{rid}/retry", json=payload)
    assert retry.status_code == 202
    assert (
        client.post(f"/v1/agent-runs/{rid}/retry", json=payload).json() == retry.json()
    )
    next_id = retry.json()["id"]
    assert start(client, c, key="normal-post-after-retry") == next_id
    with service.store.transaction() as state:
        state.entities["agent_runs"] = dict(
            reversed(list(state.table("agent_runs").items()))
        )
    assert client.get(f"/v1/contexts/{c['id']}").json()["latest_runs"]["G2"] == next_id
    run_generation_once(service)
    run_generation_once(service)
    assert not run_generation_once(service)
    assert len(generator.calls) == 4
    final = client.get(f"/v1/agent-runs/{next_id}").json()
    assert not final["retryable"]
    assert (
        client.post(
            f"/v1/agent-runs/{next_id}/retry",
            json={
                "request_key": "forbidden-retry",
                "expected_version": final["version"],
            },
        ).status_code
        == 409
    )


def test_configuration_change_during_generation_never_publishes_late_output(derived):
    service, client, _, _, generator = derived
    c = prepare(derived)

    def disable_generation():
        service.settings = replace(service.settings, generation_destination=None)

    generator.callback = disable_generation
    run = start(client, c)
    run_generation_once(service)
    assert client.get(f"/v1/agent-runs/{run}").json()["status"] == "stale"
    assert client.get("/v1/action-candidates").json() == []


def test_budget_and_missing_config_stop_before_call(derived):
    service, client, _, _, generator = derived
    c = prepare(derived)
    generator.settings = replace(
        generator.settings, total_budget_units=1, reserved_units_per_call=2
    )
    run = start(client, c)
    run_generation_once(service)
    assert (
        client.get(f"/v1/agent-runs/{run}").json()["error_code"]
        == "generation_budget_exhausted"
    )
    assert not generator.calls
    service.generation = None
    assert client.get("/v1/processing-policy").json()["generation_configured"] is False


def test_daily_selection_explicit_zone_subset_and_no_notes(derived):
    service, client, _, _, generator = derived
    c = prepare(derived)
    assert client.get("/v1/today?date=2026-09-14&zone=Asia/Tokyo").status_code == 409
    set_zone(client)
    today = client.get("/v1/today?date=2026-09-14&zone=Asia/Tokyo").json()
    assert today["default_selected_context_ids"] == [c["id"]]
    assert daily(client, [], today["selection_hash"]).status_code == 422
    source = c["sources"][0]
    assert (
        client.post(
            "/v1/saved-items",
            json={
                "request_key": "save-private-note",
                "expected_version": 0,
                "target_kind": "source",
                "target_id": source["id"],
                "target_version": 1,
                "tag": "other",
                "private_note": "モデルへ送ってはいけない個人メモ",
            },
        ).status_code
        == 201
    )
    response = daily(client, [c["id"]], today["selection_hash"])
    assert response.status_code == 202, response.text
    run_generation_once(service)
    result = client.get(f"/v1/daily-reviews/{response.json()['id']}").json()
    assert result["status"] == "ready" and len(result["sections"]) == 4
    assert "個人メモ" not in json.dumps(generator.calls, ensure_ascii=False)
    assert client.get("/v1/todos").json() == []
    set_zone(client, "America/New_York", "zone-changed")
    expired = client.get(f"/v1/daily-reviews/{response.json()['id']}").json()
    assert expired["status"] == "stale" and "sections" not in expired


def test_daily_start_day_and_more_than_ten_never_truncate(derived):
    service, client, _, _, _ = derived
    original = prepare(derived)
    set_zone(client)
    with service.store.transaction() as state:
        record = state.get("recordings", original["recording_id"])
        record["stopped_at"] = (
            "2026-09-13T15:00:00.500Z"  # Tokyo midnight + .5s, starts yesterday.
        )
    previous = client.get("/v1/today?date=2026-09-13&zone=Asia/Tokyo").json()
    assert len(previous["contexts"]) == 1
    assert (
        client.get("/v1/today?date=2026-09-14&zone=Asia/Tokyo").json()["contexts"] == []
    )
    # Artificial storage setup for a large day; unique unrelated source identities.
    from copy import deepcopy

    with service.store.transaction() as state:
        record = state.get("recordings", original["recording_id"])
        source = state.get("sources", original["sources"][0]["id"])
        for i in range(10):
            rid = "artificial-extra-" + str(i)
            state.put("recordings", deepcopy(record) | {"id": rid})
            state.put(
                "sources",
                deepcopy(source)
                | {"id": "extra-source-" + str(i), "recording_id": rid},
            )
    today = client.get("/v1/today?date=2026-09-13&zone=Asia/Tokyo").json()
    assert len(today["contexts"]) == 11
    assert today["selection_required"] and today["default_selected_context_ids"] == []
    assert (
        daily(
            client,
            [c["id"] for c in today["contexts"]],
            today["selection_hash"],
            day="2026-09-13",
        ).status_code
        == 422
    )


def test_new_record_invalidates_daily_selection_and_existing_body(derived):
    service, client, _, _, _ = derived
    c = prepare(derived)
    set_zone(client)
    today = client.get("/v1/today?date=2026-09-14&zone=Asia/Tokyo").json()
    response = daily(client, [c["id"]], today["selection_hash"])
    run_generation_once(service)
    create(client, "new-unprepared-record")
    assert (
        daily(
            client, [c["id"]], today["selection_hash"], key="changed-selection"
        ).status_code
        == 409
    )
    stale = client.get(f"/v1/daily-reviews/{response.json()['id']}").json()
    assert stale["status"] == "stale" and "sections" not in stale


def test_expired_todo_hides_all_content_and_tombstone_disappears(derived):
    service, client, _, clock, _ = derived
    _, value, _ = candidate(derived)
    adopt(client, value)
    clock[0] += timedelta(days=31)
    todo = client.get("/v1/todos").json()[0]
    assert set(todo) == {"id", "version", "source_state", "todo_status"}
    assert todo["source_state"] == "unavailable"
    assert client.get("/v1/action-candidates").json() == []
    clock[0] += timedelta(days=7)
    service.cleanup()
    assert client.get("/v1/todos").json() == []


@pytest.mark.parametrize(
    "due",
    [
        {"kind": "date", "value": "2026-02-30", "time_zone": None},
        {
            "kind": "datetime",
            "value": "2026-03-08T02:30:00-05:00",
            "time_zone": "America/New_York",
        },
        {"kind": "datetime", "value": "2026-09-14T12:00:00", "time_zone": "Asia/Tokyo"},
    ],
)
def test_invalid_due_rejected_without_adoption(derived, due):
    _, client, _, _, _ = derived
    _, value, _ = candidate(derived)
    assert adopt(client, value, due=due).status_code == 422
    assert client.get("/v1/todos").json() == []


def test_all_workers_share_two_slots_and_atomic_budget(derived):
    from threading import Event, Thread

    service, client, _, _, generator = derived
    c = prepare(derived)
    start(client, c)
    start(client, c, role="G1", key="parallel-summary")
    set_zone(client)
    today = client.get("/v1/today?date=2026-09-14&zone=Asia/Tokyo").json()
    daily(client, [c["id"]], today["selection_hash"])
    release, entered = Event(), Event()

    def hold():
        if len(generator.calls) == 2:
            entered.set()
        assert release.wait(5)

    generator.callback = hold
    threads = [Thread(target=run_generation_once, args=(service,)) for _ in range(2)]
    try:
        for thread in threads:
            thread.start()
        assert entered.wait(5)
        assert not run_generation_once(service)
        assert len(generator.calls) == 2
        with service.store.transaction() as state:
            assert state.get("generation_budgets", "test-budget")["reserved"] == 2
    finally:
        release.set()
        for thread in threads:
            thread.join(5)
    generator.callback = None
    assert run_generation_once(service)
    assert len(generator.calls) == 3


def test_dismissal_survives_reordering_and_new_extraction_is_marked(derived):
    service, client, _, _, _ = derived
    c, value, run = candidate(derived)
    assert (
        client.patch(
            f"/v1/action-candidates/{value['id']}",
            json={
                "request_key": "dismiss-candidate",
                "expected_version": value["version"],
                "candidate_status": "dismissed",
            },
        ).status_code
        == 200
    )
    assert start(client, c, key="do-not-resurrect") == run
    assert client.get("/v1/action-candidates").json() == []
    source = c["sources"][0]
    client.post(
        f"/v1/sources/{source['id']}/corrections",
        json={
            "request_key": "update-dismissed",
            "expected_version": source["version"],
            "replacement": "訂正済みの人工資料",
        },
    )
    client.get(
        "/v1/action-candidates"
    )  # Invalidate the old candidate before publishing.
    start(
        client,
        client.get(f"/v1/contexts/{c['id']}").json(),
        key="new-dismissed-version",
    )
    run_generation_once(service)
    assert client.get("/v1/action-candidates").json()[0]["previously_dismissed"]


def test_generation_after_audio_expiry_ignores_historical_consent(derived):
    service, client, _, clock, _ = derived
    c = prepare(derived)
    clock[0] += timedelta(days=8)
    with service.store.transaction() as state:
        state.put(
            "consents",
            {
                "id": "legacy-denial",
                "actor_id": "person-a",
                "recording_id": c["recording_id"],
                "external_text_generation": False,
            },
        )
    current = client.get(f"/v1/contexts/{c['id']}").json()
    assert current["generation_allowed"]
    assert current["manifest_hash"] == c["manifest_hash"]
    run = start(client, current)
    assert run_generation_once(service)
    assert client.get(f"/v1/agent-runs/{run}").json()["status"] == "ready"


def test_invalid_evidence_no_partial_publish_and_unknown_failure_stops(derived):
    service, client, _, _, generator = derived
    c = prepare(derived)
    generator.result = {
        "candidates": [
            {
                "intent_key": "bad",
                "kind": "task",
                "action": "人工候補",
                "assignee": "unknown",
                "evidence": [
                    {
                        "context_id": c["id"],
                        "context_revision": c["context_revision"],
                        "source_id": c["sources"][0]["id"],
                        "source_version": 1,
                        "char_start": 0,
                        "char_end": 1000,
                        "target_kind": "source",
                    }
                ],
            }
        ]
    }
    rid = start(client, c)
    run_generation_once(service)
    assert (
        client.get(f"/v1/agent-runs/{rid}").json()["error_code"]
        == "invalid_generation_evidence"
    )
    assert client.get("/v1/action-candidates").json() == []
    generator.result = RuntimeError("must not be logged or returned")
    second = start(client, c, role="G1", key="unknown-failure")
    run_generation_once(service)
    run = client.get(f"/v1/agent-runs/{second}").json()
    assert run["error_code"] == "result_unknown" and not run["retryable"]
