import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const format = 'audio-api-credentials/v1';
const aad = Buffer.from(format);

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

// Legacy crypto helpers remain for old encrypted backups. Never restore plaintext into Git.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.error('Legacy plaintext commands are disabled. Use pwsh -File scripts/audio-vault.ps1 -Action verify or run.');
  process.exitCode = 1;
}
