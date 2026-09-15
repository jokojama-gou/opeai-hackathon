import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const names = ['OPENAI', 'ELEVENLABS', 'GEMINI', 'DEEPGRAM', 'ASSEMBLYAI', 'SPEECHMATICS', 'PYANNOTE'];
export function parseEnv(text) {
  return Object.fromEntries(text.replace(/^\uFEFF/, '').split(/\r?\n/).flatMap(line => {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) return [];
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    return [[match[1], value]];
  }));
}
export function configure(repo = root, env = process.env) {
  const inputs = ['.env.openai.local', '.env.pyannote.local', '.env.audio-models.local'];
  const source = {};
  for (const name of inputs) if (existsSync(path.join(repo, name))) Object.assign(source, parseEnv(readFileSync(path.join(repo, name), 'utf8')));
  Object.assign(source, Object.fromEntries(names.map(n => [`${n}_API_KEY`, env[`${n}_API_KEY`]]).filter(([, v]) => v)));
  const target = path.join(repo, 'apps/client/.env.local');
  let content = existsSync(target) ? readFileSync(target, 'utf8') : '';
  const configured = [];
  for (const name of names) {
    const value = source[`${name}_API_KEY`];
    if (!value) continue;
    if (!/^[A-Za-z0-9_\-./+=]+$/.test(value)) throw new Error(`Invalid credential encoding for ${name}; no value printed.`);
    const variable = `EXPO_PUBLIC_ASR_${name}_KEY`;
    const pattern = new RegExp(`^${variable}=.*(?:\\r?\\n|$)`, 'm');
    const line = `${variable}=${value}\n`;
    content = pattern.test(content) ? content.replace(pattern, () => line) : `${content}${content.endsWith('\n') || !content ? '' : '\n'}${line}`;
    configured.push(name);
  }
  writeFileSync(target, content);
  return { configured, missing: names.filter(n => !configured.includes(n)) };
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = configure();
  console.log(JSON.stringify({ ...result, output: 'apps/client/.env.local', valuesPrinted: false }));
}
