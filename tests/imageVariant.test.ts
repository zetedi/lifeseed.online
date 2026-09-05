import { describe, it, expect } from 'vitest';
import {
  IMAGE_PRIMARY_MAX_EDGE, IMAGE_PRIMARY_QUALITY, IMAGE_VARIANT_SIZES, IMAGE_VARIANT_QUALITY,
  IMAGE_DERIVED_PREFIXES, isDerivedImagePath, imageVariantKeyOf, storageObjectOf, storageUrlOf, imageVariantUrlOf,
} from '../src/domain/imageVariant';
import {
  IMAGE_PRIMARY_MAX_EDGE as S_MAX_EDGE, IMAGE_PRIMARY_QUALITY as S_QUALITY,
  IMAGE_VARIANT_SIZES as S_SIZES, IMAGE_VARIANT_QUALITY as S_VQUALITY, IMAGE_DERIVED_PREFIXES as S_DERIVED,
  isDerivedImagePath as sIsDerivedImagePath, imageVariantKeyOf as sImageVariantKeyOf,
  storageObjectOf as sStorageObjectOf, imageVariantUrlOf as sImageVariantUrlOf,
} from '../functions/src/imageVariant';

// IMAGE VARIANT. The primary is stored once and shown many times; every seat asks for the
// variant that fits it and never loses the picture by asking. These tests hold the URL law,
// the derived-prefix guard, and the functions mirror.

const BUCKET = 'lifeseed-75dfe.firebasestorage.app';
const PATH = 'users/V8qnHz/watering/69IAML/1756492800000.webp';
const PRIMARY = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(PATH)}?alt=media&token=abc-123`;

describe('storageObjectOf — reading a download URL', () => {
  it('names the bucket and the decoded path', () => {
    expect(storageObjectOf(PRIMARY)).toEqual({ bucket: BUCKET, path: PATH });
    expect(storageObjectOf(`https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/trees%2Fa%20b.png`)).toEqual({ bucket: BUCKET, path: 'trees/a b.png' });
  });

  it('refuses every other shape', () => {
    expect(storageObjectOf('https://lh3.googleusercontent.com/a/photo=s96')).toBe(null);
    expect(storageObjectOf('https://storage.googleapis.com/bucket/o/x.png')).toBe(null);
    expect(storageObjectOf('data:image/png;base64,AAAA')).toBe(null);
    expect(storageObjectOf('')).toBe(null);
    expect(storageObjectOf(`https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/%E0%A4%A`)).toBe(null); // bad escape
  });
});

describe('the variant key and URL', () => {
  it('rests under thumbs/, beside the primary, named for its seat', () => {
    expect(imageVariantKeyOf(PATH, 480)).toBe(`thumbs/${PATH}@480.webp`);
    expect(imageVariantKeyOf(PATH, 1200)).toBe(`thumbs/${PATH}@1200.webp`);
  });

  it('answers a tokenless URL for the variant of a primary in our bucket', () => {
    expect(imageVariantUrlOf(PRIMARY, 480)).toBe(storageUrlOf(BUCKET, `thumbs/${PATH}@480.webp`));
    expect(imageVariantUrlOf(PRIMARY, 480)).toContain('/o/thumbs%2Fusers%2FV8qnHz%2F');
    expect(imageVariantUrlOf(PRIMARY, 480)).toMatch(/%40480\.webp\?alt=media$/);
  });

  it('hands back the primary untouched when no variant can be named', () => {
    const foreign = 'https://lh3.googleusercontent.com/a/photo=s96';
    expect(imageVariantUrlOf(foreign, 480)).toBe(foreign);
    expect(imageVariantUrlOf('data:image/png;base64,AAAA', 480)).toBe('data:image/png;base64,AAAA');
    expect(imageVariantUrlOf('/mahameru.svg', 480)).toBe('/mahameru.svg');
    expect(imageVariantUrlOf('', 480)).toBe('');
    expect(imageVariantUrlOf(undefined, 480)).toBe('');
    expect(imageVariantUrlOf(null, 1200)).toBe('');
  });

  it('never derives from a derived object', () => {
    const variant = imageVariantUrlOf(PRIMARY, 480);
    expect(imageVariantUrlOf(variant, 480)).toBe(variant);
    const preview = storageUrlOf(BUCKET, 'previews/019f/abc.jpg');
    expect(imageVariantUrlOf(preview, 1200)).toBe(preview);
    for (const p of IMAGE_DERIVED_PREFIXES) expect(isDerivedImagePath(`${p}x/y.webp`)).toBe(true);
    expect(isDerivedImagePath('users/x/y.webp')).toBe(false);
    expect(isDerivedImagePath('thumbsup/x.webp')).toBe(false);
  });
});

describe('the one truth for a primary', () => {
  it('caps the edge and names the quality', () => {
    expect(IMAGE_PRIMARY_MAX_EDGE).toBe(1600);
    expect(IMAGE_PRIMARY_QUALITY).toBeGreaterThan(0);
    expect(IMAGE_PRIMARY_QUALITY).toBeLessThanOrEqual(100);
    for (const s of IMAGE_VARIANT_SIZES) expect(s).toBeLessThanOrEqual(IMAGE_PRIMARY_MAX_EDGE);
    expect(IMAGE_VARIANT_QUALITY).toBeLessThanOrEqual(100);
  });
});

describe('the functions mirror stays true', () => {
  it('carries the same constants', () => {
    expect(S_MAX_EDGE).toBe(IMAGE_PRIMARY_MAX_EDGE);
    expect(S_QUALITY).toBe(IMAGE_PRIMARY_QUALITY);
    expect([...S_SIZES]).toEqual([...IMAGE_VARIANT_SIZES]);
    expect(S_VQUALITY).toBe(IMAGE_VARIANT_QUALITY);
    expect([...S_DERIVED]).toEqual([...IMAGE_DERIVED_PREFIXES]);
  });

  it('reads, guards and names identically', () => {
    for (const u of [PRIMARY, 'https://lh3.googleusercontent.com/a', 'data:x', '', `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/thumbs%2Fa%40480.webp`]) {
      expect(sStorageObjectOf(u)).toEqual(storageObjectOf(u));
      expect(sImageVariantUrlOf(u, 480)).toBe(imageVariantUrlOf(u, 480));
      expect(sImageVariantUrlOf(u, 1200)).toBe(imageVariantUrlOf(u, 1200));
    }
    for (const p of ['thumbs/a', 'previews/a', 'originals/a', 'users/a', '']) {
      expect(sIsDerivedImagePath(p)).toBe(isDerivedImagePath(p));
      expect(sImageVariantKeyOf(p, 480)).toBe(imageVariantKeyOf(p, 480));
    }
  });
});
