"""Opt-in live DB/Storage check using disposable artificial bytes (no speech).

python check_supabase.py --run
Does not run in pytest, create users, call models, or print credentials.
"""

import json
import sys
import uuid
import psycopg
from app.adapters import SupabaseBlobs
from app.config import Settings
from app.store import PostgresStore


def main():
    if sys.argv[1:] != ["--run"]:
        raise RuntimeError(
            "Pass --run to verify the configured Supabase DB and Storage"
        )
    settings = Settings.from_env()
    if not settings.configured:
        raise RuntimeError("Backend is not configured")
    store = PostgresStore(settings.database_url)
    marker = "connection-check-" + uuid.uuid4().hex
    with psycopg.connect(store.dsn, **store.connection_options) as db:
        assert (
            db.execute("select current_user").fetchone()[0]
            == "conversation_mvp_backend"
        )
        assert not db.execute(
            "select has_table_privilege(current_user, c.oid, 'SELECT') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth' and c.relname='users'"
        ).fetchone()[0]
        assert not db.execute(
            "select has_schema_privilege('anon', 'private', 'USAGE')"
        ).fetchone()[0]
        assert not db.execute(
            "select has_schema_privilege('authenticated', 'private', 'USAGE')"
        ).fetchone()[0]
        assert db.execute(
            "select relrowsecurity from pg_class where oid='private.app_entities'::regclass"
        ).fetchone()[0]
        db.execute(
            "insert into private.app_entities(kind,id,body) values (%s,%s,%s::jsonb)",
            ("connection_check", marker, json.dumps({"id": marker})),
        )
        assert (
            db.execute(
                "select body->>'id' from private.app_entities where kind=%s and id=%s",
                ("connection_check", marker),
            ).fetchone()[0]
            == marker
        )
        db.rollback()
        assert (
            db.execute(
                "select count(*) from private.app_entities where id=%s", (marker,)
            ).fetchone()[0]
            == 0
        )
    blob = SupabaseBlobs(
        settings.supabase_url, settings.supabase_service_key, settings.storage_bucket
    )
    key = "connection-checks/" + marker + ".m4a"
    content = b"ARTIFICIAL STORAGE CHECK - NOT A RECORDING"
    try:
        blob.put(key, content)
        assert blob.get(key) == content
    finally:
        blob.delete(key)
    print(
        json.dumps(
            {
                "database": "write/read/rollback passed",
                "database_permissions": "private table only; client roles denied",
                "storage": "artificial bytes write/read/delete passed",
                "models_called": False,
            }
        )
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(
            json.dumps(
                {
                    "status": "failed",
                    "type": type(error).__name__,
                    "code": getattr(error, "code", None),
                }
            ),
            file=sys.stderr,
        )
        raise SystemExit(1) from None
