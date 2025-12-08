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
  limit
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL,
  uploadString
} from 'firebase/storage';
import { type Pulse, type PulseType, type Lifetree, type MatchProposal, type Vision } from '../types/Types';
import { createBlock } from './crypto';

// Access Vite env variables directly via cast to avoid TS errors
const env = (import.meta as any).env;
const apiKey = env.VITE_FIREBASE_API_KEY;
const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN;
const projectId = env.VITE_FIREBASE_PROJECT_ID;
const storageBucket = env.VITE_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID;
const appId = env.VITE_FIREBASE_APP_ID;
const measurementId = env.VITE_FIREBASE_MEASUREMENT_ID;

if (!apiKey) {
  console.error("Firebase API Key is missing. Check your .env file.");
}

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
  measurementId
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
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

// Collections
export const lifetreesCollection = collection(db, 'lifetrees');
export const visionsCollection = collection(db, 'visions');
export const pulsesCollection = collection(db, 'pulses');
export const matchesCollection = collection(db, 'matches');

// --- LIFETREES ---
export const fetchLifetrees = async (): Promise<Lifetree[]> => {
  const q = query(lifetreesCollection, orderBy('createdAt', 'desc'), limit(50));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Lifetree));
};

export const getMyLifetrees = async (userId: string): Promise<Lifetree[]> => {
    if (!userId) return [];
    const q = query(lifetreesCollection, where('ownerId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Lifetree));
};

export const plantLifetree = async (data: { ownerId: string, name: string, body: string, imageUrl?: string, lat?: number, lng?: number, locName?: string }) => {
  const q = query(lifetreesCollection, where('ownerId', '==', data.ownerId));
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
      const trees = snapshot.docs.map(d => d.data() as Lifetree);
      if (!trees.every(t => t.validated)) throw new Error("Existing Lifetree not validated.");
  }
  const allTreesSnap = await getDocs(query(lifetreesCollection, limit(1)));
  const isFirstTree = allTreesSnap.empty;
  const isValid = isFirstTree || data.name.trim().toLowerCase() === "phoenix";
  const genesisHash = await createBlock("0", { message: "Genesis", owner: data.ownerId }, Date.now());

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

  await addDoc(visionsCollection, {
      lifetreeId: treeDoc.id,
      authorId: data.ownerId,
      title: "Root Vision",
      body: data.body,
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
        if (!(vDoc.data() as Lifetree).validated) throw new Error("Validator not validated.");
        t.update(targetRef, { validated: true, validatorId: validatorTreeId });
    });
}

// --- PULSES ---
export const fetchPulses = async (): Promise<Pulse[]> => {
  const q = query(pulsesCollection, orderBy('createdAt', 'desc'), limit(50));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Pulse));
};

export const mintPulse = async (pulseData: any) => {
  return runTransaction(db, async (transaction) => {
    const sourceTreeRef = doc(db, 'lifetrees', pulseData.lifetreeId);
    const sourceTreeDoc = await transaction.get(sourceTreeRef);
    if (!sourceTreeDoc.exists()) throw new Error("Source tree missing");
    const sourceTree = sourceTreeDoc.data() as Lifetree;
    
    const newHash = await createBlock(sourceTree.latestHash || "0", { title: pulseData.title, body: pulseData.body }, Date.now());
    const newPulseRef = doc(pulsesCollection);
    
    transaction.set(newPulseRef, {
      ...pulseData,
      id: newPulseRef.id,
      isMatch: false,
      loveCount: 0,
      commentCount: 0,
      createdAt: serverTimestamp(),
      previousHash: sourceTree.latestHash,
      hash: newHash,
    });
    transaction.update(sourceTreeRef, {
      latestHash: newHash,
      blockHeight: (sourceTree.blockHeight || 0) + 1,
      ...(pulseData.type === 'GROWTH' && pulseData.imageUrl ? { imageUrl: pulseData.imageUrl } : {})
    });
  });
};

export const fetchGrowthPulses = async (treeId: string): Promise<Pulse[]> => {
    const q = query(pulsesCollection, where('lifetreeId', '==', treeId), where('type', '==', 'GROWTH'));
    const snap = await getDocs(q);
    const pulses = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Pulse));
    return pulses.sort((a,b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
}

export const isPulseLoved = async (pulseId: string, userId: string): Promise<boolean> => {
    if (!userId) return false;
    const docSnap = await getDoc(doc(db, 'pulses', pulseId, 'loves', userId));
    return docSnap.exists();
};

export const lovePulse = async (pulseId: string, userId: string): Promise<number> => {
  const pulseRef = doc(db, 'pulses', pulseId);
  const loveRef = doc(pulseRef, 'loves', userId);
  return runTransaction(db, async (t) => {
    const postDoc = await t.get(pulseRef);
    if (!postDoc.exists()) throw new Error("Pulse dissolved.");
    const loveDoc = await t.get(loveRef);
    let newLoveCount = postDoc.data().loveCount || 0;
    if (loveDoc.exists()) {
      t.delete(loveRef);
      newLoveCount = Math.max(0, newLoveCount - 1);
    } else {
      t.set(loveRef, { userId, createdAt: serverTimestamp() });
      newLoveCount += 1;
    }
    t.update(pulseRef, { loveCount: newLoveCount });
    return newLoveCount;
  });
};

// --- VISIONS ---
export const fetchVisions = async (): Promise<Vision[]> => {
    const q = query(visionsCollection, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({id: d.id, ...(d.data() as any)} as Vision));
}

export const createVision = async (data: any) => addDoc(visionsCollection, { ...data, createdAt: serverTimestamp() });

// --- MATCHING ---
export const proposeMatch = async (data: any) => addDoc(matchesCollection, { ...data, status: 'PENDING', createdAt: serverTimestamp() });

export const getPendingMatches = async (userId: string) => {
    const q = query(matchesCollection, where('targetUid', '==', userId), where('status', '==', 'PENDING'));
    const s = await getDocs(q);
    return s.docs.map(d => ({id:d.id, ...d.data()} as MatchProposal));
}

export const acceptMatch = async (proposalId: string) => {
    const matchRef = doc(db, 'matches', proposalId);
    return runTransaction(db, async (t) => {
        const p = (await t.get(matchRef)).data() as MatchProposal;
        if(p.status !== 'PENDING') throw new Error("Processed");
        t.update(matchRef, { status: 'ACCEPTED' });
    });
}

// --- PROFILE HELPERS ---
export const getMyPulses = async (userId: string) => {
    const q = query(pulsesCollection, where('authorId', '==', userId));
    const s = await getDocs(q);
    return s.docs.map(d => ({id:d.id, ...d.data()} as Pulse)).sort((a,b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
};
export const getMyVisions = async (userId: string) => {
    const q = query(visionsCollection, where('authorId', '==', userId));
    const s = await getDocs(q);
    return s.docs.map(d => ({id:d.id, ...d.data()} as Vision));
};
export const getMyMatchesHistory = async (userId: string) => {
    const q1 = query(matchesCollection, where('targetUid', '==', userId), where('status', '==', 'ACCEPTED'));
    const q2 = query(matchesCollection, where('initiatorUid', '==', userId), where('status', '==', 'ACCEPTED'));
    const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    return [...s1.docs, ...s2.docs].map(d => ({id:d.id, ...d.data()} as MatchProposal)).sort((a,b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
};