// PUSH — a reach that knocks on the device (ring 2026-09-06).
//
// The seed is a PWA; when a being allows it, the browser hands the node a push subscription
// (an endpoint and two keys), and the node knocks there when a reach arrives for them — the
// offering of care's notice to a keeper among them. Everything about WHAT is said and WHERE a
// subscription rests is law here; the crypto is the browser's and web-push's.
//
// Plain contract — guaranteed now: pushSubscriptionIdOf is deterministic in the endpoint and
// safe as a document id; notificationOf reads a reach pulse into one small notice — the
// author's name as title, the words (trimmed to PUSH_BODY_MAX) as body, and the door to open:
// the pulse's own `door` (a /b/ address the notice carries) else the app's root at `origin`;
// a pulse that is not a reach yields null (nothing knocks for a growth or a decision). Not
// guaranteed: delivery (the browser's, the platform's), or that a subscription still stands
// when knocked (the sender drops a dead one). Enforced by tests/push.test.ts, which holds
// the functions mirror (functions/src/push.ts) true.

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
