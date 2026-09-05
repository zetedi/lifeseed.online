// FACE PREVIEW, server side — the pure half, with no sharp or bucket in reach.
//
// Functions is its own TS project and cannot import src/domain, so this module MIRRORS
// src/domain/facePreview.ts. The mirror is held true by the ROOT test suite
// (tests/facePreview.test.ts imports BOTH and compares), the faceEvents arrangement.
//
// index.ts owns the plumbing: resolve the being, fetch its photo, walk the ladder with
// sharp, keep the result in the bucket, answer with JPEG bytes.

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
