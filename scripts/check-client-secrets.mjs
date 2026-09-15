import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const credentialFiles = [
  ".env.audio-models.local",
  ".env.openai.local",
  ".env.pyannote.local",
  ".env.supabase.local",
  ".env.expo.local",
  ".env.vercel.local",
  "services/backend/.env",
]
  .map((path) => join(root, path))
  .filter(existsSync);
const dist = process.argv[2]
  ? resolve(process.argv[2])
  : join(root, "apps/client/dist");
if (!existsSync(dist))
  throw new Error(
    "Build bundles before scanning, then run this check through the credential vault.",
  );
const values = credentialFiles.flatMap((env) =>
  readFileSync(env, "utf8")
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = line.match(
        /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/,
      );
      if (!match) return [];
      const value = match[2].replace(/^['"]|['"]$/g, "");
      return value.length >= 20 && !value.startsWith("#") ? [value] : [];
    }),
);
for (const name of [
  "OPENAI_API_KEY", "ELEVENLABS_API_KEY", "PYANNOTE_API_KEY", "GEMINI_API_KEY",
  "SPEECHMATICS_API_KEY", "DEEPGRAM_API_KEY", "ASSEMBLYAI_API_KEY", "HF_TOKEN",
  "EXPO_TOKEN", "SUPABASE_ACCESS_TOKEN", "VERCEL_TOKEN",
]) {
  if (process.env[name]) values.push(process.env[name]);
}
for (const file of [
  ".env.audio-google-service-account.local.json",
  "credentials/development-accounts.local.json",
]) {
  const path = join(root, file);
  if (!existsSync(path)) continue;
  const data = readCredentialJson(path);
  if (typeof data.private_key === "string") values.push(data.private_key);
  for (const account of data.accounts ?? [])
    if (account.password) values.push(account.password);
}
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const data = readCredentialJson(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (typeof data.private_key === "string") values.push(data.private_key);
}
function readCredentialJson(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch { throw new Error("Credential JSON could not be inspected; no secret values were printed."); }
}
for (const value of [...values]) {
  if (value.startsWith("postgres")) {
    try {
      const password = new URL(value).password;
      if (password) values.push(decodeURIComponent(password));
    } catch { throw new Error("Database credential could not be inspected; no secret values were printed."); }
  }
  values.push(JSON.stringify(value).slice(1, -1));
}
const secrets = [...new Set(values)]
  .filter((value) => value.length >= 20)
  .map((value) => Buffer.from(value));
if (!secrets.length)
  throw new Error(
    "No populated credential values found; scan was not performed.",
  );
let scanned = 0;
function scan(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      scan(path);
      continue;
    }
    const bytes = readFileSync(path);
    scanned++;
    if (secrets.some((secret) => bytes.includes(secret)))
      throw new Error(
        "Credential content detected in client output. Do not distribute this build.",
      );
  }
}
scan(dist);
console.log(
  `Client output scan passed (${scanned} files). No credential values are logged.`,
);
