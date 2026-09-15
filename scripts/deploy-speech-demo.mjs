import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const VERCEL_TOKEN = 'vcp_1gDxYxOquk5n9nFlcLZOZsiCLzGwW5m7XpwzuCWrC83qZLthJ33ABFKc';
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
