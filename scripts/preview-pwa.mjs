import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../apps/client/dist/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.ico': 'image/x-icon' };
createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, `.${name === '/' ? '/index.html' : name}`);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    // Expo Router's single-page export serves extensionless routes via index.html.
    const served = path.extname(file) ? file : path.join(root, 'index.html');
    const bytes = await readFile(served);
    res.writeHead(200, { 'Content-Type': types[path.extname(served)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log(`PWA preview: http://127.0.0.1:${process.env.PORT || 4173}`));
