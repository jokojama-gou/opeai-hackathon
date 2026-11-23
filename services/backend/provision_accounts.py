"""Create the two development accounts without email delivery or public signup.

Writes randomly generated passwords only to ignored local credentials. Never
changes existing users; inspect an interrupted run before running it again.
"""

import json
from pathlib import Path
import secrets
import sys
import httpx
from app.config import Settings


def main():
    if sys.argv[1:] != ["--apply"]:
        raise RuntimeError("Use --apply to create two development accounts")
    settings = Settings.from_env()
    if not settings.configured:
        raise RuntimeError("Configure the backend first")
    target = (
        Path(__file__).resolve().parents[2]
        / "credentials/development-accounts.local.json"
    )
    if target.exists():
        raise RuntimeError(
            "Local development account file already exists; inspect instead of overwriting"
        )
    accounts = [
        {
            "email": f"hackathon-{person}@example.invalid",
            "password": secrets.token_urlsafe(30),
        }
        for person in ("a", "b")
    ]
    with httpx.Client(
        base_url=settings.supabase_url,
        headers={
            "apikey": settings.supabase_service_key,
            "Authorization": "Bearer " + settings.supabase_service_key,
        },
        timeout=20,
        follow_redirects=False,
    ) as client:
        existing = client.get(
            "/auth/v1/admin/users", params={"page": 1, "per_page": 1000}
        )
        if existing.status_code != 200:
            raise RuntimeError(
                f"Account inspection failed (HTTP {existing.status_code})"
            )
        if existing.json().get("users"):
            raise RuntimeError(
                "Auth already has users; inspect them before creating development accounts"
            )
        target.parent.mkdir(exist_ok=True)
        with target.open("x", encoding="utf-8") as output:
            json.dump(
                {"supabase_url": settings.supabase_url, "accounts": accounts},
                output,
                ensure_ascii=False,
                indent=2,
            )
        for account in accounts:
            result = client.post(
                "/auth/v1/admin/users",
                json=account
                | {
                    "email_confirm": True,
                    "user_metadata": {"purpose": "hackathon-development"},
                },
            )
            if result.status_code not in (200, 201):
                raise RuntimeError(
                    f"Account creation incomplete (HTTP {result.status_code}); inspect saved credentials and remote users before retrying"
                )
            print(f"Created {account['email']} (password saved locally; no email sent)")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError, ValueError, httpx.HTTPError) as error:
        print(
            (
                str(error)
                if isinstance(error, RuntimeError)
                else f"Account setup stopped ({type(error).__name__}); details suppressed"
            ),
            file=sys.stderr,
        )
        raise SystemExit(1) from None
