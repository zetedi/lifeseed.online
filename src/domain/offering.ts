import type { DomainKey } from './words';
// OFFERINGS — a being offers a BED, a SERVICE or CODE and may name the light with which they hope
// the contribution will be appreciated AFTER it is received. Trust admits; the ray follows the
// dream. The suggestion is an agreement, never a gate or purchase price. This module is the pure
// law for a sound offering draft, and — since ring 2026-09-06 — for the OFFERING OF CARE: an
// offering pointed at a being (a tree or a vision), answered on its own leaf, withdrawable until
// answered, and on acceptance co-minted as twin blocks on the offerer's tree chain and the
// receiver's own chain (the alignment shape, engagement.acceptAlignment). Circulation of light
// itself remains a coming rung: acceptance seals the agreement and moves no light.
//
// Plain contract — guaranteed now: offeringProblem refuses a draft that names no kind, no title,
// a non-positive or fractional appreciation, a malformed or overlong door, a CODE offering with
// no door (a pull request IS its link), or an offering TO a being with no tree of its own to
// stand on; offeringStatusOf reads 'open' for an offered-to offering without a status and null
// for a standalone listing (which has no lifecycle beyond its switch); only 'open' answers —
// accepted / withdrawn / declined are final; canWithdrawOffering is the author's hand alone
// while open; judgeOfferingAccept is the whole law of acceptance in the order the server applies
// it (mirrored in functions/src/offering.ts, held by tests/offering.test.ts): an existing, open,
// standing offering to a tree or vision, accepted by a hand that STANDS for the receiver (a
// tree's keeper, co-owner or steward; a vision's author), never its own author, for a receiver
// that exists and lives, from a tree that exists. Not guaranteed: who may see an offering (the
// pulse's visibility law), and any movement of light on acceptance (none, yet).

export type OfferingKind = 'bed' | 'service' | 'code';
export type OfferedToKind = 'tree' | 'vision';
export type OfferingStatus = 'open' | 'accepted' | 'withdrawn' | 'declined';
export const OFFERING_STATUSES: readonly OfferingStatus[] = ['open', 'accepted', 'withdrawn', 'declined'];
export const isOfferingStatus = (v: unknown): v is OfferingStatus =>
    typeof v === 'string' && (OFFERING_STATUSES as readonly string[]).includes(v);
export const isOfferedToKind = (v: unknown): v is OfferedToKind => v === 'tree' || v === 'vision';

// The being an offering is made to.
export interface OfferedTo {
    kind: OfferedToKind;
    id: string;
    lid?: string;
    name?: string;
    keeperUid?: string; // the tree's keeper / the vision's author, denormalized for the leaf
}

export interface OfferingDraft {
    kind: OfferingKind;
    title: string;
    description: string;
    suggestedAppreciationLight: number; // whole light units; an after-gift, never admission
    bedId?: string;     // for a bed offering, the bed being it stands for (optional)
    url?: string;       // an optional detail door (booking page, menu); for CODE, the pull request
    to?: OfferedTo;     // an offering of care: the being it is made to
    fromTreeId?: string; // the offerer's own tree, whose chain carries the twin block
}

// Why this offering cannot stand yet, or null when it may. Keeps the form honest before a write.
export const offeringProblem = (d: OfferingDraft): DomainKey | null => {
    if (d.kind !== 'bed' && d.kind !== 'service' && d.kind !== 'code') return 'offering_choose_kind';
    if (!d.title.trim()) return 'offering_name';
    if (!Number.isFinite(d.suggestedAppreciationLight) || d.suggestedAppreciationLight <= 0) return 'offering_appreciation_positive';
    if (!Number.isInteger(d.suggestedAppreciationLight)) return 'offering_appreciation_whole';
    const url = d.url?.trim();
    if (url && !/^https?:\/\/\S+$/i.test(url)) return 'offering_link_http';
    if (url && url.length > 300) return 'offering_link_long';
    if (d.kind === 'code' && !url) return 'offering_code_link';
    if (d.to) {
        if (!isOfferedToKind(d.to.kind) || !d.to.id.trim()) return 'offering_to_being';
        if (!d.fromTreeId?.trim()) return 'offering_from_tree';
    }
    return null;
};

// ── The offering of care: its lifecycle ──────────────────────────────────────────────────

// The facts a status question reads off a stored offering pulse.
export interface OfferingLifecycleFacts {
    authorId?: string;
    offeredToKind?: unknown;
    offeringStatus?: unknown;
}

// An offered-to offering without a stored status is OPEN (born so); a standalone listing has no
// lifecycle at all (null) — its only switch is offeringActive.
export const offeringStatusOf = (p: OfferingLifecycleFacts): OfferingStatus | null => {
    if (!isOfferedToKind(p.offeredToKind)) return null;
    return isOfferingStatus(p.offeringStatus) ? p.offeringStatus : 'open';
};

// The author may take an open offering back; once answered, nothing moves.
export const canWithdrawOffering = (p: OfferingLifecycleFacts, uid: string): boolean =>
    offeringStatusOf(p) === 'open' && !!uid && p.authorId === uid;

// The receiver's side may answer an open offering — never its own author, and only a hand that
// stands for the receiver (the caller decides standing: a tree's carer, a vision's author).
export const canAnswerOffering = (p: OfferingLifecycleFacts, uid: string, standsForReceiver: boolean): boolean =>
    offeringStatusOf(p) === 'open' && !!uid && p.authorId !== uid && standsForReceiver;

// ── Acceptance: the whole law, in the order the server applies it ────────────────────────

export interface OfferingAcceptFacts {
    acceptorUid: string;
    offering: {
        exists: boolean;
        type?: unknown;          // must be 'offering'
        status?: unknown;        // absent = open
        active?: unknown;        // false = paused by its author
        authorId: string;
        toKind?: unknown;        // 'tree' | 'vision'
        toId: string;
        fromTreeId: string;
    };
    receiver: {
        exists: boolean;
        standing: boolean;       // the acceptor stands for the receiver (carer / author)
        diedAtMs: number | null; // a tree that died accepts memory, not offerings
    };
    fromTree: { exists: boolean };
}

export type OfferingAcceptJudgment =
    | { outcome: 'reject'; code: 'not-found' | 'failed-precondition' | 'permission-denied'; message: string }
    | { outcome: 'accept' };

export const judgeOfferingAccept = (f: OfferingAcceptFacts): OfferingAcceptJudgment => {
    const reject = (code: 'not-found' | 'failed-precondition' | 'permission-denied', message: string): OfferingAcceptJudgment =>
        ({ outcome: 'reject', code, message });
    if (!f.offering.exists) return reject('not-found', 'That offering no longer exists.');
    if (f.offering.type !== 'offering') return reject('failed-precondition', 'That is not an offering.');
    if (!isOfferedToKind(f.offering.toKind)) return reject('failed-precondition', 'That offering is not made to a being.');
    if (!f.offering.authorId || !f.offering.toId || !f.offering.fromTreeId) return reject('failed-precondition', 'That offering is malformed.');
    const status = isOfferingStatus(f.offering.status) ? f.offering.status : 'open';
    if (status !== 'open') return reject('failed-precondition', `That offering was already ${status}.`);
    if (f.offering.active === false) return reject('failed-precondition', 'That offering is resting.');
    if (f.acceptorUid === f.offering.authorId) return reject('failed-precondition', 'You cannot accept your own offering.');
    if (!f.receiver.exists) return reject('not-found', 'The being this was offered to no longer exists.');
    if (!f.receiver.standing) return reject('permission-denied', "Only the receiver's keeper, co-owners or stewards may accept it.");
    if (f.receiver.diedAtMs !== null) return reject('failed-precondition', 'A tree that has died keeps memory, not offerings.');
    if (!f.fromTree.exists) return reject('not-found', "The offerer's tree no longer exists.");
    return { outcome: 'accept' };
};
