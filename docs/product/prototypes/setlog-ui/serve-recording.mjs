import http from 'node:http';
import { readFile } from 'node:fs/promises';

// Only this study and its explicit local references are exposed, on loopback only.
const files = new Map([
  ['recording-motion-v1.html', 'text/html; charset=utf-8'],
  ['fonts/KosugiMaru-Regular.ttf', 'font/ttf'],
  ['fonts/noto-sans-jp/NotoSansJP-Variable.ttf', 'font/ttf'],
  ['01-main-screens-v2.png', 'image/png'],
  ['02-ai-sharing-states-v2.png', 'image/png'],
  ['README.md', 'text/plain; charset=utf-8'],
]);
const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const name = pathname === '/' ? 'recording-motion-v1.html' : pathname.slice(1);
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end(); return;
  }
  if (!files.has(name)) { response.writeHead(404).end('Not found'); return; }
  try {
    const body = await readFile(new URL(name, import.meta.url));
    response.writeHead(200, {
      'Content-Type': files.get(name),
      'Content-Length': body.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Permissions-Policy': 'microphone=(), camera=(), geolocation=()',
      'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch { response.writeHead(500).end('Unable to load recording study'); }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(0, '127.0.0.1', () => console.log(`http://127.0.0.1:${server.address().port}/recording-motion-v1.html`));
