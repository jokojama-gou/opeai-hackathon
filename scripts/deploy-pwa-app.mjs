import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

if (!process.env.VERCEL_TOKEN?.trim()) {
  try {
    process.loadEnvFile(fileURLToPath(new URL('../.env.vercel.local', import.meta.url)));
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('VERCEL_TOKEN settings could not be loaded.');
  }
}
const VERCEL_TOKEN = process.env.VERCEL_TOKEN?.trim();
if (!VERCEL_TOKEN) throw new Error('Set VERCEL_TOKEN in environment or .env.vercel.local');

const distDir = path.resolve('apps/client/dist');
if (!fs.existsSync(distDir)) {
  console.error('dist directory not found:', distDir);
  process.exit(1);
}

async function getFiles(dir, base = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  let results = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.join(base, entry.name).replaceAll('\\', '/');
    if (entry.isDirectory()) {
      const sub = await getFiles(fullPath, relPath);
      results = results.concat(sub);
    } else {
      const buffer = await readFile(fullPath);
      const sha = crypto.createHash('sha1').update(buffer).digest('hex');
      results.push({
        relPath,
        sha,
        size: buffer.length,
        buffer
      });
    }
  }
  return results;
}

async function uploadFile(file) {
  const response = await fetch('https://api.vercel.com/v2/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/octet-stream',
      'x-vercel-digest': file.sha,
      'Content-Length': file.size.toString()
    },
    body: file.buffer
  });
  if (!response.ok && response.status !== 409) {
    const text = await response.text();
    console.warn(`Failed to upload ${file.relPath}: ${response.status} ${text}`);
  }
}

async function deploy() {
  console.log('🚀 Reading PWA dist assets for Vercel upload...');
  const files = await getFiles(distDir);
  console.log(`📦 Found ${files.length} static assets. Uploading via Vercel File Digest API...`);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`[${i + 1}/${files.length}] Uploading ${file.relPath} (${(file.size / 1024).toFixed(1)} KB)...`);
    await uploadFile(file);
  }

  console.log('🌐 Creating Production Deployment on Vercel...');
  const deploymentPayload = {
    name: 'ai-speech-demo',
    target: 'production',
    files: files.map(f => ({
      file: f.relPath,
      sha: f.sha,
      size: f.size
    })),
    projectSettings: {
      framework: null
    }
  };

  const res = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(deploymentPayload)
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('❌ Vercel Deployment Error:', data);
    process.exit(1);
  }

  console.log('\n🎉 ==============================================');
  console.log('✅ PWA DEPLOYED SUCCESSFULLY TO VERCEL PRODUCTION!');
  console.log('🔗 Deployment URL:', `https://${data.url}`);
  console.log('📱 Public Production App URL: https://ai-speech-demo-ogamayokoys-projects.vercel.app');
  console.log('==============================================\n');
}

deploy().catch(err => {
  console.error('Fatal Deployment error:', err);
  process.exit(1);
});
