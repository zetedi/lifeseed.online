// FACE PREVIEW — the small, honest picture a shared door hands to whoever unfurls it.
//
// A being's own photo can weigh 2–28 MB (ring 2026-09-05, "the label follows the bytes":
// the label is honest now, the bytes stay large). Share-card crawlers cap what they will
// fetch — WhatsApp near 300 KB, most others 5–8 MB — so the /b/ card no longer points
// og:image at the stored original. It points at /face/<door>.jpg, served by
// functions/facePreview: the same photo, fitted inside FACE_PREVIEW_MAX_EDGE and
// JPEG-encoded down a ladder of (edge, quality) until it weighs under
// FACE_PREVIEW_MAX_BYTES, then kept in the bucket under a key derived from the source —
// a new photo makes a new preview, an old one is never rebuilt.
//
// Plain contract — guaranteed now: facePreviewAttempts is the encode order, largest edge
// and finest quality first, every edge within the max; facePreviewDoorOf accepts exactly
// /face/<door>.jpg (or .jpeg, or bare) for the same doors /b/ accepts; facePreviewDigestOf
// is deterministic and changes whenever the source string does (a cache key, not a
// signature); facePreviewKeyOf and facePreviewUrlOf carry that digest, so a changed photo
// is a changed key in the bucket and a changed ?v= to every crawler's cache. Not
// guaranteed: that the last attempt lands under the budget (a pathological picture may
// not — the handler serves the smallest it made), or that every platform fetches it (their
// rules are theirs). Enforced by tests/facePreview.test.ts, which holds the
// functions/src/facePreview.ts mirror true.

export const FACE_PREVIEW_MAX_EDGE = 1200;
export const FACE_PREVIEW_MAX_BYTES = 250_000;
export const FACE_PREVIEW_EDGES = [1200, 960, 720] as const;
export const FACE_PREVIEW_QUALITIES = [82, 70, 58] as const;

export type FacePreviewAttempt = { edge: number; quality: number };

// The ladder: hold the edge, step the quality down; then the next edge. Largest and finest
// first, so the first attempt under the budget is also the best-looking one.
export const facePreviewAttempts = (): FacePreviewAttempt[] =>
  FACE_PREVIEW_EDGES.flatMap((edge) => FACE_PREVIEW_QUALITIES.map((quality) => ({ edge, quality })));

// /face/<door>.jpg — the door is whatever /b/ accepts (22-char base62 or a UUID form);
// the suffix is optional so a bare /face/<door> answers too. Anything else is not a face.
const FACE_DOOR_RE = /^\/face\/([0-9a-zA-Z-]{8,})(?:\.jpe?g)?\/?$/;
export const facePreviewDoorOf = (path: string): string | null =>
  (path.match(FACE_DOOR_RE) || [])[1] ?? null;

// FNV-1a over the string's UTF-16 units, run twice with different seeds → 16 hex chars.
// Dependency-free and identical in browser and node; it only has to change when the
// source does.
const fnv1a = (s: string, seed: number): string => {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
};
export const facePreviewDigestOf = (source: string): string =>
  fnv1a(source, 0x811c9dc5) + fnv1a(source, 0x811c9dc5 ^ 0x5bd1e995);

// Where the made preview rests in the bucket: by the being's true name, then the source.
export const facePreviewKeyOf = (lid: string, source: string): string =>
  `previews/${lid}/${facePreviewDigestOf(source)}.jpg`;

// The address the share card points at; ?v= is the digest, so a new photo is a new URL.
export const facePreviewUrlOf = (host: string, door: string, source: string): string =>
  `https://${host}/face/${door}.jpg?v=${facePreviewDigestOf(source)}`;
