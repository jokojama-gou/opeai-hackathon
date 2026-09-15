import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

export const SPEAKER_MODEL = "precision-2";
export class SpeakerError extends Error {
  constructor(status, code, message) { super(message); Object.assign(this, { status, code }); }
}
const invalid = () => new SpeakerError(502, "PYANNOTE_RESPONSE", "pyannoteAIの応答形式を確認できませんでした。");

// Voiceprints never leave this server except when submitted to pyannoteAI.
export function createSpeakerClient({ getApiKey = () => "", fetchImpl = fetch, timeoutMs = 300000, pollMs = 1500, now = Date.now } = {}) {
  const sessions = new Map();
  function session(id, create = false) {
    for (const [key, value] of sessions) if (now() - value.touched > 3600000) sessions.delete(key);
    if (!/^[a-f0-9-]{36}$/i.test(id || "")) {
      if (create) throw new SpeakerError(400, "SESSION_REQUIRED", "ページを再読み込みしてください。");
      return undefined;
    }
    if (!sessions.has(id) && create) {
      if (sessions.size >= 16) throw new SpeakerError(429, "SESSION_LIMIT", "デモの登録枠が一杯です。サーバーを再起動してください。");
      sessions.set(id, { profiles: new Map(), touched: now(), busy: false });
    }
    const value = sessions.get(id);
    if (value) value.touched = now();
    return value;
  }
  function status(id) { return { configured: Boolean(getApiKey()), labels: [...(session(id)?.profiles.keys() || [])], model: SPEAKER_MODEL }; }
  async function job(audio, kind, extra = {}) {
    const key = getApiKey();
    if (!key) throw new SpeakerError(503, "PYANNOTE_KEY_MISSING", "pyannoteAIのAPIキーが未設定です。文字起こしだけ利用できます。");
    const signal = AbortSignal.timeout(timeoutMs);
    async function api(path, body) {
      const response = await fetchImpl("https://api.pyannote.ai/v1/" + path, {
        method: body ? "POST" : "GET", redirect: "error", signal,
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      if (!response.ok) {
        const messages = { 401: "APIキーが認証されませんでした。", 403: "このキーの権限を確認してください。", 402: "クレジットまたは契約を確認してください。", 429: "利用頻度の上限です。時間を置いて試してください。", 400: "音声またはリクエストが受け付けられませんでした。" };
        throw new SpeakerError(response.status, "PYANNOTE_HTTP_" + response.status, "pyannoteAI：" + (messages[response.status] || "処理に失敗しました。"));
      }
      try { return await response.json(); } catch { throw invalid(); }
    }
    try {
      const media = "media://demo-" + randomUUID();
      const upload = await api("media/input", { url: media });
      let target;
      try { target = new URL(upload.url); } catch { throw invalid(); }
      if (target.protocol !== "https:" || target.username || target.password) throw invalid();
      // The presigned storage request must never receive the API bearer token.
      const put = await fetchImpl(target.href, { method: "PUT", redirect: "error", signal, headers: { "Content-Type": "application/octet-stream" }, body: audio });
      if (!put.ok) throw new SpeakerError(502, "PYANNOTE_UPLOAD", "pyannoteAIへの音声送信に失敗しました。");
      const submitted = await api(kind, { url: media, model: SPEAKER_MODEL, ...extra });
      if (typeof submitted.jobId !== "string" || !/^[\w-]{1,100}$/.test(submitted.jobId)) throw invalid();
      while (true) {
        signal.throwIfAborted();
        const result = await api("jobs/" + submitted.jobId);
        if (result.status === "succeeded") {
          if (!result.output || result.output.error) throw invalid();
          return result.output;
        }
        if (["failed", "canceled"].includes(result.status)) throw new SpeakerError(502, "PYANNOTE_JOB_FAILED", "pyannoteAIの音声処理が完了しませんでした。登録音声は1人で明瞭に話してください。");
        if (!["pending", "created", "running"].includes(result.status)) throw invalid();
        await delay(pollMs, undefined, { signal });
      }
    } catch (error) {
      if (error instanceof SpeakerError) throw error;
      if (signal.aborted) throw new SpeakerError(504, "PYANNOTE_TIMEOUT", "pyannoteAIの処理が時間切れです。少し待って再度試してください。");
      throw new SpeakerError(502, "PYANNOTE_NETWORK", "pyannoteAIに接続できません。ネットワークを確認してください。");
    }
  }
  return {
    status,
    clear(id) {
      const value = session(id);
      if (value?.busy) throw new SpeakerError(409, "ENROLL_BUSY", "声の登録が終わるまでお待ちください。");
      sessions.delete(id);
      return status(id);
    },
    async enroll(id, label, audio) {
      if (typeof label !== "string" || !label.trim() || label.length > 40 || /[\u0000-\u001f]/.test(label)) throw new SpeakerError(400, "INVALID_LABEL", "名前は1〜40文字で入力してください。");
      label = label.trim();
      const value = session(id, true);
      if (value.busy) throw new SpeakerError(409, "ENROLL_BUSY", "声の登録が終わるまでお待ちください。");
      if (value.profiles.has(label)) throw new SpeakerError(409, "DUPLICATE_LABEL", "同じ名前は登録済みです。別の名前にするか登録を消してください。");
      if (value.profiles.size >= 4) throw new SpeakerError(400, "PROFILE_LIMIT", "このデモでは4人まで登録できます。");
      value.busy = true;
      try {
        const output = await job(audio, "voiceprint");
        if (typeof output.voiceprint !== "string" || !output.voiceprint) throw invalid();
        value.profiles.set(label, output.voiceprint);
        return status(id);
      } finally { value.busy = false; }
    },
    async identify(id, audio, threshold = 70) {
      if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) throw new SpeakerError(400, "INVALID_THRESHOLD", "照合しきい値は0〜100で指定してください。");
      if (!getApiKey()) throw new SpeakerError(503, "PYANNOTE_KEY_MISSING", "pyannoteAIのAPIキーが未設定です。");
      const profiles = session(id)?.profiles;
      if (!profiles?.size) throw new SpeakerError(409, "NO_VOICEPRINTS", "本人照合には先に声を登録してください。");
      const voiceprints = [...profiles].map(([label, voiceprint]) => ({ label, voiceprint }));
      const output = await job(audio, "identify", { voiceprints, matching: { threshold, exclusive: true } });
      if (!Array.isArray(output.identification)) throw invalid();
      const labels = new Set(voiceprints.map(({ label }) => label));
      const segments = output.identification.map(({ start, end, diarizationSpeaker, match }) => {
        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || typeof diarizationSpeaker !== "string") throw invalid();
        if (match != null && !labels.has(match)) throw invalid();
        return { start, end, speaker: match || diarizationSpeaker, match: match || null };
      });
      return { segments, threshold };
    }
  };
}
