// Firebase core: the single app/SDK initialization, the collection references, and the repository
// helpers shared across every aggregate module. Everything under services/firebase/ imports from
// here; services/firebase.ts re-exports the aggregates as one barrel so call sites stay unchanged.
import '../../utils/polyfill';
import { charter, nodeDomains } from '../../config/charter';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, onAuthStateChanged, GoogleAuthProvider, type User as FirebaseUser } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator, collection, doc } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { type Pulse } from '../../types';
import { normalizePulseType } from '../../domain/pulse';

// Robustly read a millisecond timestamp from a Firestore Timestamp, a JS Date, or nothing.
export const toMillis = (value: any): number =>
    value?.toMillis ? value.toMillis() : (value instanceof Date ? value.getTime() : 0);

// Repository boundary: map a Firestore doc snapshot → a domain object ({ id, ...fields }). The one
// place the `id`-merge + `as any` cast lives, so call sites read cleanly and stay type-consistent.
export const mapDoc = <T = any>(d: any): T => ({ id: d.id, ...d.data() } as any as T);

// Repository boundary: map a Firestore pulse doc → Pulse, normalising the legacy UPPERCASE
// type casing to canonical lowercase so the rest of the app only ever sees one form.
export const mapPulse = (d: any): Pulse => {
    const data = d.data() as any;
    return { id: d.id, ...data, type: normalizePulseType(data.type) } as Pulse;
};

export const SYSTEM_EMAIL_FROM = charter.mail.from;

export const getEnv = (key: string) => {
    return (window as any).process?.env?.[key] || (import.meta as any).env?.[key] || "";
};

// OAuth popups display — and load their helper pages (/__/auth/*) from — authDomain. Using the
// domain the user is ALREADY on makes the Google screen say "lightseed.online" instead of the
// firebaseapp.com project name, and keeps the helpers same-origin (which also sidesteps
// third-party-storage popup issues). Only domains served by THIS Firebase Hosting site can do
// that (Hosting auto-serves /__/auth/* there), and each one must first be wired up in the
// consoles: Firebase Auth → Authorized domains, AND the Google OAuth client's JS origins +
// redirect URI (https://<domain>/__/auth/handler). Everywhere else (localhost, previews) we
// fall back to the env authDomain.
const HOSTED_AUTH_DOMAINS = nodeDomains;
const currentHost = window.location.hostname.replace(/^www\./, '');

// The charter is the node (config/charter → node.json); an env var still overrides it, so a
// local run may point at an emulator or a preview project without touching the charter.
const web = charter.firebase.web;
const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY') || web.apiKey,
  authDomain: HOSTED_AUTH_DOMAINS.includes(currentHost) ? currentHost : (getEnv('VITE_FIREBASE_AUTH_DOMAIN') || web.authDomain),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID') || charter.firebase.projectId,
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET') || charter.firebase.bucket,
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || web.messagingSenderId,
  appId: getEnv('VITE_FIREBASE_APP_ID') || web.appId,
  measurementId: getEnv('VITE_FIREBASE_MEASUREMENT_ID') || web.measurementId,
};

console.log("Firebase Init - Project:", firebaseConfig.projectId, "Has Key:", !!firebaseConfig.apiKey);

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
export const storage = getStorage(app);
export const functions = getFunctions(app);
export const googleProvider = new GoogleAuthProvider();

// THE OFFLINE FOREST (npm run devui): with VITE_USE_EMULATORS set, every SDK binds to the local
// Firebase Emulator Suite, so the whole app runs without internet and without spending a byte of
// production data. Double-guarded to localhost so a production build can never carry it. Sign-in
// uses the Auth emulator's fake account picker; images land in the local Storage emulator; the
// data lives in ./.emulator-data between runs. Callables reach the local Functions emulator only
// if it was started; otherwise they fail fast and locally, never toward production.
if (getEnv('VITE_USE_EMULATORS') && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099');
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    console.log('Firebase emulators connected: the forest is running on this machine.');
}

export const mailCollection = collection(db, 'mail');
export const subsCollection = collection(db, 'subscriptions');
export const usersCollection = collection(db, 'users');
export const lifetreesCollection = collection(db, 'lifetrees');
export const visionsCollection = collection(db, 'visions');
export const pulsesCollection = collection(db, 'pulses');
export const alignmentsCollection = collection(db, 'alignments');
export const covenantsCollection = collection(db, 'covenants');
export const communitiesCollection = collection(db, 'communities');
export const lightHousesCollection = collection(db, 'lightHouses');
export const networkInvitesCollection = collection(db, 'networkInvites');
export const communityInvitesCollection = collection(db, 'communityInvites');
export const newsletterConfigRef = doc(db, 'config', 'newsletter');

export const onAuthChange = (callback: (user: FirebaseUser | null) => void) => onAuthStateChanged(auth, callback);
