import { useEffect, useRef, useState } from "react";
import type { LocalRecording } from "./storage";
import { AsrError, restoreRun, type AudioInput, type EnsembleRun } from "../../data/direct-asr";
export type { LocalRecording } from "./storage";
export const providerFetch: typeof fetch = (...args) => fetch(...args);
type Entry = { recording: LocalRecording; blob: Blob | null; run: EnsembleRun | null };
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
export async function loadRecordings(): Promise<LocalRecording[]> {
  return tx("readwrite", (store, finish) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const values: Entry[] = request.result;
      for (const entry of values) {
        if (expiry(entry.recording) <= Date.now()) store.delete(entry.recording.id);
        else if (entry.blob && Date.parse(entry.recording.audio_expires_at) <= Date.now()) store.put({ ...entry, blob: null });
      }
      finish(values.filter(e => expiry(e.recording) > Date.now()).map(e => e.recording).sort((a, b) => b.started_at.localeCompare(a.started_at)));
    };
  });
}
export async function loadRun(id: string): Promise<EnsembleRun | null> {
  return tx("readonly", (store, finish) => { const req = store.get(id); req.onsuccess = () => finish(req.result?.run ? restoreRun(req.result.run) : null); });
}
export async function saveRun(run: EnsembleRun): Promise<void> {
  const saved = await tx<boolean>("readwrite", (store, finish) => {
    const request = store.get(run.recordingId);
    request.onsuccess = () => {
      const entry: Entry | undefined = request.result;
      if (!entry || expiry(entry.recording) <= Date.now()) { finish(false); return; }
      store.put({ ...entry, run }); finish(true);
    };
  });
  if (!saved) throw new AsrError("text_expired");
}
export async function removeRecording(recording: LocalRecording): Promise<void> {
  await tx<void>("readwrite", (store, finish) => { store.delete(recording.id); finish(); });
}
export async function getAudio(recording: LocalRecording): Promise<AudioInput> {
  const entry = await tx<Entry | undefined>("readonly", (store, finish) => { const req = store.get(recording.id); req.onsuccess = () => finish(req.result); });
  if (!entry?.blob) throw new AsrError("audio_expired");
  const type = entry.blob.type.split(";")[0];
  return { recordingId: recording.id, checksum: recording.checksum!, durationMs: recording.duration_ms,
    stoppedAt: recording.stopped_at!, audioExpiresAt: recording.audio_expires_at, textExpiresAt: new Date(expiry(recording)).toISOString(),
    name: `${recording.id}.${type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm"}`,
    mimeType: type.includes("mp4") ? "audio/m4a" : type, blob: entry.blob };
}
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
  async function start(_ownerId: string) {
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
          const recording: LocalRecording = { id, owner_id: "direct-device", uri: `indexeddb:${id}`, started_at: new Date(started).toISOString(),
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
