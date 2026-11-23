import type { LocalRecording } from "./storage";
export type { LocalRecording } from "./storage";

// Web版: メモリ上にblobを保持
export const webAudioStore = new Map<string, Blob>();

export async function readLocal(_ownerId: string): Promise<LocalRecording[]> {
  return [];
}
export function writeLocal(_value: LocalRecording) {}
export async function finishLocal(
  recording: LocalRecording,
  _uri: string,
  _durationMs: number,
  _interrupted: boolean,
): Promise<LocalRecording> {
  return recording;
}
export function deleteLocal(recording: LocalRecording) {
  webAudioStore.delete(recording.id);
}
export function audioFile(_uri: string): Blob {
  throw new Error("audioFile not supported on web");
}
