/** Only the previously documented, checksum-pinned computer-synthesized speech fixture is accepted. */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "./configure-direct-asr.mjs";
import { isolateAudio } from "../apps/client/src/data/audio-isolation";
import { AsrError, sleep, type AudioInput } from "../apps/client/src/data/direct-asr";
import { transcribe } from "../apps/client/src/data/asr-providers";

async function main() {
  if (!process.argv.includes("--artificial-only")) throw new Error("artificial_flag_required");
  const bytes = readFileSync(".npm-cache/direct-asr/artificial-speech.wav");
  const checksum = createHash("sha256").update(bytes).digest("hex");
  if (checksum !== "6c8a561757c5b90c82191af25fc6e52f71cebbba9adaf71a0423e8876fb783f1") throw new Error("fixture_mismatch");
  const env = parseEnv(readFileSync("apps/client/.env.local", "utf8"));
  const key = env.EXPO_PUBLIC_ASR_ELEVENLABS_KEY;
  if (!key) throw new Error("no_isolation_key");
  const now = Date.now();
  const input: AudioInput = { recordingId: "artificial-isolation", checksum, durationMs: 7522,
    stoppedAt: new Date(now).toISOString(), audioExpiresAt: new Date(now + 86400000).toISOString(),
    textExpiresAt: new Date(now + 86400000).toISOString(), name: "artificial.wav", mimeType: "audio/wav", blob: new Blob([bytes]) };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55000);
  let stage = "isolation";
  try {
    const cleaned = await isolateAudio(input, key, { signal: controller.signal, fetch,
      digest: async value => createHash("sha256").update(new Uint8Array(value)).digest("hex") });
    mkdirSync(".npm-cache/audio-isolation", { recursive: true });
    const path = `.npm-cache/audio-isolation/${cleaned.name}`;
    writeFileSync(path, new Uint8Array(cleaned.bytes));
    if (createHash("sha256").update(readFileSync(path)).digest("hex") !== cleaned.checksum) throw new Error("saved_checksum_mismatch");
    stage = "transcription";
    const result = await transcribe("elevenlabs", { ...cleaned, blob: new Blob([cleaned.bytes], { type: cleaned.mimeType }) }, key, { signal: controller.signal, fetch, now: Date.now, sleep, job: () => {} });
    const evidence = { at: new Date().toISOString(), input: "checksum-pinned-Windows-synthesized-Japanese-no-human-recording",
      sourceChecksum: checksum, outputChecksum: cleaned.checksum, outputBytes: cleaned.bytes.byteLength, outputMimeType: cleaned.mimeType,
      savedByteMatch: true, elapsedMs: Date.now() - now, transcriptCharacters: result.text.length, segments: result.segments.length,
      isolation: "succeeded", transcription: result.text.trim() ? "succeeded" : "empty", environment: "Node; not real device or quality evaluation" };
    writeFileSync(".npm-cache/audio-isolation/live-result.json", JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence));
    if (!result.text.trim()) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ stage, error: error instanceof AsrError ? error.code : controller.signal.aborted ? "timeout" : "network_or_storage", secretsPrinted: false }));
    process.exitCode = 1;
  } finally { clearTimeout(timer); }
}
main().catch(() => { console.error("Artificial isolation check could not start. No credentials or audio content printed."); process.exitCode = 1; });
