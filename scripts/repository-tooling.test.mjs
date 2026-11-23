import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as verification from './verify.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const skills = ['research', 'design', 'implement', 'review', 'handoff'].map(s => `aidd-lite-${s}`).concat('hackathon-pitch-coach');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'aidd repository '));
  t.after(() => {
    assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir()) + path.sep));
    rmSync(root, { recursive: true, force: true });
  });
  const put = (name, body) => {
    const target = path.join(root, name);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, body);
  };
  put('README.md', '# Fixture\n');
  put('AGENTS.md', '# Instructions\n');
  for (const name of skills) {
    put(`.agents/skills/${name}/SKILL.md`, `---\nname: ${name}\ndescription: Example procedure\n---\n# Procedure\n`);
    put(`.agents/skills/${name}/agents/openai.yaml`, `interface:\n  display_name: "Example"\n  short_description: "Example procedure"\n  default_prompt: "$${name} example"\n`);
  }
  for (const name of ['GUIDE.md', 'PROJECT_CHECKS.md', 'PROVENANCE.md', 'ACCEPTANCE.md', 'agents/researcher.md', 'agents/reviewer.md']) {
    put(`docs/development/aidd-lite/${name}`, '# Reference\n');
  }
  const run = script => spawnSync(process.execPath, [path.join(repo, 'scripts', script), '--repo-root', root], {
    cwd: tmpdir(), encoding: 'utf8', windowsHide: true,
  });
  return { root, put, run };
}

test('Nodeだけで6つのskillを別配置から検査し、未決定の記述を許す', t => {
  const f = fixture(t);
  f.put('docs/development/aidd-lite/ACCEPTANCE.md', '# Reference\n自動発見とMac実機は未確認。\n');
  const result = f.run('check-aidd-lite.mjs');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /6 skills/);
});

test('必須skillの欠落を見逃さない', t => {
  const f = fixture(t);
  rmSync(path.join(f.root, '.agents/skills/aidd-lite-review/SKILL.md'));
  const result = f.run('check-aidd-lite.mjs');
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /Missing:.*aidd-lite-review/);
});

test('metadataの欠落・名前の相違・UIの誤った呼出先を拒否する', async t => {
  const cases = [
    ['description欠落', '.agents/skills/aidd-lite-review/SKILL.md', '---\nname: aidd-lite-review\n---\n# Review\n', /description/],
    ['名前相違', '.agents/skills/aidd-lite-review/SKILL.md', '---\nname: wrong\ndescription: Example\n---\n# Review\n', /Name mismatch/],
    ['重複field', '.agents/skills/aidd-lite-review/SKILL.md', '---\nname: aidd-lite-review\ndescription: One\ndescription: Two\n---\n', /description/],
    ['UI呼出先', '.agents/skills/aidd-lite-review/agents/openai.yaml', 'interface:\n  display_name: "Review"\n  short_description: "Review"\n  default_prompt: "$wrong"\n', /prompt/],
  ];
  for (const [name, file, text, error] of cases) await t.test(name, t => {
    const f = fixture(t);
    f.put(file, text);
    const result = f.run('check-aidd-lite.mjs');
    assert.equal(result.status, 1);
    assert.match(result.stdout + result.stderr, error);
  });
});

test('発表・backend・契約・認証手順のリンクとアンカーも検査する', async t => {
  for (const file of ['hackathon-pitch/README.md', 'services/backend/README.md', 'contracts/README.md', 'credentials/README.md']) {
    await t.test(file, t => {
      const f = fixture(t);
      f.put(file, '# Manual\n[Missing](missing.md)\n');
      let result = f.run('check-docs.mjs');
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stderr, /missing file/);
      f.put(file, '# Manual\n[Missing](#lost)\n');
      result = f.run('check-docs.mjs');
      assert.equal(result.status, 1);
      assert.match(result.stderr, /missing anchor/);
      f.put(file, '# Manual\n[Here](#manual)\n');
      result = f.run('check-docs.mjs');
      assert.equal(result.status, 0, result.stderr);
    });
  }
});

test('文書検査は生成物・依存・キャッシュを読まず、コード例を参照と扱わない', t => {
  const f = fixture(t);
  for (const dir of ['node_modules', '.npm-cache', '.git', '.venv', '.expo', 'dist', 'build', '__pycache__', '.pytest_cache']) {
    f.put(`${dir}/broken.md`, '[Missing](missing.md)\n');
    f.put(`services/backend/${dir}/broken.md`, '[Missing](missing.md)\n');
  }
  f.put('README.md', '# Fixture\n```md\n[Example](missing.md)\n```\n');
  const result = f.run('check-docs.mjs');
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('発表skillの移動先から別checkoutの発表資料へ到達できる', t => {
  const f = fixture(t);
  const source = readFileSync(path.join(repo, '.agents/skills/hackathon-pitch-coach/SKILL.md'), 'utf8');
  assert.ok(!source.includes('C:/Users/'));
  assert.match(source, /\]\(\.\.\/\.\.\/\.\.\/hackathon-pitch\/AGENTS\.md\)/);
  f.put('.agents/skills/hackathon-pitch-coach/SKILL.md', source);
  for (const file of ['AGENTS.md', 'event-rules.md', 'event-open-questions.md', 'day-of-details.md', 'working-draft.md']) {
    f.put(`hackathon-pitch/${file}`, '# Pitch\n');
  }
  const result = f.run('check-docs.mjs');
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('backendを全検証に含め、docsはNodeのみで独立実行できる', () => {
  assert.ok(verification.selectChecks([]).some(c => c.id === 'backend'));
  assert.equal(verification.selectChecks(['backend', 'docs', 'backend']).filter(c => c.id === 'backend').length, 1);
  for (const check of verification.selectChecks(['docs'])) assert.equal(check.command()[0], process.execPath);
});

test('PythonはOS別venvを使い、明示パスの誤りを自動で補わない', () => {
  assert.equal(typeof verification.resolveBackendPython, 'function');
  for (const [platform, root, expected] of [
    ['win32', 'C:\\work space\\repo', 'C:\\work space\\repo\\.npm-cache\\backend-venv\\Scripts\\python.exe'],
    ['darwin', '/work space/repo', '/work space/repo/.npm-cache/backend-venv/bin/python'],
  ]) {
    assert.equal(verification.resolveBackendPython({ repoRoot: root, platform, env: {}, exists: p => p === expected }), expected);
    const explicit = platform === 'win32' ? 'D:\\custom env\\python.exe' : '/custom env/bin/python';
    assert.equal(verification.resolveBackendPython({ repoRoot: root, platform, env: { BACKEND_PYTHON: explicit }, exists: p => p === explicit }), explicit);
    assert.throws(() => verification.resolveBackendPython({ repoRoot: root, platform, env: { BACKEND_PYTHON: explicit }, exists: p => p === expected }), /BACKEND_PYTHON/);
    assert.throws(() => verification.resolveBackendPython({ repoRoot: root, platform, env: {}, exists: () => false }), /Python|venv/);
  }
});

test('Python不足はUNAVAILABLEとして集計され、後続検査を止めない', () => {
  assert.equal(typeof verification.resolveBackendPython, 'function');
  const selected = [{ id: 'backend' }, { id: 'docs' }];
  const result = verification.runChecks(selected, check => {
    if (check.id === 'backend') verification.resolveBackendPython({ env: {}, exists: () => false });
    return { status: 0 };
  }, () => {});
  assert.equal(result.exitCode, 1);
  assert.deepEqual(result.results.map(r => r.state), ['UNAVAILABLE', 'PASS']);
});
