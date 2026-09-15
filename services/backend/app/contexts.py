"""Owner-scoped personal views and full-input dependency manifests.

Paired recordings remain visible as original records, but generation waits for
K05's authoritative shared interval coverage; text similarity never deduplicates.
"""

from copy import deepcopy
from datetime import timedelta
import hashlib
import json
from .personal import PersonalService
from .errors import DomainError
from .service import iso, parse


def digest(value):
    return hashlib.sha256(
        json.dumps(
            value, sort_keys=True, ensure_ascii=False, separators=(",", ":")
        ).encode()
    ).hexdigest()


class ContextService(PersonalService):
    def _context(self, state, actor, cid):
        if not cid.startswith("personal:"):
            raise DomainError("not_found", 404)
        record = self.recording(state, actor, cid.removeprefix("personal:"))
        sources = sorted(
            [
                s
                for s in state.table("sources").values()
                if s["recording_id"] == record["id"]
            ],
            key=lambda s: s["ordinal"],
        )
        if not sources:
            raise DomainError("context_not_ready")
        matches = {
            m["id"]: [m["version"], m["status"]]
            for m in state.table("matches").values()
            if record["id"] in m["recording_ids"]
        }
        scopes = {
            s["id"]: [s["version"], s.get("revoked_at"), s.get("responses", {})]
            for s in state.table("scopes").values()
            if s.get("match_id") in matches
        }
        paired = any(m[1] not in ("cancelled", "expired") for m in matches.values())
        dependencies = {
            "context_id": cid,
            "context_revision": record["version"],
            "source_versions": {s["id"]: s["version"] for s in sources},
            "coverage": {s["id"]: [0, len(s["original_text"])] for s in sources},
            "evidence_groups": {s["id"]: "personal:" + s["id"] for s in sources},
            "match_versions": matches,
            "access_versions": scopes,
            "policy": self.policy(),
            "normalization_version": "personal-v1",
        }
        manifest_hash = digest([actor, dependencies])
        return {
            "id": cid,
            "kind": "personal",
            "context_revision": record["version"],
            "recording_id": record["id"],
            "canonical_start_at": iso(
                parse(record["stopped_at"])
                - timedelta(milliseconds=record["duration_ms"])
            ),
            "expires_at": record["text_expires_at"],
            "manifest_hash": manifest_hash,
            "generation_allowed": self.policy()["generation_configured"],
            "status": "needs_confirmation" if paired else "ready",
            "preparation_reason": "duplicate_resolution_required" if paired else None,
            "sources": [
                {k: v for k, v in s.items() if k != "ordinal"} for s in sources
            ],
            "_dependencies": dependencies,
        }

    def context(self, actor, cid):
        with self.store.transaction() as state:
            current = self._context(state, actor, cid)
            result = self._context_dto(current)
            result["latest_runs"] = {}
            rounds = {}
            for run in state.table("agent_runs").values():
                manifest = state.get("manifests", run["manifest_id"])
                if (
                    run["owner_id"] == actor
                    and run["role"] in ("G1", "G2")
                    and manifest
                    and manifest["contexts"] == {cid: current["manifest_hash"]}
                ):
                    if run["retry_round"] >= rounds.get(run["role"], -1):
                        result["latest_runs"][run["role"]] = run["id"]
                        rounds[run["role"]] = run["retry_round"]
            return result

    @staticmethod
    def _context_dto(context):
        return deepcopy({k: v for k, v in context.items() if not k.startswith("_")})

    def _contexts(self, state, actor):
        result = []
        for record in state.table("recordings").values():
            if record["owner_id"] == actor:
                try:
                    result.append(
                        self._context(state, actor, "personal:" + record["id"])
                    )
                except DomainError:
                    continue
        return sorted(result, key=lambda c: (c["canonical_start_at"], c["id"]))

    def contexts(self, actor):
        with self.store.transaction() as state:
            return [self._context_dto(c) for c in self._contexts(state, actor)]

    def context_evidence(self, actor, cid, sid, version):
        with self.store.transaction() as state:
            context = self._context(state, actor, cid)
            source = next((s for s in context["sources"] if s["id"] == sid), None)
            if not source:
                raise DomainError("not_found", 404)
            if source["version"] != version:
                raise DomainError("version_conflict")
            return {
                "context_id": cid,
                "context_revision": context["context_revision"],
                "target_kind": "source",
                "recording_id": context["recording_id"],
                "source": source,
            }

    def _manifest(self, state, actor, contexts):
        if any(c["status"] != "ready" for c in contexts):
            raise DomainError("duplicate_resolution_required")
        if any(not c["generation_allowed"] for c in contexts):
            raise DomainError("generation_not_configured")
        hashes = {c["id"]: c["manifest_hash"] for c in contexts}
        mid = digest([actor, hashes])
        return state.put(
            "manifests",
            {
                "id": mid,
                "hash": mid,
                "owner_id": actor,
                "kind": "generation",
                "contexts": hashes,
                "dependencies": {c["id"]: c["_dependencies"] for c in contexts},
                "recording_ids": [c["recording_id"] for c in contexts],
                "expires_at": min(c["expires_at"] for c in contexts),
            },
        )

    def _manifest_state(self, state, actor, mid):
        manifest = state.get("manifests", mid)
        if not manifest or manifest["owner_id"] != actor:
            return "unavailable"
        changed = False
        for cid, old_hash in manifest["contexts"].items():
            try:
                current = self._context(state, actor, cid)
            except DomainError:
                return "unavailable"
            if not current["generation_allowed"]:
                return "unavailable"
            if current["manifest_hash"] != old_hash or current["status"] != "ready":
                changed = True
        return "needs_review" if changed else "available"

    def _generation_input(self, state, actor, manifest):
        if self._manifest_state(state, actor, manifest["id"]) != "available":
            raise DomainError("manifest_changed")
        # Only selected current source text. No tokens, saved notes, ToDo copies,
        # account identifiers, or other contexts are included in model input.
        return [
            {
                "context_id": cid,
                "context_revision": c["context_revision"],
                "sources": [
                    {
                        "source_id": s["id"],
                        "source_version": s["version"],
                        "text": s["original_text"],
                        "speaker_attribution": "unconfirmed",
                    }
                    for s in c["sources"]
                ],
            }
            for cid in sorted(manifest["contexts"])
            for c in [self._context(state, actor, cid)]
        ]

    def _check_evidence(self, state, actor, manifest, refs):
        groups = set()
        for ref in refs:
            if ref["context_id"] not in manifest["contexts"]:
                raise DomainError("invalid_generation_evidence", 422)
            c = self._context(state, actor, ref["context_id"])
            source = next(
                (s for s in c["sources"] if s["id"] == ref["source_id"]), None
            )
            if (
                not source
                or c["context_revision"] != ref["context_revision"]
                or source["version"] != ref["source_version"]
                or not 0
                <= ref["char_start"]
                < ref["char_end"]
                <= len(source["original_text"])
            ):
                raise DomainError("invalid_generation_evidence", 422)
            groups.add(c["_dependencies"]["evidence_groups"][source["id"]])
        return sorted(groups)
