import type { LocalRecording } from "./storage";
export type { LocalRecording } from "./storage";
export async function readLocal(_ownerId: string): Promise<LocalRecording[]> {
  return [];
}
export function writeLocal(_value: LocalRecording) {
  throw new Error("端末録音はiOS / Androidで利用できます");
}
export async function finishLocal(
  _recording: LocalRecording,
  _uri: string,
  _durationMs: number,
  _interrupted: boolean,
): Promise<LocalRecording> {
  throw new Error("端末録音はiOS / Androidで利用できます");
}
export function deleteLocal(_recording: LocalRecording) {
  throw new Error("端末録音はiOS / Androidで利用できます");
}
export function audioFile(_uri: string): Blob {
  throw new Error("端末録音はiOS / Androidで利用できます");
}
