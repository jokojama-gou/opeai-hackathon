import { mkdirSync, writeFileSync } from "node:fs";
const root = new URL("./fixtures/", import.meta.url);
mkdirSync(root, { recursive: true });
const now = "2026-09-14T03:00:00.000Z";
const recording = (id, owner_id, audio = "2026-09-21T02:00:00.000Z") => ({
  id,
  owner_id,
  installation_id: `device-${owner_id}`,
  mode: "normal",
  duration_ms: 60000,
  stopped_at: "2026-09-14T02:00:00.000Z",
  capture_status: "saved",
  upload_status: "ready",
  audio_expires_at: audio,
  text_expires_at: "2026-10-14T02:00:00.000Z",
  version: 1,
});
const source = (id, recording_id, original_text, start_ms, end_ms) => ({
  id,
  recording_id,
  original_text,
  start_ms,
  end_ms,
  timing_quality: start_ms === null ? "unknown" : "estimated",
  speaker_label: null,
  version: 1,
});
const evidence = (s) => ({
  source_id: s.id,
  source_version: s.version,
  char_start: 0,
  char_end: [...s.original_text].length,
  start_ms: s.start_ms,
  end_ms: s.end_ms,
});
const item = (id, kind, sources, order_status = "aligned") => ({
  id,
  kind,
  evidence_refs: sources.map(evidence),
  uncertainty: kind === "conflict" ? ["原文に相違があります"] : [],
  order_status,
  speaker_label: null,
});
const conv = (id, script, status = "ready") => ({
  id,
  mode: "normal",
  revision: 1,
  access_revision: 1,
  status,
  script,
  highlights: [],
  confirmation_reason:
    status === "needs_confirmation" ? "alignment_unresolved" : null,
});
const scenario = (
  id,
  label,
  recordings,
  sources,
  conversation,
  kind = "shared",
  response_status = 200,
) => ({
  id,
  label,
  kind,
  response_status,
  recordings,
  sources,
  conversation,
  connection: null,
  expected: {
    script_count: conversation?.script.length ?? 0,
    source_count: sources.length,
    audio_available:
      response_status === 200 &&
      recordings.some((r) => r.audio_expires_at > now) &&
      sources.some((s) => s.start_ms !== null),
    next_screen:
      kind === "pending" || kind === "personal"
        ? "U03"
        : conversation?.status === "needs_confirmation"
          ? "U04"
          : "U06",
  },
});
function save(case_id, scenarios) {
  writeFileSync(
    new URL(`${case_id}.json`, root),
    JSON.stringify(
      {
        contract_version: "mvp-2.2-k01-v1",
        case_id,
        viewer_id: "person-a",
        now,
        scenarios,
      },
      null,
      2,
    ) + "\n",
  );
}
const a = recording("recording-a", "person-a");
const b = recording("recording-b", "person-b");
const a1 = source("a1", a.id, "展示のアイデアを話そう🌱", 1000, 5000);
const b1 = source("b1", b.id, "展示のアイデアを話そう🌱", 2000, 6000);
const a2 = source("a2", a.id, "写真を並べるのはどうかな。", 8000, 12000);
const a3 = source("a3", a.id, "いいね。", 18000, 20000);
const a4 = source("a4", a.id, "いいね。", 28000, 30000);
const duplicate = conv("conversation-duplicate", [
  item("utterance-1", "duplicate", [a1, b1]),
  item("utterance-2", "single", [a2]),
  item("utterance-3", "single", [a3]),
  item("utterance-4", "single", [a4]),
]);
duplicate.highlights = [
  {
    id: "highlight-1",
    section: "content",
    text: "写真を並べる案が出ました。",
    interpretation: false,
    utterance_ids: ["utterance-2"],
  },
];
save("duplicate", [
  scenario(
    "duplicate",
    "展示のアイデア",
    [a, b],
    [a1, b1, a2, a3, a4],
    duplicate,
  ),
]);
const c1 = source("c1", a.id, "展示は土曜にしよう。", 18000, 22000);
const c2 = source("c2", b.id, "展示は日曜にしよう。", 19000, 23000);
const c3 = source("c3", a.id, "会場はまだ決めていない。", 25000, 29000);
const c4 = source("c4", b.id, "入口に写真を置く案もある。", null, null);
save("conflict", [
  scenario(
    "conflict",
    "展示の日程と会場",
    [a, b],
    [c1, c2, c3, c4],
    conv("conversation-conflict", [
      item("conflict-1", "conflict", [c1, c2]),
      item("conflict-2", "single", [c3]),
      item("conflict-3", "single", [c4], "unknown"),
    ]),
  ),
]);
const pending = scenario(
  "pending",
  "相手の共有確認を待っています",
  [a],
  [a1],
  null,
  "pending",
);
pending.connection = {
  connection_id: "connection-pending",
  status: "pending",
  expires_at: "2026-09-15T02:00:00.000Z",
  peer_display: "相手（人工データ）",
  verification_code: "4729",
  match_id: "match-pending",
  match_version: 1,
  scope_id: "scope-pending",
  scope_version: 1,
  own_selection: [evidence(a1)],
  confirmation_states: { "person-a": "confirmed", "person-b": "confirmed" },
  share_states: { "person-a": "allowed", "person-b": "pending" },
  continuing_state: "inactive",
  conversation_id: null,
  job_id: null,
  next_actions: ["wait"],
};
save("pending", [
  pending,
  scenario(
    "needs-confirmation",
    "範囲の確認が必要です",
    [a],
    [],
    conv("conversation-confirmation", [], "needs_confirmation"),
  ),
]);
save("expired", [
  scenario(
    "audio-expired",
    "音声の保存期限が過ぎた会話",
    [recording(a.id, a.owner_id, "2026-09-13T02:00:00.000Z")],
    [a1],
    conv("conversation-audio-expired", [item("expired-1", "single", [a1])]),
  ),
  scenario(
    "text-expired",
    "文字の保存期限が過ぎました",
    [],
    [],
    null,
    "personal",
    410,
  ),
  scenario("revoked", "この共有は利用できません", [], [], null, "shared", 404),
]);
