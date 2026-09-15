import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const credentialNames = ['OPENAI_API_KEY','ELEVENLABS_API_KEY','PYANNOTE_API_KEY','GEMINI_API_KEY','SPEECHMATICS_API_KEY','DEEPGRAM_API_KEY','ASSEMBLYAI_API_KEY','HF_TOKEN'];
const knownValues = credentialNames.flatMap(name => process.env[name]?.length >= 12 ? [Buffer.from(process.env[name])] : []);
if (process.env.GOOGLE_APPLICATION_CREDENTIALS && existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
  try {
    const account = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS,'utf8'));
    if (typeof account.private_key === 'string' && account.private_key.length > 20) knownValues.push(Buffer.from(account.private_key));
  } catch { throw new Error('Unable to load the supplied Google credential for scanning; no values were printed.'); }
}

export function isForbiddenCredentialPath(file) {
  const normalized=file.replaceAll('\\','/');
  const name=basename(normalized);
  if (name === '.env.example') return false;
  return /^\.env(?:\.|$)/i.test(name) || /\.(?:pem|key|p12|p8|pfx)$/i.test(name)
    || /service[-_]account.*\.json$/i.test(name)
    || (/^credentials\//i.test(normalized) && name !== 'README.md' && !name.endsWith('.enc.json'));
}

export function scanCredentialContent(bytes) {
  if (knownValues.some(value=>bytes.includes(value))) return true;
  const text=bytes.toString('utf8');
  return /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)
    || /\b(?:sk-[A-Za-z0-9_-]{20,}|hf_[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{30,}|gh[pousr]_[A-Za-z0-9]{30,})\b/.test(text)
    || /\b(?:[A-Z0-9_]*API_KEY|[A-Z0-9_]*TOKEN|apiKey|api_key|private_key)["']?[ \t]*[:=][ \t]*["'](?!your[-_]|example|placeholder|synthetic|changeme)[A-Za-z0-9_+/=-]{20,}["']/.test(text)
    || /^[ \t]*(?:export[ \t]+)?(?:[A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD))[ \t]*=[ \t]*["']?(?!your[-_]|example|placeholder|synthetic|changeme)[A-Za-z0-9_+/=-]{20,}/m.test(text);
}

function git(repo,args,encoding='utf8') {
  try { return execFileSync('git',['-c','safe.directory='+resolve(repo).replaceAll('\\','/'),'-C',repo,...args],{encoding,maxBuffer:128*1024*1024,windowsHide:true,stdio:['ignore','pipe','pipe']}); }
  catch { throw new Error('Git inspection failed; secret inspection was not completed.'); }
}

export function inspectRepository(repo,mode='working') {
  const files=git(repo,mode==='staged'?['diff','--cached','--name-only','--diff-filter=ACMR','-z']:['ls-files','--cached','--others','--exclude-standard','-z']).split('\0').filter(Boolean);
  const findings=[];
  for(const file of new Set(files)) {
    if (isForbiddenCredentialPath(file)) { findings.push({file,reason:'credential file must not be tracked'}); continue; }
    if (mode!=='staged' && !existsSync(resolve(repo,file))) continue;
    const bytes=mode==='staged'?git(repo,['show',':'+file],null):readFileSync(resolve(repo,file));
    if(scanCredentialContent(bytes)) findings.push({file,reason:'possible secret content'});
  }
  return findings;
}

export function inspectHistory(repo,revision='--all') {
  if (revision !== '--all' && !/^[A-Za-z0-9_/.^-]+$/.test(revision)) throw new Error('Invalid history revision.');
  const objects=git(repo,['rev-list','--objects',revision]).split('\n').filter(Boolean);
  const findings=[];
  for(const entry of objects) {
    const separator=entry.indexOf(' ');
    if(separator<0) continue;
    const id=entry.slice(0,separator),file=entry.slice(separator+1);
    if(isForbiddenCredentialPath(file)) { findings.push({file,reason:'credential path in Git history'}); continue; }
    if(git(repo,['cat-file','-t',id]).trim()!=='blob') continue;
    if(scanCredentialContent(git(repo,['cat-file','blob',id],null))) findings.push({file,reason:'possible secret in Git history'});
  }
  return findings;
}

if(process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  try {
    const args=process.argv.slice(2);
    let repo=root;
    const repoIndex=args.indexOf('--repo');
    if(repoIndex!==-1) { if(!args[repoIndex+1]) throw new Error('Missing repository path.'); repo=args[repoIndex+1];args.splice(repoIndex,2); }
    if(args.some(arg=>!['--staged','--history'].includes(arg)) || args.length>1) throw new Error('Use --staged or --history, with optional --repo PATH.');
    const findings=args.includes('--history')?inspectHistory(repo):inspectRepository(repo,args.includes('--staged')?'staged':'working');
    for(const finding of findings) console.error(`${finding.reason}: ${finding.file}`);
    if(findings.length) { console.error(`FAIL: ${findings.length} findings. No secret values were printed.`);process.exitCode=1; }
    else console.log('PASS: repository credential inspection found no blocked files or recognized secret content.');
  } catch { console.error('FAIL: credential inspection could not complete. No secret values were printed.');process.exitCode=2; }
}
