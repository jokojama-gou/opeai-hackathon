import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { inspectDocument } from './check-docs.mjs';

// Supported project metadata: one-line frontmatter fields and quoted UI strings.
// This checks structure, not model behavior or discovery in another client.
const requiredSkills = ['research', 'design', 'implement', 'review', 'handoff']
  .map(name => `aidd-lite-${name}`).concat('hackathon-pitch-coach');
const referenceFiles = ['GUIDE.md', 'PROJECT_CHECKS.md', 'PROVENANCE.md', 'ACCEPTANCE.md',
  'agents/researcher.md', 'agents/reviewer.md'];
const unquote = value => value.trim().replace(/^(["'])(.*)\1$/, '$2');

function inspectSkills(root) {
  const issues = [], managed = [];
  function requireFile(relative) {
    const full = path.join(root, relative);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      issues.push(`Missing: ${relative}`);
      return null;
    }
    managed.push(full);
    return fs.readFileSync(full, 'utf8');
  }
  const directory = path.join(root, '.agents/skills');
  const discovered = fs.existsSync(directory) ? fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isDirectory()).map(entry => entry.name) : [];
  const names = [...new Set([...requiredSkills, ...discovered])].sort();
  for (const name of names) {
    const body = requireFile(`.agents/skills/${name}/SKILL.md`);
    if (body !== null) {
      const fields = body.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
      if (fields === undefined) issues.push(`Frontmatter: ${name}`);
      else {
        for (const key of ['name', 'description']) {
          const matches = [...fields.matchAll(new RegExp(`^${key}:[ \\t]*(.*?)\\r?$`, 'gm'))];
          if (matches.length !== 1 || !unquote(matches[0][1]).trim()) issues.push(`Field ${key}: ${name}`);
          if (key === 'name' && matches.length === 1 && unquote(matches[0][1]) !== name) issues.push(`Name mismatch: ${name}`);
        }
      }
    }
    const yaml = requireFile(`.agents/skills/${name}/agents/openai.yaml`);
    if (yaml !== null) {
      if (!/^interface:\r?$/m.test(yaml)) issues.push(`UI interface: ${name}`);
      for (const key of ['display_name', 'short_description', 'default_prompt']) {
        const matches = [...yaml.matchAll(new RegExp(`^  ${key}: "([^"\\r\\n]+)"\\r?$`, 'gm'))];
        if (matches.length !== 1 || !matches[0][1].trim()) issues.push(`UI ${key}: ${name}`);
        if (key === 'default_prompt' && (matches.length !== 1 || !matches[0][1].includes(`$${name}`))) {
          issues.push(`UI prompt name: ${name}`);
        }
      }
      // Optional for the pitch coach; preserve the AIDD skills' existing policy.
      if (/^policy:/m.test(yaml) && !/^policy:\r?\n  allow_implicit_invocation: (true|false)\r?$/m.test(yaml)) {
        issues.push(`UI policy: ${name}`);
      }
    }
  }
  for (const file of referenceFiles) requireFile(`docs/development/aidd-lite/${file}`);
  for (const file of managed) {
    const body = fs.readFileSync(file, 'utf8');
    if (/\[INSERT[^\]]*\]|\{\{[^}]+\}\}|REPLACE_ME/.test(body)) issues.push(`Scaffold: ${path.relative(root, file)}`);
    if (file.endsWith('.md')) issues.push(...inspectDocument(file).issues.map(issue => `${path.relative(root, file)} -> ${issue}`));
  }
  return { issues, files: managed.length, skills: names.length };
}

try {
  const { values } = parseArgs({ options: { 'repo-root': { type: 'string' } } });
  const root = path.resolve(values['repo-root'] ?? fileURLToPath(new URL('../', import.meta.url)));
  const result = inspectSkills(root);
  if (result.issues.length) {
    result.issues.forEach(issue => console.error(`FAIL ${issue}`));
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${result.skills} skills, ${result.files} managed files; supported metadata and local references. Model behavior and discovery are not checked.`);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
