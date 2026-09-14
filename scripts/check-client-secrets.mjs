import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const env = join(root, ".env.audio-models.local");
const dist = join(root, "apps/client/dist");
if (!existsSync(dist))
  throw new Error(
    "Build bundles before scanning, then run this check through the credential vault.",
  );
const source = existsSync(env) ? readFileSync(env, "utf8") :
  ['OPENAI_API_KEY','ELEVENLABS_API_KEY','PYANNOTE_API_KEY','GEMINI_API_KEY','SPEECHMATICS_API_KEY','DEEPGRAM_API_KEY','ASSEMBLYAI_API_KEY','HF_TOKEN']
    .map(name => `${name}=${process.env[name] ?? ''}`).join('\n');
const secrets = source
  .split(/\r?\n/)
  .flatMap((line) => {
    const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match) return [];
    const value = match[2].replace(/^['"]|['"]$/g, "");
    return value.length >= 20 && !value.startsWith("#")
      ? [Buffer.from(value)]
      : [];
  });
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  let account;
  try { account = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8')); }
  catch { throw new Error('Google credential could not be inspected; no secret values were printed.'); }
  if (typeof account.private_key === 'string') {
    secrets.push(Buffer.from(account.private_key));
    secrets.push(Buffer.from(JSON.stringify(account.private_key).slice(1,-1)));
  }
}
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
