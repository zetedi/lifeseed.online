import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase/core';
import { pushSubscriptionIdOf } from '../domain/push';
import { charter } from '../config/charter';

// PUSH on the device (ring 2026-09-06) — the seed is a PWA; when a being allows it, the browser
// hands the node a subscription (endpoint + keys), kept under users/{uid}/pushSubscriptions by
// its endpoint's id (domain/push), and functions/onReachCreated knocks there when a reach comes.
// The public VAPID key is public by nature; the private half is a functions secret.
export const VAPID_PUBLIC_KEY = charter.push.publicKey;

export type PushState = 'unsupported' | 'denied' | 'off' | 'on';

const urlBase64ToUint8Array = (base64: string): Uint8Array => {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

// A registration, if the PWA's worker stands (never waits on `ready` — in a window without a
// worker that promise would hang forever).
const registration = () => navigator.serviceWorker.getRegistration();

export const pushSupported = (): boolean =>
    typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const pushState = async (): Promise<PushState> => {
    if (!pushSupported()) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    const reg = await registration();
    if (!reg) return 'unsupported';
    return (await reg.pushManager.getSubscription()) ? 'on' : 'off';
};

export const enablePush = async (uid: string): Promise<PushState> => {
    if (!pushSupported()) return 'unsupported';
    const reg = await registration();
    if (!reg) return 'unsupported';
    if ((await Notification.requestPermission()) !== 'granted') return 'denied';
    const sub = await reg.pushManager.getSubscription()
        ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
    const json = sub.toJSON();
    await setDoc(doc(db, 'users', uid, 'pushSubscriptions', pushSubscriptionIdOf(sub.endpoint)), {
        endpoint: sub.endpoint,
        keys: { p256dh: json.keys?.p256dh || '', auth: json.keys?.auth || '' },
        userAgent: navigator.userAgent.slice(0, 200),
        createdAt: serverTimestamp(),
    });
    return 'on';
};

export const disablePush = async (uid: string): Promise<PushState> => {
    const reg = await registration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
        await deleteDoc(doc(db, 'users', uid, 'pushSubscriptions', pushSubscriptionIdOf(sub.endpoint))).catch(() => {});
        await sub.unsubscribe();
    }
    return 'off';
};
