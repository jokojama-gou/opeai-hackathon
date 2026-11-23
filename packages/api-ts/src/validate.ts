import Ajv from "ajv";
import addFormats from "ajv-formats";
import schema from "../../../contracts/mvp-v1.schema.json";
import type {
  MvpFixture,
  Scenario,
  Source,
  ScriptItem,
  EvidenceRef,
} from "./schema";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema(schema);
const structure = ajv.getSchema<MvpFixture>(schema.$id)!;
export function assertModel<T>(
  name: string,
  value: unknown,
): asserts value is T {
  const validator = ajv.getSchema(`${schema.$id}#/definitions/${name}`);
  if (!validator || !validator(value))
    throw new Error(`Invalid ${name} response`);
}
export function textRange(text: string, start: number, end: number): string {
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    start >= end ||
    end > Array.from(text).length
  )
    throw new Error("Invalid code point range");
  return Array.from(text).slice(start, end).join("");
}
export function resolveEvidence(ref: EvidenceRef, sources: Source[]): string {
  const source = sources.find((s) => s.id === ref.source_id);
  if (!source || source.version !== ref.source_version)
    throw new Error("Missing or stale source");
  if ((ref.start_ms === null) !== (ref.end_ms === null))
    throw new Error("Partial timing");
  if (
    ref.start_ms !== null &&
    ref.end_ms !== null &&
    (ref.start_ms < 0 ||
      ref.start_ms >= ref.end_ms ||
      source.start_ms === null ||
      source.end_ms === null ||
      ref.start_ms < source.start_ms ||
      ref.end_ms > source.end_ms)
  )
    throw new Error("Invalid evidence timing");
  return textRange(source.original_text, ref.char_start, ref.char_end);
}
export function scriptText(item: ScriptItem, sources: Source[]): string {
  const alternatives = item.evidence_refs.map((ref) =>
    resolveEvidence(ref, sources),
  );
  return item.kind === "conflict"
    ? [...new Set(alternatives)].join(" / ")
    : alternatives[0];
}
export function validateScenario(
  s: Scenario,
  viewer: string,
  now: string,
): void {
  if (
    s.response_status !== 200 &&
    (s.sources.length || s.conversation || s.recordings.length || s.connection)
  )
    throw new Error("Unavailable response contains protected data");
  if (new Set(s.sources.map((source) => source.id)).size !== s.sources.length)
    throw new Error("Duplicate source ID");
  for (const source of s.sources) {
    const recording = s.recordings.find((r) => r.id === source.recording_id);
    if (!recording || recording.text_expires_at <= now)
      throw new Error("Source recording unavailable");
    if ((source.start_ms === null) !== (source.end_ms === null))
      throw new Error("Partial source timing");
    if (
      source.start_ms !== null &&
      source.end_ms !== null &&
      (source.start_ms >= source.end_ms ||
        source.end_ms > recording.duration_ms)
    )
      throw new Error("Invalid source timing");
    if ((source.timing_quality === "unknown") !== (source.start_ms === null))
      throw new Error("Timing quality mismatch");
    if (s.kind !== "shared" && recording.owner_id !== viewer)
      throw new Error("Pending/personal response exposes peer source");
  }
  if (s.kind === "pending" && s.conversation)
    throw new Error("Pending share has conversation");
  if (s.connection) {
    if (
      s.connection.own_selection.some(
        (ref) => !s.sources.some((src) => src.id === ref.source_id),
      )
    )
      throw new Error("Selection is not owned");
    for (const ref of s.connection.own_selection)
      resolveEvidence(ref, s.sources);
    if (
      Object.values(s.connection.share_states).some(
        (state) => state !== "allowed",
      ) &&
      s.connection.conversation_id
    )
      throw new Error("Unconfirmed share has conversation");
  }
  const c = s.conversation;
  if (!c) return;
  if (c.status !== "ready" && (c.script.length || c.highlights.length))
    throw new Error("Unready conversation exposes body");
  if (c.status === "needs_confirmation" && c.confirmation_reason === null)
    throw new Error("Missing confirmation reason");
  if (new Set(c.script.map((item) => item.id)).size !== c.script.length)
    throw new Error("Duplicate utterance ID");
  for (const item of c.script) {
    item.evidence_refs.forEach((ref) => resolveEvidence(ref, s.sources));
    if (item.kind === "duplicate" && item.evidence_refs.length < 2)
      throw new Error("Duplicate needs two sources");
    if (
      item.kind === "conflict" &&
      new Set(item.evidence_refs.map((ref) => resolveEvidence(ref, s.sources)))
        .size < 2
    )
      throw new Error("Conflict needs alternatives");
  }
  for (const highlight of c.highlights)
    if (
      highlight.utterance_ids.some(
        (id) => !c.script.some((item) => item.id === id),
      )
    )
      throw new Error("Highlight has missing evidence");
}
export function validateFixture(input: unknown): MvpFixture {
  if (!structure(input))
    throw new Error(
      `Invalid fixture structure: ${ajv.errorsText(structure.errors)}`,
    );
  const fixture = input as MvpFixture;
  for (const scenario of fixture.scenarios)
    validateScenario(scenario, fixture.viewer_id, fixture.now);
  return fixture;
}
