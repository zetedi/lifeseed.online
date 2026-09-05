import { describe, it, expect } from 'vitest';
import { sniffImageKind, imageKindOfMime, honestImageMime, withImageExtension, IMAGE_MIME } from '../src/domain/imageBytes';

const bytes = (...b: number[]) => new Uint8Array(b);
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe1, 0x12, 0x34, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00);
const GIF = bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00);

describe('sniffImageKind — the kind from the bytes, never the name', () => {
  it('knows the four kinds', () => {
    expect(sniffImageKind(WEBP)).toBe('webp');
    expect(sniffImageKind(PNG)).toBe('png');
    expect(sniffImageKind(JPEG)).toBe('jpeg');
    expect(sniffImageKind(GIF)).toBe('gif');
  });
  it('refuses what it cannot name: text, a RIFF that is not WebP, too few bytes', () => {
    expect(sniffImageKind(new TextEncoder().encode('<!doctype html>'))).toBeNull();
    expect(sniffImageKind(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20))).toBeNull(); // AVI
    expect(sniffImageKind(bytes(0x89, 0x50))).toBeNull();
    expect(sniffImageKind(new Uint8Array())).toBeNull();
  });
});

describe('the honest label', () => {
  it('a PNG wearing image/webp (the Safari fallback) is relabelled PNG', () => {
    expect(honestImageMime(PNG)).toBe('image/png');
  });
  it('a label the bytes agree with stands', () => {
    expect(honestImageMime(WEBP)).toBe('image/webp');
    expect(honestImageMime(JPEG)).toBe('image/jpeg');
  });
  it('bytes that are not an image we know get no label', () => {
    expect(honestImageMime(new TextEncoder().encode('nope'))).toBeNull();
  });
  it('reads MIME types back into kinds, including the loose image/jpg', () => {
    expect(imageKindOfMime('image/webp')).toBe('webp');
    expect(imageKindOfMime('image/jpg')).toBe('jpeg');
    expect(imageKindOfMime('IMAGE/PNG; charset=binary')).toBe('png');
    expect(imageKindOfMime('text/html')).toBeNull();
    expect(imageKindOfMime(undefined)).toBeNull();
  });
});

describe('withImageExtension', () => {
  it('re-suffixes the file for its true kind, leaving folders with dots alone', () => {
    expect(withImageExtension('users/u/watering/t/1.webp', 'jpeg')).toBe('users/u/watering/t/1.jpg');
    expect(withImageExtension('users/u.x/trees/1', 'png')).toBe('users/u.x/trees/1.png');
    expect(withImageExtension('a/b/c.png', 'webp')).toBe('a/b/c.webp');
    for (const k of Object.keys(IMAGE_MIME) as (keyof typeof IMAGE_MIME)[]) expect(withImageExtension('x/y.z', k)).toMatch(/^x\/y\.[a-z]+$/);
  });
});
