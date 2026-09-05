#!/usr/bin/env node
/**
 * Repair image labels (ring 2026-09-05): uploads encoded on Safari / iOS wore `image/webp`
 * over PNG bytes (the canvas answers a WebP request with PNG where it cannot encode WebP),
 * and share-card crawlers, trusting the label, could not decode a tree's face. This walks
 * the bucket's user uploads, reads the first bytes of every object labelled image/webp,
 * and relabels the ones whose bytes say otherwise — METADATA ONLY: no byte is rewritten,
 * no URL changes, the download token stays. Dry run by default; `--apply` writes.
 *
 *   node scripts/repair-image-types.mjs            # report what would change
 *   node scripts/repair-image-types.mjs --apply    # relabel
 *
 * Runs with the machine's application-default credentials, like face-og.mjs.
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

const BUCKET = 'lifeseed-75dfe.firebasestorage.app';
const PREFIX = process.argv.find(a => a.startsWith('--prefix='))?.slice('--prefix='.length) ?? 'users/';
const APPLY = process.argv.includes('--apply');

// Mirror of src/domain/imageBytes.sniffImageKind (scripts cannot import the TS domain).
const sniff = (b) => {
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
    && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
    && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38
    && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) return 'image/gif';
  return null;
};

initializeApp({ credential: applicationDefault(), projectId: 'lifeseed-75dfe' });
const bucket = getStorage().bucket(BUCKET);
const [files] = await bucket.getFiles({ prefix: PREFIX });
console.log(`${files.length} objects under ${PREFIX} (${APPLY ? 'APPLY' : 'dry run'})`);

let looked = 0, mislabelled = 0, fixed = 0, unknown = 0;
const bytesOf = new Map();
for (const file of files) {
  const declared = String(file.metadata?.contentType || '');
  if (!declared.startsWith('image/')) continue;
  looked++;
  const [head] = await file.download({ start: 0, end: 15 });
  const real = sniff(head);
  if (!real) { unknown++; console.log(`  ? ${file.name} (${declared}) — bytes not a known image`); continue; }
  if (real === declared) continue;
  mislabelled++;
  const size = Number(file.metadata?.size || 0);
  bytesOf.set(real, (bytesOf.get(real) || 0) + size);
  console.log(`  ${APPLY ? '→' : '·'} ${file.name}: ${declared} → ${real} (${(size / 1024).toFixed(0)} KB)`);
  if (APPLY) {
    await file.setMetadata({ contentType: real }); // merges: the download token survives
    fixed++;
  }
}
console.log(`looked at ${looked} images · mislabelled ${mislabelled} · ${APPLY ? `relabelled ${fixed}` : 'nothing written'} · unknown ${unknown}`);
