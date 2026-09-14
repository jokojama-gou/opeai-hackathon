from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Mutation(Model):
    request_key: str = Field(min_length=8, max_length=128)
    expected_version: int = Field(ge=0)


class RecordingCreate(Mutation):
    installation_id: str = Field(min_length=1, max_length=128)
    mode: Literal["normal"]
    duration_ms: int = Field(gt=0, le=300000)
    stopped_at: str
    capture_status: Literal["saved", "interrupted"]
    checksum: str = Field(pattern=r"^[a-f0-9]{64}$")
    size: int = Field(gt=0, le=26214400)


class Consent(Mutation):
    checksum: str
    policy_version: str
    destinations: dict[str, str | None]
    pc_audio_transfer: bool
    external_audio_transcription: bool
    external_text_generation: bool


class UploadTicket(Mutation):
    consent_id: str
    checksum: str


class Transcription(Mutation):
    consent_id: str


class Correction(Mutation):
    replacement: str = Field(min_length=1, max_length=1000)


class Login(Model):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)


class Refresh(Model):
    refresh_token: str = Field(min_length=1)


class ConnectionCreate(Mutation):
    recording_id: str


class ConnectionAccept(ConnectionCreate):
    code: str = Field(min_length=8, max_length=8, pattern=r"^[A-Za-z2-9]+$")


class EvidenceRef(Model):
    source_id: str
    source_version: int = Field(ge=1)
    char_start: int = Field(ge=0)
    char_end: int = Field(gt=0)
    start_ms: int | None
    end_ms: int | None


class Interval(Model):
    start_ms: int = Field(ge=0)
    end_ms: int = Field(gt=0)


class Participation(Model):
    self: Interval
    peer: Interval


class MatchConfirmation(Mutation):
    selection: list[EvidenceRef] = Field(min_length=1, max_length=1000)
    participation_ranges: Participation
    same_conversation: bool
    only_two_people: bool
    attribution_confirmed: bool
    participation_confirmed: bool


class ShareResponse(Mutation):
    decision: Literal["allowed", "rejected"]
    continuing_opt_in: bool


class SavedEdit(Mutation):
    tag: Literal["idea", "memory", "other"]
    private_note: str = Field(max_length=1000)


class SavedCreate(SavedEdit):
    target_kind: Literal["source"]
    target_id: str
    target_version: int = Field(ge=1)


class SavedDelete(Mutation):
    confirm_note_deletion: bool
