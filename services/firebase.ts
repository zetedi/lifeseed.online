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
  initializeFirestore, 
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
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { type Present, type Comment, type Lifetree } from '../types';
import { createBlock } from '../utils/crypto';

// Load config from Environment Variables (.env)
// Use 'any' cast for import.meta to avoid TS error 'Property env does not exist on type ImportMeta'
const env = (import.meta as any).env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

// Safety Check: Ensure keys are replaced
if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes("YOUR_")) {
  console.warn("LifeSeed Configuration Warning: .env file might be missing or invalid.");
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// FIX: ignoreUndefinedProperties prevents crashes when optional fields (like price) are undefined
export const db = initializeFirestore(app, {
    ignoreUndefinedProperties: true
});

export const storage = getStorage(app);
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

// --- STORAGE FUNCTIONS ---
export const uploadImage = async (file: File, path: string): Promise<string> => {
  try {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error("Storage Error:", error);
    throw error;
  }
};

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
  // Cast data to any to prevent TS spread error
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Lifetree));
};

export const getMyLifetree = async (userId: string): Promise<Lifetree | null> => {
    if (!userId) return null;
    const q = query(lifetreesCollection, where('ownerId', '==', userId));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const document = snapshot.docs[0];
    // Cast data to any to prevent TS spread error
    return { id: document.id, ...(document.data() as any) } as Lifetree;
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
  // Cast doc.data() to any to allow spreading (fixes strict type check error)
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Present));
};

/**
 * Creates a Present (Post/Offer) and links it to the Lifetree's blockchain.
 * Uses a Transaction to ensure the hash chain is atomic.
 */
export const createPresent = async (presentData: {
  lifetreeId: string,
  title: string,
  body: string,
  imageUrl?: string,
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
    // NFT Logic: Image URL is part of the hash
    const blockData = {
      title: presentData.title,
      body: presentData.body,
      image: presentData.imageUrl || "",
      author: presentData.authorId,
      type: presentData.type,
      price: presentData.price
    };
    
    const newHash = await createBlock(previousHash, blockData, timestamp);

    // 3. Create the Present
    // Firestore with ignoreUndefinedProperties: true will handle undefined price automatically
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