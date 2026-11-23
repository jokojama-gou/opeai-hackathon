import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { names, seal, unseal, restore } from './share-credentials.mjs';

const files = names.map(name => ({ name, data: Buffer.from('synthetic\r\n日本語\0').toString('base64') }));
test('preserves all file bytes and rejects wrong keys and tampering', () => {
  const key = randomBytes(32), bundle = seal(files, key);
  assert.deepEqual(unseal(bundle, key), files);
  assert.throws(() => unseal(bundle, randomBytes(32)));
  const bytes = Buffer.from(bundle.data, 'base64'); bytes[0] ^= 1;
  assert.throws(() => unseal({ ...bundle, data: bytes.toString('base64') }, key));
});
test('rejects path traversal and duplicate entries even in authenticated archives', () => {
  const key = randomBytes(32);
  assert.throws(() => unseal(seal([{ ...files[0], name: '../outside' }, ...files.slice(1)], key), key));
  assert.throws(() => unseal(seal([files[0], files[0], ...files.slice(2)], key), key));
});
test('restores outside repo and refuses to overwrite an existing directory', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'hackathon-share-test-'));
  try {
    const destination = join(temp, 'restored');
    await restore(files, destination);
    for (const file of files) assert.deepEqual(await readFile(join(destination, file.name)), Buffer.from(file.data, 'base64'));
    await assert.rejects(restore(files, destination));
    await assert.rejects(restore(files, fileURLToPath(new URL('../credentials', import.meta.url))));
  } finally {
    assert.ok(resolve(temp).startsWith(resolve(tmpdir()) + sep));
    await rm(temp, { recursive: true, force: true });
  }
});
