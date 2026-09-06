#!/usr/bin/env node
/**
 * Create a node (ring 2026-09-06): from a charter to a living node, with every step the CLI
 * can take taken, and every step only a console can take said out loud at the end.
 *
 *   node scripts/create-node.mjs path/to/node.json            # the plan, nothing done
 *   node scripts/create-node.mjs path/to/node.json --apply    # make it so
 *
 * Beside the charter may stand `<name>.secrets.json` (gitignored): { "VAPID_PRIVATE_KEY",
 * "GEMINI_API_KEY", "ANTHROPIC_API_KEY", ... } — each becomes a functions secret. A missing
 * VAPID pair is generated and written back (public half into the charter, private into the
 * secrets file).
 *
 * The steps, in order — each idempotent, each skipped when already true:
 *   1  the charter is sound
 *   2  the Firebase project exists (firebase projects:create)
 *   3  a web app exists, and its config fills charter.firebase.web (firebase apps:*)
 *   4  the Firestore database exists (gcloud firestore databases create)
 *   5  a hosting site per face (firebase hosting:sites:create)
 *   6  the secrets are set (firebase functions:secrets:set)
 *   7  the derived files agree (scripts/charter-sync.mjs)
 *   8  rules, functions, hosting are deployed (three deploys, each under ten minutes)
 *   9  custody is declared: config/dataAuthority { version: 1, nodeLid } (scripts/declare-data-authority.mjs)
 *  10  what only a console can do: the Blaze plan, Storage's default bucket, the Auth
 *      providers and authorized domains, the custom domains' DNS, the keeper's first sign-in
 *
 * Runs with the machine's firebase login and application-default credentials.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');
const charterPath = resolve(process.argv.find((a) => a.endsWith('.json') && !a.startsWith('--')) || resolve(ROOT, 'node.json'));
const secretsPath = charterPath.replace(/\.json$/, '.secrets.json');
const charter = JSON.parse(readFileSync(charterPath, 'utf8'));
const secrets = existsSync(secretsPath) ? JSON.parse(readFileSync(secretsPath, 'utf8')) : {};
const P = charter.firebase.projectId;

const say = (s) => console.log(s);
const run = (cmd, opts = {}) => {
  say(`    $ ${cmd}`);
  if (!APPLY && !opts.always) return '';
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: opts.quiet ? 'pipe' : ['inherit', 'pipe', 'inherit'] });
};
const tryRun = (cmd, opts = {}) => { try { return run(cmd, opts); } catch (e) { say(`      (failed: ${String(e.message).split('\n')[0]})`); return null; } };
const json = (cmd) => { try { return JSON.parse(execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' })); } catch { return null; } };
const manual = [];

say(`\n${APPLY ? 'CREATING' : 'PLAN FOR'} node "${charter.name}" (${charter.domain}) — project ${P}\n`);

// 1 · the charter is sound (the domain law's echo; the full law runs in tests/charter.test.ts)
say('1 · the charter');
const DOMAIN = /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/;
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
for (const [ok, why] of [
  [charter.version === 1, 'version must be 1'],
  [UUID_V7.test(charter.nodeLid || ''), 'nodeLid must be a UUIDv7 true name'],
  [!!charter.name && !!charter.shortName, 'name and shortName'],
  [DOMAIN.test(charter.domain || ''), 'domain'],
  [Array.isArray(charter.faces) && charter.faces.length > 0, 'at least one face'],
  [/^[a-z][a-z0-9-]{4,29}$/.test(P || ''), 'firebase.projectId'],
  [!!charter.keeper?.email, 'keeper.email'],
]) if (!ok) { console.error(`    ✗ ${why}`); process.exit(1); }
say('    ✓ sound');

// 2 · the project
say('2 · the Firebase project');
const projects = json('npx firebase projects:list --json');
const exists = !!projects?.result?.find?.((p) => p.projectId === P);
if (exists) say(`    = ${P} exists`);
else {
  tryRun(`npx firebase projects:create ${P} --display-name "${charter.name}"`);
  manual.push(`Upgrade project ${P} to the Blaze plan (functions need it): https://console.firebase.google.com/project/${P}/usage/details`);
}

// 3 · the web app and its config
say('3 · the web app');
let web = charter.firebase.web || {};
if (web.apiKey && web.appId) say('    = web config present in the charter');
else {
  const apps = json(`npx firebase apps:list WEB --project ${P} --json`);
  if (!apps?.result?.length) tryRun(`npx firebase apps:create WEB "${charter.name}" --project ${P}`);
  const cfg = APPLY ? json(`npx firebase apps:sdkconfig WEB --project ${P} --json`) : null;
  const sdk = cfg?.result?.sdkConfig;
  if (sdk) {
    web = { apiKey: sdk.apiKey, authDomain: sdk.authDomain, messagingSenderId: sdk.messagingSenderId, appId: sdk.appId, ...(sdk.measurementId ? { measurementId: sdk.measurementId } : {}) };
    charter.firebase.web = web;
    if (!charter.firebase.bucket) charter.firebase.bucket = sdk.storageBucket || `${P}.firebasestorage.app`;
    writeFileSync(charterPath, JSON.stringify(charter, null, 2) + '\n');
    say('    → web config written into the charter');
  } else say('    · web config will be read once the app exists (re-run after --apply)');
}

// 4 · the database
say('4 · the Firestore database');
const dbs = json(`gcloud firestore databases list --project ${P} --format json`);
if (dbs?.some?.((d) => d.name?.endsWith('/(default)'))) say('    = (default) exists');
else if (spawnSync('which', ['gcloud']).status === 0) tryRun(`gcloud firestore databases create --database="(default)" --location=${charter.firebase.region.includes('-') ? 'nam5' : charter.firebase.region} --project ${P} --quiet`);
else manual.push(`Create the Firestore database (Native mode): https://console.firebase.google.com/project/${P}/firestore`);

// 5 · a site per face
say('5 · the hosting sites');
const sites = json(`npx firebase hosting:sites:list --project ${P} --json`);
const have = new Set((sites?.result?.sites || []).map((s) => String(s.name || '').split('/').pop()));
for (const f of charter.faces) {
  if (have.has(f.site)) say(`    = ${f.site}`);
  else tryRun(`npx firebase hosting:sites:create ${f.site} --project ${P}`);
  if (f.domains.length) manual.push(`Connect ${f.domains.join(', ')} to site ${f.site}: https://console.firebase.google.com/project/${P}/hosting/sites/${f.site}`);
}

// 6 · the secrets
say('6 · the secrets');
// A push pair is minted ONLY for a charter that has none: a charter already carrying a public
// key has subscriptions bound to it, and a new pair would orphan every one of them.
if (!charter.push?.publicKey) {
  const require = createRequire(resolve(ROOT, 'functions/package.json'));
  const { publicKey, privateKey } = require('web-push').generateVAPIDKeys();
  charter.push = { subject: charter.push?.subject || `mailto:${charter.keeper.email}`, publicKey };
  secrets.VAPID_PRIVATE_KEY = privateKey;
  if (APPLY) {
    writeFileSync(charterPath, JSON.stringify(charter, null, 2) + '\n');
    writeFileSync(secretsPath, JSON.stringify(secrets, null, 2) + '\n');
  }
  say(`    → VAPID pair minted (public into the charter, private into ${basename(secretsPath)})`);
} else if (!secrets.VAPID_PRIVATE_KEY) {
  say('    = the charter carries a push key; its private half is a functions secret already, or belongs in ' + basename(secretsPath));
}
for (const [name, value] of Object.entries(secrets)) {
  const tmp = resolve(ROOT, `.secret.${name}.tmp`);
  if (APPLY) writeFileSync(tmp, String(value));
  tryRun(`npx firebase functions:secrets:set ${name} --data-file ${tmp} --project ${P} --non-interactive`);
  if (APPLY) try { execSync(`rm -f ${tmp}`); } catch { /* fine */ }
}
if (!secrets.GEMINI_API_KEY && !secrets.ANTHROPIC_API_KEY) manual.push(`Add an AI key to ${basename(secretsPath)} (GEMINI_API_KEY or ANTHROPIC_API_KEY) and re-run, or the node's intelligences stay silent`);

// 7 · the derived files
say('7 · the derived files');
run(`node scripts/charter-sync.mjs ${charterPath}`, { always: true });

// 8 · the deploys — three, each within the ten-minute reach of a hand
say('8 · the deploys');
tryRun(`npx firebase deploy --only firestore:rules,storage --project ${P} --non-interactive`);
tryRun(`npx firebase deploy --only functions --project ${P} --non-interactive`);
tryRun(`npx firebase deploy --only hosting --project ${P} --non-interactive`);

// 9 · custody
say('9 · custody');
// declare-data-authority resolves the community at the node's own domain and writes config/dataAuthority.
tryRun(`node scripts/declare-data-authority.mjs --project ${P} --domain ${charter.domain}`);

// 10 · what only a console can do
manual.push(`Enable Storage once (the default bucket ${charter.firebase.bucket}): https://console.firebase.google.com/project/${P}/storage`);
manual.push(`Enable the Google sign-in provider and add ${[charter.domain, ...charter.aliases].join(', ')} to Auth → Authorized domains: https://console.firebase.google.com/project/${P}/authentication/providers`);
manual.push(`Sign in first as ${charter.keeper.email}: the shell claims the keeper's seat (config/superadmin) on that first visit`);
say('\n10 · by hand, at the console');
for (const m of manual) say(`    ○ ${m}`);
say(APPLY ? '\nThe node stands as far as a hand can reach. The rest is the console\'s.\n' : '\n(a plan — add --apply to make it so)\n');
