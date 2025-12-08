
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
  updateDoc,
  deleteDoc,
  limit
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL,
  uploadString
} from 'firebase/storage';
import { type Pulse, type PulseType, type Lifetree, type MatchProposal, type Vision } from '../types';
import { createBlock } from '../utils/crypto';

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

export const uploadBase64Image = async (base64String: string, path: string): Promise<string> => {
  try {
    const storageRef = ref(storage, path);
    await uploadString(storageRef, base64String, 'data_url');
    return await getDownloadURL(storageRef);
  } catch (error) { console.error(error); throw error; }
}

// --- LIFETREES ---
const lifetreesCollection = collection(db, 'lifetrees');
const visionsCollection = collection(db, 'visions');

export const plantLifetree = async (data: {
  ownerId: string, 
  name: string, 
  body: string, 
  imageUrl?: string,
  lat?: number,
  lng?: number,
  locName?: string
}) => {
  // Check if user already has an unvalidated tree
  const q = query(lifetreesCollection, where('ownerId', '==', data.ownerId));
  const snapshot = await getDocs(q);
  
  if (!snapshot.empty) {
      const trees = snapshot.docs.map(d => d.data() as Lifetree);
      const allValidated = trees.every(t => t.validated);
      if (!allValidated) {
          throw new Error("Your existing Lifetree is not validated yet. You cannot plant another.");
      }
  }

  // Check if this is the FIRST tree in the entire system (Genesis)
  const allTreesQuery = query(lifetreesCollection, limit(1));
  const allTreesSnap = await getDocs(allTreesQuery);
  const isFirstTree = allTreesSnap.empty;

  const isValid = isFirstTree || data.name.trim().toLowerCase() === "phoenix";
  const genesisData = { message: "Genesis Pulse", owner: data.ownerId, timestamp: Date.now() };
  const genesisHash = await createBlock("0", genesisData, Date.now());

  const treeDoc = await addDoc(lifetreesCollection, {
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
    validatorId: isValid ? (isFirstTree ? "GENESIS" : "SYSTEM") : null
  });

  // Automatically create the first Vision (Branch) for this tree
  await addDoc(visionsCollection, {
      lifetreeId: treeDoc.id,
      authorId: data.ownerId,
      title: "Root Vision",
      body: data.body, // The Vision comes from the tree planting
      imageUrl: data.imageUrl || null,
      createdAt: serverTimestamp(),
      link: ""
  });

  return treeDoc;
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

// --- VISIONS ---
export const fetchVisions = async (): Promise<Vision[]> => {
    const q = query(visionsCollection, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({id: d.id, ...(d.data() as any)} as Vision));
}

export const getMyVisions = async (userId: string): Promise<Vision[]> => {
    if (!userId) return [];
    const q = query(visionsCollection, where('authorId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({id: d.id, ...(d.data() as any)} as Vision));
}

export const createVision = async (data: {
    lifetreeId: string,
    authorId: string,
    title: string,
    body: string,
    link?: string,
    imageUrl?: string
}) => {
    return addDoc(visionsCollection, {
        ...data,
        createdAt: serverTimestamp()
    });
}

// --- PULSES & MATCHING ---
const pulsesCollection = collection(db, 'pulses');
const matchesCollection = collection(db, 'matches');

export const fetchPulses = async (): Promise<Pulse[]> => {
  const q = query(pulsesCollection, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Pulse));
};

export const getMyPulses = async (userId: string): Promise<Pulse[]> => {
    if (!userId) return [];
    // Note: Use orderBy client-side if missing index
    const q = query(pulsesCollection, where('authorId', '==', userId));
    const snapshot = await getDocs(q);
    const pulses = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Pulse));
    return pulses.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
};

export const fetchGrowthPulses = async (treeId: string): Promise<Pulse[]> => {
    // Removed orderBy to prevent 'Missing Index' errors on new deployments.
    // Sorting happens client-side.
    const q = query(
        pulsesCollection, 
        where('lifetreeId', '==', treeId), 
        where('type', '==', 'GROWTH')
    );
    const snap = await getDocs(q);
    const pulses = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Pulse));
    // Client-side sort
    return pulses.sort((a,b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
}

// Mint a single Pulse (Growth or Standard)
export const mintPulse = async (pulseData: {
  lifetreeId: string,
  type: PulseType,
  title: string,
  body: string,
  imageUrl?: string,
  authorId: string,
  authorName: string,
  authorPhoto?: string,
}) => {
  return runTransaction(db, async (transaction) => {
    const timestamp = Date.now();
    
    const sourceTreeRef = doc(db, 'lifetrees', pulseData.lifetreeId);
    const sourceTreeDoc = await transaction.get(sourceTreeRef);
    if (!sourceTreeDoc.exists()) throw new Error("Source tree missing");
    
    const sourceTree = sourceTreeDoc.data() as Lifetree;
    const prevHashSource = sourceTree.latestHash || sourceTree.genesisHash || "0";
    
    // Hash Payload (excludes comments)
    const blockData = {
      title: pulseData.title,
      body: pulseData.body,
      image: pulseData.imageUrl || "",
      author: pulseData.authorId,
      type: pulseData.type
    };
    
    const newHash = await createBlock(prevHashSource, blockData, timestamp);
    const newPulseRef = doc(pulsesCollection);
    
    transaction.set(newPulseRef, {
      ...pulseData,
      id: newPulseRef.id,
      isMatch: false,
      loveCount: 0,
      commentCount: 0,
      createdAt: serverTimestamp(),
      previousHash: prevHashSource,
      hash: newHash,
    });

    transaction.update(sourceTreeRef, {
      latestHash: newHash,
      blockHeight: (sourceTree.blockHeight || 0) + 1,
      // If growth, maybe update tree image? Optional.
      ...(pulseData.type === 'GROWTH' && pulseData.imageUrl ? { imageUrl: pulseData.imageUrl } : {})
    });
  });
};

// --- MATCHING SYSTEM ---

export const proposeMatch = async (data: {
    initiatorPulseId: string,
    initiatorTreeId: string,
    initiatorUid: string,
    targetPulseId: string,
    targetTreeId: string, // Requires us to look up the pulse's tree first usually
    targetUid: string
}) => {
    return addDoc(matchesCollection, {
        ...data,
        status: 'PENDING',
        createdAt: serverTimestamp()
    });
}

export const getPendingMatches = async (userId: string): Promise<MatchProposal[]> => {
    const q = query(matchesCollection, where('targetUid', '==', userId), where('status', '==', 'PENDING'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({id: d.id, ...d.data() as any} as MatchProposal));
}

// Get completed matches where user was involved
export const getMyMatchesHistory = async (userId: string): Promise<MatchProposal[]> => {
    // Requires multiple queries or an OR clause (not fully supported in simple queries without index)
    // Simpler: Fetch accepted matches for target, accepted for initiator
    const q1 = query(matchesCollection, where('targetUid', '==', userId), where('status', '==', 'ACCEPTED'));
    const q2 = query(matchesCollection, where('initiatorUid', '==', userId), where('status', '==', 'ACCEPTED'));
    
    const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const matches = [...s1.docs, ...s2.docs].map(d => ({id: d.id, ...d.data() as any} as MatchProposal));
    return matches.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
}

// Accepts match and writes to blockchain
export const acceptMatch = async (proposalId: string) => {
    const matchRef = doc(db, 'matches', proposalId);
    
    return runTransaction(db, async (t) => {
        const matchDoc = await t.get(matchRef);
        if (!matchDoc.exists()) throw new Error("Match expired");
        const proposal = matchDoc.data() as MatchProposal;

        if (proposal.status !== 'PENDING') throw new Error("Match already processed");

        // Mint Match Block on Initiator Tree
        const initTreeRef = doc(db, 'lifetrees', proposal.initiatorTreeId);
        const initTree = (await t.get(initTreeRef)).data() as Lifetree;
        const initHash = await createBlock(initTree.latestHash, { match: proposal.id, with: proposal.targetPulseId }, Date.now());
        
        const pulseRef1 = doc(pulsesCollection);
        t.set(pulseRef1, {
            lifetreeId: proposal.initiatorTreeId,
            type: 'STANDARD',
            title: 'Pulse Match',
            body: 'Two pulses met and connected.',
            isMatch: true,
            matchedLifetreeId: proposal.targetTreeId,
            matchId: proposal.id,
            authorId: proposal.initiatorUid,
            authorName: 'System', 
            createdAt: serverTimestamp(),
            previousHash: initTree.latestHash,
            hash: initHash,
            loveCount: 0,
            commentCount: 0
        });
        t.update(initTreeRef, { latestHash: initHash, blockHeight: initTree.blockHeight + 1 });

        // Mint Match Block on Target Tree
        const targetTreeRef = doc(db, 'lifetrees', proposal.targetTreeId);
        const targetTree = (await t.get(targetTreeRef)).data() as Lifetree;
        const targetHash = await createBlock(targetTree.latestHash, { match: proposal.id, with: proposal.initiatorPulseId }, Date.now());

        const pulseRef2 = doc(pulsesCollection);
        t.set(pulseRef2, {
            lifetreeId: proposal.targetTreeId,
            type: 'STANDARD',
            title: 'Pulse Match',
            body: 'Two pulses met and connected.',
            isMatch: true,
            matchedLifetreeId: proposal.initiatorTreeId,
            matchId: proposal.id,
            authorId: proposal.targetUid,
            authorName: 'System',
            createdAt: serverTimestamp(),
            previousHash: targetTree.latestHash,
            hash: targetHash,
            loveCount: 0,
            commentCount: 0
        });
        t.update(targetTreeRef, { latestHash: targetHash, blockHeight: targetTree.blockHeight + 1 });

        // Close Proposal
        t.update(matchRef, { status: 'ACCEPTED' });
    });
}

// --- INTERACTIONS (Off Chain) ---

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
