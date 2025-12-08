
import { type User as FirebaseUser } from 'firebase/auth';
import { type Timestamp } from 'firebase/firestore';

export type Lightseed = Pick<FirebaseUser, 'uid' | 'email' | 'displayName' | 'photoURL'>;

export type PulseType = 'STANDARD' | 'GROWTH';

// The Entity/Blockchain container
export interface Lifetree {
  id: string;
  ownerId: string;
  name: string;
  body: string; // The Vision
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  createdAt: Timestamp;
  
  // Validation Logic
  validated: boolean; 
  validatorId?: string;

  // Blockchain Props
  genesisHash: string;
  latestHash: string; 
  blockHeight: number;
}

// Separate Entity: Branch of a Lifetree
export interface Vision {
  id: string;
  lifetreeId: string; // The parent tree
  authorId: string;
  title: string;
  body: string;
  link?: string; // Webpage
  imageUrl?: string;
  createdAt: Timestamp;
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
