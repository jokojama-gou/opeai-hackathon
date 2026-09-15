"""Transaction boundary shared by PostgreSQL and isolated artificial-data tests."""

from contextlib import contextmanager
from copy import deepcopy
from threading import RLock
import json
import os
import sys
import psycopg
from psycopg.conninfo import conninfo_to_dict
from psycopg.types.json import Jsonb


class State:
    def __init__(self, entities=None):
        self.entities = entities or {}

    def table(self, kind):
        return self.entities.setdefault(kind, {})

    def get(self, kind, identifier):
        return self.table(kind).get(identifier)

    def put(self, kind, value):
        self.table(kind)[value["id"]] = value
        return value


class MemoryStore:
    """Tests only. The production factory never chooses this store."""

    def __init__(self):
        self.state = State()
        self.lock = RLock()

    @contextmanager
    def transaction(self):
        with self.lock:
            working = State(deepcopy(self.state.entities))
            yield working
            self.state = working


class PostgresStore:
    def __init__(self, dsn: str):
        self.dsn = dsn
        self.connection_options = {"prepare_threshold": None}
        certificate = conninfo_to_dict(dsn).get("sslrootcert")
        if sys.platform == "win32" and certificate and not certificate.isascii():
            # libpq uses the Windows narrow-character file API. A relative ASCII
            # path reaches the same CA file under a Unicode working directory.
            relative = os.path.relpath(certificate)
            if relative.isascii():
                self.connection_options["sslrootcert"] = relative

    @contextmanager
    def transaction(self):
        # Two-person MVP: serialize mutations and publication checks across API/worker.
        # The lock is held only around DB work, never during an external model call.
        with psycopg.connect(self.dsn, **self.connection_options) as connection:
            connection.execute("SELECT pg_advisory_xact_lock(2220914)")
            entities = {}
            for kind, identifier, body in connection.execute(
                "SELECT kind, id, body FROM private.app_entities"
            ):
                entities.setdefault(kind, {})[identifier] = body
            original = deepcopy(entities)
            state = State(entities)
            yield state
            for kind, rows in state.entities.items():
                for identifier, body in rows.items():
                    if original.get(kind, {}).get(identifier) != body:
                        connection.execute(
                            "INSERT INTO private.app_entities(kind,id,body) VALUES(%s,%s,%s) ON CONFLICT(kind,id) DO UPDATE SET body=EXCLUDED.body",
                            (kind, identifier, Jsonb(body)),
                        )
            for kind, rows in original.items():
                for identifier in rows.keys() - state.entities.get(kind, {}).keys():
                    connection.execute(
                        "DELETE FROM private.app_entities WHERE kind=%s AND id=%s",
                        (kind, identifier),
                    )
