import { type User as FirebaseUser } from 'firebase/auth';
import { type Timestamp } from 'firebase/firestore';

export type Lightseed = Pick<FirebaseUser, 'uid' | 'email' | 'displayName' | 'photoURL'>;

export type PresentType = 'POST' | 'OFFER';

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
  // Blockchain Props
  genesisHash: string;
  latestHash: string; 
  blockHeight: number;
}

// The Block/Item
export interface Present {
  id: string;
  lifetreeId: string; // The chain it belongs to
  type: PresentType;
  
  // Data Payload
  title: string;
  body: string;
  price?: number; // Only for OFFER
  
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