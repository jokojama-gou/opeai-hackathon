import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';

// Use the explicit environment or the existing authorized root settings file.
if (!process.env.VERCEL_TOKEN?.trim()) {
  try {
    process.loadEnvFile(fileURLToPath(new URL('../.env.vercel.local', import.meta.url)));
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('VERCEL_TOKEN settings could not be loaded.');
  }
}
const VERCEL_TOKEN = process.env.VERCEL_TOKEN?.trim();
if (!VERCEL_TOKEN) throw new Error('Set VERCEL_TOKEN in the environment or .env.vercel.local before running this script.');
const htmlPath = path.resolve('outputs/speech-demo/index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

async function deploy() {
  console.log('Deploying Web Speech Demo directly to Vercel API (Production)...');

  const body = {
    name: 'ai-speech-demo',
    target: 'production',
    files: [
      {
        file: 'index.html',
        data: htmlContent
      }
    ],
    projectSettings: {
      framework: null
    }
  };

  const response = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('Vercel API Error:', data);
    process.exit(1);
  }

  console.log('✅ DEPLOYED SUCCESSFULLY TO PRODUCTION!');
  console.log('Production URL:', `https://${data.url}`);
  console.log('Alias / Public URL: https://ai-speech-demo-ogamayokoys-projects.vercel.app');
}

deploy().catch(err => {
  console.error(err);
  process.exit(1);
});
