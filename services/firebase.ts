
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
  onSnapshot,
  getCountFromServer
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

const SYSTEM_EMAIL_FROM = "lightseed <admin@lightseed.online>";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyCDcg27BljgJsVGuzNgS0NQWOgFIuDMlYI",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "lifeseed-75dfe.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "lifeseed-75dfe",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "lifeseed-75dfe.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "110675956366",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:110675956366:web:3cbc94aff415a800e6efdf",
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || "G-L95JY61SWQ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
export const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

const mailCollection = collection(db, 'mail');
const subsCollection = collection(db, 'subscriptions');
const usersCollection = collection(db, 'users');
const lifetreesCollection = collection(db, 'lifetrees');
const visionsCollection = collection(db, 'visions');
const pulsesCollection = collection(db, 'pulses');
const matchesCollection = collection(db, 'matches');

export const onAuthChange = (callback: (user: FirebaseUser | null) => void) => onAuthStateChanged(auth, callback);

export const signInWithGoogle = async () => {
  try { 
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);
      
      if (!userSnap.exists()) {
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

          await triggerSystemEmail(
              user.email || "", 
              "Welcome to lightseed", 
              `Welcome to lightseed, ${user.displayName}. You have planted your intention. Now you may plant your tree.`,
              user.uid
          );
      }
      return user; 
  } catch (error: any) { 
      console.error("Login Failed:", error); 
      throw error; 
  }
};

export const logout = () => firebaseSignOut(auth);

export const listenToUserProfile = (userId: string, callback: (data: any) => void) => {
    return onSnapshot(doc(db, 'users', userId), (docSnap) => {
        if (docSnap.exists()) callback(docSnap.data());
    });
}

export const deleteUserAccount = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("No user signed in");
    const uid = user.uid;
    const email = user.email;

    try {
        const treesQ = query(collection(db, 'lifetrees'), where('ownerId', '==', uid));
        const treesSnap = await getDocs(treesQ);
        const batch = writeBatch(db);
        treesSnap.docs.forEach(d => batch.delete(d.ref));

        const pulsesQ = query(collection(db, 'pulses'), where('authorId', '==', uid));
        const pulsesSnap = await getDocs(pulsesQ);
        pulsesSnap.docs.forEach(d => batch.delete(d.ref));

        const visionsQ = query(collection(db, 'visions'), where('authorId', '==', uid));
        const visionsSnap = await getDocs(visionsQ);
        visionsSnap.docs.forEach(d => batch.delete(d.ref));

        const userRef = doc(db, 'users', uid);
        batch.delete(userRef);
        await batch.commit();

        if (email) await triggerSystemEmail(email, "Goodbye from lightseed", "It was wonderful to have you. See you!", uid);
        await firebaseDeleteUser(user);
    } catch (e: any) {
        if (e.code === 'auth/requires-recent-login') throw new Error("Please log out and log in again to confirm deletion security.");
        throw e;
    }
}

export const checkAndIncrementAiUsage = async (type: 'text' | 'image'): Promise<boolean> => {
    const user = auth.currentUser;
    if (!user) return false;
    const userRef = doc(db, 'users', user.uid);
    try {
        await runTransaction(db, async (t) => {
            const docSnap = await t.get(userRef);
            if (!docSnap.exists()) throw new Error("User profile missing");
            const data = docSnap.data();
            const now = Date.now();
            const lastDate = new Date(data.lastAiReset || 0).getDate();
            const currentDate = new Date(now).getDate();
            let textCount = data.dailyAiText || 0;
            let imageCount = data.dailyAiImage || 0;
            if (lastDate !== currentDate) { textCount = 0; imageCount = 0; }
            if (type === 'text') {
                if (textCount >= 7) throw new Error("Daily Oracle limit reached (7/7).");
                textCount++;
            } else {
                if (imageCount >= 3) throw new Error("Daily Vision limit reached (3/3).");
                imageCount++;
            }
            t.update(userRef, { dailyAiText: textCount, dailyAiImage: imageCount, lastAiReset: now });
        });
        return true;
    } catch (e) { throw e; }
}

export const triggerSystemEmail = async (to: string, subject: string, text: string, userId?: string) => {
    const effectiveUid = userId || auth.currentUser?.uid;
    if (!effectiveUid) throw new Error("User ID required for email triggering.");
    try {
        return await addDoc(mailCollection, {
            to: [to],
            uid: effectiveUid,
            message: {
                from: SYSTEM_EMAIL_FROM,
                subject: subject,
                text: text,
                html: `<div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;"><h2 style="color: #059669; font-weight: 300; letter-spacing: 1px; margin-bottom: 20px;">.seed</h2><div style="font-size: 16px; margin-bottom: 30px;">${text.replace(/\n/g, '<br>')}</div><hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" /><p style="font-size: 12px; color: #9ca3af; text-align: center;">Sent from the <a href="https://lightseed.online" style="color: #059669; text-decoration: none;">Lifetree Network</a></p></div>`
            }
        });
    } catch (e) { throw e; }
}

export const sendInvite = async (targetEmail: string, customMessage: string, userId: string, inviteLink: string) => {
    const userRef = doc(db, 'users', userId);
    await runTransaction(db, async (t) => {
        const userDoc = await t.get(userRef);
        if (!userDoc.exists()) throw new Error("User profile not found");
        const currentInvites = userDoc.data().invitesRemaining || 0;
        if (currentInvites <= 0) throw new Error("No invites remaining.");
        t.update(userRef, { invitesRemaining: currentInvites - 1 });
    });
    await triggerSystemEmail(targetEmail, "You have been invited to lightseed", `${customMessage ? `"${customMessage}"\n\n` : ""}You have been invited to join the lightseed network. Join here: ${inviteLink}`, userId);
}

export const monitorMailStatus = (docId: string, onChange: (status: any) => void) => {
    return onSnapshot(doc(db, 'mail', docId), (docSnap) => {
        if (docSnap.exists()) onChange(docSnap.data().delivery);
    }, (error) => {
        if (error.code === 'permission-denied') onChange({ state: 'ERROR', error: 'Permission denied' });
    });
}

export const subscribeToNewsletter = async (email: string) => addDoc(subsCollection, { email, createdAt: serverTimestamp() });

export const uploadImage = async (file: File, path: string): Promise<string> => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
};

export const uploadBase64Image = async (base64String: string, path: string): Promise<string> => {
    const storageRef = ref(storage, path);
    await uploadString(storageRef, base64String, 'data_url');
    return await getDownloadURL(storageRef);
}

export const ensureGenesis = async () => {
    const genesisId = 'GENESIS_TREE';
    const genesisRef = doc(db, 'lifetrees', genesisId);
    try {
        const genesisSnap = await getDoc(genesisRef);
        if (!genesisSnap.exists()) {
            const genesisBody = `The purpose of lightseed is to bring joy. The joy of realizing the bliss of conscious, compassionate, grateful existence by opening a portal to the center of life. By creating a bridge between creator and creation, science and spirituality, virtual and real, nothing and everything. It is designed to intimately connect our inner Self, our culture, our trees and the tree of life, the material and the digital, online world into a sustainable and sustaining circle of unified vibration, sound and light. It aims to merge us into a common flow for all beings to be liberated, wise, strong, courageous and connected. It is rooted in nonviolence, compassion, generosity, gratitude and love. It is blockchain (truthfulness), cloud (global, distributed, resilient), ai (for connecting dreams and technology), regen (nature centric) native. It is an inspiration, an impulse towards a quantum leap in consciousness, a prompt both for human and artificial intelligence for action towards transcending humanity into a new era, a New Earth, Universe and Field with the help of our most important evolutionary sisters and brothers, the trees.`;
            const genesisHash = await createBlock("0", { message: "Genesis Pulse" }, Date.now());
            await setDoc(genesisRef, {
                ownerId: 'GENESIS_SYSTEM', name: 'Mahameru', shortTitle: 'Live Light', body: genesisBody,
                imageUrl: "", latitude: 50.8354, longitude: 4.4145, locationName: 'The Source',
                createdAt: serverTimestamp(), genesisHash, latestHash: genesisHash, blockHeight: 0,
                validated: true, validatorId: 'SYSTEM', isNature: true
            });
            await setDoc(doc(db, 'visions', 'GENESIS_VISION'), {
                lifetreeId: genesisId, authorId: 'GENESIS_SYSTEM', title: "Mahameru", body: genesisBody, createdAt: serverTimestamp()
            });
        }
    } catch (e) { console.warn("Genesis skip", e); }
}

export const getNetworkStats = async () => {
    try {
        const [trees, pulses, visions] = await Promise.all([
            getCountFromServer(collection(db, 'lifetrees')),
            getCountFromServer(collection(db, 'pulses')),
            getCountFromServer(collection(db, 'visions'))
        ]);
        return {
            trees: trees.data().count,
            pulses: pulses.data().count,
            visions: visions.data().count
        };
    } catch (e) {
        console.error("Failed to fetch network stats:", e);
        return { trees: 0, pulses: 0, visions: 0 };
    }
}

export const plantLifetree = async (data: any) => {
    const genesisHash = await createBlock("0", { msg: "Birth" }, Date.now());
    const treeDoc = await addDoc(lifetreesCollection, {
        ...data, 
        treeType: data.treeType || (data.isNature ? 'GUARDED' : 'LIFETREE'),
        createdAt: serverTimestamp(), genesisHash, latestHash: genesisHash, blockHeight: 0,
        validated: true, validatorId: "SYSTEM", guardians: [], status: 'HEALTHY'
    });
    await addDoc(visionsCollection, {
        lifetreeId: treeDoc.id, authorId: data.ownerId, title: "Root Vision", body: data.body, createdAt: serverTimestamp()
    });
    return treeDoc;
};

export const updateLifetree = (id: string, data: any) => updateDoc(doc(db, 'lifetrees', id), data);
export const deleteLifetree = (id: string) => deleteDoc(doc(db, 'lifetrees', id));
export const validateLifetree = (targetId: string, validatorId: string) => updateDoc(doc(db, 'lifetrees', targetId), { validated: true, validatorId });

export const fetchLifetrees = async (lastD?: QueryDocumentSnapshot) => {
    let q = query(lifetreesCollection, orderBy('createdAt', 'desc'), limit(12));
    if (lastD) q = query(q, startAfter(lastD));
    const snap = await getDocs(q);
    return { items: snap.docs.map(d => ({ id: d.id, ...d.data() } as Lifetree)), lastDoc: snap.docs[snap.docs.length-1] || null };
}

export const getMyLifetrees = async (uid: string) => (await getDocs(query(lifetreesCollection, where('ownerId', '==', uid)))).docs.map(d => ({ id: d.id, ...d.data() } as Lifetree));
export const getGuardedTrees = async (uid: string) => (await getDocs(query(lifetreesCollection, where('guardians', 'array-contains', uid)))).docs.map(d => ({ id: d.id, ...d.data() } as Lifetree));
export const toggleGuardianship = (id: string, uid: string, join: boolean) => updateDoc(doc(db, 'lifetrees', id), { guardians: join ? arrayUnion(uid) : arrayRemove(uid) });
export const setTreeStatus = (id: string, status: string) => updateDoc(doc(db, 'lifetrees', id), { status });

export const fetchVisions = async (lastD?: QueryDocumentSnapshot) => {
    let q = query(visionsCollection, orderBy('createdAt', 'desc'), limit(12));
    if (lastD) q = query(q, startAfter(lastD));
    const snap = await getDocs(q);
    return { items: snap.docs.map(d => ({ id: d.id, ...d.data() } as Vision)), lastDoc: snap.docs[snap.docs.length-1] || null };
}

export const getMyVisions = async (uid: string) => (await getDocs(query(visionsCollection, where('authorId', '==', uid)))).docs.map(d => ({ id: d.id, ...d.data() } as Vision));
export const createVision = (data: any) => addDoc(visionsCollection, { ...data, createdAt: serverTimestamp() });
export const deleteVision = (id: string) => deleteDoc(doc(db, 'visions', id));

export const fetchPulses = async (lastD?: QueryDocumentSnapshot) => {
    let q = query(pulsesCollection, orderBy('createdAt', 'desc'), limit(12));
    if (lastD) q = query(q, startAfter(lastD));
    const snap = await getDocs(q);
    return { items: snap.docs.map(d => ({ id: d.id, ...d.data() } as Pulse)), lastDoc: snap.docs[snap.docs.length-1] || null };
}

export const getMyPulses = async (uid: string) => (await getDocs(query(pulsesCollection, where('authorId', '==', uid)))).docs.map(d => ({ id: d.id, ...d.data() } as Pulse)).sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
export const fetchGrowthPulses = async (treeId: string) => (await getDocs(query(pulsesCollection, where('lifetreeId', '==', treeId), where('type', '==', 'GROWTH')))).docs.map(d => ({ id: d.id, ...d.data() } as Pulse)).sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

export const mintPulse = async (pulseData: any) => {
    return runTransaction(db, async (t) => {
        const treeRef = doc(db, 'lifetrees', pulseData.lifetreeId);
        const treeDoc = await t.get(treeRef);
        if (!treeDoc.exists()) throw new Error("Tree missing");
        const tree = treeDoc.data() as Lifetree;
        const newHash = await createBlock(tree.latestHash, pulseData, Date.now());
        const newPulseRef = doc(pulsesCollection);
        t.set(newPulseRef, { ...pulseData, id: newPulseRef.id, createdAt: serverTimestamp(), hash: newHash, previousHash: tree.latestHash });
        t.update(treeRef, { latestHash: newHash, blockHeight: (tree.blockHeight || 0) + 1 });
    });
}

export const proposeMatch = (data: any) => addDoc(matchesCollection, { ...data, status: 'PENDING', createdAt: serverTimestamp() });
export const getPendingMatches = async (uid: string) => (await getDocs(query(matchesCollection, where('targetUid', '==', uid), where('status', '==', 'PENDING')))).docs.map(d => ({ id: d.id, ...d.data() } as MatchProposal));

export const getMyMatchesHistory = async (uid: string) => {
    const [s1, s2] = await Promise.all([getDocs(query(matchesCollection, where('targetUid', '==', uid), where('status', '==', 'ACCEPTED'))), getDocs(query(matchesCollection, where('initiatorUid', '==', uid), where('status', '==', 'ACCEPTED')))]);
    return [...s1.docs, ...s2.docs].map(d => ({ id: d.id, ...d.data() } as MatchProposal)).sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
}

export const acceptMatch = async (proposalId: string) => {
    const matchRef = doc(db, 'matches', proposalId);
    return runTransaction(db, async (t) => {
        const matchDoc = await t.get(matchRef);
        if (!matchDoc.exists() || matchDoc.data()?.status !== 'PENDING') throw new Error("Invalid match");
        const proposal = matchDoc.data() as MatchProposal;
        
        const initTreeRef = doc(db, 'lifetrees', proposal.initiatorTreeId);
        const initTree = (await t.get(initTreeRef)).data() as Lifetree;
        const initHash = await createBlock(initTree.latestHash, { match: proposal.id }, Date.now());
        t.set(doc(pulsesCollection), { 
            lifetreeId: proposal.initiatorTreeId, type: 'STANDARD', title: 'Match', body: 'Pulse Sync', 
            isMatch: true, authorId: proposal.initiatorUid, authorName: 'System', 
            createdAt: serverTimestamp(), hash: initHash 
        });
        t.update(initTreeRef, { latestHash: initHash, blockHeight: initTree.blockHeight + 1 });

        const targetTreeRef = doc(db, 'lifetrees', proposal.targetTreeId);
        const targetTree = (await t.get(targetTreeRef)).data() as Lifetree;
        const targetHash = await createBlock(targetTree.latestHash, { match: proposal.id }, Date.now());
        t.set(doc(pulsesCollection), { 
            lifetreeId: proposal.targetTreeId, type: 'STANDARD', title: 'Match', body: 'Pulse Sync', 
            isMatch: true, authorId: proposal.targetUid, authorName: 'System', 
            createdAt: serverTimestamp(), hash: targetHash 
        });
        t.update(targetTreeRef, { latestHash: targetHash, blockHeight: targetTree.blockHeight + 1 });

        t.update(matchRef, { status: 'ACCEPTED' });
    });
}

export const isPulseLoved = async (id: string, uid: string) => (await getDoc(doc(db, 'pulses', id, 'loves', uid))).exists();
export const lovePulse = async (id: string, uid: string) => {
    const pulseRef = doc(db, 'pulses', id);
    const loveRef = doc(pulseRef, 'loves', uid);
    return runTransaction(db, async (t) => {
        const pulse = await t.get(pulseRef);
        const love = await t.get(loveRef);
        let count = pulse.data()?.loveCount || 0;
        if (love.exists()) { t.delete(loveRef); count--; }
        else { t.set(loveRef, { uid, createdAt: serverTimestamp() }); count++; }
        t.update(pulseRef, { loveCount: Math.max(0, count) });
    });
}
