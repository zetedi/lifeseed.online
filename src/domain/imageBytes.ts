// IMAGE BYTES — what a picture actually IS, read from its first bytes, never from a name or a
// declared type. A canvas asked for WebP on a browser that cannot encode it (Safari, iOS)
// silently answers with PNG; uploads then wore `image/webp` over PNG bytes, and the share
// card's crawler, trusting the label, could not decode the face (ring 2026-09-05). This law
// names the kind from the magic bytes so the upload labels what it holds — and the repair
// script relabels what was stored.
export type ImageKind = 'webp' | 'png' | 'jpeg' | 'gif';

export const IMAGE_MIME: Record<ImageKind, string> = {
  webp: 'image/webp', png: 'image/png', jpeg: 'image/jpeg', gif: 'image/gif',
};
export const IMAGE_EXT: Record<ImageKind, string> = { webp: 'webp', png: 'png', jpeg: 'jpg', gif: 'gif' };

// The kind of an image from its leading bytes (≥ 12 for WebP's RIFF....WEBP), or null.
export const sniffImageKind = (bytes: Uint8Array): ImageKind | null => {
  if (bytes.length >= 12
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'webp';
  if (bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46
    && bytes[3] === 0x38 && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) return 'gif';
  return null;
};

// The kind a MIME type names, or null for anything that is not one of ours.
export const imageKindOfMime = (mime: string | undefined | null): ImageKind | null => {
  const m = (mime || '').toLowerCase().split(';')[0].trim();
  return (Object.keys(IMAGE_MIME) as ImageKind[]).find(k => IMAGE_MIME[k] === m) || (m === 'image/jpg' ? 'jpeg' : null);
};

// A stored object's honest label: the bytes' own kind (whatever the object was declared as),
// or null when the bytes are not an image we know.
export const honestImageMime = (bytes: Uint8Array): string | null => {
  const real = sniffImageKind(bytes);
  return real ? IMAGE_MIME[real] : null;
};

// A path's file name re-suffixed for the kind it really is (`a/b/1.webp` → `a/b/1.jpg`).
export const withImageExtension = (path: string, kind: ImageKind): string =>
  `${path.replace(/\.[^./]+$/, '')}.${IMAGE_EXT[kind]}`;
