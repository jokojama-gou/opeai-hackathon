"""Public response schema shared with the TypeScript client (personal subset)."""

from typing import Literal
from pydantic import Field
from .models import Model
from .derived_models import ContextEvidence, Due, SummaryResult, DailyResult


class ContextSource(Model):
    id: str
    recording_id: str
    original_text: str
    start_ms: int | None
    end_ms: int | None
    timing_quality: Literal["unknown", "estimated"]
    speaker_label: str | None
    version: int


class PersonalContext(Model):
    id: str
    kind: Literal["personal"]
    context_revision: int
    recording_id: str
    canonical_start_at: str
    expires_at: str
    manifest_hash: str
    generation_allowed: bool
    status: Literal["ready", "needs_confirmation"]
    preparation_reason: str | None
    sources: list[ContextSource]
    latest_runs: dict[str, str] = Field(default_factory=dict)


class CandidateView(Model):
    id: str
    version: int
    intent_key: str
    evidence_group_ids: list[str]
    manifest_id: str
    expires_at: str
    action: str
    due: Due | None
    assignee: Literal["unknown", "other"]
    evidence: list[ContextEvidence]
    origins: dict[str, str]
    candidate_status: Literal["proposed", "needs_confirmation", "accepted"]
    source_state: Literal["available"]
    run_id: str
    duplicate_unresolved: bool
    previously_dismissed: bool = False
    todo_id: str | None = None


class TodoView(Model):
    id: str
    version: int
    source_state: Literal["available", "needs_review", "unavailable"]
    todo_status: Literal["open", "done"]
    candidate_id: str | None = None
    action: str | None = None
    due: Due | None = None
    evidence: list[ContextEvidence] | None = None
    expires_at: str | None = None


RunStatus = Literal[
    "queued", "running", "ready", "needs_confirmation", "failed", "stale"
]


class CandidateIds(Model):
    candidate_ids: list[str]


class RunView(Model):
    id: str
    role: Literal["G1", "G2", "G5"]
    status: RunStatus
    version: int
    error_code: str | None
    retryable: bool
    attempts: int
    retry_round: int
    result: SummaryResult | DailyResult | CandidateIds | None = None
    expires_at: str | None = None


class DailyView(Model):
    id: str
    version: int
    run_id: str
    status: RunStatus
    error_code: str | None
    retryable: bool
    sections: DailyResult | None = None
    expires_at: str | None = None


class UnpreparedRecord(Model):
    recording_id: str
    version: int
    status: str


class TodayView(Model):
    date: str
    review_time_zone: str
    selection_hash: str
    contexts: list[PersonalContext]
    unprepared: list[UnpreparedRecord]
    default_selected_context_ids: list[str]
    selection_required: bool
    daily_reviews: list[DailyView]
    todos: list[TodoView] = Field(max_length=3)
    generation_configured: bool


class ReviewPreferences(Model):
    version: int
    review_time_zone: str | None


class DerivedContracts(Model):
    context: PersonalContext
    candidate: CandidateView
    todo: TodoView
    run: RunView
    daily: DailyView
    today: TodayView
    preferences: ReviewPreferences
