import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, setDoc, updateDoc, getDoc, getDocs, deleteDoc, deleteField, query, where, Timestamp, runTransaction, serverTimestamp, writeBatch } from 'firebase/firestore';

// The security fence around the release's hottest rules. Runs under the Firestore emulator:
//   npm run test:rules
// Each test asks one question: can THIS person do THIS thing — and only that thing?

let env: RulesTestEnvironment;

const ALICE = 'alice-uid';   // initiator / community founder
const BOB = 'bob-uid';       // target / tree owner
const MALLORY = 'mallory-uid';
const STAFF = 'staff-uid';
const SIGNING_PUBKEY = 'base64-spki-pubkey';
const SIGNING_FP = 'a'.repeat(64);
const SIGNING_EPOCH = `anchor_${SIGNING_FP}`;

const db = (uid?: string) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());

// The production love gesture: read parent + own slot, then move the slot and tally in ONE
// transaction. The rules use getAfter/existsAfter to prove these two writes are inseparable.
const toggleLove = async (uid: string, collectionName: string, id: string) => {
  const store = db(uid);
  const parent = doc(store, collectionName, id);
  const slot = doc(parent, 'loves', uid);
  await runTransaction(store, async (t) => {
    const parentSnap = await t.get(parent);
    if (!parentSnap.exists()) throw new Error('Missing love target');
    const slotSnap = await t.get(slot);
    const data = parentSnap.data();
    const before = collectionName === 'pulses'
      ? (data.loveCount || data.validationScore || 0)
      : (data.loveCount || 0);
    const after = slotSnap.exists() ? Math.max(0, before - 1) : before + 1;
    if (slotSnap.exists()) t.delete(slot);
    else t.set(slot, { uid, createdAt: serverTimestamp() });
    t.update(parent, collectionName === 'pulses'
      ? { loveCount: after, validationScore: after, updatedAt: serverTimestamp() }
      : { loveCount: after, updatedAt: serverTimestamp() });
  });
};

// Seed data written with rules disabled (as the backend would).
const seed = async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'admins', STAFF), { grantedAt: 1 });
    await setDoc(doc(d, 'alignments', 'al1'), {
      initiatorUid: ALICE, targetUid: BOB,
      initiatorTreeId: 'treeA', targetTreeId: 'treeB',
      initiatorPulseId: 'p1', targetPulseId: 'p2',
      status: 'PENDING', messages: [],
    });
    await setDoc(doc(d, 'lifetrees', 'treeB'), { ownerId: BOB, name: 'Bobs tree', validated: false, validatorId: null, loveCount: 0 });
    await setDoc(doc(d, 'initiates', ALICE), { handle: 'alice', name: 'Alice', lid: 'x', pubkey: 'y', initiatedAt: '2026-07-07' });
    await setDoc(doc(d, 'communities', 'com1'), { ownerId: ALICE, name: 'Com', domain: 'com.online', loveCount: 0 });
    await setDoc(doc(d, 'lightHouses', 'lh1'), { ownerId: ALICE, name: 'The Hearth', lid: 'lh1-lid', visibility: 'public', loveCount: 0 });
    await setDoc(doc(d, 'lifetrees', 'bedStay'), { ownerId: ALICE, name: 'Cedar', treeType: 'BED', lightHouseId: 'lh1', visibility: 'node', validated: false, validatorId: null, loveCount: 0 });
    await setDoc(doc(d, 'visions', 'vision1'), { authorId: ALICE, title: 'A clearing', visibility: 'public', loveCount: 0 });
    await setDoc(doc(d, 'pulses', 'pulseLove'), { authorId: BOB, type: 'standard', title: 'A pulse', visibility: 'public', loveCount: 0, validationScore: 0 });
    await setDoc(doc(d, 'pulses', 'offer1'), { authorId: ALICE, type: 'offering', offeringKind: 'service', title: 'Herbal walk', visibility: 'public', offeringActive: true });
    // The offering of care (ring 2026-09-06): ALICE offers a night of song to BOB's treeB from her own treeA;
    // BOB offers a pull request to ALICE's vision1 from treeB. Both born open.
    await setDoc(doc(d, 'lifetrees', 'treeA'), { ownerId: ALICE, name: 'Alices oak', validated: false, validatorId: null, loveCount: 0 });
    await setDoc(doc(d, 'pulses', 'offerCare1'), { authorId: ALICE, type: 'offering', offeringKind: 'service', title: 'A night of song', visibility: 'public', offeringActive: true,
      offeredToKind: 'tree', offeredToId: 'treeB', offeredToKeeperUid: BOB, offeringFromTreeId: 'treeA', offeringStatus: 'open' });
    await setDoc(doc(d, 'pulses', 'offerCode1'), { authorId: BOB, type: 'offering', offeringKind: 'code', title: 'Fix the door', offeringUrl: 'https://github.com/x/y/pull/7', visibility: 'public', offeringActive: true,
      offeredToKind: 'vision', offeredToId: 'vision1', offeredToKeeperUid: ALICE, offeringFromTreeId: 'treeB', offeringStatus: 'open' });
    for (const uid of [ALICE, BOB]) {
      await setDoc(doc(d, 'persons', uid), {
        lid: `${uid}-lid`,
        publicKeyPem: SIGNING_PUBKEY,
        signingKeyFingerprint: SIGNING_FP,
        signingEpochId: SIGNING_EPOCH,
        signingState: 'active',
        signingAnchoredAt: Timestamp.fromMillis(1),
      });
      await setDoc(doc(d, 'persons', uid, 'keys', SIGNING_FP), {
        pubkey: SIGNING_PUBKEY,
        publishedAt: Timestamp.fromMillis(1),
      });
      await setDoc(doc(d, 'persons', uid, 'keyEvents', SIGNING_EPOCH), {
        version: 1,
        type: 'anchor',
        uid,
        lid: `${uid}-lid`,
        epochId: SIGNING_EPOCH,
        keyFingerprint: SIGNING_FP,
        recordedAt: Timestamp.fromMillis(1),
      });
    }
  });
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'lifeseed-rules-test',
    firestore: { rules: readFileSync(join(__dirname, '..', '..', 'firestore.rules'), 'utf8') },
  });
});
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await seed(); });

describe("alignments — the discussion is open, the settlement is the target's", () => {
  it('either participant may write messages while PENDING', async () => {
    await assertSucceeds(updateDoc(doc(db(ALICE), 'alignments', 'al1'), { messages: [{ by: ALICE, text: 'hi', at: 1 }] }));
    await assertSucceeds(updateDoc(doc(db(BOB), 'alignments', 'al1'), { messages: [{ by: BOB, text: 'hello', at: 2 }] }));
  });

  it('a non-participant may not write messages', async () => {
    await assertFails(updateDoc(doc(db(MALLORY), 'alignments', 'al1'), { messages: [{ by: MALLORY, text: 'let me in', at: 3 }] }));
  });

  it('the INITIATOR cannot self-accept — only the target settles status', async () => {
    await assertFails(updateDoc(doc(db(ALICE), 'alignments', 'al1'), { status: 'ACCEPTED' }));
    await assertSucceeds(updateDoc(doc(db(BOB), 'alignments', 'al1'), { status: 'ACCEPTED' }));
  });

  it('status and messages cannot ride along with other fields', async () => {
    await assertFails(updateDoc(doc(db(BOB), 'alignments', 'al1'), { status: 'ACCEPTED', targetPulseId: 'forged' }));
    await assertFails(updateDoc(doc(db(ALICE), 'alignments', 'al1'), { messages: [], initiatorTreeId: 'forged' }));
  });
});

describe('initiates — git is the source of truth; only staff mirror it', () => {
  it('anyone may read; a non-staff user may not write themselves in', async () => {
    await assertSucceeds(getDoc(doc(db(), 'initiates', ALICE)));
    await assertFails(setDoc(doc(db(MALLORY), 'initiates', MALLORY), { handle: 'mallory' }));
    await assertSucceeds(setDoc(doc(db(STAFF), 'initiates', BOB), { handle: 'bob' }));
  });
});

describe('lifetrees validation — initiates sign in their own name, on only', () => {
  it('an initiate validates a tree (validation fields only, validatorId = self)', async () => {
    await assertSucceeds(updateDoc(doc(db(ALICE), 'lifetrees', 'treeB'), {
      validated: true, validatorId: ALICE, updatedAt: 1,
    }));
  });

  it('a non-initiate without a validated tree cannot validate', async () => {
    await assertFails(updateDoc(doc(db(MALLORY), 'lifetrees', 'treeB'), {
      validated: true, validatorId: MALLORY, updatedAt: 1,
    }));
  });

  it('an initiate cannot name someone else as validator, un-validate, or smuggle other fields', async () => {
    await assertFails(updateDoc(doc(db(ALICE), 'lifetrees', 'treeB'), { validated: true, validatorId: BOB, updatedAt: 1 }));
    await assertFails(updateDoc(doc(db(ALICE), 'lifetrees', 'treeB'), { validated: false, validatorId: ALICE, updatedAt: 1 }));
    await assertFails(updateDoc(doc(db(ALICE), 'lifetrees', 'treeB'), { validated: true, validatorId: ALICE, ownerId: ALICE, updatedAt: 1 }));
  });
});

describe('communityTreeInvites — anyone invites as themselves; the tree owner settles', () => {
  const invite = { communityId: 'com1', communityName: 'Com', lifetreeId: 'treeB', lifetreeName: 'Bobs tree', invitedUserId: BOB, invitedByUserId: ALICE, status: 'pending' };

  it('creating requires naming yourself as inviter', async () => {
    await assertSucceeds(setDoc(doc(db(ALICE), 'communityTreeInvites', 'inv1'), invite));
    await assertFails(setDoc(doc(db(MALLORY), 'communityTreeInvites', 'inv2'), invite)); // forged inviter
  });

  it('the invitee settles; a stranger cannot', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'communityTreeInvites', 'inv1'), invite));
    await assertSucceeds(updateDoc(doc(db(BOB), 'communityTreeInvites', 'inv1'), { status: 'accepted', respondedAt: 1 }));
    await assertFails(updateDoc(doc(db(MALLORY), 'communityTreeInvites', 'inv1'), { status: 'accepted' }));
  });

  it("accepting mints the participant link — only the tree's owner may", async () => {
    const link = { lid: 'x', type: 'link', rel: 'participant', from: 'treeB', to: 'com1', createdAt: 1 };
    await assertSucceeds(setDoc(doc(db(BOB), 'links', 'treeB__participant__com1'), link));
    await assertFails(setDoc(doc(db(MALLORY), 'links', 'treeB__participant__com1'), link));
  });
});

describe('config/limits — the node planting caps: world-readable, staff-set', () => {
  it('anyone may read the caps; only staff may set them', async () => {
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'config', 'limits'), { maxLifetrees: 12, maxGuardedTrees: 132 }));
    await assertSucceeds(getDoc(doc(db(), 'config', 'limits')));
    await assertFails(setDoc(doc(db(MALLORY), 'config', 'limits'), { maxLifetrees: 9999, maxGuardedTrees: 9999 }));
    await assertSucceeds(setDoc(doc(db(STAFF), 'config', 'limits'), { maxLifetrees: 21, maxGuardedTrees: 123 }));
  });

  it('other config docs stay staff-only (superadmin doc readable, not writable)', async () => {
    await assertFails(setDoc(doc(db(MALLORY), 'config', 'superadmin'), { uid: MALLORY }));
  });
});

describe('config/dataAuthority — public custody, server-owned declaration', () => {
  const authority = {
    version: 1,
    nodeLid: '019f63a2-f8e5-7f80-bea2-54d7cc8ef01a',
  };

  it('is readable without an account so the public crown can tell the truth', async () => {
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'config', 'dataAuthority'), authority));
    await assertSucceeds(getDoc(doc(db(), 'config', 'dataAuthority')));
  });

  it('cannot be declared or changed by any client, including staff', async () => {
    await assertFails(setDoc(doc(db(ALICE), 'config', 'dataAuthority'), authority));
    await assertFails(setDoc(doc(db(STAFF), 'config', 'dataAuthority'), authority));
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'config', 'dataAuthority'), authority));
    await assertFails(updateDoc(doc(db(STAFF), 'config', 'dataAuthority'), {
      nodeLid: '019f63a3-0000-7000-8000-000000000001',
    }));
  });
});

describe('beings/{lid} — the lid index: anyone may read a true name, no one may write one', () => {
  const LID = '019f63a2-f8e5-7f80-bea2-54d7cc8ef01a';
  const entry = { lid: LID, kind: 'tree', collection: 'lifetrees', docId: 'treeB' };
  const written = async () => env.withSecurityRulesDisabled(async (ctx) =>
    setDoc(doc(ctx.firestore(), 'beings', LID), entry));

  it('is readable without an account — the /b/ door opens for a stranger holding the QR', async () => {
    await written();
    await assertSucceeds(getDoc(doc(db(), 'beings', LID)));
  });

  it('but NEVER listable — you may ask about a name you hold, not harvest the names', async () => {
    await written();
    await assertFails(getDocs(collection(db(), 'beings')));
    await assertFails(getDocs(collection(db(MALLORY), 'beings')));
    await assertFails(getDocs(query(collection(db(MALLORY), 'beings'), where('collection', '==', 'pulses'))));
  });

  it('CANNOT be written by anyone, including staff — a forgeable identity record is not one', async () => {
    await assertFails(setDoc(doc(db(ALICE), 'beings', LID), entry));
    await assertFails(setDoc(doc(db(STAFF), 'beings', LID), entry));
    await assertFails(setDoc(doc(db(), 'beings', LID), entry));
  });

  it('cannot be RE-POINTED at another being, which is the whole point of the record', async () => {
    await written();
    // Mallory tries to make Alice's true name resolve to a document of theirs.
    await assertFails(updateDoc(doc(db(MALLORY), 'beings', LID), { docId: 'mallorys-tree' }));
    await assertFails(setDoc(doc(db(STAFF), 'beings', LID), { ...entry, docId: 'staffs-tree' }));
    await assertFails(deleteDoc(doc(db(STAFF), 'beings', LID)));
    let heldDocId: string | undefined;
    await env.withSecurityRulesDisabled(async (ctx) => {
      heldDocId = (await getDoc(doc(ctx.firestore(), 'beings', LID))).data()?.docId;
    });
    expect(heldDocId).toBe('treeB');
  });
});

describe('community joining — anyone knocks as themselves; only the keeper opens', () => {
  const joinReq = (from: string) => ({ lid: 'x', type: 'link', rel: 'join_request', from, to: 'com1', createdAt: 1 });
  const memberLink = { lid: 'x', type: 'link', rel: 'member', from: BOB, to: 'com1', createdAt: 1 };

  it('a signed-in user may ask to join — as themselves only', async () => {
    await assertSucceeds(setDoc(doc(db(BOB), 'links', `${BOB}__join_request__com1`), joinReq(BOB)));
    await assertFails(setDoc(doc(db(MALLORY), 'links', `${BOB}__join_request__com1`), joinReq(BOB))); // forged knocker
  });

  it('the member link is minted by the community owner — never by the requester or a stranger', async () => {
    await assertFails(setDoc(doc(db(BOB), 'links', `${BOB}__member__com1`), memberLink));     // self-admit
    await assertFails(setDoc(doc(db(MALLORY), 'links', `${BOB}__member__com1`), memberLink)); // stranger
    await assertSucceeds(setDoc(doc(db(ALICE), 'links', `${BOB}__member__com1`), memberLink)); // keeper of com1
  });

  it('the keeper may decline a request and remove a member; a stranger may neither', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'links', `${BOB}__join_request__com1`), joinReq(BOB));
      await setDoc(doc(ctx.firestore(), 'links', `${BOB}__member__com1`), memberLink);
    });
    await assertFails(deleteDoc(doc(db(MALLORY), 'links', `${BOB}__join_request__com1`)));
    await assertSucceeds(deleteDoc(doc(db(ALICE), 'links', `${BOB}__join_request__com1`)));
    await assertFails(deleteDoc(doc(db(MALLORY), 'links', `${BOB}__member__com1`)));
    await assertSucceeds(deleteDoc(doc(db(ALICE), 'links', `${BOB}__member__com1`)));
  });

  it('the requester may withdraw their own knock', async () => {
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'links', `${BOB}__join_request__com1`), joinReq(BOB)));
    await assertSucceeds(deleteDoc(doc(db(BOB), 'links', `${BOB}__join_request__com1`)));
  });
});

describe('community reflection — the keeper alone opens the canopy', () => {
  it('the owner may choose or close reflection; a stranger cannot choose for them', async () => {
    await assertSucceeds(updateDoc(doc(db(ALICE), 'communities', 'com1'), { reflectsPublic: true }));
    await assertFails(updateDoc(doc(db(MALLORY), 'communities', 'com1'), { reflectsPublic: false }));
    await assertSucceeds(updateDoc(doc(db(ALICE), 'communities', 'com1'), { reflectsPublic: false }));
  });
});

describe('Interbeing Matrix — communities attest independently, reciprocity is derived', () => {
  const edge = (from: string, rel: string, to: string) => ({
    lid: 'interbeing-lid', type: 'link', rel, from, to, createdAt: serverTimestamp(),
  });

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'communities', 'com2'), {
        ownerId: BOB, name: 'Other community', domain: 'other.online', loveCount: 0,
      }));
  });

  it('the source keeper proposes and the target keeper acknowledges with their own reverse edge', async () => {
    await assertSucceeds(setDoc(
      doc(db(ALICE), 'links', 'com1__collaborates_with__com2'),
      edge('com1', 'collaborates_with', 'com2'),
    ));
    await assertFails(setDoc(
      doc(db(MALLORY), 'links', 'com2__collaborates_with__com1'),
      edge('com2', 'collaborates_with', 'com1'),
    ));
    await assertSucceeds(setDoc(
      doc(db(BOB), 'links', 'com2__collaborates_with__com1'),
      edge('com2', 'collaborates_with', 'com1'),
    ));
  });

  it('refuses self-relations, missing communities, unknown relation types and extra claims', async () => {
    await assertFails(setDoc(doc(db(ALICE), 'links', 'com1__recognises__com1'), edge('com1', 'recognises', 'com1')));
    await assertFails(setDoc(doc(db(ALICE), 'links', 'com1__recognises__ghost'), edge('com1', 'recognises', 'ghost')));
    await assertFails(setDoc(doc(db(ALICE), 'links', 'com1__owns__com2'), edge('com1', 'owns', 'com2')));
    await assertFails(setDoc(doc(db(ALICE), 'links', 'com1__recognises__com2'), {
      ...edge('com1', 'recognises', 'com2'), reputation: 100,
    }));
    await assertFails(setDoc(doc(db(ALICE), 'links', 'com1__recognises__com2'), {
      type: 'link', rel: 'recognises', from: 'com1', to: 'com2', createdAt: serverTimestamp(),
    }));
  });

  it('each keeper may withdraw only their own attestation', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = ctx.firestore();
      await setDoc(doc(d, 'links', 'com1__recognises__com2'), edge('com1', 'recognises', 'com2'));
      await setDoc(doc(d, 'links', 'com2__recognises__com1'), edge('com2', 'recognises', 'com1'));
    });
    await assertFails(deleteDoc(doc(db(BOB), 'links', 'com1__recognises__com2')));
    await assertSucceeds(deleteDoc(doc(db(ALICE), 'links', 'com1__recognises__com2')));
    await assertSucceeds(deleteDoc(doc(db(BOB), 'links', 'com2__recognises__com1')));
  });

  it('a uid that happens to equal a community id still cannot bypass keeper authority', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = ctx.firestore();
      await setDoc(doc(d, 'communities', MALLORY), { ownerId: BOB, name: 'Collision', domain: 'collision.online' });
      await setDoc(doc(d, 'links', `${MALLORY}__recognises__com1`), edge(MALLORY, 'recognises', 'com1'));
    });
    await assertFails(deleteDoc(doc(db(MALLORY), 'links', `${MALLORY}__recognises__com1`)));
    await assertSucceeds(deleteDoc(doc(db(BOB), 'links', `${MALLORY}__recognises__com1`)));
  });
});

describe('collabs — staff-curated, world-readable', () => {
  it('anyone reads, only staff write', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'collabs', 'c1'), { name: 'Anthropic', agreement: 'contract' }));
    await assertSucceeds(getDoc(doc(db(), 'collabs', 'c1')));
    await assertFails(setDoc(doc(db(MALLORY), 'collabs', 'c2'), { name: 'EvilCorp', agreement: 'founder' }));
    await assertSucceeds(setDoc(doc(db(STAFF), 'collabs', 'c3'), { name: 'GoodOrg', agreement: 'founder' }));
    await assertFails(deleteDoc(doc(db(MALLORY), 'collabs', 'c1')));
  });
});

describe('the keeper\'s observation — a consecration witnessed, never claimed (ring 2026-08-24)', () => {
  const seedConsecration = () => env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'pulses', 'consecr1'), { authorId: BOB, type: 'observation', care: true, lightHouseId: 'lh1', communityId: 'com1', title: 'Consecration', visibility: 'public', loveCount: 0 });
    await setDoc(doc(d, 'persons', ALICE), { uid: ALICE, lid: 'alice-true-name', displayName: 'Alice' });
  });
  const slot = (w: string) => doc(db(w), 'pulses', 'consecr1', 'witnesses', w);

  it('a keeper who is NOT the consecrator takes their own slot, lid pinned to their person', async () => {
    await seedConsecration();
    await assertSucceeds(setDoc(slot(ALICE), { uid: ALICE, lid: 'alice-true-name', name: 'Alice', witnessedAt: serverTimestamp() }));
  });

  it('a borrowed lid, a foreign slot, and a smuggled field are each refused', async () => {
    await seedConsecration();
    await assertFails(setDoc(slot(ALICE), { uid: ALICE, lid: 'stolen-name', witnessedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db(ALICE), 'pulses', 'consecr1', 'witnesses', MALLORY), { uid: MALLORY, lid: 'alice-true-name', witnessedAt: serverTimestamp() }));
    await assertFails(setDoc(slot(ALICE), { uid: ALICE, lid: 'alice-true-name', witnessedAt: serverTimestamp(), keeper: true }));
  });

  it('the consecrator cannot observe their own ceremony; a non-keeper cannot observe at all', async () => {
    await seedConsecration();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'persons', BOB), { uid: BOB, lid: 'bob-true-name' });
      await setDoc(doc(ctx.firestore(), 'persons', MALLORY), { uid: MALLORY, lid: 'mallory-true-name' });
      // BOB becomes a keeper of com1 — and is still refused, because he consecrated.
      await setDoc(doc(ctx.firestore(), 'links', `${BOB}__keeper__com1`), { from: BOB, rel: 'keeper', to: 'com1' });
    });
    await assertFails(setDoc(slot(BOB), { uid: BOB, lid: 'bob-true-name', witnessedAt: serverTimestamp() }));
    await assertFails(setDoc(slot(MALLORY), { uid: MALLORY, lid: 'mallory-true-name', witnessedAt: serverTimestamp() }));
  });

  it('an observation is append-only — not even its own hand may take it back', async () => {
    await seedConsecration();
    await assertSucceeds(setDoc(slot(ALICE), { uid: ALICE, lid: 'alice-true-name', witnessedAt: serverTimestamp() }));
    await assertFails(deleteDoc(slot(ALICE)));
    await assertFails(setDoc(slot(ALICE), { uid: ALICE, lid: 'another-name', witnessedAt: serverTimestamp() }));
  });
});

describe('grows_in — a tree enters a garden through its door (ring 2026-08-24)', () => {
  const seedGarden = (door?: string) => env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'communities', 'garden1'), { ownerId: ALICE, name: 'Garden', domain: 'garden.online', loveCount: 0, ...(door ? { door } : {}) });
    await setDoc(doc(d, 'lifetrees', 'bobsTree'), { ownerId: BOB, name: 'Bobs Oak', loveCount: 0 });
  });
  const edge = { from: 'bobsTree', rel: 'grows_in', to: 'garden1' };

  it('an OPEN door: the tree\'s owner steps in self-serve; a stranger may not', async () => {
    await seedGarden('open');
    await assertFails(setDoc(doc(db(MALLORY), 'links', 'bobsTree__grows_in__garden1'), edge));
    await assertSucceeds(setDoc(doc(db(BOB), 'links', 'bobsTree__grows_in__garden1'), edge));
  });

  it('a closed or invite door refuses the owner — the KEEPER welcomes instead', async () => {
    await seedGarden(); // absent = invite
    await assertFails(setDoc(doc(db(BOB), 'links', 'bobsTree__grows_in__garden1'), edge));
    await assertSucceeds(setDoc(doc(db(ALICE), 'links', 'bobsTree__grows_in__garden1'), edge));
  });

  it('a tree CARER (co_owner/steward), not only the owner, may stand it in an open garden', async () => {
    await seedGarden('open');
    await env.withSecurityRulesDisabled(async (ctx) => {
      // MALLORY is a co_owner (carer) of bobsTree — a keeper, not the owner.
      await setDoc(doc(ctx.firestore(), 'links', `${MALLORY}__co_owner__bobsTree`), { from: MALLORY, rel: 'co_owner', to: 'bobsTree' });
    });
    await assertSucceeds(setDoc(doc(db(MALLORY), 'links', 'bobsTree__grows_in__garden1'), edge));
    await assertSucceeds(deleteDoc(doc(db(MALLORY), 'links', 'bobsTree__grows_in__garden1'))); // the carer withdraws
  });

  it('a ghost tree earns no edge, and either side may withdraw — a stranger may not', async () => {
    await seedGarden('open');
    await assertFails(setDoc(doc(db(ALICE), 'links', 'ghostTree__grows_in__garden1'), { from: 'ghostTree', rel: 'grows_in', to: 'garden1' }));
    await assertSucceeds(setDoc(doc(db(BOB), 'links', 'bobsTree__grows_in__garden1'), edge));
    await assertFails(deleteDoc(doc(db(MALLORY), 'links', 'bobsTree__grows_in__garden1')));
    await assertSucceeds(deleteDoc(doc(db(ALICE), 'links', 'bobsTree__grows_in__garden1'))); // the keeper curates
    await assertSucceeds(setDoc(doc(db(BOB), 'links', 'bobsTree__grows_in__garden1'), edge));
    await assertSucceeds(deleteDoc(doc(db(BOB), 'links', 'bobsTree__grows_in__garden1'))); // the owner withdraws
  });
});

describe('welcomed_by — the hand that welcomed is proven, never claimed (ring 2026-08-21)', () => {
  const seedInvite = () => env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'communityInvites', 'inv1'), { communityId: 'com1', createdBy: ALICE, createdAt: Timestamp.fromMillis(1) });
  });

  it('the newcomer marks the REAL inviter — and only the real one', async () => {
    await seedInvite();
    await assertSucceeds(setDoc(doc(db(MALLORY), 'links', `${MALLORY}__welcomed_by__${ALICE}`),
      { from: MALLORY, rel: 'welcomed_by', to: ALICE, inviteId: 'inv1' }));
    await assertFails(setDoc(doc(db(MALLORY), 'links', `${MALLORY}__welcomed_by__${BOB}`),
      { from: MALLORY, rel: 'welcomed_by', to: BOB, inviteId: 'inv1' }));
    await assertFails(setDoc(doc(db(MALLORY), 'links', `${MALLORY}__welcomed_by__${ALICE}`),
      { from: MALLORY, rel: 'welcomed_by', to: ALICE }));
    await assertFails(setDoc(doc(db(MALLORY), 'links', `${MALLORY}__welcomed_by__${ALICE}`),
      { from: MALLORY, rel: 'welcomed_by', to: ALICE, inviteId: 'ghost-invite' }));
  });

  it('no one welcomes themself, and no one marks another\'s arrival', async () => {
    await seedInvite();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'communityInvites', 'invSelf'), { communityId: 'com1', createdBy: MALLORY, createdAt: Timestamp.fromMillis(1) });
    });
    await assertFails(setDoc(doc(db(MALLORY), 'links', `${MALLORY}__welcomed_by__${MALLORY}`),
      { from: MALLORY, rel: 'welcomed_by', to: MALLORY, inviteId: 'invSelf' }));
    await assertFails(setDoc(doc(db(BOB), 'links', `${MALLORY}__welcomed_by__${ALICE}`),
      { from: MALLORY, rel: 'welcomed_by', to: ALICE, inviteId: 'inv1' }));
  });

  it('the mark is append-only: even its subject may not erase how they arrived', async () => {
    await seedInvite();
    await assertSucceeds(setDoc(doc(db(MALLORY), 'links', `${MALLORY}__welcomed_by__${ALICE}`),
      { from: MALLORY, rel: 'welcomed_by', to: ALICE, inviteId: 'inv1' }));
    await assertFails(deleteDoc(doc(db(MALLORY), 'links', `${MALLORY}__welcomed_by__${ALICE}`)));
    await assertSucceeds(deleteDoc(doc(db(STAFF), 'links', `${MALLORY}__welcomed_by__${ALICE}`)));
  });
});

describe('bornOn — the birthplace is frozen (ring 2026-08-21)', () => {
  it('a founding carries its portal; no later hand may move it', async () => {
    await assertSucceeds(setDoc(doc(db(MALLORY), 'communities', 'bornCom'),
      { ownerId: MALLORY, name: 'X', domain: 'x.online', bornOn: 'perauset.web.app', loveCount: 0 }));
    await assertFails(updateDoc(doc(db(MALLORY), 'communities', 'bornCom'), { bornOn: 'lightseed.online' }));
    await assertFails(updateDoc(doc(db(STAFF), 'communities', 'bornCom'), { bornOn: 'lightseed.online' }));
    await assertSucceeds(updateDoc(doc(db(MALLORY), 'communities', 'bornCom'), { vision: 'a clearing' }));
  });
});

describe('the births are bound — every being is born signed by its own hand (ring 2026-08-17)', () => {
  const LID7 = '019f6381-48fd-7fcc-9382-e99d923f38f4'; // known-valid UUIDv7
  const CAROL = 'carol-uid';

  it('a lifetree cannot be planted wearing another uid — staff plant for others', async () => {
    await assertFails(setDoc(doc(db(MALLORY), 'lifetrees', 'forgedTree'), { ownerId: BOB, name: 'Forged', loveCount: 0 }));
    await assertFails(setDoc(doc(db(MALLORY), 'lifetrees', 'unsignedTree'), { name: 'Unsigned', loveCount: 0 }));
    await assertSucceeds(setDoc(doc(db(MALLORY), 'lifetrees', 'ownTree'), { ownerId: MALLORY, name: 'Mine', loveCount: 0 }));
    await assertSucceeds(setDoc(doc(db(STAFF), 'lifetrees', 'plantedFor'), { ownerId: BOB, name: 'For Bob', loveCount: 0 }));
  });

  it('a pulse cannot be minted in another name — nor an unsigned one', async () => {
    await assertFails(setDoc(doc(db(MALLORY), 'pulses', 'forgedPulse'), { authorId: BOB, type: 'observation', title: 'x', body: '', visibility: 'public', loveCount: 0 }));
    await assertFails(setDoc(doc(db(MALLORY), 'pulses', 'unsignedPulse'), { type: 'observation', title: 'x', body: '', visibility: 'public', loveCount: 0 }));
    await assertSucceeds(setDoc(doc(db(MALLORY), 'pulses', 'ownPulse'), { authorId: MALLORY, type: 'observation', title: 'x', body: '', visibility: 'public', loveCount: 0 }));
    await assertSucceeds(setDoc(doc(db(STAFF), 'pulses', 'mendPulse'), { authorId: BOB, type: 'observation', title: 'mend', body: '', visibility: 'public', loveCount: 0 }));
  });

  it('a vision wears its own author', async () => {
    await assertFails(setDoc(doc(db(MALLORY), 'visions', 'forgedVision'), { authorId: BOB, title: 'x', visibility: 'public', loveCount: 0 }));
    await assertSucceeds(setDoc(doc(db(MALLORY), 'visions', 'ownVision'), { authorId: MALLORY, title: 'x', visibility: 'public', loveCount: 0 }));
  });

  it('a community is founded in the founder\'s own name — both identity fields', async () => {
    await assertFails(setDoc(doc(db(MALLORY), 'communities', 'forgedCom'), { ownerId: BOB, name: 'X', domain: 'x.online', loveCount: 0 }));
    await assertFails(setDoc(doc(db(MALLORY), 'communities', 'forgedFounder'), { ownerId: MALLORY, founderUserId: BOB, name: 'X', domain: 'x.online', loveCount: 0 }));
    await assertSucceeds(setDoc(doc(db(MALLORY), 'communities', 'ownCom'), { ownerId: MALLORY, name: 'X', domain: 'x.online', loveCount: 0 }));
  });

  it('a lightHouse is consecrated in the consecrator\'s own name', async () => {
    await assertFails(setDoc(doc(db(MALLORY), 'lightHouses', 'forgedLh'), { ownerId: BOB, name: 'X', visibility: 'public', loveCount: 0 }));
    await assertSucceeds(setDoc(doc(db(MALLORY), 'lightHouses', 'ownLh'), { ownerId: MALLORY, name: 'X', visibility: 'public', loveCount: 0 }));
  });

  it('an alignment is proposed in the proposer\'s own name', async () => {
    await assertFails(setDoc(doc(db(MALLORY), 'alignments', 'forgedAl'), { initiatorUid: BOB, targetUid: ALICE, status: 'PENDING', messages: [] }));
    await assertSucceeds(setDoc(doc(db(MALLORY), 'alignments', 'ownAl'), { initiatorUid: MALLORY, targetUid: BOB, status: 'PENDING', messages: [] }));
  });

  it('an intelligence: own name, or a real keeper wiring the community\'s — never arbitrary', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'links', `${BOB}__steward__com1`), { from: BOB, rel: 'steward', to: 'com1' });
    });
    await assertFails(setDoc(doc(db(MALLORY), 'intelligences', 'forgedInt'), { ownerId: BOB, name: 'X', enabled: true }));
    await assertSucceeds(setDoc(doc(db(MALLORY), 'intelligences', 'ownInt'), { ownerId: MALLORY, name: 'X', enabled: true }));
    // BOB is com1's steward: he may wire the community intelligence in the OWNER's name…
    await assertSucceeds(setDoc(doc(db(BOB), 'intelligences', 'comInt'), { ownerId: ALICE, name: 'X', enabled: true, credentialScope: 'community', credentialOwnerId: 'com1' }));
    // …but a non-keeper may not, and even a keeper may not pick an arbitrary owner.
    await assertFails(setDoc(doc(db(MALLORY), 'intelligences', 'comIntForged'), { ownerId: ALICE, name: 'X', enabled: true, credentialScope: 'community', credentialOwnerId: 'com1' }));
    await assertFails(setDoc(doc(db(BOB), 'intelligences', 'comIntWrongOwner'), { ownerId: MALLORY, name: 'X', enabled: true, credentialScope: 'community', credentialOwnerId: 'com1' }));
  });

  it('a memory is born signed; a community memory needs that community\'s keeper', async () => {
    await assertFails(setDoc(doc(db(MALLORY), 'memories', 'unsignedMem'), { name: 'x', text: 'x', visibility: 'private' }));
    await assertFails(setDoc(doc(db(MALLORY), 'memories', 'forgedMem'), { ownerId: BOB, name: 'x', text: 'x', visibility: 'private' }));
    await assertSucceeds(setDoc(doc(db(MALLORY), 'memories', 'ownMem'), { ownerId: MALLORY, name: 'x', text: 'x', visibility: 'private' }));
    await assertFails(setDoc(doc(db(MALLORY), 'memories', 'comMemForged'), { ownerId: MALLORY, communityId: 'com1', name: 'x', text: 'x', visibility: 'community' }));
    await assertSucceeds(setDoc(doc(db(ALICE), 'memories', 'comMem'), { ownerId: ALICE, communityId: 'com1', name: 'x', text: 'x', visibility: 'community' }));
  });

  it('a hold\'s payload cannot dress it in another being\'s name', async () => {
    const soon = Date.now() + 100000;
    await assertSucceeds(setDoc(doc(db(MALLORY), 'lifetrees', 'treeB', 'holds', MALLORY), { holderUid: MALLORY, expiresAt: soon }));
    await assertFails(setDoc(doc(db(MALLORY), 'lifetrees', 'treeB', 'holds', MALLORY), { holderUid: BOB, expiresAt: soon }));
  });

  it('the hinge: a person\'s body uid may never disagree with its path', async () => {
    await assertFails(setDoc(doc(db(CAROL), 'persons', CAROL), { uid: BOB, lid: LID7, displayName: 'Carol' }));
    await assertSucceeds(setDoc(doc(db(CAROL), 'persons', CAROL), { uid: CAROL, lid: LID7, displayName: 'Carol' }));
    await assertFails(updateDoc(doc(db(ALICE), 'persons', ALICE), { uid: BOB }));
    await assertSucceeds(updateDoc(doc(db(ALICE), 'persons', ALICE), { uid: ALICE, displayName: 'Alice' }));
  });

  it('the hinge: a newborn or backfilled lid must be a real UUIDv7', async () => {
    await assertFails(setDoc(doc(db(CAROL), 'persons', CAROL), { uid: CAROL, lid: 'not-a-lid', displayName: 'Carol' }));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'persons', 'dora-uid'), { uid: 'dora-uid', displayName: 'Dora' });
    });
    await assertFails(updateDoc(doc(db('dora-uid'), 'persons', 'dora-uid'), { lid: 'junk' }));
    await assertSucceeds(updateDoc(doc(db('dora-uid'), 'persons', 'dora-uid'), { lid: LID7 }));
  });
});

describe('the lid is frozen — the true name is load-bearing (QR links stand on it)', () => {
  it('a tree owner may edit their tree but never its lid', async () => {
    await assertSucceeds(updateDoc(doc(db(BOB), 'lifetrees', 'treeB'), { name: 'Renamed' }));
    await assertFails(updateDoc(doc(db(BOB), 'lifetrees', 'treeB'), { lid: 'forged-lid' }));
  });
  it('a lightHouse keeper and a community keeper hit the same wall', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'lightHouses', 'sanc1'), { ownerId: ALICE, name: 'S', lid: 'true-name' });
    });
    await assertSucceeds(updateDoc(doc(db(ALICE), 'lightHouses', 'sanc1'), { name: 'S2' }));
    await assertFails(updateDoc(doc(db(ALICE), 'lightHouses', 'sanc1'), { lid: 'forged' }));
    await assertSucceeds(updateDoc(doc(db(ALICE), 'communities', 'com1'), { name: 'Com2' }));
    await assertFails(updateDoc(doc(db(ALICE), 'communities', 'com1'), { lid: 'forged' }));
  });
});

describe('the pulse LIST leak — provenance from the query, never per-doc (ring 2026-08-25)', () => {
  const seedFeed = () => env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'pulses', 'evPub'), { type: 'event', visibility: 'public', title: 'Pub', authorId: MALLORY, domain: 'x', lifetreeId: 'oak', communityId: 'com1', threadId: 't1', participantUids: [ALICE] });
    await setDoc(doc(d, 'pulses', 'evNode'), { type: 'event', visibility: 'node', title: 'NodeEv', authorId: MALLORY, domain: 'x', lifetreeId: 'oak', communityId: 'com1' });
    await setDoc(doc(d, 'pulses', 'evPriv'), { type: 'event', visibility: 'private', title: 'PRIVATE', authorId: MALLORY, domain: 'x', lifetreeId: 'oak', communityId: 'com1' });
    await setDoc(doc(d, 'pulses', 'gGrowth'), { type: 'tree_growth', visibility: 'public', lifetreeId: 'oak', authorId: MALLORY });
  });
  beforeEach(seedFeed);

  // THE LEAK, REFUSED — the exact query the other side reported.
  it('anon: type==event with NO visibility filter is refused (was: returned private)', async () => {
    await assertFails(getDocs(query(collection(db(), 'pulses'), where('type', '==', 'event'))));
  });
  it('anon: any unconstrained scan or visibility-only-node query is refused', async () => {
    await assertFails(getDocs(query(collection(db(), 'pulses'))));
    await assertFails(getDocs(query(collection(db(), 'pulses'), where('visibility', 'in', ['public', 'node']))));
    await assertFails(getDocs(query(collection(db(), 'pulses'), where('lifetreeId', '==', 'oak')))); // unpinned timeline
  });

  // THE LEGITIMATE SHAPES — each still green.
  it('anon: the public floor is provable', async () => {
    await assertSucceeds(getDocs(query(collection(db(), 'pulses'), where('type', '==', 'event'), where('visibility', '==', 'public'))));
    await assertSucceeds(getDocs(query(collection(db(), 'pulses'), where('domain', '==', 'x'), where('visibility', 'in', ['public']))));
    await assertSucceeds(getDocs(query(collection(db(), 'pulses'), where('lifetreeId', '==', 'oak'), where('type', 'in', ['tree_growth', 'GROWTH']), where('visibility', '==', 'public'))));
    await assertSucceeds(getDocs(query(collection(db(), 'pulses'), where('lifetreeId', '==', 'oak'), where('visibility', 'in', ['public']))));
  });
  it('signed-in: public+node feeds, own pulses, the inbox, and a threaded fetch', async () => {
    await assertSucceeds(getDocs(query(collection(db(ALICE), 'pulses'), where('visibility', 'in', ['public', 'node']))));
    await assertSucceeds(getDocs(query(collection(db(ALICE), 'pulses'), where('authorId', '==', ALICE))));
    await assertSucceeds(getDocs(query(collection(db(ALICE), 'pulses'), where('participantUids', 'array-contains', ALICE))));
    await assertSucceeds(getDocs(query(collection(db(ALICE), 'pulses'), where('threadId', '==', 't1'), where('participantUids', 'array-contains', ALICE))));
    await assertSucceeds(getDocs(query(collection(db(ALICE), 'pulses'), where('recipientUid', '==', ALICE), where('lifetreeId', '==', 'oak'))));
  });
  it('a community MEMBER may list community-visibility pulses pinned to their community; a stranger may not', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = ctx.firestore();
      await setDoc(doc(d, 'pulses', 'decCom'), { type: 'decision', visibility: 'community', communityId: 'com1', title: 'Decision', authorId: MALLORY });
      await setDoc(doc(d, 'links', `${ALICE}__member__com1`), { from: ALICE, rel: 'member', to: 'com1' });
    });
    await assertSucceeds(getDocs(query(collection(db(ALICE), 'pulses'), where('communityId', '==', 'com1'), where('visibility', 'in', ['public', 'node', 'community']))));
    await assertFails(getDocs(query(collection(db(BOB), 'pulses'), where('communityId', '==', 'com1'), where('visibility', 'in', ['public', 'node', 'community']))));
  });
  it('a single private event is still gettable by no one but its own hand (the get path holds)', async () => {
    await assertFails(getDoc(doc(db(), 'pulses', 'evPriv')));
    await assertFails(getDoc(doc(db(ALICE), 'pulses', 'evPriv')));
    await assertSucceeds(getDoc(doc(db(MALLORY), 'pulses', 'evPriv'))); // the author
    await assertSucceeds(getDoc(doc(db(), 'pulses', 'evPub')));         // public, anyone
  });
});

describe('pulse overlays — a pulse you cannot see is a pulse you cannot touch', () => {
  // The seam the arrays audit found (ring 2026-08-09): overlay (a) had no read gate and no
  // whose-uid constraint, so any signed-in account could forge or erase read receipts and
  // rewrite the H2H reading on any pulse whose id it knew. seenBy now moves only by
  // append-exactly-your-own-uid — the vetoes arithmetic — behind canReadPulse.
  const DM = 'dm-overlay';
  const seedDm = (seenBy: string[] = []) => env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'pulses', DM), {
      authorId: ALICE, type: 'reach', title: 'hello', body: 'hello',
      participantUids: [ALICE, BOB], seenBy,
    });
  });

  it('a reader marks a pulse seen — their own uid, appended, nothing else moved', async () => {
    await assertSucceeds(updateDoc(doc(db(MALLORY), 'pulses', 'pulseLove'), { seenBy: [MALLORY] }));
  });

  it('a receipt cannot be forged in another being\'s name', async () => {
    await assertFails(updateDoc(doc(db(MALLORY), 'pulses', 'pulseLove'), { seenBy: [BOB] }));
    await assertFails(updateDoc(doc(db(MALLORY), 'pulses', 'pulseLove'), { seenBy: [MALLORY, BOB] }));
  });

  it('nor erased — what was seen stays seen', async () => {
    await env.withSecurityRulesDisabled(async (ctx) =>
      updateDoc(doc(ctx.firestore(), 'pulses', 'pulseLove'), { seenBy: [BOB] }));
    await assertFails(updateDoc(doc(db(MALLORY), 'pulses', 'pulseLove'), { seenBy: [] }));
    await assertFails(updateDoc(doc(db(MALLORY), 'pulses', 'pulseLove'), { seenBy: [MALLORY] })); // drops BOB
    await assertSucceeds(updateDoc(doc(db(MALLORY), 'pulses', 'pulseLove'), { seenBy: [BOB, MALLORY] }));
  });

  it('an outsider cannot touch a private reach at all — receipt or reading', async () => {
    await seedDm();
    await assertFails(updateDoc(doc(db(MALLORY), 'pulses', DM), { seenBy: [MALLORY] }));
    await assertFails(updateDoc(doc(db(MALLORY), 'pulses', DM), { aiInterpretation: { happened: 'forged' } }));
  });

  it('a participant marks the reach seen; a reader refreshes the reading', async () => {
    await seedDm();
    await assertSucceeds(updateDoc(doc(db(BOB), 'pulses', DM), { seenBy: [BOB] }));
    // The H2H reading is a shared surface any READER may refresh — design, not leak.
    await assertSucceeds(updateDoc(doc(db(MALLORY), 'pulses', 'pulseLove'), { aiInterpretation: { happened: 'a reading' } }));
  });
});

describe('retraction — the author withdraws the words; the chain keeps the block', () => {
  // Ring 2026-08-10: a tree-sent reach is a block on the sender's chain, so it can never be
  // deleted — the author may only MARK it retracted, and only their own, and nothing may ride
  // along (content is frozen; on locked chains it is hashed).
  const DM='dm-retract';
  const seed = () => env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'pulses', DM), {
      authorId: ALICE, type: 'reach', title: 'r', body: 'oops', content: 'oops',
      participantUids: [ALICE, BOB], seenBy: [],
    });
  });

  it('the author retracts their own message', async () => {
    await seed();
    await assertSucceeds(updateDoc(doc(db(ALICE), 'pulses', DM), { retractedAt: 1, updatedAt: 1 }));
  });

  it('the other participant cannot retract it, nor an outsider', async () => {
    await seed();
    await assertFails(updateDoc(doc(db(BOB), 'pulses', DM), { retractedAt: 1, updatedAt: 1 }));
    await assertFails(updateDoc(doc(db(MALLORY), 'pulses', DM), { retractedAt: 1, updatedAt: 1 }));
  });

  it('the words can never ride along — retraction marks, it does not rewrite', async () => {
    await seed();
    await assertFails(updateDoc(doc(db(ALICE), 'pulses', DM), { retractedAt: 1, content: 'rewritten', updatedAt: 1 }));
    await assertFails(deleteDoc(doc(db(ALICE), 'pulses', DM))); // a block is never deleted
  });
});

describe('the unmint — only the head block, only its author, only with the rollback riding along', () => {
  // Ring 2026-08-15: an accidental LAST mint may be taken back; the chain shortens by its
  // newest link, never severed. Mid-chain author-deletes of tree mints are now refused
  // outright (the first-sight review's finding 2, closed for the tree chain).
  const TREE = 'tree-unmint';
  const seedChain = () => env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'lifetrees', TREE), { ownerId: ALICE, name: 'Chain Oak', genesisHash: 'g0', latestHash: 'h2', blockHeight: 2, validated: false, validatorId: null, loveCount: 0 });
    await setDoc(doc(d, 'pulses', 'b1'), { authorId: ALICE, type: 'tree_growth', lifetreeId: TREE, hash: 'h1', previousHash: 'g0', title: 'g1' });
    await setDoc(doc(d, 'pulses', 'b2'), { authorId: ALICE, type: 'tree_growth', lifetreeId: TREE, hash: 'h2', previousHash: 'h1', title: 'g2' });
  });

  it('the author unmints the HEAD when the rollback rides in the same batch', async () => {
    await seedChain();
    const store = db(ALICE);
    const b = writeBatch(store);
    b.delete(doc(store, 'pulses', 'b2'));
    b.update(doc(store, 'lifetrees', TREE), { latestHash: 'h1', blockHeight: 1, updatedAt: 1 });
    await assertSucceeds(b.commit());
  });

  it('without the rollback, the delete alone is refused', async () => {
    await seedChain();
    await assertFails(deleteDoc(doc(db(ALICE), 'pulses', 'b2')));
  });

  it('a mid-chain mint can never be deleted — not even by its author with a rollback', async () => {
    await seedChain();
    await assertFails(deleteDoc(doc(db(ALICE), 'pulses', 'b1')));
    const store = db(ALICE);
    const b = writeBatch(store);
    b.delete(doc(store, 'pulses', 'b1'));
    b.update(doc(store, 'lifetrees', TREE), { latestHash: 'g0', blockHeight: 1, updatedAt: 1 });
    await assertFails(b.commit());
  });

  it("an accepted offering's twin block stands — it is co-held, and no rollback unsays it", async () => {
    await seedChain();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'pulses', 't3'), { authorId: ALICE, type: 'standard', lifetreeId: TREE, offeringId: 'off1', offeringRole: 'from', hash: 'h3', previousHash: 'h2', title: 'Offering accepted' });
      await updateDoc(doc(ctx.firestore(), 'lifetrees', TREE), { latestHash: 'h3', blockHeight: 3 });
    });
    const store = db(ALICE);
    const b = writeBatch(store);
    b.delete(doc(store, 'pulses', 't3'));
    b.update(doc(store, 'lifetrees', TREE), { latestHash: 'h2', blockHeight: 2, updatedAt: 1 });
    await assertFails(b.commit());
  });

  it('another hand cannot unmint, rollback or not', async () => {
    await seedChain();
    const store = db(MALLORY);
    const b = writeBatch(store);
    b.delete(doc(store, 'pulses', 'b2'));
    b.update(doc(store, 'lifetrees', TREE), { latestHash: 'h1', blockHeight: 1, updatedAt: 1 });
    await assertFails(b.commit());
  });

  it('a HEAD tree-sent reach may be unsaid whole — below the head, reaches stay sealed', async () => {
    await seedChain();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'pulses', 'r3'), { authorId: ALICE, type: 'reach', lifetreeId: TREE, participantUids: [ALICE, BOB], hash: 'h3', previousHash: 'h2', title: 'oops' });
      await updateDoc(doc(ctx.firestore(), 'lifetrees', TREE), { latestHash: 'h3', blockHeight: 3 });
    });
    const store = db(ALICE);
    const b = writeBatch(store);
    b.delete(doc(store, 'pulses', 'r3'));
    b.update(doc(store, 'lifetrees', TREE), { latestHash: 'h2', blockHeight: 2, updatedAt: 1 });
    await assertSucceeds(b.commit());
    // b2 is the head again — but b1, now mid-chain, stays sealed.
    await assertFails(deleteDoc(doc(db(ALICE), 'pulses', 'b1')));
  });

  it('nothing co-held can be unsaid: a seen or loved head block stands', async () => {
    await seedChain();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'pulses', 'b2'), { seenBy: [BOB] });
    });
    const store = db(ALICE);
    const b = writeBatch(store);
    b.delete(doc(store, 'pulses', 'b2'));
    b.update(doc(store, 'lifetrees', TREE), { latestHash: 'h1', blockHeight: 1, updatedAt: 1 });
    await assertFails(b.commit());

    // Loved instead of seen — same refusal.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'pulses', 'b2'), { seenBy: [ALICE], loveCount: 1 });
    });
    const b2 = writeBatch(store);
    b2.delete(doc(store, 'pulses', 'b2'));
    b2.update(doc(store, 'lifetrees', TREE), { latestHash: 'h1', blockHeight: 1, updatedAt: 1 });
    await assertFails(b2.commit());

    // The author's own receipt alone does not co-hold.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'pulses', 'b2'), { seenBy: [ALICE], loveCount: 0 });
    });
    const b3 = writeBatch(store);
    b3.delete(doc(store, 'pulses', 'b3'.replace('b3', 'b2')));
    b3.update(doc(store, 'lifetrees', TREE), { latestHash: 'h1', blockHeight: 1, updatedAt: 1 });
    await assertSucceeds(b3.commit());
  });

  it('a guardian-witnessed watering stands forever', async () => {
    await seedChain();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'pulses', 'b3'), { authorId: ALICE, type: 'tree_growth', care: 'watering', wateringConfirmedBy: 'guardian', lifetreeId: TREE, hash: 'h3', previousHash: 'h2', title: 'w' });
      await updateDoc(doc(ctx.firestore(), 'lifetrees', TREE), { latestHash: 'h3', blockHeight: 3 });
    });
    const store = db(ALICE);
    const b = writeBatch(store);
    b.delete(doc(store, 'pulses', 'b3'));
    b.update(doc(store, 'lifetrees', TREE), { latestHash: 'h2', blockHeight: 2, updatedAt: 1 });
    await assertFails(b.commit());
  });
});

describe('the place-of-record mend — only the node\'s stewards move a being between places', () => {
  // Ring 2026-08-11 (clause i3): every event is stamped at birth with the domain it was made
  // on, and the stamp decides which node's surfaces show it. Staff mend a wrong stamp with
  // exactly {domain, updatedAt, rehomedAt}; no author or community-owner overlay carries
  // `domain`, so the hand that made a being cannot move it between places. (While the general
  // staff escape (j) stands, "staff touch ONLY these keys" is not yet provable — retiring (j)
  // into enumerated staff key-sets is the named shelf item this clause begins.)
  const EV = 'ev-rehome';
  const seedEvent = () => env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'pulses', EV), {
      authorId: BOB, type: 'event', title: 'Founding', body: 'the seed event',
      communityId: 'com1', domain: 'localhost', visibility: 'public',
    });
  });

  it('staff mend the stamp — domain, updatedAt and the rehomedAt mark, nothing else', async () => {
    await seedEvent();
    await assertSucceeds(updateDoc(doc(db(STAFF), 'pulses', EV), { domain: 'perauset.web.app', updatedAt: 1, rehomedAt: 1 }));
  });

  it('the author cannot move their own event between places', async () => {
    await seedEvent();
    await assertFails(updateDoc(doc(db(BOB), 'pulses', EV), { domain: 'perauset.web.app', updatedAt: 1 }));
  });

  it('nor the community owner, nor an outsider', async () => {
    await seedEvent();
    await assertFails(updateDoc(doc(db(ALICE), 'pulses', EV), { domain: 'perauset.web.app', updatedAt: 1 }));
    await assertFails(updateDoc(doc(db(MALLORY), 'pulses', EV), { domain: 'perauset.web.app', updatedAt: 1 }));
  });

  it('the domain can never ride along on a content edit — the author edit stays content-only', async () => {
    await seedEvent();
    await assertSucceeds(updateDoc(doc(db(BOB), 'pulses', EV), { title: 'Founding Day', updatedAt: 1 }));
    await assertFails(updateDoc(doc(db(BOB), 'pulses', EV), { title: 'Founding Day', domain: 'perauset.web.app', updatedAt: 1 }));
  });
});

describe('guardian veto — window and tenure live in the rules, not only the client', () => {
  const mintPulse = async (createdAtMs: number, guardianSinceMs?: number) => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = ctx.firestore();
      await setDoc(doc(d, 'pulses', 'mint1'), {
        type: 'tree_growth', lifetreeId: 'treeB', authorId: BOB,
        title: 'g', body: 'g', createdAt: Timestamp.fromMillis(createdAtMs), vetoes: [],
      });
      if (guardianSinceMs !== undefined) {
        await setDoc(doc(d, 'links', `${ALICE}__guardian__treeB`), {
          rel: 'guardian', from: ALICE, to: 'treeB', type: 'link',
          createdAt: Timestamp.fromMillis(guardianSinceMs),
        });
      }
    });
  };

  it('a tenured guardian vetoes a fresh mint', async () => {
    const now = Date.now();
    await mintPulse(now - 1000, now - 100000); // guardian stood before the mint
    await assertSucceeds(updateDoc(doc(db(ALICE), 'pulses', 'mint1'), { vetoes: [ALICE] }));
  });
  it('a guardian minted AFTER the pulse has no voice (the sock-account door)', async () => {
    const now = Date.now();
    await mintPulse(now - 100000, now - 1000); // guardian arrived after the mint
    await assertFails(updateDoc(doc(db(ALICE), 'pulses', 'mint1'), { vetoes: [ALICE] }));
  });
  it('after 72 hours the mint is settled history', async () => {
    const now = Date.now();
    await mintPulse(now - 73 * 60 * 60 * 1000, now - 80 * 60 * 60 * 1000); // old mint, older guardian
    await assertFails(updateDoc(doc(db(ALICE), 'pulses', 'mint1'), { vetoes: [ALICE] }));
  });
  it('a non-guardian cannot veto at all', async () => {
    const now = Date.now();
    await mintPulse(now - 1000); // no guardian link
    await assertFails(updateDoc(doc(db(MALLORY), 'pulses', 'mint1'), { vetoes: [MALLORY] }));
  });
});

describe('the keeper circle — peers by link, minted only by the server, never keeperless', () => {
  // Ring 2026-08-12 (domain/keeperCircle): `keeper` links make FULL PEERS of the founding
  // ownerId — but no client may mint one (only the callables do, after the living-tree
  // proof), the anchor (ownerId) is frozen against client hands, and a peer cannot remove
  // a peer. Knocks (`keeper_request`) are self-serve and grant nothing.
  const keeperLink = (uid: string) => ({
    lid: 'x', type: 'link', rel: 'keeper', from: uid, to: 'com1',
  });

  it('no client mints a keeper link — not even for themselves, not even the owner', async () => {
    await assertFails(setDoc(doc(db(MALLORY), 'links', `${MALLORY}__keeper__com1`), keeperLink(MALLORY)));
    await assertFails(setDoc(doc(db(ALICE), 'links', `${BOB}__keeper__com1`), keeperLink(BOB)));
  });

  it('a keeper link holder is a full peer: edits the community, appoints stewards', async () => {
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'links', `${BOB}__keeper__com1`), keeperLink(BOB)));
    await assertSucceeds(updateDoc(doc(db(BOB), 'communities', 'com1'), { vision: 'shared', updatedAt: 1 }));
    await assertSucceeds(setDoc(doc(db(BOB), 'links', `${MALLORY}__steward__com1`),
      { lid: 'x', type: 'link', rel: 'steward', from: MALLORY, to: 'com1' }));
  });

  it('the anchor is frozen against every client hand — even the owner, even a peer', async () => {
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'links', `${BOB}__keeper__com1`), keeperLink(BOB)));
    await assertFails(updateDoc(doc(db(ALICE), 'communities', 'com1'), { ownerId: BOB, updatedAt: 1 }));
    await assertFails(updateDoc(doc(db(BOB), 'communities', 'com1'), { ownerId: BOB, updatedAt: 1 }));
  });

  it('a peer cannot remove a peer — a keeper leaves only by their own hand', async () => {
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'links', `${BOB}__keeper__com1`), keeperLink(BOB)));
    await assertFails(deleteDoc(doc(db(ALICE), 'links', `${BOB}__keeper__com1`)));
    await assertSucceeds(deleteDoc(doc(db(BOB), 'links', `${BOB}__keeper__com1`)));
  });

  it('a keepership knock is self-serve at a community or a tree — and only at something real', async () => {
    await assertSucceeds(setDoc(doc(db(MALLORY), 'links', `${MALLORY}__keeper_request__com1`),
      { lid: 'x', type: 'link', rel: 'keeper_request', from: MALLORY, to: 'com1' }));
    await assertSucceeds(setDoc(doc(db(MALLORY), 'links', `${MALLORY}__keeper_request__treeB`),
      { lid: 'x', type: 'link', rel: 'keeper_request', from: MALLORY, to: 'treeB' }));
    await assertFails(setDoc(doc(db(MALLORY), 'links', `${MALLORY}__keeper_request__ghost`),
      { lid: 'x', type: 'link', rel: 'keeper_request', from: MALLORY, to: 'ghost' }));
    await assertFails(setDoc(doc(db(MALLORY), 'links', `${BOB}__keeper_request__com1`),
      { lid: 'x', type: 'link', rel: 'keeper_request', from: BOB, to: 'com1' }));
  });

  it('the knock is declined by the community keeper or the tree owner, never a stranger', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'links', `${MALLORY}__keeper_request__com1`),
        { lid: 'x', type: 'link', rel: 'keeper_request', from: MALLORY, to: 'com1' });
      await setDoc(doc(ctx.firestore(), 'links', `${MALLORY}__keeper_request__treeB`),
        { lid: 'x', type: 'link', rel: 'keeper_request', from: MALLORY, to: 'treeB' });
    });
    await assertFails(deleteDoc(doc(db(BOB), 'links', `${MALLORY}__keeper_request__com1`)));   // BOB keeps no door at com1
    await assertSucceeds(deleteDoc(doc(db(ALICE), 'links', `${MALLORY}__keeper_request__com1`))); // ALICE owns com1
    await assertSucceeds(deleteDoc(doc(db(BOB), 'links', `${MALLORY}__keeper_request__treeB`)));  // BOB owns treeB
  });

  it('a keeper offer is minted only by a sitting keeper, and its identity is frozen', async () => {
    await assertFails(setDoc(doc(db(MALLORY), 'communityKeeperInvites', 'ki-forged'),
      { communityId: 'com1', invitedUserId: MALLORY, invitedByUserId: MALLORY, status: 'pending' }));
    await assertSucceeds(setDoc(doc(db(ALICE), 'communityKeeperInvites', 'ki-real'),
      { communityId: 'com1', invitedUserId: BOB, invitedByUserId: ALICE, status: 'pending' }));
    await assertSucceeds(updateDoc(doc(db(BOB), 'communityKeeperInvites', 'ki-real'), { status: 'declined' }));
    await assertFails(updateDoc(doc(db(BOB), 'communityKeeperInvites', 'ki-real'), { invitedUserId: MALLORY }));
  });
});

describe('the door — open lets beings in, closed closes ALL ways, keepers are delegated', () => {
  const SAM = 'sam-uid'; // steward of com1 — the delegated door-keeper
  const link = (from: string, rel: string, to: string, extra: object = {}) =>
    ({ lid: 'x', type: 'link', rel, from, to, ...extra, createdAt: 1 });

  // Door fixtures beside the seeded com1 (door absent = 'invite').
  const seedDoors = () => env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'communities', 'open1'), { ownerId: ALICE, name: 'Open', domain: 'o', door: 'open' });
    await setDoc(doc(d, 'communities', 'closed1'), { ownerId: ALICE, name: 'Closed', domain: 'c', door: 'closed' });
    await setDoc(doc(d, 'links', `${SAM}__steward__com1`), link(SAM, 'steward', 'com1'));
  });

  it('open door: a signed-in being steps in themself; invite and closed doors refuse self-admission', async () => {
    await seedDoors();
    await assertSucceeds(setDoc(doc(db(BOB), 'links', `${BOB}__member__open1`), link(BOB, 'member', 'open1')));
    await assertFails(setDoc(doc(db(BOB), 'links', `${BOB}__member__com1`), link(BOB, 'member', 'com1')));
    await assertFails(setDoc(doc(db(BOB), 'links', `${BOB}__member__closed1`), link(BOB, 'member', 'closed1')));
  });

  it('closed door: even the knock is refused; the invite door still hears it', async () => {
    await seedDoors();
    await assertFails(setDoc(doc(db(BOB), 'links', `${BOB}__join_request__closed1`), link(BOB, 'join_request', 'closed1')));
    await assertSucceeds(setDoc(doc(db(BOB), 'links', `${BOB}__join_request__com1`), link(BOB, 'join_request', 'com1')));
  });

  it('a steward accepts a knock and cares the roster; a mere member cannot', async () => {
    await seedDoors();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = ctx.firestore();
      await setDoc(doc(d, 'links', `${BOB}__join_request__com1`), link(BOB, 'join_request', 'com1'));
      await setDoc(doc(d, 'links', `${MALLORY}__member__com1`), link(MALLORY, 'member', 'com1'));
    });
    await assertSucceeds(setDoc(doc(db(SAM), 'links', `${BOB}__member__com1`), link(BOB, 'member', 'com1')));
    await assertSucceeds(deleteDoc(doc(db(SAM), 'links', `${BOB}__join_request__com1`)));
    await assertSucceeds(deleteDoc(doc(db(SAM), 'links', `${MALLORY}__member__com1`)));
    await assertFails(setDoc(doc(db(MALLORY), 'links', `${BOB}__member__com1`), link(BOB, 'member', 'com1')));
  });

  it('only the owner appoints stewards; a steward may step down; the owner may remove them', async () => {
    await seedDoors();
    await assertSucceeds(setDoc(doc(db(ALICE), 'links', `${BOB}__steward__com1`), link(BOB, 'steward', 'com1')));
    await assertFails(setDoc(doc(db(BOB), 'links', `${MALLORY}__steward__com1`), link(MALLORY, 'steward', 'com1')));
    await assertSucceeds(deleteDoc(doc(db(SAM), 'links', `${SAM}__steward__com1`)));   // steps down
    await assertSucceeds(deleteDoc(doc(db(ALICE), 'links', `${BOB}__steward__com1`))); // owner removes
  });
});

describe('community invitations — the shareable key: live opens, revoked/expired/foreign do not', () => {
  const SAM = 'sam-uid';
  const link = (from: string, rel: string, to: string, extra: object = {}) =>
    ({ lid: 'x', type: 'link', rel, from, to, ...extra, createdAt: 1 });

  const seedInvites = () => env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'communities', 'closed1'), { ownerId: ALICE, name: 'Closed', domain: 'c', door: 'closed' });
    await setDoc(doc(d, 'links', `${SAM}__steward__com1`), link(SAM, 'steward', 'com1'));
    await setDoc(doc(d, 'communityInvites', 'inv-live-0001'), { communityId: 'com1', createdBy: ALICE, createdAt: 1 });
    await setDoc(doc(d, 'communityInvites', 'inv-revoked-1'), { communityId: 'com1', createdBy: ALICE, createdAt: 1, revokedAt: Timestamp.fromMillis(1000) });
    await setDoc(doc(d, 'communityInvites', 'inv-expired-1'), { communityId: 'com1', createdBy: ALICE, createdAt: 1, expiresAt: Timestamp.fromMillis(1000) });
    await setDoc(doc(d, 'communityInvites', 'inv-future-01'), { communityId: 'com1', createdBy: ALICE, createdAt: 1, expiresAt: Timestamp.fromMillis(Date.now() + 86400000) });
    await setDoc(doc(d, 'communityInvites', 'inv-closed-01'), { communityId: 'closed1', createdBy: ALICE, createdAt: 1 });
  });

  it('a live invitation admits its holder — as a member of ITS community, with the edge carrying provenance', async () => {
    await seedInvites();
    await assertSucceeds(setDoc(doc(db(BOB), 'links', `${BOB}__member__com1`),
      link(BOB, 'member', 'com1', { inviteId: 'inv-live-0001' })));
  });

  it('an unexpired deadline admits; revoked and expired do not; a foreign invite opens nothing else', async () => {
    await seedInvites();
    await assertSucceeds(setDoc(doc(db(BOB), 'links', `${BOB}__member__com1`),
      link(BOB, 'member', 'com1', { inviteId: 'inv-future-01' })));
    await assertFails(setDoc(doc(db(MALLORY), 'links', `${MALLORY}__member__com1`),
      link(MALLORY, 'member', 'com1', { inviteId: 'inv-revoked-1' })));
    await assertFails(setDoc(doc(db(MALLORY), 'links', `${MALLORY}__member__com1`),
      link(MALLORY, 'member', 'com1', { inviteId: 'inv-expired-1' })));
    await assertFails(setDoc(doc(db(MALLORY), 'links', `${MALLORY}__member__closed1`),
      link(MALLORY, 'member', 'closed1', { inviteId: 'inv-live-0001' }))); // com1's key, closed1's door
  });

  it('a closed door refuses even its own valid invitation', async () => {
    await seedInvites();
    await assertFails(setDoc(doc(db(BOB), 'links', `${BOB}__member__closed1`),
      link(BOB, 'member', 'closed1', { inviteId: 'inv-closed-01' })));
  });

  it('invited_by is truthful, per-community provenance: only with a real invitation for THAT community', async () => {
    await seedInvites();
    // from = newcomer, to = the community; the inviter is recoverable via the invite's createdBy.
    await assertSucceeds(setDoc(doc(db(BOB), 'links', `${BOB}__invited_by__com1`),
      link(BOB, 'invited_by', 'com1', { inviteId: 'inv-live-0001' })));
    await assertFails(setDoc(doc(db(BOB), 'links', `${BOB}__invited_by__closed1`),
      link(BOB, 'invited_by', 'closed1', { inviteId: 'inv-live-0001' }))); // com1's key, closed1 named
    await assertFails(setDoc(doc(db(BOB), 'links', `${BOB}__invited_by__com1`),
      link(BOB, 'invited_by', 'com1'))); // no invitation at all
    await assertFails(setDoc(doc(db(MALLORY), 'links', `${BOB}__invited_by__com1`),
      link(BOB, 'invited_by', 'com1', { inviteId: 'inv-live-0001' }))); // forged actor
  });

  it('the invited_by mark is append-only — not even its subject may erase how they arrived', async () => {
    await seedInvites();
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'links', `${BOB}__invited_by__com1`), link(BOB, 'invited_by', 'com1', { inviteId: 'inv-live-0001' })));
    await assertFails(deleteDoc(doc(db(BOB), 'links', `${BOB}__invited_by__com1`)));   // the subject cannot erase it
    await assertSucceeds(deleteDoc(doc(db(STAFF), 'links', `${BOB}__invited_by__com1`))); // staff remain the escape hatch
  });

  it('keepers mint and revoke; strangers hold the key but cannot cut new ones, and revocation is one-way', async () => {
    await seedInvites();
    await assertSucceeds(setDoc(doc(db(ALICE), 'communityInvites', 'inv-by-owner1'),
      { communityId: 'com1', createdBy: ALICE, createdAt: 1 }));
    await assertSucceeds(setDoc(doc(db(SAM), 'communityInvites', 'inv-by-stewrd'),
      { communityId: 'com1', createdBy: SAM, createdAt: 1 }));
    await assertFails(setDoc(doc(db(BOB), 'communityInvites', 'inv-by-nonkpr'),
      { communityId: 'com1', createdBy: BOB, createdAt: 1 })); // not a keeper
    await assertFails(setDoc(doc(db(ALICE), 'communityInvites', 'inv-forged-by'),
      { communityId: 'com1', createdBy: BOB, createdAt: 1 })); // keeper, but forged createdBy
    await assertSucceeds(getDoc(doc(db(), 'communityInvites', 'inv-live-0001'))); // link-holder GET, signed out
    await assertSucceeds(updateDoc(doc(db(ALICE), 'communityInvites', 'inv-live-0001'),
      { revokedAt: Timestamp.fromMillis(Date.now()) }));
    await assertFails(updateDoc(doc(db(MALLORY), 'communityInvites', 'inv-future-01'),
      { revokedAt: Timestamp.fromMillis(Date.now()) }));
    await assertFails(updateDoc(doc(db(ALICE), 'communityInvites', 'inv-future-01'),
      { communityId: 'other' })); // revocation is the ONLY mutation
    // Revocation is one-way: a revoked key is never resurrected by clearing revokedAt.
    await assertFails(updateDoc(doc(db(ALICE), 'communityInvites', 'inv-revoked-1'),
      { revokedAt: null }));
    await assertFails(deleteDoc(doc(db(ALICE), 'communityInvites', 'inv-live-0001'))); // never deleted, marked
  });
});

describe('link id-binding — authority resolves by path, so the doc id must equal from__rel__to', () => {
  const link = (from: string, rel: string, to: string, extra: object = {}) =>
    ({ lid: 'x', type: 'link', rel, from, to, ...extra, createdAt: 1 });

  it('a self-serve rel cannot masquerade at a privileged path (no steward/keeper by forgery)', async () => {
    // Mallory tries to land a 'joined' link (self-serve) at the steward path for com1.
    await assertFails(setDoc(doc(db(MALLORY), 'links', `${MALLORY}__steward__com1`), link(MALLORY, 'joined', MALLORY)));
    // And cannot forge tree-carer power by placing a self-serve rel at a co_owner path.
    await assertFails(setDoc(doc(db(MALLORY), 'links', `${MALLORY}__co_owner__treeB`), link(MALLORY, 'joined', MALLORY)));
    // The honest self-serve write (id matches data) still succeeds.
    await assertSucceeds(setDoc(doc(db(MALLORY), 'links', `${MALLORY}__joined__vX`), link(MALLORY, 'joined', 'vX')));
  });
});

describe("beds — housed by a keeper or loose at a place; a bed never forges into a house", () => {
  const bed = (over: object = {}) => ({
    ownerId: ALICE, name: 'Cedar bed', body: 'Welcome, traveller.',
    treeType: 'BED', lightHouseId: 'lh1', visibility: 'node',
    createdAt: 1, genesisHash: 'g0', latestHash: 'g0', blockHeight: 0,
    validated: false, validatorId: null, ...over,
  });
  // A loose bed: no house — a coordinate under open stars.
  const looseBed = (over: object = {}) => {
    const { lightHouseId: _dropped, ...rest } = bed({ latitude: 6.03, longitude: 81.33 }) as Record<string, unknown>;
    return { ...rest, ...over };
  };

  it('the keeper plants a bed in their own house; staff may too', async () => {
    await assertSucceeds(setDoc(doc(db(ALICE), 'lifetrees', 'bed1'), bed()));
    await assertSucceeds(setDoc(doc(db(STAFF), 'lifetrees', 'bed2'), bed({ ownerId: STAFF })));
  });

  it("a stranger cannot plant a bed in someone else's house — nor the keeper in another's name", async () => {
    await assertFails(setDoc(doc(db(MALLORY), 'lifetrees', 'bedX'), bed({ ownerId: MALLORY }))); // not lh1's keeper
    await assertFails(setDoc(doc(db(ALICE), 'lifetrees', 'bedY'), bed({ ownerId: BOB })));       // forged owner
  });

  it('a loose bed at a coordinate is welcome — anyone, in their own name, no house needed', async () => {
    await assertSucceeds(setDoc(doc(db(BOB), 'lifetrees', 'bedL1'), looseBed({ ownerId: BOB })));
    await assertSucceeds(setDoc(doc(db(BOB), 'lifetrees', 'bedL2'),
      looseBed({ ownerId: BOB, lightHouseId: '' }))); // an explicit '' is loose too
    await assertFails(setDoc(doc(db(BOB), 'lifetrees', 'bedLf'), looseBed({ ownerId: ALICE }))); // forged owner
  });

  it('a loose bed at a NON-place is refused: NaN, Infinity, and off-Earth coordinates are nowhere', async () => {
    await assertFails(setDoc(doc(db(BOB), 'lifetrees', 'bedN'), looseBed({ ownerId: BOB, latitude: NaN, longitude: NaN })));
    await assertFails(setDoc(doc(db(BOB), 'lifetrees', 'bedI'), looseBed({ ownerId: BOB, latitude: Infinity })));
    await assertFails(setDoc(doc(db(BOB), 'lifetrees', 'bedJ'), looseBed({ ownerId: BOB, longitude: -Infinity })));
    await assertFails(setDoc(doc(db(BOB), 'lifetrees', 'bedO'), looseBed({ ownerId: BOB, latitude: 91 })));
    await assertFails(setDoc(doc(db(BOB), 'lifetrees', 'bedP'), looseBed({ ownerId: BOB, longitude: 181 })));
    await assertFails(setDoc(doc(db(BOB), 'lifetrees', 'bedQ'), looseBed({ ownerId: BOB, latitude: 999, longitude: -999 })));
    // The edges of the map are still places — the poles and the antimeridian welcome a bed.
    await assertSucceeds(setDoc(doc(db(BOB), 'lifetrees', 'bedR'), looseBed({ ownerId: BOB, latitude: 90, longitude: -180 })));
    await assertSucceeds(setDoc(doc(db(BOB), 'lifetrees', 'bedT'), looseBed({ ownerId: BOB, latitude: -90, longitude: 180 })));
    // And zero is a real place (the equator, the meridian).
    await assertSucceeds(setDoc(doc(db(BOB), 'lifetrees', 'bedU'), looseBed({ ownerId: BOB, latitude: 0, longitude: 0 })));
  });

  it('a bed with NEITHER a house NOR a place is still refused', async () => {
    const { latitude: _lat, longitude: _lng, ...nowhere } = looseBed();
    await assertFails(setDoc(doc(db(ALICE), 'lifetrees', 'bedZ'), nowhere));
    const { longitude: _half, ...halfPlaced } = looseBed();
    await assertFails(setDoc(doc(db(ALICE), 'lifetrees', 'bedH'), halfPlaced));            // half a coordinate
    await assertFails(setDoc(doc(db(ALICE), 'lifetrees', 'bedS'), looseBed({ latitude: '6.03' }))); // a string is no place
    // An ordinary tree still plants freely, house or no house.
    await assertSucceeds(setDoc(doc(db(BOB), 'lifetrees', 'tree2'),
      { ownerId: BOB, name: 'Oak', treeType: 'LIFETREE', createdAt: 1, validated: false, validatorId: null }));
  });

  it('a bed never carries a domain — housed or loose, at birth (keeper or staff) or by edit', async () => {
    await assertFails(setDoc(doc(db(ALICE), 'lifetrees', 'bedD'), bed({ domain: 'lh.online' })));
    await assertFails(setDoc(doc(db(STAFF), 'lifetrees', 'bedE'), bed({ ownerId: STAFF, domain: 'lh.online' })));
    await assertFails(setDoc(doc(db(BOB), 'lifetrees', 'bedF'), looseBed({ ownerId: BOB, domain: 'lh.online' })));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'lifetrees', 'bed1'), bed());
      await setDoc(doc(ctx.firestore(), 'lifetrees', 'bedL1'), looseBed({ ownerId: BOB }));
    });
    await assertFails(updateDoc(doc(db(ALICE), 'lifetrees', 'bed1'), { domain: 'lh.online' }));
    await assertFails(updateDoc(doc(db(BOB), 'lifetrees', 'bedL1'), { domain: 'lh.online' }));
    // An ordinary tree still carries and changes a domain freely — the exclusion is the bed's alone.
    await assertSucceeds(setDoc(doc(db(BOB), 'lifetrees', 'tree3'),
      { ownerId: BOB, name: 'Elm', treeType: 'LIFETREE', domain: 'com.online', createdAt: 1, validated: false, validatorId: null }));
    await assertSucceeds(updateDoc(doc(db(BOB), 'lifetrees', 'tree3'), { domain: 'other.online' }));
  });

  it('the domain-freeze binds even staff: a staff edit cannot give a bed a domain', async () => {
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'lifetrees', 'bed1'), bed()));
    await assertFails(updateDoc(doc(db(STAFF), 'lifetrees', 'bed1'), { domain: 'lh.online' }));
    // Staff's broad powers otherwise breathe on — the frozen fields still bend to them.
    await assertSucceeds(updateDoc(doc(db(STAFF), 'lifetrees', 'bed1'),
      { name: 'Willow bed', validated: true, validatorId: STAFF }));
    // And a staff edit on an ordinary tree's domain remains free.
    await assertSucceeds(updateDoc(doc(db(STAFF), 'lifetrees', 'treeB'), { domain: 'staff.online' }));
  });

  it('a bed stays a bed — and a tree never becomes one', async () => {
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'lifetrees', 'bed1'), bed()));
    await assertSucceeds(updateDoc(doc(db(ALICE), 'lifetrees', 'bed1'), { name: 'Willow bed' }));
    await assertFails(updateDoc(doc(db(ALICE), 'lifetrees', 'bed1'), { treeType: 'LIFETREE' }));   // out of bed-hood
    await assertFails(updateDoc(doc(db(BOB), 'lifetrees', 'treeB'), { treeType: 'BED' })); // never becomes one
    await assertSucceeds(updateDoc(doc(db(BOB), 'lifetrees', 'treeB'), { treeType: 'GUARDED', isNature: true })); // convert still breathes
  });

  it("containment is soft: a bed may go loose or come home, but never into a house its writer doesn't keep", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'lifetrees', 'bed1'), bed({ latitude: 6.03, longitude: 81.33 }));
      await setDoc(doc(ctx.firestore(), 'lightHouses', 'lh2'), { ownerId: BOB, name: "Bob's Light", lid: 'lh2-lid' });
    });
    // The owner may clear the house — the bed goes loose, chain intact.
    await assertSucceeds(updateDoc(doc(db(ALICE), 'lifetrees', 'bed1'), { lightHouseId: '' }));
    // And point it home again — ALICE keeps lh1.
    await assertSucceeds(updateDoc(doc(db(ALICE), 'lifetrees', 'bed1'), { lightHouseId: 'lh1' }));
    // But never into a house the writer does not keep — real (Bob's) or imaginary.
    await assertFails(updateDoc(doc(db(ALICE), 'lifetrees', 'bed1'), { lightHouseId: 'lh2' }));
    await assertFails(updateDoc(doc(db(ALICE), 'lifetrees', 'bed1'), { lightHouseId: 'lh-nowhere' }));
  });

  it('a loose bed keeps its REAL place for LIFE — no edit may strand it at a non-place', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'lifetrees', 'bedL1'), looseBed({ ownerId: BOB }));
      await setDoc(doc(ctx.firestore(), 'lifetrees', 'bed1'), bed()); // housed — carries no coordinate
    });
    // The owner may not push their own loose bed off the map, into NaN, or into nowhere.
    await assertFails(updateDoc(doc(db(BOB), 'lifetrees', 'bedL1'), { latitude: 999 }));
    await assertFails(updateDoc(doc(db(BOB), 'lifetrees', 'bedL1'), { latitude: NaN }));
    await assertFails(updateDoc(doc(db(BOB), 'lifetrees', 'bedL1'), { latitude: deleteField() }));
    // A coordinate-less housed bed cannot be cut loose into placelessness…
    await assertFails(updateDoc(doc(db(ALICE), 'lifetrees', 'bed1'), { lightHouseId: '' }));
    // …but going loose WITH a real place remains a legitimate soft-home move.
    await assertSucceeds(updateDoc(doc(db(ALICE), 'lifetrees', 'bed1'),
      { lightHouseId: '', latitude: 6.03, longitude: 81.33 }));
    // An overlay that leaves the coordinate untouched still breathes: initiate validation
    // on a real-placed loose bed (the after-state is still a real place).
    await assertSucceeds(updateDoc(doc(db(ALICE), 'lifetrees', 'bedL1'),
      { validated: true, validatorId: ALICE, updatedAt: 1 }));
    // And an ordinary owner edit on the real-placed loose bed passes untroubled.
    await assertSucceeds(updateDoc(doc(db(BOB), 'lifetrees', 'bedL1'), { name: 'Fern bed' }));
  });

  it('bed-hood is immutable for EVERY writer — even staff cannot lift a bed into the forest', async () => {
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'lifetrees', 'bed1'), bed({ validated: true, validatorId: STAFF })));
    // Staff can neither promote a bed out of bed-hood nor press a tree into it.
    await assertFails(updateDoc(doc(db(STAFF), 'lifetrees', 'bed1'), { treeType: 'LIFETREE' }));
    await assertFails(updateDoc(doc(db(STAFF), 'lifetrees', 'treeB'), { treeType: 'BED' }));
    // Staff's dimming hand still reaches a bed's validation…
    await assertSucceeds(updateDoc(doc(db(STAFF), 'lifetrees', 'bed1'), { validated: false, validatorId: null }));
    // …and the owner's LIFETREE<->GUARDED conversion still breathes, both ways.
    await assertSucceeds(updateDoc(doc(db(BOB), 'lifetrees', 'treeB'), { treeType: 'GUARDED' }));
    await assertSucceeds(updateDoc(doc(db(BOB), 'lifetrees', 'treeB'), { treeType: 'LIFETREE' }));
  });

  it('the place gate binds staff at birth too — no hand may plant a placeless loose bed', async () => {
    const { latitude: _lat, longitude: _lng, ...nowhere } = looseBed({ ownerId: STAFF });
    await assertFails(setDoc(doc(db(STAFF), 'lifetrees', 'bedSA'), nowhere));                                  // no coordinate
    await assertFails(setDoc(doc(db(STAFF), 'lifetrees', 'bedSB'), looseBed({ ownerId: STAFF, latitude: NaN }))); // a non-place
    await assertSucceeds(setDoc(doc(db(STAFF), 'lifetrees', 'bedSC'), looseBed({ ownerId: STAFF })));          // a real place
    await assertSucceeds(setDoc(doc(db(STAFF), 'lifetrees', 'bedSD'), bed({ ownerId: STAFF })));               // housed — no coordinate needed
  });
});

describe('stays — a request to sleep in a BED; hostUid is the bed keeper, frozen after birth', () => {
  const stay = (over: object = {}) => ({
    bedId: 'bedStay', bedName: 'Cedar', lightHouseId: 'lh1',
    uid: BOB, guestName: 'Bob', guestTreeId: 'gt', guestTreeName: 'Bob\'s Oak', guestTreeGrowthUrl: '',
    hostUid: ALICE, fromDate: '2026-09-01', toDate: '2026-09-04', nights: 3, status: 'requested', ...over,
  });

  it('a guest requests a stay on a bed — hostUid must be that bed\'s keeper', async () => {
    await assertSucceeds(setDoc(doc(db(BOB), 'stays', 's1'), stay()));
    await assertFails(setDoc(doc(db(BOB), 'stays', 's2'), stay({ hostUid: BOB })));        // forged host
    await assertFails(setDoc(doc(db(BOB), 'stays', 's3'), stay({ uid: ALICE })));           // forged guest
    await assertFails(setDoc(doc(db(BOB), 'stays', 's4'), stay({ status: 'accepted' })));   // no self-accept
    await assertFails(setDoc(doc(db(BOB), 'stays', 's5'), stay({ bedId: '' })));            // must name a bed
    await assertFails(setDoc(doc(db(BOB), 'stays', 's6'), stay({ fromDate: '2026-09-05', toDate: '2026-09-04' }))); // reversed range
    await assertFails(setDoc(doc(db(BOB), 'stays', 's7'), stay({ fromDate: '2026-09-04', toDate: '2026-09-04' }))); // zero nights
  });

  it('a stay cannot aim at a non-bed (only a BED carries beds)', async () => {
    // treeB is a LIFETREE owned by BOB — even as its owner, BOB cannot host a stay on it.
    await assertFails(setDoc(doc(db(BOB), 'stays', 'sT'), stay({ bedId: 'treeB', hostUid: BOB })));
  });

  it('only the bed keeper flips status; bedId and the guest face are frozen after birth', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'stays', 's1'), stay()));
    await assertFails(updateDoc(doc(db(BOB), 'stays', 's1'), { status: 'accepted' }));          // guest can't accept
    await assertSucceeds(updateDoc(doc(db(ALICE), 'stays', 's1'), { status: 'accepted' }));     // keeper can
    await assertFails(updateDoc(doc(db(ALICE), 'stays', 's1'), { status: 'accepted', bedId: 'other' })); // bedId frozen
    await assertFails(updateDoc(doc(db(ALICE), 'stays', 's1'), { guestTreeName: 'spoofed' }));  // the face is frozen
  });

  it('occupancy is public to read, keeper-only to write — no forged availability', async () => {
    await assertSucceeds(setDoc(doc(db(ALICE), 'lifetrees', 'bedStay', 'occupancy', 's1'), { fromDate: '2026-09-01', toDate: '2026-09-04' }));
    await assertFails(setDoc(doc(db(BOB), 'lifetrees', 'bedStay', 'occupancy', 's2'), { fromDate: '2026-09-10', toDate: '2026-09-12' }));
    await assertSucceeds(getDoc(doc(db(BOB), 'lifetrees', 'bedStay', 'occupancy', 's1'))); // any signed-in guest sees busy/free
    await assertSucceeds(getDoc(doc(db(), 'lifetrees', 'bedStay', 'occupancy', 's1')));    // public: a signed-OUT visitor too
  });

  it("a view-hold is yours alone — you cannot forge or steal another being's", async () => {
    await assertSucceeds(setDoc(doc(db(BOB), 'lifetrees', 'bedStay', 'holds', BOB), { holderUid: BOB, expiresAt: Date.now() + 60000 }));
    await assertFails(setDoc(doc(db(BOB), 'lifetrees', 'bedStay', 'holds', ALICE), { holderUid: ALICE, expiresAt: Date.now() + 60000 })); // not your doc
    await assertFails(setDoc(doc(db(BOB), 'lifetrees', 'bedStay', 'holds', BOB), { holderUid: BOB, expiresAt: 9999999999999 })); // no far-future hostage
    await assertSucceeds(getDoc(doc(db(ALICE), 'lifetrees', 'bedStay', 'holds', BOB))); // readable by anyone signed in
  });
});

describe('networkInvites — consuming cannot rewrite the email, inviter, or the node it carries', () => {
  const seedInvite = () => env.withSecurityRulesDisabled(async (ctx) =>
    setDoc(doc(ctx.firestore(), 'networkInvites', 'ninv1'), {
      email: 'newcomer@x.com', invitedByUserId: ALICE, status: 'pending', createdAt: 1,
      nodeCommunityId: 'com1', nodeDomain: 'perauset.com',
    }));

  it('the invited user consumes it — accepted, stamping themselves, node fields intact', async () => {
    await seedInvite();
    await assertSucceeds(updateDoc(doc(db(BOB), 'networkInvites', 'ninv1'),
      { status: 'accepted', acceptedByUserId: BOB, acceptedAt: 2 }));
  });

  it('cannot re-stamp the node, the inviter, the email, or accept as someone else', async () => {
    await seedInvite();
    await assertFails(updateDoc(doc(db(BOB), 'networkInvites', 'ninv1'),
      { status: 'accepted', acceptedByUserId: BOB, nodeCommunityId: 'other' }));   // forged node
    await assertFails(updateDoc(doc(db(BOB), 'networkInvites', 'ninv1'),
      { status: 'accepted', acceptedByUserId: BOB, nodeDomain: 'evil.com' }));      // forged domain
    await assertFails(updateDoc(doc(db(BOB), 'networkInvites', 'ninv1'),
      { status: 'accepted', acceptedByUserId: BOB, invitedByUserId: BOB }));        // forged inviter
    await assertFails(updateDoc(doc(db(BOB), 'networkInvites', 'ninv1'),
      { status: 'accepted', acceptedByUserId: MALLORY }));                          // accept as another
  });
});

describe("lightHouses — the community's choice is LAW: membership enforced at rest", () => {
  const CAROL = 'carol-uid'; // a keeper who consecrates houses in com1
  // BOB belongs to com1 (ALICE's community); MALLORY does not. Houses at each visibility tier.
  const seedHouses = () => env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'links', `${BOB}__member__com1`), { lid: 'x', type: 'link', rel: 'member', from: BOB, to: 'com1', createdAt: 1 });
    await setDoc(doc(d, 'lightHouses', 'lhPublic'),  { ownerId: CAROL,   name: 'Beacon',    lid: 'lhp',  communityId: 'com1', visibility: 'public' });
    await setDoc(doc(d, 'lightHouses', 'lhNode'),    { ownerId: CAROL,   name: 'Nodehouse', lid: 'lhn',  communityId: 'com1', visibility: 'node' });
    await setDoc(doc(d, 'lightHouses', 'lhComm'),    { ownerId: CAROL,   name: 'Hearth',    lid: 'lhc',  communityId: 'com1', visibility: 'community' });
    await setDoc(doc(d, 'lightHouses', 'lhDefault'), { ownerId: CAROL,   name: 'Old',       lid: 'lhd',  communityId: 'com1' }); // absent visibility
    await setDoc(doc(d, 'lightHouses', 'lhMallory'), { ownerId: MALLORY, name: 'Mine',      lid: 'lhm',  communityId: 'com1', visibility: 'community' });
  });

  it('public houses are readable by everyone, signed-in or not', async () => {
    await seedHouses();
    await assertSucceeds(getDoc(doc(db(), 'lightHouses', 'lhPublic')));        // signed-out
    await assertSucceeds(getDoc(doc(db(BOB), 'lightHouses', 'lhPublic')));     // member
    await assertSucceeds(getDoc(doc(db(MALLORY), 'lightHouses', 'lhPublic'))); // non-member
  });

  it('node houses open to any signed-in being, but the signed-out are turned away', async () => {
    await seedHouses();
    await assertSucceeds(getDoc(doc(db(BOB), 'lightHouses', 'lhNode')));
    await assertSucceeds(getDoc(doc(db(MALLORY), 'lightHouses', 'lhNode'))); // signed-in non-member still sees node
    await assertFails(getDoc(doc(db(), 'lightHouses', 'lhNode')));           // signed-out cannot
  });

  it('a community house is law: a member reads it; a signed-in NON-member cannot; nor the signed-out', async () => {
    await seedHouses();
    await assertSucceeds(getDoc(doc(db(BOB), 'lightHouses', 'lhComm')));   // member link
    await assertSucceeds(getDoc(doc(db(ALICE), 'lightHouses', 'lhComm'))); // com1's owner is a member
    await assertFails(getDoc(doc(db(MALLORY), 'lightHouses', 'lhComm')));  // signed-in, but no membership — the veil is now a wall
    await assertFails(getDoc(doc(db(), 'lightHouses', 'lhComm')));         // signed-out
  });

  it('absent visibility behaves as community — the default is private, member-only', async () => {
    await seedHouses();
    await assertSucceeds(getDoc(doc(db(BOB), 'lightHouses', 'lhDefault')));
    await assertFails(getDoc(doc(db(MALLORY), 'lightHouses', 'lhDefault')));
    await assertFails(getDoc(doc(db(), 'lightHouses', 'lhDefault')));
  });

  it('the owner reads their own community house even as a non-member; staff read any', async () => {
    await seedHouses();
    await assertSucceeds(getDoc(doc(db(MALLORY), 'lightHouses', 'lhMallory'))); // owner, though not in com1
    await assertSucceeds(getDoc(doc(db(STAFF), 'lightHouses', 'lhComm')));      // staff sees any
    await assertSucceeds(getDoc(doc(db(STAFF), 'lightHouses', 'lhDefault')));
  });
});

describe('visions — the idea-twin grows its own chain; the genesis is frozen', () => {
  // BOB authors the vision; its head advances by contributions (growVision), its root is sealed once.
  const seedVisions = () => env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'visions', 'v1'), {
      authorId: BOB, title: 'V', visibility: 'public', lid: 'v1-lid',
      genesisHash: 'g0', latestHash: 'g0', blockHeight: 0,
    });
    // A legacy vision, minted before the twins grew chains — no genesis yet.
    await setDoc(doc(d, 'visions', 'vLegacy'), { authorId: BOB, title: 'Old', visibility: 'public', lid: 'vL-lid' });
  });

  it('the author advances the chain — latestHash/blockHeight move freely (a contribution seals)', async () => {
    await seedVisions();
    await assertSucceeds(updateDoc(doc(db(BOB), 'visions', 'v1'), { latestHash: 'h1', blockHeight: 1 }));
  });

  it("a stranger cannot grow (advance) someone else's vision", async () => {
    await seedVisions();
    await assertFails(updateDoc(doc(db(MALLORY), 'visions', 'v1'), { latestHash: 'h1', blockHeight: 1 }));
  });

  it('the genesis is frozen — even the author cannot rewrite or forge it, alone or smuggled along', async () => {
    await seedVisions();
    await assertFails(updateDoc(doc(db(BOB), 'visions', 'v1'), { genesisHash: 'forged' }));
    await assertFails(updateDoc(doc(db(BOB), 'visions', 'v1'), { latestHash: 'h1', blockHeight: 1, genesisHash: 'forged' }));
  });

  it('a legacy vision may be BORN a chain once (absent genesis set) — by its author or by staff (the backfill)', async () => {
    await seedVisions();
    await assertSucceeds(updateDoc(doc(db(BOB), 'visions', 'vLegacy'), { genesisHash: 'g0', latestHash: 'g0', blockHeight: 0 }));
    await seedVisions(); // reset the legacy vision back to chainless
    await assertSucceeds(updateDoc(doc(db(STAFF), 'visions', 'vLegacy'), { genesisHash: 'g0', latestHash: 'g0', blockHeight: 0 }));
  });

  it('the lid stays frozen on a vision (the true name is load-bearing)', async () => {
    await seedVisions();
    await assertFails(updateDoc(doc(db(BOB), 'visions', 'v1'), { lid: 'forged' }));
  });

  it('a broad vision list cannot sweep private records into a client', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = ctx.firestore();
      await setDoc(doc(d, 'visions', 'vNode'), { authorId: ALICE, title: 'Node', visibility: 'node' });
      await setDoc(doc(d, 'visions', 'vPrivate'), { authorId: ALICE, title: 'Private', visibility: 'private' });
      await setDoc(doc(d, 'visions', 'vUnlisted'), { authorId: ALICE, title: 'Old unlisted vision' });
    });

    // The attack the public menu exposed: no visibility constraint. It must fail as a whole.
    await assertFails(getDocs(query(collection(db(), 'visions'))));
    await assertFails(getDocs(query(collection(db(MALLORY), 'visions'))));

    const publicSnap = await assertSucceeds(getDocs(query(
      collection(db(), 'visions'),
      where('visibility', '==', 'public'),
    )));
    expect(publicSnap.docs.every(d => d.data().visibility === 'public')).toBe(true);

    const signedInSnap = await assertSucceeds(getDocs(query(
      collection(db(MALLORY), 'visions'),
      where('visibility', 'in', ['public', 'node']),
    )));
    expect(signedInSnap.docs.every(d => ['public', 'node'].includes(d.data().visibility))).toBe(true);

    // An author may still list all of their own visions, including private and unlisted ones.
    const mine = await assertSucceeds(getDocs(query(
      collection(db(ALICE), 'visions'),
      where('authorId', '==', ALICE),
    )));
    expect(mine.docs.map(d => d.id)).toEqual(expect.arrayContaining(['vPrivate', 'vUnlisted']));
  });
});

describe('covenants — the two-sided mint: proposer names parties, each signs only their own slot', () => {
  const CAROL = 'carol-uid';
  // cov1: ALICE proposes; ALICE + BOB are its two parties (quorum 2). ALICE is both proposer and party.
  const seedCov = () => env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'covenants', 'cov1'), {
      lid: 'cov1-lid', genesisHash: 'g0', latestHash: 'g0', blockHeight: 0,
      kind: 'covenant', title: 'We care together', body: 'Each waters when able.',
      quorum: 2, proposedBy: ALICE, status: 'proposed',
    });
    await setDoc(doc(d, 'links', `${ALICE}__party__cov1`), { lid: 'pa', type: 'link', rel: 'party', from: ALICE, to: 'cov1', role: 'initiator', createdAt: 1 });
    await setDoc(doc(d, 'links', `${BOB}__party__cov1`), { lid: 'pb', type: 'link', rel: 'party', from: BOB, to: 'cov1', createdAt: 1 });
  });
  const covDoc = (over: object = {}) => ({
    lid: 'l', genesisHash: 'g', latestHash: 'g', blockHeight: 0,
    kind: 'covenant', title: 'T', body: 'B', quorum: 1, proposedBy: ALICE, status: 'proposed', ...over,
  });
  const party = (uid: string, extra: object = {}) => ({ lid: 'x', type: 'link', rel: 'party', from: uid, to: 'cov1', ...extra, createdAt: 1 });
  const sig = {
    sig: 'base64-signature',
    pubkey: SIGNING_PUBKEY,
    version: 3,
    keyFingerprint: SIGNING_FP,
    epochId: SIGNING_EPOCH,
    recordedAt: serverTimestamp(),
  };

  it('the proposer creates it naming themselves; a stranger cannot forge the proposer', async () => {
    await assertSucceeds(setDoc(doc(db(ALICE), 'covenants', 'covA'), covDoc()));
    await assertFails(setDoc(doc(db(MALLORY), 'covenants', 'covB'), covDoc()));            // proposedBy != writer
    await assertSucceeds(setDoc(doc(db(MALLORY), 'covenants', 'covC'), covDoc({ proposedBy: MALLORY })));
  });

  it('ONLY the proposer mints party links — a party (non-proposer) or stranger cannot add to the roster', async () => {
    await seedCov();
    await assertSucceeds(setDoc(doc(db(ALICE), 'links', `${CAROL}__party__cov1`), party(CAROL)));   // proposer names a party
    await assertFails(setDoc(doc(db(BOB), 'links', `${MALLORY}__party__cov1`), party(MALLORY)));    // BOB is a party, not the proposer
    await assertFails(setDoc(doc(db(MALLORY), 'links', `${MALLORY}__party__cov1`), party(MALLORY))); // a stranger
    // A party link cannot masquerade at a privileged path either (id must equal from__party__to).
    await assertFails(setDoc(doc(db(ALICE), 'links', `${CAROL}__steward__cov1`), party(CAROL)));
  });

  it('a party signs ONLY their own slot; a stranger cannot sign at all', async () => {
    await seedCov();
    await assertSucceeds(setDoc(doc(db(BOB), 'covenants', 'cov1', 'signatures', BOB), sig));          // own slot
    await assertFails(setDoc(doc(db(BOB), 'covenants', 'cov1', 'signatures', ALICE), sig));           // another's slot
    await assertFails(setDoc(doc(db(MALLORY), 'covenants', 'cov1', 'signatures', MALLORY), sig));     // not a party
  });

  it('a signature is immutable once written — even by its own signer', async () => {
    await seedCov();
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'covenants', 'cov1', 'signatures', BOB), sig));
    await assertFails(updateDoc(doc(db(BOB), 'covenants', 'cov1', 'signatures', BOB), { sig: 'forged' }));
  });

  it('FIELD-LOCK: a signature carrying a body `uid` (or any extra field) is REFUSED — the doc id is the only signer', async () => {
    await seedCov();
    // The quorum-inflation write: a party smuggles a body uid claiming another signer's hand.
    await assertFails(setDoc(doc(db(BOB), 'covenants', 'cov1', 'signatures', BOB), { ...sig, uid: ALICE }));
    await assertFails(setDoc(doc(db(BOB), 'covenants', 'cov1', 'signatures', BOB), { ...sig, uid: BOB }));   // even their own
    await assertFails(setDoc(doc(db(BOB), 'covenants', 'cov1', 'signatures', BOB), { ...sig, extra: 'x' }));
    // The legit field set still lands.
    await assertSucceeds(setDoc(doc(db(BOB), 'covenants', 'cov1', 'signatures', BOB), sig));
  });

  it('recordedAt and epoch are server-witnessed — backdating, invented epochs, and frozen keys cannot sign', async () => {
    await seedCov();
    await assertFails(setDoc(doc(db(BOB), 'covenants', 'cov1', 'signatures', BOB), {
      ...sig, recordedAt: Timestamp.fromMillis(1),
    }));
    await assertFails(setDoc(doc(db(BOB), 'covenants', 'cov1', 'signatures', BOB), {
      ...sig, epochId: 'invented-epoch',
    }));
    await env.withSecurityRulesDisabled(async (ctx) =>
      updateDoc(doc(ctx.firestore(), 'persons', BOB), { signingState: 'frozen' }));
    await assertFails(setDoc(doc(db(BOB), 'covenants', 'cov1', 'signatures', BOB), sig));
  });

  it('the identity is FROZEN — only status + chain head advance; title/quorum/proposedBy cannot move', async () => {
    await seedCov();
    // A party seals: status + head only — allowed.
    await assertSucceeds(updateDoc(doc(db(BOB), 'covenants', 'cov1'), { status: 'sealed', latestHash: 'h1', blockHeight: 1, sealedAt: 2 }));
    await seedCov();
    await assertFails(updateDoc(doc(db(BOB), 'covenants', 'cov1'), { title: 'changed' }));
    await assertFails(updateDoc(doc(db(BOB), 'covenants', 'cov1'), { quorum: 1 }));
    await assertFails(updateDoc(doc(db(BOB), 'covenants', 'cov1'), { genesisHash: 'forged' }));
    await assertFails(updateDoc(doc(db(ALICE), 'covenants', 'cov1'), { proposedBy: MALLORY }));
    await assertFails(updateDoc(doc(db(BOB), 'covenants', 'cov1'), { status: 'sealed', quorum: 1 })); // no smuggling alongside
  });

  it('a non-party, non-proposer cannot advance the covenant', async () => {
    await seedCov();
    await assertFails(updateDoc(doc(db(MALLORY), 'covenants', 'cov1'), { status: 'broken' }));
  });

  it('the roster is append-only — a party may not delete their own slot; staff may mend', async () => {
    await seedCov();
    await assertFails(deleteDoc(doc(db(BOB), 'links', `${BOB}__party__cov1`)));
    await assertSucceeds(deleteDoc(doc(db(STAFF), 'links', `${BOB}__party__cov1`)));
  });

  it('the roster is frozen once SEALED — the proposer cannot add a party to repudiate a sealed covenant', async () => {
    await seedCov();
    // While still 'proposed', the proposer may extend the roster (the atomic-mint path).
    await assertSucceeds(setDoc(doc(db(ALICE), 'links', `${CAROL}__party__cov1`), party(CAROL)));
    // Seal it, then the identity (roster included) is frozen: even the proposer cannot add a party,
    // which would otherwise change the signed identity and un-verify every existing signature.
    await env.withSecurityRulesDisabled(async (ctx) =>
      updateDoc(doc(ctx.firestore(), 'covenants', 'cov1'), { status: 'sealed' }));
    await assertFails(setDoc(doc(db(ALICE), 'links', `${MALLORY}__party__cov1`), party(MALLORY)));
  });
});

describe('decision signatures — a decision the community SIGNS: member-gated, own-slot, immutable', () => {
  // A charter decision (a pulse of type 'decision') in ALICE's community com1. BOB is a member of com1;
  // MALLORY is not. Each member signs ONLY their own slot in pulses/{id}/signatures/{uid}.
  const seedDecision = () => env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'pulses', 'dec1'), {
      type: 'decision', lid: 'dec1-lid', communityId: 'com1',
      nature: 'charter', title: 'Adopt the charter', body: 'We care together.',
      proposedBy: ALICE, mode: 'threshold', votes: [ALICE], votesRequired: 7,
      status: 'open', previousHash: 'DECISION', hash: 'h0', createdAt: 1,
    });
    // BOB joins com1 (a member link); ALICE is com1's owner (implicitly a member).
    await setDoc(doc(d, 'links', `${BOB}__member__com1`), { lid: 'x', type: 'link', rel: 'member', from: BOB, to: 'com1', createdAt: 1 });
  });
  const sig = {
    sig: 'base64-signature',
    pubkey: SIGNING_PUBKEY,
    version: 3,
    keyFingerprint: SIGNING_FP,
    epochId: SIGNING_EPOCH,
    recordedAt: serverTimestamp(),
  };

  it('a community member signs their OWN slot; a non-member cannot sign at all', async () => {
    await seedDecision();
    await assertSucceeds(setDoc(doc(db(BOB), 'pulses', 'dec1', 'signatures', BOB), sig));      // member, own slot
    await assertSucceeds(setDoc(doc(db(ALICE), 'pulses', 'dec1', 'signatures', ALICE), sig));  // owner is a member
    await assertFails(setDoc(doc(db(MALLORY), 'pulses', 'dec1', 'signatures', MALLORY), sig)); // not a member of com1
  });

  it('a member may sign only their OWN slot — never another member\'s', async () => {
    await seedDecision();
    await assertFails(setDoc(doc(db(BOB), 'pulses', 'dec1', 'signatures', ALICE), sig)); // BOB writing ALICE's slot
  });

  it('a signature is immutable once written — even by its own signer', async () => {
    await seedDecision();
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'pulses', 'dec1', 'signatures', BOB), sig));
    await assertFails(updateDoc(doc(db(BOB), 'pulses', 'dec1', 'signatures', BOB), { sig: 'forged' }));
  });

  it('FIELD-LOCK: a signature carrying a body `uid` (or any extra field) is REFUSED; the legit sets still land', async () => {
    await seedDecision();
    // The quorum-inflation write: a member smuggles a body uid claiming another signer's hand.
    await assertFails(setDoc(doc(db(BOB), 'pulses', 'dec1', 'signatures', BOB), { ...sig, uid: ALICE }));
    await assertFails(setDoc(doc(db(BOB), 'pulses', 'dec1', 'signatures', BOB), { ...sig, uid: BOB }));   // even their own
    await assertFails(setDoc(doc(db(BOB), 'pulses', 'dec1', 'signatures', BOB), { ...sig, extra: 'x' }));
    // The legit field sets: threshold (sig/pubkey/signedAt) and consensus (+ position).
    await assertSucceeds(setDoc(doc(db(BOB), 'pulses', 'dec1', 'signatures', BOB), sig));
    await assertSucceeds(setDoc(doc(db(ALICE), 'pulses', 'dec1', 'signatures', ALICE), { ...sig, position: 'unite' }));
  });

  it('signatures attach only to a DECISION pulse, not an ordinary event', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = ctx.firestore();
      await setDoc(doc(d, 'pulses', 'ev1'), { type: 'event', communityId: 'com1', title: 'Gathering', createdAt: 1 });
      await setDoc(doc(d, 'links', `${BOB}__member__com1`), { lid: 'x', type: 'link', rel: 'member', from: BOB, to: 'com1', createdAt: 1 });
    });
    await assertFails(setDoc(doc(db(BOB), 'pulses', 'ev1', 'signatures', BOB), sig));
  });

  it('the STATUS flag is not the seal — a mere member cannot flip a decision to passed (the enactment gate holds)', async () => {
    await seedDecision();
    // Even a signer cannot self-declare the circle's will: flipping status stays with proposer/owner/staff.
    // (Enactment is authoritative only when the VERIFIED signatures meet the quorum — the crypto, not the
    // flag; a member landing a signature never gains the power to flip the flag on their own.)
    await assertFails(updateDoc(doc(db(BOB), 'pulses', 'dec1'), { status: 'passed', passedAt: 2 }));
    await assertSucceeds(updateDoc(doc(db(ALICE), 'pulses', 'dec1'), { status: 'passed', passedAt: 2 })); // proposer/owner
  });
});

describe('persons key history — append-only lineage at persons/{uid}/keys/{fingerprint}', () => {
  const FP = 'a'.repeat(64); // a stable fingerprint-shaped doc id
  const keyDoc = { pubkey: 'base64-spki-key-A', publishedAt: 1 };

  it('the owner records their own key; a stranger cannot write into another\'s history', async () => {
    await assertSucceeds(setDoc(doc(db(ALICE), 'persons', ALICE, 'keys', 'new-fp'), {
      pubkey: 'base64-spki-key-B', publishedAt: serverTimestamp(),
    }));
    await assertFails(setDoc(doc(db(MALLORY), 'persons', ALICE, 'keys', 'other-fp'), {
      pubkey: 'base64-spki-key-B', publishedAt: serverTimestamp(),
    }));
  });

  it('exactly { pubkey, publishedAt } — extra fields and an empty pubkey are refused', async () => {
    await assertFails(setDoc(doc(db(ALICE), 'persons', ALICE, 'keys', 'extra-fp'), {
      pubkey: 'key', publishedAt: serverTimestamp(), extra: 'x',
    }));
    await assertFails(setDoc(doc(db(ALICE), 'persons', ALICE, 'keys', 'empty-fp'), {
      pubkey: '', publishedAt: serverTimestamp(),
    }));
  });

  it('publishedAt is the server receipt time — backdated and future lineage claims are refused', async () => {
    await assertFails(setDoc(doc(db(ALICE), 'persons', ALICE, 'keys', 'backdated-fp'), {
      pubkey: 'key', publishedAt: Timestamp.fromMillis(1),
    }));
    await assertFails(setDoc(doc(db(ALICE), 'persons', ALICE, 'keys', 'future-fp'), {
      pubkey: 'key', publishedAt: Timestamp.fromMillis(Date.now() + 86_400_000),
    }));
  });

  it('append-only: the recorded pubkey can never change under its fingerprint; re-publishing the SAME key may merge; no delete, not even staff', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'persons', ALICE, 'keys', FP), keyDoc));
    await assertFails(updateDoc(doc(db(ALICE), 'persons', ALICE, 'keys', FP), { pubkey: 'a-DIFFERENT-key' }));
    await assertSucceeds(setDoc(doc(db(ALICE), 'persons', ALICE, 'keys', FP), keyDoc, { merge: true })); // same-key no-op
    await assertFails(deleteDoc(doc(db(ALICE), 'persons', ALICE, 'keys', FP)));
    await assertFails(deleteDoc(doc(db(STAFF), 'persons', ALICE, 'keys', FP)));
  });

  it('the TIMELINE is as frozen as the key: publishedAt can never be rewritten (verification stands on the lineage)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'persons', ALICE, 'keys', FP), keyDoc));
    await assertFails(updateDoc(doc(db(ALICE), 'persons', ALICE, 'keys', FP), { publishedAt: 2 }));
    await assertFails(setDoc(doc(db(ALICE), 'persons', ALICE, 'keys', FP), { ...keyDoc, publishedAt: 99 }, { merge: true }));
  });

  it('the history is world-readable — anyone can verify lineage', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'persons', ALICE, 'keys', FP), keyDoc));
    await assertSucceeds(getDoc(doc(db(), 'persons', ALICE, 'keys', FP)));
  });
});

describe('signing epochs — atomic anchor, immutable authority, one-way emergency freeze', () => {
  const FP = 'c'.repeat(64);
  const PUBKEY = 'base64-spki-mallory-key';
  const EPOCH = `anchor_${FP}`;

  // A real UUIDv7: the hinge refuses a junk lid at person birth (ring 2026-08-17).
  const MALLORY_LID = '019f6381-48fd-7fcc-9382-e99d923f38f7';
  const anchorMallory = async () => {
    const store = db(MALLORY);
    const person = doc(store, 'persons', MALLORY);
    const batch = writeBatch(store);
    batch.set(doc(person, 'keys', FP), { pubkey: PUBKEY, publishedAt: serverTimestamp() });
    batch.set(doc(person, 'keyEvents', EPOCH), {
      version: 1,
      type: 'anchor',
      uid: MALLORY,
      lid: MALLORY_LID,
      epochId: EPOCH,
      keyFingerprint: FP,
      recordedAt: serverTimestamp(),
    });
    batch.set(person, {
      lid: MALLORY_LID,
      publicKeyPem: PUBKEY,
      signingKeyFingerprint: FP,
      signingEpochId: EPOCH,
      signingState: 'active',
      signingAnchoredAt: serverTimestamp(),
    }, { merge: true });
    await batch.commit();
  };

  it('ordinary person birth may reserve a null public key without claiming an epoch', async () => {
    await assertSucceeds(setDoc(doc(db(MALLORY), 'persons', MALLORY), {
      uid: MALLORY,
      lid: MALLORY_LID,
      displayName: 'Mallory',
      publicKeyPem: null,
      createdAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(db(MALLORY), 'persons', MALLORY), { lid: 'another-lid' }));
    await assertFails(updateDoc(doc(db(STAFF), 'persons', MALLORY), { lid: 'staff-rewrite' }));
  });

  it('anchors current key + lineage + epoch in one server-timed batch', async () => {
    await assertSucceeds(anchorMallory());
    const person = await getDoc(doc(db(), 'persons', MALLORY));
    expect(person.data()?.signingEpochId).toBe(EPOCH);
    await assertSucceeds(getDoc(doc(db(), 'persons', MALLORY, 'keyEvents', EPOCH)));
  });

  it('an authenticated account and staff cannot directly replace the anchored key', async () => {
    await anchorMallory();
    await assertFails(updateDoc(doc(db(MALLORY), 'persons', MALLORY), {
      publicKeyPem: 'takeover-key',
    }));
    await assertFails(updateDoc(doc(db(STAFF), 'persons', MALLORY), {
      publicKeyPem: 'staff-takeover-key',
    }));
  });

  it('freezes atomically and can never unfreeze or erase the event from a client', async () => {
    await anchorMallory();
    const store = db(MALLORY);
    const person = doc(store, 'persons', MALLORY);
    const freezeId = `freeze_${EPOCH}`;
    const batch = writeBatch(store);
    batch.set(doc(person, 'keyEvents', freezeId), {
      version: 1,
      type: 'freeze',
      uid: MALLORY,
      lid: MALLORY_LID,
      epochId: EPOCH,
      keyFingerprint: FP,
      recordedAt: serverTimestamp(),
    });
    batch.update(person, {
      signingState: 'frozen',
      signingFrozenAt: serverTimestamp(),
      signingFreezeEventId: freezeId,
    });
    await assertSucceeds(batch.commit());
    await assertFails(updateDoc(person, { signingState: 'active' }));
    await assertFails(deleteDoc(doc(person, 'keyEvents', freezeId)));
  });

  it('cannot claim that compromise begins in the future', async () => {
    await anchorMallory();
    const store = db(MALLORY);
    const person = doc(store, 'persons', MALLORY);
    const freezeId = `freeze_${EPOCH}`;
    const batch = writeBatch(store);
    batch.set(doc(person, 'keyEvents', freezeId), {
      version: 1,
      type: 'freeze',
      uid: MALLORY,
      lid: MALLORY_LID,
      epochId: EPOCH,
      keyFingerprint: FP,
      claimedSuspectedSince: Timestamp.fromMillis(Date.now() + 86_400_000),
      recordedAt: serverTimestamp(),
    });
    batch.update(person, {
      signingState: 'frozen',
      signingFrozenAt: serverTimestamp(),
      signingFreezeEventId: freezeId,
    });
    await assertFails(batch.commit());
  });

  it('recovery proposals and witness slots are callable-owned, never client-forgeable', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      const proposal = doc(ctx.firestore(), 'persons', MALLORY, 'keyRecoveries', 'recovery-1');
      await setDoc(proposal, {
        version: 1,
        uid: MALLORY,
        status: 'open',
        fromFingerprint: FP,
        toFingerprint: 'd'.repeat(64),
        toPubkey: 'candidate-key',
        suspectedSinceMs: 1,
        newSig: 'proof',
        createdAt: Timestamp.fromMillis(1),
      });
    });
    const proposal = doc(db(MALLORY), 'persons', MALLORY, 'keyRecoveries', 'recovery-1');
    await assertSucceeds(getDoc(proposal));
    await assertFails(getDoc(doc(db(), 'persons', MALLORY, 'keyRecoveries', 'recovery-1')));
    await assertFails(setDoc(doc(proposal, 'witnesses', MALLORY), {
      witnessUid: MALLORY,
      version: 3,
      sig: 'forged',
      pubkey: PUBKEY,
      keyFingerprint: FP,
      epochId: EPOCH,
      recordedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(proposal, { status: 'activated' }));
  });
});

describe('the circle votes in its own name — the governance overlay is member-gated, append-own', () => {
  // votes→signatures convergence (ring 2026-08-09): the seal was already the signatures, but the
  // votes ARRAY was an unbound shared cell — any signed-in account, member or not, could rewrite
  // votes/concerns/positions on any decision whose id it knew. Now the overlay belongs to the
  // circle, and a voice moves only by append-exactly-your-own-uid.
  const DEC = 'dec-overlay';
  const seedDec = (data: object = {}) => env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'pulses', DEC), {
      type: 'decision', lid: `${DEC}-lid`, communityId: 'com1', nature: 'charter',
      title: 'T', body: '', proposedBy: ALICE, authorId: ALICE, mode: 'threshold',
      votes: [ALICE], votesRequired: 7, status: 'open',
      previousHash: 'DECISION', hash: 'h0', createdAt: 1, ...data,
    });
    await setDoc(doc(d, 'links', `${BOB}__member__com1`), { lid: 'x', type: 'link', rel: 'member', from: BOB, to: 'com1', createdAt: 1 });
  });

  it('a member adds their own voice; an outsider cannot touch the overlay at all', async () => {
    await seedDec();
    await assertSucceeds(updateDoc(doc(db(BOB), 'pulses', DEC), { votes: [ALICE, BOB] }));
    await assertFails(updateDoc(doc(db(MALLORY), 'pulses', DEC), { votes: [ALICE, BOB, MALLORY] }));
    await assertFails(updateDoc(doc(db(MALLORY), 'pulses', DEC), { concerns: [{ by: MALLORY, note: 'noise', at: 1 }] }));
  });

  it('a voice can be neither forged in another\'s name nor erased — even by a member', async () => {
    await seedDec();
    await assertFails(updateDoc(doc(db(BOB), 'pulses', DEC), { votes: [ALICE, MALLORY] })); // forged
    await assertFails(updateDoc(doc(db(BOB), 'pulses', DEC), { votes: [BOB] }));            // erases ALICE
    await assertFails(updateDoc(doc(db(BOB), 'pulses', DEC), { votes: [] }));               // erases all
  });

  it('the keeper stands inside their own circle: listening opens with a concern', async () => {
    await seedDec();
    await assertSucceeds(updateDoc(doc(db(ALICE), 'pulses', DEC), { listening: true, concerns: [{ by: ALICE, note: 'wait', at: 1 }] }));
  });
});

describe('draft vanishes, minted withdraws — the decision delete rule and the chain marks', () => {
  // A decision still in DRAFT substance (not passed, only the proposer's own voice, no positions)
  // may be deleted by its author; anything shared or enacted may only be WITHDRAWN. Signatures live
  // in a subcollection the rules cannot read — that half of the guard is the service's
  // (deleteDecision / domain decisionDeletable); here the doc-visible half is law.
  const seedDec = (id: string, data: object) => env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'pulses', id), {
      type: 'decision', lid: `${id}-lid`, communityId: 'com1', nature: 'charter',
      title: 'T', body: '', proposedBy: ALICE, authorId: ALICE, mode: 'threshold',
      votes: [ALICE], votesRequired: 7, status: 'open',
      previousHash: 'DECISION', hash: 'h0', createdAt: 1, ...data,
    });
    // BOB is a member of com1 — the governance overlay is member-gated now.
    await setDoc(doc(ctx.firestore(), 'links', `${BOB}__member__com1`), { lid: 'x', type: 'link', rel: 'member', from: BOB, to: 'com1', createdAt: 1 });
  });

  it('the author deletes their own unsigned, unshared draft', async () => {
    await seedDec('dr1', {});
    await assertSucceeds(deleteDoc(doc(db(ALICE), 'pulses', 'dr1')));
  });

  it('a PASSED decision can never be deleted by its author/keeper — minted withdraws', async () => {
    await seedDec('dp1', { status: 'passed' });
    await assertFails(deleteDoc(doc(db(ALICE), 'pulses', 'dp1')));
  });

  it('a second voice protects the record: votes beyond the proposer forbid deletion', async () => {
    await seedDec('dv1', { votes: [ALICE, BOB] });
    await assertFails(deleteDoc(doc(db(ALICE), 'pulses', 'dv1')));
    // hasOnly, not size: a malformed/legacy array holding someone ELSE's single voice still protects.
    await seedDec('dv2', { votes: [BOB] });
    await assertFails(deleteDoc(doc(db(ALICE), 'pulses', 'dv2')));
  });

  it('a recorded position protects the record too (the consensus voices)', async () => {
    await seedDec('dpos1', { positions: [{ by: BOB, stance: 'stand_aside', note: '', at: 1 }] });
    await assertFails(deleteDoc(doc(db(ALICE), 'pulses', 'dpos1')));
  });

  it('staff keep the mend-anything escape; an ordinary event\'s deletion is untouched', async () => {
    await seedDec('dp2', { status: 'passed' });
    await assertSucceeds(deleteDoc(doc(db(STAFF), 'pulses', 'dp2')));
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'pulses', 'ev2'), { type: 'event', communityId: 'com1', authorId: ALICE, title: 'Fire', createdAt: 1 }));
    await assertSucceeds(deleteDoc(doc(db(ALICE), 'pulses', 'ev2')));
  });

  it('chain marks move only WITH a status change: a voter cannot scribble enactedHash or withdrawnHash alone', async () => {
    await seedDec('dm1', {});
    await assertFails(updateDoc(doc(db(BOB), 'pulses', 'dm1'), { enactedHash: 'forged' }));
    await assertFails(updateDoc(doc(db(BOB), 'pulses', 'dm1'), { withdrawnHash: 'forged' }));
    // The real withdrawal write — status + mark together, by the proposer — lands.
    await assertSucceeds(updateDoc(doc(db(ALICE), 'pulses', 'dm1'), { status: 'withdrawn', listening: false, withdrawnAt: 2, withdrawnHash: 'wh1' }));
    // And a plain vote append by a member still works (the overlay stays open to voices).
    await seedDec('dm2', {});
    await assertSucceeds(updateDoc(doc(db(BOB), 'pulses', 'dm2'), { votes: [ALICE, BOB] }));
  });
});

describe('rays — light is server-minted and privately read (the sun ring, domain/light)', () => {
  const ray = { holderUid: ALICE, role: 'carer', sourceUid: ALICE, treeId: 't1', units: 100, pulseId: 'p1' };

  it('no client may EVER write a ray — light can never be self-minted', async () => {
    await assertFails(setDoc(doc(db(ALICE), 'rays', 'p1__carer'), ray));           // not even your own
    await assertFails(setDoc(doc(db(STAFF), 'rays', 'p1__carer'), ray));           // not even staff
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'rays', 'p1__carer'), ray));
    await assertFails(updateDoc(doc(db(ALICE), 'rays', 'p1__carer'), { units: 999 }));
    await assertFails(deleteDoc(doc(db(ALICE), 'rays', 'p1__carer')));
  });

  it('a being reads only their OWN light; another\'s rays stay private (staff may audit)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'rays', 'p1__carer'), ray));
    await assertSucceeds(getDoc(doc(db(ALICE), 'rays', 'p1__carer')));   // the holder
    await assertFails(getDoc(doc(db(BOB), 'rays', 'p1__carer')));        // not another being
    await assertSucceeds(getDoc(doc(db(STAFF), 'rays', 'p1__carer')));   // staff audit
  });
});

describe('glow — the commons ledger is server-written, communally read (the last spend)', () => {
  it('no client may write the glow, not even staff; the server alone feeds the commons', async () => {
    await assertFails(setDoc(doc(db(ALICE), 'glow', 'c1'), { units: 999 }));
    await assertFails(setDoc(doc(db(STAFF), 'glow', 'c1'), { units: 999 }));
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'glow', 'c1'), { units: 14 }));
    await assertFails(updateDoc(doc(db(ALICE), 'glow', 'c1'), { units: 999 }));
    await assertFails(deleteDoc(doc(db(ALICE), 'glow', 'c1')));
  });

  it('any signed-in being may read a community\'s warmth; the world outside may not', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'glow', 'c1'), { units: 14 }));
    await assertSucceeds(getDoc(doc(db(ALICE), 'glow', 'c1')));  // communal, not a private balance
    await assertSucceeds(getDoc(doc(db(BOB), 'glow', 'c1')));
    await assertFails(getDoc(doc(db(), 'glow', 'c1')));          // anonymous stays outside
  });
});

describe('loves: the private slot and public tally are one atomic gesture', () => {
  it('loves and un-loves another being with exactly one slot and one count', async () => {
    await assertSucceeds(toggleLove(ALICE, 'lifetrees', 'treeB'));
    expect((await getDoc(doc(db(ALICE), 'lifetrees', 'treeB'))).data()?.loveCount).toBe(1);
    await assertSucceeds(toggleLove(ALICE, 'lifetrees', 'treeB'));
    expect((await getDoc(doc(db(ALICE), 'lifetrees', 'treeB'))).data()?.loveCount).toBe(0);
  });

  it('the same coupled heart works on communities, beds, Light Houses, visions and pulses', async () => {
    await assertSucceeds(toggleLove(BOB, 'communities', 'com1'));
    await assertSucceeds(toggleLove(BOB, 'lifetrees', 'bedStay'));
    await assertSucceeds(toggleLove(BOB, 'lightHouses', 'lh1'));
    await assertSucceeds(toggleLove(BOB, 'visions', 'vision1'));
    await assertSucceeds(toggleLove(ALICE, 'pulses', 'pulseLove'));
    const pulse = (await getDoc(doc(db(ALICE), 'pulses', 'pulseLove'))).data();
    expect(pulse?.loveCount).toBe(1);
    expect(pulse?.validationScore).toBe(1);
  });

  it('refuses a slot without its tally and a tally without its slot', async () => {
    await assertFails(setDoc(
      doc(db(ALICE), 'lifetrees', 'treeB', 'loves', ALICE),
      { uid: ALICE, createdAt: serverTimestamp() },
    ));
    await assertFails(updateDoc(
      doc(db(ALICE), 'lifetrees', 'treeB'),
      { loveCount: 1, updatedAt: serverTimestamp() },
    ));
  });

  it('refuses an arbitrary or negative tally even when a matching slot is written atomically', async () => {
    const forge = (loveCount: number) => {
      const store = db(ALICE);
      const parent = doc(store, 'lifetrees', 'treeB');
      const slot = doc(parent, 'loves', ALICE);
      return runTransaction(store, async (t) => {
        await t.get(parent);
        await t.get(slot);
        t.set(slot, { uid: ALICE, createdAt: serverTimestamp() });
        t.update(parent, { loveCount, updatedAt: serverTimestamp() });
      });
    };
    await assertFails(forge(1_000_000));
    await assertFails(forge(-1));
  });

  it('an owner cannot bypass the heart law or carry another edit beside it', async () => {
    await assertFails(updateDoc(
      doc(db(BOB), 'lifetrees', 'treeB'),
      { name: 'Renamed while forging', loveCount: 999, updatedAt: serverTimestamp() },
    ));
    await assertFails(updateDoc(
      doc(db(ALICE), 'communities', 'com1'),
      { loveCount: 999, updatedAt: serverTimestamp() },
    ));
  });

  it('a known private id is not a side door: only someone allowed to see the being may love it', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const store = ctx.firestore();
      await setDoc(doc(store, 'lifetrees', 'hiddenTree'), { ownerId: BOB, visibility: 'private', loveCount: 0 });
      await setDoc(doc(store, 'visions', 'hiddenVision'), { authorId: BOB, visibility: 'private', loveCount: 0 });
      await setDoc(doc(store, 'lightHouses', 'hiddenHouse'), {
        ownerId: BOB, communityId: 'com1', visibility: 'community', loveCount: 0,
      });
      await setDoc(doc(store, 'pulses', 'hiddenPulse'), {
        authorId: BOB, type: 'standard', visibility: 'circle', treeId: 'treeB',
        loveCount: 0, validationScore: 0,
      });
    });

    const forgeKnownLove = (collectionName: string, id: string, pulse = false) => {
      const store = db(MALLORY);
      const parent = doc(store, collectionName, id);
      const batch = writeBatch(store);
      batch.set(doc(parent, 'loves', MALLORY), { uid: MALLORY, createdAt: serverTimestamp() });
      batch.update(parent, pulse
        ? { loveCount: 1, validationScore: 1, updatedAt: serverTimestamp() }
        : { loveCount: 1, updatedAt: serverTimestamp() });
      return batch.commit();
    };

    await assertFails(forgeKnownLove('lifetrees', 'hiddenTree'));
    await assertFails(forgeKnownLove('visions', 'hiddenVision'));
    await assertFails(forgeKnownLove('lightHouses', 'hiddenHouse'));
    await assertFails(forgeKnownLove('pulses', 'hiddenPulse', true));

    // Their owner can see the same private beings, so the ordinary coupled gesture still works.
    await assertSucceeds(toggleLove(BOB, 'lifetrees', 'hiddenTree'));
    await assertSucceeds(toggleLove(BOB, 'visions', 'hiddenVision'));
    await assertSucceeds(toggleLove(BOB, 'lightHouses', 'hiddenHouse'));
    await assertSucceeds(toggleLove(BOB, 'pulses', 'hiddenPulse'));
  });

  it('the slot is path-authoritative, minimal and immutable', async () => {
    const malformed = (payload: Record<string, unknown>) => {
      const store = db(ALICE);
      const parent = doc(store, 'lifetrees', 'treeB');
      const slot = doc(parent, 'loves', ALICE);
      return runTransaction(store, async (t) => {
        await t.get(parent);
        await t.get(slot);
        t.set(slot, payload);
        t.update(parent, { loveCount: 1, updatedAt: serverTimestamp() });
      });
    };
    await assertFails(malformed({ uid: BOB, createdAt: serverTimestamp() }));
    await assertFails(malformed({ uid: ALICE, createdAt: serverTimestamp(), applause: 999 }));
    await assertFails(setDoc(
      doc(db(ALICE), 'lifetrees', 'treeB', 'loves', BOB),
      { uid: BOB, createdAt: serverTimestamp() },
    ));
  });

  it('the anonymous cannot love', async () => {
    await assertFails(setDoc(doc(db(), 'lifetrees', 'treeB', 'loves', 'x'), { uid: 'x', createdAt: 1 }));
    await assertFails(updateDoc(doc(db(), 'lifetrees', 'treeB'), { loveCount: 1, updatedAt: 1 }));
  });

  it('a love slot is private on beings and pulses: you may read your own, never another\'s', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'lifetrees', 'treeB', 'loves', ALICE), { uid: ALICE, createdAt: 1 });
      await setDoc(doc(ctx.firestore(), 'pulses', 'pulseLove', 'loves', ALICE), { uid: ALICE, createdAt: 1 });
    });
    await assertSucceeds(getDoc(doc(db(ALICE), 'lifetrees', 'treeB', 'loves', ALICE)));
    await assertFails(getDoc(doc(db(BOB), 'lifetrees', 'treeB', 'loves', ALICE)));
    await assertFails(getDoc(doc(db(), 'lifetrees', 'treeB', 'loves', ALICE)));
    await assertSucceeds(getDoc(doc(db(ALICE), 'pulses', 'pulseLove', 'loves', ALICE)));
    await assertFails(getDoc(doc(db(BOB), 'pulses', 'pulseLove', 'loves', ALICE)));
  });
});

describe('offerings: only the author flips the lifecycle switch, and only the switch', () => {
  it('the author pauses and rewakes their offering', async () => {
    await assertSucceeds(updateDoc(doc(db(ALICE), 'pulses', 'offer1'), { offeringActive: false, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db(ALICE), 'pulses', 'offer1'), { offeringActive: true, updatedAt: serverTimestamp() }));
  });

  it('no other hand may flip it, and nothing rides along', async () => {
    await assertFails(updateDoc(doc(db(MALLORY), 'pulses', 'offer1'), { offeringActive: false, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(), 'pulses', 'offer1'), { offeringActive: false, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(ALICE), 'pulses', 'offer1'), { offeringActive: false, title: 'Renamed on the side', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(ALICE), 'pulses', 'offer1'), { offeringActive: 'yes', updatedAt: serverTimestamp() }));
  });

  it('the switch belongs to offerings alone: a standard pulse refuses it', async () => {
    await assertFails(updateDoc(doc(db(BOB), 'pulses', 'pulseLove'), { offeringActive: false, updatedAt: serverTimestamp() }));
  });
});

describe('push subscriptions — a being\'s own devices', () => {
  const sub = { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } };
  it('the owner adds, reads and drops their own; no other hand may', async () => {
    await assertSucceeds(setDoc(doc(db(ALICE), 'users', ALICE, 'pushSubscriptions', 'dev1'), sub));
    await assertSucceeds(getDoc(doc(db(ALICE), 'users', ALICE, 'pushSubscriptions', 'dev1')));
    await assertFails(setDoc(doc(db(MALLORY), 'users', ALICE, 'pushSubscriptions', 'dev2'), sub));
    await assertFails(getDoc(doc(db(MALLORY), 'users', ALICE, 'pushSubscriptions', 'dev1')));
    await assertFails(getDoc(doc(db(), 'users', ALICE, 'pushSubscriptions', 'dev1')));
    await assertSucceeds(deleteDoc(doc(db(ALICE), 'users', ALICE, 'pushSubscriptions', 'dev1')));
  });
});

describe('the offering of care — born open, withdrawn by its author, declined by the receiver, accepted by the server alone', () => {
  const answer = (status: string, extra: Record<string, unknown> = {}) => ({ offeringStatus: status, offeringAnsweredAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra });

  it('is born open — a client may never plant one already answered', async () => {
    const draft = { authorId: ALICE, type: 'offering', offeringKind: 'service', title: 'Weeding', visibility: 'public', offeringActive: true, offeredToKind: 'tree', offeredToId: 'treeB', offeringFromTreeId: 'treeA' };
    await assertSucceeds(setDoc(doc(db(ALICE), 'pulses', 'offerNew1'), { ...draft, offeringStatus: 'open' }));
    await assertSucceeds(setDoc(doc(db(ALICE), 'pulses', 'offerNew2'), draft));
    await assertFails(setDoc(doc(db(ALICE), 'pulses', 'offerNew3'), { ...draft, offeringStatus: 'accepted' }));
    await assertFails(setDoc(doc(db(ALICE), 'pulses', 'offerNew4'), { ...draft, offeringStatus: 'declined' }));
  });

  it('the author withdraws an open offering — one flip, nothing riding, never twice', async () => {
    await assertFails(updateDoc(doc(db(ALICE), 'pulses', 'offerCare1'), answer('withdrawn', { title: 'renamed' })));
    await assertFails(updateDoc(doc(db(BOB), 'pulses', 'offerCare1'), answer('withdrawn')));
    await assertFails(updateDoc(doc(db(MALLORY), 'pulses', 'offerCare1'), answer('withdrawn')));
    await assertSucceeds(updateDoc(doc(db(ALICE), 'pulses', 'offerCare1'), answer('withdrawn')));
    await assertFails(updateDoc(doc(db(ALICE), 'pulses', 'offerCare1'), answer('open')));       // answered: final
    await assertFails(updateDoc(doc(db(BOB), 'pulses', 'offerCare1'), answer('declined', { offeringAnsweredBy: BOB })));
  });

  it("a hand standing for the receiver declines — the tree's carer, the vision's author; never the offerer, never a stranger", async () => {
    await assertFails(updateDoc(doc(db(MALLORY), 'pulses', 'offerCare1'), answer('declined', { offeringAnsweredBy: MALLORY })));
    await assertFails(updateDoc(doc(db(ALICE), 'pulses', 'offerCare1'), answer('declined', { offeringAnsweredBy: ALICE })));
    await assertFails(updateDoc(doc(db(BOB), 'pulses', 'offerCare1'), answer('declined', { offeringAnsweredBy: ALICE })));   // the answer names its own hand
    await assertFails(updateDoc(doc(db(BOB), 'pulses', 'offerCare1'), answer('declined')));                                  // and must name it
    await assertSucceeds(updateDoc(doc(db(BOB), 'pulses', 'offerCare1'), answer('declined', { offeringAnsweredBy: BOB })));
    // the vision's author declines the code offering; its offerer and a stranger cannot
    await assertFails(updateDoc(doc(db(BOB), 'pulses', 'offerCode1'), answer('declined', { offeringAnsweredBy: BOB })));
    await assertFails(updateDoc(doc(db(MALLORY), 'pulses', 'offerCode1'), answer('declined', { offeringAnsweredBy: MALLORY })));
    await assertSucceeds(updateDoc(doc(db(ALICE), 'pulses', 'offerCode1'), answer('declined', { offeringAnsweredBy: ALICE })));
  });

  it("a co-owner of the tree stands for it too", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'links', `${MALLORY}__co_owner__treeB`), { from: MALLORY, rel: 'co_owner', to: 'treeB' });
    });
    await assertSucceeds(updateDoc(doc(db(MALLORY), 'pulses', 'offerCare1'), answer('declined', { offeringAnsweredBy: MALLORY })));
  });

  it('acceptance is never a client write — not by the receiver, not by the author (staff keeps its mending hand, by role)', async () => {
    await assertFails(updateDoc(doc(db(BOB), 'pulses', 'offerCare1'), answer('accepted', { offeringAnsweredBy: BOB })));
    await assertFails(updateDoc(doc(db(ALICE), 'pulses', 'offerCare1'), answer('accepted')));
  });

  it('once accepted, the agreed words stand — the author may no longer retell it', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'pulses', 'offerCare1'), { offeringStatus: 'accepted' });
    });
    await assertFails(updateDoc(doc(db(ALICE), 'pulses', 'offerCare1'), { title: 'A different song', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(ALICE), 'pulses', 'offerCare1'), answer('withdrawn')));
    await assertSucceeds(updateDoc(doc(db(ALICE), 'pulses', 'offer1'), { title: 'A longer herbal walk', updatedAt: serverTimestamp() })); // a listing still may
  });
});

describe('watering pulses — the light-mint trust root (server-mediated; Lumo review 2026-07-20)', () => {
  // treeB is owned by BOB (a carer). ALICE/MALLORY are not carers of it.
  const water = (over: Record<string, any> = {}) => ({
    type: 'tree_growth', care: 'watering', lifetreeId: 'treeB', authorId: BOB,
    title: 'W', body: 'w', wateringConfirmedBy: 'pending', createdAt: 1, ...over,
  });

  it('a CARER authors their OWN watering; a non-carer cannot, and authorId is bound to the author', async () => {
    await assertSucceeds(setDoc(doc(db(BOB), 'pulses', 'w1'), water()));                       // owner = carer, own author
    await assertFails(setDoc(doc(db(MALLORY), 'pulses', 'w2'), water({ authorId: MALLORY })));  // not a carer of treeB
    await assertFails(setDoc(doc(db(BOB), 'pulses', 'w3'), water({ authorId: ALICE })));        // author must be the writer
  });

  it('no client may self-declare a guardian witness at creation (that is the callable\'s job)', async () => {
    await assertFails(setDoc(doc(db(BOB), 'pulses', 'w4'), water({ wateringConfirmedBy: 'guardian' })));
    await assertSucceeds(setDoc(doc(db(BOB), 'pulses', 'w5'), water({ wateringConfirmedBy: 'ai' }))); // AI hint is validation-only
  });

  it('confirmation is SERVER-ONLY: no client — not even a carer — may write wateringConfirmedBy / wateringConfirmation', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'pulses', 'w6'), water()));
    await assertFails(updateDoc(doc(db(BOB), 'pulses', 'w6'), { wateringConfirmedBy: 'guardian', wateringConfirmation: { confirmedByUid: BOB }, updatedAt: 2 }));
    await assertFails(updateDoc(doc(db(MALLORY), 'pulses', 'w6'), { wateringConfirmedBy: 'guardian', updatedAt: 2 }));
  });
});

describe('domain verification — server-observed truth, no client hand', () => {
  it('even the keeper cannot write the verification mark', async () => {
    await assertFails(updateDoc(doc(db(ALICE), 'communities', 'com1'), {
      domainVerification: { domain: 'lightseed.online', method: 'dns_txt' },
    }));
  });

  it('the keeper still edits ordinary fields freely', async () => {
    await assertSucceeds(updateDoc(doc(db(ALICE), 'communities', 'com1'), {
      description: 'still ours to tend',
    }));
  });

  it('challenges are no one\'s to read or forge', async () => {
    await assertFails(getDoc(doc(db(ALICE), 'domainChallenges', 'com1')));
    await assertFails(setDoc(doc(db(ALICE), 'domainChallenges', 'com1'), { token: 'forged' }));
    await assertFails(getDoc(doc(db(), 'domainChallenges', 'com1')));
  });
});

describe('circle graduation — the forming stamp is the server\'s alone', () => {
  it('even the keeper cannot stamp formedAt/formedBy by hand', async () => {
    await assertFails(updateDoc(doc(db(ALICE), 'communities', 'com1'), {
      formedAt: serverTimestamp(), formedBy: ALICE,
    }));
    await assertFails(updateDoc(doc(db(ALICE), 'communities', 'com1'), { bornOn: 'perauset.web.app' }));
  });
});

describe('tree circle invitations — the circle reads its ledger, carers open the open layer, marks are one-way', () => {
  const CAROL = 'carol-uid';
  const link = (from: string, rel: string, to: string, extra: object = {}) =>
    ({ lid: 'x', type: 'link', rel, from, to, ...extra, createdAt: 1 });
  const invite = (extra: object) => ({
    lifetreeId: 'treeB', lifetreeName: 'Bobs tree', invitedByUserId: BOB, invitedByName: 'Bob',
    invitedUserId: MALLORY, role: 'guardian', status: 'pending', message: '', createdAt: 1, updatedAt: 1, ...extra,
  });

  // treeB is BOB's (seeded above); ALICE cares beside him as a co_owner.
  const seedTreeInvites = () => env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'links', `${ALICE}__co_owner__treeB`), link(ALICE, 'co_owner', 'treeB'));
    await setDoc(doc(d, 'treeOwnershipInvites', 'tinv-owner-1'), invite({}));
    await setDoc(doc(d, 'treeOwnershipInvites', 'tinv-staff-1'), invite({ invitedByUserId: STAFF, invitedByName: 'Staff', invitedUserId: CAROL, role: 'co_owner' }));
    await setDoc(doc(d, 'treeOwnershipInvites', 'tinv-done-1'), invite({ invitedUserId: 'dan-uid', status: 'accepted' }));
  });
  const byTree = (uid: string) => getDocs(query(collection(db(uid), 'treeOwnershipInvites'), where('lifetreeId', '==', 'treeB')));

  it('the ledger (list by tree) belongs to the carers — owner and co_owner alike, staff-sent invitations included', async () => {
    await seedTreeInvites();
    await assertSucceeds(byTree(BOB));
    await assertSucceeds(byTree(ALICE));
    await assertSucceeds(byTree(STAFF));
    await assertFails(byTree(MALLORY));   // an invitee is not a carer: no ledger
    await assertFails(byTree(CAROL));
  });

  it('an invitee lists and reads their own; a carer reads a single invitation of the tree; a stranger reads nothing', async () => {
    await seedTreeInvites();
    await assertSucceeds(getDocs(query(collection(db(MALLORY), 'treeOwnershipInvites'), where('invitedUserId', '==', MALLORY))));
    await assertSucceeds(getDoc(doc(db(MALLORY), 'treeOwnershipInvites', 'tinv-owner-1')));
    await assertSucceeds(getDoc(doc(db(ALICE), 'treeOwnershipInvites', 'tinv-staff-1')));   // co_owner, neither inviter nor invitee
    await assertFails(getDoc(doc(db(MALLORY), 'treeOwnershipInvites', 'tinv-staff-1')));   // someone else's invitation
    await assertFails(getDoc(doc(db(), 'treeOwnershipInvites', 'tinv-owner-1')));           // signed out
  });

  it('the owner invites any role; a co_owner opens only the open layer; a stranger, a forged inviter or a non-pending birth are refused', async () => {
    await seedTreeInvites();
    await assertSucceeds(setDoc(doc(db(BOB), 'treeOwnershipInvites', 'tinv-new-owner'), invite({ invitedUserId: CAROL, role: 'co_owner' })));
    await assertSucceeds(setDoc(doc(db(ALICE), 'treeOwnershipInvites', 'tinv-new-guard'), invite({ invitedByUserId: ALICE, invitedUserId: CAROL, role: 'guardian' })));
    await assertSucceeds(setDoc(doc(db(ALICE), 'treeOwnershipInvites', 'tinv-new-obsrv'), invite({ invitedByUserId: ALICE, invitedUserId: CAROL, role: 'observer' })));
    await assertFails(setDoc(doc(db(ALICE), 'treeOwnershipInvites', 'tinv-new-coown'), invite({ invitedByUserId: ALICE, invitedUserId: CAROL, role: 'co_owner' })));
    await assertFails(setDoc(doc(db(ALICE), 'treeOwnershipInvites', 'tinv-new-stewd'), invite({ invitedByUserId: ALICE, invitedUserId: CAROL, role: 'steward' })));
    await assertFails(setDoc(doc(db(MALLORY), 'treeOwnershipInvites', 'tinv-new-mally'), invite({ invitedByUserId: MALLORY, invitedUserId: CAROL })));
    await assertFails(setDoc(doc(db(BOB), 'treeOwnershipInvites', 'tinv-new-forge'), invite({ invitedByUserId: ALICE, invitedUserId: CAROL })));
    await assertFails(setDoc(doc(db(BOB), 'treeOwnershipInvites', 'tinv-new-accpt'), invite({ invitedUserId: CAROL, status: 'accepted' })));
  });

  it('the invitee declines (never revokes); the inviter or the owner withdraws (never declines); only pending moves, and only its marks', async () => {
    await seedTreeInvites();
    const decline = { status: 'declined', declinedAt: serverTimestamp(), updatedAt: serverTimestamp() };
    const revoke = { status: 'revoked', revokedAt: serverTimestamp(), updatedAt: serverTimestamp() };
    await assertFails(updateDoc(doc(db(MALLORY), 'treeOwnershipInvites', 'tinv-owner-1'), revoke));    // the invitee cannot revoke
    await assertFails(updateDoc(doc(db(BOB), 'treeOwnershipInvites', 'tinv-owner-1'), decline));       // the inviter cannot decline
    await assertFails(updateDoc(doc(db(ALICE), 'treeOwnershipInvites', 'tinv-owner-1'), revoke));      // a co_owner who did not invite
    await assertFails(updateDoc(doc(db(BOB), 'treeOwnershipInvites', 'tinv-owner-1'), { ...revoke, role: 'co_owner' })); // touching more than the marks
    await assertFails(updateDoc(doc(db(BOB), 'treeOwnershipInvites', 'tinv-done-1'), revoke));         // accepted: settled, immovable
    await assertSucceeds(updateDoc(doc(db(BOB), 'treeOwnershipInvites', 'tinv-staff-1'), revoke));     // the owner withdraws any invitation on their tree
    await assertSucceeds(updateDoc(doc(db(MALLORY), 'treeOwnershipInvites', 'tinv-owner-1'), decline));
    await assertFails(updateDoc(doc(db(BOB), 'treeOwnershipInvites', 'tinv-owner-1'), { status: 'pending', updatedAt: serverTimestamp() })); // one-way
  });
});
