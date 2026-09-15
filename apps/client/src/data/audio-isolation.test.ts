import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { AsrError, runEnsemble, type AudioInput, type EnsembleRun } from "./direct-asr";
import { isolateAudio, prepareDenoisedAudio, type IsolationState, type IsolationStore, type IsolationOptions } from "./audio-isolation";

const now = Date.parse("2026-09-15T01:00:00Z");
const bytes = new Uint8Array([82, 73, 70, 70, 48, 0, 0, 0, 87, 65, 86, 69, 1, 2, 3, 4]);
const original = (): AudioInput => ({ recordingId: "synthetic-isolation", checksum: "synthetic-original", durationMs: 2000,
  stoppedAt: new Date(now).toISOString(), audioExpiresAt: new Date(now + 7000).toISOString(), textExpiresAt: new Date(now + 30000).toISOString(),
  name: "synthetic.wav", mimeType: "audio/wav", blob: new Blob(["synthetic-original"]), audioVariant: "original" });
const digest = async (value: ArrayBuffer) => createHash("sha256").update(new Uint8Array(value)).digest("hex");
const opts = (transport: typeof fetch = async () => new Response(bytes)): IsolationOptions => ({
  signal: new AbortController().signal, fetch: transport, now: () => now, digest,
});
function memory() {
  let state: IsolationState | undefined, audio: AudioInput | undefined, deleted = false;
  const check = () => { if (deleted) throw new AsrError("audio_expired"); };
  const store: IsolationStore = {
    original: async () => { check(); return original(); }, state: async () => { check(); return state; },
    mark: async value => { check(); state = structuredClone(value); },
    save: async (value, next, valid) => { check(); if (!valid()) throw new AsrError("cancelled"); audio = { ...value, blob: new Blob([value.bytes], { type: value.mimeType }) }; state = structuredClone(next); },
    denoised: async () => { check(); if (!audio) throw new AsrError("denoised_audio_missing"); return audio; },
  };
  return { store, state: () => state, audio: () => audio, remove: () => { deleted = true; audio = undefined; state = undefined; } };
}

test("isolation sends original bytes once to ElevenLabs and preserves recording timeline/expiry", async () => {
  const input = original();
  const output = await isolateAudio(input, "synthetic-key", opts(async (url, init) => {
    assert.equal(url, "https://api.elevenlabs.io/v1/audio-isolation");
    assert.equal((init?.headers as Record<string, string>)["xi-api-key"], "synthetic-key");
    const body = init?.body as FormData;
    assert.equal(await (body.get("audio") as Blob).text(), await input.blob.text());
    assert.equal(body.has("file"), false);
    return new Response(bytes, { headers: { "content-type": "application/octet-stream" } });
  }));
  assert.equal(output.mimeType, "audio/wav"); assert.match(output.name, /-denoised.wav$/);
  assert.equal(output.audioVariant, "denoised"); assert.notEqual(output.checksum, input.checksum);
  for (const property of ["recordingId", "stoppedAt", "durationMs", "audioExpiresAt", "textExpiresAt"] as const) assert.equal(output[property], input[property]);
  assert.equal(await input.blob.text(), "synthetic-original");
});

test("ready audio is durably reused, and rapid original ASR stays independent of denoised ASR", async () => {
  const db = memory(); let calls = 0;
  const options = opts(async () => { calls++; return new Response(bytes); });
  const cleaned = await prepareDenoisedAudio(db.store, "synthetic-key", options);
  assert.equal(db.state()?.status, "ready");
  await prepareDenoisedAudio(db.store, "synthetic-key", options); assert.equal(calls, 1);
  const runs: EnsembleRun[] = [];
  for (const input of [original(), cleaned]) {
    await runEnsemble(input, { elevenlabs: "synthetic-key" }, async (_id, received) => ({
      text: received.audioVariant === "denoised" ? "処理後の人工結果" : "原音の人工結果", segments: [], raw: {},
    }), { signal: options.signal, now: () => now, publish: async run => { runs.push(run); } });
  }
  const raw = runs.find(r => r.candidates[2].text === "原音の人工結果")!;
  const refined = runs.at(-1)!;
  assert.equal(raw.audioVariant, "original"); assert.equal(refined.audioVariant, "denoised");
  assert.notEqual(raw.candidates[2].id, refined.candidates[2].id);
  assert.notEqual(raw.checksum, refined.checksum);
  await assert.rejects(runEnsemble(cleaned, { elevenlabs: "synthetic-key" }, async () => { throw new Error("must not call"); },
    { signal: options.signal, now: () => now, previous: raw, publish: async () => {} }), /invalid_recording/);
});

test("missing key, HTTP errors, non-audio/empty responses cannot become a cleaned recording", async () => {
  for (const [key, transport, pattern] of [
    ["", async () => { throw new Error("must not call"); }, /no_isolation_key/],
    ["synthetic-key", async () => new Response("denied", { status: 401 }), /http_401/],
    ["synthetic-key", async () => new Response('{"message":"invalid media"}'), /invalid_isolated_audio/],
    ["synthetic-key", async () => new Response(new Uint8Array()), /audio_size_limit/],
  ] as const) {
    const db = memory();
    await assert.rejects(prepareDenoisedAudio(db.store, key, opts(transport)), pattern);
    assert.equal(db.audio(), undefined); assert.notEqual(db.state()?.status, "ready");
  }
});

test("journal failure prevents API calls; interruption is not automatically resent", async () => {
  const db = memory(); let calls = 0;
  const options = opts(async () => { calls++; return new Response(bytes); });
  await assert.rejects(prepareDenoisedAudio({ ...db.store, mark: async () => { throw new Error("disk full"); } }, "synthetic-key", options), /disk full/);
  assert.equal(calls, 0);
  await db.store.mark({ provider: "elevenlabs", sourceChecksum: original().checksum, status: "running", error: null });
  await assert.rejects(prepareDenoisedAudio(db.store, "synthetic-key", options), /isolation_retry_required/);
  assert.equal(calls, 0);
  await prepareDenoisedAudio(db.store, "synthetic-key", { ...options, retry: true }); assert.equal(calls, 1);
});

test("duplicate start, deletion, cancellation and expiry discard late audio", async () => {
  for (const action of ["delete", "cancel", "expire"] as const) {
    const db = memory(); const controller = new AbortController();
    let release!: () => void; const gate = new Promise<void>(r => { release = r; });
    let started!: () => void; const ready = new Promise<void>(r => { started = r; });
    let clock = now;
    const options = { ...opts(async () => { started(); await gate; return new Response(bytes); }), signal: controller.signal, now: () => clock };
    const pending = prepareDenoisedAudio(db.store, "synthetic-key", options);
    await ready;
    await assert.rejects(prepareDenoisedAudio(db.store, "synthetic-key", options), /already_running/);
    if (action === "delete") db.remove();
    if (action === "cancel") controller.abort();
    if (action === "expire") clock += 10000;
    release(); await assert.rejects(pending);
    assert.equal(db.audio(), undefined); assert.notEqual(db.state()?.status, "ready");
  }
});

test("timeout records result unknown without resubmitting and expired input never calls API", async () => {
  const db = memory(); let calls = 0;
  const options = opts(async (_url, init) => {
    calls++; await new Promise<void>(resolve => init!.signal!.addEventListener("abort", () => resolve(), { once: true }));
    return new Response(bytes);
  });
  await assert.rejects(prepareDenoisedAudio(db.store, "synthetic-key", { ...options, timeoutMs: 5 }), /timeout_no_auto_retry/);
  assert.equal(db.state()?.status, "result_unknown"); assert.equal(calls, 1);
  await assert.rejects(prepareDenoisedAudio(db.store, "synthetic-key", options), /isolation_retry_required/); assert.equal(calls, 1);
  await assert.rejects(isolateAudio(original(), "synthetic-key", { ...opts(), now: () => now + 10000 }), /audio_expired/);
});

test("native-style Blob limitations do not prevent reading and saving isolation bytes", async () => {
  const input = original();
  const BrowserBlob = globalThis.Blob;
  class NativeBlob extends BrowserBlob {
    constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
      if (parts?.some(p => p instanceof ArrayBuffer || ArrayBuffer.isView(p))) throw new Error("Creating blobs from ArrayBuffer is not supported");
      super(parts, options);
    }
    arrayBuffer(): Promise<ArrayBuffer> { throw new Error("RN Blob.arrayBuffer unavailable"); }
  }
  globalThis.Blob = NativeBlob;
  try {
    const output = await isolateAudio(input, "synthetic-key", opts());
    assert.deepEqual(new Uint8Array(output.bytes), bytes);
  } finally { globalThis.Blob = BrowserBlob; }
});

test("device save failure remains distinct from API failure and never becomes ready", async () => {
  const db = memory();
  await assert.rejects(prepareDenoisedAudio({ ...db.store, save: async () => { throw new Error("disk full"); } }, "synthetic-key", opts()), /isolated_save_failed/);
  assert.equal(db.state()?.error, "isolated_save_failed"); assert.equal(db.state()?.status, "failed"); assert.equal(db.audio(), undefined);
});
