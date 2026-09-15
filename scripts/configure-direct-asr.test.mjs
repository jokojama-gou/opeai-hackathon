import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { configure } from './configure-direct-asr.mjs';
test('authorized ASR env generation preserves other settings, is idempotent and does not distribute admin keys', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'asr-env-'));
  try {
    mkdirSync(path.join(dir, 'apps/client'), { recursive: true });
    const target = path.join(dir, 'apps/client/.env.local');
    writeFileSync(target, 'EXPO_PUBLIC_API_URL=https://example.invalid\nEXPO_PUBLIC_ASR_OPENAI_KEY=synthetic-old\n');
    writeFileSync(path.join(dir, '.env.openai.local'), 'OPENAI_API_KEY=synthetic-new\nSUPABASE_SERVICE_ROLE_KEY=synthetic-admin\n');
    const result = configure(dir, {}); const first = readFileSync(target, 'utf8');
    configure(dir, {});
    assert.equal(readFileSync(target, 'utf8'), first);
    assert.ok(first.includes('EXPO_PUBLIC_API_URL=https://example.invalid'));
    assert.ok(first.includes('EXPO_PUBLIC_ASR_OPENAI_KEY=synthetic-new'));
    assert.equal(first.includes('synthetic-admin'), false);
    assert.equal(JSON.stringify(result).includes('synthetic-new'), false);
  } finally { rmSync(dir, { recursive: true }); }
});
