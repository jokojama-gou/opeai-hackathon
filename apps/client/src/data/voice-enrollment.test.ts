import assert from "node:assert/strict";
import { test } from "node:test";
import { memberForPlatform, voiceOwner, isVoiceSample, voiceExpiresAt, prepareVoiceSample, requireConversationAudio, requireVoiceOwner } from "./voice-enrollment";
import type { LocalRecording } from "../platform/audio/storage";

const now = Date.parse("2026-09-15T00:00:00Z");
const sample: LocalRecording = {
  id: "artificial-voice", owner_id: voiceOwner("user-a"), uri: "artificial-only",
  started_at: new Date(now - 15000).toISOString(), stopped_at: new Date(now).toISOString(),
  duration_ms: 15000, capture_status: "saved", audio_expires_at: new Date(now + 7 * 86400000).toISOString(),
  checksum: "a".repeat(64), size: 1200, remote_id: null, remote_version: null, processing_key: "artificial-key",
};
test("voice sample is tied to the local device member, without asserting recognition", () => {
  const saved = prepareVoiceSample(sample, "user-a", "  表示名A  ", now);
  assert.equal(saved.voice_profile?.display_name, "表示名A");
  assert.equal(saved.voice_profile?.state, "prepared");
  assert.equal(saved.owner_id, voiceOwner("user-a"));
  assert.equal(saved.remote_id, null);
  assert.equal(sample.voice_profile, undefined);
  assert.throws(() => prepareVoiceSample(sample, "user-b", "B", now));
  assert.throws(() => requireVoiceOwner(sample, "user-b"));
  assert.throws(() => voiceOwner(""));
});
test("voice samples cannot enter ordinary ASR or be borrowed from conversation recordings", () => {
  assert.ok(isVoiceSample(sample));
  assert.throws(() => requireConversationAudio(sample));
  const conversation = { ...sample, owner_id: "direct-device" };
  assert.doesNotThrow(() => requireConversationAudio(conversation));
  assert.throws(() => prepareVoiceSample(conversation, "user-a", "A", now));
});
test("registration requires valid saved audio and a name", () => {
  for (const change of [{ capture_status: "interrupted" as const }, { capture_status: "save_failed" as const }, { checksum: null }, { size: 0 }, { duration_ms: 0 }])
    assert.throws(() => prepareVoiceSample({ ...sample, ...change }, "user-a", "A", now));
  for (const name of ["", "  ", "a".repeat(81)])
    assert.throws(() => prepareVoiceSample(sample, "user-a", name, now));
});
test("seven-day expiry never extends when saving a name; invalid expiry is closed", () => {
  const expiry = now + 7 * 86400000;
  assert.equal(voiceExpiresAt(sample), expiry);
  assert.equal(voiceExpiresAt({ ...sample, audio_expires_at: new Date(expiry + 99999).toISOString() }), expiry);
  assert.throws(() => prepareVoiceSample(sample, "user-a", "A", expiry));
  assert.doesNotThrow(() => prepareVoiceSample(sample, "user-a", "A", expiry - 1));
  assert.equal(voiceExpiresAt({ ...sample, audio_expires_at: "invalid" }), 0);
});

test("hackathon native roles need no login; web chooses explicitly", () => {
  assert.equal(memberForPlatform("ios")?.name, "ひなた");
  assert.equal(memberForPlatform("android")?.name, "ごう");
  assert.notEqual(memberForPlatform("ios")?.id, memberForPlatform("android")?.id);
  assert.equal(memberForPlatform("web"), null);
});
