"""Explicit daily selection in a user-confirmed IANA time zone."""

from copy import deepcopy
from datetime import date
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from .contexts import digest
from .generation import GenerationService
from .errors import DomainError
from .service import iso, parse, require_version


def review_zone(value):
    try:
        return ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError, TypeError):
        raise DomainError("invalid_time_zone", 422) from None


class ReviewService(GenerationService):
    def preferences(self, actor):
        with self.store.transaction() as state:
            preference = state.get("preferences", actor)
            return {
                "version": preference["version"] if preference else 0,
                "review_time_zone": (
                    preference["review_time_zone"] if preference else None
                ),
            }

    def edit_zone(self, actor, payload):
        review_zone(payload["review_time_zone"])

        def action(state):
            preference = state.get("preferences", actor)
            require_version(preference or {"version": 0}, payload["expected_version"])
            version = payload["expected_version"] + 1
            state.put(
                "preferences",
                {
                    "id": actor,
                    "version": version,
                    "review_time_zone": payload["review_time_zone"],
                },
            )
            return {"version": version}

        return self.mutate(actor, "review-time-zone", payload, action)

    def _selection(self, state, actor, local_date, zone):
        try:
            if date.fromisoformat(local_date).isoformat() != local_date:
                raise ValueError()
        except (ValueError, TypeError):
            raise DomainError("invalid_date", 422) from None
        tz = review_zone(zone)
        preference = state.get("preferences", actor)
        if not preference or preference["review_time_zone"] != zone:
            raise DomainError("review_time_zone_confirmation_required")
        contexts = [
            c
            for c in self._contexts(state, actor)
            if parse(c["canonical_start_at"]).astimezone(tz).date().isoformat()
            == local_date
        ]
        known = {c["recording_id"] for c in self._contexts(state, actor)}
        unprepared = []
        for record in state.table("recordings").values():
            if record["owner_id"] != actor or record["id"] in known:
                continue
            try:
                self.recording(state, actor, record["id"])
            except DomainError:
                continue
            from datetime import timedelta

            start = parse(record["stopped_at"]) - timedelta(
                milliseconds=record["duration_ms"]
            )
            if start.astimezone(tz).date().isoformat() == local_date:
                unprepared.append(
                    {
                        "recording_id": record["id"],
                        "version": record["version"],
                        "status": record["upload_status"],
                    }
                )
        selection_hash = digest(
            [
                actor,
                local_date,
                zone,
                preference["version"],
                {c["id"]: c["manifest_hash"] for c in contexts},
                sorted(unprepared, key=lambda r: r["recording_id"]),
            ]
        )
        return contexts, unprepared, selection_hash

    def today(self, actor, local_date, zone):
        with self.store.transaction() as state:
            contexts, unprepared, selection_hash = self._selection(
                state, actor, local_date, zone
            )
            available = [c for c in contexts if c["status"] == "ready"]
            reviews = [
                self._daily_dto(state, actor, r)
                for r in state.table("daily").values()
                if r["owner_id"] == actor
                and r["local_date"] == local_date
                and r["review_time_zone"] == zone
            ]
            return {
                "date": local_date,
                "review_time_zone": zone,
                "selection_hash": selection_hash,
                "contexts": [self._context_dto(c) for c in contexts],
                "unprepared": unprepared,
                "default_selected_context_ids": (
                    [c["id"] for c in available] if len(available) <= 10 else []
                ),
                "selection_required": len(available) > 10,
                "daily_reviews": reviews,
                "todos": [
                    t
                    for t in self._todos(state, actor)
                    if t["todo_status"] == "open" and t["source_state"] == "available"
                ][:3],
                "generation_configured": self.policy()["generation_configured"],
            }

    def _manifest_state(self, state, actor, mid):
        status = super()._manifest_state(state, actor, mid)
        manifest = state.get("manifests", mid)
        if status != "available" or not manifest or not manifest.get("daily_scope"):
            return status
        scope = manifest["daily_scope"]
        for run_id, version in manifest.get("summary_runs", {}).values():
            run = state.get("agent_runs", run_id)
            if not run or run["status"] != "ready" or run["version"] != version:
                return "needs_review"
        try:
            _, _, current = self._selection(state, actor, scope["date"], scope["zone"])
            if current != scope["selection_hash"]:
                return "needs_review"
        except DomainError:
            return "needs_review"
        return status

    def _generation_input(self, state, actor, manifest):
        contexts = super()._generation_input(state, actor, manifest)
        if manifest.get("daily_scope"):
            scope = manifest["daily_scope"]
            for context in contexts:
                context["review_date"] = scope["date"]
                context["review_time_zone"] = scope["zone"]
                summary = manifest.get("summary_runs", {}).get(context["context_id"])
                if summary:
                    context["summary"] = deepcopy(
                        state.get("agent_runs", summary[0])["result"]
                    )
        return contexts

    def create_daily(self, actor, payload):
        def action(state):
            if payload["expected_version"] != 0:
                raise DomainError("version_conflict")
            contexts, _, selection_hash = self._selection(
                state, actor, payload["date"], payload["zone"]
            )
            if selection_hash != payload["expected_manifest_hash"]:
                raise DomainError("selection_changed")
            ids = sorted(payload["selected_context_ids"])
            if not ids or len(ids) > 10 or len(ids) != len(set(ids)):
                raise DomainError("invalid_daily_selection", 422)
            selected = [c for c in contexts if c["id"] in ids]
            if len(selected) != len(ids):
                raise DomainError("invalid_daily_selection", 422)
            manifest = deepcopy(self._manifest(state, actor, selected))
            manifest["daily_scope"] = {
                "date": payload["date"],
                "zone": payload["zone"],
                "selection_hash": selection_hash,
            }
            manifest["summary_runs"] = {}
            for run in state.table("agent_runs").values():
                dependency = state.get("manifests", run["manifest_id"])
                if (
                    run["owner_id"] == actor
                    and run["role"] == "G1"
                    and run["status"] == "ready"
                    and dependency
                ):
                    for c in selected:
                        if dependency["contexts"] == {c["id"]: c["manifest_hash"]}:
                            manifest["summary_runs"][c["id"]] = [
                                run["id"],
                                run["version"],
                            ]
            manifest["id"] = manifest["hash"] = digest(
                [manifest["hash"], manifest["daily_scope"], manifest["summary_runs"]]
            )
            state.put("manifests", manifest)
            run = self._enqueue(state, actor, "G5", manifest)
            daily_id = digest(
                [actor, payload["date"], payload["zone"], ids, manifest["hash"]]
            )
            if not state.get("daily", daily_id):
                state.put(
                    "daily",
                    {
                        "id": daily_id,
                        "owner_id": actor,
                        "local_date": payload["date"],
                        "review_time_zone": payload["zone"],
                        "selected_context_ids": ids,
                        "manifest_id": manifest["id"],
                        "recording_ids": manifest["recording_ids"],
                        "expires_at": manifest["expires_at"],
                        "run_id": run["id"],
                        "version": 1,
                        "created_at": iso(self.clock()),
                    },
                )
            return {
                "id": daily_id,
                "run_id": run["id"],
                "version": state.get("daily", daily_id)["version"],
            }

        return self.mutate(actor, "create-daily", payload, action)

    def _daily_dto(self, state, actor, daily):
        run = self._run_fresh(
            state, self._owned(state, "agent_runs", actor, daily["run_id"])
        )
        result = {
            "id": daily["id"],
            "version": daily["version"],
            "run_id": run["id"],
            "status": run["status"],
            "error_code": run["error_code"],
            "retryable": run["retryable"],
        }
        if run["status"] == "ready":
            result.update(
                sections=deepcopy(run["result"]), expires_at=daily["expires_at"]
            )
        return result

    def daily(self, actor, did):
        with self.store.transaction() as state:
            return self._daily_dto(
                state, actor, self._owned(state, "daily", actor, did)
            )
