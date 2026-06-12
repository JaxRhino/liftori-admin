// CRM base guard - fails the build if any base-CRM file hardcodes a tenant
// client instead of reading the impersonated tenant via useCrmClient().
// A hardcoded client (e.g. cscSupabase) leaks one tenant's data into every
// tenant. Runs automatically as a prebuild step (npm runs prebuild before build).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['src/pages/crm', 'src/components/crm'];
const RULES = [
  { re: /createClient\s*\(/, msg: 'createClient() - base CRM must use useCrmClient(), not its own client' },
  { re: /https:\/\/[a-z0-9]{8,}\.supabase\.co/i, msg: 'hardcoded Supabase project URL' },
  { re: /\bcscSupabase\b/, msg: 'cscSupabase - a hardcoded CSC client leaks CSC data into every tenant' },
];

function walk(dir) {
  let out = [];
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (/\.(jsx?|tsx?)$/.test(e)) out.push(p);
  }
  return out;
}

const violations = [];
let scanned = 0;
for (const root of ROOTS) {
  for (const file of walk(root)) {
    scanned++;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const r of RULES) {
        if (r.re.test(line)) {
          violations.push('  ' + file + ':' + (i + 1) + '  ' + r.msg + '\n      ' + line.trim());
        }
      }
    });
  }
}

if (violations.length) {
  console.error('\n\u2716 CRM base guard failed. Base CRM pages/components must read the');
  console.error('  impersonated tenant via useCrmClient() so each industry shows its OWN data.\n');
  console.error(violations.join('\n'));
  console.error('');
  process.exit(1);
}
console.log('\u2713 CRM base guard passed: ' + scanned + ' files, no hardcoded tenant clients.');
