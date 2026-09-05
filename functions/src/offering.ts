// OFFERINGS, server side — the pure half, with no Firestore in reach.
//
// Functions is its own TS project and cannot import src/domain, so this module MIRRORS the
// acceptance law of src/domain/offering.ts (judgeOfferingAccept and the status words it reads).
// The mirror is held true by the ROOT test suite (tests/offering.test.ts imports BOTH and
// compares), the mint.ts arrangement. index.ts owns only the plumbing: read the offering, the
// receiver, the offerer's tree and the acceptor's standing; let this law judge; mint the twins.

export type OfferedToKind = 'tree' | 'vision';
export type OfferingStatus = 'open' | 'accepted' | 'withdrawn' | 'declined';
export const OFFERING_STATUSES: readonly OfferingStatus[] = ['open', 'accepted', 'withdrawn', 'declined'];
export const isOfferingStatus = (v: unknown): v is OfferingStatus =>
    typeof v === 'string' && (OFFERING_STATUSES as readonly string[]).includes(v);
export const isOfferedToKind = (v: unknown): v is OfferedToKind => v === 'tree' || v === 'vision';

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

// ── The twin blocks (server only: they carry English, which the domain never does) ────────
// What the two chains record on acceptance — the offerer's tree and the receiver — each naming
// the other and the offering, so either chain alone proves the agreement. Hash, previousHash,
// lid, mintedAt and createdAt are added by the mint; visibility follows the offering's.
export interface OfferingTwinSource {
    id: string;
    lid: string;
    title: string;
    authorId: string;
    authorName: string;
    domain: string;
    visibility: string;
    toKind: OfferedToKind;
    toId: string;
    toName: string;
    fromTreeId: string;
    fromTreeName: string;
}

export const offeringTwinBlocks = (o: OfferingTwinSource, acceptor: { uid: string; name: string }) => {
    const shared = {
        type: 'standard',
        title: 'Offering accepted',
        offeringId: o.id,
        offeringLid: o.lid,
        domain: o.domain,
        visibility: o.visibility,
    };
    const from = {
        ...shared,
        lifetreeId: o.fromTreeId,
        body: `${o.title} — offered to ${o.toName}, accepted.`,
        offeringRole: 'from',
        offeringTwinOf: o.toId,
        offeringTwinKind: o.toKind,
        authorId: o.authorId,
        authorName: o.authorName,
    };
    const to = {
        ...shared,
        ...(o.toKind === 'vision' ? { visionId: o.toId } : { lifetreeId: o.toId }),
        body: `${o.title} — offered by ${o.fromTreeName}, accepted.`,
        offeringRole: 'to',
        offeringTwinOf: o.fromTreeId,
        offeringTwinKind: 'tree',
        authorId: acceptor.uid,
        authorName: acceptor.name,
    };
    return { from, to };
};
