import test from "node:test";
import assert from "node:assert/strict";
import { AsrError, newRun, restoreRun, runEnsemble, type AudioInput, type EnsembleRun, type IO, type Keys, type ProviderId } from "./direct-asr";
import { normalize, transcribe } from "./asr-providers";
import { compareTranscripts, comparisonInput, validateComparison } from "./asr-comparison";

const now = Date.parse("2026-09-15T00:00:00Z");
const input = (): AudioInput => ({ recordingId: "synthetic-recording", checksum: "synthetic-checksum", durationMs: 2000,
  stoppedAt: new Date(now).toISOString(), audioExpiresAt: new Date(now + 7 * 86400000).toISOString(), textExpiresAt: new Date(now + 30 * 86400000).toISOString(),
  name: "synthetic.wav", mimeType: "audio/wav", blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/wav" }) });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function io(fetch: typeof globalThis.fetch): IO {
  return { fetch, signal: new AbortController().signal, now: () => now, sleep: async () => {}, job: () => {} };
}
const raw: Partial<Record<ProviderId, object>> = {
  openai: { text: "明日は土曜日です。" },
  "openai-diarize": { text: "明日は日曜日です。", segments: [{ text: "明日は日曜日です。", start: 0, end: 1.5, speaker: "A" }] },
  elevenlabs: { text: "明日は土曜日です。", words: [{ type: "word", text: "明日", start: 0.1, end: 0.3, speaker_id: "speaker_0" }] },
  deepgram: { results: { channels: [{ alternatives: [{ transcript: "明日は土曜日です。", words: [{ word: "明日", start: 0.1, end: 0.3, speaker: 0 }] }] }] } },
  assemblyai: { status: "completed", text: "明日は土曜日です。", utterances: [{ text: "明日", start: 100, end: 300, speaker: "A" }] },
  speechmatics: { results: [{ type: "word", start_time: 0.1, end_time: 0.3, alternatives: [{ content: "明日", speaker: "S1" }] }] },
  gemini: { status: "completed", outputs: [{ type: "text", text: "明日は土曜日です。" }] },
  pyannote: { diarization: [{ start: 0.1, end: 0.3, speaker: "SPEAKER_00" }] },
};
test("all provider formats preserve independent candidate text, units, speaker and raw evidence", () => {
  for (const id of Object.keys(raw) as ProviderId[]) {
    const value = normalize(id, raw[id]!, input());
    assert.equal(value.raw, raw[id]);
    assert.equal(value.segments[0].startMs, ["openai", "gemini"].includes(id) ? null : id === "openai-diarize" ? 0 : 100);
    assert.equal(value.segments[0].endMs, ["openai", "gemini"].includes(id) ? null : id === "openai-diarize" ? 1500 : 300);
    if (id === "pyannote") assert.equal(value.text, "");
  }
});
test("unknown timing is not copied from other models; raw malformed timing is retained for diagnosis", () => {
  const result = normalize("openai-diarize", { text: "架空", segments: [{ text: "架空", start: 1, end: 99, speaker: "A" }] }, input());
  assert.equal(result.segments[0].startMs, null);
  assert.equal(result.segments[0].endMs, null);
  assert.equal(normalize("openai", raw.openai!, input()).segments[0].speaker, null);
  assert.throws(() => normalize("openai", {}, input()), /invalid_response/);
});
test("ensemble preserves successes on a provider failure, excludes missing keys, uses same recording", async () => {
  const snapshots: EnsembleRun[] = []; const calls: ProviderId[] = [];
  const audio = input();
  const result = await runEnsemble(audio, { openai: "synthetic-key", elevenlabs: "synthetic-key" }, async (id, received) => {
    assert.equal(received.blob, audio.blob); calls.push(id);
    if (id === "elevenlabs") throw new AsrError("http_401");
    return normalize(id, raw[id]!, audio);
  }, { signal: new AbortController().signal, now: () => now, publish: async r => { snapshots.push(r); } });
  assert.deepEqual(calls.sort(), ["elevenlabs", "openai", "openai-diarize"]);
  assert.equal(result.candidates.find(c => c.provider === "elevenlabs")?.status, "failed");
  assert.equal(result.candidates.filter(c => c.status === "succeeded").length, 2);
  assert.equal(result.candidates.find(c => c.provider === "gemini")?.status, "unconfigured");
  assert.equal(snapshots[0].candidates[0].status, "queued");
  assert.equal(snapshots.at(-1)?.candidates[0].status, "succeeded");
});
test("duplicate starts are rejected; cancellation prevents late results being published", async () => {
  let started!: () => void; const ready = new Promise<void>(r => { started = r; });
  let release!: () => void; const gate = new Promise<void>(r => { release = r; });
  const controller = new AbortController(); const options = { signal: controller.signal, now: () => now, publish: async () => {} };
  const running = runEnsemble(input(), { elevenlabs: "synthetic-key" }, async () => { started(); await gate; return normalize("elevenlabs", raw.elevenlabs!, input()); }, options);
  await ready;
  await assert.rejects(runEnsemble(input(), { openai: "synthetic-key" }, transcribe, options), /already_running/);
  controller.abort(); release();
  const result = await running;
  assert.equal(result.candidates.find(c => c.provider === "elevenlabs")?.status, "cancelled");
  assert.equal(result.candidates.find(c => c.provider === "elevenlabs")?.text, "");
});
test("timeout and app restart do not resubmit paid jobs", async () => {
  let calls = 0;
  const result = await runEnsemble(input(), { elevenlabs: "synthetic-key" }, async (_id, _input, _key, io) => {
    calls++; await new Promise<void>(resolve => io.signal.addEventListener("abort", () => resolve(), { once: true }));
    return normalize("elevenlabs", raw.elevenlabs!, input());
  }, { signal: new AbortController().signal, timeoutMs: 5, now: () => now, publish: async () => {} });
  assert.equal(calls, 1); assert.equal(result.candidates[2].status, "result_unknown");
  const run = newRun(input(), { openai: "synthetic-key" }); run.candidates[0].status = "running";
  assert.equal(restoreRun(run, now)?.candidates[0].status, "result_unknown");
  assert.equal(restoreRun(run, now + 31 * 86400000), null);
});
test("expired/deleted inputs and durable-save failure stop calls", async () => {
  let calls = 0;
  const adapter = async () => { calls++; return { text: "", segments: [], raw: {} }; };
  const options = { signal: new AbortController().signal, now: () => now, publish: async () => {} };
  await assert.rejects(runEnsemble({ ...input(), audioExpiresAt: new Date(now).toISOString() }, { openai: "synthetic-key" }, adapter, options), /audio_expired/);
  await assert.rejects(runEnsemble(input(), { openai: "synthetic-key" }, adapter, { ...options, publish: async () => { throw new Error("storage failed"); } }), /storage failed/);
  assert.equal(calls, 0);
});
for (const id of ["openai", "openai-diarize", "elevenlabs"] as const) {
  test(`${id}: multipart contains the original file and fixed model`, async () => {
    const transport: typeof fetch = async (url, init) => {
      const body = init!.body as FormData;
      const file = body.get("file") as Blob;
      assert.deepEqual(new Uint8Array(await file.arrayBuffer()), new Uint8Array([1, 2, 3, 4]));
      assert.equal(body.get(id === "elevenlabs" ? "model_id" : "model"), id === "elevenlabs" ? "scribe_v2" : id === "openai" ? "gpt-transcribe" : "gpt-4o-transcribe-diarize");
      assert.equal(new Headers(init!.headers).has("Content-Type"), false);
      if (id === "openai-diarize") assert.equal(body.get("chunking_strategy"), "auto");
      assert.match(String(url), /^https:\/\/(api.openai.com|api.elevenlabs.io)\//);
      return response(raw[id]);
    };
    assert.ok((await transcribe(id, input(), "synthetic-key", io(transport))).text);
  });
}
test("Deepgram sends binary to Japanese Nova-3 with scoped Authorization", async () => {
  await transcribe("deepgram", input(), "synthetic-key", io(async (url, init) => {
    assert.match(String(url), /language=ja/); assert.match(String(url), /diarize_model=v2/);
    assert.equal(new Headers(init!.headers).get("Authorization"), "Token synthetic-key");
    assert.ok(init?.body instanceof Blob); return response(raw.deepgram);
  }));
});
test("Gemini uploads a file, reads model_output steps, cleans up, and keeps unknown timing", async () => {
  const calls: string[] = [];
  const result = await transcribe("gemini", input(), "synthetic-key", io(async (_url, init) => {
    calls.push(`${init?.method} ${_url}`);
    if (String(_url).includes("/upload/")) return new Response("", { headers: { "x-goog-upload-url": "https://generativelanguage.googleapis.com/upload-session" } });
    if (String(_url).endsWith("/upload-session")) {
      assert.ok(init?.body instanceof Blob);
      return response({ file: { name: "files/synthetic", uri: "https://generativelanguage.googleapis.com/v1beta/files/synthetic", state: "ACTIVE" } });
    }
    if (init?.method === "DELETE") return response({});
    const body = JSON.parse(String(init!.body));
    assert.equal(body.input[0].uri, "https://generativelanguage.googleapis.com/v1beta/files/synthetic"); assert.equal(body.store, false);
    assert.equal(body.generation_config.transcription_config.mode.type, "verbatim");
    return response({ status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text: "明日" }] }] });
  }));
  assert.equal(result.text, "明日"); assert.equal(calls.length, 4);
  assert.match(calls.at(-1)!, /^DELETE/);
  assert.equal(result.segments[0].startMs, null);
});
test("Gemini completed no-speech response may omit outputs (live artificial-tone regression)", () => {
  assert.equal(normalize("gemini", { status: "completed", usage: { total_output_tokens: 0 } }, input()).text, "");
  assert.throws(() => normalize("gemini", { status: "failed" }, input()), /model_incomplete/);
});
test("AssemblyAI uploads, submits once, and polls without reuploading", async () => {
  const calls: string[] = []; let polls = 0;
  const result = await transcribe("assemblyai", input(), "synthetic-key", io(async (url, init) => {
    calls.push(`${init?.method ?? "GET"} ${url}`);
    if (String(url).endsWith("/upload")) return response({ upload_url: "https://cdn.assemblyai.com/artificial" });
    if (init?.method === "POST") { assert.deepEqual(JSON.parse(String(init.body)).speech_models, ["universal-2"]); return response({ id: "synthetic-job" }); }
    return response(++polls === 1 ? { status: "processing" } : raw.assemblyai);
  }));
  assert.equal(calls.length, 4); assert.equal(result.segments[0].endMs, 300);
});
test("Speechmatics uses EU1 multipart job and json-v2 result", async () => {
  const result = await transcribe("speechmatics", input(), "synthetic-key", io(async (url, init) => {
    assert.match(String(url), /^https:\/\/eu1.asr.api.speechmatics.com\/v2\/jobs/);
    if (init?.method === "POST") { assert.equal(JSON.parse(String((init.body as FormData).get("config"))).transcription_config.language, "ja"); return response({ id: "synthetic-job" }); }
    return response(String(url).includes("transcript?") ? raw.speechmatics : { job: { status: "done" } });
  }));
  assert.equal(result.text, "明日");
});
test("pyannote never sends bearer credentials to presigned storage and returns speakers separately", async () => {
  const jobs: string[] = []; const client = io(async (url, init) => {
    if (String(url).endsWith("media/input")) return response({ url: "https://artificial-storage.invalid/input" });
    if (String(url).startsWith("https://artificial-storage.invalid")) { assert.equal(new Headers(init!.headers).has("Authorization"), false); return response({}); }
    if (String(url).endsWith("diarize")) return response({ jobId: "synthetic-job" });
    return response({ status: "succeeded", output: raw.pyannote });
  }); client.job = id => { jobs.push(id); };
  const result = await transcribe("pyannote", input(), "synthetic-key", client);
  assert.equal(result.text, ""); assert.equal(result.segments[0].speaker, "SPEAKER_00"); assert.deepEqual(jobs, ["synthetic-job"]);
});
function completed() {
  const run = newRun(input(), { openai: "synthetic-key" });
  for (const c of run.candidates.slice(0, 2)) Object.assign(c, normalize(c.provider, raw[c.provider]!, input()), { status: "succeeded" });
  return run;
}
function compared(run: EnsembleRun) {
  return { summary: "曜日が異なります。原音の確認が必要です。", differences: [{ topic: "曜日", candidateIds: run.candidates.slice(0, 2).map(c => c.id), assessment: "文字だけでは決められません。",
    quotes: run.candidates.slice(0, 2).map(c => ({ candidateId: c.id, text: c.text })) }] };
}
test("comparison validates exact quotations and candidate IDs without replacing ASR outputs", () => {
  const run = completed(), before = JSON.stringify(run);
  const result = validateComparison(compared(run), run, "synthetic-model", now);
  assert.equal(result.differences.length, 1); assert.equal(JSON.stringify(run), before);
  const invented = compared(run); invented.differences[0].quotes[0].text = "月曜日です。";
  assert.throws(() => validateComparison(invented, run, "synthetic-model", now), /invalid_comparison/);
  invented.differences[0].candidateIds[0] = "other-recording";
  assert.throws(() => validateComparison(invented, run, "synthetic-model", now), /invalid_comparison/);
  assert.throws(() => comparisonInput(run, now + 31 * 86400000), /text_expired/);
  run.candidates[1].status = "failed";
  assert.throws(() => comparisonInput(run, now), /insufficient_candidates/);
});
test("comparison is a separate Responses call with store:false, exact source enum, no audio/keys/raw", async () => {
  const run = completed(); run.candidates[0].raw = { sensitive: "not-for-comparison" };
  const result = await compareTranscripts(run, "synthetic-key", "gpt-5-mini", io(async (url, init) => {
    assert.equal(String(url), "https://api.openai.com/v1/responses");
    const body = JSON.parse(String(init!.body)); assert.equal(body.store, false);
    assert.equal(body.model, "gpt-5-mini"); assert.equal(body.text.format.strict, true);
    assert.equal(String(init!.body).includes("not-for-comparison"), false);
    assert.equal(String(init!.body).includes("synthetic-key"), false);
    const source = JSON.parse(body.input[1].content);
    const output = { summary: "曜日が異なります。", differences: [{ topic: "曜日", assessment: "原音確認が必要です。", evidenceIds: source.excerpts.map((e: { id: string }) => e.id) }] };
    return response({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(output) }] }] });
  }));
  assert.equal(result.model, "gpt-5-mini");
});
test("manual retry only resends unfinished providers and preserves previous evidence", async () => {
  const prior = completed(); prior.candidates[2].status = "failed";
  const calls: ProviderId[] = [];
  const next = await runEnsemble(input(), { openai: "synthetic-key", elevenlabs: "synthetic-key" }, async (id) => {
    calls.push(id); return normalize(id, raw[id]!, input());
  }, { signal: new AbortController().signal, now: () => now, previous: prior, publish: async () => {} });
  assert.deepEqual(calls, ["elevenlabs"]);
  assert.equal(next.candidates[0].text, prior.candidates[0].text);
  assert.equal(next.previousAttempts?.[0].status, "failed");
  assert.match(next.candidates[2].id, /attempt-2$/);
});
