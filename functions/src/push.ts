// PUSH, server side — the pure half, with no web-push or Firestore in reach.
//
// Functions is its own TS project and cannot import src/domain, so this module MIRRORS
// src/domain/push.ts. The mirror is held true by the ROOT test suite (tests/push.test.ts
// imports BOTH and compares). index.ts owns the plumbing: on a reach, read each recipient's
// subscriptions and knock with the notice this law shapes.

export const PUSH_BODY_MAX = 140;

// A subscription's resting place: users/{uid}/pushSubscriptions/{id} — the id from the endpoint
// (FNV-1a twice), so the same device re-subscribing lands on the same document.
const fnv1a = (s: string, seed: number): string => {
    let h = seed >>> 0;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
};
export const pushSubscriptionIdOf = (endpoint: string): string =>
    fnv1a(endpoint, 0x811c9dc5) + fnv1a(endpoint, 0x811c9dc5 ^ 0x5bd1e995);

export interface PushNotice {
    title: string;
    body: string;
    url: string;
    tag: string; // one notice per thread: a burst collapses into the newest
}

export interface PushSourcePulse {
    type?: unknown;
    authorName?: unknown;
    body?: unknown;
    content?: unknown;
    threadId?: unknown;
    door?: unknown; // a /b/... address the reach carries (an offering's notice does)
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export const notificationOf = (pulse: PushSourcePulse, origin: string): PushNotice | null => {
    if (pulse.type !== 'reach') return null;
    const words = (str(pulse.content) || str(pulse.body)).replace(/\s+/g, ' ').trim();
    const body = words.length > PUSH_BODY_MAX ? `${words.slice(0, PUSH_BODY_MAX - 1).trimEnd()}…` : words;
    const door = str(pulse.door);
    const base = origin.replace(/\/+$/, '');
    return {
        title: str(pulse.authorName) || 'A lightseed',
        body,
        url: /^\/b\/[0-9a-zA-Z-]{8,}\/?$/.test(door) ? `${base}${door}` : `${base}/`,
        tag: str(pulse.threadId) || 'reach',
    };
};
