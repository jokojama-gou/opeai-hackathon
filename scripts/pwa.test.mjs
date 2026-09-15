import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./pwa-worker.js', import.meta.url), 'utf8');
function worker() {
  const events = {};
  const stored = new Map();
  const deleted = [];
  const cache = {
    async addAll(paths) { for (const p of paths) stored.set(p, `static:${p}`); },
    async match(p) { return stored.get(p); },
  };
  vm.runInNewContext(source, {
    __CACHE_NAME__: 'conversation-shell-new', __ASSETS__: ['/index.html', '/app.js'], URL,
    self: { location: { origin: 'https://app.test' }, clients: { claim: async () => {} }, addEventListener: (name, fn) => { events[name] = fn; } },
    caches: { open: async () => cache, keys: async () => ['conversation-shell-old', 'conversation-shell-new', 'unrelated'], delete: async key => deleted.push(key) },
    fetch: async () => { throw new Error('offline'); },
  });
  const fetchEvent = (url, method = 'GET', mode = 'cors', auth = false) => {
    let result;
    events.fetch({ request: { url, method, mode, headers: { has: () => auth } }, respondWith: promise => { result = promise; } });
    return result;
  };
  return { events, stored, deleted, fetchEvent };
}
test('offline shell and assets are served from the public build cache', async () => {
  const w = worker();
  let install;
  w.events.install({ waitUntil: p => { install = p; } });
  await install;
  assert.equal(await w.fetchEvent('https://app.test/', 'GET', 'navigate'), 'static:/index.html');
  assert.equal(await w.fetchEvent('https://app.test/app.js'), 'static:/app.js');
});
test('API, external origin, authorization, POST and arbitrary paths bypass the worker', () => {
  const w = worker();
  for (const url of ['https://app.test/api/session', 'https://app.test/audio/private.wav', 'https://api.test/app.js', 'https://app.test/app.js?token=test']) assert.equal(w.fetchEvent(url), undefined);
  assert.equal(w.fetchEvent('https://app.test/app.js', 'POST'), undefined);
  assert.equal(w.fetchEvent('https://app.test/app.js', 'GET', 'cors', true), undefined);
  assert.equal(w.fetchEvent('https://app.test/api/private', 'GET', 'navigate'), undefined);
});
test('activation removes only obsolete caches belonging to this app', async () => {
  const w = worker();
  let activation;
  w.events.activate({ waitUntil: p => { activation = p; } });
  await activation;
  assert.deepEqual(w.deleted, ['conversation-shell-old']);
});
