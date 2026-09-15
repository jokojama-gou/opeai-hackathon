import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const client = path.join(root, 'apps/client');
const requireClient = createRequire(path.join(client, 'package.json'));
export function resolveBackendPython({ repoRoot = root, platform = process.platform, env = process.env, exists = existsSync } = {}) {
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const explicit = env.BACKEND_PYTHON;
  if (explicit !== undefined) {
    if (!explicit.trim() || !paths.isAbsolute(explicit) || !exists(explicit)) {
      throw new Error('BACKEND_PYTHON must be the absolute path of an existing Python executable. See services/backend/README.md.');
    }
    return explicit;
  }
  const executable = paths.join(repoRoot, '.npm-cache', 'backend-venv',
    ...(platform === 'win32' ? ['Scripts', 'python.exe'] : ['bin', 'python']));
  if (!exists(executable)) {
    throw new Error('Python venv is missing. Follow services/backend/README.md to create .npm-cache/backend-venv, or set BACKEND_PYTHON.');
  }
  return executable;
}

const nodeCheck = (id, args) => ({ id, command: () => [process.execPath, ...args] });
const checks = {
  docs: nodeCheck('docs', ['scripts/check-docs.mjs']),
  skills: nodeCheck('skills', ['scripts/check-aidd-lite.mjs']),
  backend: { id: 'backend', cwd: path.join(root, 'services/backend'),
    command: () => [resolveBackendPython(), '-m', 'pytest', '-q'] },
  typecheck: { id: 'typecheck', cwd: client,
    // Same installed TypeScript and arguments as the client's typecheck script.
    command: () => [process.execPath, requireClient.resolve('typescript/bin/tsc'), '--noEmit'] },
  ui: nodeCheck('ui', ['--experimental-strip-types', '--test', 'apps/client/src/data/ui-study.test.mjs']),
  contracts: { id: 'contracts', command: () => [process.execPath, '--import', 'tsx', '--test',
    ...['contracts', 'packages/api-ts/src', 'apps/client/src/data'].flatMap(dir =>
      readdirSync(path.join(root, dir)).filter(file => file.endsWith('.test.ts')).sort().map(file => `${dir}/${file}`))] },
  prototype: nodeCheck('prototype', ['--test', 'docs/product/prototypes/sharing-state.test.mjs']),
  'docs-self-test': nodeCheck('docs-self-test', ['scripts/check-docs.mjs', '--self-test']),
  runner: nodeCheck('runner', ['--test', 'scripts/verify.test.mjs']),
  'repository-tooling': nodeCheck('repository-tooling', ['--test', 'scripts/repository-tooling.test.mjs', 'scripts/configure-direct-asr.test.mjs']),
  secrets: nodeCheck('secrets', ['scripts/check-repository-secrets.mjs']),
  'credential-tests': nodeCheck('credential-tests', ['--test', 'scripts/audio-credentials.test.mjs', 'scripts/credential-security.test.mjs', 'scripts/share-credentials.test.mjs', 'scripts/client-output.test.mjs']),
};
const scopes = {
  docs: ['docs', 'skills'],
  ui: ['typecheck', 'ui'],
  contracts: ['contracts'],
  backend: ['backend'],
  prototype: ['prototype'],
  tooling: ['docs-self-test', 'runner', 'repository-tooling'],
  security: ['secrets', 'credential-tests'],
};

export function selectChecks(names) {
  const selected = names.length ? names : ['all'];
  for (const name of selected) {
    if (name !== 'all' && !Object.hasOwn(scopes, name)) {
      throw new Error(`Unknown verification scope: ${name}. Use docs, ui, contracts, backend, prototype, tooling, security, or all.`);
    }
  }
  const ids = selected.flatMap(name => name === 'all' ? Object.values(scopes).flat() : scopes[name]);
  return [...new Set(ids)].map(id => checks[id]);
}

function execute(check) {
  const [command, ...args] = check.command();
  return spawnSync(command, args, {
    cwd: check.cwd ?? root, stdio: 'inherit', shell: false,
    windowsHide: true, timeout: 120_000,
  });
}

export function runChecks(selected, run = execute, log = console.log) {
  const results = [];
  for (const check of selected) {
    log(`RUN ${check.id}`);
    let output;
    try { output = run(check); }
    catch (error) { output = { error }; }
    const state = output.error ? 'UNAVAILABLE'
      : output.status === 0 && !output.signal ? 'PASS' : 'FAIL';
    const detail = output.error?.message ?? output.signal ?? `exit ${output.status ?? 'unknown'}`;
    results.push({ id: check.id, state, exitCode: output.status ?? null });
    log(`${state} ${check.id}${state === 'PASS' ? '' : ` (${detail})`}`);
  }
  const failed = results.filter(result => result.state !== 'PASS');
  log(`Verification: ${results.length - failed.length}/${results.length} passed.`);
  return { exitCode: failed.length ? 1 : 0, results };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  if (process.argv.slice(2).length === 1 && process.argv[2] === '--help') {
    console.log('Usage: npm run verify -- [docs ui contracts backend prototype tooling security | all]\nNo scopes: all registered local checks, including Python backend tests. docs needs Node only. Backend: Python 3.12 venv or absolute BACKEND_PYTHON. Browser, devices, live APIs and builds require separate checks.');
  } else {
    try { process.exitCode = runChecks(selectChecks(process.argv.slice(2))).exitCode; }
    catch (error) { console.error(error.message); process.exitCode = 2; }
  }
}
