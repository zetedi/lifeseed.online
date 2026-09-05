// IMAGE VARIANT, server side — the pure half, with no sharp or bucket in reach.
//
// Functions is its own TS project and cannot import src/domain, so this module MIRRORS
// src/domain/imageVariant.ts. The mirror is held true by the ROOT test suite
// (tests/imageVariant.test.ts imports BOTH and compares), the faceEvents arrangement.
//
// index.ts owns the plumbing: on every primary finalized in the bucket, make its variants.

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
