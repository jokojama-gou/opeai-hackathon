"""Strict input/output boundaries for personal context generation (MVP §15)."""

from typing import Literal
from datetime import date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from pydantic import Field, model_validator
from .models import Model, Mutation


class Due(Model):
    kind: Literal["date", "datetime"]
    value: str
    time_zone: str | None = None

    @model_validator(mode="after")
    def valid_due(self):
        if self.kind == "date":
            if (
                date.fromisoformat(self.value).isoformat() != self.value
                or self.time_zone
            ):
                raise ValueError("invalid date")
        else:
            try:
                zone = ZoneInfo(self.time_zone or "")
                instant = datetime.fromisoformat(self.value.replace("Z", "+00:00"))
                if instant.tzinfo is None:
                    raise ValueError("explicit offset required")
                local = instant.astimezone(zone)
                if (
                    local.replace(tzinfo=None) != instant.replace(tzinfo=None)
                    or local.utcoffset() != instant.utcoffset()
                ):
                    raise ValueError("offset does not match zone")
            except (ZoneInfoNotFoundError, KeyError) as error:
                raise ValueError("invalid zone") from error
        return self


class ContextEvidence(Model):
    context_id: str
    context_revision: int = Field(ge=1)
    source_id: str
    source_version: int = Field(ge=1)
    char_start: int = Field(ge=0)
    char_end: int = Field(gt=0)
    target_kind: Literal["source"]


class ActionOutput(Model):
    intent_key: str = Field(min_length=1, max_length=100, pattern=r"^[a-zA-Z0-9_-]+$")
    kind: Literal["task"]
    action: str = Field(min_length=1, max_length=200)
    assignee: Literal["unknown", "other"]
    evidence: list[ContextEvidence] = Field(min_length=1, max_length=20)


class ActionResult(Model):
    # The service detects >10 separately and rejects the ENTIRE result.
    candidates: list[ActionOutput]


class CitedText(Model):
    text: str = Field(min_length=1, max_length=400)
    evidence: list[ContextEvidence] = Field(min_length=1, max_length=20)


class SummaryResult(Model):
    contents: list[CitedText] = Field(max_length=3)
    reasons: list[CitedText] = Field(max_length=3)
    decisions: list[CitedText] = Field(max_length=3)
    unresolved: list[CitedText] = Field(max_length=3)


class DailyResult(Model):
    topics: list[CitedText] = Field(max_length=3)
    ideas: list[CitedText] = Field(max_length=3)
    promises: list[CitedText] = Field(max_length=3)
    questions: list[CitedText] = Field(max_length=3)


class RunCreate(Mutation):
    role: Literal["G1", "G2"]
    expected_manifest_hash: str


class GenerationConsent(Mutation):
    policy_version: str
    expected_manifest_hash: str
    destination: str | None
    external_text_generation: bool


class TimeZoneEdit(Mutation):
    review_time_zone: str = Field(min_length=1, max_length=80)


class DailyCreate(Mutation):
    date: str
    zone: str
    selected_context_ids: list[str] = Field(min_length=1, max_length=10)
    expected_manifest_hash: str


class CandidateEdit(Mutation):
    candidate_status: Literal["dismissed"]


class Adopt(Mutation):
    action: str = Field(min_length=1, max_length=200)
    due: Due | None
    as_own_task: bool


class TodoEdit(Mutation):
    action: str = Field(min_length=1, max_length=200)
    due: Due | None
    todo_status: Literal["open", "done"]


class Reconfirm(Adopt):
    candidate_id: str
    candidate_version: int = Field(ge=1)
