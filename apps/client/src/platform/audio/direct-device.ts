import { isVoiceSample, voiceExpiresAt, requireVoiceOwner, prepareVoiceSample, requireConversationAudio } from "../../data/voice-enrollment";
import { useCapture } from "./useCapture";
import { useRef, useState } from "react";
import { deleteLocal, type LocalRecording } from "./storage";
import { Directory, File, Paths } from "expo-file-system";
import { fetch as nativeFetch } from "expo/fetch";
import { AsrError, restoreRun, type AudioInput, type EnsembleRun } from "../../data/direct-asr";
export type { LocalRecording } from "./storage";
export const providerFetch = nativeFetch as typeof fetch;
type Entry = { recording: LocalRecording; run: EnsembleRun | null };
function directory() {
  const dir = new Directory(Paths.document, "direct-asr");
  dir.create({ idempotent: true, intermediates: true });
  return dir;
}
function file(id: string) {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new Error("Invalid recording id");
  return new File(directory(), `${id}.json`);
}
const expiry = (r: LocalRecording) => Date.parse(r.stopped_at ?? r.started_at) + 30 * 86400000;
export function useDirectCapture(onSaved: (recording: LocalRecording) => void) {
  const pending = useRef<LocalRecording | null>(null);
  const [saveError, setSaveError] = useState(false);
  const persist = () => {
    const recording = pending.current;
    if (!recording) return;
    try {
      file(recording.id).write(JSON.stringify({ recording, run: null }));
      pending.current = null; setSaveError(false); onSaved(recording);
    } catch { setSaveError(true); }
  };
  const capture = useCapture(recording => { pending.current = recording; persist(); });
  return { ...capture, phase: saveError ? "save_failed" : capture.phase,
    error: saveError ? "録音一覧を保存できませんでした。保存を再試行してください。" : capture.error,
    retrySave: async () => { if (pending.current) persist(); else await capture.retrySave(); } };
}
export async function loadRecordings(ownerId = "direct-device"): Promise<LocalRecording[]> {
  const result: LocalRecording[] = [];
  for (const candidate of directory().list()) {
    if (!(candidate instanceof File) || !candidate.name.endsWith(".json")) continue;
    const entry: Entry = JSON.parse(await candidate.text());
    if ((isVoiceSample(entry.recording) ? voiceExpiresAt(entry.recording) : expiry(entry.recording)) <= Date.now()) { deleteLocal(entry.recording); candidate.delete(); continue; }
    if (Date.parse(entry.recording.audio_expires_at) <= Date.now()) deleteLocal(entry.recording);
    if (entry.recording.owner_id === ownerId) result.push(entry.recording);
  }
  return result.sort((a, b) => b.started_at.localeCompare(a.started_at));
}
export async function loadRun(id: string): Promise<EnsembleRun | null> {
  if (!file(id).exists) return null;
  const entry: Entry = JSON.parse(await file(id).text());
  return entry.run ? restoreRun(entry.run) : null;
}
export async function saveRun(run: EnsembleRun) {
  const target = file(run.recordingId);
  if (!target.exists) throw new AsrError("text_expired");
  // Read synchronously so deletion cannot interleave with a stale write.
  const entry: Entry = JSON.parse(target.textSync());
  if (expiry(entry.recording) <= Date.now()) throw new AsrError("text_expired");
  requireConversationAudio(entry.recording);
  target.write(JSON.stringify({ ...entry, run }));
}
export async function removeRecording(recording: LocalRecording) {
  const target = file(recording.id);
  if (target.exists) target.delete();
  deleteLocal(recording);
}
export async function getAudio(recording: LocalRecording): Promise<AudioInput> {
  if (!file(recording.id).exists) throw new AsrError("audio_expired");
  requireConversationAudio(recording);
  requireConversationAudio((JSON.parse(file(recording.id).textSync()) as Entry).recording);
  const blob = new File(recording.uri);
  if (!blob.exists) throw new AsrError("audio_expired");
  return { recordingId: recording.id, checksum: recording.checksum ?? "", durationMs: recording.duration_ms,
    stoppedAt: recording.stopped_at!, audioExpiresAt: recording.audio_expires_at,
    textExpiresAt: new Date(expiry(recording)).toISOString(), name: `${recording.id}.m4a`, mimeType: "audio/m4a", blob };
}

export async function saveVoiceSample(recordingId: string, memberId: string, displayName: string): Promise<LocalRecording> {
  const target = file(recordingId);
  if (!target.exists) throw new Error("登録音声が見つかりません。");
  const entry: Entry = JSON.parse(target.textSync());
  const updated = prepareVoiceSample(entry.recording, memberId, displayName);
  if (!new File(updated.uri).exists) throw new Error("登録音声が見つかりません。");
  target.write(JSON.stringify({ ...entry, recording: updated }));
  return updated;
}
export async function deleteVoiceSample(recordingId: string, memberId: string): Promise<void> {
  const target = file(recordingId);
  if (!target.exists) return;
  const entry: Entry = JSON.parse(target.textSync());
  requireVoiceOwner(entry.recording, memberId);
  await removeRecording(entry.recording);
}
export async function voiceSampleUri(recordingId: string, memberId: string): Promise<string> {
  const entry: Entry = JSON.parse(file(recordingId).textSync());
  requireVoiceOwner(entry.recording, memberId);
  if (voiceExpiresAt(entry.recording) <= Date.now() || !new File(entry.recording.uri).exists)
    throw new Error("登録音声の保存期限が切れています。");
  return entry.recording.uri;
}
export function releaseVoiceSampleUri(_uri: string) {}
