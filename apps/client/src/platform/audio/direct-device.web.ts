import { isVoiceSample, voiceExpiresAt, voiceOwner, requireVoiceOwner, prepareVoiceSample, requireConversationAudio } from "../../data/voice-enrollment";
import { useEffect, useRef, useState } from "react";
import type { LocalRecording } from "./storage";
import { AsrError, restoreRun, type AudioInput, type EnsembleRun } from "../../data/direct-asr";
import type { AudioVariant, IsolatedAudio, IsolationState, IsolationStore } from "../../data/audio-isolation";
export type { LocalRecording } from "./storage";
export const providerFetch: typeof fetch = (...args) => fetch(...args);
type Entry = { recording: LocalRecording; blob: Blob | null; run: EnsembleRun | null; denoisedBlob?: Blob | null; denoisedRun?: EnsembleRun | null };
export async function audioDigest(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), n => n.toString(16).padStart(2, "0")).join("");
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("setlog-direct-asr-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("recordings", { keyPath: "recording.id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("録音の保存先を開けませんでした。"));
  });
}
async function tx<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, finish: (value: T) => void) => void): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("recordings", mode);
    let result: T;
    transaction.oncomplete = () => { db.close(); resolve(result); };
    transaction.onerror = transaction.onabort = () => { db.close(); reject(new Error("録音の保存に失敗しました。")); };
    action(transaction.objectStore("recordings"), value => { result = value; });
  });
}
const expiry = (r: LocalRecording) => Date.parse(r.stopped_at ?? r.started_at) + 30 * 86400000;
export async function loadRecordings(ownerId = "direct-device"): Promise<LocalRecording[]> {
  return tx("readwrite", (store, finish) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const values: Entry[] = request.result;
      for (const entry of values) {
        if ((isVoiceSample(entry.recording) ? voiceExpiresAt(entry.recording) : expiry(entry.recording)) <= Date.now()) store.delete(entry.recording.id);
        else if ((entry.blob || entry.denoisedBlob) && Date.parse(entry.recording.audio_expires_at) <= Date.now()) store.put({ ...entry, blob: null, denoisedBlob: null });
      }
      finish(values.filter(e => e.recording.owner_id === ownerId && (isVoiceSample(e.recording) ? voiceExpiresAt(e.recording) : expiry(e.recording)) > Date.now()).map(e => e.recording).sort((a, b) => b.started_at.localeCompare(a.started_at)));
    };
  });
}
export async function loadRun(id: string, variant: AudioVariant = "original"): Promise<EnsembleRun | null> {
  return tx("readonly", (store, finish) => { const req = store.get(id); req.onsuccess = () => {
    const run = variant === "denoised" ? req.result?.denoisedRun : req.result?.run;
    finish(run ? restoreRun(run) : null);
  }; });
}
export async function saveRun(run: EnsembleRun): Promise<void> {
  const saved = await tx<boolean>("readwrite", (store, finish) => {
    const request = store.get(run.recordingId);
    request.onsuccess = () => {
      const entry: Entry | undefined = request.result;
      if (!entry || expiry(entry.recording) <= Date.now()) { finish(false); return; }
      if (isVoiceSample(entry.recording)) { finish(false); return; }
      const denoised = run.audioVariant === "denoised";
      if (run.checksum !== (denoised ? entry.recording.denoising?.audio?.checksum : entry.recording.checksum)) { finish(false); return; }
      store.put({ ...entry, [denoised ? "denoisedRun" : "run"]: run }); finish(true);
    };
  });
  if (!saved) throw new AsrError("text_expired");
}
export async function removeRecording(recording: LocalRecording): Promise<void> {
  await tx<void>("readwrite", (store, finish) => { store.delete(recording.id); finish(); });
}
export async function getAudio(recording: LocalRecording, variant: AudioVariant = "original"): Promise<AudioInput> {
  const entry = await tx<Entry | undefined>("readonly", (store, finish) => { const req = store.get(recording.id); req.onsuccess = () => finish(req.result); });
  if (!entry?.blob) throw new AsrError("audio_expired");
  requireConversationAudio(entry.recording);
  if (entry.recording.owner_id !== recording.owner_id || entry.recording.checksum !== recording.checksum || Date.parse(entry.recording.audio_expires_at) <= Date.now()) throw new AsrError("audio_expired");
  const cleaned = variant === "denoised" ? entry.recording.denoising?.audio : undefined;
  if (variant === "denoised" && (entry.recording.denoising?.status !== "ready" || !entry.denoisedBlob || !cleaned)) throw new AsrError("denoised_audio_missing");
  const blob = variant === "denoised" ? entry.denoisedBlob! : entry.blob;
  const type = blob.type.split(";")[0];
  return { recordingId: recording.id, checksum: cleaned?.checksum ?? recording.checksum!, durationMs: recording.duration_ms, audioVariant: variant,
    stoppedAt: recording.stopped_at!, audioExpiresAt: recording.audio_expires_at, textExpiresAt: new Date(expiry(recording)).toISOString(),
    name: cleaned?.name ?? `${recording.id}.${type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm"}`,
    mimeType: cleaned?.mimeType ?? (type.includes("mp4") ? "audio/m4a" : type), blob };
}

export function isolationStore(recording: LocalRecording): IsolationStore {
  const update = async (state: IsolationState, audio?: IsolatedAudio, valid: () => boolean = () => true) => {
    const saved = await tx<boolean>("readwrite", (store, finish) => {
      const request = store.get(recording.id);
      request.onsuccess = () => {
        const entry: Entry | undefined = request.result;
        if (!valid() || !entry?.blob || isVoiceSample(entry.recording) || entry.recording.owner_id !== recording.owner_id ||
            entry.recording.checksum !== state.sourceChecksum || Date.parse(entry.recording.audio_expires_at) <= Date.now()) { finish(false); return; }
        store.put({ ...entry, recording: { ...entry.recording, denoising: state }, ...(audio ? { denoisedBlob: new Blob([audio.bytes], { type: audio.mimeType }) } : {}) }); finish(true);
      };
    });
    if (!saved) throw new AsrError("audio_expired");
  };
  return {
    original: () => getAudio(recording), denoised: () => getAudio(recording, "denoised"),
    state: () => tx<IsolationState | undefined>("readonly", (store, finish) => {
      const request = store.get(recording.id); request.onsuccess = () => finish(request.result?.recording.denoising);
    }),
    mark: state => update(state), save: (audio, state, valid) => update(state, audio, valid),
  };
}
export async function playbackUri(recording: LocalRecording, variant: AudioVariant): Promise<string> {
  return URL.createObjectURL((await getAudio(recording, variant)).blob);
}
export function releasePlaybackUri(uri: string) { URL.revokeObjectURL(uri); }
export function useDirectCapture(onSaved: (recording: LocalRecording) => void) {
  const [phase, setPhase] = useState("idle");
  const [durationMs, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const starting = useRef(false);
  const alive = useRef(true);
  const saved = useRef(onSaved); saved.current = onSaved;
  const pending = useRef<Entry | null>(null);
  const stop = async () => { if (recorder.current?.state === "recording") { setPhase("stopping"); recorder.current.stop(); } };
  useEffect(() => { alive.current = true; return () => { alive.current = false; if (recorder.current?.state === "recording") recorder.current.stop(); }; }, []);
  async function persist() {
    if (!pending.current) return;
    try {
      const entry = pending.current;
      await tx<void>("readwrite", (store, finish) => { store.put(entry); finish(); });
      pending.current = null;
      if (alive.current) { setPhase(entry.recording.capture_status); saved.current(entry.recording); }
    } catch { if (alive.current) { setPhase("save_failed"); setError("録音を保存できませんでした。保存を再試行してください。"); } }
  }
  async function start(ownerId: string) {
    if (starting.current || recorder.current || pending.current) return;
    starting.current = true; setError(null); setPhase("preparing");
    let stream: MediaStream | null = null;
    let cleanup = () => {};
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("unsupported");
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 }, video: false });
      if (!alive.current) { stream.getTracks().forEach(t => t.stop()); return; }
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(t => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 64000 });
      const chunks: Blob[] = [];
      const started = Date.now();
      let interrupted = false;
      rec.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      rec.onerror = () => { interrupted = true; void stop(); };
      const interval = setInterval(() => { if (alive.current) setDuration(Math.min(300000, Date.now() - started)); }, 250);
      const limit = setTimeout(() => { void stop(); }, 300000);
      const hidden = () => { if (document.visibilityState === "hidden") { interrupted = true; void stop(); } };
      document.addEventListener("visibilitychange", hidden);
      cleanup = () => { clearInterval(interval); clearTimeout(limit); document.removeEventListener("visibilitychange", hidden); };
      rec.onstop = async () => {
        cleanup();
        stream!.getTracks().forEach(t => t.stop()); recorder.current = null;
        const blob = new Blob(chunks, { type: rec.mimeType });
        if (!blob.size) { if (alive.current) { setPhase("idle"); setError("音声が保存されませんでした。"); } return; }
        try {
          const checksum = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())), n => n.toString(16).padStart(2, "0")).join("");
          const stopped = Date.now(); const id = crypto.randomUUID();
          const recording: LocalRecording = { id, owner_id: ownerId, uri: `indexeddb:${id}`, started_at: new Date(started).toISOString(),
            stopped_at: new Date(stopped).toISOString(), duration_ms: Math.max(1, Math.min(stopped - started, 300000)),
            capture_status: interrupted ? "interrupted" : "saved", audio_expires_at: new Date(stopped + 7 * 86400000).toISOString(),
            size: blob.size, checksum, remote_id: null, remote_version: null, processing_key: crypto.randomUUID() };
          pending.current = { recording, blob, run: null };
          await persist();
        } catch { if (alive.current) { setPhase("idle"); setError("録音の形式または保存先を確認できませんでした。"); } }
      };
      recorder.current = rec; rec.start(1000); setDuration(0); setPhase("recording");
    } catch {
      cleanup();
      stream?.getTracks().forEach(t => t.stop()); recorder.current = null;
      if (alive.current) { setPhase("idle"); setError("マイクを開始できませんでした。HTTPS・マイク権限・対応ブラウザを確認してください。"); }
    } finally { starting.current = false; }
  }
  return { phase, error, durationMs, start, stop, retrySave: persist, clearError: () => setError(null) };
}

export async function saveVoiceSample(recordingId: string, memberId: string, displayName: string): Promise<LocalRecording> {
  const result = await tx<{ value?: LocalRecording; error?: string }>("readwrite", (store, finish) => {
    const request = store.get(recordingId);
    request.onsuccess = () => {
      const entry: Entry | undefined = request.result;
      try {
        if (!entry?.blob) throw new Error("登録音声が見つかりません。");
        const updated = prepareVoiceSample(entry.recording, memberId, displayName);
        store.put({ ...entry, recording: updated }); finish({ value: updated });
      } catch (error) { finish({ error: error instanceof Error ? error.message : "保存できませんでした。" }); }
    };
  });
  if (!result.value) throw new Error(result.error);
  return result.value;
}
export async function deleteVoiceSample(recordingId: string, memberId: string): Promise<void> {
  const removed = await tx<boolean>("readwrite", (store, finish) => {
    const request = store.get(recordingId);
    request.onsuccess = () => {
      const entry: Entry | undefined = request.result;
      if (!entry) { finish(true); return; }
      if (entry.recording.owner_id !== voiceOwner(memberId)) { finish(false); return; }
      store.delete(recordingId); finish(true);
    };
  });
  if (!removed) throw new Error("この登録音声を削除できません。");
}
export async function voiceSampleUri(recordingId: string, memberId: string): Promise<string> {
  const entry = await tx<Entry | undefined>("readonly", (store, finish) => {
    const request = store.get(recordingId); request.onsuccess = () => finish(request.result);
  });
  if (!entry?.blob || voiceExpiresAt(entry.recording) <= Date.now()) throw new Error("登録音声が見つからないか、期限が切れています。");
  requireVoiceOwner(entry.recording, memberId);
  return URL.createObjectURL(entry.blob);
}
export function releaseVoiceSampleUri(uri: string) { URL.revokeObjectURL(uri); }
