// IMAGE VARIANT — the picture, served small; the primary, made light.
//
// A being's picture is stored once (the PRIMARY, at its download URL — the string the chain
// binds) and shown many times: a card in the forest, an avatar in the navigation, a share
// card, a hero. Until ring 2026-09-06 every showing fetched the primary — 27 public trees
// cost 182 MB, a median tree 4 MB. Now every primary written to the bucket gets DERIVED
// VARIANTS (functions/deriveImageVariants, on object finalize): thumbs/<path>@480.webp and
// @1200.webp, fitted inside, never enlarged, immutable-cached, readable without a token
// (storage.rules already open every path to reading). Renderers ask for the variant their
// seat needs through imageVariantUrlOf and fall back to the primary when it is not (yet)
// there.
//
// Plain contract — guaranteed now: storageObjectOf reads exactly Firebase's download-URL
// shape (/v0/b/<bucket>/o/<encoded path>) and nothing else; imageVariantKeyOf is
// deterministic in (path, size) and lands under thumbs/; isDerivedImagePath names every
// prefix a derivation must never read from (thumbs/, previews/, originals/), so a derived
// object never derives again; imageVariantUrlOf returns the primary untouched for anything
// it cannot name (a foreign URL, a data: URL, a derived path, an empty string) — a caller
// never loses its picture by asking. IMAGE_PRIMARY_MAX_EDGE / IMAGE_PRIMARY_QUALITY are the
// one truth for how a primary is encoded, on upload (services/firebase/media) and in the
// recode of what was stored before (scripts/recode-images.mjs, which mirrors them). Not
// guaranteed: that a variant exists at the moment it is asked for (the trigger runs seconds
// after the upload; the fallback covers the gap), or any variant for a picture outside our
// bucket. Enforced by tests/imageVariant.test.ts, which holds the functions mirror true.

// How a primary is encoded: the longest edge, and the WebP quality (0–100).
export const IMAGE_PRIMARY_MAX_EDGE = 1600;
export const IMAGE_PRIMARY_QUALITY = 82;

// The seats a picture is shown in: cards and avatars (480), heroes and shares (1200).
export const IMAGE_VARIANT_SIZES = [480, 1200] as const;
export type ImageVariantSize = (typeof IMAGE_VARIANT_SIZES)[number];
export const IMAGE_VARIANT_QUALITY = 80;
export const IMAGE_VARIANT_PREFIX = 'thumbs/';

// What is made FROM a primary, and must never be made from again.
export const IMAGE_DERIVED_PREFIXES = ['thumbs/', 'previews/', 'originals/'] as const;
export const isDerivedImagePath = (path: string): boolean =>
  IMAGE_DERIVED_PREFIXES.some((p) => path.startsWith(p));

// Where a primary's variant rests: beside its own path, under thumbs/, named for its seat.
export const imageVariantKeyOf = (path: string, size: ImageVariantSize): string =>
  `${IMAGE_VARIANT_PREFIX}${path}@${size}.webp`;

// Firebase's download-URL shape, and nothing else: the bucket and the object path it names.
const DOWNLOAD_URL_RE = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^/?#]+)\/o\/([^?#]+)/;
export const storageObjectOf = (url: string): { bucket: string; path: string } | null => {
  const m = DOWNLOAD_URL_RE.exec(url || '');
  if (!m) return null;
  try {
    return { bucket: m[1], path: decodeURIComponent(m[2]) };
  } catch {
    return null;
  }
};

// A tokenless download URL — enough where the rules open the path to reading.
export const storageUrlOf = (bucket: string, path: string): string =>
  `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;

// The variant a seat should ask for — or the primary itself, when no variant can be named.
export const imageVariantUrlOf = (url: string | null | undefined, size: ImageVariantSize): string => {
  if (!url) return '';
  const obj = storageObjectOf(url);
  if (!obj || isDerivedImagePath(obj.path)) return url;
  return storageUrlOf(obj.bucket, imageVariantKeyOf(obj.path, size));
};
