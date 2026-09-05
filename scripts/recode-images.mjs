#!/usr/bin/env node
/**
 * Recode the primary pictures (ring 2026-09-06). Every raster image object in the bucket is
 * re-encoded IN PLACE — fitted inside MAX_EDGE, WebP at QUALITY — at the SAME path with the
 * SAME download token, so every stored URL (the string the chain binds) keeps answering and
 * no block is re-hashed. The as-uploaded bytes are copied to originals/<path> first, metadata
 * and all, never deleted. An object that would not shrink by a tenth is rewritten with its
 * own bytes under an honest label instead, so the finalize trigger kindles its variants too.
 * Dry run by default; `--apply` writes.
 *
 *   node scripts/recode-images.mjs                       # report, nothing written
 *   node scripts/recode-images.mjs --apply               # recode + back up + kindle variants
 *   node scripts/recode-images.mjs --prefix=trees/       # one folder
 *   node scripts/recode-images.mjs --limit=5 --apply     # a first careful handful
 *
 * Runs with the machine's application-default credentials, like repair-image-types.mjs.
 * sharp is resolved from functions/ (the one place it is installed).
 */
import { createRequire } from 'node:module';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const sharp = require('sharp');

const BUCKET = 'lifeseed-75dfe.firebasestorage.app';
// Mirrors of domain/imageVariant: IMAGE_PRIMARY_MAX_EDGE, IMAGE_PRIMARY_QUALITY, IMAGE_DERIVED_PREFIXES.
const MAX_EDGE = 1600;
const QUALITY = 82;
const DERIVED = ['thumbs/', 'previews/', 'originals/'];
const SHRINK = 0.9; // recode only when the new bytes are under nine tenths of the old
const RASTER = /^image\/(jpeg|jpg|png|webp|gif|heic|heif|avif|tiff)$/i;

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const PREFIX = arg('prefix') ?? '';
const LIMIT = Number(arg('limit') ?? Infinity);
const APPLY = process.argv.includes('--apply');

// Mirror of src/domain/imageBytes.sniffImageKind, as a MIME (scripts cannot import the TS domain).
const sniff = (b) => {
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
    && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
  return null;
};
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;

initializeApp({ credential: applicationDefault(), projectId: 'lifeseed-75dfe' });
const bucket = getStorage().bucket(BUCKET);
const [all] = await bucket.getFiles({ prefix: PREFIX });
const files = all
  .filter((f) => !DERIVED.some((p) => f.name.startsWith(p)) && RASTER.test(String(f.metadata?.contentType || '')))
  .slice(0, LIMIT);
console.log(`${files.length} primary pictures under '${PREFIX || '(all)'}' — ${APPLY ? 'APPLY' : 'dry run'}\n`);

let before = 0, after = 0, recoded = 0, kept = 0, failed = 0;
for (const file of files) {
  try {
    const [meta] = await file.getMetadata();
    const size = Number(meta.size || 0);
    const custom = meta.metadata || {};
    const token = custom.firebaseStorageDownloadTokens;
    const [src] = await file.download();
    const real = sniff(src);
    const info = await sharp(src, { failOn: 'none', limitInputPixels: 80e6 }).metadata();
    const out = await sharp(src, { failOn: 'none', limitInputPixels: 80e6 })
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer();
    const shrink = out.length < size * SHRINK;
    before += size;
    after += shrink ? out.length : size;
    const mark = shrink ? (APPLY ? '→' : '·') : '=';
    console.log(`  ${mark} ${file.name}\n      ${meta.contentType}${real && real !== meta.contentType ? ` (bytes: ${real})` : ''} ${info.width}x${info.height} ${kb(size)} → ${kb(out.length)}${shrink ? '' : '  kept'}${token ? '' : '  [no token]'}`);
    if (!APPLY) continue;

    if (shrink) {
      const backup = bucket.file(`originals/${file.name}`);
      const [has] = await backup.exists();
      if (!has) await file.copy(backup); // bytes and metadata travel, the token with them
      await file.save(out, {
        contentType: 'image/webp',
        resumable: false,
        metadata: { metadata: { ...custom, recodedFrom: real || String(meta.contentType), recodedAt: new Date().toISOString() } },
      });
      recoded++;
    } else {
      // The same bytes, written once more under an honest label: the trigger makes the variants.
      await file.save(src, { contentType: real || meta.contentType, resumable: false, metadata: { metadata: { ...custom } } });
      kept++;
    }
    if (token) {
      const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(file.name)}?alt=media&token=${token}`;
      const r = await fetch(url, { method: 'HEAD' });
      if (!r.ok) { failed++; console.log(`      !! the stored URL now answers ${r.status}`); }
    }
  } catch (e) {
    failed++;
    console.log(`  !! ${file.name}: ${e.message}`);
  }
}
console.log(`\n${files.length} pictures · before ${mb(before)} · after ${mb(after)}${APPLY ? ` · recoded ${recoded} · kept ${kept}` : ''} · failed ${failed}`);
