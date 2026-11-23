// Node 22+, no dependencies. Uses only synthetic data and deletes its resources.
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';

const ref = 'nmidnmqnrhogehzehkjh';
const origin = `https://${ref}.supabase.co`;
const management = `https://api.supabase.com/v1/projects/${ref}`;
const suffix = randomBytes(6).toString('hex');
const table = `codex_e2e_${suffix}`;
const bucket = `codex-e2e-${suffix}`;
const fn = `codex-e2e-${suffix}`;
const policy = `codex_e2e_${suffix}`;
const reportPath = new URL('../docs/development/SUPABASE_E2E_RESULT.json', import.meta.url);
const report = { startedAt: new Date().toISOString(), project: ref,
  resources: { table, bucket, function: fn, policy }, tests: [] };
const pat = (await readFile(new URL('../.env.supabase.local', import.meta.url), 'utf8'))
  .match(/^SUPABASE_ACCESS_TOKEN=(\S+)\s*$/m)?.[1];
assert(pat, 'Missing PAT');
let anon, admin;
const users = [];
const sockets = [];
let dbAttempted = false, bucketAttempted = false, functionAttempted = false;

async function persist() { await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n'); }
async function check(name, action) {
  const start = Date.now();
  try {
    const detail = await action();
    report.tests.push({ name, status: 'PASS', detail: detail ?? 'Verified', ms: Date.now() - start });
    console.log(`PASS ${name}`);
    await persist();
    return true;
  } catch (e) {
    // Errors deliberately exclude response bodies, URLs, credentials and stack traces.
    const detail = e.safeMessage ?? (e.code === 'ERR_ASSERTION' ? 'Assertion mismatch' : e.name);
    report.tests.push({ name, status: 'FAIL', detail, ms: Date.now() - start });
    console.log(`FAIL ${name}: ${detail}`);
    await persist();
    return false;
  }
}
function safeError(message) { return Object.assign(new Error(message), { safeMessage: message }); }
async function req(url, { method = 'GET', headers = {}, body, expected, raw = false } = {}) {
  const target = new URL(url);
  assert([origin, 'https://api.supabase.com'].includes(target.origin), 'Disallowed host');
  let data = body;
  if (body !== undefined && !(body instanceof FormData) && typeof body !== 'string') {
    data = JSON.stringify(body); headers = { ...headers, 'Content-Type': 'application/json' };
  }
  let res;
  try { res = await fetch(url, { method, headers, body: data, redirect: 'error', signal: AbortSignal.timeout(45000) }); }
  catch { throw safeError('Network error or timeout'); }
  const text = await res.text();
  if (expected ? !expected.includes(res.status) : !res.ok) {
    let code = '';
    try { code = JSON.parse(text).code ?? ''; } catch {}
    if (!/^[A-Za-z0-9_]{0,50}$/.test(code)) code = '';
    throw safeError(`HTTP ${res.status}${code ? ` code=${code}` : ''}`);
  }
  if (expected || raw) return { status: res.status, text };
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}
const mgmt = (path, opts = {}) => req(management + path, { ...opts,
  headers: { Authorization: `Bearer ${pat}`, ...opts.headers } });
const sql = query => mgmt('/database/query', { method: 'POST', body: { query } });
const client = (path, jwt = anon, opts = {}) => req(origin + path, { ...opts,
  headers: { apikey: anon, Authorization: `Bearer ${jwt}`, ...opts.headers } });
const privileged = (path, opts = {}) => req(origin + path, { ...opts,
  headers: { apikey: admin, Authorization: `Bearer ${admin}`, ...opts.headers } });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function channel(jwt, topic, key, postgres = false) {
  const ws = new WebSocket(`wss://${ref}.supabase.co/realtime/v1/websocket?apikey=${encodeURIComponent(anon)}&vsn=1.0.0`);
  sockets.push(ws);
  const messages = [];
  ws.addEventListener('message', e => { try { messages.push(JSON.parse(e.data)); } catch {} });
  ws.addEventListener('error', () => {});
  async function until(predicate, description, timeout = 20000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const hit = messages.find(predicate);
      if (hit) return hit;
      if (ws.readyState === WebSocket.CLOSED) throw safeError(`WebSocket closed: ${description}`);
      await pause(100);
    }
    throw safeError(`WebSocket timeout: ${description}`);
  }
  let seq = 1;
  function send(event, payload) {
    const id = String(seq++);
    ws.send(JSON.stringify({ topic, event, payload, ref: id, join_ref: '1' }));
    return id;
  }
  const deadline = Date.now() + 15000;
  while (ws.readyState === WebSocket.CONNECTING && Date.now() < deadline) await pause(100);
  if (ws.readyState !== WebSocket.OPEN) throw safeError('WebSocket connection failed');
  send('phx_join', { access_token: jwt, config: { private: false,
    broadcast: { ack: true, self: false }, presence: { enabled: true, key },
    postgres_changes: postgres ? [{ event: '*', schema: 'public', table }] : [] } });
  const reply = await until(m => m.event === 'phx_reply' && m.ref === '1', 'join');
  if (reply.payload.status !== 'ok') throw safeError('Realtime join rejected');
  return { ws, send, until, messages };
}

await persist();
try {
  const keysOk = await check('Project API credentials available (not logged)', async () => {
    const keys = await mgmt('/api-keys?reveal=true');
    anon = keys.find(k => k.name === 'anon')?.api_key;
    admin = keys.find(k => k.name === 'service_role')?.api_key;
    if (!anon || !admin) throw safeError('Legacy anon/service credentials unavailable');
  });
  if (!keysOk) throw safeError('Cannot run service tests without project credentials');

  const authOk = await check('Auth: create 2 users, password login and user verification', async () => {
    for (let i = 0; i < 2; i++) {
      const email = `codex-e2e-${suffix}-${i}@example.com`;
      const password = randomBytes(24).toString('base64url') + 'aA1!';
      const u = await privileged('/auth/v1/admin/users', { method: 'POST',
        body: { email, password, email_confirm: true, user_metadata: { test_run: suffix } } });
      assert.match(u.id, /^[a-f0-9-]{36}$/);
      users.push({ id: u.id });
      report.resources.userIds = users.map(x => x.id); await persist();
      const session = await client('/auth/v1/token?grant_type=password', anon,
        { method: 'POST', body: { email, password } });
      assert.equal(session.user.id, u.id);
      Object.assign(users[i], { jwt: session.access_token, refresh: session.refresh_token });
      const me = await client('/auth/v1/user', users[i].jwt);
      assert.equal(me.id, u.id);
    }
  });
  if (authOk) {
    await check('Auth: session refresh', async () => {
      const s = await client('/auth/v1/token?grant_type=refresh_token', anon,
        { method: 'POST', body: { refresh_token: users[0].refresh } });
      assert.equal(s.user.id, users[0].id);
      Object.assign(users[0], { jwt: s.access_token, refresh: s.refresh_token });
    });
    const dbOk = await check('DB: committed test table with owner RLS and Realtime publication', async () => {
      dbAttempted = true;
      await sql(`BEGIN; CREATE TABLE public.${table} (id uuid PRIMARY KEY, owner_id uuid NOT NULL, value text NOT NULL);
        ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.${table} TO authenticated;
        GRANT SELECT ON public.${table} TO anon;
        CREATE POLICY owner_only ON public.${table} TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
        ALTER PUBLICATION supabase_realtime ADD TABLE public.${table}; COMMIT; NOTIFY pgrst, 'reload schema';`);
      const r = await sql(`select to_regclass('public.${table}') is not null as persisted;`);
      assert.equal(r[0].persisted, true);
    });
    if (dbOk) {
      const rowId = randomUUID();
      await check('REST: user CRUD, persistence, other-user and anonymous RLS isolation', async () => {
        // PostgREST schema-cache propagation can lag behind the successful DDL request.
        for (let i = 0; ; i++) {
          try { await client(`/rest/v1/${table}?select=id`, users[0].jwt); break; }
          catch (e) { if (i >= 9 || !e.safeMessage?.includes('PGRST205')) throw e; await pause(1000); }
        }
        const rows = await client(`/rest/v1/${table}`, users[0].jwt, { method: 'POST',
          headers: { Prefer: 'return=representation' }, body: { id: rowId, owner_id: users[0].id, value: 'before' } });
        assert.equal(rows[0].value, 'before');
        const persisted = await client(`/rest/v1/${table}?id=eq.${rowId}&select=value`, users[0].jwt);
        assert.equal(persisted[0].value, 'before');
        assert.deepEqual(await client(`/rest/v1/${table}?select=id`, users[1].jwt), []);
        assert.deepEqual(await client(`/rest/v1/${table}?select=id`), []);
        await client(`/rest/v1/${table}`, users[1].jwt, { method: 'POST',
          body: { id: randomUUID(), owner_id: users[0].id, value: 'forbidden' }, expected: [403] });
        const deniedUpdate = await client(`/rest/v1/${table}?id=eq.${rowId}`, users[1].jwt,
          { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: { value: 'forbidden' } });
        assert.deepEqual(deniedUpdate, []);
        const updated = await client(`/rest/v1/${table}?id=eq.${rowId}`, users[0].jwt,
          { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: { value: 'after' } });
        assert.equal(updated[0].value, 'after');
        await client(`/rest/v1/${table}?id=eq.${rowId}`, users[0].jwt, { method: 'DELETE' });
        assert.deepEqual(await client(`/rest/v1/${table}?id=eq.${rowId}&select=id`, users[0].jwt), []);
      });
      await check('Realtime: two-client Broadcast and Presence', async () => {
        const topic = `realtime:codex-e2e-${suffix}`;
        const a = await channel(users[0].jwt, topic, 'test-a');
        const b = await channel(users[1].jwt, topic, 'test-b');
        a.send('broadcast', { type: 'broadcast', event: 'probe', payload: { marker: suffix } });
        await b.until(m => m.event === 'broadcast' && m.payload?.payload?.marker === suffix, 'broadcast');
        a.send('presence', { type: 'presence', event: 'track', payload: { marker: suffix } });
        await b.until(m => m.event === 'presence_diff' && m.payload?.joins?.['test-a'], 'presence');
        a.ws.close(); b.ws.close();
      });
      await check('Realtime: committed PostgreSQL INSERT event', async () => {
        const c = await channel(users[0].jwt, `realtime:codex-db-${suffix}`, 'db', true);
        await c.until(m => m.event === 'system' && m.payload?.status === 'ok', 'replication ready');
        const id = randomUUID();
        await client(`/rest/v1/${table}`, users[0].jwt, { method: 'POST',
          body: { id, owner_id: users[0].id, value: 'realtime' } });
        await c.until(m => m.event === 'postgres_changes' && m.payload?.data?.record?.id === id, 'database change');
        c.ws.close();
        await client(`/rest/v1/${table}?id=eq.${id}`, users[0].jwt, { method: 'DELETE' });
      });
    }
    await check('Storage: private bucket, user upload/download/update/delete and isolation', async () => {
      bucketAttempted = true;
      await privileged('/storage/v1/bucket', { method: 'POST', body: { id: bucket, name: bucket, public: false } });
      await sql(`CREATE POLICY ${policy} ON storage.objects TO authenticated
        USING (bucket_id = '${bucket}' AND (storage.foldername(name))[1] = auth.uid()::text)
        WITH CHECK (bucket_id = '${bucket}' AND (storage.foldername(name))[1] = auth.uid()::text);`);
      const path = `${users[0].id}/probe.txt`;
      const content = `synthetic-${suffix}`;
      await client(`/storage/v1/object/${bucket}/${path}`, users[0].jwt,
        { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: content });
      const downloaded = await client(`/storage/v1/object/authenticated/${bucket}/${path}`, users[0].jwt, { raw: true });
      assert.equal(downloaded.text, content);
      await client(`/storage/v1/object/authenticated/${bucket}/${path}`, users[1].jwt, { expected: [400, 403, 404] });
      await client(`/storage/v1/object/public/${bucket}/${path}`, anon, { expected: [400, 403, 404] });
      await client(`/storage/v1/object/${bucket}/${path}`, users[0].jwt,
        { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: content + '-updated' });
      const updated = await client(`/storage/v1/object/authenticated/${bucket}/${path}`, users[0].jwt, { raw: true });
      assert.equal(updated.text, content + '-updated');
      await client(`/storage/v1/object/${bucket}`, users[0].jwt, { method: 'DELETE', body: { prefixes: [path] } });
      const remaining = await privileged(`/storage/v1/object/list/${bucket}`, { method: 'POST', body: { prefix: users[0].id } });
      assert.equal(remaining.length, 0);
    });
  }
  await check('Edge Functions: deploy, authenticated invocation and unauthenticated denial', async () => {
    const form = new FormData();
    form.set('metadata', JSON.stringify({ name: fn, entrypoint_path: 'index.ts', verify_jwt: true }));
    form.append('file', new Blob([`Deno.serve(async (req) => { const data = await req.json(); return Response.json({ marker: data.marker, ok: true }); });`],
      { type: 'application/typescript' }), 'index.ts');
    functionAttempted = true;
    const deployed = await mgmt(`/functions/deploy?slug=${fn}`, { method: 'POST', body: form });
    assert.equal(deployed.slug, fn);
    const r = await client(`/functions/v1/${fn}`, users[0]?.jwt ?? anon,
      { method: 'POST', body: { marker: suffix } });
    assert.equal(r.marker, suffix); assert.equal(r.ok, true);
    await req(`${origin}/functions/v1/${fn}`, { method: 'POST', body: { marker: suffix }, expected: [401] });
  });
  if (users[0]?.jwt) await check('Auth: logout and refresh-token revocation', async () => {
    await client('/auth/v1/logout?scope=global', users[0].jwt, { method: 'POST' });
    await client('/auth/v1/token?grant_type=refresh_token', anon, { method: 'POST',
      body: { refresh_token: users[0].refresh }, expected: [400, 401, 403] });
  });
} catch (e) {
  report.tests.push({ name: 'Test prerequisites', status: 'FAIL', detail: e.safeMessage ?? 'Prerequisite error' });
} finally {
  for (const ws of sockets) { try { ws.close(); } catch {} }
  if (functionAttempted) await check('Cleanup: delete test Edge Function and verify absence', async () => {
    const functions = await mgmt('/functions');
    if (functions.some(f => f.slug === fn)) await mgmt(`/functions/${fn}`, { method: 'DELETE' });
    assert(!(await mgmt('/functions')).some(f => f.slug === fn));
  });
  if (bucketAttempted) await check('Cleanup: empty/delete test bucket and remove storage policy', async () => {
    const buckets = await privileged('/storage/v1/bucket');
    if (buckets.some(b => b.id === bucket)) {
      await privileged(`/storage/v1/bucket/${bucket}/empty`, { method: 'POST', body: {} });
      await privileged(`/storage/v1/bucket/${bucket}`, { method: 'DELETE' });
    }
    await sql(`DROP POLICY IF EXISTS ${policy} ON storage.objects;`);
    assert(!(await privileged('/storage/v1/bucket')).some(b => b.id === bucket));
    const p = await sql(`select count(*)::int as n from pg_policies where policyname='${policy}';`);
    assert.equal(p[0].n, 0);
  });
  if (dbAttempted) await check('Cleanup: drop test table and verify absence', async () => {
    await sql(`DROP TABLE IF EXISTS public.${table}; NOTIFY pgrst, 'reload schema';`);
    const r = await sql(`select to_regclass('public.${table}') is null as absent;`);
    assert.equal(r[0].absent, true);
  });
  if (users.length) await check('Cleanup: delete test users and verify absence', async () => {
    const failures = [];
    for (const u of users) {
      try {
        await privileged(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' });
        await privileged(`/auth/v1/admin/users/${u.id}`, { expected: [404] });
      } catch { failures.push(u.id); }
    }
    if (failures.length) throw safeError(`User cleanup failed: ${failures.length}`);
  });
  report.finishedAt = new Date().toISOString();
  report.passed = report.tests.filter(t => t.status === 'PASS').length;
  report.failed = report.tests.filter(t => t.status === 'FAIL').length;
  await persist();
  console.log(`Finished: ${report.passed} PASS, ${report.failed} FAIL`);
  if (report.failed) process.exitCode = 1;
}
