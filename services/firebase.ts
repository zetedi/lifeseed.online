
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
  updateDoc
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { type Pulse, type Comment, type Lifetree } from '../types';
import { createBlock } from '../utils/crypto';

// Load config from Environment Variables (.env)
const env = (import.meta as any).env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes("YOUR_")) {
  console.warn("LifeSeed Configuration Warning: .env file might be missing or invalid.");
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
    ignoreUndefinedProperties: true
});
export const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// --- AUTH ---
export const onAuthChange = (callback: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export const signInWithGoogle = async () => {
  try { return (await signInWithPopup(auth, googleProvider)).user; } 
  catch (error) { console.error(error); throw error; }
};

export const logout = () => firebaseSignOut(auth);

// --- STORAGE ---
export const uploadImage = async (file: File, path: string): Promise<string> => {
  try {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  } catch (error) { console.error(error); throw error; }
};

// --- LIFETREE (BLOCKCHAIN ENTITY) ---
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
  // 1. Check existing trees for this owner
  const q = query(lifetreesCollection, where('ownerId', '==', data.ownerId));
  const snapshot = await getDocs(q);
  
  // Rule: Can only plant new tree if ALL existing trees are validated.
  if (!snapshot.empty) {
      const trees = snapshot.docs.map(d => d.data() as Lifetree);
      const allValidated = trees.every(t => t.validated);
      if (!allValidated) {
          throw new Error("Your existing Lifetree is not validated yet. You cannot plant another.");
      }
  }

  // 2. Genesis Logic: "Phoenix" is the First Valid Tree
  const isValid = data.name.trim().toLowerCase() === "phoenix";

  // 3. Create Genesis Block Hash
  const genesisData = { message: "Genesis Pulse", owner: data.ownerId, timestamp: Date.now() };
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
    latestHash: genesisHash,
    blockHeight: 0,
    validated: isValid,
    validatorId: isValid ? "SYSTEM" : null
  });
};

export const validateLifetree = async (targetTreeId: string, validatorTreeId: string) => {
    const targetRef = doc(db, 'lifetrees', targetTreeId);
    const validatorRef = doc(db, 'lifetrees', validatorTreeId);

    return runTransaction(db, async (t) => {
        const vDoc = await t.get(validatorRef);
        const tDoc = await t.get(targetRef);

        if (!vDoc.exists() || !tDoc.exists()) throw new Error("Tree not found");
        
        const validator = vDoc.data() as Lifetree;
        if (!validator.validated) throw new Error("Only a Validated Lifetree can validate others.");

        t.update(targetRef, {
            validated: true,
            validatorId: validatorTreeId
        });
    });
}

export const fetchLifetrees = async (): Promise<Lifetree[]> => {
  const q = query(lifetreesCollection, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Lifetree));
};

export const getMyLifetrees = async (userId: string): Promise<Lifetree[]> => {
    if (!userId) return [];
    const q = query(lifetreesCollection, where('ownerId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Lifetree));
};

// --- PULSES (THE BLOCKS) ---
// Replaces "Presents"
const pulsesCollection = collection(db, 'pulses');

export const fetchPulses = async (): Promise<Pulse[]> => {
  // Show all pulses, sorted by time
  const q = query(pulsesCollection, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Pulse));
};

/**
 * Creates a Pulse (NFT Block).
 * If targetLifetreeId is provided, this is a MATCH/MEETING.
 * It creates entries on BOTH blockchains transactionally.
 */
export const createPulse = async (pulseData: {
  lifetreeId: string, // My tree
  targetLifetreeId?: string, // The tree I am pulsing at (Matching)
  title: string,
  body: string,
  imageUrl?: string,
  authorId: string,
  authorName: string,
  authorPhoto?: string,
}) => {
  return runTransaction(db, async (transaction) => {
    const timestamp = Date.now();
    
    // 1. Process Source Tree (My Tree)
    const sourceTreeRef = doc(db, 'lifetrees', pulseData.lifetreeId);
    const sourceTreeDoc = await transaction.get(sourceTreeRef);
    if (!sourceTreeDoc.exists()) throw new Error("Source tree missing");
    
    const sourceTree = sourceTreeDoc.data() as Lifetree;
    const prevHashSource = sourceTree.latestHash || sourceTree.genesisHash || "0";
    
    // Hash Payload
    const blockData = {
      title: pulseData.title,
      body: pulseData.body,
      image: pulseData.imageUrl || "",
      author: pulseData.authorId,
      target: pulseData.targetLifetreeId || "SELF"
    };
    
    const newHash = await createBlock(prevHashSource, blockData, timestamp);
    
    // Create Source Pulse
    const newPulseRef = doc(pulsesCollection);
    transaction.set(newPulseRef, {
      ...pulseData,
      id: newPulseRef.id,
      lifetreeId: pulseData.lifetreeId,
      isMatch: !!pulseData.targetLifetreeId,
      matchedLifetreeId: pulseData.targetLifetreeId || null,
      loveCount: 0,
      commentCount: 0,
      createdAt: serverTimestamp(),
      previousHash: prevHashSource,
      hash: newHash,
    });

    // Update Source Tree
    transaction.update(sourceTreeRef, {
      latestHash: newHash,
      blockHeight: (sourceTree.blockHeight || 0) + 1
    });

    // 2. Process Target Tree (If Match)
    if (pulseData.targetLifetreeId && pulseData.targetLifetreeId !== pulseData.lifetreeId) {
        const targetTreeRef = doc(db, 'lifetrees', pulseData.targetLifetreeId);
        const targetTreeDoc = await transaction.get(targetTreeRef);
        
        if (targetTreeDoc.exists()) {
            const targetTree = targetTreeDoc.data() as Lifetree;
            const prevHashTarget = targetTree.latestHash || targetTree.genesisHash || "0";
            
            // The matched pulse on the other tree (Linked by ID or content, but technically a new block on their chain)
            const matchedPulseRef = doc(pulsesCollection);
            // Hash payload for target (includes reference to source)
            const matchHash = await createBlock(prevHashTarget, { ...blockData, origin: pulseData.lifetreeId }, timestamp);

            transaction.set(matchedPulseRef, {
                ...pulseData,
                id: matchedPulseRef.id,
                title: `Match: ${pulseData.title}`,
                lifetreeId: pulseData.targetLifetreeId, // It lives on their tree now
                isMatch: true,
                matchedLifetreeId: pulseData.lifetreeId, // Points back to me
                loveCount: 0,
                commentCount: 0,
                createdAt: serverTimestamp(),
                previousHash: prevHashTarget,
                hash: matchHash
            });

            // Update Target Tree Ledger
            transaction.update(targetTreeRef, {
                latestHash: matchHash,
                blockHeight: (targetTree.blockHeight || 0) + 1
            });
        }
    }
  });
};

export const isPulseLoved = async (pulseId: string, userId: string): Promise<boolean> => {
    if (!userId) return false;
    const loveDocRef = doc(db, 'pulses', pulseId, 'loves', userId);
    const docSnap = await getDoc(loveDocRef);
    return docSnap.exists();
};

export const lovePulse = async (pulseId: string, userId: string): Promise<number> => {
  const pulseRef = doc(db, 'pulses', pulseId);
  const loveRef = doc(pulseRef, 'loves', userId);

  return runTransaction(db, async (transaction) => {
    const postDoc = await transaction.get(pulseRef);
    if (!postDoc.exists()) throw new Error("Pulse dissolved.");
    
    const loveDoc = await transaction.get(loveRef);
    let newLoveCount = postDoc.data().loveCount || 0;

    if (loveDoc.exists()) {
      transaction.delete(loveRef);
      newLoveCount = Math.max(0, newLoveCount - 1);
    } else {
      transaction.set(loveRef, { userId, createdAt: serverTimestamp() });
      newLoveCount += 1;
    }
    
    transaction.update(pulseRef, { loveCount: newLoveCount });
    return newLoveCount;
  });
};
