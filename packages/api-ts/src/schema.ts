/* Generated from contracts/mvp-v1.schema.json. Do not edit by hand. */

export interface MvpFixture {
  contract_version: "mvp-2.2-k01-v1";
  case_id: "duplicate" | "conflict" | "pending" | "expired";
  viewer_id: string;
  now: string;
  /**
   * @minItems 1
   */
  scenarios: [Scenario, ...Scenario[]];
}
/**
 * This interface was referenced by `MvpFixture`'s JSON-Schema
 * via the `definition` "Scenario".
 */
export interface Scenario {
  id: string;
  label: string;
  kind: "personal" | "shared" | "pending";
  response_status: 200 | 404 | 410;
  recordings: Recording[];
  sources: Source[];
  conversation: Conversation | null;
  connection: ConnectionSnapshot | null;
  expected: {
    script_count: number;
    source_count: number;
    audio_available: boolean;
    next_screen: "U03" | "U04" | "U06";
  };
}
/**
 * This interface was referenced by `MvpFixture`'s JSON-Schema
 * via the `definition` "Recording".
 */
export interface Recording {
  id: string;
  owner_id: string;
  installation_id: string;
  mode: "normal" | "group";
  duration_ms: number;
  stopped_at: string;
  capture_status: "idle" | "recording" | "stopping" | "saved" | "interrupted" | "save_failed";
  upload_status: "local" | "uploading" | "uploaded" | "transcribing" | "ready" | "failed" | "empty";
  audio_expires_at: string;
  text_expires_at: string;
  version: number;
}
/**
 * This interface was referenced by `MvpFixture`'s JSON-Schema
 * via the `definition` "Source".
 */
export interface Source {
  id: string;
  recording_id: string;
  original_text: string;
  start_ms: number | null;
  end_ms: number | null;
  timing_quality: "estimated" | "unknown";
  speaker_label: string | null;
  version: number;
}
/**
 * This interface was referenced by `MvpFixture`'s JSON-Schema
 * via the `definition` "Conversation".
 */
export interface Conversation {
  id: string;
  mode: "normal" | "group";
  revision: number;
  access_revision: number;
  status: "queued" | "processing" | "ready" | "needs_confirmation" | "failed" | "stale";
  script: ScriptItem[];
  highlights: Highlight[];
  confirmation_reason: ("alignment_unresolved" | "attribution_disputed" | "scope_changed") | null;
}
/**
 * This interface was referenced by `MvpFixture`'s JSON-Schema
 * via the `definition` "ScriptItem".
 */
export interface ScriptItem {
  id: string;
  kind: "duplicate" | "single" | "conflict";
  /**
   * @minItems 1
   */
  evidence_refs: [EvidenceRef, ...EvidenceRef[]];
  uncertainty: string[];
  order_status: "aligned" | "unknown";
  speaker_label: string | null;
}
/**
 * This interface was referenced by `MvpFixture`'s JSON-Schema
 * via the `definition` "EvidenceRef".
 */
export interface EvidenceRef {
  source_id: string;
  source_version: number;
  char_start: number;
  char_end: number;
  start_ms: number | null;
  end_ms: number | null;
}
/**
 * This interface was referenced by `MvpFixture`'s JSON-Schema
 * via the `definition` "Highlight".
 */
export interface Highlight {
  id: string;
  section: "content" | "reasons" | "decisions" | "unresolved";
  text: string;
  interpretation: boolean;
  /**
   * @minItems 1
   */
  utterance_ids: [string, ...string[]];
}
/**
 * This interface was referenced by `MvpFixture`'s JSON-Schema
 * via the `definition` "ConnectionSnapshot".
 */
export interface ConnectionSnapshot {
  connection_id: string;
  status: string;
  expires_at: string;
  peer_display: string | null;
  verification_code: string | null;
  match_id: string | null;
  match_version: number | null;
  scope_id: string | null;
  scope_version: number | null;
  own_selection: EvidenceRef[];
  confirmation_states: {
    [k: string]: "pending" | "confirmed" | "disputed";
  };
  share_states: {
    [k: string]: "pending" | "allowed" | "rejected" | "expired" | "revoked";
  };
  continuing_state: "inactive" | "mutual_active" | "revoked";
  conversation_id: string | null;
  job_id: string | null;
  next_actions: string[];
}
/**
 * This interface was referenced by `MvpFixture`'s JSON-Schema
 * via the `definition` "Job".
 */
export interface Job {
  id: string;
  status: "queued" | "processing" | "ready" | "failed" | "stale" | "needs_confirmation";
  stage: string;
  attempts: number;
  error_code: string | null;
  retryable: boolean;
  result_revision: number | null;
}
/**
 * This interface was referenced by `MvpFixture`'s JSON-Schema
 * via the `definition` "ProcessingPolicy".
 */
export interface ProcessingPolicy {
  policy_version: string;
  destinations: {
    pc_audio_transfer: string;
    external_audio_transcription: string | null;
    external_text_generation: string | null;
  };
  descriptions: {
    pc_audio_transfer: string;
    external_audio_transcription: string;
    external_text_generation: string;
  };
  transcription_configured: boolean;
  generation_configured: boolean;
}
