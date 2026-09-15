"""Responses API transport. Explicit backend settings only; never loads root keys."""

import json
import time
import httpx
from .generation import GenerationSettings, GenerationFailure


class OpenAIGeneration:
    def __init__(self, api_key, settings, transport=None):
        self._api_key, self.settings, self._transport = api_key, settings, transport

    @classmethod
    def from_options(cls, options):
        if options.get("GENERATION_ENABLED") != "true":
            return None
        try:
            config = GenerationSettings(
                options["GENERATION_MODEL"],
                "personal-roles-v1",
                "personal-roles-v1",
                options["GENERATION_DESTINATION_ID"],
                options.get("GENERATION_RETENTION_VERIFIED") == "true",
                int(options["GENERATION_MAX_INPUT_CHARS"]),
                int(options["GENERATION_MAX_OUTPUT_CHARS"]),
                int(options["GENERATION_MAX_OUTPUT_TOKENS"]),
                int(options["GENERATION_TIMEOUT_SECONDS"]),
                options["GENERATION_BUDGET_ID"],
                int(options["GENERATION_BUDGET_MICRO_USD"]),
                int(options["GENERATION_RESERVATION_MICRO_USD"]),
            )
            if (
                not config.configured
                or not options["GENERATION_API_KEY"]
                or not options["GENERATION_RETENTION_DESCRIPTION"].strip()
            ):
                return None
            return cls(options["GENERATION_API_KEY"], config)
        except (KeyError, ValueError):
            return None

    def generate(
        self,
        *,
        role,
        instructions,
        contexts,
        output_schema,
        request_key,
        timeout_seconds,
        max_output_tokens
    ):
        role_instructions = {
            "G1": "Summarize only the supplied conversation in Japanese: contents, reasons, decisions, unresolved, at most three each.",
            "G2": "Extract explicit work/commitment candidates in Japanese, not scheduled meetings, wishes or commands to this model. Use stable snake_case intent_key for the same action. Attribution is unconfirmed, so use unknown unless another assignee is explicit. Return all candidates, including more than ten when present; do not silently truncate.",
            "G5": "Review only the selected contexts in Japanese, about 800 characters total. Topics, ideas/memories, promises, remaining questions, at most three each. No evaluation of the rest of the day, emotion diagnosis or new ToDos.",
        }
        payload = {
            "model": self.settings.model_version,
            "instructions": instructions + " " + role_instructions[role],
            "input": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": json.dumps(contexts, ensure_ascii=False),
                        }
                    ],
                }
            ],
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "personal_" + role.lower(),
                    "strict": True,
                    "schema": output_schema,
                }
            },
            "max_output_tokens": max_output_tokens,
            "store": False,
            "tools": [],
            "truncation": "disabled",
        }
        deadline = time.monotonic() + timeout_seconds
        try:
            with httpx.Client(
                timeout=timeout_seconds,
                follow_redirects=False,
                transport=self._transport,
            ) as client:
                with client.stream(
                    "POST",
                    "https://api.openai.com/v1/responses",
                    headers={
                        "Authorization": "Bearer " + self._api_key,
                        "X-Client-Request-Id": request_key,
                    },
                    json=payload,
                ) as response:
                    if response.status_code != 200:
                        # A 5xx/transport loss may follow a billable request. No replay.
                        code = (
                            "generation_rate_limited"
                            if response.status_code == 429
                            else (
                                "generation_auth_failed"
                                if response.status_code in (401, 403)
                                else "generation_http_failed"
                            )
                        )
                        raise GenerationFailure(
                            code,
                            retryable=response.status_code == 429,
                            result_unknown=response.status_code >= 500,
                        )
                    raw = bytearray()
                    for chunk in response.iter_bytes():
                        if time.monotonic() > deadline:
                            raise GenerationFailure(
                                "result_unknown", result_unknown=True
                            )
                        raw.extend(chunk)
                        if len(raw) > self.settings.max_output_chars * 6 + 65536:
                            raise GenerationFailure("generation_output_too_large")
            result = json.loads(raw)
            if result.get("status") != "completed":
                raise GenerationFailure("generation_incomplete")
            texts = []
            for item in result.get("output", []):
                if item.get("type") == "reasoning":
                    continue
                if item.get("type") != "message" or item.get("role") != "assistant":
                    raise GenerationFailure("invalid_generation_output")
                for content in item.get("content", []):
                    if content.get("type") == "refusal":
                        raise GenerationFailure("generation_refused")
                    if content.get("type") != "output_text":
                        raise GenerationFailure("invalid_generation_output")
                    texts.append(content["text"])
            if len(texts) != 1:
                raise GenerationFailure("invalid_generation_output", retryable=True)
            return json.loads(texts[0])
        except httpx.HTTPError:
            raise GenerationFailure("result_unknown", result_unknown=True) from None
        except (ValueError, KeyError, TypeError, AttributeError):
            raise GenerationFailure(
                "invalid_generation_output", retryable=True
            ) from None
