import http from 'node:http';
import { readFile } from 'node:fs/promises';

const allowed = new Set(['sharing.html', 'sharing-state.mjs']);
const server = http.createServer(async (request, response) => {
  try {
    const name = new URL(request.url, 'http://localhost').pathname.slice(1) || 'sharing.html';
    if (!allowed.has(name)) { response.writeHead(404); response.end('Not found'); return; }
    const content = await readFile(new URL(name, import.meta.url));
    response.writeHead(200, { 'Content-Type': name.endsWith('.mjs') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8' });
    response.end(content);
  } catch {
    response.writeHead(500); response.end('Unable to load prototype');
  }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(0, '127.0.0.1', () => console.log(`http://127.0.0.1:${server.address().port}/sharing.html`));
