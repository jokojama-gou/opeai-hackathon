import fetch from 'node-fetch';

const VERCEL_TOKEN = process.env.VERCEL_TOKEN || '';

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
