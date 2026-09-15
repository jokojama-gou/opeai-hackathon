import type { LocalRecording } from "../platform/audio/storage";

const prefix = "voice-enrollment:";
export const voiceOwner = (memberId: string) => {
  if (!memberId.trim()) throw new Error("端末の名前を選んでください。");
  return prefix + memberId;
};
export const isVoiceSample = (recording: LocalRecording) => recording.owner_id.startsWith(prefix);
export function voiceExpiresAt(recording: LocalRecording): number {
  const stopped = Date.parse(recording.stopped_at ?? recording.started_at);
  const expiry = Date.parse(recording.audio_expires_at);
  return Number.isFinite(stopped) && Number.isFinite(expiry)
    ? Math.min(expiry, stopped + 7 * 86400000) : 0;
}
export function requireVoiceOwner(recording: LocalRecording, memberId: string) {
  if (recording.owner_id !== voiceOwner(memberId)) throw new Error("この登録音声を利用できません。");
}
export function prepareVoiceSample(recording: LocalRecording, memberId: string, displayName: string, now = Date.now()): LocalRecording {
  requireVoiceOwner(recording, memberId);
  const name = displayName.trim();
  if (!name || name.length > 80) throw new Error("表示名を1〜80文字で入力してください。");
  if (voiceExpiresAt(recording) <= now) throw new Error("登録音声の保存期限が切れています。録り直してください。");
  if (recording.capture_status !== "saved" || !recording.checksum || recording.size <= 0 || recording.duration_ms <= 0)
    throw new Error("録音を正常に保存してから登録してください。中断した場合は録り直してください。");
  return { ...recording, voice_profile: { display_name: name, state: "prepared", provider: "elevenlabs", model: "scribe_v2" } };
}

// Registration samples must never enter ordinary transcription or comparison.
export function requireConversationAudio(recording: LocalRecording) {
  if (isVoiceSample(recording)) throw new Error("声の登録用音声は書き起こしへ送信しません。");
}

export const deviceMembers = {
  ios: { id: "hackathon-ios-hinata", name: "ひなた", device: "iPhone" },
  android: { id: "hackathon-android-go", name: "ごう", device: "Android" },
} as const;
export type DeviceMember = typeof deviceMembers[keyof typeof deviceMembers];
export function memberForPlatform(platform: string): DeviceMember | null {
  return platform === "ios" ? deviceMembers.ios : platform === "android" ? deviceMembers.android : null;
}
