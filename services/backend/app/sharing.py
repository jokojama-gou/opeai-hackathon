"""Manual two-person matching and sharing. No discovery or automatic attribution."""

from copy import deepcopy
from datetime import timedelta
import hashlib
import hmac
import secrets
from .errors import DomainError
from .service import Service, identifier, iso, parse, require_version


class SharingService(Service):
    def _grant(self, state, parties):
        gid = hashlib.sha256("|".join(sorted(parties)).encode()).hexdigest()
        return gid, state.get("continuing_grants", gid)

    def _begin_merge(self, state, match, scope):
        if not scope["conversation_id"]:
            conversation = state.put(
                "conversations",
                {
                    "id": identifier(),
                    "mode": "normal",
                    "revision": 1,
                    "access_revision": 1,
                    "status": "failed",
                    "confirmation_reason": None,
                    "script": [],
                    "highlights": [],
                    "scope_id": scope["id"],
                    "recording_ids": match["recording_ids"],
                    "error_code": "generation_not_configured",
                },
            )
            scope["conversation_id"] = conversation["id"]
        else:
            state.get("conversations", scope["conversation_id"]).update(
                status="failed",
                confirmation_reason=None,
                error_code="generation_not_configured",
            )

    def _connection(self, state, actor, cid):
        connection = state.get("connections", cid)
        if not connection or actor not in connection["parties"]:
            raise DomainError("not_found", 404)
        return connection

    def snapshot(self, state, actor, cid):
        connection = self._connection(state, actor, cid)
        match = state.get("matches", connection.get("match_id"))
        scope = state.get("scopes", connection.get("scope_id"))
        peer = next((p for p in connection["parties"] if p != actor), None)
        _, grant = self._grant(state, connection["parties"])
        continuing = (
            "mutual_active"
            if grant and not grant["revoked_at"]
            else "revoked" if grant else "inactive"
        )
        own = match["confirmations"].get(actor, {}) if match else {}
        allowed = bool(
            scope
            and scope.get("conversation_id")
            and not scope.get("revoked_at")
            and match["status"] == "confirmed"
            and match["version"] == scope["match_version"]
            and all(
                scope["responses"].get(person, {}).get("decision") == "allowed"
                for person in scope["parties"]
            )
        )
        return {
            "connection_id": cid,
            "status": (
                "expired"
                if parse(connection["expires_at"]) <= self.clock() and not allowed
                else connection["status"]
            ),
            "expires_at": connection["expires_at"],
            "peer_display": (
                state.get("profiles", peer).get("display_name")
                if peer and state.get("profiles", peer)
                else "接続した相手" if peer else None
            ),
            "verification_code": connection.get("verification_code"),
            "match_id": match["id"] if match else None,
            "match_version": match["version"] if match else None,
            "scope_id": scope["id"] if scope else None,
            "scope_version": scope["version"] if scope else None,
            "own_selection": own.get("selection", []),
            "confirmation_states": (
                {
                    p: match["confirmations"].get(p, {}).get("status", "pending")
                    for p in connection["parties"]
                }
                if match
                else {}
            ),
            "share_states": (
                {
                    p: scope["responses"].get(p, {}).get("decision", "pending")
                    for p in connection["parties"]
                }
                if scope
                else {}
            ),
            "continuing_state": continuing,
            "conversation_id": scope["conversation_id"] if allowed else None,
            "job_id": scope.get("job_id") if allowed else None,
            "next_actions": (
                ["wait"]
                if not match
                else (
                    ["revise"]
                    if scope["match_version"] != match["version"] or scope["revoked_at"]
                    else (
                        ["confirm"]
                        if match["status"] != "confirmed"
                        else ["share"] if not allowed else ["view"]
                    )
                )
            ),
        }

    def create_connection(self, actor, payload):
        def action(state):
            record = self.recording(state, actor, payload["recording_id"], audio=True)
            require_version(record, payload["expected_version"])
            if record["upload_status"] != "ready":
                raise DomainError("transcription_not_ready")
            for match in state.table("matches").values():
                if record["id"] in match["recording_ids"] and match["status"] not in (
                    "expired",
                    "cancelled",
                ):
                    raise DomainError("recording_already_paired")
            for connection in state.table("connections").values():
                if (
                    connection["recording_id"] == record["id"]
                    and parse(connection["expires_at"]) > self.clock()
                ):
                    raise DomainError("connection_exists")
            code = "".join(
                secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(8)
            )
            value = {
                "id": identifier(),
                "owner_id": actor,
                "parties": [actor],
                "recording_id": record["id"],
                "code_hash": hmac.new(
                    self.settings.ticket_secret.encode(), code.encode(), hashlib.sha256
                ).hexdigest(),
                "expires_at": iso(self.clock() + timedelta(minutes=10)),
                "code_expires_at": iso(self.clock() + timedelta(minutes=10)),
                "status": "pending",
                "used": False,
                "version": 1,
            }
            state.put("connections", value)
            return {"connection_id": value["id"], "code": code}

        return self.mutate(actor, "create-connection", payload, action)

    def accept_connection(self, actor, payload):
        def action(state):
            # Persist failed attempts before returning a generic error; no exception rollback.
            attempts = state.get("connection_attempts", actor)
            if not attempts or parse(attempts["until"]) <= self.clock():
                attempts = state.put(
                    "connection_attempts",
                    {
                        "id": actor,
                        "count": 0,
                        "until": iso(self.clock() + timedelta(minutes=10)),
                    },
                )
            if attempts["count"] >= 5:
                return {"error": "connection_unavailable", "status": 429}
            attempts["count"] += 1
            code_hash = hmac.new(
                self.settings.ticket_secret.encode(),
                payload["code"].upper().encode(),
                hashlib.sha256,
            ).hexdigest()
            connection = next(
                (
                    c
                    for c in state.table("connections").values()
                    if hmac.compare_digest(c["code_hash"], code_hash)
                ),
                None,
            )
            if (
                not connection
                or connection["used"]
                or parse(connection["code_expires_at"]) <= self.clock()
                or connection["owner_id"] == actor
            ):
                return {"error": "connection_unavailable", "status": 404}
            record = self.recording(state, actor, payload["recording_id"], audio=True)
            require_version(record, payload["expected_version"])
            original = self.recording(
                state, connection["owner_id"], connection["recording_id"], audio=True
            )
            if record["upload_status"] != "ready" or any(
                record["id"] in m["recording_ids"]
                and m["status"] not in ("expired", "cancelled")
                for m in state.table("matches").values()
            ):
                raise DomainError("recording_already_paired")
            connection.update(
                used=True,
                parties=[connection["owner_id"], actor],
                verification_code="".join(
                    secrets.choice("0123456789") for _ in range(4)
                ),
            )
            deadline = min(
                self.clock() + timedelta(hours=24),
                parse(record["audio_expires_at"]),
                parse(original["audio_expires_at"]),
            )
            match = state.put(
                "matches",
                {
                    "id": identifier(),
                    "recording_ids": [original["id"], record["id"]],
                    "parties": connection["parties"],
                    "status": "pending",
                    "version": 1,
                    "confirmations": {},
                    "connection_id": connection["id"],
                },
            )
            scope = state.put(
                "scopes",
                {
                    "id": identifier(),
                    "match_id": match["id"],
                    "match_version": 1,
                    "parties": connection["parties"],
                    "responses": {},
                    "version": 1,
                    "expires_at": iso(deadline),
                    "revoked_at": None,
                    "conversation_id": None,
                },
            )
            connection.update(
                match_id=match["id"], scope_id=scope["id"], expires_at=iso(deadline)
            )
            attempts["count"] = 0
            return {"connection_id": connection["id"]}

        result = self.mutate(actor, "accept-connection", payload, action)
        if "error" in result:
            raise DomainError(result["error"], result["status"])
        return result

    def connections(self, actor, cid=None):
        with self.store.transaction() as state:
            if cid:
                return self.snapshot(state, actor, cid)
            return [
                self.snapshot(state, actor, c["id"])
                for c in state.table("connections").values()
                if actor in c["parties"]
            ]

    def confirm_match(self, actor, match_id, payload, revising=False):
        def action(state):
            match = state.get("matches", match_id)
            if not match or actor not in match["parties"]:
                raise DomainError("not_found", 404)
            require_version(match, payload["expected_version"])
            connection = self._connection(state, actor, match["connection_id"])
            scope = state.get("scopes", connection["scope_id"])
            if parse(scope["expires_at"]) <= self.clock():
                raise DomainError("confirmation_expired")
            if match["status"] in ("cancelled", "expired"):
                raise DomainError("new_connection_required")
            if revising:
                records = [
                    self.recording(
                        state, state.get("recordings", rid)["owner_id"], rid, audio=True
                    )
                    for rid in match["recording_ids"]
                ]
                deadline = min(
                    self.clock() + timedelta(hours=24),
                    *(parse(r["audio_expires_at"]) for r in records)
                )
                match.update(
                    version=match["version"] + 1, confirmations={}, status="pending"
                )
                previous = scope
                scope = state.put(
                    "scopes",
                    {
                        "id": identifier(),
                        "match_id": match_id,
                        "match_version": match["version"],
                        "parties": match["parties"],
                        "responses": {},
                        "version": 1,
                        "expires_at": iso(deadline),
                        "revoked_at": None,
                        "conversation_id": previous["conversation_id"],
                        "explicit_required": bool(
                            previous["revoked_at"] or previous.get("explicit_required")
                        ),
                    },
                )
                previous["revoked_at"] = iso(self.clock())
                connection.update(scope_id=scope["id"], expires_at=iso(deadline))
                if scope["conversation_id"]:
                    conversation = state.get("conversations", scope["conversation_id"])
                    conversation.update(
                        scope_id=scope["id"],
                        status="needs_confirmation",
                        confirmation_reason="scope_changed",
                        script=[],
                        highlights=[],
                        revision=conversation["revision"] + 1,
                        access_revision=conversation["access_revision"] + 1,
                    )
            elif (
                actor in match["confirmations"]
                or scope["match_version"] != match["version"]
            ):
                raise DomainError("new_confirmation_round_required")
            if parse(scope["expires_at"]) <= self.clock() or scope.get("revoked_at"):
                raise DomainError("confirmation_expired")
            selection = payload["selection"]
            if not selection:
                raise DomainError("selection_required", 422)
            owned = next(
                rid
                for rid in match["recording_ids"]
                if state.get("recordings", rid)["owner_id"] == actor
            )
            self.recording(state, actor, owned, audio=True)
            intervals = []
            for ref in selection:
                source = state.get("sources", ref["source_id"])
                if (
                    not source
                    or source["recording_id"] != owned
                    or source["version"] != ref["source_version"]
                ):
                    raise DomainError("invalid_selection")
                if (
                    not 0
                    <= ref["char_start"]
                    < ref["char_end"]
                    <= len(source["original_text"])
                ):
                    raise DomainError("invalid_selection", 422)
                if (
                    source["start_ms"] is None
                    or ref["start_ms"] is None
                    or ref["end_ms"] is None
                    or not source["start_ms"]
                    <= ref["start_ms"]
                    < ref["end_ms"]
                    <= source["end_ms"]
                ):
                    raise DomainError("timing_confirmation_required")
                intervals.append((ref["start_ms"], ref["end_ms"]))
            for person in ("self", "peer"):
                interval = payload["participation_ranges"][person]
                if (
                    not min(start for start, _ in intervals)
                    <= interval["start_ms"]
                    < interval["end_ms"]
                    <= max(end for _, end in intervals)
                ):
                    raise DomainError("invalid_participation_range", 422)
            confirmed = (
                payload["same_conversation"]
                and payload["only_two_people"]
                and payload["attribution_confirmed"]
                and payload["participation_confirmed"]
            )
            match["confirmations"][actor] = {
                "status": "confirmed" if confirmed else "disputed",
                "selection": deepcopy(selection),
                "participation_ranges": deepcopy(payload["participation_ranges"]),
                "confirmed_at": iso(self.clock()),
            }
            match["status"] = (
                "confirmed"
                if all(
                    match["confirmations"].get(p, {}).get("status") == "confirmed"
                    for p in match["parties"]
                )
                else "disputed" if not confirmed else "pending"
            )
            # Changing any confirmation invalidates previous share responses.
            scope["responses"] = {}
            scope["version"] += 1
            _, grant = self._grant(state, match["parties"])
            if (
                match["status"] == "confirmed"
                and grant
                and not grant["revoked_at"]
                and not scope.get("explicit_required")
            ):
                scope["responses"] = {
                    person: {
                        "decision": "allowed",
                        "continuing_opt_in": True,
                        "at": iso(self.clock()),
                    }
                    for person in match["parties"]
                }
                scope["automatic_grant_id"] = grant["id"]
                self._begin_merge(state, match, scope)
            return {
                "connection_id": connection["id"],
                "match_version": match["version"],
            }

        return self.mutate(
            actor, ("revise:" if revising else "confirm:") + match_id, payload, action
        )

    def share_response(self, actor, scope_id, payload):
        def action(state):
            scope = state.get("scopes", scope_id)
            if not scope or actor not in scope["parties"]:
                raise DomainError("not_found", 404)
            require_version(scope, payload["expected_version"])
            match = state.get("matches", scope["match_id"])
            if (
                match["status"] != "confirmed"
                or match["version"] != scope["match_version"]
                or parse(scope["expires_at"]) <= self.clock()
                or scope["revoked_at"]
            ):
                raise DomainError("confirmation_required")
            for rid in match["recording_ids"]:
                record = state.get("recordings", rid)
                self.recording(state, record["owner_id"], rid, audio=True)
            gid, grant = self._grant(state, scope["parties"])
            grant_version = grant["version"] if grant else 0
            scope["responses"][actor] = {
                "decision": payload["decision"],
                "continuing_opt_in": payload["continuing_opt_in"],
                "at": iso(self.clock()),
                "grant_version": grant_version,
            }
            # The same scope version is the approval round for both parties.
            if all(
                scope["responses"].get(p, {}).get("decision") == "allowed"
                for p in scope["parties"]
            ):
                if (not grant or grant["revoked_at"]) and all(
                    scope["responses"][person]["continuing_opt_in"]
                    and scope["responses"][person].get("grant_version") == grant_version
                    for person in scope["parties"]
                ):
                    state.put(
                        "continuing_grants",
                        {
                            "id": gid,
                            "parties": scope["parties"],
                            "version": grant["version"] + 1 if grant else 1,
                            "revoked_at": None,
                        },
                    )
                self._begin_merge(state, match, scope)
            return {
                "connection_id": match["connection_id"],
                "conversation_id": scope["conversation_id"],
            }

        return self.mutate(actor, "share:" + scope_id, payload, action)

    def _authorized_conversation(self, state, actor, cid):
        conversation = state.get("conversations", cid)
        if not conversation:
            raise DomainError("not_found", 404)
        scope = state.get("scopes", conversation["scope_id"])
        match = state.get("matches", scope["match_id"])
        if (
            actor not in scope["parties"]
            or scope["revoked_at"]
            or match["status"] != "confirmed"
            or match["version"] != scope["match_version"]
            or not all(
                scope["responses"].get(p, {}).get("decision") == "allowed"
                for p in scope["parties"]
            )
        ):
            raise DomainError("not_found", 404)
        for rid in match["recording_ids"]:
            record = state.get("recordings", rid)
            if record["deleted_at"] or parse(record["text_expires_at"]) <= self.clock():
                raise DomainError("not_found", 404)
        return conversation, match

    def conversations(self, actor, cid=None):
        def dto(value):
            return {
                key: value[key]
                for key in (
                    "id",
                    "mode",
                    "revision",
                    "access_revision",
                    "status",
                    "script",
                    "highlights",
                    "confirmation_reason",
                )
            }

        with self.store.transaction() as state:
            if cid:
                return dto(self._authorized_conversation(state, actor, cid)[0])
            results = []
            for value in state.table("conversations").values():
                try:
                    results.append(
                        dto(self._authorized_conversation(state, actor, value["id"])[0])
                    )
                except DomainError:
                    pass
            return results

    def shared_source(self, actor, cid, source_id):
        with self.store.transaction() as state:
            conversation, match = self._authorized_conversation(state, actor, cid)
            if conversation["status"] != "ready":
                raise DomainError("not_found", 404)
            source = state.get("sources", source_id)
            refs = [
                ref
                for confirmation in match["confirmations"].values()
                for ref in confirmation["selection"]
                if ref["source_id"] == source_id
            ]
            if not source or not refs:
                raise DomainError("not_found", 404)
            # Character offsets remain those of the original. Never return unauthorized prefix/suffix.
            return {
                "source_id": source_id,
                "version": source["version"],
                "slices": [
                    {
                        "char_start": ref["char_start"],
                        "char_end": ref["char_end"],
                        "text": source["original_text"][
                            ref["char_start"] : ref["char_end"]
                        ],
                        "start_ms": ref["start_ms"],
                        "end_ms": ref["end_ms"],
                    }
                    for ref in refs
                    if ref["source_version"] == source["version"]
                ],
            }

    def revoke_scope(self, actor, scope_id, payload):
        def action(state):
            scope = state.get("scopes", scope_id)
            if not scope or actor not in scope["parties"]:
                raise DomainError("not_found", 404)
            require_version(scope, payload["expected_version"])
            scope["revoked_at"] = iso(self.clock())
            scope["version"] += 1
            for person in scope["parties"]:
                scope["responses"][person] = {
                    "decision": "revoked",
                    "continuing_opt_in": False,
                }
            if scope["conversation_id"]:
                conversation = state.get("conversations", scope["conversation_id"])
                conversation.update(status="stale", script=[], highlights=[])
                conversation["access_revision"] += 1
            return {"id": scope_id, "version": scope["version"], "status": "revoked"}

        return self.mutate(actor, "revoke-scope:" + scope_id, payload, action)

    def cancel_match(self, actor, mid, payload):
        def action(state):
            match = state.get("matches", mid)
            if not match or actor not in match["parties"]:
                raise DomainError("not_found", 404)
            require_version(match, payload["expected_version"])
            match.update(
                status="cancelled", version=match["version"] + 1, confirmations={}
            )
            connection = self._connection(state, actor, match["connection_id"])
            connection.update(status="cancelled", expires_at=iso(self.clock()))
            scope = state.get("scopes", connection["scope_id"])
            scope.update(
                revoked_at=iso(self.clock()), responses={}, version=scope["version"] + 1
            )
            if scope["conversation_id"]:
                conversation = state.get("conversations", scope["conversation_id"])
                conversation.update(
                    status="stale",
                    script=[],
                    highlights=[],
                    access_revision=conversation["access_revision"] + 1,
                )
            return {"connection_id": connection["id"], "status": "cancelled"}

        return self.mutate(actor, "cancel-match:" + mid, payload, action)

    def continuing_grants(self, actor):
        with self.store.transaction() as state:
            return [
                {
                    "id": value["id"],
                    "version": value["version"],
                    "status": "revoked" if value["revoked_at"] else "active",
                    "connection_ids": [
                        c["id"]
                        for c in state.table("connections").values()
                        if sorted(c["parties"]) == sorted(value["parties"])
                    ],
                }
                for value in state.table("continuing_grants").values()
                if actor in value["parties"]
            ]

    def revoke_grant(self, actor, gid, payload):
        def action(state):
            grant = state.get("continuing_grants", gid)
            if not grant or actor not in grant["parties"]:
                raise DomainError("not_found", 404)
            require_version(grant, payload["expected_version"])
            grant.update(revoked_at=iso(self.clock()), version=grant["version"] + 1)
            for scope in state.table("scopes").values():
                conversation = state.get("conversations", scope.get("conversation_id"))
                if scope.get("automatic_grant_id") == gid and (
                    not conversation or conversation["status"] != "ready"
                ):
                    scope.update(
                        responses={},
                        version=scope["version"] + 1,
                        explicit_required=True,
                    )
                    if conversation:
                        conversation.update(
                            status="stale",
                            script=[],
                            highlights=[],
                            access_revision=conversation["access_revision"] + 1,
                        )
            return {"id": gid, "version": grant["version"], "status": "revoked"}

        return self.mutate(actor, "revoke-grant:" + gid, payload, action)
