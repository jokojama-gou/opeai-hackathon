from dataclasses import dataclass
from typing import Protocol
import json
import shutil
import subprocess
import tempfile
from pathlib import Path
import httpx
from .errors import DomainError


class Auth(Protocol):
    def actor(self, token: str) -> str: ...


class SupabaseAuth:
    def __init__(self, url, anon_key):
        self.url, self.key = url, anon_key

    def actor(self, token):
        try:
            response = httpx.get(
                self.url + "/auth/v1/user",
                headers={"apikey": self.key, "Authorization": "Bearer " + token},
                timeout=10,
            )
            if response.status_code != 200:
                raise DomainError("unauthenticated", 401)
            actor = response.json().get("id")
            if not isinstance(actor, str):
                raise DomainError("unauthenticated", 401)
            return actor
        except httpx.HTTPError:
            raise DomainError("authentication_unavailable", 503, True) from None

    def session(self, payload, refresh=False):
        grant = "refresh_token" if refresh else "password"
        try:
            response = httpx.post(
                self.url + "/auth/v1/token?grant_type=" + grant,
                headers={"apikey": self.key},
                json=payload,
                timeout=15,
            )
            if response.status_code != 200:
                raise DomainError("login_failed", 401)
            value = response.json()
            return {
                key: value[key]
                for key in ("access_token", "refresh_token", "expires_at")
            } | {
                "user_id": value["user"]["id"],
                "email": value["user"].get("email", ""),
            }
        except httpx.HTTPError:
            raise DomainError("authentication_unavailable", 503, True) from None


class BlobStore(Protocol):
    def put(self, key: str, value: bytes): ...
    def get(self, key: str) -> bytes: ...
    def delete(self, key: str): ...


class MemoryBlobs:
    """Explicit test dependency, never used by the production app."""

    def __init__(self):
        self.values = {}

    def put(self, key, value):
        self.values[key] = value

    def get(self, key):
        return self.values[key]

    def delete(self, key):
        self.values.pop(key, None)


class SupabaseBlobs:
    def __init__(self, url, key, bucket):
        self.url = url + "/storage/v1/object/" + bucket
        self.headers = {"Authorization": "Bearer " + key, "apikey": key}

    def put(self, key, value):
        self._request(
            "POST",
            key,
            content=value,
            headers={"Content-Type": "audio/mp4", "x-upsert": "true"},
        )

    def get(self, key):
        return self._request("GET", key).content

    def delete(self, key):
        self._request("DELETE", key)

    def _request(self, method, key, **kwargs):
        headers = self.headers | kwargs.pop("headers", {})
        try:
            response = httpx.request(
                method,
                self.url + "/" + key,
                headers=headers,
                timeout=30,
                follow_redirects=False,
                **kwargs
            )
            if response.status_code >= 400:
                raise DomainError("storage_unavailable", 503, True)
            return response
        except httpx.HTTPError:
            raise DomainError("storage_unavailable", 503, True) from None


class MediaProbe:
    def inspect(self, audio: bytes):
        executable = shutil.which("ffprobe")
        if not executable:
            raise DomainError("media_probe_not_configured", 503)
        with tempfile.TemporaryDirectory(prefix="hackathon-media-") as temp:
            path = Path(temp) / "input.m4a"
            path.write_bytes(audio)
            try:
                result = subprocess.run(
                    [
                        executable,
                        "-v",
                        "error",
                        "-show_streams",
                        "-show_format",
                        "-of",
                        "json",
                        str(path),
                    ],
                    capture_output=True,
                    timeout=15,
                    check=True,
                )
                metadata = json.loads(result.stdout)
                streams = metadata.get("streams", [])
                if (
                    len(streams) != 1
                    or streams[0].get("codec_name") != "aac"
                    or streams[0].get("channels") != 1
                ):
                    raise DomainError("invalid_audio", 422)
                duration = round(float(metadata["format"]["duration"]) * 1000)
                if (
                    not 0 < duration <= 300000
                    or int(streams[0].get("sample_rate", 0)) != 48000
                ):
                    raise DomainError("invalid_audio", 422)
                return duration
            except (subprocess.SubprocessError, ValueError, KeyError):
                raise DomainError("invalid_audio", 422) from None


@dataclass(frozen=True)
class AsrSettings:
    provider_id: str
    model_version: str
    config_version: str
    retention_verified: bool
    call_limit: int
    max_cost: float
    reserved_cost_per_call: float
    max_input_ms: int


class AsrAdapter(Protocol):
    settings: AsrSettings

    def transcribe(self, audio: bytes, request_key: str) -> list[dict]: ...


class AsrFailure(Exception):
    def __init__(self, code, retryable=False, result_unknown=False):
        self.code, self.retryable, self.result_unknown = code, retryable, result_unknown
