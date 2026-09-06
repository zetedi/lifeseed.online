#!/usr/bin/env node
/**
 * Charter sync (ring 2026-09-06): node.json is what a node IS; this derives every file that
 * must agree with it and writes them only when they differ —
 *   functions/src/charter.json          the server's copy (functions cannot import the repo)
 *   public/.well-known/lightseed.json   the node's public envelope (what a stranger may know)
 *   .firebaserc                         the project and the hosting targets
 *   firebase.json (hosting)             one entry per face, the first entry's shape as template
 * Mirrors the derivations of src/domain/charter.ts (charterPublicOf, firebasercOf, hostingOf);
 * tests/charter.test.ts holds the mirror and the written files true.
 *
 *   node scripts/charter-sync.mjs            # write what differs
 *   node scripts/charter-sync.mjs --check    # exit 1 if anything would change
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const charterPath = process.argv.find((a) => a.endsWith('.json') && !a.startsWith('--')) || resolve(ROOT, 'node.json');
const charter = JSON.parse(readFileSync(charterPath, 'utf8'));

// A minimal echo of charterProblem — the domain law is the truth; this refuses only what
// would make the derived files nonsense.
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DOMAIN = /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/;
const fail = (why) => { console.error(`charter-sync: ${why}`); process.exit(1); };
if (charter.version !== 1) fail('version must be 1');
if (!UUID_V7.test(charter.nodeLid || '')) fail('nodeLid is not a true name');
if (!DOMAIN.test(charter.domain || '')) fail('domain is not a domain');
if (!Array.isArray(charter.faces) || charter.faces.length === 0) fail('no faces');
if (!charter.firebase?.projectId) fail('no firebase.projectId');

const publicOf = (c) => ({
  version: c.version, nodeLid: c.nodeLid, name: c.name, shortName: c.shortName, tagline: c.tagline,
  domain: c.domain, aliases: [...c.aliases], repo: c.repo,
  faces: c.faces.map((f) => ({ door: f.door, domains: [...f.domains] })),
  push: { publicKey: c.push.publicKey },
});
const firebasercOf = (c) => ({
  projects: { default: c.firebase.projectId },
  targets: { [c.firebase.projectId]: { hosting: Object.fromEntries(c.faces.map((f) => [f.target, [f.site]])) } },
  etags: {},
});

const pretty = (v) => JSON.stringify(v, null, 2) + '\n';
let changed = 0;
const put = (rel, content) => {
  const abs = resolve(ROOT, rel);
  const before = existsSync(abs) ? readFileSync(abs, 'utf8') : null;
  if (before === content) { console.log(`  = ${rel}`); return; }
  changed++;
  if (CHECK) { console.log(`  ! ${rel} would change`); return; }
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  console.log(`  → ${rel}`);
};

console.log(`charter: ${charter.name} · ${charter.domain} · ${charter.faces.length} faces · ${charter.firebase.projectId}`);
put('functions/src/charter.json', pretty(charter));
put('public/.well-known/lightseed.json', pretty(publicOf(charter)));
put('.firebaserc', pretty(firebasercOf(charter)).trimEnd());

const fbPath = resolve(ROOT, 'firebase.json');
const fb = JSON.parse(readFileSync(fbPath, 'utf8'));
const entries = Array.isArray(fb.hosting) ? fb.hosting : [fb.hosting];
// Mirror of hostingOf: the first face alone keeps the predeploy build (face-og dresses the rest).
const { target: _t, predeploy, ...template } = entries[0];
fb.hosting = charter.faces.map((f, i) => ({ target: f.target, ...(i === 0 && predeploy !== undefined ? { predeploy } : {}), ...template }));
put('firebase.json', pretty(fb).trimEnd() + '\n');

if (CHECK && changed) { console.error(`charter-sync: ${changed} file(s) out of step with node.json — run \`npm run charter\`.`); process.exit(1); }
console.log(changed ? `${changed} file(s) written.` : 'everything agrees with node.json.');
