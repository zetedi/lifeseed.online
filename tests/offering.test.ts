import { describe, it, expect } from 'vitest';
import {
  offeringProblem, offeringStatusOf, canWithdrawOffering, canAnswerOffering, judgeOfferingAccept,
  OFFERING_STATUSES, isOfferingStatus, isOfferedToKind,
  type OfferingDraft, type OfferingAcceptFacts,
} from '../src/domain/offering';
import {
  judgeOfferingAccept as serverJudgeOfferingAccept, offeringTwinBlocks,
  OFFERING_STATUSES as SERVER_OFFERING_STATUSES, isOfferingStatus as serverIsOfferingStatus,
  isOfferedToKind as serverIsOfferedToKind,
} from '../functions/src/offering';
import { formatLight, RAY_UNITS } from '../src/domain/light';
import { speak } from '../src/utils/translations';

const ok = (over: Partial<OfferingDraft> = {}): OfferingDraft => ({
  kind: 'service', title: 'A quiet corner', description: 'rest here', suggestedAppreciationLight: RAY_UNITS, ...over,
});

describe('offeringProblem: what a valid offering is', () => {
  it('a sound draft has no problem', () => {
    expect(offeringProblem(ok())).toBeNull();
    expect(offeringProblem(ok({ kind: 'bed' }))).toBeNull();
  });
  it('refuses a bad kind, an empty title, or non-positive/fractional appreciation', () => {
    expect(speak(offeringProblem(ok({ kind: 'x' as any }))!)).toMatch(/what you are offering/i);
    expect(speak(offeringProblem(ok({ title: '   ' }))!)).toMatch(/name your offering/i);
    expect(speak(offeringProblem(ok({ suggestedAppreciationLight: 0 }))!)).toMatch(/appreciation in light/i);
    expect(speak(offeringProblem(ok({ suggestedAppreciationLight: -5 }))!)).toMatch(/appreciation in light/i);
    expect(speak(offeringProblem(ok({ suggestedAppreciationLight: 10.5 }))!)).toMatch(/whole light units/i);
  });

  it('accepts a well-formed optional detail link and refuses a malformed one', () => {
    expect(offeringProblem(ok({ url: 'https://perauset.com/stay' }))).toBeNull();
    expect(offeringProblem(ok({ url: '   ' }))).toBeNull();          // blank = absent
    expect(speak(offeringProblem(ok({ url: 'javascript:alert(1)' }))!)).toMatch(/http\(s\)/i);
    expect(speak(offeringProblem(ok({ url: 'perauset.com' }))!)).toMatch(/http\(s\)/i);
    expect(speak(offeringProblem(ok({ url: `https://x.dev/${'a'.repeat(300)}` }))!)).toMatch(/too long/i);
  });
});

describe('formatLight: light spoken for humans without making it a price', () => {
  it('whole rays where it divides, units otherwise', () => {
    expect(formatLight(RAY_UNITS)).toBe('1 ray');
    expect(formatLight(3 * RAY_UNITS)).toBe('3 rays');
    expect(formatLight(RAY_UNITS + 5)).toBe(`${RAY_UNITS + 5} light`);
    expect(formatLight(0)).toBe('0 light');
    expect(formatLight(-1)).toBe('0 light');
  });
});

// ── THE OFFERING OF CARE (ring 2026-09-06) ──────────────────────────────────────────────────

describe('offeringProblem: the offering of care and the code kind', () => {
  it('a code offering is its pull request — the door is required', () => {
    expect(offeringProblem(ok({ kind: 'code', url: 'https://github.com/x/y/pull/7' }))).toBeNull();
    expect(speak(offeringProblem(ok({ kind: 'code' }))!)).toMatch(/pull request/i);
  });

  it('an offering to a being needs the being and a tree of its own to stand on', () => {
    const to = { kind: 'tree' as const, id: 'treeB', name: "Bob's oak" };
    expect(offeringProblem(ok({ to, fromTreeId: 'treeA' }))).toBeNull();
    expect(offeringProblem(ok({ to: { kind: 'vision', id: 'v1' }, fromTreeId: 'treeA' }))).toBeNull();
    expect(speak(offeringProblem(ok({ to, fromTreeId: '' }))!)).toMatch(/tree of yours/i);
    expect(speak(offeringProblem(ok({ to: { kind: 'tree', id: '  ' }, fromTreeId: 'treeA' }))!)).toMatch(/tree or vision/i);
    expect(speak(offeringProblem(ok({ to: { kind: 'x' as any, id: 'v1' }, fromTreeId: 'treeA' }))!)).toMatch(/tree or vision/i);
  });
});

describe('the lifecycle of an offering of care', () => {
  it('a standalone listing has no lifecycle; an offered-to one is born open', () => {
    expect(offeringStatusOf({ authorId: 'a' })).toBe(null);
    expect(offeringStatusOf({ authorId: 'a', offeredToKind: 'tree' })).toBe('open');
    expect(offeringStatusOf({ authorId: 'a', offeredToKind: 'vision', offeringStatus: 'accepted' })).toBe('accepted');
    expect(offeringStatusOf({ authorId: 'a', offeredToKind: 'tree', offeringStatus: 'nonsense' })).toBe('open');
    expect(OFFERING_STATUSES).toEqual(['open', 'accepted', 'withdrawn', 'declined']);
    expect(isOfferingStatus('withdrawn')).toBe(true);
    expect(isOfferingStatus('OPEN')).toBe(false);
    expect(isOfferedToKind('tree')).toBe(true);
    expect(isOfferedToKind('bed')).toBe(false);
  });

  it('only the author withdraws, only while open', () => {
    const open = { authorId: 'ana', offeredToKind: 'tree' };
    expect(canWithdrawOffering(open, 'ana')).toBe(true);
    expect(canWithdrawOffering(open, 'bob')).toBe(false);
    expect(canWithdrawOffering(open, '')).toBe(false);
    expect(canWithdrawOffering({ ...open, offeringStatus: 'accepted' }, 'ana')).toBe(false);
    expect(canWithdrawOffering({ ...open, offeringStatus: 'declined' }, 'ana')).toBe(false);
    expect(canWithdrawOffering({ authorId: 'ana' }, 'ana')).toBe(false); // a listing has no lifecycle
  });

  it('only a hand that stands for the receiver answers, never the author, only while open', () => {
    const open = { authorId: 'ana', offeredToKind: 'tree' };
    expect(canAnswerOffering(open, 'bob', true)).toBe(true);
    expect(canAnswerOffering(open, 'bob', false)).toBe(false);
    expect(canAnswerOffering(open, 'ana', true)).toBe(false);
    expect(canAnswerOffering({ ...open, offeringStatus: 'withdrawn' }, 'bob', true)).toBe(false);
  });
});

// An acceptance that SHOULD pass; each case below breaks exactly one fact.
const sound = (): OfferingAcceptFacts => ({
  acceptorUid: 'bob',
  offering: { exists: true, type: 'offering', status: undefined, active: true, authorId: 'ana', toKind: 'tree', toId: 'treeB', fromTreeId: 'treeA' },
  receiver: { exists: true, standing: true, diedAtMs: null },
  fromTree: { exists: true },
});
const broken = (over: (f: OfferingAcceptFacts) => void): OfferingAcceptFacts => { const f = sound(); over(f); return f; };

describe('judgeOfferingAccept — the whole law of acceptance', () => {
  it('accepts a sound offering, to a tree or to a vision, with or without a stored open status', () => {
    expect(judgeOfferingAccept(sound())).toEqual({ outcome: 'accept' });
    expect(judgeOfferingAccept(broken(f => { f.offering.toKind = 'vision'; }))).toEqual({ outcome: 'accept' });
    expect(judgeOfferingAccept(broken(f => { f.offering.status = 'open'; }))).toEqual({ outcome: 'accept' });
  });

  const rejects = (over: (f: OfferingAcceptFacts) => void, code: string, message: RegExp) => {
    const j = judgeOfferingAccept(broken(over));
    expect(j.outcome).toBe('reject');
    if (j.outcome === 'reject') { expect(j.code).toBe(code); expect(j.message).toMatch(message); }
  };

  it('refuses what is missing, malformed, or not an offering to a being', () => {
    rejects(f => { f.offering.exists = false; }, 'not-found', /no longer exists/);
    rejects(f => { f.offering.type = 'event'; }, 'failed-precondition', /not an offering/);
    rejects(f => { f.offering.toKind = undefined; }, 'failed-precondition', /not made to a being/);
    rejects(f => { f.offering.toKind = 'bed'; }, 'failed-precondition', /not made to a being/);
    rejects(f => { f.offering.fromTreeId = ''; }, 'failed-precondition', /malformed/);
    rejects(f => { f.offering.toId = ''; }, 'failed-precondition', /malformed/);
    rejects(f => { f.offering.authorId = ''; }, 'failed-precondition', /malformed/);
  });

  it('refuses an offering already answered, withdrawn, or resting', () => {
    rejects(f => { f.offering.status = 'accepted'; }, 'failed-precondition', /already accepted/);
    rejects(f => { f.offering.status = 'withdrawn'; }, 'failed-precondition', /already withdrawn/);
    rejects(f => { f.offering.status = 'declined'; }, 'failed-precondition', /already declined/);
    rejects(f => { f.offering.active = false; }, 'failed-precondition', /resting/);
  });

  it('refuses the author, a hand without standing, a dead tree, and a vanished side', () => {
    rejects(f => { f.acceptorUid = 'ana'; }, 'failed-precondition', /your own offering/);
    rejects(f => { f.receiver.standing = false; }, 'permission-denied', /keeper, co-owners or stewards/);
    rejects(f => { f.receiver.exists = false; }, 'not-found', /offered to no longer exists/);
    rejects(f => { f.receiver.diedAtMs = 1; }, 'failed-precondition', /died/);
    rejects(f => { f.fromTree.exists = false; }, 'not-found', /offerer's tree/);
  });
});

describe('the functions mirror stays true', () => {
  it('carries the same words and judges identically', () => {
    expect([...SERVER_OFFERING_STATUSES]).toEqual([...OFFERING_STATUSES]);
    for (const v of ['open', 'accepted', 'x', undefined, 3]) expect(serverIsOfferingStatus(v)).toBe(isOfferingStatus(v));
    for (const v of ['tree', 'vision', 'bed', '']) expect(serverIsOfferedToKind(v)).toBe(isOfferedToKind(v));
    const cases: Array<(f: OfferingAcceptFacts) => void> = [
      () => {}, f => { f.offering.exists = false; }, f => { f.offering.type = 'x'; }, f => { f.offering.toKind = 'bed'; },
      f => { f.offering.status = 'accepted'; }, f => { f.offering.active = false; }, f => { f.acceptorUid = 'ana'; },
      f => { f.receiver.standing = false; }, f => { f.receiver.exists = false; }, f => { f.receiver.diedAtMs = 5; },
      f => { f.fromTree.exists = false; }, f => { f.offering.toKind = 'vision'; },
    ];
    for (const c of cases) expect(serverJudgeOfferingAccept(broken(c))).toEqual(judgeOfferingAccept(broken(c)));
  });

  it('shapes the twins so either chain alone proves the agreement', () => {
    const { from, to } = offeringTwinBlocks({
      id: 'off1', lid: 'off-lid', title: 'A night of song', authorId: 'ana', authorName: 'Ana', domain: 'lightseed.online',
      visibility: 'public', toKind: 'vision', toId: 'v1', toName: 'A clearing', fromTreeId: 'treeA', fromTreeName: "Ana's oak",
    }, { uid: 'bob', name: 'Bob' });
    expect(from).toMatchObject({ lifetreeId: 'treeA', type: 'standard', offeringId: 'off1', offeringLid: 'off-lid', offeringRole: 'from', offeringTwinOf: 'v1', offeringTwinKind: 'vision', authorId: 'ana', visibility: 'public' });
    expect(to).toMatchObject({ visionId: 'v1', type: 'standard', offeringId: 'off1', offeringRole: 'to', offeringTwinOf: 'treeA', offeringTwinKind: 'tree', authorId: 'bob', authorName: 'Bob' });
    expect('lifetreeId' in to).toBe(false);
    const tree = offeringTwinBlocks({ id: 'o', lid: 'l', title: 't', authorId: 'a', authorName: 'A', domain: 'd', visibility: 'node', toKind: 'tree', toId: 'treeB', toName: 'B', fromTreeId: 'treeA', fromTreeName: 'A' }, { uid: 'b', name: 'B' });
    expect(tree.to).toMatchObject({ lifetreeId: 'treeB', offeringTwinKind: 'tree' });
    expect('visionId' in tree.to).toBe(false);
  });
});
