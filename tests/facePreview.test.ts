import { describe, it, expect } from 'vitest';
import {
  FACE_PREVIEW_MAX_EDGE, FACE_PREVIEW_MAX_BYTES, FACE_PREVIEW_EDGES, FACE_PREVIEW_QUALITIES,
  facePreviewAttempts, facePreviewDoorOf, facePreviewDigestOf, facePreviewKeyOf, facePreviewUrlOf,
} from '../src/domain/facePreview';
import {
  FACE_PREVIEW_MAX_EDGE as SERVER_MAX_EDGE,
  FACE_PREVIEW_MAX_BYTES as SERVER_MAX_BYTES,
  facePreviewAttempts as serverFacePreviewAttempts,
  facePreviewDoorOf as serverFacePreviewDoorOf,
  facePreviewDigestOf as serverFacePreviewDigestOf,
  facePreviewKeyOf as serverFacePreviewKeyOf,
  facePreviewUrlOf as serverFacePreviewUrlOf,
} from '../functions/src/facePreview';

// FACE PREVIEW. A shared door hands crawlers a small, honest JPEG of the being's own
// photo instead of the stored original. These tests hold the ladder, the door, and the
// cache key — and hold the functions mirror true against the domain law.

const DOOR = '033oN66moGj2LLRqK2R76R';
const LID = '019f57e8-878a-75ff-be0e-7d3913b4b2f3';
const FIRE = 'https://firebasestorage.googleapis.com/v0/b/x/o/users%2Fa%2Fwatering%2Ft%2F1.webp?alt=media&token=abc';

describe('facePreviewAttempts — the ladder', () => {
  it('starts at the largest edge and finest quality, then steps quality before edge', () => {
    const steps = facePreviewAttempts();
    expect(steps[0]).toEqual({ edge: 1200, quality: 82 });
    expect(steps[1]).toEqual({ edge: 1200, quality: 70 });
    expect(steps[3]).toEqual({ edge: 960, quality: 82 });
    expect(steps.at(-1)).toEqual({ edge: 720, quality: 58 });
    expect(steps).toHaveLength(FACE_PREVIEW_EDGES.length * FACE_PREVIEW_QUALITIES.length);
  });

  it('never asks for an edge beyond the max, and the budget sits under WhatsApp\'s ceiling', () => {
    for (const { edge } of facePreviewAttempts()) expect(edge).toBeLessThanOrEqual(FACE_PREVIEW_MAX_EDGE);
    expect(FACE_PREVIEW_MAX_BYTES).toBeLessThanOrEqual(300_000);
  });
});

describe('facePreviewDoorOf — which face is asked for', () => {
  it('accepts the doors /b/ accepts, with or without the .jpg', () => {
    expect(facePreviewDoorOf(`/face/${DOOR}.jpg`)).toBe(DOOR);
    expect(facePreviewDoorOf(`/face/${DOOR}.jpeg`)).toBe(DOOR);
    expect(facePreviewDoorOf(`/face/${DOOR}`)).toBe(DOOR);
    expect(facePreviewDoorOf(`/face/${DOOR}.jpg/`)).toBe(DOOR);
    expect(facePreviewDoorOf(`/face/${LID}.jpg`)).toBe(LID);
  });

  it('refuses what is not a face door', () => {
    expect(facePreviewDoorOf(`/b/${DOOR}`)).toBe(null);
    expect(facePreviewDoorOf('/face/short.jpg')).toBe(null);
    expect(facePreviewDoorOf(`/face/${DOOR}.png`)).toBe(null);
    expect(facePreviewDoorOf(`/face/${DOOR}/extra.jpg`)).toBe(null);
    expect(facePreviewDoorOf('/face/../og.png')).toBe(null);
    expect(facePreviewDoorOf('')).toBe(null);
  });
});

describe('the digest, key and URL — a new photo is a new address', () => {
  it('is deterministic, 16 hex chars, and moves with the source', () => {
    const d = facePreviewDigestOf(FIRE);
    expect(d).toMatch(/^[0-9a-f]{16}$/);
    expect(facePreviewDigestOf(FIRE)).toBe(d);
    expect(facePreviewDigestOf(FIRE.replace('token=abc', 'token=abd'))).not.toBe(d);
    expect(facePreviewDigestOf(FIRE.replace('1.webp', '2.webp'))).not.toBe(d);
    expect(facePreviewDigestOf('')).toMatch(/^[0-9a-f]{16}$/);
  });

  it('rests the preview by true name and source, and points the card at the same digest', () => {
    const d = facePreviewDigestOf(FIRE);
    expect(facePreviewKeyOf(LID, FIRE)).toBe(`previews/${LID}/${d}.jpg`);
    expect(facePreviewUrlOf('seed.theohouse.org', DOOR, FIRE)).toBe(`https://seed.theohouse.org/face/${DOOR}.jpg?v=${d}`);
  });
});

describe('the functions mirror stays true', () => {
  it('carries the same limits', () => {
    expect(SERVER_MAX_EDGE).toBe(FACE_PREVIEW_MAX_EDGE);
    expect(SERVER_MAX_BYTES).toBe(FACE_PREVIEW_MAX_BYTES);
  });

  it('walks, parses and names identically', () => {
    expect(serverFacePreviewAttempts()).toEqual(facePreviewAttempts());
    for (const p of [`/face/${DOOR}.jpg`, `/face/${LID}`, `/b/${DOOR}`, '/face/x.jpg', '']) {
      expect(serverFacePreviewDoorOf(p)).toBe(facePreviewDoorOf(p));
    }
    for (const s of [FIRE, '', 'https://a/b.png', 'ünïcödé']) {
      expect(serverFacePreviewDigestOf(s)).toBe(facePreviewDigestOf(s));
      expect(serverFacePreviewKeyOf(LID, s)).toBe(facePreviewKeyOf(LID, s));
      expect(serverFacePreviewUrlOf('lightseed.online', DOOR, s)).toBe(facePreviewUrlOf('lightseed.online', DOOR, s));
    }
  });
});
