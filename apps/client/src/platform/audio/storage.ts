import { Directory, File, Paths } from "expo-file-system";
import * as Crypto from "expo-crypto";
export type LocalRecording = {
  id: string;
  owner_id: string;
  uri: string;
  started_at: string;
  stopped_at: string | null;
  duration_ms: number;
  capture_status:
    "recording" | "stopping" | "saved" | "interrupted" | "save_failed";
  audio_expires_at: string;
  size: number;
  checksum: string | null;
  remote_id: string | null;
  remote_version: number | null;
  processing_key: string;
  deletion_version?: number;
  operation?: {
    key: string;
    consent_id?: string;
    consent_version?: number;
    transcription_version?: number;
    job_id?: string;
  };
};
const activeIds = new Set<string>();
export function backupReady() {
  return new File(Paths.document, ".recording-backup-ready").exists;
}
export function captureActive(id: string, active: boolean) {
  if (active) activeIds.add(id);
  else activeIds.delete(id);
}
function directory() {
  const dir = new Directory(Paths.document, "recordings");
  dir.create({ idempotent: true, intermediates: true });
  return dir;
}
export function writeLocal(value: LocalRecording) {
  const file = new File(directory(), `${value.id}.json`);
  file.write(JSON.stringify(value));
}
export async function readLocal(ownerId: string): Promise<LocalRecording[]> {
  const output: LocalRecording[] = [];
  for (const file of directory().list()) {
    if (!(file instanceof File) || !file.name.endsWith(".json")) continue;
    let recording: LocalRecording;
    try {
      recording = JSON.parse(await file.text()) as LocalRecording;
    } catch {
      continue;
    }
    if (!recording.id || !recording.audio_expires_at || !recording.owner_id)
      continue;
    if (new Date(recording.audio_expires_at).getTime() <= Date.now()) {
      if (recording.uri.startsWith(Paths.document.uri)) {
        const audio = new File(recording.uri);
        if (audio.exists) audio.delete();
      }
      file.delete();
      continue;
    }
    if (recording.owner_id !== ownerId) continue;
    if (
      !activeIds.has(recording.id) &&
      (recording.capture_status === "recording" ||
        recording.capture_status === "stopping")
    ) {
      recording.capture_status = "interrupted";
      writeLocal(recording);
    }
    output.push(recording);
  }
  return output.sort((a, b) => b.started_at.localeCompare(a.started_at));
}
export async function finishLocal(
  recording: LocalRecording,
  uri: string,
  durationMs: number,
  interrupted: boolean,
): Promise<LocalRecording> {
  const target = new File(directory(), `${recording.id}.m4a`);
  // A previous attempt may have moved the file before checksum/metadata failed.
  const source = target.exists ? target : new File(uri);
  if (!source.exists || source.size === 0)
    throw new Error("録音ファイルを保存できませんでした");
  if (source.size > 25 * 1024 * 1024)
    throw new Error("録音ファイルが上限を超えています");
  if (source.uri !== target.uri) source.move(target);
  recording.uri = target.uri;
  recording.stopped_at ??= new Date().toISOString();
  recording.duration_ms = Math.max(1, Math.min(300000, Math.round(durationMs)));
  recording.capture_status = "stopping";
  writeLocal(recording);
  const checksumBytes = await Crypto.digest(
    Crypto.CryptoDigestAlgorithm.SHA256,
    await target.bytes(),
  );
  const checksum = Array.from(new Uint8Array(checksumBytes), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
  const result: LocalRecording = {
    ...recording,
    capture_status: interrupted ? "interrupted" : "saved",
    size: target.size,
    checksum,
    audio_expires_at: new Date(
      Date.parse(recording.stopped_at) + 7 * 86400000,
    ).toISOString(),
  };
  writeLocal(result);
  return result;
}
export function deleteLocal(recording: LocalRecording) {
  if (recording.uri.startsWith(Paths.document.uri)) {
    const audio = new File(recording.uri);
    if (audio.exists) audio.delete();
  }
  const metadata = new File(directory(), `${recording.id}.json`);
  if (metadata.exists) metadata.delete();
}
export function audioFile(uri: string) {
  return new File(uri);
}
