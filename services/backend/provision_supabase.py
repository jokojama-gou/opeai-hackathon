"""Provision an empty, explicitly selected Supabase project. No secret output.

This is an operator command, never imported by the API or app. Existing project
objects and local configuration cause a stop instead of overwriting live data.
"""

import argparse
import json
import os
from pathlib import Path
import re
import secrets
import sys
from urllib.parse import quote
import httpx

ROOT = Path(__file__).resolve().parents[2]
BACKEND = Path(__file__).resolve().parent
ROLE = "conversation_mvp_backend"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if not re.fullmatch(r"[a-z]{20}", args.project):
        raise RuntimeError("Invalid project ref")
    token = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
    if not token:
        env_path = ROOT / ".env.supabase.local"
        for line in env_path.read_text(encoding="utf-8-sig").splitlines():
            if line.startswith("SUPABASE_ACCESS_TOKEN="):
                token = line.split("=", 1)[1].strip().strip("\"'")
    if not re.fullmatch(r"sbp_[A-Za-z0-9_-]+", token):
        raise RuntimeError("Missing or invalid management token")
    with httpx.Client(
        base_url="https://api.supabase.com",
        headers={"Authorization": "Bearer " + token},
        timeout=30,
        follow_redirects=False,
    ) as api:

        def request(method, path, body=None):
            result = api.request(
                method, "/v1/projects/" + args.project + path, json=body
            )
            if not result.is_success:
                raise RuntimeError(
                    f"Supabase operation failed (HTTP {result.status_code}); response suppressed"
                )
            return result.json()

        existing = request(
            "POST",
            "/database/query",
            {
                "query": "select to_regclass('private.app_entities') is not null as entities, "
                "exists(select 1 from storage.buckets where id='recordings') as bucket, "
                "exists(select 1 from pg_roles where rolname='conversation_mvp_backend') as role;",
                "read_only": True,
            },
        )[0]
        print(
            json.dumps(
                {"project": args.project, "existing": existing, "apply": args.apply}
            )
        )
        if not args.apply:
            return
        if any(existing.values()):
            raise RuntimeError(
                "Managed objects already exist; inspect them before provisioning"
            )
        env_file = BACKEND / ".env"
        if env_file.exists():
            raise RuntimeError(
                "Backend .env already exists; preserve and inspect it first"
            )
        poolers = request("GET", "/config/database/pooler")
        pooler = next(p for p in poolers if p["pool_mode"] == "transaction")
        hostname = pooler["db_host"]
        if not hostname.endswith(".pooler.supabase.com"):
            raise RuntimeError("Unexpected pooler host")
        keys = {
            item["name"]: item["api_key"]
            for item in request("GET", "/api-keys")
            if item.get("name") in ("anon", "service_role")
        }
        if not all(keys.get(name) for name in ("anon", "service_role")):
            raise RuntimeError("Expected existing Auth and Storage API keys")
        password = secrets.token_hex(32)
        dsn = (
            f"postgresql://{ROLE}.{args.project}:{password}@{hostname}:{int(pooler['db_port'])}/postgres"
            f"?sslmode=verify-full&sslrootcert={quote(str(ROOT / 'supabase/certs/prod-ca-2021.crt'), safe='')}&connect_timeout=10"
        )
        values = {
            "DATABASE_URL": dsn,
            "SUPABASE_URL": f"https://{args.project}.supabase.co",
            "SUPABASE_ANON_KEY": keys["anon"],
            "SUPABASE_SERVICE_ROLE_KEY": keys["service_role"],
            "UPLOAD_TICKET_SECRET": secrets.token_hex(32),
            "PC_DESTINATION_ID": "開発PC / Supabase " + args.project,
            "CORS_ORIGINS": "http://localhost:8081,http://localhost:8083",
            "GENERATION_ENABLED": "false",
        }
        # Save the new credential before the remote mutation so an uncertain
        # response cannot lose it. No overwrite and no automatic retry.
        with env_file.open("x", encoding="utf-8") as output:
            output.write(
                "# Provisioning configuration. Check DB state if provisioning is interrupted.\n"
            )
            output.write(
                "\n".join(f"{key}={value}" for key, value in values.items()) + "\n"
            )
        migrations = [
            ROOT / "supabase/migrations" / name
            for name in (
                "202609140001_mvp_storage.sql",
                "202609150001_backend_role.sql",
            )
        ]
        query = "begin;\n" + "\n".join(
            path.read_text(encoding="utf-8") for path in migrations
        )
        query += f"\nalter role {ROLE} login password '{password}';\ncommit;"
        request("POST", "/database/query", {"query": query})
        print(
            "Provisioned private entities, private recordings bucket and restricted backend role. Backend configuration saved; credentials suppressed."
        )


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError, ValueError, StopIteration, httpx.HTTPError) as error:
        # Exception text from network/JSON/OS libraries can carry private data.
        print(
            (
                str(error)
                if isinstance(error, RuntimeError)
                else f"Provisioning stopped ({type(error).__name__}); details suppressed"
            ),
            file=sys.stderr,
        )
        raise SystemExit(1) from None
