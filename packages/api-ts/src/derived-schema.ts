/* Generated from contracts/derived-v1.schema.json. Do not edit by hand. */

export type Id = string;
export type Kind = "personal";
export type ContextRevision = number;
export type RecordingId = string;
export type CanonicalStartAt = string;
export type ExpiresAt = string;
export type ManifestHash = string;
export type GenerationAllowed = boolean;
export type Status = "ready" | "needs_confirmation";
export type PreparationReason = string | null;
export type Id1 = string;
export type RecordingId1 = string;
export type OriginalText = string;
export type StartMs = number | null;
export type EndMs = number | null;
export type TimingQuality = "unknown" | "estimated";
export type SpeakerLabel = string | null;
export type Version = number;
export type Sources = ContextSource[];
export type Id2 = string;
export type Version1 = number;
export type IntentKey = string;
export type EvidenceGroupIds = string[];
export type ManifestId = string;
export type ExpiresAt1 = string;
export type Action = string;
export type Kind1 = "date" | "datetime";
export type Value = string;
export type TimeZone = string | null;
export type Assignee = "unknown" | "other";
export type ContextId = string;
export type ContextRevision1 = number;
export type SourceId = string;
export type SourceVersion = number;
export type CharStart = number;
export type CharEnd = number;
export type TargetKind = "source";
export type Evidence = ContextEvidence[];
export type CandidateStatus = "proposed" | "needs_confirmation" | "accepted";
export type SourceState = "available";
export type RunId = string;
export type DuplicateUnresolved = boolean;
export type PreviouslyDismissed = boolean;
export type TodoId = string | null;
export type Id3 = string;
export type Version2 = number;
export type SourceState1 = "available" | "needs_review" | "unavailable";
export type TodoStatus = "open" | "done";
export type CandidateId = string | null;
export type Action1 = string | null;
export type Evidence1 = ContextEvidence[] | null;
export type ExpiresAt2 = string | null;
export type Id4 = string;
export type Role = "G1" | "G2" | "G5";
export type Status1 = "queued" | "running" | "ready" | "needs_confirmation" | "failed" | "stale";
export type Version3 = number;
export type ErrorCode = string | null;
export type Retryable = boolean;
export type Attempts = number;
export type RetryRound = number;
export type Result = SummaryResult | DailyResult | CandidateIds | null;
/**
 * @maxItems 3
 */
export type Contents = [] | [CitedText] | [CitedText, CitedText] | [CitedText, CitedText, CitedText];
export type Text = string;
/**
 * @minItems 1
 * @maxItems 20
 */
export type Evidence2 =
  | [ContextEvidence]
  | [ContextEvidence, ContextEvidence]
  | [ContextEvidence, ContextEvidence, ContextEvidence]
  | [ContextEvidence, ContextEvidence, ContextEvidence, ContextEvidence]
  | [ContextEvidence, ContextEvidence, ContextEvidence, ContextEvidence, ContextEvidence]
  | [ContextEvidence, ContextEvidence, ContextEvidence, ContextEvidence, ContextEvidence, ContextEvidence]
  | [
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence
    ]
  | [
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence
    ]
  | [
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence
    ]
  | [
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence
    ]
  | [
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence
    ]
  | [
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence
    ]
  | [
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence
    ]
  | [
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence
    ]
  | [
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence
    ]
  | [
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence
    ]
  | [
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence
    ]
  | [
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence
    ]
  | [
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence
    ]
  | [
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence,
      ContextEvidence
    ];
/**
 * @maxItems 3
 */
export type Reasons = [] | [CitedText] | [CitedText, CitedText] | [CitedText, CitedText, CitedText];
/**
 * @maxItems 3
 */
export type Decisions = [] | [CitedText] | [CitedText, CitedText] | [CitedText, CitedText, CitedText];
/**
 * @maxItems 3
 */
export type Unresolved = [] | [CitedText] | [CitedText, CitedText] | [CitedText, CitedText, CitedText];
/**
 * @maxItems 3
 */
export type Topics = [] | [CitedText] | [CitedText, CitedText] | [CitedText, CitedText, CitedText];
/**
 * @maxItems 3
 */
export type Ideas = [] | [CitedText] | [CitedText, CitedText] | [CitedText, CitedText, CitedText];
/**
 * @maxItems 3
 */
export type Promises = [] | [CitedText] | [CitedText, CitedText] | [CitedText, CitedText, CitedText];
/**
 * @maxItems 3
 */
export type Questions = [] | [CitedText] | [CitedText, CitedText] | [CitedText, CitedText, CitedText];
export type CandidateIds1 = string[];
export type ExpiresAt3 = string | null;
export type Id5 = string;
export type Version4 = number;
export type RunId1 = string;
export type Status2 = "queued" | "running" | "ready" | "needs_confirmation" | "failed" | "stale";
export type ErrorCode1 = string | null;
export type Retryable1 = boolean;
export type ExpiresAt4 = string | null;
export type Date = string;
export type ReviewTimeZone = string;
export type SelectionHash = string;
export type Contexts = PersonalContext[];
export type RecordingId2 = string;
export type Version5 = number;
export type Status3 = string;
export type Unprepared = UnpreparedRecord[];
export type DefaultSelectedContextIds = string[];
export type SelectionRequired = boolean;
export type DailyReviews = DailyView[];
/**
 * @maxItems 3
 */
export type Todos = [] | [TodoView] | [TodoView, TodoView] | [TodoView, TodoView, TodoView];
export type GenerationConfigured = boolean;
export type Version6 = number;
export type ReviewTimeZone1 = string | null;

export interface DerivedContracts {
  context: PersonalContext;
  candidate: CandidateView;
  todo: TodoView;
  run: RunView;
  daily: DailyView;
  today: TodayView;
  preferences: ReviewPreferences;
}
/**
 * This interface was referenced by `DerivedContracts`'s JSON-Schema
 * via the `definition` "PersonalContext".
 */
export interface PersonalContext {
  id: Id;
  kind: Kind;
  context_revision: ContextRevision;
  recording_id: RecordingId;
  canonical_start_at: CanonicalStartAt;
  expires_at: ExpiresAt;
  manifest_hash: ManifestHash;
  generation_allowed: GenerationAllowed;
  status: Status;
  preparation_reason: PreparationReason;
  sources: Sources;
  latest_runs?: LatestRuns;
}
/**
 * This interface was referenced by `DerivedContracts`'s JSON-Schema
 * via the `definition` "ContextSource".
 */
export interface ContextSource {
  id: Id1;
  recording_id: RecordingId1;
  original_text: OriginalText;
  start_ms: StartMs;
  end_ms: EndMs;
  timing_quality: TimingQuality;
  speaker_label: SpeakerLabel;
  version: Version;
}
export interface LatestRuns {
  [k: string]: string;
}
/**
 * This interface was referenced by `DerivedContracts`'s JSON-Schema
 * via the `definition` "CandidateView".
 */
export interface CandidateView {
  id: Id2;
  version: Version1;
  intent_key: IntentKey;
  evidence_group_ids: EvidenceGroupIds;
  manifest_id: ManifestId;
  expires_at: ExpiresAt1;
  action: Action;
  due: Due | null;
  assignee: Assignee;
  evidence: Evidence;
  origins: Origins;
  candidate_status: CandidateStatus;
  source_state: SourceState;
  run_id: RunId;
  duplicate_unresolved: DuplicateUnresolved;
  previously_dismissed?: PreviouslyDismissed;
  todo_id?: TodoId;
}
/**
 * This interface was referenced by `DerivedContracts`'s JSON-Schema
 * via the `definition` "Due".
 */
export interface Due {
  kind: Kind1;
  value: Value;
  time_zone?: TimeZone;
}
/**
 * This interface was referenced by `DerivedContracts`'s JSON-Schema
 * via the `definition` "ContextEvidence".
 */
export interface ContextEvidence {
  context_id: ContextId;
  context_revision: ContextRevision1;
  source_id: SourceId;
  source_version: SourceVersion;
  char_start: CharStart;
  char_end: CharEnd;
  target_kind: TargetKind;
}
export interface Origins {
  [k: string]: string;
}
/**
 * This interface was referenced by `DerivedContracts`'s JSON-Schema
 * via the `definition` "TodoView".
 */
export interface TodoView {
  id: Id3;
  version: Version2;
  source_state: SourceState1;
  todo_status: TodoStatus;
  candidate_id?: CandidateId;
  action?: Action1;
  due?: Due | null;
  evidence?: Evidence1;
  expires_at?: ExpiresAt2;
}
/**
 * This interface was referenced by `DerivedContracts`'s JSON-Schema
 * via the `definition` "RunView".
 */
export interface RunView {
  id: Id4;
  role: Role;
  status: Status1;
  version: Version3;
  error_code: ErrorCode;
  retryable: Retryable;
  attempts: Attempts;
  retry_round: RetryRound;
  result?: Result;
  expires_at?: ExpiresAt3;
}
/**
 * This interface was referenced by `DerivedContracts`'s JSON-Schema
 * via the `definition` "SummaryResult".
 */
export interface SummaryResult {
  contents: Contents;
  reasons: Reasons;
  decisions: Decisions;
  unresolved: Unresolved;
}
/**
 * This interface was referenced by `DerivedContracts`'s JSON-Schema
 * via the `definition` "CitedText".
 */
export interface CitedText {
  text: Text;
  evidence: Evidence2;
}
/**
 * This interface was referenced by `DerivedContracts`'s JSON-Schema
 * via the `definition` "DailyResult".
 */
export interface DailyResult {
  topics: Topics;
  ideas: Ideas;
  promises: Promises;
  questions: Questions;
}
/**
 * This interface was referenced by `DerivedContracts`'s JSON-Schema
 * via the `definition` "CandidateIds".
 */
export interface CandidateIds {
  candidate_ids: CandidateIds1;
}
/**
 * This interface was referenced by `DerivedContracts`'s JSON-Schema
 * via the `definition` "DailyView".
 */
export interface DailyView {
  id: Id5;
  version: Version4;
  run_id: RunId1;
  status: Status2;
  error_code: ErrorCode1;
  retryable: Retryable1;
  sections?: DailyResult | null;
  expires_at?: ExpiresAt4;
}
/**
 * This interface was referenced by `DerivedContracts`'s JSON-Schema
 * via the `definition` "TodayView".
 */
export interface TodayView {
  date: Date;
  review_time_zone: ReviewTimeZone;
  selection_hash: SelectionHash;
  contexts: Contexts;
  unprepared: Unprepared;
  default_selected_context_ids: DefaultSelectedContextIds;
  selection_required: SelectionRequired;
  daily_reviews: DailyReviews;
  todos: Todos;
  generation_configured: GenerationConfigured;
}
/**
 * This interface was referenced by `DerivedContracts`'s JSON-Schema
 * via the `definition` "UnpreparedRecord".
 */
export interface UnpreparedRecord {
  recording_id: RecordingId2;
  version: Version5;
  status: Status3;
}
/**
 * This interface was referenced by `DerivedContracts`'s JSON-Schema
 * via the `definition` "ReviewPreferences".
 */
export interface ReviewPreferences {
  version: Version6;
  review_time_zone: ReviewTimeZone1;
}
