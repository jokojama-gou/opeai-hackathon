from dataclasses import dataclass, field
import os
from pathlib import Path
from urllib.parse import urlparse


@dataclass(frozen=True)
class Settings:
    database_url: str = ""
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_key: str = ""
    ticket_secret: str = ""
    storage_bucket: str = "recordings"
    policy_version: str = "mvp-2.2-v1"
    pc_destination: str = ""
    asr_destination: str | None = None
    generation_destination: str | None = None
    asr_retention: str = "送信先と保持条件が未設定です。音声は外部へ送信できません。"
    generation_retention: str = (
        "送信先と保持条件が未設定です。文字は外部へ送信できません。"
    )
    cors_origins: tuple[str, ...] = ()
    generation_options: dict[str, str] = field(default_factory=dict, repr=False)

    @property
    def configured(self):
        return bool(
            self.database_url
            and self.supabase_url
            and self.supabase_anon_key
            and self.supabase_service_key
            and self.pc_destination
            and len(self.ticket_secret) >= 32
        )

    @classmethod
    def from_env(cls):
        local_env = Path(__file__).resolve().parents[1] / ".env"
        allowed = {
            "DATABASE_URL",
            "SUPABASE_URL",
            "SUPABASE_ANON_KEY",
            "SUPABASE_SERVICE_ROLE_KEY",
            "UPLOAD_TICKET_SECRET",
            "PC_DESTINATION_ID",
            "CORS_ORIGINS",
        }
        generation_keys = {
            "GENERATION_" + suffix
            for suffix in (
                "ENABLED",
                "API_KEY",
                "MODEL",
                "DESTINATION_ID",
                "RETENTION_VERIFIED",
                "RETENTION_DESCRIPTION",
                "MAX_INPUT_CHARS",
                "MAX_OUTPUT_CHARS",
                "MAX_OUTPUT_TOKENS",
                "TIMEOUT_SECONDS",
                "BUDGET_ID",
                "BUDGET_MICRO_USD",
                "RESERVATION_MICRO_USD",
            )
        }
        allowed |= generation_keys
        if local_env.exists():
            for line in local_env.read_text(encoding="utf-8-sig").splitlines():
                if not line.strip() or line.lstrip().startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                if key.strip() in allowed:
                    os.environ.setdefault(key.strip(), value.strip().strip("\"'"))
        settings = cls(
            database_url=os.getenv("DATABASE_URL", ""),
            supabase_url=os.getenv("SUPABASE_URL", "").rstrip("/"),
            supabase_anon_key=os.getenv("SUPABASE_ANON_KEY", ""),
            supabase_service_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
            ticket_secret=os.getenv("UPLOAD_TICKET_SECRET", ""),
            pc_destination=os.getenv("PC_DESTINATION_ID", ""),
            generation_destination=os.getenv("GENERATION_DESTINATION_ID") or None,
            generation_retention=os.getenv("GENERATION_RETENTION_DESCRIPTION")
            or cls.generation_retention,
            generation_options={
                key: os.environ[key] for key in generation_keys if key in os.environ
            },
            cors_origins=tuple(filter(None, os.getenv("CORS_ORIGINS", "").split(","))),
        )
        if settings.supabase_url:
            parsed = urlparse(settings.supabase_url)
            if parsed.scheme != "https" and not (
                parsed.scheme == "http"
                and parsed.hostname in ("127.0.0.1", "localhost", "::1")
            ):
                raise ValueError("Supabase URL must use HTTPS outside loopback")
        return settings
