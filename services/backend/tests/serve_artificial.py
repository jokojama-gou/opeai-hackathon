"""Explicit loopback-only UI check. Not imported by production app/worker.

Run from services/backend: python tests/serve_artificial.py --artificial-only
Login: demo@example.invalid / artificial-only. All data is discarded on exit.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dataclasses import replace
from datetime import datetime, timezone
from threading import Event, Thread
import uvicorn
from fastapi.testclient import TestClient
from app.main import create_app
from app.reviews import ReviewService
from app.store import MemoryStore
from app.adapters import MemoryBlobs
from app.config import Settings
from app.errors import DomainError
from app.generation import run_generation_once
from test_personal_flow import TestAuth, TestAsr, TestProbe, NOW, ready
from test_derived import ArtificialGenerator, permit, start


class ArtificialAuth(TestAuth):
    def session(self, payload, refresh=False):
        if not refresh and (
            payload.get("email") != "demo@example.invalid"
            or payload.get("password") != "artificial-only"
        ):
            raise DomainError("login_failed", 401)
        return {
            "access_token": "token-a",
            "refresh_token": "artificial-refresh",
            "expires_at": datetime.now(timezone.utc).timestamp() + 3600,
            "user_id": "person-a",
            "email": "人工データ検証 / demo@example.invalid",
        }


if __name__ == "__main__":
    if sys.argv[1:] != ["--artificial-only"]:
        raise SystemExit(
            "This test server requires --artificial-only. No real data or external services."
        )
    settings = Settings(
        ticket_secret="artificial-only-" * 4,
        pc_destination="人工データ検証サーバー",
        asr_destination="artificial-asr",
        asr_retention="人工応答のみ・外部送信なし",
        generation_destination="artificial-generation",
        generation_retention="人工応答のみ・外部送信なし",
        cors_origins=("http://localhost:8082",),
    )
    clock = [NOW]
    asr = TestAsr()
    service = ReviewService(
        MemoryStore(),
        MemoryBlobs(),
        settings,
        TestProbe(),
        asr,
        lambda: clock[0],
        generation=ArtificialGenerator(),
    )
    app = create_app(service, ArtificialAuth(), settings)
    client = TestClient(app)
    client.headers["Authorization"] = "Bearer token-a"
    rid, _, _ = ready((service, client, asr, clock))
    permit(client, rid)
    context = client.get("/v1/contexts").json()[0]
    start(client, context)
    run_generation_once(service)
    stop = Event()

    def worker():
        while not stop.wait(0.25):
            run_generation_once(service)

    thread = Thread(target=worker, daemon=True)
    thread.start()
    print("ARTIFICIAL ONLY / loopback 8001 / no external services / volatile data")
    try:
        uvicorn.run(app, host="127.0.0.1", port=8001, access_log=False)
    finally:
        stop.set()
