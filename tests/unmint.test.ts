import { describe, it, expect } from 'vitest';
import { unmintRefusal, STAFF_OVERRIDABLE_REFUSALS } from '../src/domain/unmint';

// The unmint law (ring 2026-08-15): only the author, only a tree mint, only the HEAD block,
// never a witnessed watering. Mirrors the rules' unmint branch — these refusals and that
// clause must change together.

const mint = (over: Record<string, unknown> = {}) => ({
  authorId: 'ana', type: 'tree_growth', lifetreeId: 't1', hash: 'h9', ...over,
});

describe('unmintRefusal', () => {
  it('the author may take back the head mint', () => {
    expect(unmintRefusal(mint(), { latestHash: 'h9' }, 'ana')).toBeNull();
  });
  it('another hand may not', () => {
    expect(unmintRefusal(mint(), { latestHash: 'h9' }, 'bakr')).toBe('unmint_not_author');
    expect(unmintRefusal(mint(), { latestHash: 'h9' }, undefined)).toBe('unmint_not_author');
  });
  it('any chain block at the head qualifies — growth, tree-sent reach, alignment', () => {
    expect(unmintRefusal(mint({ type: 'reach' }), { latestHash: 'h9' }, 'ana')).toBeNull();
    expect(unmintRefusal(mint({ type: 'standard' }), { latestHash: 'h9' }, 'ana')).toBeNull();
  });
  it('only a block on a tree chain — and never a decision', () => {
    expect(unmintRefusal(mint({ lifetreeId: undefined }), { latestHash: 'h9' }, 'ana')).toBe('unmint_not_mint');
    expect(unmintRefusal(mint({ hash: undefined }), { latestHash: 'h9' }, 'ana')).toBe('unmint_not_mint');
    expect(unmintRefusal(mint({ type: 'decision' }), { latestHash: 'h9' }, 'ana')).toBe('unmint_not_mint');
  });
  it('below the head, the chain is sealed', () => {
    expect(unmintRefusal(mint(), { latestHash: 'h10' }, 'ana')).toBe('unmint_not_last');
  });
  it('a witnessed watering stands forever — the refusal outranks head position', () => {
    expect(unmintRefusal(mint({ wateringConfirmedBy: 'guardian' }), { latestHash: 'h9' }, 'ana')).toBe('unmint_witnessed');
  });
  it('nothing co-held can be unsaid: seen, loved, vetoed, or alignment-paired', () => {
    expect(unmintRefusal(mint({ seenBy: ['ana', 'bakr'] }), { latestHash: 'h9' }, 'ana')).toBe('unmint_coheld');
    expect(unmintRefusal(mint({ loveCount: 1 }), { latestHash: 'h9' }, 'ana')).toBe('unmint_coheld');
    expect(unmintRefusal(mint({ vetoes: ['lumo'] }), { latestHash: 'h9' }, 'ana')).toBe('unmint_coheld');
    expect(unmintRefusal(mint({ matchId: 'align1' }), { latestHash: 'h9' }, 'ana')).toBe('unmint_coheld');
    expect(unmintRefusal(mint({ offeringId: 'off1' }), { latestHash: 'h9' }, 'ana')).toBe('unmint_coheld');
  });
  it('the staff hand may pass the social guards only — never the structural ones', () => {
    expect(STAFF_OVERRIDABLE_REFUSALS.has('unmint_coheld')).toBe(true);
    expect(STAFF_OVERRIDABLE_REFUSALS.has('unmint_not_author')).toBe(true);
    expect(STAFF_OVERRIDABLE_REFUSALS.has('unmint_not_last')).toBe(false);   // below the head severs
    expect(STAFF_OVERRIDABLE_REFUSALS.has('unmint_witnessed')).toBe(false);  // the light is minted
    expect(STAFF_OVERRIDABLE_REFUSALS.has('unmint_not_mint')).toBe(false);
  });
  it("the author's own read receipt does not co-hold their word", () => {
    expect(unmintRefusal(mint({ seenBy: ['ana'] }), { latestHash: 'h9' }, 'ana')).toBeNull();
    expect(unmintRefusal(mint({ seenBy: [] }), { latestHash: 'h9' }, 'ana')).toBeNull();
  });
});
