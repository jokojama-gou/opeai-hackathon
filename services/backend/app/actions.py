"""Explicit owner adoption, stable ToDo identity and full-manifest invalidation."""

from copy import deepcopy
from datetime import timedelta
from .contexts import ContextService, digest
from .errors import DomainError
from .service import identifier, iso, parse, require_version


class ActionService(ContextService):
    def _owned(self, state, kind, actor, item_id):
        item = state.get(kind, item_id)
        if not item or item["owner_id"] != actor:
            raise DomainError("not_found", 404)
        return item

    def _fresh(self, state, kind, item):
        status = self._manifest_state(state, item["owner_id"], item["manifest_id"])
        if status != "available":
            if not item.get("invalidated_at"):
                item["version"] += 1
            item["source_state"] = status
            manifest = state.get("manifests", item["manifest_id"])
            item.setdefault(
                "invalidated_at",
                (
                    min(iso(self.clock()), manifest["expires_at"])
                    if manifest
                    else iso(self.clock())
                ),
            )
            if manifest:
                item["invalidated_at"] = min(
                    item["invalidated_at"], manifest["expires_at"]
                )
                for rid in manifest["recording_ids"]:
                    record = state.get("recordings", rid)
                    if record and record.get("deleted_at"):
                        item["invalidated_at"] = min(
                            item["invalidated_at"], record["deleted_at"]
                        )
            for field in (
                "action",
                "due",
                "evidence",
                "sections",
                "result",
                "assignee",
            ):
                item.pop(field, None)
            if kind == "candidates":
                item["candidate_status"] = (
                    "stale" if status == "needs_review" else "unavailable"
                )
            if kind == "todos" and self.clock() >= parse(
                item["invalidated_at"]
            ) + timedelta(days=7):
                state.table(kind).pop(item["id"], None)
                return False
        return True

    def _publish_candidates(self, state, run, result):
        actor = run["owner_id"]
        manifest = state.get("manifests", run["manifest_id"])
        staged = []
        for value in result["candidates"]:
            groups = self._check_evidence(state, actor, manifest, value["evidence"])
            # Stable across correction/regeneration; no title similarity matching.
            unique = digest([actor, groups, value["intent_key"]])
            if any(x["id"] == unique for x in staged):
                raise DomainError("duplicate_candidates", 422)
            staged.append(
                {
                    "id": unique,
                    "owner_id": actor,
                    "intent_key": value["intent_key"],
                    "evidence_group_ids": groups,
                    "manifest_id": manifest["id"],
                    "recording_ids": manifest["recording_ids"],
                    "expires_at": manifest["expires_at"],
                    "action": value["action"],
                    "due": None,
                    "assignee": value["assignee"],
                    "evidence": value["evidence"],
                    "origins": {
                        "action": "conversation",
                        "due": "unset",
                        "assignee": "unconfirmed",
                    },
                    "candidate_status": "needs_confirmation",
                    "source_state": "available",
                    "version": 1,
                    "run_id": run["id"],
                    "duplicate_unresolved": False,
                }
            )
        # Multiple intents grounded in the same utterance cannot yet be proven
        # distinct by the personal adapter. Hold adoption, retaining every text.
        for candidate in staged:
            candidate["duplicate_unresolved"] = any(
                other["id"] != candidate["id"]
                and set(other["evidence_group_ids"])
                & set(candidate["evidence_group_ids"])
                for other in staged
            )
        for candidate in staged:
            old = state.get("candidates", candidate["id"])
            if old:
                if old["manifest_id"] == manifest["id"]:
                    continue  # Includes dismissal and accepted state.
                candidate["version"] = old["version"] + 1
                candidate["previously_dismissed"] = old[
                    "candidate_status"
                ] == "dismissed" or old.get("previously_dismissed", False)
            state.put("candidates", candidate)
        return [c["id"] for c in staged]

    def candidates(self, actor):
        with self.store.transaction() as state:
            result = []
            for item in list(state.table("candidates").values()):
                if item["owner_id"] != actor:
                    continue
                self._fresh(state, "candidates", item)
                if (
                    item["source_state"] != "available"
                    or item["candidate_status"] == "dismissed"
                ):
                    continue
                result.append(
                    deepcopy(
                        {
                            k: v
                            for k, v in item.items()
                            if k not in ("owner_id", "recording_ids")
                        }
                    )
                )
            return result

    def dismiss_candidate(self, actor, cid, payload):
        def action(state):
            item = self._owned(state, "candidates", actor, cid)
            self._fresh(state, "candidates", item)
            require_version(item, payload["expected_version"])
            if (
                item["source_state"] != "available"
                or item["candidate_status"] == "accepted"
            ):
                raise DomainError("candidate_unavailable")
            item.update(
                candidate_status="dismissed",
                previously_dismissed=True,
                version=item["version"] + 1,
            )
            return {"id": cid, "version": item["version"]}

        return self.mutate(actor, "dismiss-candidate:" + cid, payload, action)

    def _adoptable(self, state, actor, cid, version, payload):
        item = self._owned(state, "candidates", actor, cid)
        self._fresh(state, "candidates", item)
        require_version(item, version)
        if not payload["as_own_task"] or not payload["action"].strip():
            raise DomainError("own_task_confirmation_required", 422)
        if item["source_state"] != "available" or item["candidate_status"] not in (
            "proposed",
            "needs_confirmation",
            "accepted",
        ):
            raise DomainError("candidate_unavailable")
        if item["duplicate_unresolved"]:
            raise DomainError("duplicate_resolution_required")
        return item

    def adopt(self, actor, cid, payload):
        def action(state):
            candidate = self._adoptable(
                state, actor, cid, payload["expected_version"], payload
            )
            old = next(
                (
                    t
                    for t in state.table("todos").values()
                    if t["owner_id"] == actor and t["candidate_id"] == cid
                ),
                None,
            )
            if old:
                self._fresh(state, "todos", old)
                if old["todo_status"] == "deleted":
                    raise DomainError("todo_deleted")
                if old["source_state"] != "available":
                    raise DomainError("source_reconfirmation_required")
                return {"id": old["id"], "version": old["version"]}
            # Keep a bodyless acceptance marker after a deleted/expired ToDo is purged.
            if candidate.get("todo_id"):
                raise DomainError("todo_deleted")
            todo = state.put(
                "todos",
                {
                    "id": identifier(),
                    "owner_id": actor,
                    "candidate_id": cid,
                    "intent_key": candidate["intent_key"],
                    "evidence_group_ids": candidate["evidence_group_ids"],
                    "manifest_id": candidate["manifest_id"],
                    "recording_ids": candidate["recording_ids"],
                    "action": payload["action"],
                    "due": payload["due"],
                    "todo_status": "open",
                    "source_state": "available",
                    "evidence": candidate["evidence"],
                    "version": 1,
                    "adopted_at": iso(self.clock()),
                    "expires_at": candidate["expires_at"],
                },
            )
            candidate.update(
                candidate_status="accepted",
                todo_id=todo["id"],
                version=candidate["version"] + 1,
            )
            return {"id": todo["id"], "version": 1}

        return self.mutate(actor, "adopt:" + cid, payload, action)

    def _todos(self, state, actor):
        result = []
        for todo in list(state.table("todos").values()):
            if (
                todo["owner_id"] != actor
                or not self._fresh(state, "todos", todo)
                or todo["todo_status"] == "deleted"
            ):
                continue
            keys = ("id", "version", "source_state", "todo_status")
            if todo["source_state"] == "available":
                keys += ("candidate_id", "action", "due", "evidence", "expires_at")
            elif todo["source_state"] == "needs_review":
                keys += ("candidate_id",)
            result.append(deepcopy({k: todo[k] for k in keys}))
        return result

    def todos(self, actor):
        with self.store.transaction() as state:
            return self._todos(state, actor)

    def edit_todo(self, actor, tid, payload, deleting=False):
        def action(state):
            todo = self._owned(state, "todos", actor, tid)
            if not self._fresh(state, "todos", todo):
                raise DomainError("not_found", 404)
            require_version(todo, payload["expected_version"])
            if deleting:
                todo.update(todo_status="deleted", version=todo["version"] + 1)
                for field in ("action", "due", "evidence"):
                    todo.pop(field, None)
            else:
                if (
                    todo["source_state"] != "available"
                    or todo["todo_status"] == "deleted"
                ):
                    raise DomainError("source_reconfirmation_required")
                if not payload["action"].strip():
                    raise DomainError("invalid_action", 422)
                todo.update(
                    action=payload["action"],
                    due=payload["due"],
                    todo_status=payload["todo_status"],
                    version=todo["version"] + 1,
                )
            return {"id": tid, "version": todo["version"]}

        return self.mutate(
            actor, ("delete-todo:" if deleting else "edit-todo:") + tid, payload, action
        )

    def reconfirm_todo(self, actor, tid, payload):
        def action(state):
            todo = self._owned(state, "todos", actor, tid)
            if not self._fresh(state, "todos", todo):
                raise DomainError("not_found", 404)
            require_version(todo, payload["expected_version"])
            if (
                todo["source_state"] != "needs_review"
                or todo["todo_status"] == "deleted"
                or todo["candidate_id"] != payload["candidate_id"]
            ):
                raise DomainError("invalid_reconfirmation")
            candidate = self._adoptable(
                state,
                actor,
                payload["candidate_id"],
                payload["candidate_version"],
                payload,
            )
            todo.update(
                action=payload["action"],
                due=payload["due"],
                manifest_id=candidate["manifest_id"],
                evidence=candidate["evidence"],
                source_state="available",
                version=todo["version"] + 1,
            )
            todo.pop("invalidated_at", None)
            candidate.update(
                candidate_status="accepted",
                todo_id=tid,
                version=candidate["version"] + 1,
            )
            return {"id": tid, "version": todo["version"]}

        return self.mutate(actor, "reconfirm-todo:" + tid, payload, action)

    def cleanup(self):
        result = super().cleanup()
        with self.store.transaction() as state:
            for kind in ("todos", "candidates"):
                for item in list(state.table(kind).values()):
                    self._fresh(state, kind, item)
                    if (
                        kind == "candidates"
                        and item.get("invalidated_at")
                        and self.clock()
                        >= parse(item["invalidated_at"]) + timedelta(days=7)
                    ):
                        state.table(kind).pop(item["id"], None)
        return result
