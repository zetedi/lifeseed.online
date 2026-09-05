import { canonicalize } from './chain/canonical';
import { sha256 } from './chain/hash';
import { isLid } from './dataAuthority';
import { COLLECTION_FOR_KIND, entryFor, type BeingEntry } from './beingIndex';

// THE BUNDLE LAW (ring 2026-08-15) — how a whole node travels. A node multiplies WITH its
// charter or it is just a backup: the bundle's HEAD is the charter manifest (the nodeLid,
// the hashed root promise, the genesis constants), and its BODY is every collection the
// TRAVEL PLAN names — the complete, explicit answer to "what travels, what is rebuilt,
// what is re-sworn, what deliberately stays behind". Silent omission is data loss wearing
// a green checkmark; this law makes every omission LOUD (an excluded collection carries
// its reason, and a doc from one found inside a bundle is a violation, not a bonus).
//
// Plain contract — guaranteed now: a bundle verified by verifyBundle() carries exactly the
// collections the plan names, unaltered since export (per-doc content hashes, per-collection
// census digests, a manifest hash over the head); deterministic ids travel verbatim (the
// permission model RESOLVES BY PATH: links from__rel__to, rays treeId__dayKey__role, loves
// and signature slots keyed by uid); local-auth identity is MARKED, never laundered
// (localUidCensus lists every uid a restore must re-anchor); the custodian's SEAL over the
// manifest verifies against a key anchored OUTSIDE the bundle (verifyBundleSeal — a
// signature checked only against material inside the thing it seals would be circular).
// Not guaranteed yet: Storage files (docs carry absolute bucket URLs — a named debt; new
// media already files under the portable beings/{lid}/ names); uid re-anchoring itself
// (the census is the worklist, the ceremony is human); the custodian's JUDGMENT (no
// cryptography signs for trust in the signer — the ledger's sponsorship does that).
// Enforced by: this module's laws, tests/bundle.test.ts
// (including the rules-mirror completeness test), and the Crossing suite's live round-trip.

export const BUNDLE_FORMAT_VERSION = 1 as const;

// Chain roots that are NOT another block's hash — a pulse whose previousHash is one of
// these is its own beginning (person-reaches and standalone records), never a broken link.
// Mirrored from the services' sentinels; the bundle test greps them true.
export const NON_CHAIN_ROOTS = new Set(['0', 'PERSON_REACH', 'DECISION', 'EVENT', 'OFFERING', 'COMMUNITY_EVENT', 'WATER_ALERT', 'OFFER_NOTICE', 'LIGHT_HOUSE']);

// ── The travel plan ─────────────────────────────────────────────────────────────────────
// One rule per collection signature. `path` uses '*' for id segments ('lifetrees/*/loves');
// a rule with a LITERAL doc segment ('config/dataAuthority') binds that one doc and wins
// over its collection's rule. Modes:
//   verbatim — travels whole, ids preserved byte-for-byte;
//   witness  — travels for comparison but is REBUILT on the far side, never trusted
//              (beings: rebuilt from the six kind collections; initiates: git is truth);
//   excluded — never enters a bundle, and the reason says why out loud.
// `idIsLocalUid` marks id segments that are Firebase-Auth uids (mortal, local);
// `localUidFields` marks uid-bearing fields — TOGETHER they feed the re-anchoring census.
// The field lists are the tested worklist, not a claim of exhaustiveness for nested shapes
// (wateringConfirmation.confirmedByUid travels inside its doc either way).
export type TravelMode = 'verbatim' | 'witness' | 'excluded';

export interface TravelRule {
  path: string;
  mode: TravelMode;
  reason?: string;               // required prose for witness/excluded — the omission said out loud
  idIsLocalUid?: boolean;        // the doc ID ITSELF is (or embeds) a local auth uid
  localUidFields?: string[];     // top-level fields carrying local auth uids
  deterministicIds?: string;     // the formula ids must satisfy verbatim, as documentation
}

export const TRAVEL_PLAN: readonly TravelRule[] = [
  // Identity & custody
  { path: 'users', mode: 'verbatim', idIsLocalUid: true },
  { path: 'users/*/pushSubscriptions', mode: 'excluded', reason: "a device's push endpoint binds to this node's VAPID key and a browser session; the far node knocks with its own key, so a being re-allows there" },
  { path: 'persons', mode: 'verbatim', idIsLocalUid: true },
  { path: 'persons/*/keys', mode: 'verbatim', deterministicIds: 'sha256 fingerprint of the pubkey' },
  { path: 'persons/*/keyEvents', mode: 'verbatim', deterministicIds: 'anchor_<fp> | freeze_<epochId> | rotation/recovery event ids' },
  { path: 'persons/*/keyRecoveries', mode: 'verbatim', deterministicIds: 'recovery event id' },
  { path: 'persons/*/keyRecoveries/*/witnesses', mode: 'verbatim', idIsLocalUid: true, deterministicIds: 'witnessUid__epochId' },
  { path: 'admins', mode: 'verbatim', idIsLocalUid: true, reason: 'staff grants are uid-keyed; they travel as data but bind only after re-anchoring' },
  { path: 'config', mode: 'verbatim', localUidFields: ['uid'] }, // limits, superadmin (uid is LOCAL), newsletter
  { path: 'config/dataAuthority', mode: 'excluded', reason: 'custody is re-SWORN through the create-once ceremony, never copied — the head carries the nodeLid claim' },
  { path: 'config/emulatorSeed', mode: 'excluded', reason: 'dev-only seed marker' },
  { path: 'beings', mode: 'witness', reason: 'the lid index is rebuilt from the six kind collections on the far side and compared against this witness — the map is never imported as the territory' },
  { path: 'initiates', mode: 'witness', reason: 'git (initiations/) is the source of truth; the mirror is re-synced, and this witness only proves the two agreed at export' },

  // The living beings and their chains
  // validatorId is DUAL-TYPED (staff/initiates sign as their uid; peers sign as their
  // validated TREE's id — the Grove proved a tree id lands there), so it stays OUT of the
  // automatic uid census: re-anchoring inspects it by hand.
  { path: 'lifetrees', mode: 'verbatim', localUidFields: ['ownerId'] },
  { path: 'lifetrees/*/loves', mode: 'verbatim', idIsLocalUid: true, localUidFields: ['uid'] },
  { path: 'lifetrees/*/occupancy', mode: 'verbatim', deterministicIds: 'the stays/{stayId} doc id it mirrors' },
  { path: 'lifetrees/*/holds', mode: 'excluded', reason: 'ephemeral soft locks (TTL ~2min); a hold has no meaning on a node that did not see the intent' },
  { path: 'visions', mode: 'verbatim', localUidFields: ['authorId'] },
  { path: 'visions/*/loves', mode: 'verbatim', idIsLocalUid: true, localUidFields: ['uid'] },
  { path: 'pulses', mode: 'verbatim', localUidFields: ['authorId', 'recipientUid', 'participantUids', 'seenBy', 'vetoes', 'proposedBy'] },
  { path: 'pulses/*/loves', mode: 'verbatim', idIsLocalUid: true, localUidFields: ['uid'] },
  { path: 'pulses/*/signatures', mode: 'verbatim', idIsLocalUid: true, deterministicIds: 'signer uid — the doc id IS the signer claim' },
  { path: 'pulses/*/witnesses', mode: 'verbatim', idIsLocalUid: true, localUidFields: ['uid'], deterministicIds: 'witness uid — the body carries the LID, the true name that survives the crossing' },
  { path: 'covenants', mode: 'verbatim', localUidFields: ['proposedBy'] },
  { path: 'covenants/*/signatures', mode: 'verbatim', idIsLocalUid: true, deterministicIds: 'party uid; carries the pinned pubkey for portable verification' },
  { path: 'communities', mode: 'verbatim', localUidFields: ['ownerId', 'founderUserId'] },
  { path: 'communities/*/loves', mode: 'verbatim', idIsLocalUid: true, localUidFields: ['uid'] },
  { path: 'lightHouses', mode: 'verbatim', localUidFields: ['ownerId'] },
  { path: 'lightHouses/*/loves', mode: 'verbatim', idIsLocalUid: true, localUidFields: ['uid'] },

  // The graph
  { path: 'links', mode: 'verbatim', localUidFields: ['from'], deterministicIds: 'from__rel__to — authority resolves by exists() on this exact path; re-keying = everyone silently loses every role. from is usually a uid, with tree, lightHouse and inter-community exceptions — see linkFromIsUid' },
  { path: 'alignments', mode: 'verbatim', localUidFields: ['initiatorUid', 'targetUid'] },

  // Light & the care economy
  { path: 'rays', mode: 'verbatim', localUidFields: ['holderUid', 'sourceUid'], deterministicIds: 'treeId__dayKey__carer|witness — the once-per-day law lives in the id' },
  { path: 'glow', mode: 'verbatim', deterministicIds: 'communityId, or the NODE sentinel' },
  { path: 'stays', mode: 'verbatim', localUidFields: ['uid', 'hostUid'] },
  { path: 'supports', mode: 'verbatim' }, // rules-declared, no shipped writer — no field names to claim yet

  // Doors & invitations (auto-ids that ARE unguessable keys — preserved verbatim)
  { path: 'networkInvites', mode: 'verbatim', localUidFields: ['invitedByUserId', 'acceptedByUserId'], deterministicIds: 'auto-id used as the invitation token' },
  { path: 'communityInvites', mode: 'verbatim', localUidFields: ['createdBy'], deterministicIds: 'auto-id used as the shareable /i/<id> key' },
  { path: 'communityTreeInvites', mode: 'verbatim', localUidFields: ['invitedByUserId', 'invitedUserId', 'treeOwnerId'] },
  { path: 'communityKeeperInvites', mode: 'verbatim', localUidFields: ['invitedByUserId', 'invitedUserId'] },
  { path: 'treeOwnershipInvites', mode: 'verbatim', localUidFields: ['invitedByUserId', 'invitedUserId'] },
  { path: 'inviteRequests', mode: 'verbatim' },

  // Node fabric
  { path: 'collabs', mode: 'verbatim', localUidFields: ['createdBy'] },
  { path: 'intelligences', mode: 'verbatim', localUidFields: ['ownerId', 'credentialOwnerId'] },
  { path: 'personas', mode: 'verbatim' }, // createPersona writes no owner field (verified 2026-08-15)
  { path: 'memories', mode: 'verbatim' }, // createMemory writes no owner field (verified 2026-08-15)
  { path: 'subscriptions', mode: 'verbatim', deterministicIds: 'encodeURIComponent(email) — prototype-unsafe keys; never load into plain objects keyed by id' },

  // Deliberately left behind
  { path: 'providerCredentials', mode: 'excluded', reason: 'plaintext third-party API keys — exporting them is a secret leak; the new node re-enrolls' },
  { path: 'mail', mode: 'excluded', reason: 'server mail queue — re-importing re-SENDS every letter through the mail extension' },
  { path: 'mailThrottle', mode: 'excluded', reason: 'transient send-rate ledger (no rules block — server-only); meaningless off its node' },
  { path: 'usage', mode: 'excluded', reason: 'daily AI/mail counters — quota history is not identity' },
  { path: 'domainChallenges', mode: 'excluded', reason: 'single-use DNS control tokens — a challenge proves nothing beyond its week, and a new node mints its own; the observed mark travels ON the community doc' },
];

// The rels whose link.from is NOT a person uid: tree, Light House, and community edges.
export const linkFromIsUid = (rel: string): boolean =>
  ![
    'participant', 'rooted', 'shelters', 'grows_in',
    'collaborates_with', 'recognises', 'shares_resources_with',
  ].includes(rel);

// ── Path matching ───────────────────────────────────────────────────────────────────────
// A doc path alternates collection/id segments: 'lifetrees/abc/loves/u1'. Its collection
// signature replaces ids with '*': 'lifetrees/*/loves'. A literal doc rule (even segment
// count, no '*') matches the full path exactly and wins.
export const collectionSignature = (docPath: string): string => {
  const segs = docPath.split('/');
  return segs.filter((_, i) => i % 2 === 0).join('/*/').replace(/\/\*\/$/, '');
};

export const travelRuleFor = (docPath: string): TravelRule | null => {
  const literal = TRAVEL_PLAN.find(r => r.path.split('/').length % 2 === 0 && r.path === docPath);
  if (literal) return literal;
  const sig = collectionSignature(docPath);
  return TRAVEL_PLAN.find(r => r.path === sig) ?? null;
};

// ── Docs, hashes, census ────────────────────────────────────────────────────────────────
export interface BundleDoc {
  path: string;                    // 'lifetrees/abc' | 'lifetrees/abc/loves/u1' …
  data: Record<string, unknown>;   // stamps welcome — canonicalize speaks toMillis
}

const HASH_DOMAIN = 'lightseed.bundle.v1';

// The doc's traveling identity: path AND content, canonically — moving a doc to another id
// is tampering even when the bytes inside agree. The path is JSON-quoted in the preimage:
// Firestore ids may contain '|', and a bare separator would let two (path, data) pairs
// share one preimage (found by this law's own adversarial pass, 2026-08-15).
export const docContentHash = (doc: BundleDoc): Promise<string> =>
  sha256(`${HASH_DOMAIN}|${JSON.stringify(doc.path)}|${canonicalize(doc.data)}`);

export interface CollectionCensus {
  path: string;    // the travel-plan signature
  count: number;
  digest: string;  // sha256 over the SORTED doc hashes — order-free, tamper-evident
}

export const buildCensus = async (docs: BundleDoc[]): Promise<CollectionCensus[]> => {
  const groups = new Map<string, string[]>();
  for (const doc of docs) {
    const rule = travelRuleFor(doc.path);
    const key = rule ? rule.path : collectionSignature(doc.path);
    const hash = await docContentHash(doc);
    const list = groups.get(key) ?? [];
    list.push(hash);
    groups.set(key, list);
  }
  const census: CollectionCensus[] = [];
  for (const [path, hashes] of [...groups.entries()].sort(([a], [b]) => a < b ? -1 : 1)) {
    census.push({ path, count: hashes.length, digest: await sha256(hashes.sort().join('\n')) });
  }
  return census;
};

// ── The charter head ────────────────────────────────────────────────────────────────────
export interface CharterHead {
  formatVersion: typeof BUNDLE_FORMAT_VERSION;
  nodeLid: string;                 // the custody claim — re-sworn on the far side, never copied
  domain: string;
  exportedAtMs: number;
  exportCommit: string;            // the git commit whose root/ the charter hashes bind
  charterHashes: { genesisMd: string; linMd: string };
  genesisTree: { docId: string; lid: string; genesisHash: string; latestHash: string; blockHeight: number } | null;
  census: CollectionCensus[];
}

export interface NodeBundle {
  head: CharterHead;
  manifestHash: string;            // sha256 over the head — the seal's preimage
  seal?: { fingerprint: string; signature: string }; // the custodian's signature (coming rung)
  docs: BundleDoc[];
}

export const manifestHashOf = (head: CharterHead): Promise<string> =>
  sha256(`${HASH_DOMAIN}|manifest|${canonicalize(head)}`);

// ── The custodian's seal (ring 2026-08-24) ──────────────────────────────────────────────
// One human signature over the manifest hash: the bundle's PROVENANCE, where the hashes
// alone are only its CONSISTENCY (consistency can be recomputed by anyone holding the
// data; authorship cannot). The signing hand is services/keys.sign with this tag — the
// same Ed25519 rail as covenant seals, its own domain tag so a bundle seal can never be
// replayed as any other signature. Verification takes the custodian's key as an ANCHOR
// resolved OUTSIDE the bundle (the initiations git ledger first, the living origin node
// and the receiving node's own pinned config as witnesses) — the key lineage inside the
// bundle can never vouch for the bundle that carries it.
export const BUNDLE_SEAL_TAG = 'lightseed.bundle.manifest.v1';

// The key the verifier trusts, resolved out-of-band. fingerprint = sha256(publicKeyB64)
// (the persons/keys doc-id law).
export interface BundleSealAnchor { fingerprint: string; publicKeyB64: string }

export type SealIssueCode = 'seal_missing' | 'seal_key_unanchored' | 'seal_invalid';

// Injected Ed25519 verifier (services/signingCrypto.verifyPayload in production) — the
// covenant law's exact pattern, so this module stays pure and unit-testable.
export type SealVerifier = (
  publicKeyB64: string,
  signatureB64: string,
  payload: unknown,
  domainTag: string,
) => Promise<boolean>;

// The whole seal verdict: null = the custodian's hand, proven against the anchor.
export async function verifyBundleSeal(
  bundle: Pick<NodeBundle, 'manifestHash' | 'seal'>,
  anchor: BundleSealAnchor,
  verify: SealVerifier,
): Promise<SealIssueCode | null> {
  if (!bundle.seal) return 'seal_missing';
  // The claimed key must BE the anchored key — a stranger shipping their own (valid!)
  // signature under their own fingerprint is refused before any cryptography runs.
  if (bundle.seal.fingerprint !== anchor.fingerprint) return 'seal_key_unanchored';
  return (await verify(anchor.publicKeyB64, bundle.seal.signature, bundle.manifestHash, BUNDLE_SEAL_TAG))
    ? null : 'seal_invalid';
}

// ── Verification ────────────────────────────────────────────────────────────────────────
export type BundleIssueCode =
  | 'unknown_format' | 'bad_node_lid' | 'manifest_mismatch'
  | 'unknown_collection' | 'plan_violation' | 'duplicate_path'
  | 'census_missing' | 'census_count' | 'census_digest' | 'census_extra'
  | 'charter_drift' | 'chain_break' | 'index_missing' | 'index_disagrees';

export interface BundleIssue { code: BundleIssueCode; path?: string; detail?: string }
export interface BundleVerdict { ok: boolean; issues: BundleIssue[] }

// Structural truth of a bundle in the hand: format known, custody claim well-formed, head
// unaltered, every doc inside the plan and no doc from behind the fence, census exact.
export const verifyBundle = async (bundle: NodeBundle): Promise<BundleVerdict> => {
  const issues: BundleIssue[] = [];
  if (bundle.head.formatVersion !== BUNDLE_FORMAT_VERSION) {
    issues.push({ code: 'unknown_format', detail: String(bundle.head.formatVersion) });
    return { ok: false, issues }; // an unknown format's other laws are unknowable
  }
  if (!isLid(bundle.head.nodeLid)) issues.push({ code: 'bad_node_lid', detail: bundle.head.nodeLid });
  if (await manifestHashOf(bundle.head) !== bundle.manifestHash) issues.push({ code: 'manifest_mismatch' });

  const seenPaths = new Set<string>();
  for (const doc of bundle.docs) {
    // One path, one doc: a duplicate would census as two but restore as one — the count
    // would lie in the direction restore cannot see.
    if (seenPaths.has(doc.path)) issues.push({ code: 'duplicate_path', path: doc.path });
    seenPaths.add(doc.path);
    const rule = travelRuleFor(doc.path);
    if (!rule) { issues.push({ code: 'unknown_collection', path: doc.path }); continue; }
    if (rule.mode === 'excluded') issues.push({ code: 'plan_violation', path: doc.path, detail: rule.reason });
  }

  const actual = await buildCensus(bundle.docs);
  const claimed = new Map(bundle.head.census.map(c => [c.path, c]));
  for (const a of actual) {
    const c = claimed.get(a.path);
    if (!c) { issues.push({ code: 'census_missing', path: a.path }); continue; }
    if (c.count !== a.count) issues.push({ code: 'census_count', path: a.path, detail: `${c.count} claimed, ${a.count} carried` });
    else if (c.digest !== a.digest) issues.push({ code: 'census_digest', path: a.path });
    claimed.delete(a.path);
  }
  for (const path of claimed.keys()) issues.push({ code: 'census_extra', path, detail: 'claimed by the head, absent from the body' });

  // The head's genesis constants must agree with the carried GENESIS_TREE (charter drift).
  const genesis = bundle.docs.find(d => d.path === 'lifetrees/GENESIS_TREE');
  if (genesis && bundle.head.genesisTree) {
    const g = bundle.head.genesisTree;
    const t = genesis.data as Record<string, unknown>;
    if (g.lid !== t.lid || g.genesisHash !== t.genesisHash || g.latestHash !== t.latestHash || g.blockHeight !== t.blockHeight) {
      issues.push({ code: 'charter_drift', path: 'lifetrees/GENESIS_TREE' });
    }
  }

  issues.push(...chainClosureIssues(bundle.docs));
  return { ok: issues.length === 0, issues };
};

// ── Chain closure ───────────────────────────────────────────────────────────────────────
// No block may point at a predecessor the bundle does not carry: previousHash must be a
// carried block's hash, a carried head's genesisHash (the first block after a genesis), or
// a NON_CHAIN_ROOTS sentinel. A filtered export severs previousHash for everything after —
// this is the law that makes that loud. (Heads ahead of stored blocks — the careForTree
// ghost step — are a named debt of the CHAIN, not a bundle break: closure judges only the
// blocks that exist.)
export const chainClosureIssues = (docs: BundleDoc[]): BundleIssue[] => {
  const carriedHashes = new Set<string>();
  const genesisRoots = new Set<string>();
  for (const d of docs) {
    const sig = collectionSignature(d.path);
    if (sig === 'pulses' && typeof d.data.hash === 'string') carriedHashes.add(d.data.hash);
    if ((sig === 'lifetrees' || sig === 'visions') && typeof d.data.genesisHash === 'string') genesisRoots.add(d.data.genesisHash);
  }
  const issues: BundleIssue[] = [];
  for (const d of docs) {
    if (collectionSignature(d.path) !== 'pulses') continue;
    const prev = d.data.previousHash;
    if (typeof prev !== 'string' || NON_CHAIN_ROOTS.has(prev)) continue;
    if (!carriedHashes.has(prev) && !genesisRoots.has(prev)) {
      issues.push({ code: 'chain_break', path: d.path, detail: `previousHash ${prev.slice(0, 12)}… is not carried` });
    }
  }
  return issues;
};

// ── The beings index, rebuilt and compared ──────────────────────────────────────────────
// The far side REBUILDS beings/{lid} from the six kind collections (the map is never
// imported as the territory); the carried index is only a witness. This law computes the
// expected index from a bundle's body and names every disagreement with the witness.
export const expectedBeingsIndex = (docs: BundleDoc[]): BeingEntry[] => {
  const byCollection = new Map(Object.entries(COLLECTION_FOR_KIND).map(([, coll]) => [coll, true]));
  const entries: BeingEntry[] = [];
  for (const d of docs) {
    const segs = d.path.split('/');
    if (segs.length !== 2 || !byCollection.has(segs[0])) continue;
    const entry = entryFor(segs[0], segs[1], d.data.lid);
    if (entry) entries.push(entry);
  }
  return entries;
};

export const beingsIndexIssues = (docs: BundleDoc[]): BundleIssue[] => {
  const witness = new Map<string, Record<string, unknown>>();
  for (const d of docs) {
    if (collectionSignature(d.path) === 'beings') witness.set(d.path.split('/')[1], d.data);
  }
  const issues: BundleIssue[] = [];
  for (const e of expectedBeingsIndex(docs)) {
    const w = witness.get(e.lid);
    if (!w) { issues.push({ code: 'index_missing', path: `beings/${e.lid}`, detail: `${e.collection}/${e.docId} carries a lid the witness index never recorded` }); continue; }
    if (w.collection !== e.collection || w.docId !== e.docId) {
      issues.push({ code: 'index_disagrees', path: `beings/${e.lid}`, detail: `witness says ${w.collection}/${w.docId}, body says ${e.collection}/${e.docId}` });
    }
  }
  return issues;
};

// ── The re-anchoring census ─────────────────────────────────────────────────────────────
// Every local auth uid the bundle touches — from marked fields, uid-keyed doc ids, and the
// graph's person edges. This is the restore ceremony's WORKLIST: lids are forever, uids die
// with their auth project, and no uid may cross silently.
// 'departed' is the purge flow's tombstone (functions purgeUserData rewrites sourceUid to
// it) — a mark of absence, never a person to re-anchor.
const NOT_A_PERSON = new Set(['departed', 'GENESIS_SYSTEM']);

export const localUidCensus = (docs: BundleDoc[]): string[] => {
  const uids = new Set<string>();
  const note = (v: unknown) => {
    if (typeof v === 'string' && v.length > 0 && !NOT_A_PERSON.has(v)) uids.add(v);
    else if (Array.isArray(v)) for (const x of v) note(x);
  };
  for (const d of docs) {
    const rule = travelRuleFor(d.path);
    if (!rule || rule.mode === 'excluded') continue;
    const segs = d.path.split('/');
    // Walk every id segment: the ANCESTOR's rule says whether that segment is a uid
    // (a witnesses doc carries three ids — persons/{uid}, the recovery event, and its own
    // witnessUid__epochId — and only the rules of those prefixes know which are mortal).
    for (let i = 1; i < segs.length; i += 2) {
      const prefixRule = travelRuleFor(segs.slice(0, i + 1).join('/'));
      if (prefixRule?.idIsLocalUid) note(segs[i].split('__')[0]); // witnessUid__epochId keeps its uid half
    }
    if (collectionSignature(d.path) === 'links') {
      if (typeof d.data.rel === 'string' && linkFromIsUid(d.data.rel)) note(d.data.from);
      continue; // 'from' handled by rel; 'to' is never a person
    }
    for (const f of rule.localUidFields ?? []) note(d.data[f]);
  }
  return [...uids].sort();
};
