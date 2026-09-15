import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dist = fileURLToPath(new URL('../apps/client/dist/', import.meta.url));
const files = (await readdir(dist, { recursive: true }))
  .map(file => file.replaceAll('\\', '/'))
  .filter(file => /\.(html|js|css|png|ico|woff2?|ttf|webmanifest)$/.test(file) && file !== 'sw.js')
  .sort();
const hash = createHash('sha256');
const template = await readFile(new URL('./pwa-worker.js', import.meta.url), 'utf8');
hash.update(template);
for (const file of files) hash.update(file).update(await readFile(path.join(dist, file)));
const version = hash.digest('hex').slice(0, 16);
await writeFile(path.join(dist, 'sw.js'), template
  .replace('__CACHE_NAME__', JSON.stringify(`conversation-shell-${version}`))
  .replace('__ASSETS__', JSON.stringify(files.map(file => `/${file}`))));
console.log(`PWA: ${files.length} static assets, version ${version}`);
