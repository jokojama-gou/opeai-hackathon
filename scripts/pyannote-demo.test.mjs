import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createSpeakerClient } from "./pyannote-demo.mjs";

const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
const secret = "synthetic-api-secret";
const voiceprint = "synthetic-voiceprint-never-to-browser";
function harness({ failure, output, timeoutMs, pending = 0 } = {}) {
  const calls = [];
  let operation;
  let configured = true;
  let clock = 0;
  const client = createSpeakerClient({ getApiKey: () => configured ? secret : "", timeoutMs, pollMs: 0, now: () => clock,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (failure) return failure(url, options);
      if (url === "https://upload.example/audio") {
        assert.equal(options.headers.Authorization, undefined);
        assert.equal(options.method, "PUT");
        assert.equal(options.body.toString(), "synthetic bytes");
        return new Response(null, { status: 200 });
      }
      assert.equal(options.headers.Authorization, `Bearer ${secret}`);
      if (url.endsWith("media/input")) return json({ url: "https://upload.example/audio" });
      if (url.endsWith("voiceprint") || url.endsWith("identify")) {
        operation = url.endsWith("voiceprint") ? "voiceprint" : "identify";
        assert.equal(JSON.parse(options.body).model, "precision-2");
        return json({ jobId: "test-job", status: "created" });
      }
      assert.equal(url, "https://api.pyannote.ai/v1/jobs/test-job");
      if (pending-- > 0) return json({ status: "running" });
      return json({ status: "succeeded", output: output || (operation === "voiceprint" ? { voiceprint } : {
        identification: [
          { start: 0, end: 1, diarizationSpeaker: "SPEAKER_00", match: "Person1" },
          { start: 1, end: 3, diarizationSpeaker: "SPEAKER_01", match: null }
        ]
      }) });
    }
  });
  return { client, calls, configure: (value) => { configured = value; }, expire: () => { clock += 3600001; } };
}
const audio = Buffer.from("synthetic bytes");

test("register then identify uses the voiceprint, preserves unknown people and hides secrets", async () => {
  const h = harness({ pending: 2 });
  const id = randomUUID();
  const enrolled = await h.client.enroll(id, "Person1", audio);
  assert.deepEqual(enrolled.labels, ["Person1"]);
  assert.ok(!JSON.stringify(enrolled).includes(voiceprint));
  const result = await h.client.identify(id, audio, 70);
  assert.deepEqual(result.segments, [
    { start: 0, end: 1, speaker: "Person1", match: "Person1" },
    { start: 1, end: 3, speaker: "SPEAKER_01", match: null }
  ]);
  const body = JSON.parse(h.calls.find(({ url }) => url.endsWith("/identify")).options.body);
  assert.deepEqual(body.voiceprints, [{ label: "Person1", voiceprint }]);
  assert.deepEqual(body.matching, { threshold: 70, exclusive: true });
  assert.ok(!JSON.stringify(result).includes(voiceprint));
  assert.ok(!JSON.stringify(result).includes(secret));
});

test("missing key and missing registration never upload", async () => {
  const h = harness();
  const id = randomUUID();
  h.configure(false);
  assert.equal(h.client.status(id).configured, false);
  await assert.rejects(h.client.enroll(id, "Person1", audio), { code: "PYANNOTE_KEY_MISSING" });
  await assert.rejects(h.client.identify(id, audio), { code: "PYANNOTE_KEY_MISSING" });
  h.configure(true);
  await assert.rejects(h.client.identify(id, audio), { code: "NO_VOICEPRINTS" });
  assert.equal(h.calls.length, 0);
});

test("profiles are isolated per page, deletable and expire", async () => {
  const h = harness();
  const a = randomUUID(), b = randomUUID();
  await h.client.enroll(a, "Person1", audio);
  assert.deepEqual(h.client.status(b).labels, []);
  await assert.rejects(h.client.identify(b, audio), { code: "NO_VOICEPRINTS" });
  assert.deepEqual(h.client.clear(a).labels, []);
  await h.client.enroll(a, "Person1", audio);
  h.expire();
  assert.deepEqual(h.client.status(a).labels, []);
});

test("invalid input, duplicate names and profile limit do not create extra jobs", async () => {
  const h = harness();
  const id = randomUUID();
  await assert.rejects(h.client.enroll("invalid", "Person1", audio), { code: "SESSION_REQUIRED" });
  await assert.rejects(h.client.enroll(id, "", audio), { code: "INVALID_LABEL" });
  await assert.rejects(h.client.identify(id, audio, 101), { code: "INVALID_THRESHOLD" });
  assert.equal(h.calls.length, 0);
  await h.client.enroll(id, "Person1", audio);
  const count = h.calls.length;
  await assert.rejects(h.client.enroll(id, "Person1", audio), { code: "DUPLICATE_LABEL" });
  assert.equal(h.calls.length, count);
  for (let i = 2; i <= 4; i++) await h.client.enroll(id, "Person" + i, audio);
  await assert.rejects(h.client.enroll(id, "Person5", audio), { code: "PROFILE_LIMIT" });
});

test("provider and malformed responses are sanitized", async (t) => {
  for (const status of [400, 401, 402, 403, 429, 500]) await t.test(String(status), async () => {
    const h = harness({ failure: () => json({ message: secret }, status) });
    await assert.rejects(h.client.enroll(randomUUID(), "Person1", audio), (error) => error.code === "PYANNOTE_HTTP_" + status && !error.message.includes(secret));
  });
  for (const value of [{}, { url: "http://upload.example/audio" }, { url: "https://user:password@upload.example/audio" }]) {
    const h = harness({ failure: () => json(value) });
    await assert.rejects(h.client.enroll(randomUUID(), "Person1", audio), { code: "PYANNOTE_RESPONSE" });
    assert.equal(h.calls.length, 1);
  }
  const h = harness({ output: {} });
  await assert.rejects(h.client.enroll(randomUUID(), "Person1", audio), { code: "PYANNOTE_RESPONSE" });
});

test("timeouts and network errors do not leak underlying messages", async () => {
  const h = harness({ failure: async () => { throw new Error(secret); } });
  await assert.rejects(h.client.enroll(randomUUID(), "Person1", audio), { code: "PYANNOTE_NETWORK" });
  const slow = harness({ timeoutMs: 10, failure: (_url, { signal }) => new Promise((_resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("test watchdog")), 100);
    signal.addEventListener("abort", () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
  }) });
  await assert.rejects(slow.client.enroll(randomUUID(), "Person1", audio), { code: "PYANNOTE_TIMEOUT" });
});
