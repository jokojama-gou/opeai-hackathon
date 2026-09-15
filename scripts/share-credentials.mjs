import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, access, lstat } from 'node:fs/promises';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encryptCredentials, decryptCredentials } from './audio-credentials.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
export const names = ['.env.openai.local', '.env.expo.local', '.env.pyannote.local', '.env.supabase.local', '.env.vercel.local'];
const format = 'hackathon-credential-share/v1';

function outsideRepo(path) {
  const rel = relative(root, resolve(path));
  if (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('../') && !rel.startsWith('..\\')) {
    throw new Error('The key and restored plaintext must be outside this repository.');
  }
}

async function noSymlinks(path) {
  let current = resolve(path);
  while (true) {
    try { if ((await lstat(current)).isSymbolicLink()) throw new Error('Symlink paths are not supported.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

export function seal(files, key) {
  return encryptCredentials(Buffer.from(JSON.stringify({ format, files })), key);
}

export function unseal(bundle, key) {
  const archive = JSON.parse(decryptCredentials(bundle, key));
  if (archive.format !== format || !Array.isArray(archive.files) || archive.files.length !== names.length) throw new Error('Invalid archive.');
  const found = new Set();
  for (const file of archive.files) {
    if (!names.includes(file.name) || found.has(file.name) || typeof file.data !== 'string') throw new Error('Invalid file inventory.');
    if (Buffer.from(file.data, 'base64').toString('base64') !== file.data) throw new Error('Invalid file data.');
    found.add(file.name);
  }
  return archive.files;
}

async function keyFrom(path) {
  outsideRepo(path);
  await noSymlinks(path);
  const text = (await readFile(path, 'utf8')).trim();
  const key = Buffer.from(text, 'base64');
  if (key.length !== 32 || key.toString('base64') !== text) throw new Error('Invalid key file.');
  return key;
}

export async function restore(files, destination) {
  outsideRepo(destination);
  await noSymlinks(destination);
  // Require a new directory: never overwrite an existing setup.
  await mkdir(destination, { mode: 0o700 });
  for (const file of files) await writeFile(resolve(destination, file.name), Buffer.from(file.data, 'base64'), { flag: 'wx', mode: 0o600 });
}

async function main() {
  const [action, keyPath, destination] = process.argv.slice(2);
  if (!['pack', 'verify', 'unpack'].includes(action) || !keyPath || (action === 'unpack' && !destination)) {
    throw new Error('Usage: node scripts/share-credentials.mjs pack|verify KEY_FILE; unpack KEY_FILE NEW_DIRECTORY');
  }
  outsideRepo(keyPath);
  await noSymlinks(keyPath);
  const bundlePath = resolve(root, 'credentials/hackathon-settings.enc.json');
  if (action === 'pack') {
    // Refuse existing output before creating any key material.
    try { await access(bundlePath); throw new Error('Bundle already exists.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const files = [];
    for (const name of names) {
      await noSymlinks(resolve(root, name));
      files.push({ name, data: (await readFile(resolve(root, name))).toString('base64') });
    }
    const key = randomBytes(32);
    const bundle = seal(files, key);
    const restored = unseal(bundle, key);
    if (!timingSafeEqual(Buffer.from(JSON.stringify(files)), Buffer.from(JSON.stringify(restored)))) throw new Error('Round-trip mismatch.');
    await writeFile(keyPath, key.toString('base64') + '\n', { flag: 'wx', mode: 0o600 });
    await writeFile(bundlePath, JSON.stringify(bundle, null, 2) + '\n', { flag: 'wx' });
    key.fill(0);
    console.log('PASS: encrypted 5 configuration files; round-trip bytes match. Key saved separately; no values printed.');
  } else {
    const key = await keyFrom(keyPath);
    const files = unseal(JSON.parse(await readFile(bundlePath, 'utf8')), key);
    key.fill(0);
    if (action === 'unpack') await restore(files, resolve(destination));
    console.log(`PASS: ${files.length} files ${action === 'unpack' ? 'restored outside the repository' : 'authenticated and validated'}. No values printed.`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('FAIL: credential sharing did not complete. Check paths, permissions, key, and whether output already exists. No values printed.'); process.exitCode = 1; });
}
