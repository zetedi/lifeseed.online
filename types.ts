
// Fix: Use proper type imports to resolve "no exported member" errors in some TS environments.
import type { User as FirebaseUser } from 'firebase/auth';
import type { Timestamp } from 'firebase/firestore';

export type Lightseed = Pick<FirebaseUser, 'uid' | 'email' | 'displayName' | 'photoURL'>;

export type PulseType = 'STANDARD' | 'GROWTH';

// The Entity/Blockchain container
export interface Lifetree {
  id: string;
  ownerId: string;
  name: string;
  shortTitle?: string;
  body: string; // The Vision
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  createdAt: Timestamp;
  
  // Validation Logic
  validated: boolean; 
  validatorId?: string;

  // Nature & Guardian Logic
  isNature?: boolean;
  treeType?: 'LIFETREE' | 'GUARDED' | 'KABBALISTIC' | 'FAMILY';
  guardians?: string[]; // Array of User IDs
  status?: 'HEALTHY' | 'DANGER';

  // Blockchain Props
  genesisHash: string;
  latestHash: string; 
  blockHeight: number;
}

export interface Vision {
  id: string;
  lifetreeId: string;
  authorId: string;
  title: string;
  body: string;
  link?: string;
  imageUrl?: string;
  createdAt: Timestamp;
  joinedUserIds?: string[]; // List of users who joined this vision
}

// The Block
export interface Pulse {
  id: string;
  lifetreeId: string;
  type: PulseType; // GROWTH or STANDARD
  
  // Data Payload
  title: string;
  body: string;
  imageUrl?: string;
  
  // Match Logic (On Chain)
  isMatch: boolean;
  matchedLifetreeId?: string;
  matchId?: string; // Link to the handshake
  
  // Metadata
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  createdAt: Timestamp;
  
  // Interactions (Off Chain)
  loveCount: number;
  commentCount: number;

  // Blockchain Ledger
  previousHash: string;
  hash: string;
}

// Off-Chain Match Handshake
export interface MatchProposal {
  id: string;
  initiatorPulseId: string;
  initiatorTreeId: string;
  initiatorUid: string;
  
  targetPulseId: string; // The pulse being matched WITH
  targetTreeId: string;
  targetUid: string; // The owner who needs to accept

  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: Timestamp;
}

export interface Comment {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: Timestamp;
}

export interface VisionSynergy {
    vision1Title: string;
    vision2Title: string;
    reasoning: string;
    score: number;
}
