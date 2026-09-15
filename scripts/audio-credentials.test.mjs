import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encryptCredentials, decryptCredentials, writeNewCredentialFile } from './audio-credentials.mjs';

test('round-trip preserves UTF-8 bytes and uses a fresh IV', () => {
  const key = randomBytes(32);
  const source = Buffer.from('# 比較用\nEXAMPLE_KEY=synthetic-test-value\n');
  const first = encryptCredentials(source, key);
  const second = encryptCredentials(source, key);
  assert.deepEqual(decryptCredentials(first, key), source);
  assert.notEqual(first.iv, second.iv);
  assert.ok(!JSON.stringify(first).includes('synthetic-test-value'));
});

test('wrong keys and tampered ciphertext, tags and format are rejected', () => {
  const key = randomBytes(32);
  const bundle = encryptCredentials(Buffer.from('synthetic credentials'), key);
  assert.throws(() => decryptCredentials(bundle, randomBytes(32)));
  for (const field of ['data', 'tag']) {
    const altered = Buffer.from(bundle[field], 'base64');
    altered[0] ^= 1;
    assert.throws(() => decryptCredentials({ ...bundle, [field]: altered.toString('base64') }, key));
  }
  assert.throws(() => decryptCredentials({ ...bundle, format: 'unknown' }, key));
  assert.throws(() => decryptCredentials({ ...bundle, tag: '' }, key));
});

test('restoring never overwrites existing credentials', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'audio-credentials-test-'));
  const path = join(directory, 'test.env');
  try {
    await writeNewCredentialFile(path, 'existing synthetic value');
    await assert.rejects(writeNewCredentialFile(path, 'replacement'), { code: 'EEXIST' });
    assert.equal(await readFile(path, 'utf8'), 'existing synthetic value');
  } finally {
    await rm(path, { force: true });
    await rmdir(directory);
  }
});
