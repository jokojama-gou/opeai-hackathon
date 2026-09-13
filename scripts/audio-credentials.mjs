import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const format = 'audio-api-credentials/v1';
const aad = Buffer.from(format);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(root, '.env.audio-models.local');
const keyPath = resolve(root, '.env.audio-models.encryption-key.local');
const bundlePath = resolve(root, 'credentials/audio-models.env.enc.json');

export function encryptCredentials(plaintext, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { format, cipher: 'AES-256-GCM', iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'), data: ciphertext.toString('base64') };
}

export function decryptCredentials(bundle, key) {
  if (bundle.format !== format || bundle.cipher !== 'AES-256-GCM') {
    throw new Error('Unsupported credential bundle format');
  }
  const decode = (value) => {
    if (typeof value !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
      throw new Error('Invalid credential bundle encoding');
    }
    return Buffer.from(value, 'base64');
  };
  const iv = decode(bundle.iv);
  const tag = decode(bundle.tag);
  if (iv.length !== 12 || tag.length !== 16) throw new Error('Invalid IV or authentication tag');
  const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(decode(bundle.data)), decipher.final()]);
}

export async function writeNewCredentialFile(path, plaintext) {
  await writeFile(path, plaintext, { flag: 'wx', mode: 0o600 });
}

async function loadKey(create) {
  let encoded;
  try {
    encoded = await readFile(keyPath, 'utf8');
  } catch (error) {
    if (!create || error.code !== 'ENOENT') throw error;
    const bundleExists = await access(bundlePath).then(() => true, (failure) => {
      if (failure.code !== 'ENOENT') throw failure;
      return false;
    });
    if (bundleExists) throw new Error('Missing encryption key for the existing bundle');
    encoded = randomBytes(32).toString('base64');
    await writeNewCredentialFile(keyPath, encoded + '\n');
  }
  const trimmed = encoded.trim();
  const key = Buffer.from(trimmed, 'base64');
  if (key.length !== 32 || key.toString('base64') !== trimmed) throw new Error('Invalid local encryption key');
  return key;
}

async function run(command) {
  if (!['seal', 'verify', 'open'].includes(command)) {
    throw new Error('Usage: node scripts/audio-credentials.mjs <seal|verify|open>');
  }
  const key = await loadKey(command === 'seal');
  let plaintext;
  try {
    if (command === 'seal') {
      plaintext = await readFile(sourcePath);
      const bundle = encryptCredentials(plaintext, key);
      const restored = decryptCredentials(bundle, key);
      try {
        if (!timingSafeEqual(plaintext, restored)) throw new Error('Encryption round-trip failed');
      } finally { restored.fill(0); }
      await mkdir(dirname(bundlePath), { recursive: true });
      await writeFile(bundlePath, JSON.stringify(bundle, null, 2) + '\n');
      console.log('Encrypted bundle saved. The decryption key remains outside Git.');
    } else {
      plaintext = decryptCredentials(JSON.parse(await readFile(bundlePath, 'utf8')), key);
      if (command === 'open') {
        await writeNewCredentialFile(sourcePath, plaintext);
        console.log('Credentials restored to the local Git-ignored environment file.');
      } else {
        const source = await readFile(sourcePath);
        try {
          if (source.length !== plaintext.length || !timingSafeEqual(source, plaintext)) {
            throw new Error('Bundle does not match the local environment file');
          }
        } finally { source.fill(0); }
        console.log('PASS: bundle authenticated and matches the local environment file.');
      }
    }
  } finally {
    key.fill(0);
    plaintext?.fill(0);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run(process.argv[2]).catch((error) => {
    console.error(error.code === 'EEXIST' ? 'Existing local credentials were preserved; move them aside before restoring.' : error.message);
    process.exitCode = 1;
  });
}
