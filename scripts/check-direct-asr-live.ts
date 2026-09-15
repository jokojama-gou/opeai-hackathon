/** Explicit live smoke check: fixed computer-synthesized fixture, no microphone or user audio. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseEnv } from "./configure-direct-asr.mjs";
import { runEnsemble, sleep, type AudioInput, type Keys, type ProviderId } from "../apps/client/src/data/direct-asr";
import { transcribe } from "../apps/client/src/data/asr-providers";
import { compareTranscripts } from "../apps/client/src/data/asr-comparison";

async function main() {
if (!process.argv.includes("--artificial-only")) throw new Error("Use --artificial-only. This command sends the fixed artificial fixture to configured providers.");
const speechFixture = process.argv.includes("--speech-fixture");
const bytes = readFileSync(speechFixture ? ".npm-cache/direct-asr/artificial-speech.wav" : ".npm-cache/direct-asr/artificial.wav");
if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE") throw new Error("Expected artificial WAV.");
let byteRate = 0, dataSize = 0;
for (let offset = 12; offset + 8 <= bytes.length;) {
  const type = bytes.toString("ascii", offset, offset + 4), size = bytes.readUInt32LE(offset + 4);
  if (type === "fmt ") byteRate = bytes.readUInt32LE(offset + 16);
  if (type === "data") dataSize = size;
  offset += 8 + size + (size % 2);
}
if (!byteRate || !dataSize) throw new Error("Invalid WAV.");
const env = parseEnv(readFileSync("apps/client/.env.local", "utf8"));
const keys: Keys = Object.fromEntries(["openai", "elevenlabs", "gemini", "deepgram", "assemblyai", "speechmatics", "pyannote"].map(id => [id as ProviderId, env[`EXPO_PUBLIC_ASR_${id.toUpperCase()}_KEY`]]));
const only = process.argv.find(a => a.startsWith("--provider="))?.split("=")[1];
if (only) for (const id of Object.keys(keys) as ProviderId[]) if (id !== only) delete keys[id];
const now = Date.now();
const input: AudioInput = { recordingId: `artificial-${now}`, checksum: createHash("sha256").update(bytes).digest("hex"),
  durationMs: Math.ceil(dataSize / byteRate * 1000), stoppedAt: new Date(now).toISOString(),
  audioExpiresAt: new Date(now + 7 * 86400000).toISOString(), textExpiresAt: new Date(now + 30 * 86400000).toISOString(),
  name: "artificial.wav", mimeType: "audio/wav", blob: new Blob([bytes], { type: "audio/wav" }) };
const controller = new AbortController();
const last = new Map<string, string>();
const run = await runEnsemble(input, keys, transcribe, { signal: controller.signal, timeoutMs: 55000, publish: async value => {
  for (const c of value.candidates) if (["succeeded", "empty", "failed", "result_unknown"].includes(c.status) && last.get(c.id) !== c.status) {
    last.set(c.id, c.status); console.log(JSON.stringify({ provider: c.provider, status: c.status, error: c.error }));
  }
} });
if (speechFixture && !only) writeFileSync(".npm-cache/direct-asr/artificial-run.json", JSON.stringify(run));
let comparison = "not_run", comparisonError: string | null = null;
if (run.candidates.filter(c => c.kind === "transcript" && c.status === "succeeded").length >= 2) {
  const timer = setTimeout(() => controller.abort(), 55000);
  try {
    await compareTranscripts(run, keys.openai!, "gpt-5-mini", { fetch, signal: controller.signal, now: Date.now, sleep, job: () => {} });
    comparison = "succeeded";
  } catch (error) { comparison = "failed"; comparisonError = error instanceof Error ? error.message : "unknown"; }
  finally { clearTimeout(timer); }
}
const result = { at: new Date().toISOString(), input: speechFixture ? "fixed-Windows-synthesized-Japanese-no-human-audio" : "fixed-3-second-440Hz-tone-no-human-audio", durationMs: input.durationMs,
  checksum: input.checksum, providers: run.candidates.map(({ provider, model, status, elapsedMs, error, text, segments, raw }) => ({
    provider, model, status, elapsedMs, error, textLength: text.length, segments: segments.length,
    responseFields: raw && typeof raw === "object" ? Object.keys(raw) : [],
  })), comparison, comparisonError, client: "Node using the same device adapters; not a phone or browser test" };
mkdirSync(".npm-cache/direct-asr", { recursive: true });
writeFileSync(only ? `.npm-cache/direct-asr/live-${only}-result.json` : speechFixture ? ".npm-cache/direct-asr/live-speech-result.json" : ".npm-cache/direct-asr/live-result.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
if (result.providers.some(c => c.status !== "succeeded" && c.status !== "empty") || comparison !== "succeeded") process.exitCode = 1;
}
main().catch(() => { console.error("Live artificial check could not complete; no credentials printed."); process.exitCode = 1; });
