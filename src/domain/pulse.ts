import type { Stamp } from './time';
import type { Being } from './being';
import type { ReachAudience } from './reach';

// Canonical pulse types are explicit lowercase tokens. Casing/identity previously encoded
// meaning (a footgun): 'GROWTH' = a tree's growth, lowercase 'growth' = a VISION's growth,
// 'STANDARD' = an alignment pulse. We give each a distinct canonical name so NOTHING is
// ambiguous (crucially, tree growth is 'tree_growth', NOT the old lowercase 'growth'):
//   tree growth   → 'tree_growth'   (legacy 'GROWTH')
//   vision growth → 'vision_growth' (legacy lowercase 'growth')
//   alignment     → 'standard'      (legacy 'STANDARD')
// Legacy values are converted at the repository boundary (normalizePulseType) and migrated once
// (migratePulseTypeCasing). New writes are always canonical. Because tree growth no longer uses
// the token 'growth', the migration of old 'growth'→'vision_growth' can never touch a new write.
export type LegacyPulseType = 'STANDARD' | 'GROWTH';
export type PulseType = 'observation' | 'dream' | 'offering' | 'request' | 'translation' | 'validation' | 'event' | 'tree_growth' | 'vision_growth' | 'standard' | 'reach';

// Convert a stored `type` to its canonical form. Unambiguous in every window: 'GROWTH' is always
// tree growth, lowercase 'growth' is always (old) vision growth — tree growth never used 'growth'.
export const normalizePulseType = (t?: string): PulseType => {
  switch (t) {
    case 'GROWTH': return 'tree_growth';
    case 'growth': return 'vision_growth';
    case 'STANDARD': return 'standard';
    default: return (t || 'observation') as PulseType;
  }
};

// True for a tree growth pulse (tolerates the legacy 'GROWTH').
export const isTreeGrowth = (t?: string): boolean => normalizePulseType(t) === 'tree_growth';

// Who may see a pulse, relative to where it is rooted (its scope: tree / community / node).
// 'public' = anyone; 'node' = any signed-in member; 'community' = members of its community;
// 'circle' = guardians of its tree; 'private' = author (and staff) only. Absence = 'public'.
// The audience is generated and enforced by src/domain/pulseVisibility.ts + Firestore rules.
export type PulseVisibility = 'public' | 'node' | 'community' | 'circle' | 'private';

export interface PulseInterpretation {
    // Context depth the reading drew on (1 message · 2 visions · 3 mints · 4 subgraph).
    depth: number;
    // Provenance — a persisted reading names who read and through which intelligence
    // (the same honesty law as Carry: the words carry their lens).
    readByTreeId?: string;
    readByTreeName?: string;
    intelligenceId?: string;
    intelligenceName?: string;
    readAt?: number; // epoch ms
    // The five distinctions (NVC) — see domain/translation.
    happened?: string;
    feeling?: string;
    inference?: string;
    need?: string;
    asks?: string;
    alternatives?: string[];
    // Legacy single-blob reading (pre-NVC schema) — still rendered on old pulses.
    interpretation?: string;
    confidence?: number;
    growthSuggestion?: string;
}

// The fundamental unit of the network
export interface Pulse extends Being {
  id: string;
  lifetreeId?: string; // canonical — the tree this pulse belongs to
  visionId?: string;
  communityId?: string; // Set on community-scoped pulses (community events, decisions).
  communityName?: string; // Denormalised community name, carried on community events for display.
  domain?: string; // The node this pulse belongs to (multi-node scoping) — written by the event/vision creators.
  type: PulseType;
  // Audience. Absent = 'public' (every legacy pulse reads as public). See PulseVisibility.
  visibility?: PulseVisibility;
  
  // Data Payload
  title: string; // canonical
  body: string;  // canonical
  content?: string;
  imageUrl?: string;
  imageUrls?: string[];
  eventDate?: string;
  eventLocation?: string;
  // The gathering's room: how many trees may stand around this event (unset/null = unbounded).
  eventMaxParticipants?: number | null;
  // Offerings (type 'offering'): a bed or service offered through trust. The author may name a
  // suggested appreciation in light, given AFTER the contribution and never gating access.
  offeringKind?: 'bed' | 'service' | 'code';
  offeringAppreciationLight?: number;
  offeringBedId?: string;
  offeringBedName?: string;
  // The offering's lifecycle switch: absent/true = standing, false = paused by its author
  // (hidden from the shared feed, still theirs to see and rewake). Toggled via its own
  // author-only rules branch; never deleted, the being keeps its history.
  offeringActive?: boolean;
  // An optional door to more detail (the offerer's page, a booking form, a menu); for a CODE
  // offering, the pull request itself.
  offeringUrl?: string;
  // THE OFFERING OF CARE (ring 2026-09-06): an offering made TO a being. Absent = a standalone
  // listing. Born 'open'; withdrawn by its author or declined by the receiver's hand (rules
  // flips); ACCEPTED only by functions/acceptOffering, which mints twin blocks on both chains.
  offeredToKind?: 'tree' | 'vision';
  offeredToId?: string;
  offeredToLid?: string;
  offeredToName?: string;
  offeredToKeeperUid?: string;   // the tree's keeper / the vision's author, for the leaf's eye
  offeringFromTreeId?: string;   // the offerer's own tree, whose chain carries its twin block
  offeringFromTreeName?: string;
  offeringStatus?: 'open' | 'accepted' | 'withdrawn' | 'declined';
  offeringAnsweredBy?: string;
  offeringAnsweredAt?: Stamp;
  offeringAcceptedPulseIds?: { from: string; to: string };
  // The twin blocks themselves (type 'standard'): each names the offering and the other chain.
  offeringId?: string;
  offeringLid?: string;
  offeringRole?: 'from' | 'to';
  offeringTwinOf?: string;
  offeringTwinKind?: 'tree' | 'vision';
  reachTreeId?: string;
  reachTreeName?: string;
  reachResponse?: string; // The reached tree's reply, kept so reach threads persist.
  recipientUid?: string | null; // Owner of the reached tree — drives 1:1 inbox routing + email delivery.
  recipientName?: string;
  seenBy?: string[];
  threadId?: string; // Deterministic id for a reach thread: [fromTreeId, toTreeId].sort().join('__') (1:1) or grp__<treeId>__<audience>__<initiator> (group).
  // Everyone in this reach thread (author + recipients). The single source of truth for
  // who may read/reply — drives both the Firestore read rule and the inbox query. Present
  // on every private reach (1:1 and group); absent on minted, public "reach" reflections.
  participantUids?: string[];
  audience?: ReachAudience; // For group reaches: which slice of the tree's circle was addressed.
  threadName?: string;      // Display name for a group thread, e.g. "Oak · Guardians".
  isGroup?: boolean;        // True for circle/group reaches (a shared, multi-person thread).
  mintNotice?: boolean;     // A system line in a thread announcing someone minted the conversation.
  
  // The guardians' veto (domain/guardianVeto): uids of guardians who vetoed this mint.
  // Consensus semantics are derived, never stored — the chain stays append-only.
  vetoes?: string[];

  // V2 AI
  aiInterpretation?: PulseInterpretation;
  validationScore?: number;

  // Watering / care. A confirmed watering is a growth pulse (type 'growth') carrying the
  // `care: 'watering'` flag, the proof image (imageUrl), and a witness. `careAlert` instead
  // marks a "water me" reach (a DM, not a growth block) so the DM UI can give it a blue
  // border. See src/domain/watering.ts. `care: true` is an explicit lightweight care — a
  // REAL minted block since ring 2026-08-17 (the same shape the healed ghost blocks carry).
  care?: 'watering' | boolean;
  careAlert?: 'watering';
  wateringConfirmedBy?: 'ai' | 'guardian' | 'pending';
  wateringConfirmation?: {
    note: string;          // the witness's one-line reading of the photo
    confidence?: number;   // 0-100 for an AI reading
    model?: string;        // the model that read it
    provider?: string;     // 'google' | 'anthropic' | …
    confirmedByUid?: string; // the guardian, when confirmed by a human
    confirmedAt?: Stamp;
  };

  // Alignment Logic (On Chain) (Legacy)
  isMatch?: boolean;
  matchedLifetreeId?: string;
  matchId?: string; // Link to the handshake
  
  // Metadata
  authorId: string;
  authorName: string;        // for reaches this is the sender's TREE name (the conversation face)
  authorPersonName?: string; // the human behind it — shown under the tree name in DMs
  authorPhoto?: string;
  // Representation mode 'human_carried' — a being's words carried by a human's hands. A bridge
  // is sacred only while it remains visible: carriedByName names the carrier and disclosure
  // spells it out, while authorId stays the REAL signed-in uid (rules/provenance stay true).
  // Later beings may self-sign (initiation ledger keys) and these fields fall away.
  // NOT part of BLOCK_CONTENT_FIELDS — display provenance, not chain content.
  carriedByName?: string;    // the human carrier's displayName
  disclosure?: string;       // "This pulse was carried by <name> from <being>."
  createdAt: Stamp;
  
  // Interactions (Off Chain)
  loveCount: number;
  commentCount: number;

  // Immutable chain Ledger
  previousHash: string;
  hash: string;
}
