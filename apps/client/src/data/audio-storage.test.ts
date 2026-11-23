import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { prepareDenoisedAudio } from "./audio-isolation";
import { newRun } from "./direct-asr";
import { audioDigest, getAudio, isolationStore, loadRecordings, loadRun, removeRecording, saveRun } from "../platform/audio/direct-device.web";
import type { LocalRecording } from "../platform/audio/storage";

async function db() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("setlog-direct-asr-v1", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("recordings", { keyPath: "recording.id" });
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
}
async function stored(id: string) {
  const database = await db();
  return new Promise<any>((resolve, reject) => {
    const transaction = database.transaction("recordings", "readonly"); const req = transaction.objectStore("recordings").get(id);
    transaction.oncomplete = () => { database.close(); resolve(req.result); }; transaction.onerror = () => reject(transaction.error);
  });
}
async function seed(id: string, patch: Partial<LocalRecording> = {}) {
  const now = Date.now();
  const recording: LocalRecording = { id, owner_id: "direct-device", uri: `indexeddb:${id}`, checksum: "synthetic-source",
    started_at: new Date(now - 3000).toISOString(), stopped_at: new Date(now).toISOString(), duration_ms: 3000, capture_status: "saved",
    audio_expires_at: new Date(now + 7 * 86400000).toISOString(), size: 16, remote_id: null, remote_version: null, processing_key: "synthetic-operation", ...patch };
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction("recordings", "readwrite");
    transaction.objectStore("recordings").put({ recording, blob: new Blob(["synthetic-source"], { type: "audio/webm" }), run: null });
    transaction.oncomplete = () => { database.close(); resolve(); }; transaction.onerror = () => reject(transaction.error);
  });
  return recording;
}
const media = new Uint8Array([73, 68, 51, 4, 0, 0, 0, 0, 0, 0, 255, 251, 1, 2, 3, 4]);
const options = () => ({ signal: new AbortController().signal, fetch: async () => new Response(media), digest: audioDigest });

test("IndexedDB stores audio bytes, reloads both ASR variants and deletes both audio and results", async () => {
  const recording = await seed("synthetic-store");
  const raw = await getAudio(recording);
  const cleaned = await prepareDenoisedAudio(isolationStore(recording), "synthetic-key", options());
  assert.deepEqual(new Uint8Array(await cleaned.blob.arrayBuffer()), media);
  assert.equal(await (await getAudio(recording)).blob.text(), "synthetic-source");
  const rapid = newRun(raw, { elevenlabs: "synthetic-key" }); rapid.candidates[2].status = "succeeded"; rapid.candidates[2].text = "原音";
  const delayed = newRun(cleaned, { elevenlabs: "synthetic-key" }); delayed.candidates[2].status = "succeeded"; delayed.candidates[2].text = "雑音除去後";
  await Promise.all([saveRun(rapid), saveRun(delayed)]);
  assert.equal((await loadRun(recording.id))?.candidates[2].text, "原音");
  assert.equal((await loadRun(recording.id, "denoised"))?.candidates[2].text, "雑音除去後");
  const reloaded = (await loadRecordings()).find(r => r.id === recording.id)!;
  assert.equal(reloaded.denoising?.status, "ready");
  assert.equal(reloaded.audio_expires_at, recording.audio_expires_at);
  assert.equal((await getAudio(reloaded, "denoised")).checksum, cleaned.checksum);
  await removeRecording(recording);
  assert.equal(await stored(recording.id), undefined);
  assert.equal(await loadRun(recording.id), null); assert.equal(await loadRun(recording.id, "denoised"), null);
  await assert.rejects(saveRun(delayed));
});

test("IndexedDB deletion racing an API response cannot resurrect the audio", async () => {
  const recording = await seed("synthetic-deleted");
  let release!: () => void; const gate = new Promise<void>(r => { release = r; });
  let started!: () => void; const ready = new Promise<void>(r => { started = r; });
  const pending = prepareDenoisedAudio(isolationStore(recording), "synthetic-key", {
    ...options(), fetch: async () => { started(); await gate; return new Response(media); },
  });
  await ready; await removeRecording(recording); release();
  await assert.rejects(pending); assert.equal(await stored(recording.id), undefined);
});

test("audio expiry clears both persisted blobs while still-valid text survives", async () => {
  const recording = await seed("synthetic-expired");
  const cleaned = await prepareDenoisedAudio(isolationStore(recording), "synthetic-key", options());
  const delayed = newRun(cleaned, {}); await saveRun(delayed);
  const entry = await stored(recording.id); entry.recording.audio_expires_at = new Date(Date.now() - 1).toISOString();
  const database = await db();
  await new Promise<void>(resolve => { const transaction = database.transaction("recordings", "readwrite"); transaction.objectStore("recordings").put(entry); transaction.oncomplete = () => { database.close(); resolve(); }; });
  await loadRecordings();
  const expired = await stored(recording.id);
  assert.equal(expired.blob, null); assert.equal(expired.denoisedBlob, null);
  assert.ok(await loadRun(recording.id, "denoised"));
  await assert.rejects(getAudio(recording, "denoised"), /audio_expired/);
  await removeRecording(recording);
});

test("registration audio and changed owners never enter denoising; cancelled save is not committed", async () => {
  let calls = 0;
  const opts = { ...options(), fetch: async () => { calls++; return new Response(media); } };
  const sample = await seed("synthetic-voice", { owner_id: "voice-enrollment:synthetic-member" });
  await assert.rejects(prepareDenoisedAudio(isolationStore(sample), "synthetic-key", opts));
  const original = await seed("synthetic-owner");
  await assert.rejects(prepareDenoisedAudio(isolationStore({ ...original, owner_id: "another-owner" }), "synthetic-key", opts));
  assert.equal(calls, 0);
  const audio = await getAudio(original);
  await assert.rejects(isolationStore(original).save({ ...audio, bytes: await audio.blob.arrayBuffer() }, { provider: "elevenlabs", sourceChecksum: original.checksum!, status: "ready", error: null,
    audio: { checksum: audio.checksum, size: audio.blob.size, name: audio.name, mimeType: audio.mimeType } }, () => false));
  assert.equal((await stored(original.id)).denoisedBlob, undefined);
  await removeRecording(sample); await removeRecording(original);
});
