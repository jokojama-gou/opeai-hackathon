import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createSpeakerClient, SpeakerError, SPEAKER_MODEL } from "./pyannote-demo.mjs";
export { SPEAKER_MODEL };

const HOST = "127.0.0.1";
const PORT = 4175;
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
export const MODEL = "gpt-transcribe";

export function loadPyannoteKey() {
  if (process.env.PYANNOTE_API_KEY?.trim()) return process.env.PYANNOTE_API_KEY.trim();
  try {
    const file = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../.env.pyannote.local"), "utf8");
    return file.split(/\r?\n/).find((line) => line.startsWith("PYANNOTE_API_KEY="))?.slice(17).trim() || "";
  } catch { return ""; }
}

function loadApiKey() {
  const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "../.env.openai.local");
  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.startsWith("OPENAI_API_KEY="));

  const apiKey = line?.slice("OPENAI_API_KEY=".length).trim();
  if (!apiKey) {
    throw new Error(".env.openai.local に OPENAI_API_KEY がありません。");
  }
  return apiKey;
}

export const page = String.raw`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>1分 書き起こしデモ</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; }
    body { margin: 0; background: #0b1020; color: #f6f7fb; min-height: 100vh; display: grid; place-items: center; }
    main { width: min(680px, calc(100% - 32px)); background: #151c31; border: 1px solid #2d3858; border-radius: 20px; padding: 28px; box-sizing: border-box; }
    h1 { margin: 0 0 8px; font-size: 26px; }
    p { color: #b8c1d9; line-height: 1.6; }
    button { width: 100%; border: 0; border-radius: 14px; padding: 16px; font-size: 18px; font-weight: 700; background: #72e6b1; color: #07140e; cursor: pointer; }
    button:disabled { cursor: wait; opacity: .55; }
    #status { min-height: 28px; margin: 18px 0 0; color: #dfe7ff; font-weight: 650; }
    #result { margin-top: 18px; display: grid; gap: 10px; }
    .segment { background: #0e1426; border-radius: 12px; padding: 12px 14px; line-height: 1.55; }
    .meta { color: #72e6b1; font-size: 13px; font-weight: 700; margin-bottom: 4px; }
    .error { color: #ff9b9b; white-space: pre-wrap; }
    .full-text { white-space: pre-wrap; overflow-wrap: anywhere; }
    input { box-sizing: border-box; padding: 10px; border-radius: 8px; max-width: 100%; margin: 5px 0 10px; }
    .setup { border: 1px solid #2d3858; border-radius: 12px; padding: 14px; margin-bottom: 20px; }
    .setup button { margin: 5px 0; padding: 10px; font-size: 15px; }
  </style>
</head>
<body>
  <main>
    <h1>1分 書き起こしデモ</h1>
    <p>文字起こし：OpenAI gpt-transcribe ／ 本人照合：pyannoteAI Precision-2。60秒の同じ音声をそれぞれに送ります。全文と話者の時間帯を別々に表示します。</p>
    <div class="setup">
      <label for="voice-name">登録する名前</label><br>
      <input id="voice-name" maxlength="40" placeholder="例：話者1">
      <button id="enroll" disabled>10秒話して声を登録</button>
      <button id="refresh-speaker">キー設定を再確認</button>
      <button id="clear-voices">登録をすべて消す</button>
      <p id="speaker-status" aria-live="polite">pyannoteAIの設定を確認中…</p>
      <label for="threshold">照合しきい値（0〜100）</label>
      <input id="threshold" type="number" min="0" max="100" value="70">
      <p>登録時は1人で10秒、普段の声で話してください。登録はこのページ専用で、再読み込み・サーバー再起動・1時間の未使用で利用できなくなります。しきい値70は試験用の初期値です。一致しても本人と断定する認証ではありません。</p>
      <p>音声・声紋・結果はローカルのファイルに保存しません。pyannoteAI側では送信音声は最大48時間、処理結果は完了後24時間保持されます。</p>
    </div>
    <button id="start" disabled>接続を確認中…</button>
    <div id="status" aria-live="polite">OpenAIへの接続を確認しています</div>
    <div id="result"></div>
  </main>
  <script>
    const startButton = document.querySelector("#start");
    const status = document.querySelector("#status");
    const result = document.querySelector("#result");
    const enrollButton = document.querySelector("#enroll");
    const refreshButton = document.querySelector("#refresh-speaker");
    const clearButton = document.querySelector("#clear-voices");
    const sessionId = crypto.randomUUID();
    let speakerConfigured = false;
    let ready = false;
    let activeStream;

    const preferredTypes = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4"
    ];

    function chooseMimeType() {
      const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error("このブラウザは対応する録音形式を利用できません。ChromeまたはEdgeで開いてください。");
      return mimeType;
    }

    function showError(error) {
      const messages = {
        NotAllowedError: "マイクを使用できません。ブラウザのマイク許可を確認してください。",
        NotFoundError: "マイクが見つかりません。マイクを接続してください。",
        NotReadableError: "マイクを開けません。他の録音アプリを閉じて試してください。",
        TimeoutError: "処理が時間切れになりました。接続を確認して再度試してください。"
      };
      const message = document.createElement("div");
      message.className = "error";
      message.textContent = messages[error?.name] || (error instanceof Error ? error.message : "処理に失敗しました。");
      result.replaceChildren(message);
    }

    async function requestJson(url, options = {}) {
      let response;
      try {
        response = await fetch(url, { ...options, headers: { ...options.headers, "X-Demo-Session": sessionId }, signal: AbortSignal.timeout(330000) });
      } catch (error) {
        if (error.name === "TimeoutError") throw error;
        throw new Error("デモサーバーに接続できません。サーバーを起動して、このページを再読み込みしてください。");
      }
      let data;
      try { data = await response.json(); }
      catch { throw new Error("デモサーバーから正しい応答が返りませんでした（HTTP " + response.status + "）。"); }
      if (!response.ok) throw new Error(data.error + (data.code ? " [" + data.code + "]" : ""));
      return data;
    }

    function showSpeakerStatus(data) {
      speakerConfigured = data.configured;
      enrollButton.disabled = !speakerConfigured;
      document.querySelector("#speaker-status").textContent = data.configured
        ? "キー設定済み（認証は登録時に確認） · 登録：" + (data.labels.join("、") || "まだありません")
        : "pyannoteAIキー待ち · 文字起こしだけ先に試せます";
    }
    async function refreshSpeaker() {
      try { showSpeakerStatus(await requestJson("/speaker-status")); }
      catch (error) { showError(error); }
    }
    refreshButton.addEventListener("click", refreshSpeaker);
    clearButton.addEventListener("click", async () => {
      try { showSpeakerStatus(await requestJson("/voices", { method: "DELETE" })); }
      catch (error) { showError(error); }
    });

    async function checkConnection() {
      ready = false;
      startButton.disabled = true;
      startButton.textContent = "接続を確認中…";
      result.replaceChildren();
      try {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
          throw new Error("このブラウザでは録音できません。ChromeまたはEdgeで開いてください。");
        }
        chooseMimeType();
        await requestJson("/health");
        ready = true;
        status.textContent = "準備完了 · OpenAI接続済み";
      } catch (error) {
        showError(error);
        status.textContent = "接続を確認してください";
      } finally {
        startButton.textContent = ready ? "1分録音を開始" : "接続を再確認";
        startButton.disabled = false;
      }
    }

    function formatTime(seconds) {
      const safe = Number.isFinite(Number(seconds)) ? Number(seconds) : 0;
      const minutes = Math.floor(safe / 60);
      const remainder = (safe % 60).toFixed(1).padStart(4, "0");
      return minutes + ":" + remainder;
    }

    function showTranscript(data) {
      result.replaceChildren();
      const fullText = document.createElement("div");
      fullText.className = "segment full-text";
      const heading = document.createElement("div");
      heading.className = "meta";
      heading.textContent = "全文 · " + (data.models?.transcription || "gpt-transcribe");
      const body = document.createElement("div");
      body.textContent = data.text || "音声を検出できませんでした。";
      fullText.append(heading, body);
      result.append(fullText);
      const segments = Array.isArray(data.segments) ? data.segments : [];
      if (data.speakerError) {
        const warning = document.createElement("div");
        warning.className = "error";
        warning.textContent = "全文の書き起こしは完了しました。話者判定：" + data.speakerError.error;
        result.append(warning);
      }
      for (const segment of segments) {
        const block = document.createElement("div");
        block.className = "segment";
        const meta = document.createElement("div");
        meta.className = "meta";
        meta.textContent = "話者 " + (segment.speaker || "?") + (segment.match === null ? "（未登録／一致なし）" : "") + "  " + formatTime(segment.start) + "–" + formatTime(segment.end);
        block.append(meta);
        result.append(block);
      }
    }

    async function record(enrolling = false) {
      if (!enrolling && !ready) return checkConnection();
      const label = document.querySelector("#voice-name").value.trim();
      if (enrolling && !label) return showError(new Error("登録する名前を入力してください。"));
      const threshold = Number(document.querySelector("#threshold").value);
      if (!enrolling && (!Number.isFinite(threshold) || threshold < 0 || threshold > 100)) return showError(new Error("照合しきい値は0〜100で指定してください。"));
      const seconds = enrolling ? 10 : 60;
      startButton.disabled = true;
      enrollButton.disabled = true;
      refreshButton.disabled = true;
      clearButton.disabled = true;
      result.replaceChildren();
      let stream;
      let timer;
      let stopTimer;
      let recorder;

      try {
        status.textContent = "マイクを準備しています…";
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        activeStream = stream;
        const mimeType = chooseMimeType();
        recorder = new MediaRecorder(stream, { mimeType });
        const chunks = [];

        recorder.addEventListener("dataavailable", (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        });

        const stopped = new Promise((resolve, reject) => {
          recorder.addEventListener("stop", resolve, { once: true });
          recorder.addEventListener("error", () => reject(new Error("録音中にマイクでエラーが発生しました。")), { once: true });
          stream.getAudioTracks().forEach((track) => track.addEventListener("ended", () => {
            reject(new Error("録音中にマイクが切断されました。"));
          }, { once: true }));
        });
        recorder.start(500);
        const deadline = performance.now() + seconds * 1000;
        status.textContent = "録音中… 残り" + seconds + "秒";

        timer = setInterval(() => {
          const remaining = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
          status.textContent = "録音中… 残り" + remaining + "秒";
        }, 200);
        stopTimer = setTimeout(() => {
          if (recorder.state !== "inactive") recorder.stop();
        }, seconds * 1000);

        await stopped;
        clearInterval(timer);
        clearTimeout(stopTimer);
        stream.getTracks().forEach((track) => track.stop());
        stream = undefined;
        activeStream = undefined;
        status.textContent = enrolling ? "pyannoteAIで声を登録中…" : "文字起こし・本人照合を処理中…（最大5分）";

        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (!blob.size) throw new Error("録音データが空です。マイクを確認してください。");
        const data = await requestJson(enrolling ? "/enroll?label=" + encodeURIComponent(label) : "/transcribe", {
          method: "POST",
          headers: { "Content-Type": blob.type || "audio/webm", "X-Match-Threshold": String(threshold) },
          body: blob
        });

        if (enrolling) {
          showSpeakerStatus(data);
          status.textContent = "声の登録が完了しました。1分録音で本人照合を試せます。";
        } else {
          showTranscript(data);
          status.textContent = (data.speakerError ? "全文完了・本人照合は未完了" : "完了") + "（60秒録音）";
        }
      } catch (error) {
        showError(error);
        status.textContent = "失敗";
      } finally {
        clearInterval(timer);
        clearTimeout(stopTimer);
        if (recorder && recorder.state !== "inactive") recorder.stop();
        stream?.getTracks().forEach((track) => track.stop());
        activeStream = undefined;
        startButton.disabled = false;
        enrollButton.disabled = !speakerConfigured;
        refreshButton.disabled = false;
        clearButton.disabled = false;
      }
    }
    startButton.addEventListener("click", () => record(false));
    enrollButton.addEventListener("click", () => record(true));
    window.addEventListener("pagehide", () => activeStream?.getTracks().forEach((track) => track.stop()));
    checkConnection();
    refreshSpeaker();
  </script>
</body>
</html>`;

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

class DemoError extends Error {
  constructor(status, code, message, requestId) {
    super(message);
    Object.assign(this, { status, code, requestId });
  }
}

export function classifyError(error) {
  if (error instanceof DemoError || error instanceof SpeakerError) return error;
  const codes = [error?.code, error?.cause?.code, ...(error?.cause?.errors || []).map((item) => item.code)];
  if (codes.some((code) => ["EACCES", "EPERM"].includes(code))) {
    return new DemoError(502, "NETWORK_BLOCKED", "この実行環境からOpenAIへの通信が拒否されています。デモサーバーを通常のネットワーク権限で起動してください。");
  }
  if (["TimeoutError", "AbortError"].includes(error?.name) || codes.some((code) => ["ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT"].includes(code))) {
    return new DemoError(504, "UPSTREAM_TIMEOUT", "OpenAIへの接続または処理が時間切れになりました。少し待ってから再度試してください。");
  }
  if (codes.some((code) => ["ENOTFOUND", "EAI_AGAIN"].includes(code))) {
    return new DemoError(502, "DNS_ERROR", "OpenAIの接続先を見つけられません。インターネット接続とDNS設定を確認してください。");
  }
  return new DemoError(502, "CONNECTION_ERROR", "OpenAIとの通信に失敗しました。インターネット接続を確認して再度試してください。");
}

async function readAudio(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    const timer = setTimeout(() => finish(new DemoError(408, "UPLOAD_TIMEOUT", "録音データの送信が時間切れになりました。")), 30000);
    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) { chunks.length = 0; reject(error); }
      else resolve(Buffer.concat(chunks));
    }
    request.on("data", (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_AUDIO_BYTES) return finish(new DemoError(413, "AUDIO_TOO_LARGE", "録音データが大きすぎます（上限10MB）。"));
      chunks.push(chunk);
    });
    request.on("end", () => finish());
    request.on("error", () => finish(new DemoError(400, "UPLOAD_ERROR", "録音データを受け取れませんでした。")));
  });
}

async function callOpenAI(apiKey, path, options, fetchImpl, timeoutMs) {
  const response = await fetchImpl("https://api.openai.com/v1/" + path, {
    ...options,
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(timeoutMs)
  });
  let data;
  try { data = await response.json(); }
  catch { throw new DemoError(502, "INVALID_API_RESPONSE", "OpenAIから読み取れる形式の応答が返りませんでした。"); }
  const requestId = response.headers.get("x-request-id")?.match(/^[\w-]{1,100}$/)?.[0];
  if (!response.ok) {
    // Never echo provider error messages: they can contain the key or user input.
    const code = data?.error?.code;
    const [publicCode, message] = response.status === 401
      ? ["AUTH_ERROR", "APIキーが認証されませんでした。保存したキーの有効性を確認してください。"]
      : response.status === 403 || response.status === 404
        ? ["MODEL_ACCESS_ERROR", "このキーでは書き起こしモデルを利用できません。プロジェクトとキーの権限を確認してください。"]
        : response.status === 429 && ["insufficient_quota", "billing_hard_limit_reached"].includes(code)
          ? ["INSUFFICIENT_QUOTA", "OpenAI APIの残高または利用上限が不足しています。OpenAIのBillingで残高と上限を確認してください。"]
          : response.status === 429
            ? ["RATE_LIMIT", "OpenAIの利用頻度制限に達しました。少し待ってから再度試してください。"]
            : response.status === 400 || response.status === 413 || response.status === 422
              ? ["INVALID_AUDIO", "OpenAIが録音データを受け付けませんでした。もう一度録音してください。"]
              : ["OPENAI_ERROR", "OpenAI側でエラーが発生しました。少し待ってから再度試してください。"];
    throw new DemoError(response.status, publicCode, message, requestId);
  }
  return data;
}

export function createDemoServer({ apiKey, fetchImpl = fetch, timeoutMs = 90000, speakerClient = createSpeakerClient(), diagnostic = (entry) => console.log(JSON.stringify(entry)) }) {
  return createServer(async (request, response) => {
  const origin = `http://${request.headers.host}`;
  const port = request.socket.localPort;
  if (![`${HOST}:${port}`, `localhost:${port}`].includes(request.headers.host)
      || (request.headers.origin && request.headers.origin !== origin)) {
    request.resume();
    sendJson(response, 403, { error: "このページからのアクセスは許可されていません。", code: "INVALID_ORIGIN" });
    return;
  }

  const sessionId = request.headers["x-demo-session"];
  if ((request.method === "GET" && request.url === "/speaker-status") || (request.method === "DELETE" && request.url === "/voices")) {
    try { sendJson(response, 200, request.method === "DELETE" ? speakerClient.clear(sessionId) : speakerClient.status(sessionId)); }
    catch (error) { const failure = classifyError(error); sendJson(response, failure.status, { error: failure.message, code: failure.code }); }
    return;
  }
  if (request.method === "GET" && request.url === "/") {
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; media-src 'none'; object-src 'none'; base-uri 'none'"
    });
    response.end(page);
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    try {
      await callOpenAI(apiKey, `models/${MODEL}`, { method: "GET" }, fetchImpl, Math.min(timeoutMs, 15000));
      sendJson(response, 200, { ok: true, model: MODEL });
    } catch (error) {
      const failure = classifyError(error);
      diagnostic({ stage: "connection", status: failure.status, code: failure.code, requestId: failure.requestId });
      sendJson(response, failure.status, { error: failure.message, code: failure.code, requestId: failure.requestId });
    }
    return;
  }

  const enrolling = request.url.startsWith("/enroll?");
  if (request.method !== "POST" || (request.url !== "/transcribe" && !enrolling)) {
    sendJson(response, 404, { error: "ページが見つかりません。" });
    return;
  }

  try {
    const contentType = (request.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
    const extensions = { "audio/webm": "webm", "audio/mp4": "m4a", "audio/wav": "wav", "audio/x-wav": "wav" };
    const extension = extensions[contentType];
    if (!extension) {
      request.resume();
      throw new DemoError(415, "UNSUPPORTED_AUDIO", "この録音形式は対応していません。ChromeまたはEdgeで録音してください。");
    }
    if (Number(request.headers["content-length"]) > MAX_AUDIO_BYTES) {
      request.resume();
      throw new DemoError(413, "AUDIO_TOO_LARGE", "録音データが大きすぎます（上限10MB）。");
    }
    const audio = await readAudio(request);
    if (!audio.length) {
      throw new DemoError(400, "EMPTY_AUDIO", "録音データが空です。マイクを確認してください。");
    }

    if (enrolling) {
      const label = new URL(request.url, origin).searchParams.get("label");
      sendJson(response, 200, await speakerClient.enroll(sessionId, label, audio));
      return;
    }

    const started = Date.now();
    const makeForm = () => {
      const form = new FormData();
      form.append("file", new Blob([audio], { type: contentType }), `demo.${extension}`);
      form.append("model", MODEL);
      form.append("languages[]", "ja");
      return form;
    };
    // Send the same recording bytes to each specialist; never rewrite the ASR text.
    const [transcription, speakerResult] = await Promise.allSettled([
      callOpenAI(apiKey, "audio/transcriptions", { method: "POST", body: makeForm() }, fetchImpl, timeoutMs),
      speakerClient.identify(sessionId, audio, Number(request.headers["x-match-threshold"] ?? 70))
    ]);
    if (transcription.status === "rejected") throw transcription.reason;
    if (typeof transcription.value?.text !== "string") {
      throw new DemoError(502, "INVALID_API_RESPONSE", "OpenAIから書き起こし結果を取得できませんでした。");
    }
    const data = { text: transcription.value.text, segments: [], models: { transcription: MODEL, speaker: SPEAKER_MODEL } };
    if (speakerResult.status === "fulfilled" && Array.isArray(speakerResult.value?.segments)) {
      data.segments = speakerResult.value.segments.map(({ start, end, speaker, match }) => ({ start, end, speaker, match }));
    } else {
      const failure = classifyError(speakerResult.status === "rejected" ? speakerResult.reason : new DemoError(502, "INVALID_API_RESPONSE", "話者判定の結果を取得できませんでした。"));
      data.speakerError = { error: failure.message, code: failure.code };
      diagnostic({ stage: "speaker", status: failure.status, code: failure.code });
    }
    diagnostic({ stage: "transcription", status: 200, elapsedMs: Date.now() - started, segmentCount: data.segments.length });
    sendJson(response, 200, data);
  } catch (error) {
    const failure = classifyError(error);
    diagnostic({ stage: "transcription", status: failure.status, code: failure.code, requestId: failure.requestId });
    sendJson(response, failure.status, { error: failure.message, code: failure.code, requestId: failure.requestId });
  }
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const server = createDemoServer({ apiKey: loadApiKey(), speakerClient: createSpeakerClient({ getApiKey: loadPyannoteKey }) });
  server.on("error", (error) => {
    console.error(error.code === "EADDRINUSE" ? "ポート4175は使用中です。前のデモを終了してください。" : "デモサーバーを起動できませんでした。");
    process.exitCode = 1;
  });
  server.listen(PORT, HOST, () => {
    console.log(`1分書き起こしデモ: http://${HOST}:${PORT}`);
    console.log("終了するには Ctrl+C を押してください。");
  });
}
