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

async function main() {
  const res = await fetch('https://api.vercel.com/v9/projects/ai-speech-demo', {
    headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` }
  });
  const data = await res.json();
  console.log('Project ID:', data.id);
  console.log('Name:', data.name);
  console.log('Targets:', JSON.stringify(data.targets));

  // Disable protections
  const patchRes = await fetch(`https://api.vercel.com/v9/projects/${data.id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      passwordProtection: null,
      ssoProtection: null
    })
  });
  console.log('Patch Status:', patchRes.status);
  const patchData = await patchRes.json();
  console.log('Patched Project:', patchData.name);
}

main().catch(console.error);
