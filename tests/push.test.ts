import { describe, it, expect } from 'vitest';
import { PUSH_BODY_MAX, pushSubscriptionIdOf, notificationOf } from '../src/domain/push';
import {
  PUSH_BODY_MAX as S_MAX, pushSubscriptionIdOf as sPushSubscriptionIdOf, notificationOf as sNotificationOf,
} from '../functions/src/push';

// PUSH. A reach knocks on the device with one small notice; the law of what is said and where
// a subscription rests lives in the domain, and the functions mirror must say the same.

const reach = (over: Record<string, unknown> = {}) => ({
  type: 'reach', authorName: "Ana's oak", content: 'Ana offered «A night of song» to your tree. Answer on its leaf.',
  threadId: 'treeA__treeB', ...over,
});

describe('pushSubscriptionIdOf — where a subscription rests', () => {
  it('is deterministic, document-safe, and moves with the endpoint', () => {
    const id = pushSubscriptionIdOf('https://fcm.googleapis.com/fcm/send/abc');
    expect(id).toMatch(/^[0-9a-f]{16}$/);
    expect(pushSubscriptionIdOf('https://fcm.googleapis.com/fcm/send/abc')).toBe(id);
    expect(pushSubscriptionIdOf('https://fcm.googleapis.com/fcm/send/abd')).not.toBe(id);
  });
});

describe('notificationOf — what is said', () => {
  it('speaks the author, the words, and opens the app', () => {
    expect(notificationOf(reach(), 'https://lightseed.online')).toEqual({
      title: "Ana's oak",
      body: 'Ana offered «A night of song» to your tree. Answer on its leaf.',
      url: 'https://lightseed.online/',
      tag: 'treeA__treeB',
    });
  });

  it('opens the door the reach carries, and only a /b/ door', () => {
    expect(notificationOf(reach({ door: '/b/033oN66moGj2LLRqK2R76R' }), 'https://seed.theohouse.org/')!.url).toBe('https://seed.theohouse.org/b/033oN66moGj2LLRqK2R76R');
    expect(notificationOf(reach({ door: 'https://evil.example/' }), 'https://lightseed.online')!.url).toBe('https://lightseed.online/');
    expect(notificationOf(reach({ door: '/u/x' }), 'https://lightseed.online')!.url).toBe('https://lightseed.online/');
  });

  it('trims long words, collapses whitespace, falls back on body and a plain name', () => {
    const long = 'x'.repeat(400);
    const n = notificationOf(reach({ content: long }), 'https://lightseed.online')!;
    expect(n.body.length).toBeLessThanOrEqual(PUSH_BODY_MAX);
    expect(n.body.endsWith('…')).toBe(true);
    expect(notificationOf(reach({ content: '', body: '  hello\n world ' }), 'https://x')!.body).toBe('hello world');
    expect(notificationOf(reach({ authorName: undefined, threadId: undefined }), 'https://x')).toMatchObject({ title: 'A lightseed', tag: 'reach' });
  });

  it('knocks for reaches alone', () => {
    expect(notificationOf(reach({ type: 'tree_growth' }), 'https://x')).toBe(null);
    expect(notificationOf({ type: 'decision' }, 'https://x')).toBe(null);
  });
});

describe('the functions mirror stays true', () => {
  it('says the same', () => {
    expect(S_MAX).toBe(PUSH_BODY_MAX);
    for (const e of ['https://a/1', 'https://a/2', '']) expect(sPushSubscriptionIdOf(e)).toBe(pushSubscriptionIdOf(e));
    for (const p of [reach(), reach({ door: '/b/019f57e8-878a-75ff-be0e-7d3913b4b2f3' }), reach({ type: 'event' }), reach({ content: 'y'.repeat(300) })]) {
      expect(sNotificationOf(p, 'https://lightseed.online')).toEqual(notificationOf(p, 'https://lightseed.online'));
    }
  });
});
