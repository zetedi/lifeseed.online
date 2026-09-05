import { query, getDocs, getDoc, addDoc, setDoc, collection, serverTimestamp, doc, runTransaction, where, updateDoc, deleteDoc, Timestamp, type DocumentData } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { announce } from '../refreshBus';
import { type Pulse, type Community, type Decision, type DecisionNature, type DecisionMode, type ConsensusStance, votesRequired } from '../../types';
import { createBlock } from '../../utils/crypto';
import { uuidv7 } from '../../utils/id';
import { type PulseVisibility } from '../../domain/pulse';
import {
  DECISION_EPOCH_DOMAIN, decisionIdentity, decisionEnacted, decisionAuthoritative,
  decisionEpochSignaturePayload, verifiedDecisionSigners, decisionDeletable,
} from '../../domain/decision';
import { signatureFromDoc } from '../../domain/covenant';
import { ensureSigningKey, publishSigningKey, isKeyInLineage, getPublishedSigningKey, sign as signWithKey, verify as verifyWithKey } from '../keys';
import { functions, auth, db, toMillis, mapDoc, pulsesCollection } from './core';
import { normalizeDomain } from './trees';

// ---------------------------------------------------------------------------
// Governance — an event that is a decision. Its NATURE sets the votes it needs.
// Decisions are NOT a separate collection: they are pulses (type 'decision') on the one
// immutable ledger, exactly as community events are. Pulse, event, decision — one chain.
// ---------------------------------------------------------------------------

export const createDecision = async (
    community: Pick<Community, 'id' | 'domain'>,
    data: { nature: DecisionNature; title: string; body?: string; subject?: string; proposedBy: string; mode?: DecisionMode },
): Promise<Decision> => {
    const mode: DecisionMode = data.mode || 'threshold';
    const required = votesRequired(data.nature);
    // votes[] IS RETIRED (ring 2026-08-10): a decision is born with NO votes field. A voice is a
    // signature doc; even the proposer's own arrives through signDecision, when they choose —
    // which keeps DRAFT VANISHES true (an unsigned proposal stays erasable). Legacy documents
    // keep their arrays as read-only history; nothing writes one again.
    const payload = {
        type: 'decision',
        communityId: community.id,
        domain: normalizeDomain(community.domain),
        // Decisions are the circle's business first: community-visible by default, shown to
        // the public only when deliberately made public (the flip below). Some deliberations
        // are private, or simply too much weight for the node's front pages.
        visibility: 'community' as PulseVisibility,
        nature: data.nature,
        title: data.title,
        body: data.body || '',
        subject: data.subject || '',
        authorId: data.proposedBy, // unified with pulses' author field
        proposedBy: data.proposedBy,
        mode,
        votesRequired: required,
        positions: [] as any[],
        status: 'open' as const,
    };
    const hash = await createBlock('DECISION', payload, Date.now());
    const lid = uuidv7();
    const ref = await addDoc(pulsesCollection, {
        ...payload,
        lid,
        previousHash: 'DECISION',
        hash,
        createdAt: serverTimestamp(),
    });
    return { id: ref.id, lid, ...payload, previousHash: 'DECISION', hash } as unknown as Decision;
};

// The unsigned vote is RETIRED (votes→signatures convergence, ring 2026-08-09). voteOnDecision
// appended a bare authenticated uid and enacted at votes.length — no crypto anywhere in the
// path. It had no callers left (the council signs), but an exported enactment door that trusts
// an array is a door someone eventually re-wires. Every affirmative now goes through
// signDecision below; the votes[] array remains only as the display/delete-guard
// denormalisation those signatures feed.

// ── The signed vote — a decision seven people sign (Covenant, phase 3) ─────────────────────────────
// A vote becomes an Ed25519 SIGNATURE over the decision's frozen canonical identity (domain/decision.ts).
// Signatures live one-per-member in pulses/{decisionId}/signatures/{uid} — the open-membership analogue
// of the covenant's signature subcollection (there is no fixed roster; any community member may sign
// until quorum). Enactment is by the VERIFIED count, never the raw votes[] — the seal is the signatures.

// A per-member signature doc: the base64 Ed25519 signature over the decision identity, plus the signer's
// published SPKI public key AT SIGNING TIME (so verification never depends on a later-rotated key). In
// consensus mode a `position` of 'unite' marks it as an affirmative uniting signature (stand_aside /
// block are NOT signed — they stay positions/concerns as before).
export interface DecisionSignature {
  uid: string;       // == the signatures doc id (each member writes only their own slot)
  sig: string;       // base64 Ed25519 signature over decisionIdentity(...)
  pubkey: string;    // base64 SPKI public key used to sign
  position?: ConsensusStance; // 'unite' in consensus mode; absent in threshold mode
  version?: 3;
  keyFingerprint?: string;
  epochId?: string;
  recordedAt?: unknown;
  signedAt?: unknown; // historical v2 record
}

const decisionSignaturesCol = (decisionId: string) => collection(db, 'pulses', decisionId, 'signatures');

// A being's PUBLISHED identity key — persons/{uid}.publicKeyPem, read through the ONE canonical
// reader (services/keys.getPublishedSigningKey). A signature counts toward enactment if its recorded
// pubkey EQUALS this key (the fast path) or lives in the signer's append-only lineage — and
// verifies. Absent reads as '' (a member who has not set up signing cannot yet contribute a count).
const getPublishedKey = getPublishedSigningKey;

// Read the freshest decision doc (identity + chain head + status). Returns null if it vanished.
const readDecision = async (decisionId: string): Promise<Decision | null> => {
  const snap = await getDoc(doc(db, 'pulses', decisionId));
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as DocumentData) } as Decision) : null;
};

export const getDecisionSignatures = async (decisionId: string): Promise<DecisionSignature[]> => {
  const snap = await getDocs(decisionSignaturesCol(decisionId));
  // PATH-AUTHORITATIVE: the signer is the DOC ID (the slot the rules bound the write to). The body
  // spreads FIRST and the id lands LAST (signatureFromDoc), so a malicious body `uid` field can
  // never claim another member's slot.
  return snap.docs.map(d => signatureFromDoc(d.id, d.data() as DocumentData) as DecisionSignature);
};

// Verify a decision the way any reader can: re-derive the frozen identity, then count the signatures
// whose recorded pubkey EQUALS the signer's currently-published persons key — OR is a key in the
// signer's append-only lineage at persons/{uid}/keys (KEY CONTINUITY: rotation/recovery no longer
// unbinds history) — AND whose Ed25519 verifies against that identity. In consensus mode only 'unite'
// signatures are affirmatives. `enacted` is whether the crypto meets the quorum RIGHT NOW; `valid` is
// whether the decision's CLAIMED status is honest — a threshold decision flipped to 'passed' with
// fewer verified signatures than required fails here (the seal is the signatures, not the flag).
// Membership is enforced at WRITE time by the rules (only a community member may create a signature),
// so verification binds to the IDENTITY key, matching verifyCovenant. Legacy unsigned uid-votes are
// not signatures and never appear here — they remain valid-by-auth on the `votes` array (see the
// migration note), simply outside the crypto count. `verifiedSigners` (sorted) is the only list an
// enactment block may record.
export const verifyDecision = async (
  decision: Pick<Decision, 'lid' | 'communityId' | 'nature' | 'title' | 'body' | 'votesRequired' | 'status' | 'mode'>,
  sigs: DecisionSignature[],
): Promise<{ valid: boolean; verifiedCount: number; enacted: boolean; verifiedSigners: string[] }> => {
  const identity = decisionIdentity(decision);
  const mode: DecisionMode = decision.mode || 'threshold';
  const uids = [...new Set(sigs.map(s => s.uid))];
  const published = new Map<string, string>();
  await Promise.all(uids.map(async uid => published.set(uid, await getPublishedKey(uid))));
  // The counting rule is PURE (domain/decision.ts) and shared with the adversarial tests: at most one
  // counted signature per uid (dedupe), consensus-position-gated, identity-bound (published key or
  // lineage), and each signature verified against the v2 payload bound to the RECORD'S OWN path-uid —
  // a copied signature can never verify in another member's slot, so one real hand can never fill a
  // seven-quorum.
  const signers = await verifiedDecisionSigners(identity, sigs, mode, published, verifyWithKey, isKeyInLineage);
  const enacted = decisionEnacted(signers.size, decision.votesRequired);
  const valid = decisionAuthoritative(decision.status, signers.size, decision.votesRequired, mode);
  return { valid, verifiedCount: signers.size, enacted, verifiedSigners: [...signers].sort() };
};

// Everything the council view needs to show a decision's crypto state in one call: the raw signatures
// and the re-run verification (verified count vs. the quorum, and whether a claimed 'passed' is honest).
export const getDecisionSignatureState = async (
  decision: Pick<Decision, 'id' | 'lid' | 'communityId' | 'nature' | 'title' | 'body' | 'votesRequired' | 'status' | 'mode'>,
): Promise<{ signatures: DecisionSignature[]; verifiedCount: number; enacted: boolean; valid: boolean }> => {
  const signatures = await getDecisionSignatures(decision.id);
  const v = await verifyDecision(decision, signatures);
  return { signatures, ...v };
};

export interface SignDecisionResult {
  // 'enacted' — this signature landed the quorum (threshold); 'signed' — recorded, quorum not yet met;
  // 'already' — the member had already signed; 'listening'/'closed' — the proposal took no signature.
  outcome: 'enacted' | 'signed' | 'already' | 'listening' | 'closed';
  verifiedCount: number;
  // Present ONLY when the device key was created during this call — surface it for backup, then let it
  // go (never persisted, never shown again).
  recoveryPhrase?: string[];
}

// Sign a decision in your own hand. Ensures the caller has a device key (returning the recovery phrase
// ONCE if freshly created), confirms they are a community member, signs the frozen identity, and writes
// their OWN signature slot. It ALSO denormalises into the decision doc — appending the uid to `votes`
// (threshold) or recording a 'unite' position (consensus) — so existing queries/UI keep working. Then it
// re-reads + verifies every signature and, in THRESHOLD mode, enacts at the VERIFIED quorum (mint the
// enactedHash block + status 'passed', in a transaction that bails if already enacted — no double-enact).
// CONSENSUS enactment stays with the clerk's discernment (discernDecision); a 'unite' here is a recorded,
// signed affirmative, not an auto-pass. stand_aside / block are NOT signed — route those through
// recordPosition as before.
export const signDecision = async (
  decision: Pick<Decision, 'id'>,
  position?: ConsensusStance,
): Promise<SignDecisionResult> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('err_signin_voice');
  const decisionId = decision.id;
  const ref = doc(db, 'pulses', decisionId);

  const fresh = await readDecision(decisionId);
  if (!fresh) throw new Error('err_decision_not_found');
  const mode: DecisionMode = fresh.mode || 'threshold';

  // Guards mirror voteOnDecision / recordPosition — settle these BEFORE prompting for a key.
  if (fresh.status === 'passed') return { outcome: 'enacted', verifiedCount: fresh.votesRequired };
  if (['withdrawn', 'rejected', 'expired'].includes(fresh.status)) return { outcome: 'closed', verifiedCount: 0 };
  if (mode === 'threshold' && fresh.listening) return { outcome: 'listening', verifiedCount: 0 };

  // Only a community member may sign — the crypto analogue of the covenant's party check (the rules
  // enforce the same at write time). Owner is implicitly a member of their own circle.
  if (!(await isDecisionMember(fresh.communityId, uid))) {
    throw new Error('err_decision_member_only');
  }

  // One hand, one signature: a member's slot is immutable (rules: update false), so re-signing
  // would throw AFTER the key ceremony. Answer 'already' before asking for a key at all.
  if ((await getDoc(doc(decisionSignaturesCol(decisionId), uid))).exists()) {
    const standing = await verifyDecision(fresh, await getDecisionSignatures(decisionId));
    return { outcome: 'already', verifiedCount: standing.verifiedCount };
  }

  const key = await ensureSigningKey(uid); // idempotent — creates on first use, returns the phrase once

  // The count binds to the PUBLISHED identity key: this signature only counts if its pubkey equals
  // persons/{uid}.publicKeyPem. ensureSigningKey already (re)publishes it, but assert + self-heal so a
  // past failed publish can't make this signature silently fail to count. Refuse rather than sign into
  // the void if it still can't be published.
  if ((await getPublishedKey(uid)) !== key.publicKeyB64) {
    await publishSigningKey(uid, key.publicKeyB64);
    if ((await getPublishedKey(uid)) !== key.publicKeyB64) {
      throw new Error('err_pubkey_not_set');
    }
  }

  // SIGNER + EPOCH BOUND (v3): the bytes carry this member and the exact anchored key epoch.
  const identity = decisionIdentity(fresh);
  const sig = await signWithKey(
    decisionEpochSignaturePayload(identity, uid, key.fingerprint, key.epochId),
    DECISION_EPOCH_DOMAIN,
    uid,
  );
  const sigPosition: ConsensusStance | undefined = mode === 'consensus' ? (position ?? 'unite') : undefined;

  // Each member writes ONLY their own slot (doc id == uid); the rules enforce it and community
  // membership. The pubkey is frozen here so verification never depends on a later-rotated key.
  await setDoc(doc(decisionSignaturesCol(decisionId), uid), {
    sig,
    pubkey: key.publicKeyB64,
    version: 3,
    keyFingerprint: key.fingerprint,
    epochId: key.epochId,
    recordedAt: serverTimestamp(),
    ...(sigPosition ? { position: sigPosition } : {}),
  });

  // CONSENSUS still denormalises the 'unite' position onto the doc (positions are the meeting's
  // live record — recordPosition's shape; client-stamped, serverTimestamp can't live in an array).
  // THRESHOLD writes nothing here any more: votes[] is retired, the signature IS the voice, and
  // councilView reads the signatures directly.
  if (mode === 'consensus') {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const d = snap.data() as DocumentData;
      const positions = (Array.isArray(d.positions) ? d.positions : []).filter((p: { by: string }) => p.by !== uid);
      positions.push({ by: uid, stance: 'unite', note: '', at: Timestamp.fromMillis(Date.now()) });
      tx.update(ref, { positions });
    });
  }

  // Re-read every signature and verify against the frozen identity — enactment counts VERIFIED
  // signatures, never a raw doc/array count, so the seal can never outrun the crypto.
  const sigs = await getDecisionSignatures(decisionId);
  const { verifiedCount, enacted, verifiedSigners } = await verifyDecision(fresh, sigs);

  if (mode === 'threshold' && enacted) {
    // The SEAL is the signatures: verifyDecision has already confirmed a quorum of VERIFIED signatures,
    // so this decision IS cryptographically enacted right now, whoever the signer is. The status flag +
    // chain seal-block are a BEST-EFFORT denormalisation of that fact: the pulses rule gates a
    // status→'passed' flip to the proposer / community owner / staff, so a plain member landing the
    // sealing signature can't flip it — and must not be shown an error for a write the crypto already
    // settled. When a privileged party signs (or later touches it), the flag catches up; the transaction
    // re-checks status so a concurrent enactment can't double-advance the chain. (fresh.status was
    // narrowed away from 'passed' by the early guard above.)
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('err_decision_vanished');
        const d = snap.data() as DocumentData;
        if (d.status === 'passed') return; // another client already enacted — nothing to do
        // The enactment block records ONLY the cryptographically verified signers — never the raw
        // votes[] array, which an invalid signature doc (or a legacy unsigned voice) also feeds.
        const enactedHash = await createBlock(d.hash || 'DECISION', { decision: decisionId, signers: verifiedSigners, enacted: true, sealedBySignatures: true }, Date.now());
        tx.update(ref, { status: 'passed', passedAt: serverTimestamp(), enactedHash });
      });
    } catch { /* status flip is privileged (rules); the crypto quorum stands regardless — the flag catches up */ }
    return { outcome: 'enacted', verifiedCount, ...(key.created && key.recoveryPhrase ? { recoveryPhrase: key.recoveryPhrase } : {}) };
  }

  return { outcome: 'signed', verifiedCount, ...(key.created && key.recoveryPhrase ? { recoveryPhrase: key.recoveryPhrase } : {}) };
};

// Community membership for signing: a `member` link, or being the community's owner (implicitly inside
// their own circle). Mirrors the rules' isCommunityMember (hasLink('member', …) || owner).
const isDecisionMember = async (communityId: string, uid: string): Promise<boolean> => {
  if (!communityId) return false;
  const linkSnap = await getDoc(doc(db, 'links', `${uid}__member__${communityId}`));
  if (linkSnap.exists()) return true;
  const comSnap = await getDoc(doc(db, 'communities', communityId));
  return comSnap.exists() && (comSnap.data() as DocumentData).ownerId === uid;
};

// ── Migration (BUILT, NOT RUN) ─────────────────────────────────────────────────────────────────────
// A CENSUS, not a rewrite. Existing uid-votes CANNOT be retro-signed — no server holds a being's private
// key, and a signature must be minted by the being itself (in the app, on its device). So legacy unsigned
// votes REMAIN valid-by-auth on the `votes` array; only new votes are signed. This walks the decisions
// and reports the crossover — how many carry cryptographic signatures vs. legacy-only votes — so a
// guardian can watch the ledger cut over. Idempotent and read-only (it writes nothing). Staff-run from
// the superadmin console; NOT invoked anywhere.
export const migrateDecisionsToSignatures = async (): Promise<{ scanned: number; signed: number; legacyUnsigned: number }> => {
  const snap = await getDocs(pulsesCollection);
  let scanned = 0, signed = 0, legacyUnsigned = 0;
  for (const d of snap.docs) {
    const data = d.data() as DocumentData;
    if (data.type !== 'decision') continue;
    scanned++;
    const sigs = await getDocs(decisionSignaturesCol(d.id));
    if (!sigs.empty) signed++;
    else if (Array.isArray(data.votes) && data.votes.length) legacyUnsigned++;
  }
  return { scanned, signed, legacyUnsigned };
};

// Raise a concern (a veto that opens reflection, not just a halt). Records the concern and puts
// the decision into `listening` — a visible, reflective pause ("A concern was raised. This
// proposal has entered listening.") that stops it passing until the concern is cared for.
export const raiseConcern = async (decisionId: string, uid: string, note?: string): Promise<'listening' | 'closed'> => {
    const actor = auth.currentUser?.uid || uid;
    const ref = doc(db, 'pulses', decisionId);
    return runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('err_decision_not_found');
        const d = snap.data() as any;
        if (['passed', 'withdrawn', 'rejected', 'expired'].includes(d.status)) return 'closed' as const;
        // One concern per voice (a re-raise replaces it) — bounds the array, no spam. And
        // serverTimestamp() can't live inside an array element, so stamp the concern client-side.
        const concerns = (Array.isArray(d.concerns) ? d.concerns : []).filter((c: { by: string }) => c.by !== actor);
        tx.update(ref, { listening: true, concerns: [...concerns, { by: actor, note: note || '', at: Timestamp.fromMillis(Date.now()) }] });
        return 'listening' as const;
    });
};

// Care the concern: lift the listening pause so the circle can continue. (Concerns are kept.)
export const resumeDecision = (decisionId: string) =>
    updateDoc(doc(db, 'pulses', decisionId), { listening: false });

// The proposer (or keeper/staff — the rules' status gate) withdraws their proposal. WITHDRAWING IS
// A MARK: alongside the status flip, a withdrawal block is appended to the decision's chain
// (withdrawnHash — previous: the enactment block if one stands, else the genesis), so even an
// ENACTED decision's retirement is chain-recorded, never an erasure — "minted withdraws".
// Idempotent: an already-closed decision is left exactly as it stands.
export const withdrawDecision = async (decisionId: string): Promise<'withdrawn' | 'closed'> => {
    const uid = auth.currentUser?.uid || '';
    const ref = doc(db, 'pulses', decisionId);
    return runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('err_decision_not_found');
        const d = snap.data() as DocumentData;
        if (['withdrawn', 'rejected', 'expired'].includes(d.status)) return 'closed' as const;
        const withdrawnHash = await createBlock(d.enactedHash || d.hash || 'DECISION', { decision: decisionId, withdrawn: true, by: uid }, Date.now());
        tx.update(ref, { status: 'withdrawn', listening: false, withdrawnAt: serverTimestamp(), withdrawnHash });
        return 'withdrawn' as const;
    });
};

// Close a proposal as not adopted.
export const rejectDecision = (decisionId: string) =>
    updateDoc(doc(db, 'pulses', decisionId), { status: 'rejected', listening: false, rejectedAt: serverTimestamp() });

// Flip a decision between the circle and the public square — proposer, keeper or staff only
// (enforced by the rules' visibility clause). Community-visible is the default at creation.
export const setDecisionVisibility = (decisionId: string, visibility: 'public' | 'community') =>
    updateDoc(doc(db, 'pulses', decisionId), { visibility, updatedAt: serverTimestamp() });

// Remove a decision entirely — DRAFT VANISHES, MINTED WITHDRAWS (domain/decision.decisionDeletable).
// Only a decision that is still its proposer's own draft may be erased: not passed, no signature in
// its subcollection, no other voice on it. Everything else must be WITHDRAWN (withdrawDecision) —
// marked, never erased. The rules enforce the doc-visible half at rest (status/votes/positions);
// the signature half lives here, because rules cannot read a subcollection. Deleting only unsigned
// decisions also means a delete can never orphan signature docs.
export const deleteDecision = async (decisionId: string): Promise<void> => {
    const fresh = await readDecision(decisionId);
    if (!fresh) return; // already gone
    const sigs = await getDocs(decisionSignaturesCol(decisionId));
    if (!decisionDeletable(fresh, sigs.size)) {
        throw new Error('err_decision_signed_no_delete');
    }
    await deleteDoc(doc(db, 'pulses', decisionId));
};

// --- Quaker consensus -----------------------------------------------------------------------
// Record a voice's position in a consensus meeting: unite, stand aside, or block. One per person
// (a new position replaces the old). Blocked-ness is derived from positions in the view, so this
// never touches `status` — it stays within what any signed-in member may write. A closed decision
// takes no more positions. Timestamps are client-stamped (serverTimestamp can't live in an array).
export const recordPosition = async (decisionId: string, uid: string, stance: ConsensusStance, note?: string): Promise<'ok' | 'closed'> => {
    const actor = auth.currentUser?.uid || uid;
    const ref = doc(db, 'pulses', decisionId);
    return runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('err_proposal_not_found');
        const d = snap.data() as any;
        if (['passed', 'withdrawn', 'rejected', 'expired'].includes(d.status)) return 'closed' as const;
        const positions = (Array.isArray(d.positions) ? d.positions : []).filter((p: { by: string }) => p.by !== actor);
        positions.push({ by: actor, stance, note: note || '', at: Timestamp.fromMillis(Date.now()) });
        tx.update(ref, { positions });
        return 'ok' as const;
    });
};

// The clerk discerns the sense of the meeting. Uniting (passing) requires that NO block stands;
// a clerk may also record that the meeting did not reach unity ('rejected'). Clerk = proposer /
// community owner / staff (enforced by the pulse-update rule's status gate).
export const discernDecision = async (decisionId: string, outcome: 'passed' | 'rejected'): Promise<'passed' | 'rejected'> => {
    const ref = doc(db, 'pulses', decisionId);
    return runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('err_proposal_not_found');
        const d = snap.data() as any;
        if (['passed', 'withdrawn', 'rejected', 'expired'].includes(d.status)) throw new Error('err_proposal_settled');
        if (outcome === 'passed') {
            const blocks = (Array.isArray(d.positions) ? d.positions : []).filter((p: { stance: string }) => p.stance === 'block');
            if (blocks.length) throw new Error('err_block_stands');
            const enactedHash = await createBlock(d.hash || 'DECISION', { decision: decisionId, united: true }, Date.now());
            tx.update(ref, { status: 'passed', passedAt: serverTimestamp(), enactedHash });
            return 'passed' as const;
        }
        tx.update(ref, { status: 'rejected', rejectedAt: serverTimestamp() });
        return 'rejected' as const;
    });
};

export const getDecisions = async (communityId: string, levels?: PulseVisibility[]): Promise<Decision[]> => {
    const base = where('communityId', '==', communityId);
    // Governance is a council concern: a viewer only queries decisions at visibility levels the
    // rules allow them (a signed-out viewer → ['public']), so private/community-scoped decisions
    // never reach an outsider. Mirrors getCommunityEvents; needs the (communityId, visibility) index.
    const q = levels && levels.length
        ? query(pulsesCollection, base, where('visibility', 'in', levels))
        : query(pulsesCollection, base);
    const snap = await getDocs(q);
    return snap.docs
        .map(d => (mapDoc(d) as Decision))
        .filter(p => (p as any).type === 'decision')
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

export const deleteCommunityEvent = (eventId: string) => deleteDoc(doc(db, 'pulses', eventId));

// Edit an event's content fields. The chain hash / lid / author stay immutable — only the
// editable fields are written, and author is never overwritten so an admin editing someone
// else's event doesn't steal authorship. Edit authorization is enforced app-side via
// canEditEvent (creator / community admin / node owner), matching the trusted-cohort posture.
export const updateEvent = async (
    eventId: string,
    data: Partial<Pick<Pulse, 'title' | 'body' | 'content' | 'imageUrl' | 'imageUrls' | 'eventDate' | 'eventLocation' | 'eventMaxParticipants' | 'visibility'>>,
) => {
    await updateDoc(doc(db, 'pulses', eventId), { ...data });
    // The edit whispers its patch — every open list merges it (ring 2026-08-22).
    announce('events', eventId, data as Record<string, unknown>);
};

// A standalone event — anyone can plant one (no community required). A community can later
// form around it. It's a pulse of type 'event' on the one ledger, like community events.
export const createEvent = async (data: Partial<Pulse> & { title: string }) => {
    const domain = normalizeDomain(data.domain || (typeof window !== 'undefined' ? window.location.hostname : ''));
    const eventPayload = { ...data, type: 'event', domain, visibility: data.visibility || 'public' };
    const hash = await createBlock('EVENT', eventPayload, Date.now());
    const lid = uuidv7();
    const ref = await addDoc(pulsesCollection, {
        ...eventPayload,
        lid,
        loveCount: 0,
        commentCount: 0,
        previousHash: 'EVENT',
        hash,
        createdAt: serverTimestamp(),
    });
    return { id: ref.id, lid, ...eventPayload, loveCount: 0, commentCount: 0, previousHash: 'EVENT', hash } as Pulse;
};

// An OFFERING — a bed or service offered through trust, with optional suggested appreciation
// after it is received (domain/offering). A standalone pulse, so it flows into the one ledger.
export const createOffering = async (data: Partial<Pulse> & { title: string }) => {
    const domain = normalizeDomain(data.domain || (typeof window !== 'undefined' ? window.location.hostname : ''));
    const payload = { ...data, type: 'offering', domain, visibility: data.visibility || 'public' };
    const hash = await createBlock('OFFERING', payload, Date.now());
    const lid = uuidv7();
    const ref = await addDoc(pulsesCollection, {
        ...payload,
        lid,
        loveCount: 0,
        commentCount: 0,
        previousHash: 'OFFERING',
        hash,
        createdAt: serverTimestamp(),
    });
    return { id: ref.id, lid, ...payload, loveCount: 0, commentCount: 0, previousHash: 'OFFERING', hash } as Pulse;
};

// ── THE OFFERING OF CARE (ring 2026-09-06) ────────────────────────────────────────────────
// An offering made TO a being — a tree or a vision — answered on its own leaf. Withdraw and
// decline are one-flip client writes the rules guard (domain/offering: the author while open;
// a hand standing for the receiver while open). ACCEPTANCE is the server's alone: the
// acceptOffering callable judges (judgeOfferingAccept, mirrored) and mints the twin blocks on
// the offerer's tree chain and the receiver's own chain in one transaction.

export const withdrawOffering = async (id: string): Promise<void> => {
    const patch = { offeringStatus: 'withdrawn' as const, offeringAnsweredAt: serverTimestamp(), updatedAt: serverTimestamp() };
    await updateDoc(doc(pulsesCollection, id), patch);
    announce('pulses', id, { offeringStatus: 'withdrawn' });
};

export const declineOffering = async (id: string, byUid: string): Promise<void> => {
    const patch = { offeringStatus: 'declined' as const, offeringAnsweredBy: byUid, offeringAnsweredAt: serverTimestamp(), updatedAt: serverTimestamp() };
    await updateDoc(doc(pulsesCollection, id), patch);
    announce('pulses', id, { offeringStatus: 'declined', offeringAnsweredBy: byUid });
};

export interface OfferingAccepted { fromPulseId: string; toPulseId: string }

export const acceptOffering = async (id: string): Promise<OfferingAccepted> => {
    const fn = httpsCallable<{ offeringId: string }, OfferingAccepted>(functions, 'acceptOffering');
    const res = await fn({ offeringId: id });
    announce('pulses', id, { offeringStatus: 'accepted' });
    return res.data;
};

// The offerings made to one being, newest first — the receiver finds them on the being's face.
export const getOfferingsTo = async (kind: 'tree' | 'vision', id: string): Promise<Pulse[]> => {
    const snap = await getDocs(query(pulsesCollection, where('type', '==', 'offering'), where('offeredToKind', '==', kind), where('offeredToId', '==', id)));
    return snap.docs
        .map(d => ({ id: d.id, ...(d.data() as DocumentData) }) as Pulse)
        .sort((a, b) => ((b.createdAt as any)?.toMillis?.() || 0) - ((a.createdAt as any)?.toMillis?.() || 0));
};

// The offering's lifecycle switch: its author pauses or rewakes it. A paused offering leaves the
// shared feed but stays the author's to see; nothing is deleted (the rules allow exactly this
// one flip, nothing riding along).
export const setOfferingActive = async (id: string, active: boolean): Promise<void> => {
    await updateDoc(doc(pulsesCollection, id), { offeringActive: active, updatedAt: serverTimestamp() });
};

// Retell an offering: its words, face, suggested appreciation and detail door. The KIND and any
// bed it stands for stay frozen (the rules refuse them), so a service never becomes a bed.
export const updateOffering = async (
    id: string,
    data: Partial<Pick<Pulse, 'title' | 'body' | 'content' | 'imageUrl' | 'offeringAppreciationLight' | 'offeringUrl' | 'visibility'>>,
): Promise<void> => {
    await updateDoc(doc(pulsesCollection, id), { ...data, updatedAt: serverTimestamp() });
    announce('pulses', id, data as Record<string, unknown>);
};

export const createCommunityEvent = async (community: Community, data: Partial<Pulse> & { title: string }) => {
    const eventPayload = {
        ...data,
        type: 'event',
        domain: normalizeDomain(community.domain),
        communityId: community.id,
        communityName: community.name,
        visibility: data.visibility || 'public',
    };
    const hash = await createBlock('COMMUNITY_EVENT', eventPayload, Date.now());
    const lid = uuidv7();
    const eventRef = await addDoc(pulsesCollection, {
        ...eventPayload,
        lid,
        loveCount: 0,
        commentCount: 0,
        previousHash: 'COMMUNITY_EVENT',
        hash,
        createdAt: serverTimestamp(),
    });
    return { id: eventRef.id, lid, ...eventPayload, loveCount: 0, commentCount: 0, previousHash: 'COMMUNITY_EVENT', hash } as Pulse;
};
