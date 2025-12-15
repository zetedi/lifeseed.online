
// Ensure polyfill runs first to populate process.env
import '../utils/polyfill';

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  type User as FirebaseUser,
  signOut as firebaseSignOut,
  deleteUser as firebaseDeleteUser
} from 'firebase/auth';
import { 
  initializeFirestore, 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  addDoc,
  setDoc,
  serverTimestamp,
  doc,
  runTransaction,
  getDoc,
  where,
  updateDoc,
  deleteDoc,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  arrayUnion,
  arrayRemove,
  writeBatch,
  onSnapshot
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

// ------------------------------------------------------------------
// CONFIGURATION
// ------------------------------------------------------------------

// Configure your Sender Alias here
const SYSTEM_EMAIL_FROM = "LifeSeed <admin@lightseed.online>";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyCDcg27BljgJsVGuzNgS0NQWOgFIuDMlYI",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "lifeseed-75dfe.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "lifeseed-75dfe",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "lifeseed-75dfe.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "110675956366",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:110675956366:web:3cbc94aff415a800e6efdf",
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || "G-L95JY61SWQ"
};

// Debugging check
if (!firebaseConfig.apiKey) {
    console.error("CRITICAL: VITE_FIREBASE_API_KEY is missing from .env configuration.");
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
    ignoreUndefinedProperties: true
});
export const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// --- COLLECTIONS ---
const mailCollection = collection(db, 'mail');
const subsCollection = collection(db, 'subscriptions');
const usersCollection = collection(db, 'users');

// --- AUTH & USER MANAGEMENT ---
export const onAuthChange = (callback: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export const signInWithGoogle = async () => {
  try { 
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Check if user exists in DB, if not, create and send welcome email
      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);
      
      if (!userSnap.exists()) {
          // Initialize user profile
          await setDoc(userDocRef, {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              createdAt: serverTimestamp(),
              invitesRemaining: 7,
              dailyAiText: 0,
              dailyAiImage: 0,
              lastAiReset: Date.now()
          });

          // Trigger Welcome Email
          await triggerSystemEmail(
              user.email || "", 
              "Welcome to LifeSeed", 
              `Welcome to LifeSeed, ${user.displayName}. You have planted your intention. Now you may plant your tree.`,
              user.uid
          );
      }

      return user; 
  } 
  catch (error: any) { 
      console.error("Login Failed:", error); 
      
      if (error.code === 'auth/invalid-api-key') {
          alert(`Login Failed: Invalid API Key.\n\nPlease check your .env file.`);
      } else if (error.code === 'auth/unauthorized-domain') {
          alert(`Login Failed: Unauthorized Domain.\n\nPlease add "${window.location.hostname}" to the Authorized Domains list in the Firebase Console -> Authentication -> Settings.`);
      } else if (error.code === 'auth/popup-closed-by-user') {
          // User closed the popup, silent return
          return null;
      } else if (error.code === 'auth/popup-blocked') {
          alert("Login Popup Blocked.\n\nPlease allow popups for this site in your browser settings.");
      } else if (error.code === 'auth/network-request-failed' || error.message?.includes('BLOCKED_BY_CLIENT')) {
          alert("Network Error: Connection blocked.\n\nPlease disable AdBlockers or Privacy extensions (like Ghostery/uBlock) for this site, as they block Google Authentication.");
      } else {
          alert(`Login Error: ${error.message}`);
      }
      
      throw error; 
  }
};

export const logout = () => firebaseSignOut(auth);

// Delete User and Data
export const deleteUserAccount = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("No user signed in");
    const uid = user.uid;
    const email = user.email;

    try {
        console.log("Starting deletion process for", uid);

        // 1. Delete owned Lifetrees
        const treesQ = query(collection(db, 'lifetrees'), where('ownerId', '==', uid));
        const treesSnap = await getDocs(treesQ);
        const batch = writeBatch(db);
        treesSnap.docs.forEach(d => batch.delete(d.ref));

        // 2. Delete Pulses
        const pulsesQ = query(collection(db, 'pulses'), where('authorId', '==', uid));
        const pulsesSnap = await getDocs(pulsesQ);
        pulsesSnap.docs.forEach(d => batch.delete(d.ref));

        // 3. Delete Visions
        const visionsQ = query(collection(db, 'visions'), where('authorId', '==', uid));
        const visionsSnap = await getDocs(visionsQ);
        visionsSnap.docs.forEach(d => batch.delete(d.ref));

        // 4. Delete User Profile
        const userRef = doc(db, 'users', uid);
        batch.delete(userRef);

        // Commit batch deletion of data
        await batch.commit();

        // 5. Send Goodbye Email (before deleting auth)
        if (email) {
            await triggerSystemEmail(
                email, 
                "Goodbye from LifeSeed", 
                "It was wonderful to have you. See you!",
                uid
            );
        }

        // 6. Delete Auth Account
        await firebaseDeleteUser(user);
        console.log("User deleted successfully");

    } catch (e: any) {
        console.error("Deletion failed:", e);
        if (e.code === 'auth/requires-recent-login') {
            throw new Error("Please log out and log in again to confirm deletion security.");
        }
        throw e;
    }
}

// --- AI USAGE TRACKING ---
export const checkAndIncrementAiUsage = async (type: 'text' | 'image'): Promise<boolean> => {
    const user = auth.currentUser;
    if (!user) return false;

    const userRef = doc(db, 'users', user.uid);
    
    // We use a transaction to ensure atomic updates
    try {
        await runTransaction(db, async (t) => {
            const docSnap = await t.get(userRef);
            if (!docSnap.exists()) throw new Error("User profile missing");

            const data = docSnap.data();
            const now = Date.now();
            const lastReset = data.lastAiReset || 0;
            
            // Check if it's a new day (simple 24h check or calendar day)
            // Using local calendar day check
            const lastDate = new Date(lastReset).getDate();
            const currentDate = new Date(now).getDate();
            
            let textCount = data.dailyAiText || 0;
            let imageCount = data.dailyAiImage || 0;

            if (lastDate !== currentDate) {
                textCount = 0;
                imageCount = 0;
            }

            if (type === 'text') {
                if (textCount >= 7) throw new Error("Daily Oracle limit reached (7/7).");
                textCount++;
            } else {
                if (imageCount >= 3) throw new Error("Daily Vision limit reached (3/3).");
                imageCount++;
            }

            t.update(userRef, {
                dailyAiText: textCount,
                dailyAiImage: imageCount,
                lastAiReset: now
            });
        });
        return true;
    } catch (e) {
        throw e;
    }
}

// --- EMAIL & SUBSCRIPTION ---

// Writes to 'mail' collection to trigger Firebase Extension (e.g., Trigger Email)
export const triggerSystemEmail = async (to: string, subject: string, text: string, userId?: string) => {
    // Robustly get UID. If called during login, auth.currentUser might be shaky, so we prefer the passed userId
    const effectiveUid = userId || auth.currentUser?.uid;
    
    try {
        const docRef = await addDoc(mailCollection, {
            to: [to],
            uid: effectiveUid, // Crucial for security rules to allow reading status back 
            message: {
                from: SYSTEM_EMAIL_FROM,
                subject: subject,
                text: text,
                html: `
                  <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                    <h2 style="color: #059669; font-weight: 300; letter-spacing: 1px; margin-bottom: 20px;">.seed</h2>
                    <div style="font-size: 16px; margin-bottom: 30px;">
                        ${text.replace(/\n/g, '<br>')}
                    </div>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #9ca3af; text-align: center;">
                        Sent from the <a href="https://lightseed.online" style="color: #059669; text-decoration: none;">Lifetree Network</a>
                    </p>
                  </div>
                `
            }
        });
        return docRef;
    } catch (e) {
        console.warn("Email trigger failed (Check database permissions):", e);
        throw e;
    }
}

export const monitorMailStatus = (docId: string, onChange: (status: any) => void) => {
    const mailRef = doc(db, 'mail', docId);
    return onSnapshot(mailRef, 
        (docSnap) => {
            if (docSnap.exists()) {
                onChange(docSnap.data().delivery);
            }
        },
        (error) => {
            // Gracefully handle permission errors (e.g., if user logs out while listening)
            console.warn("Mail status listener stopped:", error.code);
            // Optionally notify that permission was lost, but usually we just want to suppress the crash
            if (error.code === 'permission-denied') {
                onChange({ state: 'ERROR', error: 'Permission denied (User logged out?)' });
            }
        }
    );
}

export const subscribeToNewsletter = async (email: string) => {
    return addDoc(subsCollection, {
        email,
        createdAt: serverTimestamp()
    });
}

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

// Wipe Database Function
const wipeDatabase = async () => {
    console.warn("!!! WIPING DATABASE !!!");
    const collections = ['lifetrees', 'pulses', 'visions', 'matches', 'users', 'mail', 'subscriptions'];
    for (const colName of collections) {
        try {
            const q = query(collection(db, colName));
            const snap = await getDocs(q);
            const promises = snap.docs.map(d => deleteDoc(doc(db, colName, d.id)));
            await Promise.all(promises);
            console.log(`Cleared ${colName}`);
        } catch (e) {
            console.warn(`[Non-Fatal] Failed to clear ${colName}. You might be missing permissions.`);
        }
    }
}

// Singleton Promise to ensure Genesis runs only once per session
let genesisInitializationPromise: Promise<void> | null = null;

export const ensureGenesis = () => {
    if (!genesisInitializationPromise) {
        genesisInitializationPromise = (async () => {
            if ((import.meta as any).env.MODE === 'clean') {
                if (!sessionStorage.getItem('db_cleaned')) {
                    try {
                        await wipeDatabase();
                        sessionStorage.setItem('db_cleaned', 'true');
                    } catch (e) {
                        console.warn("Clean mode failed to wipe DB. Continuing.");
                    }
                }
            }

            const genesisId = 'GENESIS_TREE';
            const genesisRef = doc(db, 'lifetrees', genesisId);

            try {
                const genesisSnap = await getDoc(genesisRef);
                const shouldCreate = !genesisSnap.exists() || ((import.meta as any).env.MODE === 'clean' && !sessionStorage.getItem('genesis_reset'));

                // New Mahameru Design
                const genesisSymbol = `data:image/svg+xml,%3Csvg width='800' height='800' viewBox='0 0 800 800' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100%25' height='100%25' fill='%23064e3b'/%3E%3Cdefs%3E%3Csymbol id='mahameru' viewBox='0 0 262 262'%3E%3CclipPath id='clean'%3E%3Ccircle cx='131' cy='131' r='131'/%3E%3C/clipPath%3E%3Cg clip-path='url(%23clean)'%3E%3Ccircle cx='131' cy='131' r='131' fill='none' stroke='%23FFD700' stroke-width='7'/%3E%3Cg fill='none' stroke='white' stroke-width='1'%3E%3Ccircle cx='-35.28' cy='-29' r='64'/%3E%3Ccircle cx='-35.28' cy='35' r='64'/%3E%3Ccircle cx='-35.28' cy='99' r='64'/%3E%3Ccircle cx='-35.28' cy='163' r='64'/%3E%3Ccircle cx='-35.28' cy='227' r='64'/%3E%3Ccircle cx='-35.28' cy='291' r='64'/%3E%3Ccircle cx='20.15' cy='3' r='64'/%3E%3Ccircle cx='20.15' cy='67' r='64'/%3E%3Ccircle cx='20.15' cy='131' r='64'/%3E%3Ccircle cx='20.15' cy='195' r='64'/%3E%3Ccircle cx='20.15' cy='259' r='64'/%3E%3Ccircle cx='75.57' cy='-29' r='64'/%3E%3Ccircle cx='75.57' cy='35' r='64'/%3E%3Ccircle cx='75.57' cy='99' r='64'/%3E%3Ccircle cx='75.57' cy='163' r='64'/%3E%3Ccircle cx='75.57' cy='227' r='64'/%3E%3Ccircle cx='75.57' cy='291' r='64'/%3E%3Ccircle cx='131' cy='3' r='64'/%3E%3Ccircle cx='131' cy='67' r='64'/%3E%3Ccircle cx='131' cy='195' r='64'/%3E%3Ccircle cx='131' cy='259' r='64'/%3E%3Ccircle cx='186.43' cy='-29' r='64'/%3E%3Ccircle cx='186.43' cy='35' r='64'/%3E%3Ccircle cx='186.43' cy='99' r='64'/%3E%3Ccircle cx='186.43' cy='163' r='64'/%3E%3Ccircle cx='186.43' cy='227' r='64'/%3E%3Ccircle cx='186.43' cy='291' r='64'/%3E%3Ccircle cx='241.85' cy='3' r='64'/%3E%3Ccircle cx='241.85' cy='67' r='64'/%3E%3Ccircle cx='241.85' cy='131' r='64'/%3E%3Ccircle cx='241.85' cy='195' r='64'/%3E%3Ccircle cx='241.85' cy='259' r='64'/%3E%3Ccircle cx='297.28' cy='-29' r='64'/%3E%3Ccircle cx='297.28' cy='35' r='64'/%3E%3Ccircle cx='297.28' cy='99' r='64'/%3E%3Ccircle cx='297.28' cy='163' r='64'/%3E%3Ccircle cx='297.28' cy='227' r='64'/%3E%3Ccircle cx='297.28' cy='291' r='64'/%3E%3C/g%3E%3Ccircle cx='131' cy='131' r='64' fill='none' stroke='%23FFD700' stroke-width='3'/%3E%3C/g%3E%3C/symbol%3E%3C/defs%3E%3Cg stroke='%23FFD700' stroke-width='1' opacity='0.5'%3E%3Cline x1='400' y1='400' x2='400' y2='140'/%3E%3Cline x1='400' y1='400' x2='625' y2='270'/%3E%3Cline x1='400' y1='400' x2='625' y2='530'/%3E%3Cline x1='400' y1='400' x2='400' y2='660'/%3E%3Cline x1='400' y1='400' x2='175' y2='530'/%3E%3Cline x1='400' y1='400' x2='175' y2='270'/%3E%3C/g%3E%3Cuse href='%23mahameru' x='269' y='269' width='262' height='262'/%3E%3Cuse href='%23mahameru' x='269' y='9' width='262' height='262'/%3E%3Cuse href='%23mahameru' x='494' y='139' width='262' height='262'/%3E%3Cuse href='%23mahameru' x='494' y='399' width='262' height='262'/%3E%3Cuse href='%23mahameru' x='269' y='529' width='262' height='262'/%3E%3Cuse href='%23mahameru' x='44' y='399' width='262' height='262'/%3E%3Cuse href='%23mahameru' x='44' y='139' width='262' height='262'/%3E%3C/svg%3E`;

                if (shouldCreate) {
                    console.log("Creating/Resetting Genesis Tree: Mahameru...");
                    const genesisBody = `The purpose of lightseed is to bring joy. The joy of realizing the bliss of conscious, compassionate, grateful existence by opening a portal to the center of life. By creating a bridge between creator and creation, science and spirituality, virtual and real, nothing and everything. It is designed to intimately connect our inner Self, our culture, our trees and the tree of life, the material and the digital, online world into a sustainable and sustaining circle of unified vibration, sound and light. It aims to merge us into a common flow for all beings to be liberated, wise, strong, courageous and connected. It is rooted in nonviolence, compassion, generosity, gratitude and love. It is blockchain (truthfulness), cloud (global, distributed, resilient), ai (for connecting dreams and technology), regen (nature centric) native. It is an inspiration, an impulse towards a quantum leap in consciousness, a prompt both for human and artificial intelligence for action towards transcending humanity into a new era, a New Earth, Universe and Field with the help of our most important evolutionary sisters and brothers, the trees.`;

                    const timestamp = Date.now();
                    const genesisHash = await createBlock("0", { message: "Genesis Pulse" }, timestamp);

                    await setDoc(genesisRef, {
                        ownerId: 'GENESIS_SYSTEM',
                        name: 'Mahameru',
                        shortTitle: 'Live Light',
                        body: genesisBody,
                        imageUrl: genesisSymbol, 
                        latitude: 50.8354,
                        longitude: 4.4145,
                        locationName: 'The Source (Brussels)',
                        createdAt: serverTimestamp(),
                        genesisHash: genesisHash,
                        latestHash: genesisHash,
                        blockHeight: 0,
                        validated: true,
                        validatorId: 'SYSTEM',
                        isNature: true
                    });

                    await setDoc(doc(db, 'visions', 'GENESIS_VISION'), {
                        lifetreeId: genesisId,
                        authorId: 'GENESIS_SYSTEM',
                        title: "Mahameru",
                        body: genesisBody,
                        imageUrl: genesisSymbol,
                        createdAt: serverTimestamp(),
                        link: "https://lightseed.online"
                    });
                    
                    if ((import.meta as any).env.MODE === 'clean') {
                        sessionStorage.setItem('genesis_reset', 'true');
                    }
                    console.log("Genesis Tree Planted.");
                }
            } catch (e) {
                console.warn("Genesis update skipped.", e);
            }
        })();
    }
    return genesisInitializationPromise;
}

export const plantLifetree = async (data: {
  ownerId: string, 
  name: string,
  shortTitle?: string,
  body: string, 
  imageUrl?: string,
  lat?: number,
  lng?: number,
  locName?: string,
  isNature?: boolean
}) => {
  if (!data.isNature) {
      const q = query(lifetreesCollection, where('ownerId', '==', data.ownerId), where('isNature', '!=', true));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
          const trees = snapshot.docs.map(d => d.data() as Lifetree);
          const personalTrees = trees.filter(t => !t.isNature);
          const allValidated = personalTrees.every(t => t.validated);
          if (!allValidated && personalTrees.length > 0) {
              throw new Error("Your existing Lifetree is not validated yet.");
          }
      }
  }

  const allTreesQuery = query(lifetreesCollection, limit(1));
  const allTreesSnap = await getDocs(allTreesQuery);
  const isFirstTree = allTreesSnap.empty;
  const isZetedi = auth.currentUser?.email === 'zetedi@gmail.com';
  const isValid = isFirstTree || isZetedi || data.name.trim().toLowerCase() === "phoenix" || data.isNature;
  const genesisData = { message: "Genesis Pulse", owner: data.ownerId, timestamp: Date.now() };
  const genesisHash = await createBlock("0", genesisData, Date.now());

  const treeDoc = await addDoc(lifetreesCollection, {
    ownerId: data.ownerId,
    name: data.name,
    shortTitle: data.shortTitle || null,
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
    validatorId: isValid ? (isFirstTree ? "GENESIS" : "SYSTEM") : null,
    isNature: data.isNature || false,
    guardians: [],
    status: 'HEALTHY'
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

export const updateLifetree = async (treeId: string, data: Partial<Lifetree>) => {
    const treeRef = doc(db, 'lifetrees', treeId);
    await updateDoc(treeRef, data);
}

export const deleteLifetree = async (treeId: string) => {
    await deleteDoc(doc(db, 'lifetrees', treeId));
}

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

export const fetchLifetrees = async (lastDoc?: QueryDocumentSnapshot): Promise<{items: Lifetree[], lastDoc: QueryDocumentSnapshot | null}> => {
  let q = query(lifetreesCollection, orderBy('createdAt', 'desc'), limit(12));
  if (lastDoc) {
      q = query(q, startAfter(lastDoc));
  }
  const querySnapshot = await getDocs(q);
  const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Lifetree));
  return {
      items,
      lastDoc: querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null
  };
};

export const getMyLifetrees = async (userId: string): Promise<Lifetree[]> => {
    if (!userId) return [];
    const q = query(lifetreesCollection, where('ownerId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Lifetree));
};

export const getGuardedTrees = async (userId: string): Promise<Lifetree[]> => {
    if (!userId) return [];
    const q = query(lifetreesCollection, where('guardians', 'array-contains', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Lifetree));
}

export const toggleGuardianship = async (treeId: string, userId: string, join: boolean) => {
    const treeRef = doc(db, 'lifetrees', treeId);
    await updateDoc(treeRef, {
        guardians: join ? arrayUnion(userId) : arrayRemove(userId)
    });
}

export const setTreeStatus = async (treeId: string, status: 'HEALTHY' | 'DANGER') => {
    const treeRef = doc(db, 'lifetrees', treeId);
    await updateDoc(treeRef, { status });
}

// --- VISIONS ---
export const fetchVisions = async (lastDoc?: QueryDocumentSnapshot): Promise<{items: Vision[], lastDoc: QueryDocumentSnapshot | null}> => {
    let q = query(visionsCollection, orderBy('createdAt', 'desc'), limit(12));
    if (lastDoc) {
        q = query(q, startAfter(lastDoc));
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({id: d.id, ...(d.data() as any)} as Vision));
    return {
        items,
        lastDoc: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null
    };
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

export const fetchPulses = async (lastDoc?: QueryDocumentSnapshot): Promise<{items: Pulse[], lastDoc: QueryDocumentSnapshot | null}> => {
  let q = query(pulsesCollection, orderBy('createdAt', 'desc'), limit(12));
  if (lastDoc) {
      q = query(q, startAfter(lastDoc));
  }
  const querySnapshot = await getDocs(q);
  const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Pulse));
  return {
      items,
      lastDoc: querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null
  };
};

export const getMyPulses = async (userId: string): Promise<Pulse[]> => {
    if (!userId) return [];
    const q = query(pulsesCollection, where('authorId', '==', userId));
    const snapshot = await getDocs(q);
    const pulses = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Pulse));
    return pulses.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
};

export const fetchGrowthPulses = async (treeId: string): Promise<Pulse[]> => {
    const q = query(
        pulsesCollection, 
        where('lifetreeId', '==', treeId), 
        where('type', '==', 'GROWTH')
    );
    const snap = await getDocs(q);
    const pulses = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Pulse));
    return pulses.sort((a,b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
}

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
    
    if (sourceTree.ownerId === 'GENESIS_SYSTEM' && pulseData.type === 'GROWTH') {
        const currentUserEmail = auth.currentUser?.email;
        if (currentUserEmail !== 'zetedi@gmail.com') {
            throw new Error("Only the Steward can update the Genesis Tree.");
        }
    }

    const prevHashSource = sourceTree.latestHash || sourceTree.genesisHash || "0";
    
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
      ...(pulseData.type === 'GROWTH' && pulseData.imageUrl ? { imageUrl: pulseData.imageUrl } : {})
    });
  });
};

export const proposeMatch = async (data: {
    initiatorPulseId: string,
    initiatorTreeId: string,
    initiatorUid: string,
    targetPulseId: string,
    targetTreeId: string, 
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

export const getMyMatchesHistory = async (userId: string): Promise<MatchProposal[]> => {
    const q1 = query(matchesCollection, where('targetUid', '==', userId), where('status', '==', 'ACCEPTED'));
    const q2 = query(matchesCollection, where('initiatorUid', '==', userId), where('status', '==', 'ACCEPTED'));
    
    const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const matches = [...s1.docs, ...s2.docs].map(d => ({id: d.id, ...d.data() as any} as MatchProposal));
    return matches.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
}

export const acceptMatch = async (proposalId: string) => {
    const matchRef = doc(db, 'matches', proposalId);
    return runTransaction(db, async (t) => {
        const matchDoc = await t.get(matchRef);
        if (!matchDoc.exists()) throw new Error("Match expired");
        const proposal = matchDoc.data() as MatchProposal;

        if (proposal.status !== 'PENDING') throw new Error("Match already processed");

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
            matchedLifetreeId: proposal.targetTreeId,
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

        t.update(matchRef, { status: 'ACCEPTED' });
    });
}

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
