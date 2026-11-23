// MVP_SPEC 2.2 §6/9.3. Generates the checked-in JSON contract.
import { writeFileSync } from "node:fs";
const str = { type: "string", minLength: 1 };
const integer = { type: "integer", minimum: 0 };
const version = { type: "integer", minimum: 1 };
const date = { type: "string", format: "date-time" };
const nullable = (schema) => ({ anyOf: [schema, { type: "null" }] });
const list = (items) => ({ type: "array", items });
const choice = (...values) => ({ type: "string", enum: values });
const ref = (name) => ({ $ref: `#/definitions/${name}` });
const obj = (properties) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
const definitions = {
  Recording: obj({
    id: str,
    owner_id: str,
    installation_id: str,
    mode: choice("normal", "group"),
    duration_ms: { ...integer, maximum: 300000 },
    stopped_at: date,
    capture_status: choice(
      "idle",
      "recording",
      "stopping",
      "saved",
      "interrupted",
      "save_failed",
    ),
    upload_status: choice(
      "local",
      "uploading",
      "uploaded",
      "transcribing",
      "ready",
      "failed",
      "empty",
    ),
    audio_expires_at: date,
    text_expires_at: date,
    version,
  }),
  Source: obj({
    id: str,
    recording_id: str,
    original_text: { type: "string" },
    start_ms: nullable(integer),
    end_ms: nullable(integer),
    timing_quality: choice("estimated", "unknown"),
    speaker_label: nullable(str),
    version,
  }),
  EvidenceRef: obj({
    source_id: str,
    source_version: version,
    char_start: integer,
    char_end: integer,
    start_ms: nullable(integer),
    end_ms: nullable(integer),
  }),
  ScriptItem: obj({
    id: str,
    kind: choice("duplicate", "single", "conflict"),
    evidence_refs: { ...list(ref("EvidenceRef")), minItems: 1 },
    uncertainty: list(str),
    order_status: choice("aligned", "unknown"),
    speaker_label: nullable(str),
  }),
  Highlight: obj({
    id: str,
    section: choice("content", "reasons", "decisions", "unresolved"),
    text: str,
    interpretation: { type: "boolean" },
    utterance_ids: { ...list(str), minItems: 1 },
  }),
  Conversation: obj({
    id: str,
    mode: choice("normal", "group"),
    revision: version,
    access_revision: version,
    status: choice(
      "queued",
      "processing",
      "ready",
      "needs_confirmation",
      "failed",
      "stale",
    ),
    script: list(ref("ScriptItem")),
    highlights: list(ref("Highlight")),
    confirmation_reason: nullable(
      choice("alignment_unresolved", "attribution_disputed", "scope_changed"),
    ),
  }),
  ConnectionSnapshot: obj({
    connection_id: str,
    status: str,
    expires_at: date,
    peer_display: nullable(str),
    verification_code: nullable(str),
    match_id: nullable(str),
    match_version: nullable(version),
    scope_id: nullable(str),
    scope_version: nullable(version),
    own_selection: list(ref("EvidenceRef")),
    confirmation_states: {
      type: "object",
      additionalProperties: choice("pending", "confirmed", "disputed"),
    },
    share_states: {
      type: "object",
      additionalProperties: choice(
        "pending",
        "allowed",
        "rejected",
        "expired",
        "revoked",
      ),
    },
    continuing_state: choice("inactive", "mutual_active", "revoked"),
    conversation_id: nullable(str),
    job_id: nullable(str),
    next_actions: list(str),
  }),
  Job: obj({
    id: str,
    status: choice(
      "queued",
      "processing",
      "ready",
      "failed",
      "stale",
      "needs_confirmation",
    ),
    stage: str,
    attempts: integer,
    error_code: nullable(str),
    retryable: { type: "boolean" },
    result_revision: nullable(version),
  }),
  ProcessingPolicy: obj({
    policy_version: str,
    destinations: obj({
      pc_audio_transfer: str,
      external_audio_transcription: nullable(str),
      external_text_generation: nullable(str),
    }),
    descriptions: obj({
      pc_audio_transfer: str,
      external_audio_transcription: str,
      external_text_generation: str,
    }),
    transcription_configured: { type: "boolean" },
    generation_configured: { type: "boolean" },
  }),
  Scenario: obj({
    id: str,
    label: str,
    kind: choice("personal", "shared", "pending"),
    response_status: { type: "integer", enum: [200, 404, 410] },
    recordings: list(ref("Recording")),
    sources: list(ref("Source")),
    conversation: nullable(ref("Conversation")),
    connection: nullable(ref("ConnectionSnapshot")),
    expected: obj({
      script_count: integer,
      source_count: integer,
      audio_available: { type: "boolean" },
      next_screen: choice("U03", "U04", "U06"),
    }),
  }),
};
export const schema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://hackathon.invalid/contracts/mvp-v1.schema.json",
  title: "MvpFixture",
  ...obj({
    contract_version: { const: "mvp-2.2-k01-v1" },
    case_id: choice("duplicate", "conflict", "pending", "expired"),
    viewer_id: str,
    now: date,
    scenarios: { ...list(ref("Scenario")), minItems: 1 },
  }),
  definitions,
};
if (process.argv[1]?.endsWith("schema.mjs"))
  writeFileSync(
    new URL("./mvp-v1.schema.json", import.meta.url),
    JSON.stringify(schema, null, 2) + "\n",
  );
