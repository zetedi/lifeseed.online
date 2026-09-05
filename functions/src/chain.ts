// THE CHAIN LAW, server side — the pure half, with no Firestore in reach.
//
// Functions is its own TS project and cannot import src/domain, so this module MIRRORS the
// hashing law of src/domain/chain (canonical.ts, hash.ts, and verify.ts's content fields and
// preimage). The mirror is held true by the ROOT test suite (tests/chain.test.ts imports BOTH
// and compares hashes of the same blocks). The first server mint that needs it is the offering
// of care (ring 2026-09-06): the acceptance twins are sealed here exactly as mintPulse seals a
// block in the browser — the legacy seal on unlocked nodes, the canonical seal on locked ones —
// so verifyChain reads a server-minted block and a browser-minted one the same way.
import { webcrypto } from "node:crypto";

const isTimestampLike = (v: unknown): v is { toMillis: () => number } =>
    !!v && typeof v === 'object' && typeof (v as any).toMillis === 'function';

function encode(v: unknown): string {
    if (v === null) return 'z';            // null
    if (v === undefined) return 'u';       // explicit (JSON.stringify would drop it)
    const t = typeof v;
    if (t === 'string') return 's:' + JSON.stringify(v); // JSON-escapes quotes/newlines/unicode
    if (t === 'number') return 'd:' + (Number.isFinite(v) ? (v as number).toString() : 'NaN');
    if (t === 'boolean') return 'b:' + (v ? '1' : '0');
    if (t === 'bigint') return 'i:' + (v as bigint).toString();
    // Firestore Timestamp (toMillis) or a JS Date — encode as epoch millis under one tag.
    if (isTimestampLike(v)) return 't:' + v.toMillis();
    if (v instanceof Date) return 't:' + v.getTime();
    if (Array.isArray(v)) return '[' + v.map(encode).join(',') + ']';   // order is significant
    if (t === 'object') {
      const obj = v as Record<string, unknown>;
      // Sort keys so insertion order can't change the bytes; drop `undefined` values to match how
      // Firestore stores documents (it omits undefined), so stored-doc and preimage agree.
      const keys = Object.keys(obj).filter(k => obj[k] !== undefined).sort();
      return '{' + keys.map(k => JSON.stringify(k) + ':' + encode(obj[k])).join(',') + '}';
    }
    // functions / symbols must never appear in block content; encode defensively rather than throw.
    return 'x';
}

// Deterministic string encoding of any JSON-ish value (incl. Firestore Timestamps / Dates).
export function canonicalize(value: unknown): string {
    return encode(value);
}

export async function sha256(message: string): Promise<string> {
    const bytes = new TextEncoder().encode(message);
    const digest = await webcrypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// The legacy (v0) block seal: JSON.stringify(data) + previousHash + timestamp.
export async function createBlock(previousHash: string, data: object, timestamp: number): Promise<string> {
    return sha256(JSON.stringify(data) + previousHash + timestamp);
}

export const BLOCK_CONTENT_FIELDS = [
    'lid', 'lifetreeId', 'visionId', 'communityId', 'type', 'visibility',
    'title', 'body', 'content', 'imageUrl', 'imageUrls', 'eventDate', 'eventLocation',
    'reachTreeId', 'reachTreeName', 'recipientUid', 'recipientName',
    'threadId', 'participantUids', 'audience', 'threadName', 'isGroup',
    'care', 'careAlert',
    'isMatch', 'matchedLifetreeId', 'matchId',
    // An accepted offering's twin blocks (ring 2026-09-06): each names the offering and the other
    // chain, so the agreement is sealed on both sides.
    'offeringId', 'offeringLid', 'offeringRole', 'offeringTwinOf', 'offeringTwinKind',
    'authorId', 'authorName', 'authorPersonName', 'authorPhoto', 'growthCategory', 'visionTitle',
] as const;

export function blockContent(pulse: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const k of BLOCK_CONTENT_FIELDS) if (pulse[k] !== undefined) out[k] = pulse[k];
    return out;
}

export const BLOCK_HASH_VERSION = "lifeseed.block.v1";

export function blockPreimage(previousHash: string, mintedAtMs: number, content: Record<string, unknown>): string {
    return [BLOCK_HASH_VERSION, previousHash, String(mintedAtMs), canonicalize(content)].join("\n");
}

export async function computeCanonicalHash(previousHash: string, mintedAtMs: number, pulse: Record<string, unknown>): Promise<string> {
    return sha256(blockPreimage(previousHash, mintedAtMs, blockContent(pulse)));
}
