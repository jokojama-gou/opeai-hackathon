import { AsrError, providers, type AudioInput, type Candidate, type IO, type ProviderId, type Segment } from "./direct-asr";
type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj => value && typeof value === "object" && !Array.isArray(value) ? value as Obj : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const str = (value: unknown): string => typeof value === "string" ? value : "";
const required = (value: unknown): string => { if (typeof value !== "string" || !value) throw new AsrError("invalid_response"); return value; };
const num = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
export async function request(io: IO, url: string, init: RequestInit = {}): Promise<Response> {
  if (io.signal.aborted) throw new AsrError("cancelled");
  const response = await io.fetch(url, { ...init, signal: io.signal });
  if (!response.ok) throw new AsrError(`http_${response.status}`);
  return response;
}
export async function json(io: IO, url: string, init: RequestInit = {}): Promise<Obj> {
  const response = await request(io, url, init);
  try {
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return obj(value);
  } catch { throw new AsrError("invalid_response"); }
}
const post = (key: string, body: unknown): RequestInit => ({ method: "POST", headers: {
  Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
function form(input: AudioInput, fields: Record<string, string>, name = "file") {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  body.append(name, input.blob, input.name);
  return body;
}
function segment(id: string, index: number, text: unknown, start: unknown, end: unknown, speaker: unknown, duration: number, scale = 1000): Segment {
  const s = num(start), e = num(end);
  const valid = s !== null && e !== null && s >= 0 && e >= s && Math.round(e * scale) <= duration;
  return { id: `${id}:${index}`, text: str(text), startMs: valid ? Math.round(s * scale) : null,
    endMs: valid ? Math.round(e * scale) : null,
    speaker: typeof speaker === "string" || typeof speaker === "number" ? String(speaker) : null };
}
export function normalize(id: ProviderId, raw: Obj, input: AudioInput): Pick<Candidate, "text" | "segments" | "raw"> {
  const prefix = `${input.recordingId}:${id}`;
  let text: string;
  let segments: Segment[] = [];
  const seg = (i: number, t: unknown, s: unknown, e: unknown, p: unknown, scale = 1000) => segment(prefix, i, t, s, e, p, input.durationMs, scale);
  if (id === "openai" || id === "openai-diarize") {
    if (typeof raw.text !== "string") throw new AsrError("invalid_response");
    text = raw.text;
    segments = list(raw.segments).map((v, i) => { const s = obj(v); return seg(i, s.text, s.start, s.end, s.speaker); });
  } else if (id === "elevenlabs") {
    if (typeof raw.text !== "string") throw new AsrError("invalid_response");
    text = raw.text;
    segments = list(raw.words).filter(v => obj(v).type === "word").map((v, i) => { const s = obj(v); return seg(i, s.text, s.start, s.end, s.speaker_id); });
  } else if (id === "deepgram") {
    const channel = obj(list(obj(raw.results).channels)[0]);
    const alt = obj(list(channel.alternatives)[0]);
    if (typeof alt.transcript !== "string") throw new AsrError("invalid_response");
    text = alt.transcript;
    segments = list(alt.words).map((v, i) => { const s = obj(v); return seg(i, s.punctuated_word ?? s.word, s.start, s.end, s.speaker); });
  } else if (id === "assemblyai") {
    if (typeof raw.text !== "string" && raw.text !== null) throw new AsrError("invalid_response");
    text = str(raw.text);
    segments = list(raw.utterances).map((v, i) => { const s = obj(v); return seg(i, s.text, s.start, s.end, s.speaker, 1); });
  } else if (id === "speechmatics") {
    if (!Array.isArray(raw.results)) throw new AsrError("invalid_response");
    const words = raw.results.filter(v => ["word", "punctuation"].includes(str(obj(v).type)));
    segments = words.map((v, i) => { const s = obj(v), a = obj(list(s.alternatives)[0]); return seg(i, a.content, s.start_time, s.end_time, a.speaker === "UU" ? null : a.speaker); });
    text = segments.map(s => s.text).join("");
  } else if (id === "pyannote") {
    if (!Array.isArray(raw.diarization)) throw new AsrError("invalid_response");
    text = "";
    segments = raw.diarization.map((v, i) => { const s = obj(v); return seg(i, "", s.start, s.end, s.speaker); });
  } else {
    if (raw.status !== "completed") throw new AsrError("model_incomplete");
    // Current Interactions responses use steps/model_output; older responses use outputs.
    const blocks = Array.isArray(raw.steps)
      ? raw.steps.filter(v => obj(v).type === "model_output").flatMap(v => list(obj(v).content))
      : list(raw.outputs);
    const texts = blocks.filter(v => obj(v).type === "text");
    if (!texts.length && blocks.length) throw new AsrError("invalid_response");
    text = texts.map(v => str(obj(v).text)).join("\n");
    // Preserve the provider's complete response. Never guess timing from another ASR.
  }
  if (!segments.length && text) segments = [seg(0, text, null, null, null)];
  return { text, segments, raw };
}
export async function transcribe(id: ProviderId, input: AudioInput, key: string, io: IO) {
  const model = providers.find(p => p.id === id)!.model;
  let raw: Obj;
  if (id === "openai" || id === "openai-diarize") {
    const fields: Record<string, string> = { model, response_format: id === "openai-diarize" ? "diarized_json" : "json" };
    if (id === "openai-diarize") fields.chunking_strategy = "auto";
    raw = await json(io, "https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form(input, fields) });
  } else if (id === "elevenlabs") {
    raw = await json(io, "https://api.elevenlabs.io/v1/speech-to-text", { method: "POST",
      headers: { "xi-api-key": key }, body: form(input, { model_id: model, language_code: "ja",
        diarize: "true", timestamps_granularity: "word", no_verbatim: "false", tag_audio_events: "false" }) });
  } else if (id === "deepgram") {
    raw = await json(io, "https://api.deepgram.com/v1/listen?model=nova-3&language=ja&diarize_model=v2&punctuate=true&smart_format=false", {
      method: "POST", headers: { Authorization: `Token ${key}`, "Content-Type": input.mimeType }, body: input.blob });
  } else if (id === "gemini") {
    const host = "https://generativelanguage.googleapis.com";
    const upload = await request(io, `${host}/upload/v1beta/files`, { method: "POST", headers: {
      "x-goog-api-key": key, "Content-Type": "application/json", "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start", "X-Goog-Upload-Header-Content-Length": String(input.blob.size),
      "X-Goog-Upload-Header-Content-Type": input.mimeType,
    }, body: JSON.stringify({ file: { display_name: input.recordingId } }) });
    const uploadUrl = new URL(required(upload.headers.get("x-goog-upload-url")));
    if (uploadUrl.protocol !== "https:" || uploadUrl.hostname !== "generativelanguage.googleapis.com") throw new AsrError("invalid_response");
    let file = obj((await json(io, uploadUrl.href, { method: "POST", headers: {
      "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize", "Content-Type": input.mimeType,
    }, body: input.blob })).file);
    const name = required(file.name);
    if (!/^files\/[a-zA-Z0-9_-]+$/.test(name)) throw new AsrError("invalid_response");
    await io.job(name);
    try {
      while (file.state === "PROCESSING") {
        await io.sleep(1500, io.signal);
        file = await json(io, `${host}/v1beta/${name}`, { headers: { "x-goog-api-key": key } });
      }
      if (file.state === "FAILED") throw new AsrError("job_failed");
      raw = await json(io, `${host}/v1beta/interactions`, { method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ model,
          store: false, input: [{ type: "audio", mime_type: input.mimeType, uri: required(file.uri) }],
          generation_config: { transcription_config: { language_codes: ["ja"], mode: { type: "verbatim" } } } }) });
    } finally {
      // Only our newly uploaded file. A failed cleanup is retained as metadata, not a successful deletion claim.
      try { await request(io, `${host}/v1beta/${name}`, { method: "DELETE", headers: { "x-goog-api-key": key } }); }
      catch { /* Provider retention applies if cancellation/network loss prevents cleanup. */ }
    }
  } else if (id === "assemblyai") {
    const base = "https://api.assemblyai.com/v2";
    const upload = await json(io, `${base}/upload`, { method: "POST", headers: { authorization: key, "Content-Type": "application/octet-stream" }, body: input.blob });
    const submitted = await json(io, `${base}/transcript`, { method: "POST", headers: { authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify({ audio_url: required(upload.upload_url), speech_models: [model], language_code: "ja", speaker_labels: true }) });
    const job = required(submitted.id); await io.job(job);
    for (;;) {
      raw = await json(io, `${base}/transcript/${encodeURIComponent(job)}`, { headers: { authorization: key } });
      if (raw.status === "completed") break;
      if (raw.status === "error") throw new AsrError("job_failed");
      if (!["queued", "processing"].includes(str(raw.status))) throw new AsrError("invalid_response");
      await io.sleep(1500, io.signal);
    }
  } else if (id === "speechmatics") {
    const base = "https://eu1.asr.api.speechmatics.com/v2/jobs";
    const headers = { Authorization: `Bearer ${key}` };
    const config = JSON.stringify({ type: "transcription", transcription_config: { language: "ja", operating_point: "enhanced", diarization: "speaker" } });
    const submitted = await json(io, base, { method: "POST", headers, body: form(input, { config }, "data_file") });
    const job = required(submitted.id); await io.job(job);
    for (;;) {
      const state = obj((await json(io, `${base}/${encodeURIComponent(job)}`, { headers })).job);
      if (state.status === "done") break;
      if (state.status === "rejected" || state.status === "deleted") throw new AsrError("job_failed");
      if (!["running", "created"].includes(str(state.status))) throw new AsrError("invalid_response");
      await io.sleep(1500, io.signal);
    }
    raw = await json(io, `${base}/${encodeURIComponent(job)}/transcript?format=json-v2`, { headers });
  } else {
    const base = "https://api.pyannote.ai/v1/";
    const media = `media://asr-${input.recordingId}-${io.now()}`;
    const upload = await json(io, `${base}media/input`, post(key, { url: media }));
    const target = new URL(required(upload.url));
    if (target.protocol !== "https:" || target.username || target.password) throw new AsrError("invalid_response");
    await request(io, target.href, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: input.blob });
    const submitted = await json(io, `${base}diarize`, post(key, { url: media, model }));
    const job = required(submitted.jobId); await io.job(job);
    for (;;) {
      const state = await json(io, `${base}jobs/${encodeURIComponent(job)}`, { headers: { Authorization: `Bearer ${key}` } });
      if (state.status === "succeeded") { raw = obj(state.output); break; }
      if (["failed", "canceled"].includes(str(state.status))) throw new AsrError("job_failed");
      if (!["pending", "created", "running"].includes(str(state.status))) throw new AsrError("invalid_response");
      await io.sleep(1500, io.signal);
    }
  }
  return normalize(id, raw, input);
}
