/** Device-side ensemble. Every provider sees the same immutable recording. */
export const providers = [
  { id: "openai", label: "OpenAI", model: "gpt-transcribe", kind: "transcript" },
  { id: "openai-diarize", label: "OpenAI 話者付き", model: "gpt-4o-transcribe-diarize", kind: "transcript" },
  { id: "elevenlabs", label: "ElevenLabs", model: "scribe_v2", kind: "transcript" },
  { id: "gemini", label: "Gemini", model: "gemini-3.5-transcribe", kind: "transcript" },
  { id: "deepgram", label: "Deepgram", model: "nova-3", kind: "transcript" },
  { id: "assemblyai", label: "AssemblyAI", model: "universal-2", kind: "transcript" },
  { id: "speechmatics", label: "Speechmatics", model: "enhanced", kind: "transcript" },
  { id: "pyannote", label: "pyannote（話者）", model: "precision-2", kind: "speakers" },
] as const;
export type ProviderId = (typeof providers)[number]["id"];
export type Keys = Partial<Record<ProviderId, string>>;
export type Segment = { id: string; text: string; startMs: number | null; endMs: number | null; speaker: string | null };
export type AudioInput = {
  recordingId: string; checksum: string; durationMs: number; stoppedAt: string;
  audioExpiresAt: string; textExpiresAt: string; name: string; mimeType: string; blob: Blob;
};
export type Candidate = {
  id: string; provider: ProviderId; model: string; kind: "transcript" | "speakers";
  status: "queued" | "running" | "succeeded" | "empty" | "failed" | "unconfigured" | "cancelled" | "result_unknown";
  text: string; segments: Segment[]; elapsedMs: number; error: string | null;
  remoteJobId: string | null; raw: unknown;
};
export type Comparison = {
  model: string; createdAt: string; inputIds: string[]; summary: string;
  differences: { topic: string; candidateIds: string[]; quotes: { candidateId: string; text: string }[]; assessment: string }[];
};
export type EnsembleRun = {
  schema: "direct-asr-v1"; recordingId: string; checksum: string; stoppedAt: string;
  textExpiresAt: string; candidates: Candidate[]; comparison: Comparison | null;
  previousAttempts?: Candidate[]; previousComparisons?: Comparison[];
};
export type IO = {
  fetch: typeof fetch; signal: AbortSignal; now: () => number;
  sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  job: (id: string) => void | Promise<void>;
};
export class AsrError extends Error {
  constructor(public code: string) { super(code); }
}
export function keyFor(keys: Keys, id: ProviderId) {
  return (keys[id] || (id === "openai-diarize" ? keys.openai : "") || "").trim();
}
export function newRun(input: AudioInput, keys: Keys): EnsembleRun {
  return { schema: "direct-asr-v1", recordingId: input.recordingId, checksum: input.checksum,
    stoppedAt: input.stoppedAt, textExpiresAt: input.textExpiresAt, comparison: null,
    candidates: providers.map(p => ({ id: `${input.recordingId}:${p.id}`, provider: p.id, model: p.model,
      kind: p.kind, status: keyFor(keys, p.id) ? "queued" : "unconfigured", text: "", segments: [],
      elapsedMs: 0, error: null, remoteJobId: null, raw: null })) };
}
export function restoreRun(run: EnsembleRun, now = Date.now()): EnsembleRun | null {
  if (run.schema !== "direct-asr-v1" || !Number.isFinite(Date.parse(run.textExpiresAt)) || Date.parse(run.textExpiresAt) <= now) return null;
  return { ...run, candidates: run.candidates.map(c => c.status === "running" || c.status === "queued"
    ? { ...c, status: "result_unknown", error: "interrupted_no_auto_retry" } : c) };
}
export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new AsrError("cancelled")); return; }
    const abort = () => { clearTimeout(timer); reject(new AsrError("cancelled")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
export function assertAudio(input: AudioInput, now = Date.now()) {
  if (!input.recordingId || !input.checksum || !Number.isFinite(input.durationMs) || input.durationMs <= 0 || input.durationMs > 300000)
    throw new AsrError("invalid_recording");
  if (!Number.isFinite(Date.parse(input.audioExpiresAt)) || Date.parse(input.audioExpiresAt) <= now) throw new AsrError("audio_expired");
  if (!input.blob.size || input.blob.size > 25_000_000) throw new AsrError("audio_size_limit");
}
type Adapter = (id: ProviderId, input: AudioInput, key: string, io: IO) => Promise<Pick<Candidate, "text" | "segments" | "raw">>;
const active = new Set<string>();
export async function runEnsemble(input: AudioInput, keys: Keys, adapter: Adapter, options: {
  signal: AbortSignal; publish: (run: EnsembleRun) => Promise<void>;
  previous?: EnsembleRun;
  fetch?: typeof fetch; timeoutMs?: number; now?: () => number; sleep?: IO["sleep"];
}): Promise<EnsembleRun> {
  const now = options.now ?? Date.now;
  assertAudio(input, now());
  if (active.has(input.recordingId)) throw new AsrError("already_running");
  if (!providers.some(p => p.kind === "transcript" && keyFor(keys, p.id))) throw new AsrError("no_asr_keys");
  active.add(input.recordingId);
  const run = newRun(input, keys);
  if (options.previous) {
    const previous = options.previous;
    if (previous.recordingId !== input.recordingId || previous.checksum !== input.checksum) {
      active.delete(input.recordingId); throw new AsrError("invalid_recording");
    }
    run.previousAttempts = [...(previous.previousAttempts ?? [])];
    run.previousComparisons = [...(previous.previousComparisons ?? []), ...(previous.comparison ? [previous.comparison] : [])];
    run.candidates = run.candidates.map(next => {
      const old = previous.candidates.find(c => c.provider === next.provider);
      if (!old) return next;
      if (["succeeded", "empty"].includes(old.status)) return { ...old };
      if (next.status === "unconfigured") return { ...old };
      run.previousAttempts!.push({ ...old });
      return { ...next, id: `${next.id}:attempt-${run.previousAttempts!.filter(c => c.provider === next.provider).length + 1}` };
    });
  }
  // Serial durable snapshots prevent slower writes from restoring older state.
  let writes = Promise.resolve();
  const persist = () => {
    const snapshot = JSON.parse(JSON.stringify(run)) as EnsembleRun;
    writes = writes.then(() => options.publish(snapshot));
    return writes;
  };
  try {
    await persist();
    const settled = await Promise.allSettled(run.candidates.map(async c => {
      if (c.status !== "queued") return;
      const controller = new AbortController();
      const abort = () => controller.abort();
      options.signal.addEventListener("abort", abort, { once: true });
      if (options.signal.aborted) controller.abort();
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, options.timeoutMs ?? 180000);
      const started = now();
      const io: IO = { fetch: options.fetch ?? fetch, signal: controller.signal, now,
        sleep: options.sleep ?? sleep, job: async id => { c.remoteJobId = id; await persist(); } };
      try {
        if (controller.signal.aborted) throw new AsrError("cancelled");
        c.status = "running";
        await persist(); // Do not call a paid API if journaling failed.
        assertAudio(input, now());
        const output = await adapter(c.provider, input, keyFor(keys, c.provider), io);
        if (controller.signal.aborted) throw new AsrError("cancelled");
        assertAudio(input, now());
        Object.assign(c, output);
        c.segments = c.segments.map((s, i) => ({ ...s, id: `${c.id}:${i}` }));
        c.status = output.text.trim() || (c.kind === "speakers" && output.segments.length) ? "succeeded" : "empty";
      } catch (error) {
        c.status = timedOut ? "result_unknown" : options.signal.aborted ? "cancelled" : "failed";
        c.error = timedOut ? "timeout_no_auto_retry" : error instanceof AsrError ? error.code : "network_or_cors";
      } finally {
        clearTimeout(timer); options.signal.removeEventListener("abort", abort);
        c.elapsedMs = Math.max(0, now() - started);
        await persist();
      }
    }));
    const failedWrite = settled.find(result => result.status === "rejected");
    if (failedWrite?.status === "rejected") throw failedWrite.reason;
    await writes;
    return run;
  } finally { active.delete(input.recordingId); }
}

export function errorLabel(code: string | null) {
  const labels: Record<string, string> = {
    no_asr_keys: "書き起こしAPIキーを設定してください。", already_running: "この録音は処理中です。",
    invalid_recording: "録音は5分以内で保存してください。", audio_size_limit: "音声は25MB以下で送信してください。",
    audio_expired: "音声の保存期限が切れています。", invalid_response: "APIの応答を読み取れませんでした。",
    network_or_cors: "通信できませんでした。接続先・ブラウザの通信制限を確認してください。",
    timeout_no_auto_retry: "時間切れ・結果不明です。自動では再送しません。",
    interrupted_no_auto_retry: "アプリが中断され、結果を確認できませんでした。",
    cancelled: "端末側の待機を中止しました。送信済み処理が続く場合があります。",
    insufficient_candidates: "比較には成功した書き起こしが2件以上必要です。",
    invalid_comparison: "比較結果の根拠を確認できませんでした。", input_limit: "比較する本文が長すぎます。",
    text_expired: "文字の保存期限が切れています。", job_failed: "提供元で処理に失敗しました。",
    model_incomplete: "比較モデルの回答が完了しませんでした。",
  };
  if (code?.startsWith("http_")) return `提供元の応答: HTTP ${code.slice(5)}（認証・利用枠・入力形式を確認）`;
  return code ? labels[code] ?? "処理を完了できませんでした。" : "";
}
