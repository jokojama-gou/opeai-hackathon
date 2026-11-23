import { AsrError, assertAudio, type AudioInput } from "./direct-asr";

export type AudioVariant = "original" | "denoised";
export type IsolatedAudio = Omit<AudioInput, "blob"> & { bytes: ArrayBuffer };
export type IsolationState = {
  provider: "elevenlabs"; sourceChecksum: string;
  status: "running" | "ready" | "failed" | "unconfigured" | "result_unknown" | "cancelled";
  error: string | null;
  audio?: { checksum: string; size: number; mimeType: string; name: string; uri?: string };
};
export type IsolationStore = {
  original: () => Promise<AudioInput>;
  state: () => Promise<IsolationState | undefined>;
  mark: (state: IsolationState) => Promise<void>;
  save: (audio: IsolatedAudio, state: IsolationState, valid: () => boolean) => Promise<void>;
  denoised: () => Promise<AudioInput>;
};
export type IsolationOptions = {
  signal: AbortSignal; fetch: typeof fetch;
  digest: (bytes: ArrayBuffer) => Promise<string>;
  now?: () => number; timeoutMs?: number; retry?: boolean;
};

// Check the returned media bytes, rather than saving JSON/HTML with an audio suffix.
export function isolatedFormat(bytes: Uint8Array): { mimeType: string; extension: string } {
  const ascii = (offset: number, length: number) => String.fromCharCode(...bytes.slice(offset, offset + length));
  if (bytes.length < 12) throw new AsrError("invalid_isolated_audio");
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE") return { mimeType: "audio/wav", extension: "wav" };
  if (ascii(0, 3) === "ID3" || (bytes[0] === 255 && (bytes[1] & 0xe0) === 0xe0 && (bytes[1] & 6) !== 0))
    return { mimeType: "audio/mpeg", extension: "mp3" };
  if (ascii(0, 4) === "fLaC") return { mimeType: "audio/flac", extension: "flac" };
  if (ascii(0, 4) === "OggS") return { mimeType: "audio/ogg", extension: "ogg" };
  if (ascii(4, 4) === "ftyp") return { mimeType: "audio/mp4", extension: "m4a" };
  throw new AsrError("invalid_isolated_audio");
}

export async function isolateAudio(input: AudioInput, key: string, options: IsolationOptions): Promise<IsolatedAudio> {
  const now = options.now ?? Date.now;
  assertAudio(input, now());
  if (!key.trim()) throw new AsrError("no_isolation_key");
  if (options.signal.aborted) throw new AsrError("cancelled");
  const form = new FormData(); form.append("audio", input.blob, input.name);
  const response = await options.fetch("https://api.elevenlabs.io/v1/audio-isolation", {
    method: "POST", headers: { "xi-api-key": key.trim() }, body: form, signal: options.signal,
  });
  if (!response.ok) throw new AsrError(`http_${response.status}`);
  if (Number(response.headers.get("content-length")) > 25_000_000) throw new AsrError("audio_size_limit");
  // RN's built-in Blob cannot be constructed from bytes or read with arrayBuffer().
  // Keep binary bytes until the platform commits them as an Expo File / IndexedDB Blob.
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 25_000_000) throw new AsrError("audio_size_limit");
  const format = isolatedFormat(new Uint8Array(bytes));
  const checksum = await options.digest(bytes);
  if (options.signal.aborted) throw new AsrError("cancelled");
  assertAudio(input, now());
  const { blob: _originalBlob, ...metadata } = input;
  return { ...metadata, checksum, mimeType: format.mimeType, audioVariant: "denoised",
    name: `${input.recordingId}-denoised.${format.extension}`, bytes };
}

const active = new Set<string>();
/** Durable recording first; cleaned media must be saved before a later ASR can use it. */
export async function prepareDenoisedAudio(store: IsolationStore, key: string, options: IsolationOptions): Promise<AudioInput> {
  const input = await store.original();
  assertAudio(input, (options.now ?? Date.now)());
  if (active.has(input.recordingId)) throw new AsrError("already_running");
  active.add(input.recordingId);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal.addEventListener("abort", abort, { once: true });
  if (options.signal.aborted) controller.abort();
  let timedOut = false;
  let journaled = false;
  let saving = false;
  const state: IsolationState = { provider: "elevenlabs", sourceChecksum: input.checksum, status: "running", error: null };
  try {
    if (controller.signal.aborted) throw new AsrError("cancelled");
    const previous = await store.state();
    if (previous?.sourceChecksum === input.checksum && previous.status === "ready") return await store.denoised();
    if (previous && !options.retry) throw new AsrError("isolation_retry_required");
    if (!key.trim()) {
      await store.mark({ ...state, status: "unconfigured", error: "no_isolation_key" });
      throw new AsrError("no_isolation_key");
    }
    await store.mark(state); journaled = true;
    timer = setTimeout(() => { timedOut = true; controller.abort(); }, options.timeoutMs ?? 180000);
    const audio = await isolateAudio(input, key, { ...options, signal: controller.signal });
    if (controller.signal.aborted) throw new AsrError("cancelled");
    saving = true;
    await store.save(audio, { ...state, status: "ready", audio: {
      checksum: audio.checksum, size: audio.bytes.byteLength, mimeType: audio.mimeType, name: audio.name,
    } }, () => !controller.signal.aborted);
    return await store.denoised();
  } catch (error) {
    if (journaled) {
      const code = timedOut ? "timeout_no_auto_retry" : controller.signal.aborted ? "cancelled"
        : error instanceof AsrError ? error.code : saving ? "isolated_save_failed" : "network_or_cors";
      await store.mark({ ...state, status: timedOut || code === "network_or_cors" ? "result_unknown"
        : controller.signal.aborted ? "cancelled" : "failed", error: code }).catch(() => {});
      if (code === "isolated_save_failed") throw new AsrError(code);
    }
    throw timedOut ? new AsrError("timeout_no_auto_retry") : error;
  } finally {
    clearTimeout(timer); options.signal.removeEventListener("abort", abort); active.delete(input.recordingId);
  }
}
