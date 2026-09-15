import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import { createContext, runInContext } from "node:vm";
import { randomUUID } from "node:crypto";
import { SpeakerError } from "./pyannote-demo.mjs";
import { createDemoServer, page, MODEL, SPEAKER_MODEL } from "./transcribe-20s-demo.mjs";

const secret = "test-only-secret-never-display";
const transcript = { text: "人工テスト", duration: 60, segments: [{ speaker: "A", start: 0, end: 2, text: "人工テスト" }] };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
let nextTestPort = 49175;

async function withServer(fetchImpl, check, timeoutMs, speakerClient = { identify: async () => transcript }) {
  const logs = [];
  const server = createDemoServer({ apiKey: secret, fetchImpl, timeoutMs, speakerClient, diagnostic: (entry) => logs.push(entry) });
  // Windows may allocate a low ephemeral port that fetch blocks (e.g. 6000).
  server.listen(nextTestPort++, "127.0.0.1");
  await once(server, "listening");
  try { await check(`http://127.0.0.1:${server.address().port}`, logs); }
  finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
}

test("page and preflight do not expose the key", async () => {
  await withServer(async (url, options) => {
    assert.equal(url, `https://api.openai.com/v1/models/${MODEL}`);
    assert.equal(options.headers.Authorization, `Bearer ${secret}`);
    return json({ id: MODEL });
  }, async (url) => {
    const html = await fetch(url);
    assert.equal(html.headers.get("cache-control"), "no-store");
    assert.ok(!(await html.text()).includes(secret));
    assert.deepEqual(await (await fetch(url + "/health")).json(), { ok: true, model: MODEL });
  });
});

test("identical audio reaches separate transcription and speaker models", async (t) => {
  for (const [mime, filename] of [["audio/webm;codecs=opus", "demo.webm"], ["audio/mp4", "demo.m4a"], ["audio/wav", "demo.wav"]]) {
    const calls = [];
    await t.test(mime, async () => withServer(async (url, options) => {
      assert.equal(url, "https://api.openai.com/v1/audio/transcriptions");
      assert.equal(options.body.get("file").name, filename);
      assert.equal(await options.body.get("file").text(), "synthetic bytes");
      assert.equal(options.body.get("model"), MODEL);
      calls.push(MODEL);
        assert.equal(options.body.get("languages[]"), "ja");
        assert.equal(options.body.get("language"), null);
        assert.equal(options.body.get("response_format"), null);
      return json(transcript);
    }, async (url, logs) => {
      const response = await fetch(url + "/transcribe", { method: "POST", headers: { "Content-Type": mime }, body: "synthetic bytes" });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { text: transcript.text, segments: [{ speaker: "A", start: 0, end: 2 }], models: { transcription: MODEL, speaker: SPEAKER_MODEL } });
      assert.deepEqual(calls.sort(), [MODEL, SPEAKER_MODEL].sort());
      assert.ok(!JSON.stringify(logs).includes(secret));
      assert.ok(!JSON.stringify(logs).includes(transcript.text));
    }, undefined, { identify: async (_session, audio, threshold) => {
      assert.equal(audio.toString(), "synthetic bytes");
      assert.equal(threshold, 70);
      calls.push(SPEAKER_MODEL);
      return transcript;
    } }));
  }
});

test("ASR text stays exact even when speaker text differs or speaker processing fails", async () => {
  for (const failSpeaker of [false, true]) {
    const models = [];
    const exactText = "全文の先頭。\n\n全文の末尾。";
    await withServer(async (_url, { body }) => {
      const model = body.get("model");
      models.push(model);
      return json({ text: exactText });
    }, async (url) => {
      const response = await fetch(url + "/transcribe", { method: "POST", headers: { "Content-Type": "audio/wav" }, body: "synthetic bytes" });
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.text, exactText);
      assert.deepEqual(models.sort(), [MODEL, SPEAKER_MODEL].sort());
      assert.ok(result.segments.every((segment) => !("text" in segment)));
      assert.equal(Boolean(result.speakerError), failSpeaker);
      assert.ok(!JSON.stringify(result).includes(secret));
    }, undefined, { identify: async () => {
      models.push(SPEAKER_MODEL);
      if (failSpeaker) throw new SpeakerError(502, "PYANNOTE_JOB_FAILED", "本人照合に失敗しました。");
      return { ...transcript, text: "別の文章" };
    } });
  }
});

test("bad input and other origins never call OpenAI", async (t) => {
  await withServer(() => { throw new Error("Unexpected API call"); }, async (url) => {
    const cases = [
      ["empty audio", { "Content-Type": "audio/webm" }, "", 400, "EMPTY_AUDIO"],
      ["unsupported format", { "Content-Type": "text/plain" }, "x", 415, "UNSUPPORTED_AUDIO"],
      ["oversize", { "Content-Type": "audio/webm" }, Buffer.alloc(10 * 1024 * 1024 + 1), 413, "AUDIO_TOO_LARGE"],
      ["other origin", { "Content-Type": "audio/webm", Origin: "https://example.com" }, "x", 403, "INVALID_ORIGIN"]
    ];
    for (const [name, headers, body, status, code] of cases) await t.test(name, async () => {
      const response = await fetch(url + "/transcribe", { method: "POST", headers, body });
      assert.equal(response.status, status);
      assert.equal((await response.json()).code, code);
    });
    // fetch normalizes Host; use raw HTTP to actually exercise DNS-rebinding protection.
    await t.test("untrusted host", async () => {
      const status = await new Promise((resolve, reject) => {
        const request = httpRequest(url + "/health", { headers: { Host: "example.com" } }, (response) => {
          response.resume();
          response.on("end", () => resolve(response.statusCode));
        });
        request.on("error", reject);
        request.end();
      });
      assert.equal(status, 403);
    });
  });
});

test("network failures and provider failures are classified without leaking bodies", async (t) => {
  const cases = [
    ["permission denied", () => { throw new TypeError("fetch failed", { cause: { code: "EACCES" } }); }, 502, "NETWORK_BLOCKED"],
    ["DNS", () => { throw new TypeError("fetch failed", { cause: { code: "ENOTFOUND" } }); }, 502, "DNS_ERROR"],
    ["unauthorized", () => json({ error: { message: secret } }, 401), 401, "AUTH_ERROR"],
    ["model access", () => json({ error: { message: secret } }, 403), 403, "MODEL_ACCESS_ERROR"],
    ["quota", () => json({ error: { code: "insufficient_quota", message: secret } }, 429), 429, "INSUFFICIENT_QUOTA"],
    ["rate limit", () => json({ error: { code: "rate_limit_exceeded", message: secret } }, 429), 429, "RATE_LIMIT"],
    ["invalid audio", () => json({ error: { message: secret } }, 400), 400, "INVALID_AUDIO"],
    ["server error", () => json({ error: { message: secret } }, 500), 500, "OPENAI_ERROR"],
    ["non-JSON", () => new Response("<html>" + secret), 502, "INVALID_API_RESPONSE"],
    ["wrong schema", () => json({ value: secret }), 502, "INVALID_API_RESPONSE"],
    ["timeout", (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason))), 504, "UPSTREAM_TIMEOUT"]
  ];
  for (const [name, fakeFetch, status, code] of cases) await t.test(name, async () => withServer(fakeFetch, async (url, logs) => {
    const response = await fetch(url + "/transcribe", { method: "POST", headers: { "Content-Type": "audio/webm" }, body: "synthetic bytes" });
    assert.equal(response.status, status);
    const text = await response.text();
    assert.equal(JSON.parse(text).code, code);
    assert.ok(!text.includes(secret));
    assert.ok(!JSON.stringify(logs).includes(secret));
  }, 20));
});

const flush = () => new Promise((resolve) => setImmediate(resolve));
function browserHarness({ microphoneError, apiFailure, healthFailure, speakerConfigured = false } = {}) {
  const nodes = new Map();
  const element = () => ({ value: "", textContent: "", disabled: true, children: [], events: {}, append(...items) { this.children.push(...items); }, replaceChildren(...items) { this.children = items; }, addEventListener(name, callback) { this.events[name] = callback; } });
  for (const name of ["#start", "#status", "#result", "#enroll", "#refresh-speaker", "#clear-voices", "#voice-name", "#speaker-status", "#threshold"]) nodes.set(name, element());
  nodes.get("#threshold").value = "70";
  nodes.get("#voice-name").value = "Test Person";
  const timers = new Map();
  let id = 0, stopped = 0, submitted = 0;
  let currentRecorder;
  class Recorder extends EventTarget {
    static isTypeSupported() { return true; }
    constructor(_stream, { mimeType }) { super(); this.mimeType = mimeType; this.state = "inactive"; currentRecorder = this; }
    start() { this.state = "recording"; }
    stop() {
      this.state = "inactive";
      const event = new Event("dataavailable");
      event.data = new Blob(["synthetic bytes"]);
      this.dispatchEvent(event);
      this.dispatchEvent(new Event("stop"));
    }
  }
  const track = new EventTarget();
  track.stop = () => { stopped += 1; };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  const context = createContext({
    document: { querySelector: (name) => nodes.get(name), createElement: element },
    window: { addEventListener() {} },
    navigator: { mediaDevices: { getUserMedia: async () => { if (microphoneError) throw microphoneError; return stream; } } },
    MediaRecorder: Recorder, Blob, AbortSignal, Error, crypto: { randomUUID }, performance: { now: () => 0 },
    setInterval: (fn, ms) => { timers.set(++id, { fn, ms, interval: true }); return id; },
    setTimeout: (fn, ms) => { timers.set(++id, { fn, ms }); return id; },
    clearInterval: (key) => timers.delete(key), clearTimeout: (key) => timers.delete(key),
    fetch: async (url) => {
      if (url === "/health") return healthFailure ? json({ error: "通信拒否", code: "NETWORK_BLOCKED" }, 502) : json({ ok: true });
      if (url === "/speaker-status" || url === "/voices") return json({ configured: speakerConfigured, labels: [] });
      submitted += 1;
      if (url.startsWith("/enroll?")) return json({ configured: true, labels: ["Test Person"] });
      return apiFailure ? json({ error: "残高不足", code: "INSUFFICIENT_QUOTA" }, 429) : json(transcript);
    }
  });
  runInContext(page.match(/<script>([\s\S]*)<\/script>/)[1], context);
  return { nodes, timers, click: () => nodes.get("#start").events.click(), counts: () => ({ stopped, submitted }), recorder: () => currentRecorder };
}

test("60-second recorder sends once, stops the mic, renders speaker output and clears timers", async () => {
  const h = browserHarness();
  await flush();
  assert.equal(h.nodes.get("#start").disabled, false);
  assert.match(h.nodes.get("#status").textContent, /OpenAI接続済み/);
  const pending = h.click();
  await flush();
  const stopTimer = [...h.timers.values()].find((timer) => timer.ms === 60000 && !timer.interval);
  assert.ok(stopTimer);
  stopTimer.fn();
  await pending;
  assert.deepEqual(h.counts(), { stopped: 1, submitted: 1 });
  assert.equal(h.timers.size, 0);
  assert.match(h.nodes.get("#status").textContent, /完了/);
  assert.match(h.nodes.get("#result").children[1].children[0].textContent, /話者 A/);
  assert.equal(h.nodes.get("#result").children[0].children[1].textContent, transcript.text);
});

test("failed preflight offers recheck and does not start a recording", async () => {
  const h = browserHarness({ healthFailure: true });
  await flush();
  assert.equal(h.nodes.get("#start").textContent, "接続を再確認");
  assert.match(h.nodes.get("#result").children[0].textContent, /NETWORK_BLOCKED/);
  await h.click();
  assert.equal(h.recorder(), undefined);
  assert.equal(h.counts().submitted, 0);
});

test("10-second enrollment stops microphone and enables the 60-second test afterwards", async () => {
  const h = browserHarness({ speakerConfigured: true });
  await flush();
  assert.equal(h.nodes.get("#enroll").disabled, false);
  const pending = h.nodes.get("#enroll").events.click();
  await flush();
  assert.equal(h.nodes.get("#start").disabled, true);
  [...h.timers.values()].find((timer) => timer.ms === 10000).fn();
  await pending;
  assert.deepEqual(h.counts(), { stopped: 1, submitted: 1 });
  assert.match(h.nodes.get("#speaker-status").textContent, /Test Person/);
  assert.match(h.nodes.get("#status").textContent, /登録が完了/);
  assert.equal(h.nodes.get("#start").disabled, false);
  assert.equal(h.timers.size, 0);
});

test("microphone denial and recorder errors release the UI and do not submit", async () => {
  for (const denial of [true, false]) {
    const h = browserHarness({ microphoneError: denial ? Object.assign(new Error("denied"), { name: "NotAllowedError" }) : null });
    await flush();
    const pending = h.click();
    await flush();
    if (!denial) h.recorder().dispatchEvent(new Event("error"));
    await pending;
    assert.equal(h.nodes.get("#start").disabled, false);
    assert.equal(h.counts().submitted, 0);
    assert.equal(h.timers.size, 0);
    assert.equal(h.nodes.get("#status").textContent, "失敗");
  }
});

test("API failure stays visible after recording instead of a stuck countdown", async () => {
  const h = browserHarness({ apiFailure: true });
  await flush();
  const pending = h.click();
  await flush();
  [...h.timers.values()].find((timer) => timer.ms === 60000).fn();
  await pending;
  assert.match(h.nodes.get("#result").children[0].textContent, /INSUFFICIENT_QUOTA/);
  assert.equal(h.nodes.get("#start").disabled, false);
  assert.equal(h.timers.size, 0);
});
