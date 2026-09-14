"""Private saved source references. No model receives user notes."""

from copy import deepcopy
from datetime import timedelta
from .errors import DomainError
from .service import identifier, iso, parse, require_version
from .sharing import SharingService


class PersonalService(SharingService):
    def _saved_target(self, state, actor, payload):
        source = state.get("sources", payload["target_id"])
        if not source:
            raise DomainError("not_found", 404)
        record = self.recording(state, actor, source["recording_id"])
        require_version(source, payload["target_version"])
        return source, record

    def _saved(self, state, actor, sid):
        item = state.get("saved", sid)
        if not item or item["owner_id"] != actor:
            raise DomainError("not_found", 404)
        source = state.get("sources", item["target_id"])
        record = state.get("recordings", item["recording_ids"][0])
        if (
            not record
            or record["deleted_at"]
            or parse(record["text_expires_at"]) <= self.clock()
            or not source
        ):
            item["source_state"] = "unavailable"
            item.setdefault(
                "invalidated_at",
                (
                    record.get("deleted_at") or record["text_expires_at"]
                    if record
                    else iso(self.clock())
                ),
            )
        elif source["version"] != item["target_version"]:
            item["source_state"] = "needs_review"
            item.setdefault("invalidated_at", iso(self.clock()))
        if item["source_state"] != "available":
            item.pop("private_note", None)
            if self.clock() >= parse(item["invalidated_at"]) + timedelta(days=7):
                state.table("saved").pop(sid)
                raise DomainError("not_found", 404)
        return item

    def _saved_dto(self, state, actor, sid):
        item = self._saved(state, actor, sid)
        if item["source_state"] != "available":
            return {key: item[key] for key in ("id", "version", "source_state")}
        source, record = self._saved_target(state, actor, item)
        return {
            key: item[key]
            for key in (
                "id",
                "version",
                "source_state",
                "target_kind",
                "target_id",
                "target_version",
                "tag",
                "private_note",
                "saved_at",
            )
        } | {
            "expires_at": record["text_expires_at"],
            "recording_id": record["id"],
            "text": source["original_text"],
        }

    def save_item(self, actor, payload):
        def action(state):
            if payload["expected_version"] != 0:
                raise DomainError("version_conflict")
            source, record = self._saved_target(state, actor, payload)
            existing = next(
                (
                    value
                    for value in state.table("saved").values()
                    if value["owner_id"] == actor and value["target_id"] == source["id"]
                ),
                None,
            )
            if existing:
                current = self._saved(state, actor, existing["id"])
                return {key: current[key] for key in ("id", "version", "source_state")}
            manifest = state.put(
                "manifests",
                {
                    "id": identifier(),
                    "owner_id": actor,
                    "kind": "personal-source",
                    "sources": {source["id"]: source["version"]},
                    "recording_ids": [record["id"]],
                    "expires_at": record["text_expires_at"],
                },
            )
            item = state.put(
                "saved",
                {
                    "id": identifier(),
                    "owner_id": actor,
                    "target_kind": "source",
                    "target_id": source["id"],
                    "target_version": source["version"],
                    "manifest_id": manifest["id"],
                    "recording_ids": [record["id"]],
                    "tag": payload["tag"],
                    "private_note": payload["private_note"],
                    "source_state": "available",
                    "version": 1,
                    "saved_at": iso(self.clock()),
                    "expires_at": record["text_expires_at"],
                },
            )
            return {key: item[key] for key in ("id", "version", "source_state")}

        return self.mutate(actor, "save-item", payload, action)

    def saved_items(self, actor):
        with self.store.transaction() as state:
            values = []
            for item in list(state.table("saved").values()):
                if item["owner_id"] == actor:
                    try:
                        values.append(self._saved_dto(state, actor, item["id"]))
                    except DomainError:
                        continue
            return values

    def edit_saved(self, actor, sid, payload):
        def action(state):
            item = self._saved(state, actor, sid)
            require_version(item, payload["expected_version"])
            if item["source_state"] != "available":
                raise DomainError("source_reconfirmation_required")
            item.update(
                tag=payload["tag"],
                private_note=payload["private_note"],
                version=item["version"] + 1,
            )
            return {"id": sid, "version": item["version"]}

        return self.mutate(actor, "edit-saved:" + sid, payload, action)

    def rebind_saved(self, actor, sid, payload):
        def action(state):
            item = self._saved(state, actor, sid)
            require_version(item, payload["expected_version"])
            if (
                item["source_state"] != "needs_review"
                or payload["target_id"] != item["target_id"]
            ):
                raise DomainError("invalid_reconfirmation")
            source, record = self._saved_target(state, actor, payload)
            manifest = state.put(
                "manifests",
                {
                    "id": identifier(),
                    "owner_id": actor,
                    "kind": "personal-source",
                    "sources": {source["id"]: source["version"]},
                    "recording_ids": [record["id"]],
                    "expires_at": record["text_expires_at"],
                },
            )
            item.update(
                target_version=source["version"],
                manifest_id=manifest["id"],
                tag=payload["tag"],
                private_note=payload["private_note"],
                source_state="available",
                version=item["version"] + 1,
            )
            item.pop("invalidated_at", None)
            return {"id": sid, "version": item["version"]}

        return self.mutate(actor, "rebind-saved:" + sid, payload, action)

    def delete_saved(self, actor, sid, payload):
        def action(state):
            item = self._saved(state, actor, sid)
            require_version(item, payload["expected_version"])
            if not payload["confirm_note_deletion"]:
                raise DomainError("confirmation_required")
            state.table("saved").pop(sid)
            return {"id": sid, "status": "deleted"}

        return self.mutate(actor, "delete-saved:" + sid, payload, action)

    def cleanup(self):
        result = super().cleanup()
        with self.store.transaction() as state:
            for sid, item in list(state.table("saved").items()):
                if item.get("invalidated_at") and self.clock() >= parse(
                    item["invalidated_at"]
                ) + timedelta(days=7):
                    state.table("saved").pop(sid)
            used = {item["manifest_id"] for item in state.table("saved").values()}
            for mid, manifest in list(state.table("manifests").items()):
                if manifest.get("kind") == "personal-source" and mid not in used:
                    state.table("manifests").pop(mid)
        return result
