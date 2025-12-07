import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  type User as FirebaseUser,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  addDoc,
  serverTimestamp,
  doc,
  runTransaction,
  getDoc,
  where,
  Timestamp
} from 'firebase/firestore';
import { type Present, type Comment, type Lifetree } from '../types';
import { createBlock } from '../utils/crypto';

// CRITICAL: Replace these with your actual Firebase config from the Firebase Console
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// --- AUTH FUNCTIONS ---
export const onAuthChange = (callback: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Google Sign In Error", error);
    throw error;
  }
};

export const logout = () => firebaseSignOut(auth);

// --- LIFETREE FUNCTIONS (The Blockchain Entities) ---
const lifetreesCollection = collection(db, 'lifetrees');

export const plantLifetree = async (data: {
  ownerId: string, 
  name: string, 
  body: string, 
  imageUrl?: string,
  lat?: number,
  lng?: number,
  locName?: string
}) => {
  // 1. Check if user already has a tree
  const q = query(lifetreesCollection, where('ownerId', '==', data.ownerId));
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    throw new Error("You have already planted a Lifetree. One soul, one tree.");
  }

  // 2. Create Genesis Block Hash
  const genesisData = { message: "Genesis Block", owner: data.ownerId, timestamp: Date.now() };
  const genesisHash = await createBlock("0", genesisData, Date.now());

  return await addDoc(lifetreesCollection, {
    ownerId: data.ownerId,
    name: data.name,
    body: data.body,
    imageUrl: data.imageUrl || null,
    latitude: data.lat || null,
    longitude: data.lng || null,
    locationName: data.locName || "Unknown Soil",
    createdAt: serverTimestamp(),
    genesisHash: genesisHash,
    latestHash: genesisHash, // Cursor starts at genesis
    blockHeight: 0
  });
};

export const fetchLifetrees = async (): Promise<Lifetree[]> => {
  const q = query(lifetreesCollection, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lifetree));
};

export const getMyLifetree = async (userId: string): Promise<Lifetree | null> => {
    if (!userId) return null;
    const q = query(lifetreesCollection, where('ownerId', '==', userId));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Lifetree;
};

// --- PRESENT FUNCTIONS (The Blocks) ---
const presentsCollection = collection(db, 'presents');

export const fetchPresents = async (typeFilter?: 'POST' | 'OFFER'): Promise<Present[]> => {
  let q;
  if (typeFilter) {
      q = query(presentsCollection, where('type', '==', typeFilter), orderBy('createdAt', 'desc'));
  } else {
      q = query(presentsCollection, orderBy('createdAt', 'desc'));
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Present));
};

/**
 * Creates a Present (Post/Offer) and links it to the Lifetree's blockchain.
 * Uses a Transaction to ensure the hash chain is atomic.
 */
export const createPresent = async (presentData: {
  lifetreeId: string,
  title: string,
  body: string,
  authorId: string,
  authorName: string,
  authorPhoto?: string,
  type: 'POST' | 'OFFER',
  price?: number
}) => {
  const lifetreeRef = doc(db, 'lifetrees', presentData.lifetreeId);
  const newPresentRef = doc(presentsCollection);

  return runTransaction(db, async (transaction) => {
    // 1. Get the Lifetree to find the latest hash
    const lifetreeDoc = await transaction.get(lifetreeRef);
    if (!lifetreeDoc.exists()) {
      throw new Error("Lifetree roots not found.");
    }
    
    const lifetree = lifetreeDoc.data() as Lifetree;
    const previousHash = lifetree.latestHash || lifetree.genesisHash || "0";
    const newHeight = (lifetree.blockHeight || 0) + 1;
    const timestamp = Date.now();

    // 2. Calculate the Hash for this new Block (Present)
    const blockData = {
      title: presentData.title,
      body: presentData.body,
      author: presentData.authorId,
      type: presentData.type,
      price: presentData.price
    };
    
    const newHash = await createBlock(previousHash, blockData, timestamp);

    // 3. Create the Present
    transaction.set(newPresentRef, {
      ...presentData,
      loveCount: 0,
      commentCount: 0,
      createdAt: serverTimestamp(),
      previousHash: previousHash,
      hash: newHash,
      blockHeight: newHeight
    });

    // 4. Update the Lifetree ledger cursor
    transaction.update(lifetreeRef, {
      latestHash: newHash,
      blockHeight: newHeight
    });
  });
};

export const isPresentLoved = async (presentId: string, userId: string): Promise<boolean> => {
    if (!userId) return false;
    const loveDocRef = doc(db, 'presents', presentId, 'loves', userId);
    const docSnap = await getDoc(loveDocRef);
    return docSnap.exists();
};

export const lovePresent = async (presentId: string, userId: string): Promise<number> => {
  const presentRef = doc(db, 'presents', presentId);
  const loveRef = doc(presentRef, 'loves', userId);

  return runTransaction(db, async (transaction) => {
    const postDoc = await transaction.get(presentRef);
    if (!postDoc.exists()) throw new Error("Present gone.");
    
    const loveDoc = await transaction.get(loveRef);
    let newLoveCount = postDoc.data().loveCount || 0;

    if (loveDoc.exists()) {
      transaction.delete(loveRef);
      newLoveCount = Math.max(0, newLoveCount - 1);
    } else {
      transaction.set(loveRef, { userId, createdAt: serverTimestamp() });
      newLoveCount += 1;
    }
    
    transaction.update(presentRef, { loveCount: newLoveCount });
    return newLoveCount;
  });
};

// --- COMMENT FUNCTIONS ---
export const fetchComments = async (presentId: string): Promise<Comment[]> => {
    const commentsCollection = collection(db, 'presents', presentId, 'comments');
    const q = query(commentsCollection, orderBy('createdAt', 'asc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
};

export const addComment = async (presentId: string, commentData: Omit<Comment, 'id' | 'createdAt'>) => {
    const presentRef = doc(db, 'presents', presentId);
    const commentsCollection = collection(presentRef, 'comments');

    return runTransaction(db, async (transaction) => {
      const pDoc = await transaction.get(presentRef);
      if (!pDoc.exists()) throw new Error("Present missing.");

      const newCommentRef = doc(commentsCollection);
      transaction.set(newCommentRef, {
        ...commentData,
        createdAt: serverTimestamp()
      });

      const newCount = (pDoc.data().commentCount || 0) + 1;
      transaction.update(presentRef, { commentCount: newCount });
      return newCount;
    });
};