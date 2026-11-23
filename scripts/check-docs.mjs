import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import assert from 'node:assert/strict';

// Repository subset: inline Markdown links/images and HTML href/src/id/name.
// No HTTP requests; this does not validate external URLs or semantic correctness.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stripFences = text => text.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, '');
const slug = text => text.replace(/<[^>]*>/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .toLowerCase().replace(/[^\p{L}\p{M}\p{N}_\-\s]/gu, '').replace(/ /g, '-');
function anchors(text, markdown) {
  const body = markdown ? stripFences(text) : text;
  const ids = new Set([...body.matchAll(/\b(?:id|name)=["']([^"']+)["']/g)].map(m => m[1]));
  const used = new Set();
  if (markdown) for (const m of body.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const base = slug(m[1]); let id = base, n = 0;
    while (used.has(id)) id = `${base}-${++n}`;
    used.add(id); ids.add(id);
  }
  return ids;
}
function links(text, markdown) {
  const body = markdown ? stripFences(text).replace(/`[^`\n]+`/g, '') : text;
  return [...(markdown ? [...body.matchAll(/\[[^\]\n]*\]\(([^)\n]+)\)/g)].map(m => m[1].replace(/^<|>$/g, '')) : []),
    ...[...body.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)].map(m => m[1])];
}
function inspect(file, target, exists = fs.existsSync, read = f => fs.readFileSync(f, 'utf8')) {
  if (/^(?:[a-zA-Z][\w+.-]*:|\/\/)/.test(target)) return null;
  const [pathname, fragment] = target.split('#', 2);
  const resolved = pathname ? path.resolve(path.dirname(file), decodeURIComponent(pathname.split('?')[0])) : file;
  if (!exists(resolved)) return `missing file: ${target}`;
  if (fragment && /\.(md|html)$/.test(resolved)) {
    if (!anchors(read(resolved), resolved.endsWith('.md')).has(decodeURIComponent(fragment))) return `missing anchor: ${target}`;
  }
  return null;
}
const excludedDirectories = new Set(['.git', 'node_modules', '.npm-cache', '.expo', '.venv',
  '__pycache__', '.pytest_cache', 'dist', 'build', 'coverage', '.next']);

export function collectDocuments(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return excludedDirectories.has(entry.name) ? [] : collectDocuments(target);
    return entry.isFile() && /\.(md|html)$/i.test(entry.name) ? [target] : [];
  });
}

export function inspectDocument(file) {
  const targets = links(fs.readFileSync(file, 'utf8'), /\.md$/i.test(file))
    .filter(target => !/^[a-zA-Z][\w+.-]*:|^\/\//.test(target));
  return { count: targets.length, issues: targets.map(target => inspect(file, target)).filter(Boolean) };
}

function main() {
  const { values } = parseArgs({ options: { 'self-test': { type: 'boolean' }, 'repo-root': { type: 'string' } } });
  if (values['self-test']) {
  const fixture = '# 見出し\n# 見出し\n<a id="fixed"></a>\n';
  assert(anchors(fixture, true).has('見出し-1'));
  assert.equal(inspect('/doc.md', '#fixed', () => true, () => fixture), null);
  assert.match(inspect('/doc.md', '#lost', () => true, () => fixture), /missing anchor/);
  assert.match(inspect('/doc.md', 'lost.md', () => false), /missing file/);
  assert.deepEqual(links('```text\n[example](missing.md)\n```\n[real](doc.md#fixed)', true), ['doc.md#fixed']);
  console.log('PASS: link/anchor checks detect missing targets and ignore fenced examples.');
  } else {
  const repoRoot = path.resolve(values['repo-root'] ?? root);
  const files = collectDocuments(repoRoot);
  let count = 0; const issues = [];
  for (const file of files) {
    const result = inspectDocument(file);
    count += result.count;
    issues.push(...result.issues.map(issue => `${path.relative(repoRoot, file)} -> ${issue}`));
  }
  if (issues.length) { console.error(issues.join('\n')); process.exitCode = 1; }
  else console.log(`PASS: ${files.length} Markdown/HTML files, ${count} local links and used anchors (including history). External URLs and AI behavior not checked.`);
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
