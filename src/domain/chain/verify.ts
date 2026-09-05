import { canonicalize } from './canonical';
import { sha256 } from './hash';

// Chain verifier + canonical block hashing — the second crystal prerequisite.
//
// No runtime path automatically recomputes or verifies a hash (verification is on-demand — e.g. the
// super-admin console). This module adds (1) a canonical hash over a fixed, whitelisted set of
// IMMUTABLE block fields and (2) a
// verifier that walks one tree's chain and reports linkage / height / hash issues. A SEALED node
// (community.chainLocked) now mints new blocks with computeCanonicalHash over the canonical content
// (incl. an explicit `mintedAt` that is also stored), so this verifier (with
// `recomputeHash: canonicalRecompute`) can prove a sealed chain end to end.
//
// Useful NOW even before the switch: `verifyChain` without `recomputeHash` still checks previousHash
// LINKAGE, blockHeight CONTINUITY and duplicate hashes on the live (legacy-hashed) data.

// The immutable payload of a block. EXCLUDED on purpose: id, hash, previousHash (an input, not
// content), createdAt (serverTimestamp — non-reproducible; replaced by an explicit mintedAt in the
// preimage), and all mutable/off-chain interaction state (loveCount, commentCount, seenBy,
// aiInterpretation, validationScore, reachResponse, mintNotice, and the watering-confirmation pair
// wateringConfirmation + wateringConfirmedBy — both are mutated when a guardian confirms a pending
// watering, so they must be split out before it can be hashed, or the confirmation would break the
// seal of an otherwise-untampered block).
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

// Pick only the whitelisted, defined fields — the canonical content of a block.
export function blockContent(pulse: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of BLOCK_CONTENT_FIELDS) {
    if (pulse[k] !== undefined) out[k] = pulse[k];
  }
  return out;
}

// The canonical preimage: a versioned, domain-separated string binding the prior hash, the mint
// time, and the canonical content. (Versioned so the scheme can evolve without ambiguity.)
export const BLOCK_HASH_VERSION = 'lifeseed.block.v1';

export function blockPreimage(previousHash: string, mintedAtMs: number, content: Record<string, unknown>): string {
  return [BLOCK_HASH_VERSION, previousHash, String(mintedAtMs), canonicalize(content)].join('\n');
}

// The future, reproducible block hash. `mintedAtMs` must be a stable client-resolved timestamp that
// is ALSO stored on the block (so stored-doc and preimage agree) — the switch will introduce it.
export async function computeCanonicalHash(previousHash: string, mintedAtMs: number, pulse: Record<string, unknown>): Promise<string> {
  return sha256(blockPreimage(previousHash, mintedAtMs, blockContent(pulse)));
}

// A `recomputeHash` for verifyChain that uses the canonical scheme. Reads the block's stable
// timestamp (`mintedAt`, falling back to createdAt millis if a future block stored only that).
export const canonicalRecompute = (block: ChainBlock, previousHash: string): Promise<string> => {
  const ts = (block as any).mintedAt ?? (block as any).createdAt;
  const ms = typeof ts === 'number' ? ts : (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0);
  return computeCanonicalHash(previousHash, ms, block as Record<string, unknown>);
};

export interface ChainBlock {
  id?: string;
  hash: string;
  previousHash: string;
  blockHeight?: number;
  [k: string]: unknown;
}

// A block was sealed with the canonical scheme iff it carries the version marker (stamped by
// mintPulse when the node is locked). Legacy blocks predate the scheme and never carry it.
export function isCanonicallySealed(block: Record<string, unknown>): boolean {
  return (block as { hashVersion?: unknown }).hashVersion === BLOCK_HASH_VERSION;
}

// Per-block tamper check: does a sealed block's stored hash still equal the canonical hash of its
// stored content, previousHash and mintedAt? Independent of its neighbours — so it holds even where
// off-chain cares leave gaps in the doc-level chain, and it ignores legacy blocks. This is the
// tamper-evidence the seal actually provides today; verifyChain is the contiguous end-to-end walk.
export async function verifyBlockSeal(block: ChainBlock): Promise<boolean> {
  return (await canonicalRecompute(block, block.previousHash)) === block.hash;
}

export type ChainIssueCode = 'linkage' | 'height' | 'hash' | 'duplicate-hash' | 'empty-hash';

export interface ChainIssue {
  index: number;
  blockId?: string;
  code: ChainIssueCode;
  message: string;
}

export interface ChainVerifyResult {
  ok: boolean;
  blockCount: number;
  issues: ChainIssue[];
  headHash?: string;
}

// Walk one tree's chain (blocks ordered oldest → newest) and report integrity issues.
// - linkage: each block.previousHash must equal the previous block's hash (block[0] vs genesisHash).
// - height: blockHeight, when present, must increase by exactly 1.
// - duplicate-hash / empty-hash: structural sanity.
// - hash: only when `recomputeHash` is supplied (legacy blocks won't pass canonical recompute — by
//   design; they predate the lock — so omit it to verify only linkage/height on live data).
export async function verifyChain(
  blocks: ChainBlock[],
  opts: { genesisHash?: string; recomputeHash?: (block: ChainBlock, previousHash: string) => Promise<string> } = {},
): Promise<ChainVerifyResult> {
  const issues: ChainIssue[] = [];
  const seen = new Set<string>();
  let expectedPrev = opts.genesisHash; // expected previousHash of the next block (undefined = unknown root)

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];

    if (!b.hash) issues.push({ index: i, blockId: b.id, code: 'empty-hash', message: 'block has no hash' });

    if (expectedPrev !== undefined && b.previousHash !== expectedPrev) {
      issues.push({ index: i, blockId: b.id, code: 'linkage', message: `previousHash ${short(b.previousHash)} ≠ expected ${short(expectedPrev)}` });
    }

    if (i > 0) {
      const prevH = blocks[i - 1].blockHeight;
      if (typeof prevH === 'number' && typeof b.blockHeight === 'number' && b.blockHeight !== prevH + 1) {
        issues.push({ index: i, blockId: b.id, code: 'height', message: `blockHeight ${b.blockHeight} is not ${prevH + 1}` });
      }
    }

    if (b.hash) {
      if (seen.has(b.hash)) issues.push({ index: i, blockId: b.id, code: 'duplicate-hash', message: `duplicate hash ${short(b.hash)}` });
      seen.add(b.hash);
    }

    if (opts.recomputeHash) {
      const expected = await opts.recomputeHash(b, b.previousHash);
      if (expected !== b.hash) issues.push({ index: i, blockId: b.id, code: 'hash', message: `hash mismatch — recomputed ${short(expected)}` });
    }

    expectedPrev = b.hash;
  }

  return { ok: issues.length === 0, blockCount: blocks.length, issues, headHash: blocks.length ? blocks[blocks.length - 1].hash : opts.genesisHash };
}

const short = (h?: string) => (h ? (h.length > 12 ? h.slice(0, 12) + '…' : h) : '∅');
