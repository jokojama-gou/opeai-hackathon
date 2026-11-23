import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { isForbiddenCredentialPath, isSharedSetting, scanCredentialContent, inspectRepository, inspectHistory } from './check-repository-secrets.mjs';

test('plaintext sharing is limited to the five authorized root paths', () => {
  for (const path of ['.env.openai.local', '.env.expo.local', '.env.pyannote.local', '.env.supabase.local', '.env.vercel.local']) {
    assert.equal(isSharedSetting(path), true);
    assert.equal(isForbiddenCredentialPath(path), false);
    assert.equal(isSharedSetting('nested/' + path), false);
    assert.equal(isForbiddenCredentialPath('nested/' + path), true);
  }
  assert.equal(isForbiddenCredentialPath('.env.audio-models.local'), true);
  assert.equal(scanCredentialContent(Buffer.from('sk-' + 's'.repeat(40))), true);
});

test('credential files and private keys are blocked while examples and encrypted files are allowed', () => {
  for (const path of ['.env.audio-models.local','.env.audio-google-service-account.local.json','credentials/key.txt','nested/.env.production']) assert.equal(isForbiddenCredentialPath(path), true);
  for (const path of ['services/backend/.env.example','credentials/README.md','credentials/audio-models.env.enc.json']) assert.equal(isForbiddenCredentialPath(path), false);
  const synthetic = 'sk-' + 'a'.repeat(40);
  assert.equal(scanCredentialContent(Buffer.from(synthetic)), true);
  assert.equal(scanCredentialContent(Buffer.from('-----BEGIN ' + 'PRIVATE KEY-----\nsynthetic\n')), true);
  assert.equal(scanCredentialContent(Buffer.from('OPENAI_API_KEY=' + 'a'.repeat(40))), true);
  assert.equal(scanCredentialContent(Buffer.from('const apiKey = "' + 'c'.repeat(32) + '";')), true);
  assert.equal(scanCredentialContent(Buffer.from('GENERATION_API_KEY=\nOPENAI_API_KEY=your-key-here\n')), false);
});

function git(root, args) {
  const result = spawnSync('git',['-c','safe.directory='+root.replaceAll('\\','/'),'-C',root,...args],{encoding:'utf8',windowsHide:true});
  assert.equal(result.status,0,'synthetic Git operation failed');
}

test('index scan examines staged bytes even when working file was made harmless', () => {
  const root=mkdtempSync(join(tmpdir(),'repo-secret-scan-'));
  try {
    git(root,['init','-q']);
    writeFileSync(join(root,'sample.txt'),'sk-'+'b'.repeat(40));
    git(root,['add','sample.txt']);
    writeFileSync(join(root,'sample.txt'),'harmless');
    assert.equal(inspectRepository(root,'staged').length,1);
    git(root,['add','sample.txt']);
    assert.equal(inspectRepository(root,'staged').length,0);
    writeFileSync(join(root,'.env.test'),'NON_SECRET=example');
    git(root,['add','.env.test']);
    assert.equal(inspectRepository(root,'staged').length,1);
  } finally { assert.ok(resolve(root).startsWith(resolve(tmpdir())+requireSeparator())); rmSync(root,{recursive:true,force:true}); }
});

test('history scan reads committed blobs in one batch and finds old secrets and credential paths', () => {
  const root=mkdtempSync(join(tmpdir(),'repo-history-scan-'));
  try {
    git(root,['init','-q']);
    git(root,['config','user.email','test@example.invalid']);
    git(root,['config','user.name','Synthetic Test']);
    writeFileSync(join(root,'sample.txt'),'harmless');
    git(root,['add','sample.txt']);git(root,['commit','-qm','safe']);
    writeFileSync(join(root,'sample.txt'),'sk-'+'z'.repeat(40));
    writeFileSync(join(root,'.env.test'),'EXAMPLE=synthetic');
    git(root,['add','sample.txt','.env.test']);git(root,['commit','-qm','unsafe']);
    writeFileSync(join(root,'sample.txt'),'harmless again');
    git(root,['rm','-q','.env.test']);git(root,['add','sample.txt']);git(root,['commit','-qm','remove']);
    const findings=inspectHistory(root,'HEAD');
    assert.ok(findings.some(value=>value.file==='sample.txt' && value.reason.includes('secret')));
    assert.ok(findings.some(value=>value.file==='.env.test' && value.reason.includes('path')));
  } finally { assert.ok(resolve(root).startsWith(resolve(tmpdir())+requireSeparator())); rmSync(root,{recursive:true,force:true}); }
});

test('Windows vault preserves both files, rejects tampering and confines child credentials', {skip:process.platform!=='win32'}, () => {
  const parent=mkdtempSync(join(tmpdir(),'audio-vault-test-'));
  const source=join(parent,'source'),vault=join(parent,'vault');
  mkdirSync(source);
  const environment='OPENAI_API_KEY=synthetic-value-for-vault-test\nGOOGLE_CLOUD_PROJECT=synthetic-project\nUNRELATED_TEST_VAR=must-not-load\n';
  const cloud=JSON.stringify({type:'service_account',private_key:'synthetic-private-material',project_id:'synthetic-project'});
  writeFileSync(join(source,'.env.audio-models.local'),environment);
  writeFileSync(join(source,'.env.audio-google-service-account.local.json'),cloud);
  const script=resolve('scripts/audio-vault.ps1');
  const run=(action,extra=[])=>spawnSync('pwsh',['-NoLogo','-NoProfile','-File',script,'-Action',action,'-SourceDirectory',source,'-VaultDirectory',vault,...extra],{encoding:'utf8',windowsHide:true,timeout:30000});
  try {
    assert.equal(run('protect').status,0,'protect failed');
    const encrypted=readFileSync(join(vault,'audio-credentials.dpapi'));
    assert.equal(encrypted.includes(Buffer.from('synthetic-private-material')),false);
    assert.equal(encrypted.includes(Buffer.from('synthetic-value-for-vault-test')),false);
    assert.equal(run('protect').status,1,'must not overwrite an existing vault');
    assert.equal(run('verify').status,0);
    writeFileSync(join(source,'.env.audio-models.local'),environment+'# changed after protection\n');
    assert.equal(run('remove-plaintext').status,1,'changed originals must survive');
    assert.ok(existsSync(join(source,'.env.audio-models.local')));
    writeFileSync(join(source,'.env.audio-models.local'),environment);
    const tampered=Buffer.from(encrypted);tampered[tampered.length-5]^=1;
    writeFileSync(join(vault,'audio-credentials.dpapi'),tampered);
    assert.equal(run('verify').status,1,'tampering must fail');
    writeFileSync(join(vault,'audio-credentials.dpapi'),encrypted);
    const child=join(parent,'child.cjs');
    writeFileSync(child,`const fs=require('node:fs'),assert=require('node:assert/strict'); assert.equal(process.env.OPENAI_API_KEY,'synthetic-value-for-vault-test'); assert.equal(process.env.GOOGLE_CLOUD_PROJECT,'synthetic-project'); assert.equal(process.env.UNRELATED_TEST_VAR,undefined); assert.equal(JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS,'utf8')).private_key,'synthetic-private-material'); console.log('PASS');`);
    const childResult=run('run',['-Executable',process.execPath,'-CommandArguments',child]);
    assert.equal(childResult.status,0,'child failed');
    assert.equal(childResult.stdout.trim(),'PASS');
    assert.deepEqual(readdirSync(vault),['audio-credentials.dpapi']);
    writeFileSync(child,'process.exit(7);');
    assert.equal(run('run',['-Executable',process.execPath,'-CommandArguments',child]).status,7);
    assert.deepEqual(readdirSync(vault),['audio-credentials.dpapi']);
    const inside=spawnSync('pwsh',['-NoProfile','-File',script,'-Action','protect','-SourceDirectory',source,'-VaultDirectory',join(source,'vault')],{encoding:'utf8',windowsHide:true});
    assert.equal(inside.status,1,'vault cannot be stored in the repository');
    assert.equal(existsSync(join(source,'vault')),false);
    git(source,['init','-q']);git(source,['add','.env.audio-models.local','.env.audio-google-service-account.local.json']);
    assert.equal(run('remove-plaintext').status,1,'tracked credentials must not be removed');
    assert.equal(readFileSync(join(source,'.env.audio-models.local'),'utf8'),environment);
    git(source,['rm','--cached','--','.env.audio-models.local','.env.audio-google-service-account.local.json']);
    assert.equal(run('remove-plaintext').status,0);
    assert.equal(existsSync(join(source,'.env.audio-models.local')),false);
    assert.equal(run('verify').status,0,'vault must remain usable without originals');
  } finally {
    assert.ok(resolve(parent).startsWith(resolve(tmpdir())+requireSeparator()));
    rmSync(parent,{recursive:true,force:true});
  }
});

function requireSeparator(){return process.platform==='win32'?'\\':'/';}

test('demo credentials: tracked entry points contain no embedded credentials', () => {
  for (const file of ['apps/client/src/data/asr-settings.ts',
    'docs/product/prototypes/elevenlabs-real-demo.html', 'outputs/speech-demo/index.html',
    'scripts/check-vercel.mjs', 'scripts/deploy-speech-demo.mjs']) {
    assert.equal(scanCredentialContent(readFileSync(resolve(file))), false, file);
  }
});

test('demo credentials: mobile keys use only explicit environment settings', () => {
  const source = stripTypeScriptTypes(readFileSync(resolve('apps/client/src/data/asr-settings.ts'), 'utf8'))
    .replace(/^export /gm, '');
  const load = env => runInNewContext(source + '\nObject.values(bundledKeys);', { process: { env } });
  assert.equal(load({}).every(value => value === ''), true, 'Unset keys must all be empty; no values logged.');
  const configured = load({ EXPO_PUBLIC_ASR_OPENAI_KEY: 'synthetic-openai', EXPO_PUBLIC_ASR_ELEVENLABS_KEY: 'synthetic-elevenlabs' });
  assert.equal(configured[0] === 'synthetic-openai' && configured[1] === 'synthetic-elevenlabs', true);
  assert.equal(configured.slice(2).every(value => value === ''), true);
});

test('demo credentials: HTML requires the selected providers before opening the microphone', async () => {
  for (const file of ['docs/product/prototypes/elevenlabs-real-demo.html', 'outputs/speech-demo/index.html']) {
    const html = readFileSync(resolve(file), 'utf8');
    const source = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]).join('\n');
    let microphoneCalls = 0, alerts = 0, liveStarts = 0;
    const nodes = new Map();
    const node = id => { if (!nodes.has(id)) nodes.set(id, { value: '', style: {}, classList: { add() {}, remove() {} } }); return nodes.get(id); };
    const context = {
      document: { getElementById: node }, console: { log() {}, error() {}, warn() {} },
      alert() { alerts++; }, navigator: { mediaDevices: { async getUserMedia() { microphoneCalls++; throw Error('artificial microphone unavailable'); } } },
      window: { SpeechRecognition: class { start() { liveStarts++; } } }, setInterval() {}, clearInterval() {},
    };
    runInNewContext(source + '\nglobalThis.testStart = startRecording;', context);
    await context.testStart();
    assert.equal(microphoneCalls, 0, file);
    assert.equal(alerts, 1, file);
    assert.equal(/id="openaiKey"[^>]*type="password"/.test(html), true, file);
    assert.equal(/id="elevenlabsKey"[^>]*type="password"/.test(html), true, file);
    node('openaiKey').value = 'synthetic-openai';
    node('elevenlabsKey').value = 'synthetic-elevenlabs';
    await context.testStart();
    assert.equal(microphoneCalls, 1, file);
    assert.doesNotMatch(source, /(?:localStorage|sessionStorage|document\.cookie)/);
    if (file === 'outputs/speech-demo/index.html') {
      for (const [mode, openai, elevenlabs, allowed] of [
        ['batch', 'synthetic-openai', '', true],
        ['batch', '', 'synthetic-elevenlabs', false],
        ['diarize', '', 'synthetic-elevenlabs', true],
        ['diarize', 'synthetic-openai', '', false],
        ['denoise', 'synthetic-openai', '', false],
        ['denoise', '', 'synthetic-elevenlabs', false],
        ['denoise', 'synthetic-openai', 'synthetic-elevenlabs', true],
      ]) {
        runInNewContext(`activeMode = ${JSON.stringify(mode)};`, context);
        node('openaiKey').value = openai;
        node('elevenlabsKey').value = elevenlabs;
        const previousCalls = microphoneCalls;
        await context.testStart();
        assert.equal(microphoneCalls - previousCalls, allowed ? 1 : 0, mode);
      }
      node('openaiKey').value = '';
      node('elevenlabsKey').value = '';
      runInNewContext("activeMode = 'live';", context);
      await context.testStart();
      assert.equal(liveStarts, 1, 'Live captions need no provider key.');
    } else {
      node('openaiKey').value = '';
      await context.testStart();
      assert.equal(microphoneCalls, 1, 'Prototype fallback needs OpenAI before recording.');
    }
  }
});

test('demo credentials: Vercel scripts fail before network without a token and accept explicit settings', async () => {
  for (const file of ['scripts/check-vercel.mjs', 'scripts/deploy-speech-demo.mjs']) {
    const source = readFileSync(resolve(file), 'utf8').replace(/^import .*;\r?$/gm, '')
      .replaceAll('import.meta.url', JSON.stringify('file:///synthetic/scripts/tool.mjs'));
    async function execute(env, stored) {
      let calls = 0, loaded = 0, authorizationMatches = true, runtimeError = false;
      const context = {
        process: { env: { ...env }, loadEnvFile() { loaded++; if (stored) this.env.VERCEL_TOKEN = stored; else throw Object.assign(Error('absent'), { code: 'ENOENT' }); }, exit() { throw Error('unexpected exit'); } },
        fs: { readFileSync() { return '<html>synthetic</html>'; } }, path: { resolve: value => value },
        fileURLToPath: value => value.pathname, URL, console: { log() {}, error() { runtimeError = true; } },
        async fetch(_url, options) { calls++; authorizationMatches &&= options.headers.Authorization === 'Bearer synthetic-token'; return { ok: true, status: 200, async json() { return { id: 'synthetic', name: 'synthetic', url: 'example.invalid' }; } }; },
      };
      try { await runInNewContext(source, context); return { calls, loaded, error: runtimeError || !authorizationMatches }; }
      catch (error) { assert.match(error.message, /VERCEL_TOKEN/); return { calls, loaded, error: true }; }
    }
    const missing = await execute({});
    assert.equal(missing.error && missing.calls === 0, true, file);
    const environment = await execute({ VERCEL_TOKEN: 'synthetic-token' });
    assert.equal(environment.calls > 0 && environment.loaded === 0 && !environment.error, true, file);
    assert.equal(environment.calls, file.endsWith('/check-vercel.mjs') ? 2 : 1);
    const stored = await execute({}, 'synthetic-token');
    assert.equal(stored.calls > 0 && stored.loaded === 1 && !stored.error, true, file);
  }
});

test('bundle inspection reads vault environment, checks escaped Google keys and never prints values', () => {
  const root=mkdtempSync(join(tmpdir(),'client-secret-scan-'));
  const apiValue='synthetic-client-secret-value';
  const privateValue='-----BEGIN '+'PRIVATE KEY-----\nsynthetic-google-content\n-----END '+'PRIVATE KEY-----';
  try {
    mkdirSync(join(root,'scripts'));
    mkdirSync(join(root,'apps/client/dist'),{recursive:true});
    const script=join(root,'scripts/check-client-secrets.mjs');
    writeFileSync(script,readFileSync(resolve('scripts/check-client-secrets.mjs')));
    const account=join(root,'google.json'),output=join(root,'apps/client/dist/app.js');
    writeFileSync(account,JSON.stringify({private_key:privateValue}));
    const run=()=>spawnSync(process.execPath,[script],{env:{...process.env,OPENAI_API_KEY:apiValue,GOOGLE_APPLICATION_CREDENTIALS:account},encoding:'utf8',windowsHide:true});
    writeFileSync(output,'harmless bundle');assert.equal(run().status,0);
    for(const leaked of [apiValue,JSON.stringify(privateValue)]) {
      writeFileSync(output,leaked);const result=run();assert.equal(result.status,1);
      assert.ok(!(result.stdout+result.stderr).includes(apiValue));
      assert.ok(!(result.stdout+result.stderr).includes('synthetic-google-content'));
    }
    writeFileSync(account,'{"private_key":"'+apiValue+'\n');
    const invalid=run();assert.equal(invalid.status,1);assert.ok(!invalid.stderr.includes(apiValue));
  } finally { assert.ok(resolve(root).startsWith(resolve(tmpdir())+requireSeparator()));rmSync(root,{recursive:true,force:true}); }
});
