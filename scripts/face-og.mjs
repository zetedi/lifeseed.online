#!/usr/bin/env node

/**
 * Face OG (ring 2026-08-16): each hosting face wears ITS community's Open Graph card.
 * Hosting serves the static index.html for "/" before rewrites can fire, so the front
 * door cannot be dressed at runtime the way /b/ beings are — instead this runs as the
 * face's PREDEPLOY hook and bakes the community's name, vision and hero into
 * dist/index.html just before that face uploads. Orchestrated EXPLICITLY by
 * `npm run deploy:faces` (build → app → patch perauset → deploy perauset → patch
 * theohouse → deploy theohouse) — per-target predeploy hooks were rejected because the
 * CLI's hook ordering across multi-site deploys is not guaranteed, and stacked patches
 * would dress every face in the last community's card.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Face → the community domain whose card it wears (mirror of the hosting targets).
const charter = JSON.parse(readFileSync(new URL('../node.json', import.meta.url), 'utf8'));
// Face → the door it wears: the charter's faces (node.json), never a list by heart.
const FACE_DOMAINS = Object.fromEntries(charter.faces.filter((f) => f.target !== 'app').map((f) => [f.target, f.door]));

const face = process.argv[2];
const domain = FACE_DOMAINS[face];
if (!domain) { console.error(`face-og: unknown face '${face}' — add it to FACE_DOMAINS.`); process.exit(1); }

initializeApp({ credential: applicationDefault(), projectId: charter.firebase.projectId });
const db = getFirestore();
let snap = await db.collection('communities').where('domain', '==', domain).limit(1).get();
// A face may answer at a DOOR (domainAliases) rather than the place's name — the seed
// subdomain shape. Same fallback as the app's getCommunityByDomain.
if (snap.empty) snap = await db.collection('communities').where('domainAliases', 'array-contains', domain).limit(1).get();
if (snap.empty) { console.warn(`face-og: no community at ${domain}; the face keeps the default card.`); process.exit(0); }
const c = snap.docs[0].data();

const strip = (html) => String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ').trim();
const truncate = (s, n) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const name = c.name || domain;
const description = truncate(strip(c.vision) || `${name} — a living community on the Lifetree Network.`, 160);
// The hero: the community's own, or its first landing section's image (the hearth).
const sectionImage = (Array.isArray(c.landingSections) ? c.landingSections : [])
  .map((s) => s?.props?.imageUrl).find((u) => typeof u === 'string' && /^https:\/\//.test(u));
// OG images must be ABSOLUTE — a relative hero (served from the face itself) is
// absolutized against the face's own domain.
const rawImage = c.heroImageUrl || sectionImage || '/og.png';
const image = /^https?:\/\//.test(rawImage) ? rawImage : `https://${domain}${rawImage.startsWith('/') ? '' : '/'}${rawImage}`;
const url = `https://${domain}`;

const p = 'dist/index.html';
let html = readFileSync(p, 'utf8');
const swaps = [
  [/<title>[^<]*<\/title>/, `<title>${esc(name)}</title>`],
  [/(<meta property="og:site_name" content=")[^"]*(")/, `$1${esc(name)}$2`],
  [/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(name)}$2`],
  [/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(description)}$2`],
  [/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`],
  [/(<meta property="og:image" content=")[^"]*(")/, `$1${esc(image)}$2`],
  [/(<meta name="description" content=")[^"]*(")/, `$1${esc(description)}$2`],
  [/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(name)}$2`],
  [/(<meta name="twitter:description" content=")[^"]*(")/, `$1${esc(description)}$2`],
  [/(<meta name="twitter:image" content=")[^"]*(")/, `$1${esc(image)}$2`],
];
let applied = 0;
for (const [re, sub] of swaps) if (re.test(html)) { html = html.replace(re, sub); applied++; }
writeFileSync(p, html);
console.log(`face-og: ${face} wears '${name}' (${applied} tags patched, image ${image.slice(0, 60)}…).`);
