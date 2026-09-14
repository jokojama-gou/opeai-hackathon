import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { selectChecks, runChecks } from './verify.mjs';

test('統合後の全確認はmainの契約・APIクライアント・製品データテストも含む', () => {
  const check = selectChecks([]).find(item => item.id === 'contracts');
  assert.ok(check, 'mainのテスト群を全確認から落とさない');
  assert.deepEqual(selectChecks(['contracts']), [check]);
  const command = check.command();
  assert.ok(command.includes('--test'));
  for (const file of ['contracts/contracts.test.ts', 'packages/api-ts/src/client.test.ts', 'apps/client/src/data/repository.test.ts']) {
    assert.ok(command.includes(file), `${file}を検証対象に残す`);
  }
});

test('文書だけの確認はUI依存を起動せず、参照とSkillを検査する', () => {
  const ids = selectChecks(['docs']).map(check => check.id);
  assert.ok(ids.includes('docs'));
  assert.ok(ids.includes('skills'));
  assert.ok(!ids.includes('typecheck'));
  assert.ok(!ids.includes('ui'));
});

test('複数対象を併用しても確認を重複実行せず、対象省略時は全確認を選ぶ', () => {
  const selected = selectChecks(['ui', 'docs', 'ui']).map(check => check.id);
  assert.equal(new Set(selected).size, selected.length);
  assert.ok(selected.includes('typecheck') && selected.includes('ui'));
  assert.deepEqual(selectChecks([]), selectChecks(['all']));
  assert.ok(selectChecks([]).some(check => check.id === 'runner'));
});

test('対象の誤記を無視して一部だけ成功扱いにしない', () => {
  assert.throws(() => selectChecks(['docs', 'uui']), /Unknown verification scope/);
});

test('失敗後も残る確認を実行し、後の成功で終了コードを上書きしない', () => {
  const checks = [{ id: 'broken', args: ['-e', 'process.exit(7)'] },
    { id: 'working', args: ['-e', 'process.exit(0)'] }];
  const result = runChecks(checks, check => spawnSync(process.execPath, check.args), () => {});
  assert.equal(result.exitCode, 1);
  assert.deepEqual(result.results.map(r => r.state), ['FAIL', 'PASS']);
  assert.equal(result.results[0].exitCode, 7);
});

test('起動不能・シグナル終了・終了コード不明を成功扱いにしない', () => {
  for (const output of [{ error: new Error('ENOENT'), status: null },
    { status: null, signal: 'SIGTERM' }, { status: null }]) {
    const result = runChecks([{ id: 'check' }], () => output, () => {});
    assert.equal(result.exitCode, 1);
    assert.notEqual(result.results[0].state, 'PASS');
  }
});

test('実行準備が例外終了しても残る確認と失敗の報告を行う', () => {
  const result = runChecks([{ id: 'missing' }, { id: 'working' }], check => {
    if (check.id === 'missing') throw new Error('dependency missing');
    return { status: 0 };
  }, () => {});
  assert.equal(result.exitCode, 1);
  assert.deepEqual(result.results.map(r => r.state), ['UNAVAILABLE', 'PASS']);
});
