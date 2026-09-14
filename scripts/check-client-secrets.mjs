import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const env = join(root, ".env.audio-models.local");
const dist = join(root, "apps/client/dist");
if (!existsSync(env) || !existsSync(dist))
  throw new Error(
    "Build bundles and provide the local credential file before scanning.",
  );
const secrets = readFileSync(env, "utf8")
  .split(/\r?\n/)
  .flatMap((line) => {
    const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match) return [];
    const value = match[2].replace(/^['"]|['"]$/g, "");
    return value.length >= 20 && !value.startsWith("#")
      ? [Buffer.from(value)]
      : [];
  });
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
