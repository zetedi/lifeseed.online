
import { type User as FirebaseUser } from 'firebase/auth';
import { type Timestamp } from 'firebase/firestore';

export type Lightseed = Pick<FirebaseUser, 'uid' | 'email' | 'displayName' | 'photoURL'>;

// Removed 'PresentType' as everything is now a Pulse

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
  validated: boolean; // Only validated trees can validate others
  validatorId?: string; // Who validated this tree

  // Blockchain Props
  genesisHash: string;
  latestHash: string; 
  blockHeight: number;
}

// The Block (formerly Present)
export interface Pulse {
  id: string;
  lifetreeId: string; // The chain this specific entry belongs to
  
  // Data Payload
  title: string;
  body: string;
  imageUrl?: string; // NFT Image
  
  // Match/interaction Logic
  isMatch: boolean; // Is this a meeting of two pulses?
  matchedLifetreeId?: string; // If matched, which tree did we meet?
  
  // Metadata
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  createdAt: Timestamp;
  
  // Interactions
  loveCount: number;
  commentCount: number;

  // Blockchain Ledger
  previousHash: string;
  hash: string;
}

export interface Comment {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: Timestamp;
}
