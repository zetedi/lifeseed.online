import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentUpdated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import {
    randomUUID, randomBytes, createHash, createPublicKey,
    verify as verifySignature,
} from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import { judgeWitness, kindleDayKeyFromMs, uuidv7, releaseRay } from "./mint";
import { entryFor, COLLECTION_FOR_KIND } from "./beingIndex";
import { faceFeedOf, feedDomainOf } from "./faceEvents";
import { judgeOfferingAccept, offeringTwinBlocks, type OfferedToKind } from "./offering";
import { createBlock, computeCanonicalHash, BLOCK_HASH_VERSION } from "./chain";
import { FACE_PREVIEW_MAX_BYTES, facePreviewAttempts, facePreviewDoorOf, facePreviewKeyOf, facePreviewUrlOf } from "./facePreview";
import { getStorage } from "firebase-admin/storage";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { IMAGE_VARIANT_SIZES, IMAGE_VARIANT_QUALITY, imageVariantKeyOf, isDerivedImagePath } from "./imageVariant";
import sharp from "sharp";

// Every lid a server function mints is a UUIDv7 (the LIN invariant: a Being's true name is
// time-ordered and portable). node:crypto supplies the randomness; mint.ts the pure algorithm.
const mintLid = () => uuidv7(Date.now(), randomBytes(10));

initializeApp();

const db = getFirestore();

// --- Signing-key epochs -----------------------------------------------------------------------
// The app and this package intentionally share a fixed-field preimage contract rather than an
// import (functions/rootDir is isolated). Keep byte order in sync with src/domain/keyEpoch.ts;
// tests exercise the browser half and the callable verifies both Ed25519 hands before any mutation.
const KEY_EVENT_VERSION = "lifeseed.key-event.v1";
const KEY_ROTATION_DOMAIN = "lifeseed.key-rotation.v1";
const KEY_RECOVERY_DOMAIN = "lifeseed.key-recovery.v1";
const KEY_RECOVERY_QUORUM = 3;
const FINGERPRINT_RE = /^[a-f0-9]{64}$/;
const EVENT_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

const signingKeyFingerprint = (pubkey: string): string =>
    createHash("sha256").update(pubkey, "utf8").digest("hex");

const rotationPreimage = (claim: {
    uid: string;
    lid: string;
    eventId: string;
    fromFingerprint: string;
    toFingerprint: string;
}): string => [
    KEY_EVENT_VERSION,
    KEY_ROTATION_DOMAIN,
    claim.uid,
    claim.lid,
    claim.eventId,
    claim.fromFingerprint,
    claim.toFingerprint,
].join("\n");

interface RecoveryClaim {
    uid: string;
    lid: string;
    eventId: string;
    fromFingerprint: string;
    toFingerprint: string;
    suspectedSinceMs: number;
}

const recoveryPreimage = (claim: RecoveryClaim): string => [
    KEY_EVENT_VERSION,
    KEY_RECOVERY_DOMAIN,
    claim.uid,
    claim.lid,
    claim.eventId,
    claim.fromFingerprint,
    claim.toFingerprint,
    String(claim.suspectedSinceMs),
].join("\n");

const recoveryWitnessPreimage = (claim: RecoveryClaim, witnessUid: string): string => [
    KEY_EVENT_VERSION,
    KEY_RECOVERY_DOMAIN,
    "witness",
    witnessUid,
    claim.uid,
    claim.lid,
    claim.eventId,
    claim.fromFingerprint,
    claim.toFingerprint,
    String(claim.suspectedSinceMs),
].join("\n");

const canonicalBase64 = (value: string): boolean => {
    try {
        return Buffer.from(value, "base64").toString("base64") === value;
    } catch {
        return false;
    }
};

const verifiesEd25519 = (pubkey: string, signature: string, preimage: string): boolean => {
    try {
        if (!canonicalBase64(pubkey) || !canonicalBase64(signature)) return false;
        const key = createPublicKey({
            key: Buffer.from(pubkey, "base64"),
            format: "der",
            type: "spki",
        });
        return key.asymmetricKeyType === "ed25519"
            && verifySignature(
                null,
                Buffer.from(preimage, "utf8"),
                key,
                Buffer.from(signature, "base64"),
            );
    } catch {
        return false;
    }
};

// A routine rotation is cross-signed by the outgoing and incoming private keys. Auth names whose
// identity is being changed; the two signatures prove continuity. Frozen keys cannot rotate around
// a compromise declaration — they need the separate witnessed-recovery path.
export const rotateSigningKey = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to rotate a signing key.");
    const uid = request.auth.uid;
    const {
        eventId, lid, fromPubkey, toPubkey, fromFingerprint, toFingerprint, oldSig, newSig,
    } = (request.data || {}) as Record<string, unknown>;
    const values = { eventId, lid, fromPubkey, toPubkey, fromFingerprint, toFingerprint, oldSig, newSig };
    if (Object.values(values).some(value => typeof value !== "string" || !value)) {
        throw new HttpsError("invalid-argument", "The rotation proof is incomplete.");
    }
    const event = eventId as string;
    const fromKey = fromPubkey as string;
    const toKey = toPubkey as string;
    const fromFp = fromFingerprint as string;
    const toFp = toFingerprint as string;
    if (
        !EVENT_ID_RE.test(event)
        || (lid as string).length > 128
        || (lid as string).includes("\n")
        || !FINGERPRINT_RE.test(fromFp)
        || !FINGERPRINT_RE.test(toFp)
        || fromFp === toFp
        || fromKey.length > 1024
        || toKey.length > 1024
        || (oldSig as string).length > 1024
        || (newSig as string).length > 1024
    ) throw new HttpsError("invalid-argument", "The rotation proof is malformed.");
    if (signingKeyFingerprint(fromKey) !== fromFp || signingKeyFingerprint(toKey) !== toFp) {
        throw new HttpsError("invalid-argument", "A key does not match its fingerprint.");
    }
    const preimage = rotationPreimage({
        uid, lid: lid as string, eventId: event, fromFingerprint: fromFp, toFingerprint: toFp,
    });
    if (
        !verifiesEd25519(fromKey, oldSig as string, preimage)
        || !verifiesEd25519(toKey, newSig as string, preimage)
    ) throw new HttpsError("permission-denied", "Both the current and new key must sign the rotation.");

    const personRef = db.collection("persons").doc(uid);
    const oldKeyRef = personRef.collection("keys").doc(fromFp);
    const newKeyRef = personRef.collection("keys").doc(toFp);
    const eventRef = personRef.collection("keyEvents").doc(event);
    await db.runTransaction(async transaction => {
        const [personSnap, oldKeySnap, newKeySnap, eventSnap] = await Promise.all([
            transaction.get(personRef),
            transaction.get(oldKeyRef),
            transaction.get(newKeyRef),
            transaction.get(eventRef),
        ]);
        const person = personSnap.data() || {};
        if (
            !personSnap.exists
            || person.publicKeyPem !== fromKey
            || person.lid !== lid
            || person.signingKeyFingerprint !== fromFp
            || person.signingState !== "active"
        ) throw new HttpsError("failed-precondition", "The outgoing key is no longer the active epoch.");
        if (!oldKeySnap.exists || oldKeySnap.data()?.pubkey !== fromKey) {
            throw new HttpsError("failed-precondition", "The outgoing key has no anchored lineage.");
        }
        if (newKeySnap.exists) {
            throw new HttpsError("already-exists", "A routine rotation must move to a fresh key.");
        }
        if (eventSnap.exists) throw new HttpsError("already-exists", "This rotation event already exists.");

        const recordedAt = FieldValue.serverTimestamp();
        transaction.create(newKeyRef, { pubkey: toKey, publishedAt: recordedAt });
        transaction.create(eventRef, {
            version: 1,
            type: "rotate",
            uid,
            lid,
            epochId: event,
            keyFingerprint: toFp,
            previousFingerprint: fromFp,
            recordedAt,
            oldSig,
            newSig,
        });
        transaction.update(personRef, {
            publicKeyPem: toKey,
            signingKeyFingerprint: toFp,
            signingEpochId: event,
            signingState: "active",
            signingAnchoredAt: recordedAt,
            signingFrozenAt: FieldValue.delete(),
            signingFreezeEventId: FieldValue.delete(),
        });
    });
    return { epochId: event, fingerprint: toFp };
});

const recoveryWitnessEligible = async (uid: string): Promise<boolean> => {
    const initiate = await db.collection("initiates").doc(uid).get();
    if (initiate.exists) return true;
    const validatedTree = await db.collection("lifetrees")
        .where("ownerId", "==", uid)
        .where("validated", "==", true)
        .limit(1)
        .get();
    return !validatedTree.empty;
};

const recoveryClaimFrom = (uid: string, eventId: string, data: Record<string, unknown>): RecoveryClaim => ({
    uid,
    lid: data.lid as string,
    eventId,
    fromFingerprint: data.fromFingerprint as string,
    toFingerprint: data.toFingerprint as string,
    suspectedSinceMs: data.suspectedSinceMs as number,
});

// Recovery begins only after a one-way freeze. The candidate NEW key proves possession, but account
// auth cannot activate it; this merely opens a public-to-members proposal for three independent
// witnesses rooted in the validation web.
export const beginSigningKeyRecovery = onCall({ cors: true }, async request => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to begin recovery.");
    const uid = request.auth.uid;
    const { eventId, toPubkey, toFingerprint, newSig } =
        (request.data || {}) as Record<string, unknown>;
    if (
        typeof eventId !== "string" || !EVENT_ID_RE.test(eventId)
        || typeof toPubkey !== "string" || !toPubkey || toPubkey.length > 1024
        || typeof toFingerprint !== "string" || !FINGERPRINT_RE.test(toFingerprint)
        || typeof newSig !== "string" || !newSig || newSig.length > 1024
        || signingKeyFingerprint(toPubkey) !== toFingerprint
    ) throw new HttpsError("invalid-argument", "The recovery candidate is malformed.");

    const personRef = db.collection("persons").doc(uid);
    const proposalRef = personRef.collection("keyRecoveries").doc(eventId);
    const personSnap = await personRef.get();
    const person = personSnap.data() || {};
    if (
        !personSnap.exists
        || person.signingState !== "frozen"
        || typeof person.lid !== "string"
        || typeof person.signingKeyFingerprint !== "string"
        || typeof person.signingEpochId !== "string"
        || typeof person.signingFreezeEventId !== "string"
    ) throw new HttpsError("failed-precondition", "Freeze the current key before opening recovery.");
    if (person.signingKeyFingerprint === toFingerprint) {
        throw new HttpsError("invalid-argument", "Recovery must move to a fresh key.");
    }
    const [freezeSnap, epochSnap] = await Promise.all([
        personRef.collection("keyEvents").doc(person.signingFreezeEventId).get(),
        personRef.collection("keyEvents").doc(person.signingEpochId).get(),
    ]);
    const freeze = freezeSnap.data() || {};
    const freezeAt = freeze.recordedAt instanceof Timestamp
        ? freeze.recordedAt.toMillis() : 0;
    const suspectedSinceMs = freeze.claimedSuspectedSince instanceof Timestamp
        ? freeze.claimedSuspectedSince.toMillis() : freezeAt;
    const epochAt = epochSnap.data()?.recordedAt instanceof Timestamp
        ? epochSnap.data()!.recordedAt.toMillis() : 0;
    if (
        !freezeSnap.exists || !epochSnap.exists || !freezeAt || !epochAt
        || suspectedSinceMs < epochAt || suspectedSinceMs > freezeAt
    ) {
        throw new HttpsError("failed-precondition", "The freeze boundary is not trustworthy.");
    }
    const claim: RecoveryClaim = {
        uid,
        lid: person.lid,
        eventId,
        fromFingerprint: person.signingKeyFingerprint,
        toFingerprint,
        suspectedSinceMs,
    };
    if (!verifiesEd25519(toPubkey, newSig, recoveryPreimage(claim))) {
        throw new HttpsError("permission-denied", "The candidate key must sign its recovery.");
    }
    await db.runTransaction(async transaction => {
        const [freshPersonSnap, proposalSnap, newKeySnap] = await Promise.all([
            transaction.get(personRef),
            transaction.get(proposalRef),
            transaction.get(personRef.collection("keys").doc(toFingerprint)),
        ]);
        const freshPerson = freshPersonSnap.data() || {};
        if (
            freshPerson.signingState !== "frozen"
            || freshPerson.lid !== claim.lid
            || freshPerson.signingKeyFingerprint !== claim.fromFingerprint
            || freshPerson.signingFreezeEventId !== person.signingFreezeEventId
        ) throw new HttpsError("aborted", "The frozen identity changed while recovery opened.");
        if (proposalSnap.exists) throw new HttpsError("already-exists", "This recovery already exists.");
        if (newKeySnap.exists) throw new HttpsError("already-exists", "Recovery must use a fresh key.");
        transaction.create(proposalRef, {
            version: 1,
            uid,
            lid: person.lid,
            status: "open",
            fromFingerprint: claim.fromFingerprint,
            toFingerprint,
            toPubkey,
            suspectedSinceMs,
            newSig,
            createdAt: FieldValue.serverTimestamp(),
        });
    });
    return { eventId, recoveryCode: `${uid}:${eventId}`, suspectedSinceMs };
});

// A witness signs in their own current epoch. Eligibility is a public-root fact: git initiation or
// ownership of a validated tree. The witness signature is UID-bound, so one hand cannot occupy
// several witness slots even if several accounts publish the same public key.
export const witnessSigningKeyRecovery = onCall({ cors: true }, async request => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to witness recovery.");
    const witnessUid = request.auth.uid;
    const {
        targetUid, eventId, sig, pubkey, keyFingerprint, epochId,
    } = (request.data || {}) as Record<string, unknown>;
    if (
        typeof targetUid !== "string" || !targetUid || targetUid === witnessUid
        || typeof eventId !== "string" || !EVENT_ID_RE.test(eventId)
        || typeof sig !== "string" || !sig || sig.length > 1024
        || typeof pubkey !== "string" || !pubkey || pubkey.length > 1024
        || typeof keyFingerprint !== "string" || !FINGERPRINT_RE.test(keyFingerprint)
        || typeof epochId !== "string" || !EVENT_ID_RE.test(epochId)
        || signingKeyFingerprint(pubkey) !== keyFingerprint
    ) throw new HttpsError("invalid-argument", "The witness proof is malformed.");
    if (!(await recoveryWitnessEligible(witnessUid))) {
        throw new HttpsError(
            "permission-denied",
            "Recovery witnesses must be initiated or hold a validated lifetree.",
        );
    }

    const targetRef = db.collection("persons").doc(targetUid);
    const proposalRef = targetRef.collection("keyRecoveries").doc(eventId);
    const [proposalSnap, witnessPersonSnap] = await Promise.all([
        proposalRef.get(),
        db.collection("persons").doc(witnessUid).get(),
    ]);
    const proposal = proposalSnap.data() as Record<string, unknown> | undefined;
    const witnessPerson = witnessPersonSnap.data() || {};
    if (!proposalSnap.exists || !proposal || proposal.status !== "open") {
        throw new HttpsError("not-found", "This recovery is not open.");
    }
    if (
        witnessPerson.signingState !== "active"
        || witnessPerson.publicKeyPem !== pubkey
        || witnessPerson.signingKeyFingerprint !== keyFingerprint
        || witnessPerson.signingEpochId !== epochId
    ) throw new HttpsError("failed-precondition", "The witness key is not the current active epoch.");
    const claim = recoveryClaimFrom(targetUid, eventId, proposal);
    if (!verifiesEd25519(pubkey, sig, recoveryWitnessPreimage(claim, witnessUid))) {
        throw new HttpsError("permission-denied", "The witness signature does not bind to this recovery.");
    }
    const witnessRef = proposalRef.collection("witnesses").doc(`${witnessUid}__${epochId}`);
    await db.runTransaction(async transaction => {
        const [freshProposal, existing] = await Promise.all([
            transaction.get(proposalRef),
            transaction.get(witnessRef),
        ]);
        if (!freshProposal.exists || freshProposal.data()?.status !== "open") {
            throw new HttpsError("failed-precondition", "This recovery is no longer open.");
        }
        if (existing.exists) return;
        transaction.create(witnessRef, {
            witnessUid,
            version: 3,
            sig,
            pubkey,
            keyFingerprint,
            epochId,
            recordedAt: FieldValue.serverTimestamp(),
        });
    });
    return { witnessed: true };
});

export const activateSigningKeyRecovery = onCall({ cors: true }, async request => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to complete recovery.");
    const uid = request.auth.uid;
    const eventId = request.data?.eventId;
    if (typeof eventId !== "string" || !EVENT_ID_RE.test(eventId)) {
        throw new HttpsError("invalid-argument", "The recovery id is malformed.");
    }
    const personRef = db.collection("persons").doc(uid);
    const proposalRef = personRef.collection("keyRecoveries").doc(eventId);
    const [personSnap, proposalSnap, witnessesSnap] = await Promise.all([
        personRef.get(),
        proposalRef.get(),
        proposalRef.collection("witnesses").limit(20).get(),
    ]);
    const person = personSnap.data() || {};
    const proposal = proposalSnap.data() as Record<string, unknown> | undefined;
    if (
        !personSnap.exists
        || person.signingState !== "frozen"
        || !proposalSnap.exists
        || !proposal
        || proposal.status !== "open"
    ) throw new HttpsError("failed-precondition", "This recovery is not open on a frozen identity.");
    const claim = recoveryClaimFrom(uid, eventId, proposal);
    if (
        person.signingKeyFingerprint !== claim.fromFingerprint
        || person.lid !== claim.lid
        || typeof proposal.toPubkey !== "string"
        || typeof proposal.newSig !== "string"
        || signingKeyFingerprint(proposal.toPubkey) !== claim.toFingerprint
        || !verifiesEd25519(proposal.toPubkey, proposal.newSig, recoveryPreimage(claim))
    ) throw new HttpsError("failed-precondition", "The recovery proposal no longer matches the identity.");

    const assuredWitnesses: Array<{ uid: string; data: Record<string, unknown> }> = [];
    for (const witnessDoc of witnessesSnap.docs) {
        const witness = witnessDoc.data() as Record<string, unknown>;
        const witnessUid = witness.witnessUid;
        if (
            typeof witnessUid !== "string"
            || witnessDoc.id !== `${witnessUid}__${witness.epochId}`
        ) continue;
        if (!(await recoveryWitnessEligible(witnessUid))) continue;
        const witnessPersonSnap = await db.collection("persons").doc(witnessUid).get();
        const witnessPerson = witnessPersonSnap.data() || {};
        if (
            witness.version !== 3
            || witnessPerson.signingState !== "active"
            || witnessPerson.publicKeyPem !== witness.pubkey
            || witnessPerson.signingKeyFingerprint !== witness.keyFingerprint
            || witnessPerson.signingEpochId !== witness.epochId
            || typeof witness.pubkey !== "string"
            || typeof witness.sig !== "string"
            || !verifiesEd25519(
                witness.pubkey,
                witness.sig,
                recoveryWitnessPreimage(claim, witnessUid),
            )
        ) continue;
        assuredWitnesses.push({ uid: witnessUid, data: witness });
    }
    if (new Set(assuredWitnesses.map(witness => witness.uid)).size < KEY_RECOVERY_QUORUM) {
        throw new HttpsError(
            "failed-precondition",
            `Recovery needs ${KEY_RECOVERY_QUORUM} current, independent witnesses.`,
        );
    }

    const newKeyRef = personRef.collection("keys").doc(claim.toFingerprint);
    const eventRef = personRef.collection("keyEvents").doc(eventId);
    await db.runTransaction(async transaction => {
        const [freshPersonSnap, freshProposalSnap, newKeySnap, eventSnap] = await Promise.all([
            transaction.get(personRef),
            transaction.get(proposalRef),
            transaction.get(newKeyRef),
            transaction.get(eventRef),
        ]);
        const freshPerson = freshPersonSnap.data() || {};
        if (
            freshPerson.signingState !== "frozen"
            || freshPerson.lid !== claim.lid
            || freshPerson.signingKeyFingerprint !== claim.fromFingerprint
            || freshProposalSnap.data()?.status !== "open"
        ) throw new HttpsError("aborted", "The recovery boundary changed.");
        if (newKeySnap.exists || eventSnap.exists) {
            throw new HttpsError("already-exists", "The recovered epoch already exists.");
        }
        // Re-check each witness's CURRENT declaration in the same transaction that activates.
        for (const witness of assuredWitnesses.slice(0, KEY_RECOVERY_QUORUM)) {
            const current = (await transaction.get(db.collection("persons").doc(witness.uid))).data() || {};
            if (
                current.signingState !== "active"
                || current.publicKeyPem !== witness.data.pubkey
                || current.signingKeyFingerprint !== witness.data.keyFingerprint
                || current.signingEpochId !== witness.data.epochId
            ) throw new HttpsError("aborted", "A witness epoch changed; ask them to witness again.");
        }
        const recordedAt = FieldValue.serverTimestamp();
        transaction.create(newKeyRef, { pubkey: proposal.toPubkey, publishedAt: recordedAt });
        transaction.create(eventRef, {
            version: 1,
            type: "recover",
            uid,
            lid: claim.lid,
            epochId: eventId,
            keyFingerprint: claim.toFingerprint,
            previousFingerprint: claim.fromFingerprint,
            suspectedSince: Timestamp.fromMillis(claim.suspectedSinceMs),
            recoveryId: eventId,
            recordedAt,
        });
        transaction.update(personRef, {
            publicKeyPem: proposal.toPubkey,
            signingKeyFingerprint: claim.toFingerprint,
            signingEpochId: eventId,
            signingState: "active",
            signingAnchoredAt: recordedAt,
            signingFrozenAt: FieldValue.delete(),
            signingFreezeEventId: FieldValue.delete(),
        });
        transaction.update(proposalRef, {
            status: "activated",
            activatedAt: recordedAt,
        });
    });
    return { epochId: eventId, fingerprint: claim.toFingerprint };
});

// --- Email via the Firestore `mail` collection (Firebase Trigger Email extension) -------------
// All outbound email stays in-house: writing a doc to `mail` queues it through the installed
// firestore-send-email extension (Nodemailer under the hood, so `message.headers` are forwarded —
// that's how the newsletter's List-Unsubscribe headers reach the recipient).
const EMAIL_FROM = "lightseed <admin@lightseed.online>";

const writeMail = async (params: { to: string | string[]; subject: string; html: string; text?: string; headers?: Record<string, string>; uid?: string }) => {
    // Firestore rejects any document containing `undefined` (the extension doc write would fail
    // with "Cannot use undefined as a Firestore value"), so optional fields are only set when present.
    const message: any = { from: EMAIL_FROM, subject: params.subject, html: params.html || "" };
    if (params.text) message.text = params.text;
    if (params.headers) message.headers = params.headers;
    await db.collection("mail").add({
        to: Array.isArray(params.to) ? params.to : [params.to],
        uid: params.uid || null,
        message,
        createdAt: FieldValue.serverTimestamp(),
    });
};

// The branded system-email shell, composed SERVER-SIDE so a client can never inject arbitrary
// HTML (previously the client passed a full `html` string — an open phishing relay). Text is
// HTML-escaped; the CTA is only rendered for an already-validated http(s) URL.
const escapeHtml = (s: string): string =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const composeSystemEmailHtml = (text: string, ctaUrl: string, ctaLabel: string): string => {
    const body = escapeHtml(text).replace(/\n/g, "<br>");
    const cta = ctaUrl
        ? `<div style="margin:24px 0;"><a href="${ctaUrl}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;font-weight:bold;padding:12px 26px;border-radius:9999px;font-size:15px;">${escapeHtml(ctaLabel)}</a></div><p style="font-size:12px;color:#9ca3af;">Or paste this link:<br/><a href="${ctaUrl}" style="color:#059669;word-break:break-all;">${escapeHtml(ctaUrl)}</a></p>`
        : "";
    return `<div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;"><h2 style="color: #059669; font-weight: 300; letter-spacing: 1px; margin-bottom: 20px;">.seed</h2><div style="font-size: 16px; margin-bottom: 8px;">${body}</div>${cta}<hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" /><p style="font-size: 12px; color: #9ca3af; text-align: center;">Sent from the <a href="https://lightseed.online" style="color: #059669; text-decoration: none;">Lifetree Network</a><br/>The O House, Bigeh Island, Aswan, Egypt</p></div>`;
};

// --- Staff check + server-authoritative daily quotas -----------------------------------------
const isStaffUid = async (uid: string): Promise<boolean> => {
    const [superadmin, adminDoc] = await Promise.all([
        db.collection("config").doc("superadmin").get(),
        db.collection("admins").doc(uid).get(),
    ]);
    return adminDoc.exists || (superadmin.exists && superadmin.data()?.uid === uid);
};

const NODE_AI_TEXT_LIMIT = 21;
const NODE_AI_IMAGE_LIMIT = 3;
const DAILY_EMAIL_LIMIT = 20;

// Atomically check + increment a per-user daily counter in the server-only `usage/{uid}` doc, the
// AUTHORITATIVE gate (the mirrored client counter on the user doc is user-writable, so advisory
// only). Counters reset on the UTC day boundary. Throws resource-exhausted when the cap is hit.
// NODE-PAID AI IS A MEMBER BENEFIT (ring 2026-08-25): when a call spends the NODE's own key
// (no BYO key, not staff), the caller must be a VALIDATED MEMBER — an initiate (git ledger)
// or the owner of a validated tree. Reversible per node via config/limits.nodeAiValidatedOnly
// (default ON). BYO-key users and staff are never gated here. Throws a clear, client-shown
// refusal so an unvalidated visitor is told to connect their own key or get their tree
// validated, never left with a silent empty answer.
const isValidatedMember = async (uid: string): Promise<boolean> => {
    const initiate = await db.collection("initiates").doc(uid).get();
    if (initiate.exists) return true;
    const vt = await db.collection("lifetrees").where("ownerId", "==", uid).where("validated", "==", true).limit(1).get();
    return !vt.empty;
};
const nodeAiValidatedOnly = async (): Promise<boolean> => {
    try {
        const snap = await db.collection("config").doc("limits").get();
        const v = snap.exists ? (snap.data() as { nodeAiValidatedOnly?: boolean }).nodeAiValidatedOnly : undefined;
        return v !== false; // default ON: absent or true = restrict
    } catch { return true; }
};
const gateNodeAi = async (uid: string): Promise<void> => {
    if (await isStaffUid(uid)) return;
    if (!(await nodeAiValidatedOnly())) return;
    if (await isValidatedMember(uid)) return;
    throw new HttpsError("permission-denied", "node_ai_validated_only");
};

const enforceDailyQuota = async (uid: string, field: string, limit: number): Promise<void> => {
    const ref = db.collection("usage").doc(uid);
    const day = new Date().toISOString().slice(0, 10); // UTC yyyy-mm-dd
    await db.runTransaction(async (t) => {
        const data = (await t.get(ref)).data() as any || {};
        const sameDay = data.day === day;
        const current = sameDay ? (data[field] || 0) : 0;
        if (current >= limit) {
            throw new HttpsError("resource-exhausted", `Daily limit reached (${limit}). It resets at midnight UTC.`);
        }
        if (sameDay) t.set(ref, { [field]: current + 1 }, { merge: true });
        else t.set(ref, { day, [field]: 1 }); // new day: overwrite, clearing yesterday's counters
    });
};

// Secure Gemini API Proxy
export const generateAIContent = onCall({ 
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 300, 
    memory: "1GiB",      
    cors: true 
}, async (request) => {
    // Log request for debugging
    console.log("AI Request received. Authenticated:", !!request.auth);

    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { prompt, contents, model = 'gemini-3.5-flash', config, systemInstruction } = request.data;

    // Server-authoritative free-tier quota (Gemini always runs on the node key). Staff are exempt.
    // Image vs text is INFERRED from the request (image model / IMAGE modality) so a client can't
    // mislabel an image call to draw from the larger text allowance.
    const modalities = Array.isArray(config?.responseModalities)
        ? config.responseModalities.map((m: any) => String(m).toUpperCase()) : [];
    const isImage = /image/i.test(String(model)) || modalities.includes('IMAGE');
    await gateNodeAi(request.auth.uid); // node-paid AI: validated members only (config-dialed)
    if (!(await isStaffUid(request.auth.uid))) {
        await enforceDailyQuota(
            request.auth.uid,
            isImage ? 'dailyAiImage' : 'dailyAiText',
            isImage ? NODE_AI_IMAGE_LIMIT : NODE_AI_TEXT_LIMIT,
        );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
        console.error("GEMINI_API_KEY missing from environment secrets.");
        throw new HttpsError('failed-precondition', 'Gemini API key is not configured on the server.');
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const generativeModel = genAI.getGenerativeModel({
            model: model as string,
            systemInstruction: systemInstruction as string,
            generationConfig: config
        });
        
        const maxRetries = 4; // Increased retries
        let lastError: any;

        for (let i = 0; i <= maxRetries; i++) {
            try {
                console.log(`Attempting generation (${i+1}/${maxRetries+1})...`);
                const formattedContents = contents || [{ role: 'user', parts: [{ text: prompt }] }];
                const result = await generativeModel.generateContent({
                    contents: formattedContents
                });
                
                const response = result.response;

                // Extract an inline image FIRST. Image models return an image part (+ optional text);
                // calling response.text() on a response containing non-text parts throws in this SDK,
                // so pulling the image out before touching .text() is what makes image gen work.
                const candidate = response.candidates?.[0];
                const parts = candidate?.content?.parts || [];

                for (const part of parts) {
                    if (part.inlineData && part.inlineData.data) {
                        const mimeType = part.inlineData.mimeType || 'image/png';
                        let caption = "";
                        try { caption = response.text(); } catch (_) { /* image-only response */ }
                        return {
                            image: `data:${mimeType};base64,${part.inlineData.data}`,
                            text: caption
                        };
                    }
                }

                let text = "";
                try { text = response.text(); } catch (_) { text = ""; }
                return { text: text };
            } catch (error: any) {
                lastError = error;
                const errorText = error.message || "";
                const isRateLimit = errorText.includes('429') || error.status === 429 || errorText.toLowerCase().includes('quota') || errorText.toLowerCase().includes('overwhelmed');
                const isForbidden = errorText.includes('403') || error.status === 403 || errorText.includes('CONSUMER_SUSPENDED');
                
                console.warn(`Attempt ${i+1} failed:`, errorText);

                if (isForbidden) {
                    throw new HttpsError('permission-denied', 'The AI service is currently unavailable. The API key may be suspended or restricted. Please contact support.');
                }

                if (isRateLimit && i < maxRetries) {
                    const delay = Math.pow(2, i) * 2000 + Math.random() * 1000; // Heavier backoff
                    console.warn(`Gemini Rate Limit. Retrying in ${Math.round(delay)}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                
                if (isRateLimit && i === maxRetries) {
                   throw new HttpsError('resource-exhausted', 'The AI service is currently overwhelmed. Please wait a minute and try again.');
                }
                
                throw error;
            }
        }
        throw lastError;
    } catch (error: any) {
        console.error("Gemini Function Error Final:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message || 'AI Generation failed');
    }
});

// Secure transactional email — queued via the `mail` collection (Trigger Email extension). The
// body is composed SERVER-SIDE from plain text + an optional validated CTA link (the client can
// no longer supply raw HTML), recipients are validated, and each sender is capped per day — so a
// signed-in user can't turn the trusted sender into a phishing/spam relay.
export const sendSystemEmail = onCall({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }
    const uid = request.auth.uid;
    const toRaw = request.data?.to;
    const recipients: string[] = (Array.isArray(toRaw) ? toRaw : [toRaw])
        .filter((x: any) => typeof x === 'string' && x.trim())
        .map((x: string) => x.trim());
    const subject = String(request.data?.subject || '').slice(0, 200) || 'A message from lightseed';
    const text = String(request.data?.text || '').slice(0, 4000);
    const ctaUrl = request.data?.ctaUrl ? String(request.data.ctaUrl).slice(0, 500) : '';
    const ctaLabel = request.data?.ctaLabel ? String(request.data.ctaLabel).slice(0, 80) : 'Open';

    const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!recipients.length) throw new HttpsError('invalid-argument', 'A recipient is required.');
    if (recipients.length > 5) throw new HttpsError('invalid-argument', 'Too many recipients.');
    if (!recipients.every((r) => emailRe.test(r))) throw new HttpsError('invalid-argument', 'Invalid recipient address.');
    if (ctaUrl && !/^https?:\/\//i.test(ctaUrl)) throw new HttpsError('invalid-argument', 'Only http(s) links are allowed.');

    if (!(await isStaffUid(uid))) {
        await enforceDailyQuota(uid, 'dailyEmail', DAILY_EMAIL_LIMIT);
    }

    const html = composeSystemEmailHtml(text, ctaUrl, ctaLabel);
    const plain = ctaUrl ? `${text}\n\n${ctaUrl}` : text;
    try {
        await writeMail({ to: recipients, subject, html, text: plain, uid });
        return { success: true };
    } catch (error: any) {
        console.error("Email Error:", error);
        throw new HttpsError('internal', error?.message || 'Failed to queue email.');
    }
});

// Direct-message email delivery: when a reach pulse is created, email the recipient.
// Runs server-side so it can read the recipient's private profile/email (clients cannot
// read other users' docs) without exposing it to the sender. Direct-message email
// notifications are ON by default for everyone (early network) — only an explicit
// users/{uid}.emailNotifications.directMessages === false opts out. Newsletter
// subscription status is intentionally NOT used here.
export const onReachCreated = onDocumentCreated("pulses/{pulseId}", async (event) => {
    const snap = event.data;
    if (!snap) return;
    const pulse = snap.data() as any;

    if (pulse.type !== 'reach') return;

    // Recipients = everyone in the thread for a group reach (participantUids), or the single
    // addressed recipient for a 1:1 (recipientUid). Never the author of the message.
    const participantUids: string[] = Array.isArray(pulse.participantUids) ? pulse.participantUids : [];
    const recipients = (participantUids.length ? participantUids : (pulse.recipientUid ? [pulse.recipientUid] : []))
        .filter((uid: string) => uid && uid !== pulse.authorId);
    if (recipients.length === 0) return;

    // Basic per-thread throttle: at most one DM email per thread per recipient within this
    // window, so a burst of messages in one thread doesn't flood any one inbox.
    // TODO(notifications): consider a digest (e.g. "N new messages") instead of a hard skip.
    const THROTTLE_MS = 10 * 60 * 1000; // 10 minutes
    const threadKey = (pulse.threadId || `${pulse.reachTreeId || ''}_${pulse.lifetreeId || ''}`).replace(/\//g, '_');

    const message: string = pulse.content || pulse.body || '';
    const fromName: string = pulse.authorName || 'A Lifetree';
    const isGroup = participantUids.length > 0 && (pulse.isGroup === true || participantUids.length > 2);
    const audienceName: string = pulse.threadName || pulse.reachTreeName || 'a circle';

    const notify = async (recipientUid: string) => {
        try {
            const userSnap = await db.collection('users').doc(recipientUid).get();
            if (!userSnap.exists) return;
            const user = userSnap.data() as any;

            // Enabled by default; only an explicit false disables direct-message emails.
            if (user?.emailNotifications?.directMessages === false) return;
            const email = user.email;
            if (!email) return;

            const throttleRef = db.collection('mailThrottle').doc(`${recipientUid}__${threadKey}`);
            try {
                const throttleSnap = await throttleRef.get();
                const lastSentAt = throttleSnap.exists ? (throttleSnap.data()?.lastSentAt?.toMillis?.() ?? 0) : 0;
                if (Date.now() - lastSentAt < THROTTLE_MS) return; // recently emailed for this thread
            } catch (e) {
                console.warn("DM email throttle check failed; sending anyway", e);
            }

            const toName: string = isGroup ? audienceName : (pulse.recipientName || pulse.reachTreeName || 'your Lifetree');
            const lead = isGroup
                ? `${fromName} sent a message to ${toName} (a group you're in):`
                : `${fromName} sent a direct message to ${toName}:`;
            const subject = isGroup
                ? `${fromName} messaged ${toName} on lightseed`
                : `${fromName} sent ${toName} a direct message on lightseed`;
            const text = `${lead}\n\n"${message}"\n\nOpen your messages: https://lightseed.online`;
            const html = `<div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">` +
                `<h2 style="color: #059669; font-weight: 300; letter-spacing: 1px; margin-bottom: 6px;">.seed</h2>` +
                `<p style="font-size: 13px; color: #9ca3af; margin: 0 0 24px;">A new ${isGroup ? 'group message' : 'direct message'} for <strong style="color:#059669;">${toName}</strong></p>` +
                `<p style="font-size: 15px; margin: 0 0 10px; color:#6b7280;">${lead}</p>` +
                `<blockquote style="font-size: 16px; margin: 0 0 28px; padding: 16px 20px; background:#f0fdf4; border-left: 4px solid #059669; border-radius: 8px; color:#1f2937;">${message.replace(/\n/g, '<br>')}</blockquote>` +
                `<a href="https://lightseed.online" style="display:inline-block; background:#059669; color:#fff; text-decoration:none; font-weight:bold; padding:10px 22px; border-radius:9999px; font-size:14px;">Open your messages</a>` +
                `<hr style="border: 0; border-top: 1px solid #eee; margin: 24px 0;" />` +
                `<p style="font-size: 12px; color: #9ca3af;">You receive this because direct-message email notifications are on in your <a href="https://lightseed.online" style="color: #059669; text-decoration: none;">lightseed profile</a>. You can turn this off anytime.</p>` +
                `</div>`;

            await writeMail({ to: [email], subject, html, text, uid: recipientUid });

            // Record the send so the per-thread throttle can skip rapid follow-ups.
            await throttleRef.set({
                lastSentAt: FieldValue.serverTimestamp(),
                recipientUid,
                threadId: threadKey,
            });
        } catch (error) {
            console.error(`Direct message email to ${recipientUid} failed:`, error);
        }
    };

    await Promise.all(recipients.map(notify));
});

// --- Planting caps, enforced server-side -------------------------------------------------
// The client gate (domain/limits + plantLifetree) is advisory — a direct Firestore write
// bypasses it. This trigger is the backstop: when a tree lands over the node's caps
// (config/limits, defaults 193 lifetrees + 132 guarded per being; 193 = the UN roll,
// one citizenship-tree per country), the newest over-cap tree
// is uprooted. Quality, not quantity — enforced where it can't be dodged. Staff and the
// system are exempt, mirroring every other quota.
//
// Beds have their own ceilings: exempt from the 193/132 forest caps (furniture is not
// forest), but a HOUSED bed is bounded per Light House — else the open lightHouses create
// plus the bed exemption would reopen an unbounded, cap-exempt write channel into
// `lifetrees` — and a LOOSE bed (no house to bound it) is bounded per keeper.
const MAX_BEDS_PER_LIGHT_HOUSE = 64;
const MAX_LOOSE_BEDS_PER_KEEPER = 32;

// Shared bed-counting, consulted at birth (onLifetreeCreated) and on every home-move
// (onBedHomeMoved). Each count INCLUDES the bed just written, so `> MAX` means the
// ceiling is already breached.
const countBedsInHouse = async (houseId: string): Promise<number> => {
    const beds = await db.collection("lifetrees")
        .where("treeType", "==", "BED")
        .where("lightHouseId", "==", houseId)
        .get();
    return beds.size;
};

// LOOSE beds: the field may be absent or '', so count the keeper's beds and keep only
// the houseless ones.
const countLooseBedsOfKeeper = async (ownerId: string): Promise<number> => {
    const mine = await db.collection("lifetrees")
        .where("treeType", "==", "BED")
        .where("ownerId", "==", ownerId)
        .get();
    return mine.docs.filter((d) => !d.data().lightHouseId).length;
};

export const onLifetreeCreated = onDocumentCreated("lifetrees/{treeId}", async (event) => {
    const snap = event.data;
    if (!snap) return;
    const tree = snap.data() as any;
    const ownerId = tree.ownerId as string;
    if (!ownerId || ownerId === "GENESIS_SYSTEM") return;
    try {
        if (await isStaffUid(ownerId)) return;

        const isBedTree = (t: any) => t.treeType === "BED";

        // Beds (treeType BED, domain/bed.ts) are furniture, not the keeper's personal forest:
        // exempt from the 193/132 caps below, but bounded by their own ceilings. A HOUSED bed
        // counts against its Light House — otherwise anyone could mint a Light House and pour
        // unlimited cap-exempt beds into `lifetrees`. A LOOSE bed (no house — standing at a
        // coordinate under open stars) has no house to bound it, so it counts against its
        // keeper instead. Over either ceiling, the just-created bed is uprooted, mirroring
        // the forest-cap uproot below. (Mass Light-House creation itself remains a broader,
        // pre-existing vector — out of scope here; see root/QUESTIONS.md.)
        if (isBedTree(tree)) {
            const houseId = String(tree.lightHouseId ?? "");
            if (houseId === "") {
                const loose = await countLooseBedsOfKeeper(ownerId);
                if (loose > MAX_LOOSE_BEDS_PER_KEEPER) {
                    await snap.ref.delete();
                    console.warn(`Loose-bed cap enforced: uprooted ${snap.id} (keeper ${ownerId}, ${loose} loose beds vs ${MAX_LOOSE_BEDS_PER_KEEPER}).`);
                }
                return;
            }
            const housed = await countBedsInHouse(houseId);
            if (housed > MAX_BEDS_PER_LIGHT_HOUSE) {
                await snap.ref.delete();
                console.warn(`Bed cap enforced: uprooted ${snap.id} (lightHouse ${houseId}, ${housed} beds vs ${MAX_BEDS_PER_LIGHT_HOUSE}).`);
            }
            return;
        }

        const [limitsSnap, mine] = await Promise.all([
            db.collection("config").doc("limits").get(),
            db.collection("lifetrees").where("ownerId", "==", ownerId).get(),
        ]);
        const num = (v: any, fallback: number) => {
            const n = Number(v);
            return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
        };
        const raw = limitsSnap.exists ? limitsSnap.data() : {};
        const maxLifetrees = num(raw?.maxLifetrees, 193);
        const maxGuardedTrees = num(raw?.maxGuardedTrees, 132);

        const isGuardedTree = (t: any) => t.treeType === "GUARDED" || (!t.treeType && t.isNature === true);
        const trees = mine.docs.map((d) => d.data()).filter((t) => !isBedTree(t));
        const guarded = trees.filter(isGuardedTree).length;
        const lifetrees = trees.length - guarded;
        const over = isGuardedTree(tree) ? guarded > maxGuardedTrees : lifetrees > maxLifetrees;
        if (!over) return;

        await snap.ref.delete();
        console.warn(`Planting cap enforced: uprooted ${snap.id} (owner ${ownerId}, ${lifetrees} lifetrees / ${guarded} guarded vs ${maxLifetrees}/${maxGuardedTrees}).`);
    } catch (e) {
        console.error(`Planting cap check failed for ${snap.id}:`, e);
    }
});

// A bed's home is SOFT — `lightHouseId` may change after birth (loose ↔ housed, house to
// house), so the create-time ceilings above would be paper walls if the edit path could
// walk around them: plant 64 housed beds, edit them all loose, plant 64 more... Every
// HOME-MOVE therefore re-consults the DESTINATION's ceiling. A breaching move is REVERTED
// — the home returns to its prior value — never deleted: an established bed may already
// carry stays and leaves; only the newborn is uprooted (create path above).
//
// Loop-safety: we act only when the home actually changed, and only the DESTINATION is
// consulted — the source held this bed a moment ago, so returning there is within cap in
// the common case, and the revert's own echo-trigger finds its destination within cap and
// rests. If BOTH homes breach (caps crossed by concurrent moves), the bed is left LOOSE
// with a log line rather than ping-ponged between two full houses: loose is the absorbing
// state, so every path converges after at most one revert write.
export const onBedHomeMoved = onDocumentUpdated("lifetrees/{treeId}", async (event) => {
    const before = event.data?.before.data() as any;
    const after = event.data?.after.data() as any;
    if (!before || !after || after.treeType !== "BED") return;
    const beforeHouse = String(before.lightHouseId ?? "");
    const afterHouse = String(after.lightHouseId ?? "");
    if (beforeHouse === afterHouse) return; // no home-move — nothing to guard

    const ownerId = String(after.ownerId ?? "");
    if (!ownerId || ownerId === "GENESIS_SYSTEM") return;
    try {
        if (await isStaffUid(ownerId)) return; // staff stay exempt, mirroring every quota

        // Is the DESTINATION over its ceiling, with this bed now counted inside it?
        const overCap = afterHouse === ""
            ? (await countLooseBedsOfKeeper(ownerId)) > MAX_LOOSE_BEDS_PER_KEEPER
            : (await countBedsInHouse(afterHouse)) > MAX_BEDS_PER_LIGHT_HOUSE;
        if (!overCap) return;

        // Would returning breach the source house too? (+1: the bed would re-enter that count.)
        const sourceWouldBreach = beforeHouse !== ""
            && (await countBedsInHouse(beforeHouse)) + 1 > MAX_BEDS_PER_LIGHT_HOUSE;

        if (afterHouse === "" && sourceWouldBreach) {
            // Both homes breach and the bed already stands loose: leave it under open
            // stars and say so — a write would only ping-pong between two full homes.
            console.warn(`Bed cap: both homes of ${event.params.treeId} breach; left loose (keeper ${ownerId}).`);
            return;
        }
        const revertTo = sourceWouldBreach ? "" : beforeHouse;
        await event.data!.after.ref.update({ lightHouseId: revertTo });
        console.warn(`Bed cap enforced on home-move: ${event.params.treeId} sent home to ${revertTo === "" ? "the open stars (loose)" : revertTo} — destination ${afterHouse === "" ? "loose" : afterHouse} is over its ceiling (keeper ${ownerId}).`);
    } catch (e) {
        console.error(`Bed home-move cap check failed for ${event.params.treeId}:`, e);
    }
});

// --- Beds: availability + the leaves of who stayed -------------------------------------------
// A stay is a request to sleep in a specific BED (domain/stay.ts). Two server duties keep a bed's
// calendar honest and its story permanent.
const stayRangesOverlap = (a: { fromDate: string; toDate: string }, b: { fromDate: string; toDate: string }): boolean =>
    a.fromDate < b.toDate && b.fromDate < a.toDate; // half-open [from, to) — the departure day is free

// When a keeper ACCEPTS a stay: refuse a double-booking (a bed holds one guest at a time), then
// publish the identity-free occupancy so any guest sees busy/free nights. When a stay LEAVES
// 'accepted' (declined or withdrawn/deleted), withdraw that occupancy. Reverting a conflicting
// accept to 'declined' re-fires this trigger (accepted→declined), which finds no occupancy to
// remove and rests — convergent. (In the rare case a keeper accepts two overlapping requests in
// the very same instant, both may be declined; that is safe — a bed is never double-booked — and
// the keeper simply re-accepts one.)
export const onStayWritten = onDocumentWritten("stays/{stayId}", async (event) => {
    const before = event.data?.before?.data() as Record<string, unknown> | undefined;
    const after = event.data?.after?.data() as Record<string, unknown> | undefined;
    const stayId = event.params.stayId;
    const wasAccepted = before?.status === "accepted";
    const isAccepted = after?.status === "accepted";
    try {
        if (isAccepted && !wasAccepted && after) {
            const bedId = String(after.bedId || "");
            if (!bedId) return;
            const range = { fromDate: String(after.fromDate || ""), toDate: String(after.toDate || "") };
            const others = await db.collection("stays")
                .where("bedId", "==", bedId).where("status", "==", "accepted").get();
            const conflict = others.docs.some(d =>
                d.id !== stayId && stayRangesOverlap(d.data() as { fromDate: string; toDate: string }, range));
            if (conflict) {
                await event.data!.after!.ref.update({ status: "declined" });
                console.warn(`Bed double-booking refused: stay ${stayId} on bed ${bedId} overlaps an accepted stay — declined.`);
                return;
            }
            await db.doc(`lifetrees/${bedId}/occupancy/${stayId}`).set(range);
        } else if (wasAccepted && !isAccepted && before) {
            const bedId = String(before.bedId || "");
            if (bedId) await db.doc(`lifetrees/${bedId}/occupancy/${stayId}`).delete().catch(() => { /* already gone */ });
        }
    } catch (e) {
        console.error(`onStayWritten failed for ${stayId}:`, e);
    }
});

// The legacy block hash — sha256(JSON.stringify(pulseData) + previousHash + mintedAt) — the exact
// scheme mintPulse (src/services/firebase/pulses.ts) uses for an UNSEALED chain. A bed is not a
// node, so its chain is unsealed; the same UTF-8 preimage yields the same digest in Node, so a bed
// stays verifiable under src/domain/chain (linkage + height; legacy blocks aren't re-hashed).
const legacyBlockHash = (pulseData: object, previousHash: string, mintedAt: number): string =>
    createHash("sha256").update(JSON.stringify(pulseData) + previousHash + mintedAt).digest("hex");

// Seal ONE completed stay as a leaf on its bed's chain — atomically and idempotently: the mint,
// the bed's new head, and the stay's `leafed` flag ride a single transaction, so a leaf is never
// minted twice and concurrent mints cannot fork the chain (previousHash is always the freshly-read
// head). Mirrors mintPulse: the hashed `pulseData` is the immutable content; the stored doc adds id
// / lid / mintedAt / previousHash / createdAt / hash around it.
const mintStayLeaf = async (stayId: string): Promise<void> => {
    const stayRef = db.doc(`stays/${stayId}`);
    await db.runTransaction(async (t) => {
        const staySnap = await t.get(stayRef);
        const s = staySnap.data() as Record<string, any> | undefined;
        if (!staySnap.exists || !s || s.leafed || s.status !== "accepted") return;
        const bedRef = db.doc(`lifetrees/${s.bedId}`);
        const bedSnap = await t.get(bedRef);
        if (!bedSnap.exists) return;
        const bed = bedSnap.data() as Record<string, any>;
        const prevHash = String(bed.latestHash || bed.genesisHash || "0");
        const mintedAt = Date.now();
        const pulseData: Record<string, unknown> = {
            lifetreeId: s.bedId,
            type: "stay",
            visibility: "node",
            // The leaf wears the guest's chosen tree face only — never their human display name.
            // A guest who picked no tree stays anonymous ("A guest"); the node-visible chain must
            // not become an identity-linked whereabouts record for a real (loose-bed) coordinate.
            title: s.guestTreeName || "A guest",
            body: `stayed ${s.fromDate} → ${s.toDate}`,
            authorId: s.uid,
            authorName: s.guestTreeName || "",
            ...(s.guestTreeGrowthUrl ? { imageUrl: s.guestTreeGrowthUrl } : {}),
        };
        const hash = legacyBlockHash(pulseData, prevHash, mintedAt);
        const pulseRef = db.collection("pulses").doc();
        t.set(pulseRef, {
            ...pulseData,
            lid: mintLid(),
            id: pulseRef.id,
            loveCount: 0,
            commentCount: 0,
            mintedAt,
            previousHash: prevHash,
            stayId,
            createdAt: FieldValue.serverTimestamp(),
            hash,
        });
        t.update(bedRef, { latestHash: hash, blockHeight: (bed.blockHeight || 0) + 1 });
        t.update(stayRef, { leafed: true });
    });
};

// Daily: every accepted stay whose departure has passed and that isn't yet leafed becomes a
// permanent leaf on its bed's chain — the record of who stayed.
export const mintStayLeaves = onSchedule("every day 03:00", async () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const snap = await db.collection("stays").where("status", "==", "accepted").get();
    for (const d of snap.docs) {
        const s = d.data() as Record<string, any>;
        if (s.leafed || !(String(s.toDate || "") < today)) continue;
        try {
            await mintStayLeaf(d.id);
        } catch (e) {
            console.error(`mintStayLeaf failed for stay ${d.id}:`, e);
        }
    }
});

// ── THE MINT: light kindled from witnessed care (the sun ring; domain/light.ts) ────────────────
// Light enters the world ONLY through a GUARDIAN witnessing care for the living — and the mint is a
// SERVER CALLABLE (witnessWatering) that trusts nothing the client can forge: the witness is the
// AUTHENTICATED caller (not a stored field), the day is derived from the watering's own server
// timestamp, and the whole mint (carer's ray + witness's seventh + the pulse's confirmation) rides
// ONE transaction, so nothing is half-minted. Rays live in the server-only `rays` collection; no
// client may write one. This replaced trigger-based minting, which trusted client-supplied
// authorId / wateringConfirmedBy / mintedAt and could be driven with forged pulses (Lumo's review,
// 2026-07-20). The LAW itself (every accept/reject branch and the allocation) is the pure
// judgeWitness in ./mint.ts, mirror-tested against src/domain/light.ts from the root suite; this
// function owns only the transaction plumbing.

// The immutable body of a ray. The doc id is DETERMINISTIC (rays/{treeId}__{dayKey}__{role}), which
// enforces ONE KINDLE PER TREE PER DAY (life is the central bank) and idempotency in one stroke.
const rayDoc = (
    ray: { holderUid: string; role: "carer" | "witness"; units: number },
    sourceUid: string, treeId: string, communityId: string | undefined, dayKey: string, pulseId: string,
) => ({
    lid: mintLid(),
    holderUid: ray.holderUid,
    role: ray.role,
    sourceUid,     // whose witnessed care kindled it (the carer)
    treeId,
    dayKey,        // the calendar day this care kindled (the once-a-day bound)
    ...(communityId ? { communityId } : {}), // provenance; a solo carer's tree may have none
    units: ray.units,
    pulseId,       // provenance: the watering pulse that occasioned it
    kindledAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
});

// witnessWatering — the CIRCLE witnesses a watering, kindling the light. Everything is server-derived
// or server-verified: the witness is the authenticated caller; the carer is the pulse's (create-time
// auth-bound) author; the witness's standing (a guardian / co_owner / steward link, or keepership)
// must exist AND predate the watering (tenure — a sock account minted for the occasion has no voice,
// mirroring the guardian veto); the day is the
// watering's own; and the carer's ray, the witness's seventh, and the pulse's confirmation all ride
// ONE transaction. No client field decides who is paid, how much, or when — the facts gathered here
// go through judgeWitness (./mint.ts), the pure law the tests hold to the domain.
export const witnessWatering = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to witness a watering.");
    const witnessUid = request.auth.uid;
    const pulseId = request.data?.pulseId;
    if (!pulseId || typeof pulseId !== "string") throw new HttpsError("invalid-argument", "pulseId is required.");

    return db.runTransaction(async (t) => {
        // ── all reads first (transaction rule): gather the facts the judgment needs ──
        const pulseRef = db.doc(`pulses/${pulseId}`);
        const pulseSnap = await t.get(pulseRef);
        const pulse = (pulseSnap.data() ?? {}) as Record<string, any>;
        const carerUid = typeof pulse.authorId === "string" ? pulse.authorId : "";
        const treeId = typeof pulse.lifetreeId === "string" ? pulse.lifetreeId : "";
        const createdAtMs: number | null =
            (pulse.createdAt && typeof pulse.createdAt.toMillis === "function") ? pulse.createdAt.toMillis() : null;

        let witnessSinceMs: number | null = null;
        let treeFacts: { exists: boolean; treeType?: unknown; diedAtMs: number | null } = { exists: false, diedAtMs: null };
        let communityId: string | undefined;
        let carerRef: FirebaseFirestore.DocumentReference | null = null;
        let witnessRef: FirebaseFirestore.DocumentReference | null = null;
        let carerRayExists = false;
        let witnessRayExists = false;

        if (pulseSnap.exists && treeId) {
            // Standing = the earliest circle link the witness holds on this tree. A link without a
            // birth time predates the pulse by convention (old links).
            const msOf = (v: any): number => (v && typeof v.toMillis === "function") ? v.toMillis() : 0;
            const standing = (since: number) => { witnessSinceMs = witnessSinceMs === null ? since : Math.min(witnessSinceMs, since); };
            const linkSnaps = await Promise.all(["guardian", "co_owner", "steward"].map((rel) =>
                t.get(db.doc(`links/${witnessUid}__${rel}__${treeId}`))));
            for (const snap of linkSnaps) if (snap.exists) standing(msOf((snap.data() as any)?.createdAt));
            const treeSnap = await t.get(db.doc(`lifetrees/${treeId}`));
            if (treeSnap.exists) {
                const tree = treeSnap.data() as Record<string, any>;
                // The keeper stands in the circle from the tree's birth.
                if (tree.ownerId === witnessUid) standing(msOf(tree.createdAt));
                treeFacts = {
                    exists: true,
                    treeType: tree.treeType,
                    diedAtMs: (tree.diedAt && typeof tree.diedAt.toMillis === "function") ? tree.diedAt.toMillis() : null,
                };
                communityId = tree.communityId ? String(tree.communityId) : undefined;
            }
            if (createdAtMs !== null) {
                const dayKey = kindleDayKeyFromMs(createdAtMs);
                carerRef = db.doc(`rays/${treeId}__${dayKey}__carer`);
                witnessRef = db.doc(`rays/${treeId}__${dayKey}__witness`);
                carerRayExists = (await t.get(carerRef)).exists;
                witnessRayExists = (await t.get(witnessRef)).exists;
            }
        }

        const judgment = judgeWitness({
            witnessUid,
            pulse: {
                exists: pulseSnap.exists,
                care: pulse.care,
                wateringConfirmedBy: pulse.wateringConfirmedBy,
                carerUid, treeId, createdAtMs,
            },
            witnessSinceMs,
            tree: treeFacts,
            carerRayExists,
            witnessRayExists,
        });

        if (judgment.outcome === "reject") throw new HttpsError(judgment.code, judgment.message);
        if (judgment.outcome === "already") return { kindled: false, witnessUnits: 0, already: true };

        // ── writes ── (atomic: confirmation + both rays in this one transaction)
        t.update(pulseRef, {
            wateringConfirmedBy: "guardian",
            "wateringConfirmation.confirmedByUid": witnessUid,
            "wateringConfirmation.confirmedAt": FieldValue.serverTimestamp(),
        });
        if (judgment.carerRay && carerRef) t.set(carerRef, rayDoc(judgment.carerRay, carerUid, treeId, communityId, judgment.dayKey, pulseId));
        if (judgment.witnessRay && witnessRef) t.set(witnessRef, rayDoc(judgment.witnessRay, carerUid, treeId, communityId, judgment.dayKey, pulseId));

        return { kindled: judgment.carerRay !== null, witnessUnits: judgment.witnessRay ? judgment.witnessRay.units : 0 };
    });
});

// Community join requests: when a join_request link lands (someone pressed Join on a
// community), email that community's keeper. Server-side because the keeper's email lives on
// their private user doc, which the requester can never read. The Members tab is where the
// keeper accepts or declines; this email just carries the knock to their door.
export const onJoinRequestCreated = onDocumentCreated("links/{linkId}", async (event) => {
    const snap = event.data;
    if (!snap) return;
    const link = snap.data() as any;
    if (link.rel !== "join_request") return;

    try {
        const [communitySnap, personSnap, stewardSnap] = await Promise.all([
            db.collection("communities").doc(String(link.to)).get(),
            db.collection("persons").doc(String(link.from)).get(),
            // The knock reaches every door-keeper: the owner AND the delegated stewards.
            db.collection("links").where("rel", "==", "steward").where("to", "==", String(link.to)).get(),
        ]);
        if (!communitySnap.exists) return;
        const community = communitySnap.data() as any;
        const ownerId = community.ownerId as string;
        // Bound the fan-out: a knock reaches the owner and up to a few stewards, never an
        // unbounded blast (each recipient is one queued email against the node's quota).
        const MAX_KNOCK_RECIPIENTS = 6;
        const keeperIds = Array.from(new Set(
            [ownerId, ...stewardSnap.docs.map((d) => (d.data() as any).from as string)]
                .filter((uid) => uid && uid !== link.from),
        )).slice(0, MAX_KNOCK_RECIPIENTS);
        if (keeperIds.length === 0) return;

        const requester = (personSnap.exists && (personSnap.data() as any)?.displayName) || "Someone";
        const communityName = community.name || "your community";
        const text = `${requester} asked to join ${communityName}.\n\nYou can accept or decline on the community's Members tab.`;
        const html = composeSystemEmailHtml(text, "https://lightseed.online", "Open lightseed");
        await Promise.all(keeperIds.map(async (uid) => {
            const keeper = await db.collection("users").doc(uid).get();
            const email = keeper.exists ? (keeper.data() as any)?.email : null;
            if (!email) return;
            await writeMail({
                to: [email],
                subject: `${requester} asked to join ${communityName}`,
                html,
                text: `${text}\n\nhttps://lightseed.online`,
                uid,
            });
        }));
    } catch (e) {
        console.error("Join-request email failed:", e);
    }
});

// --- Node membership: an accepted network invite makes the newcomer a member of the node it
// was sent from (Phase 2, "invitations carry the node"). Runs server-side so the member link is
// minted with admin rights the newcomer could not grant themselves. The ESCALATION GUARD is the
// heart of it: anyone may create a network invite and stamp any node on it, so we mint membership
// ONLY when the INVITER actually belongs to that node (its owner or a member) — otherwise a
// stranger's invite could hand out membership of a community they have nothing to do with.
export const onNetworkInviteAccepted = onDocumentUpdated("networkInvites/{inviteId}", async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    // Only the pending → accepted transition, once.
    if (before.status === "accepted" || after.status !== "accepted") return;

    const nodeCommunityId = String(after.nodeCommunityId || "");
    const memberUid = String(after.acceptedByUserId || "");
    const inviterUid = String(after.invitedByUserId || "");
    // The hand that welcomed (ring 2026-08-21): EVERY acceptance — node-bound or plain —
    // leaves newcomer __welcomed_by__ inviter. Create-if-absent (redelivery-safe), before
    // the nodeless early-return below so a plain invitation still leaves its thread.
    if (memberUid && inviterUid && memberUid !== inviterUid) {
        const welcomeRef = db.collection("links").doc(`${memberUid}__welcomed_by__${inviterUid}`);
        try {
            if (!(await welcomeRef.get()).exists) {
                await welcomeRef.set({
                    lid: mintLid(), type: "link", rel: "welcomed_by", from: memberUid, to: inviterUid,
                    inviteId: event.params.inviteId, createdAt: FieldValue.serverTimestamp(),
                });
            }
        } catch (e) { console.warn("welcomed_by mint failed:", e); }
    }
    if (!nodeCommunityId || !memberUid || !inviterUid) return; // a plain (nodeless) invite: no membership

    try {
        const [community, inviterMember] = await Promise.all([
            db.collection("communities").doc(nodeCommunityId).get(),
            db.collection("links").doc(`${inviterUid}__member__${nodeCommunityId}`).get(),
        ]);
        if (!community.exists) return;
        const inviterBelongs = (community.data() as any)?.ownerId === inviterUid || inviterMember.exists;
        if (!inviterBelongs) {
            console.warn(`onNetworkInviteAccepted: inviter ${inviterUid} does not belong to node ${nodeCommunityId}; no membership minted for ${memberUid}.`);
            return;
        }
        // Mint TWO edges (mirrors the door's join): the `member` link (which the being may later
        // drop by leaving) and an append-only `invited_by` provenance mark (from=newcomer,
        // to=node) that survives leaving — how they arrived, who vouched. Both in a transaction
        // that creates each only when ABSENT, so Eventarc's at-least-once redelivery never rewrites
        // a stable lid or resets a join date (create-if-absent, never clobber).
        const memberRef = db.collection("links").doc(`${memberUid}__member__${nodeCommunityId}`);
        const provRef = db.collection("links").doc(`${memberUid}__invited_by__${nodeCommunityId}`);
        await db.runTransaction(async (tx) => {
            const [m, p] = await Promise.all([tx.get(memberRef), tx.get(provRef)]);
            const edge = (rel: string) => ({
                lid: mintLid(), type: "link", rel, from: memberUid, to: nodeCommunityId,
                inviteId: event.params.inviteId, invitedBy: inviterUid,
                createdAt: FieldValue.serverTimestamp(),
            });
            if (!m.exists) tx.set(memberRef, edge("member"));
            if (!p.exists) tx.set(provRef, edge("invited_by"));
        });
    } catch (e) {
        console.error("Node membership mint failed:", e);
    }
});

// --- Tree Circle: accept a co-ownership / guardianship invite -------------------
// Protected multi-document mutation: writes the tree's role array AND the rooted
// community. Runs with admin rights so the invitee never writes those docs directly.
const VALID_ROLES = ["co_owner", "guardian", "observer", "steward"];

export const acceptTreeInvite = onCall({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be signed in.");
    }
    const uid = request.auth.uid;
    const inviteId = request.data?.inviteId;
    if (!inviteId) {
        throw new HttpsError("invalid-argument", "inviteId is required.");
    }

    return await db.runTransaction(async (tx) => {
        const inviteRef = db.collection("treeOwnershipInvites").doc(inviteId);
        const inviteSnap = await tx.get(inviteRef);
        if (!inviteSnap.exists) {
            throw new HttpsError("not-found", "Invite not found.");
        }
        const invite = inviteSnap.data() as any;
        if (invite.invitedUserId !== uid) {
            throw new HttpsError("permission-denied", "This invite is not for you.");
        }
        if (invite.status !== "pending") {
            throw new HttpsError("failed-precondition", "This invite is no longer pending.");
        }

        const treeRef = db.collection("lifetrees").doc(invite.lifetreeId);
        const treeSnap = await tx.get(treeRef);
        if (!treeSnap.exists) {
            throw new HttpsError("not-found", "Lifetree not found.");
        }
        const tree = treeSnap.data() as any;

        if (!VALID_ROLES.includes(invite.role)) {
            throw new HttpsError("invalid-argument", "Unknown role.");
        }

        // Role + membership are LINKS now (the LIN). The tree/community docs no longer carry the
        // legacy arrays. Deterministic ids keep these writes idempotent.
        // The hand that welcomed (ring 2026-08-21): every acceptance leaves
        // accepter __welcomed_by__ inviter — append-only provenance, granting nothing.
        const setWelcome = (accepterUid: string, inviterUid: string, inviteId: string) => {
            if (!inviterUid || inviterUid === accepterUid) return;
            tx.set(db.collection("links").doc(`${accepterUid}__welcomed_by__${inviterUid}`), {
                lid: mintLid(), type: "link", rel: "welcomed_by", from: accepterUid, to: inviterUid,
                inviteId, createdAt: FieldValue.serverTimestamp(),
            }, { merge: true });
        };
        const setLink = (from: string, rel: string, to: string) => {
            tx.set(db.collection("links").doc(`${from}__${rel}__${to}`), {
                lid: mintLid(),
                type: "link",
                rel,
                from,
                to,
                createdAt: FieldValue.serverTimestamp(),
            });
        };

        const treeUpdate: any = { updatedAt: FieldValue.serverTimestamp() };
        let communityId: string = tree.communityId;
        // A GUARDIAN is a lightweight, no-privilege FOLLOW (domain/policy, the rules) — accepting a
        // guardian invitation mints only the guardian link, never a circle community or membership.
        // The caring roles (co_owner/steward) form the circle; guardianship watches over it.
        if (invite.role !== "guardian") {
            if (!communityId) {
                const communityRef = db.collection("communities").doc();
                communityId = communityRef.id;
                tx.set(communityRef, {
                    lid: mintLid(), // a community is a Being; the server-born circle gets its true name too
                    name: `${tree.name || "Lifetree"} Circle`,
                    rootLifetreeId: invite.lifetreeId,
                    founderUserId: tree.ownerId,
                    ownerId: tree.ownerId,
                    formation: "tree_co_ownership",
                    visibility: "invited",
                    // A tree circle is a PRE-COMMUNITY: a real community Being with NO address.
                    // Its locus is rootLifetreeId; the garden stays the TREE's relation (the
                    // tree's own domain and grows_in links). Inheriting tree.domain here once
                    // made a newborn circle claim a whole face's domain (ring 2026-08-28).
                    domain: "",
                    vision: "",
                    imageUrls: [],
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                });
                setLink(tree.ownerId, "member", communityId); // the founder is a member of the circle
                treeUpdate.communityId = communityId;
            }
            setLink(uid, "member", communityId);      // the invitee joins the circle community
        }
        setLink(uid, invite.role, invite.lifetreeId); // ...and takes their tree-circle role (or guardianship)
        setWelcome(uid, String(invite.invitedByUserId || ""), inviteId); // the hand that welcomed
        // Relations live ONLY in the links collection (the single source of truth the rules +
        // resolveCircleUids read). No legacy role arrays are written.

        tx.update(treeRef, treeUpdate);
        tx.update(inviteRef, {
            status: "accepted",
            acceptedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        return { communityId, lifetreeId: invite.lifetreeId };
    });
});

// ── The keeper circle (ring 2026-08-12, domain/keeperCircle) ─────────────────────────────
// A community is KEPT, and keeping can be shared, handed over, and asked for. The founding
// ownerId and every `keeper` link holder are FULL PEERS (rules isCommunityOwner). Keeper
// links are minted ONLY here — after proving the newcomer owns a living tree — and the one
// invariant these three hands defend together: a community is never keeperless.

// A keeper is a rooted being: at least one living tree of their own (a BED is furniture).
const ownsLivingTree = async (uid: string): Promise<boolean> => {
    const snap = await db.collection("lifetrees").where("ownerId", "==", uid).limit(10).get();
    return snap.docs.some((d) => (d.data() as any).treeType !== "BED");
};

const keeperLinkRef = (uid: string, communityId: string) =>
    db.collection("links").doc(`${uid}__keeper__${communityId}`);

const mintKeeperLinks = (tx: FirebaseFirestore.Transaction, uid: string, communityId: string) => {
    // Keeper implies member — a keeper who cannot stand inside their own community is a
    // contradiction. Deterministic ids keep both writes idempotent.
    for (const rel of ["keeper", "member"] as const) {
        tx.set(db.collection("links").doc(`${uid}__${rel}__${communityId}`), {
            lid: mintLid(), type: "link", rel, from: uid, to: communityId,
            createdAt: FieldValue.serverTimestamp(),
        }, { merge: true });
    }
};

// The invitee ACCEPTS a keeper offer (communityKeeperInvites) — consent, never appointment.
export const acceptKeeperInvite = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in.");
    const uid = request.auth.uid;
    const inviteId = String(request.data?.inviteId || "");
    if (!inviteId) throw new HttpsError("invalid-argument", "inviteId is required.");
    if (!(await ownsLivingTree(uid))) {
        throw new HttpsError("failed-precondition", "no_tree"); // a keeper is a rooted being
    }
    return await db.runTransaction(async (tx) => {
        const inviteRef = db.collection("communityKeeperInvites").doc(inviteId);
        const invite = (await tx.get(inviteRef)).data() as any;
        if (!invite) throw new HttpsError("not-found", "Invite not found.");
        if (invite.invitedUserId !== uid) throw new HttpsError("permission-denied", "This invite is not for you.");
        if (invite.status !== "pending") throw new HttpsError("failed-precondition", "This invite is no longer pending.");
        const community = (await tx.get(db.collection("communities").doc(invite.communityId))).data() as any;
        if (!community) throw new HttpsError("not-found", "Community not found.");
        if (community.ownerId === uid || (await tx.get(keeperLinkRef(uid, invite.communityId))).exists) {
            throw new HttpsError("failed-precondition", "already_keeper");
        }
        mintKeeperLinks(tx, uid, invite.communityId);
        // The hand that welcomed (ring 2026-08-21) — keepership arrived through this invite.
        const kInviter = String(invite.invitedByUserId || "");
        if (kInviter && kInviter !== uid) {
            tx.set(db.collection("links").doc(`${uid}__welcomed_by__${kInviter}`), {
                lid: mintLid(), type: "link", rel: "welcomed_by", from: uid, to: kInviter,
                inviteId, createdAt: FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        tx.update(inviteRef, { status: "accepted", acceptedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        return { communityId: invite.communityId };
    });
});

// A sitting keeper ANSWERS a keepership knock (a `keeper_request` link) with yes.
export const acceptKeeperRequest = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in.");
    const uid = request.auth.uid;
    const communityId = String(request.data?.communityId || "");
    const requesterUid = String(request.data?.requesterUid || "");
    if (!communityId || !requesterUid) throw new HttpsError("invalid-argument", "communityId and requesterUid are required.");
    if (!(await ownsLivingTree(requesterUid))) {
        throw new HttpsError("failed-precondition", "no_tree");
    }
    return await db.runTransaction(async (tx) => {
        const community = (await tx.get(db.collection("communities").doc(communityId))).data() as any;
        if (!community) throw new HttpsError("not-found", "Community not found.");
        const callerIsKeeper = community.ownerId === uid || (await tx.get(keeperLinkRef(uid, communityId))).exists;
        if (!callerIsKeeper) throw new HttpsError("permission-denied", "Only a keeper answers a keepership knock.");
        const requestRef = db.collection("links").doc(`${requesterUid}__keeper_request__${communityId}`);
        if (!(await tx.get(requestRef)).exists) throw new HttpsError("not-found", "No such request.");
        if (community.ownerId === requesterUid || (await tx.get(keeperLinkRef(requesterUid, communityId))).exists) {
            throw new HttpsError("failed-precondition", "already_keeper");
        }
        mintKeeperLinks(tx, requesterUid, communityId);
        tx.delete(requestRef); // the knock is answered — the door opened
        return { communityId, keeperUid: requesterUid };
    });
});

// A keeper RESIGNS — only with company (never keeperless). A keeper-link holder simply
// loses their link; the ANCHOR (ownerId) hands the anchor to the longest-standing keeper
// (oldest link, ties by uid — mirrors domain/keeperCircle.successorAmong exactly).
export const resignKeeper = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in.");
    const uid = request.auth.uid;
    const communityId = String(request.data?.communityId || "");
    if (!communityId) throw new HttpsError("invalid-argument", "communityId is required.");
    return await db.runTransaction(async (tx) => {
        const communityRef = db.collection("communities").doc(communityId);
        const community = (await tx.get(communityRef)).data() as any;
        if (!community) throw new HttpsError("not-found", "Community not found.");
        const linksSnap = await tx.get(
            db.collection("links").where("rel", "==", "keeper").where("to", "==", communityId));
        const keeperLinks = linksSnap.docs
            .map((d) => ({ from: (d.data() as any).from as string, createdAtMs: (d.data() as any).createdAt?.toMillis?.() || 0, ref: d.ref }))
            .filter((l) => l.from !== community.ownerId); // a stray anchor-duplicate is not company
        const isAnchor = community.ownerId === uid;
        const ownLink = keeperLinks.find((l) => l.from === uid);
        if (!isAnchor && !ownLink) throw new HttpsError("permission-denied", "You are not a keeper here.");
        // A link-holder's resignation always leaves the anchor standing; only the anchor
        // needs company (a successor) to leave — the invariant lives in these two branches.
        if (isAnchor) {
            if (keeperLinks.length === 0) throw new HttpsError("failed-precondition", "last_keeper");
            const successor = [...keeperLinks].sort((a, b) =>
                a.createdAtMs - b.createdAtMs || (a.from < b.from ? -1 : a.from > b.from ? 1 : 0))[0];
            tx.update(communityRef, { ownerId: successor.from, updatedAt: FieldValue.serverTimestamp() });
            tx.delete(successor.ref); // the successor IS the anchor now; the link would double-count them
            return { resigned: uid, successor: successor.from };
        }
        tx.delete(ownLink!.ref); // ownerId remains — never keeperless by construction
        return { resigned: uid, successor: null };
    });
});

// ── Circle graduation (domain/treeCircle formCircleRefusal) ─────────────────────────────
// A tree circle GRADUATES into a standing community by the hands that carry it: the keeper
// circle, or a co-owner of the root tree. Forming chooses the name, opens visibility, and
// stamps provenance — bornOn = the garden where the root tree stands (presence on that
// face's list WITHOUT claiming its domain), formedAt/formedBy by this hand alone (the
// rules freeze both against clients). Forming grants no keepership: the anchor stays.
export const formCommunityFromCircle = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in.");
    const uid = request.auth.uid;
    const communityId = String(request.data?.communityId || "");
    const name = String(request.data?.name || "").trim().slice(0, 120);
    if (!communityId) throw new HttpsError("invalid-argument", "communityId is required.");
    const communityRef = db.collection("communities").doc(communityId);
    const community = (await communityRef.get()).data();
    if (!community) throw new HttpsError("not-found", "Community not found.");
    if (community.formation !== "tree_co_ownership") throw new HttpsError("failed-precondition", "not_circle");
    if (community.formedAt) throw new HttpsError("failed-precondition", "already_formed");
    const rootTreeId = String(community.rootLifetreeId || "");
    const isKeeper = community.ownerId === uid
        || (await keeperLinkRef(uid, communityId).get()).exists;
    const isCoOwner = !!rootTreeId
        && (await db.collection("links").doc(`${uid}__co_owner__${rootTreeId}`).get()).exists;
    if (!isKeeper && !isCoOwner) throw new HttpsError("permission-denied", "not_hand");
    const tree = rootTreeId ? (await db.collection("lifetrees").doc(rootTreeId).get()).data() : null;
    const bornOn = normalizeAnchorDomain(String(tree?.domain || "")); // the garden, never the claim
    await communityRef.update({
        ...(name ? { name } : {}),
        ...(bornOn ? { bornOn } : {}),
        visibility: "public",
        formedAt: FieldValue.serverTimestamp(),
        formedBy: uid,
        updatedAt: FieldValue.serverTimestamp(),
    });
    return { communityId, name: name || String(community.name || ""), bornOn: bornOn || null };
});

// ── Domain verification (root/INTERBEING_MATRIX.md) ─────────────────────────────────────
// A DNS-01-style control proof (RFC 8555 §8.4) in an underscored namespace (RFC 8552):
// the server mints a single-use >=128-bit token bound to the community and its exact
// normalized domain; a keeper places it as a TXT record; the server OBSERVES it and writes
// the mark — the one hand the rules allow. DNS proves control of the anchor, never worth.
// Mirror of src/domain/domainVerification.ts + interbeingMatrix.normalizeAnchorDomain
// (functions/rootDir is isolated — keep the constants in sync with those laws' tests).
const DOMAIN_CHALLENGE_LABEL = "_lightseed-challenge";
const DOMAIN_CHALLENGE_PREFIX = "lightseed-verification=v1:";
const DOMAIN_CHALLENGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const normalizeAnchorDomain = (value: string): string => {
    const withoutScheme = value.trim().toLowerCase().replace(/^https?:\/\//, "");
    const authority = withoutScheme.split(/[/?#]/, 1)[0] || "";
    return authority.replace(/^www\./, "").replace(/:\d+$/, "");
};

// Caller must keep this community; returns the doc data or throws.
const communityKeptBy = async (communityId: string, uid: string) => {
    const community = (await db.collection("communities").doc(communityId).get()).data();
    if (!community) throw new HttpsError("not-found", "Community not found.");
    const isKeeper = community.ownerId === uid
        || (await keeperLinkRef(uid, communityId).get()).exists;
    if (!isKeeper) throw new HttpsError("permission-denied", "Only a keeper verifies the anchor.");
    return community;
};

// Get-or-mint the challenge — one live challenge per community. RESUME, never invalidate:
// a keeper places the TXT record and may return days later; reminting on every ask would
// orphan the record they already planted. The standing challenge is returned while it
// lives (unused, unexpired, same domain — mirror of domain/domainVerification
// challengeIsLive); only a used, expired, or moved-domain challenge is superseded.
export const startDomainVerification = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in.");
    const communityId = String(request.data?.communityId || "");
    if (!communityId) throw new HttpsError("invalid-argument", "communityId is required.");
    const community = await communityKeptBy(communityId, request.auth.uid);
    const domain = normalizeAnchorDomain(String(community.domain || ""));
    if (!domain) throw new HttpsError("failed-precondition", "no_domain");
    const challengeRef = db.collection("domainChallenges").doc(communityId);
    const standing = (await challengeRef.get()).data();
    if (standing && !standing.usedAt && standing.domain === domain
        && Date.now() - (standing.createdAt?.toMillis?.() ?? 0) < DOMAIN_CHALLENGE_TTL_MS) {
        return {
            domain,
            recordName: `${DOMAIN_CHALLENGE_LABEL}.${domain}`,
            recordValue: `${DOMAIN_CHALLENGE_PREFIX}${standing.token}`,
        };
    }
    const token = randomBytes(16).toString("hex"); // 128 bits, opaque, single-use
    await challengeRef.set({
        communityId, lid: community.lid || null, domain, token,
        createdBy: request.auth.uid, createdAt: FieldValue.serverTimestamp(), usedAt: null,
    });
    return {
        domain,
        recordName: `${DOMAIN_CHALLENGE_LABEL}.${domain}`,
        recordValue: `${DOMAIN_CHALLENGE_PREFIX}${token}`,
    };
});

// Observe the TXT record; on proof, write the server-only mark and retire the challenge.
export const checkDomainVerification = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in.");
    const communityId = String(request.data?.communityId || "");
    if (!communityId) throw new HttpsError("invalid-argument", "communityId is required.");
    const community = await communityKeptBy(communityId, request.auth.uid);
    const challengeRef = db.collection("domainChallenges").doc(communityId);
    const challenge = (await challengeRef.get()).data();
    if (!challenge) throw new HttpsError("failed-precondition", "no_challenge");
    if (challenge.usedAt) throw new HttpsError("failed-precondition", "challenge_used");
    const createdAtMs = challenge.createdAt?.toMillis?.() ?? 0;
    if (Date.now() - createdAtMs >= DOMAIN_CHALLENGE_TTL_MS) {
        throw new HttpsError("failed-precondition", "challenge_expired");
    }
    // The proof binds to the EXACT domain the challenge named — a community that moved
    // since must start over; nothing verifies an address it no longer claims.
    if (normalizeAnchorDomain(String(community.domain || "")) !== challenge.domain) {
        throw new HttpsError("failed-precondition", "domain_changed");
    }
    let records: string[][];
    try {
        records = await resolveTxt(`${DOMAIN_CHALLENGE_LABEL}.${challenge.domain}`);
    } catch {
        throw new HttpsError("failed-precondition", "txt_not_found");
    }
    const expected = `${DOMAIN_CHALLENGE_PREFIX}${challenge.token}`;
    if (!records.some((chunks) => chunks.join("") === expected)) {
        throw new HttpsError("failed-precondition", "txt_mismatch");
    }
    const batch = db.batch();
    batch.update(db.collection("communities").doc(communityId), {
        domainVerification: {
            domain: challenge.domain, method: "dns_txt",
            verifiedAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
    });
    // The consumed token is residue — the durable truth (domain, method, verifiedAt) lives
    // on the community doc; nothing is served by storing spent challenges.
    batch.delete(challengeRef);
    await batch.commit();
    return { verified: true, domain: challenge.domain };
});

// Request an invitation (callable, may be unauthenticated). With admin rights it checks
// whether a pending invite or request already exists for the email before creating one.
// Returns { status: 'created' | 'pending_invite_exists' | 'already_requested' }.
export const requestInvite = onCall({ cors: true }, async (request) => {
    const email = String(request.data?.email || "").trim().toLowerCase();
    const reason = String(request.data?.reason || "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        throw new HttpsError("invalid-argument", "Please provide a valid email.");
    }
    const invites = await db.collection("networkInvites").where("email", "==", email).get();
    if (invites.docs.some((d) => d.data().status === "pending")) {
        return { status: "pending_invite_exists" };
    }
    const reqs = await db.collection("inviteRequests").where("email", "==", email).get();
    if (reqs.docs.some((d) => d.data().status === "pending")) {
        return { status: "already_requested" };
    }
    await db.collection("inviteRequests").add({
        email,
        reason,
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
    });
    return { status: "created" };
});

// ---------------------------------------------------------------------------
// Intelligence Commons — provider credentials + live Claude (Anthropic)
//
// SECURITY: provider API keys live ONLY in the `providerCredentials` collection,
// which Firestore rules make completely unreadable/unwritable by clients. Keys
// reach the server over the encrypted callable channel and are read back only
// here, with the Admin SDK. They never touch a browser.
// ---------------------------------------------------------------------------

const credentialDocId = (scope: string, ownerId: string, provider: string) =>
    `${scope}_${ownerId}_${provider}`;

// May the caller set a key for this scope/owner?
//  - user scope:      only for their own uid
//  - community scope: the community owner, or any staff/superadmin
const canManageCredential = async (uid: string, scope: string, ownerId: string): Promise<boolean> => {
    if (scope === "user") return ownerId === uid;
    if (scope === "community") {
        if (!ownerId) return false;
        const [community, superadmin, adminDoc] = await Promise.all([
            db.collection("communities").doc(ownerId).get(),
            db.collection("config").doc("superadmin").get(),
            db.collection("admins").doc(uid).get(),
        ]);
        if (community.exists && community.data()?.ownerId === uid) return true;
        if (superadmin.exists && superadmin.data()?.uid === uid) return true;
        if (adminDoc.exists) return true;
    }
    return false;
};

// Who may SPEND a stored credential (the use path, broader than manage):
//  - user scope:      only the key's owner
//  - community scope: any member of the community (member link), its owner, or staff
// Mirrors the `isCommunityMember` gate in firestore.rules. A caller who fails this check
// is NOT rejected — generateClaudeContent silently falls back to the node key — so
// unauthorized callers simply can't spend someone else's BYO key.
const canUseCredential = async (uid: string, scope: string, ownerId: string): Promise<boolean> => {
    if (!ownerId) return false;
    if (scope === "user") return ownerId === uid;
    if (scope === "community") {
        const [memberLink, community, superadmin, adminDoc] = await Promise.all([
            db.collection("links").doc(`${uid}__member__${ownerId}`).get(),
            db.collection("communities").doc(ownerId).get(),
            db.collection("config").doc("superadmin").get(),
            db.collection("admins").doc(uid).get(),
        ]);
        if (memberLink.exists) return true;
        if (community.exists && community.data()?.ownerId === uid) return true;
        if (superadmin.exists && superadmin.data()?.uid === uid) return true;
        if (adminDoc.exists) return true;
    }
    return false;
};

// Store / rotate / remove a provider key. An empty key removes the credential.
// Returns a non-secret hint the client can display ("connected" + last 4 chars).
export const saveProviderCredential = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
    const uid = request.auth.uid;
    const scope = String(request.data?.scope || "");
    const ownerId = String(request.data?.ownerId || "");
    const provider = String(request.data?.provider || "");
    const key = String(request.data?.key || "").trim();
    const intelligenceId = request.data?.intelligenceId ? String(request.data.intelligenceId) : null;

    if (!["user", "community"].includes(scope)) throw new HttpsError("invalid-argument", "Bad scope.");
    if (!["anthropic", "openai", "deepseek", "google"].includes(provider)) throw new HttpsError("invalid-argument", "Unknown provider.");
    if (!(await canManageCredential(uid, scope, ownerId))) throw new HttpsError("permission-denied", "Not allowed to set this key.");

    const ref = db.collection("providerCredentials").doc(credentialDocId(scope, ownerId, provider));

    if (!key) {
        await ref.delete().catch(() => undefined);
        if (intelligenceId) {
            await db.collection("intelligences").doc(intelligenceId)
                .set({ connected: false, keyHint: FieldValue.delete() }, { merge: true }).catch(() => undefined);
        }
        return { connected: false };
    }

    const keyHint = key.length > 4 ? `…${key.slice(-4)}` : "set";
    await ref.set({
        provider, scope, ownerId, key,
        keyHint,
        updatedBy: uid,
        updatedAt: FieldValue.serverTimestamp(),
    });
    // Mirror the non-secret connection status onto the intelligence so the UI can show it.
    if (intelligenceId) {
        await db.collection("intelligences").doc(intelligenceId)
            .set({ connected: true, keyHint, credentialScope: scope, credentialOwnerId: ownerId }, { merge: true }).catch(() => undefined);
    }
    return { connected: true, keyHint };
});

// Live Claude (Anthropic) proxy. Resolves a BYO key for the given scope/owner,
// falling back to the node-wide ANTHROPIC_API_KEY secret when none is configured.
export const generateClaudeContent = onCall({
    secrets: ["ANTHROPIC_API_KEY"],
    timeoutSeconds: 120,
    memory: "512MiB",
    cors: true,
}, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");

    const messages = Array.isArray(request.data?.messages) ? request.data.messages : [];
    const systemInstruction = String(request.data?.systemInstruction || "");
    const model = String(request.data?.model || "claude-sonnet-5");
    const credential = request.data?.credential as { scope?: string; ownerId?: string } | undefined;

    // Resolve the key: BYO (user/community) first, node secret as fallback. The caller may
    // only spend a BYO key they're entitled to (own user key, or a community they belong to);
    // otherwise we ignore the named credential and fall through to the node key below.
    let apiKey: string | undefined;
    let usedByoKey = false;
    if (credential?.scope && credential.scope !== "node" && credential.ownerId
        && await canUseCredential(request.auth.uid, credential.scope, credential.ownerId)) {
        const snap = await db.collection("providerCredentials")
            .doc(credentialDocId(credential.scope, credential.ownerId, "anthropic")).get();
        if (snap.exists) { apiKey = snap.data()?.key; usedByoKey = !!apiKey; }
    }
    if (!apiKey) apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new HttpsError("failed-precondition", "No Claude key is connected for this intelligence yet.");
    }
    // The node free-tier quota applies only when spending the node key; BYO keys are unmetered.
    if (!usedByoKey) {
        await gateNodeAi(request.auth.uid); // node-paid AI: validated members only (config-dialed)
        if (!(await isStaffUid(request.auth.uid))) {
            await enforceDailyQuota(request.auth.uid, "dailyAiText", NODE_AI_TEXT_LIMIT);
        }
    }

    // Map our transcript (user|model) to Anthropic's (user|assistant); it must open on a user
    // turn. A message may carry image(s) (base64, no data: prefix) for vision — those become
    // Anthropic image content blocks ahead of the text.
    const mapped = messages
        .map((m: any) => {
            const role = m.role === "model" ? "assistant" : "user";
            const imgs = Array.isArray(m.images) ? m.images : (m.image ? [m.image] : []);
            if (imgs.length) {
                const blocks: any[] = imgs
                    .filter((im: any) => im && im.data)
                    .map((im: any) => ({
                        type: "image",
                        source: { type: "base64", media_type: im.mimeType || "image/webp", data: im.data },
                    }));
                if (m.text) blocks.push({ type: "text", text: String(m.text) });
                return { role, content: blocks };
            }
            return { role, content: String(m.text || "") };
        })
        .filter((m: any) => (typeof m.content === "string" ? m.content : m.content.length));
    const firstUser = mapped.findIndex((m: any) => m.role === "user");
    const convo = firstUser === -1 ? [] : mapped.slice(firstUser);
    if (convo.length === 0) return { text: "" };

    try {
        const client = new Anthropic({ apiKey });
        const result = await client.messages.create({
            model,
            max_tokens: 1024,
            system: systemInstruction || undefined,
            messages: convo as any,
        });
        const text = (result.content || [])
            .filter((b: any) => b.type === "text")
            .map((b: any) => b.text)
            .join("");
        return { text };
    } catch (error: any) {
        console.error("Claude generation error:", error?.message || error);
        const status = error?.status;
        if (status === 401 || status === 403) {
            throw new HttpsError("permission-denied", "The Claude key was rejected. Please check it in your AI settings.");
        }
        if (status === 429) {
            throw new HttpsError("resource-exhausted", "Claude is rate-limited right now. Please try again in a moment.");
        }
        throw new HttpsError("internal", error?.message || "Claude generation failed.");
    }
});

// ---------------------------------------------------------------------------
// Watering — the daily routine over all guarded trees.
//
// A tree carries an optional `watering` schedule { mode, intervalDays, lastWateredAt, ... }.
// Once a day this sweep finds the trees that are overdue and, at most once per day per tree,
// posts a tree-voiced "water me" reach into that tree's guardians thread — which the existing
// onReachCreated trigger then emails to the guardians. A *confirmed* watering (done client-side
// via a growth pulse) clears `watering.overdue` and re-lights the tree's living validation.
//
// The alert is a reach (a message), NOT a chain block: it carries the `WATER_ALERT` sentinel
// previousHash so it never advances the tree's immutable chain (mirrors how decisions/events
// are rooted). Reaches are excluded from tree timelines + the pulse feed, so this stays a DM.
// ---------------------------------------------------------------------------

const WATER_DAY_MS = 24 * 60 * 60 * 1000;

const tsToMs = (t: any): number =>
    t?.toMillis ? t.toMillis() : (t instanceof Date ? t.getTime() : (typeof t === "number" ? t : 0));

const sameUtcDay = (a: number, b: number): boolean => {
    if (!a || !b) return false;
    const da = new Date(a), dbb = new Date(b);
    return da.getUTCFullYear() === dbb.getUTCFullYear()
        && da.getUTCMonth() === dbb.getUTCMonth()
        && da.getUTCDate() === dbb.getUTCDate();
};

// Resolve a guarded tree's circle (co-guardians + guardians) from the LIN links — the single
// source of truth (also what the Firestore rules read). Legacy role arrays are not consulted.
const resolveGuardianUids = async (treeId: string): Promise<string[]> => {
    const links = await db.collection("links").where("to", "==", treeId).get();
    const fromLinks = links.docs
        .map((d) => d.data())
        .filter((x: any) => x.rel === "guardian" || x.rel === "co_owner")
        .map((x: any) => x.from as string);
    return Array.from(new Set(fromLinks.filter(Boolean)));
};

// Stage-aware voice: a potted seed speaks as a seed (mirrors the client's stage story).
const waterMeText = (treeName: string, daysOverdue: number, stage?: string): string => {
    const who = treeName || "This tree";
    const self = stage === "potted" ? "I'm a seed in my pot 🌱" : "I'm thirsty 💧";
    if (daysOverdue <= 0) return `${stage === "potted" ? "I'm a seed in my pot 🌱 and" : "I'm"} ready for watering 💧 — could a guardian care me today?`;
    if (daysOverdue === 1) return `${stage === "potted" ? "I'm a seed in my pot 🌱 getting thirsty" : "I'm getting thirsty 💧"} — it's been a day past my watering. Could a guardian care me?`;
    return `${self} — it's been ${daysOverdue} days past my watering. Could a guardian care me? — ${who}`;
};

export const checkWateringSchedules = onSchedule({
    schedule: "every day 08:00",
    timeZone: "Europe/Brussels",
    timeoutSeconds: 300,
    memory: "512MiB",
}, async () => {
    const now = Date.now();
    // Only the trees actually on a schedule — avoids reading the whole forest each day.
    const treesSnap = await db.collection("lifetrees").where("watering.mode", "==", "scheduled").get();

    for (const docSnap of treesSnap.docs) {
        try {
            const tree = docSnap.data() as any;
            const w = tree.watering;
            if (!w || w.mode !== "scheduled" || !w.intervalDays) continue;

            const lastWatered = tsToMs(w.lastWateredAt) || tsToMs(tree.createdAt) || 0;
            const nextDue = tsToMs(w.nextDueAt) || (lastWatered + Math.max(1, w.intervalDays) * WATER_DAY_MS);
            const overdue = now >= nextDue;

            if (!overdue) {
                if (w.overdue) await docSnap.ref.update({ "watering.overdue": false });
                continue;
            }

            const updates: Record<string, any> = { "watering.overdue": true };

            // At most one ping per tree per day (shared idempotency with the client check).
            if (!sameUtcDay(tsToMs(w.lastAlertAt), now)) {
                const ownerUid = tree.ownerId as string;
                const guardianUids = await resolveGuardianUids(docSnap.id);
                const participantUids = Array.from(new Set([ownerUid, ...guardianUids].filter(Boolean)));

                // Only ping if someone other than the author (the owner) will receive it.
                if (participantUids.filter((u) => u !== ownerUid).length > 0) {
                    const threadId = ["grp", docSnap.id, "guardians", ownerUid].join("__");
                    const daysOver = Math.max(0, Math.floor((now - nextDue) / WATER_DAY_MS));
                    const text = waterMeText(tree.name, daysOver, w.stage);

                    await db.collection("pulses").add({
                        lid: mintLid(), // even a nudge is a pulse, and a pulse is a Being (mirrors the client twin)
                        lifetreeId: docSnap.id,
                        type: "reach",
                        visibility: "private",
                        careAlert: "watering",
                        title: `Reach: ${tree.name} -> ${tree.name} (Guardians)`,
                        body: text,
                        content: text,
                        reachTreeId: docSnap.id,
                        reachTreeName: tree.name,
                        recipientName: tree.name,
                        recipientUid: null,
                        participantUids,
                        threadId,
                        threadName: `${tree.name} · Guardians`,
                        audience: "guardians",
                        isGroup: true,
                        seenBy: [],
                        authorId: ownerUid,            // the tree speaks through its principal
                        authorName: tree.name,         // the conversation face is the tree
                        authorPhoto: tree.imageUrl || null,
                        domain: tree.domain || "",
                        loveCount: 0,
                        commentCount: 0,
                        previousHash: "WATER_ALERT",   // a notification, not a chain block
                        hash: randomUUID(),
                        createdAt: FieldValue.serverTimestamp(),
                    });

                    updates["watering.lastAlertAt"] = FieldValue.serverTimestamp();
                    updates["watering.alertThreadId"] = threadId;
                }
            }

            await docSnap.ref.update(updates);
        } catch (e) {
            console.error(`Watering check failed for tree ${docSnap.id}:`, e);
        }
    }
});

// --- Newsletter (in-house, via the `mail` collection) ----------------------------------------
// Staff-gated. Fans out one `mail` doc per subscriber with a per-person unsubscribe token +
// List-Unsubscribe headers + a footer, CAN-SPAM/GDPR-safe, on our own pipeline (no third party).
// (isStaffUid is defined once near the top of this file, alongside the quota helpers.)

// Physical postal address for the newsletter footer (CAN-SPAM). TODO: replace with the real
// registered address before sending at volume.
const NEWSLETTER_POSTAL_ADDRESS = "The O House, Bigeh Island, Aswan, Egypt";

// Newsletter — in-house fan-out. Staff-only. Writes ONE `mail` doc per recipient (never a shared
// `to:`, which would leak addresses and break per-person unsubscribe), each with that
// subscriber's opaque unsubscribe token in the footer + List-Unsubscribe headers (RFC 8058).
// Writes are committed in throttled batches so a large list doesn't hammer Firestore at once.
export const sendNewsletterEmails = onCall({ timeoutSeconds: 300, memory: "512MiB", cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
    if (!(await isStaffUid(request.auth.uid))) throw new HttpsError("permission-denied", "Staff only.");
    const subject = String(request.data?.subject || "").trim();
    const html = String(request.data?.html || "").trim();
    if (!subject || !html) throw new HttpsError("invalid-argument", "Subject and content are required.");

    // Authoritative send list: the `subscriptions` collection where active === true.
    const subsSnap = await db.collection("subscriptions").get();
    const subs = subsSnap.docs.filter(d => { const s = d.data() as any; return s.email && s.active === true; });
    if (subs.length === 0) throw new HttpsError("failed-precondition", "No active subscribers.");

    let sent = 0;
    const CHUNK = 100; // commit mail writes (and any token backfills) in throttled batches
    for (let i = 0; i < subs.length; i += CHUNK) {
        const slice = subs.slice(i, i + CHUNK);
        const batch = db.batch();
        for (const doc of slice) {
            const data = doc.data() as any;
            const email = String(data.email);
            // Lazy-generate + persist an opaque unsubscribe token for subscribers without one.
            let token = data.unsubToken as string | undefined;
            if (!token) { token = randomUUID(); batch.set(doc.ref, { unsubToken: token }, { merge: true }); }

            const unsub = `https://lightseed.online/u/${token}`;
            const footer = `<hr style="border:0;border-top:1px solid #eee;margin:28px 0;"/>`
                + `<p style="font-size:12px;color:#9ca3af;line-height:1.6;">You're receiving this because you subscribed to the lightseed newsletter.<br/>`
                + `<a href="${unsub}" style="color:#059669;">Unsubscribe</a> · ${NEWSLETTER_POSTAL_ADDRESS}</p>`;
            const mailRef = db.collection("mail").doc();
            batch.set(mailRef, {
                to: [email],
                uid: data.uid || null,
                message: {
                    from: EMAIL_FROM,
                    subject,
                    html: `${html}${footer}`,
                    headers: {
                        "List-Unsubscribe": `<${unsub}>`,
                        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                    },
                },
                createdAt: FieldValue.serverTimestamp(),
            });
            sent++;
        }
        await batch.commit();
    }
    await db.collection("config").doc("newsletter").set({ lastSentAt: FieldValue.serverTimestamp(), lastSubject: subject, lastSent: sent }, { merge: true });
    return { sent, total: subs.length };
});

// One-click unsubscribe endpoint (the List-Unsubscribe target), rewritten in firebase.json as
// /u/**. Looks up by TOKEN only (never a uid — uids are guessable). Accepts GET (browser link,
// shows a confirmation page) and POST (RFC 8058 one-click, returns 200 with no body).
export const unsubscribe = onRequest({ cors: true }, async (req, res) => {
    // Path is /u/{token}; fall back to ?token= just in case.
    const fromPath = (req.path || "").split("/").filter(Boolean).pop() || "";
    const token = String(fromPath || (req.query.token as string) || "").trim();
    if (!token || token === "u") { res.status(400).send("Missing unsubscribe token."); return; }
    try {
        const snap = await db.collection("subscriptions").where("unsubToken", "==", token).limit(1).get();
        if (!snap.empty) {
            const doc = snap.docs[0];
            await doc.ref.set({ active: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
            // Mirror onto the user profile toggle if this subscriber has an account.
            const uid = (doc.data() as any).uid;
            if (uid) await db.collection("users").doc(uid).set({ newsletterSubscribed: false }, { merge: true }).catch(() => undefined);
        }
        if (req.method === "POST") { res.status(200).end(); return; } // one-click: no body needed
        res.set("Content-Type", "text/html").status(200).send(
            `<html><body style="font-family:sans-serif;text-align:center;padding:48px;color:#334155;"><h2 style="color:#059669;font-weight:300;letter-spacing:1px;">.seed</h2><p>You have been unsubscribed from the lightseed newsletter.</p><p style="color:#9ca3af;font-size:13px;">You can resubscribe anytime from your profile.</p></body></html>`,
        );
    } catch (e) {
        console.error("Unsubscribe failed", e);
        if (req.method === "POST") { res.status(200).end(); return; } // never fail a one-click POST
        res.status(500).send("Could not unsubscribe. Please try again later.");
    }
});

// --- Admin: browse users (for the deletion tool) ----------------------------------------------
// Staff-only. Returns a lightweight roster of user profiles (uid, email, name, createdAt) so an
// admin can pick who to delete without hunting for uids. Reads the `users` collection with admin
// rights (clients can't read other users' docs), newest first.
export const listUsersAsAdmin = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
    if (!(await isStaffUid(request.auth.uid))) throw new HttpsError("permission-denied", "Staff only.");

    const snap = await db.collection("users").orderBy("createdAt", "desc").limit(200).get();
    const superadmin = await db.collection("config").doc("superadmin").get();
    const superUid = superadmin.exists ? superadmin.data()?.uid : null;
    const users = snap.docs.map((d) => {
        const u = d.data() as any;
        return {
            uid: d.id,
            email: u.email || null,
            displayName: u.displayName || "",
            createdAt: u.createdAt?.toMillis?.() ?? null,
            isSuperAdmin: d.id === superUid,
        };
    });
    return { users };
});

// --- Admin: delete a user (auth + their data) ------------------------------------------------
// Staff-only. Removes the target's lifetrees/pulses/visions/links/person/user docs and their
// Auth record. Useful for re-testing onboarding. The node owner (superadmin) can't be deleted
// by a non-superadmin.
// Erase a being's data and Auth record, server-side and in order: content first, then the
// profile docs, then the Auth user LAST (admin SDK — no `requires-recent-login`, the failure
// mode that leaves a half-deleted account in limbo when done from the client). Shared by the
// admin path and the self-serve path so both delete the same things the same way.
// THE LAST SPEND (ring 2026-07-21): the departing being's light moves one final time. With a
// chosen heir the rays transfer through the prism (the glow keeps the default seventh); with
// none, each ray dissolves into its provenance community's glow, or the node's (glow/NODE).
// Rays held by OTHERS but sourced from the departed keep their units and lose the uid.
// Conservation to the last unit; the glow ledger (server-only) receives the commons' share.
async function releaseDepartingLight(uid: string, heirUid?: string): Promise<{ rays: number; unitsToHeir: number; unitsToGlow: number }> {
    let batch = db.batch();
    let ops = 0;
    const flush = async () => { if (ops > 0) { await batch.commit(); batch = db.batch(); ops = 0; } };
    const step = async () => { if (++ops >= 400) await flush(); };

    const held = await db.collection("rays").where("holderUid", "==", uid).get();
    const glowAdds = new Map<string, number>();
    let unitsToHeir = 0;
    let unitsToGlow = 0;
    for (const d of held.docs) {
        const r = d.data() as Record<string, any>;
        const release = releaseRay(
            { units: typeof r.units === "number" ? r.units : 0, communityId: r.communityId ? String(r.communityId) : null },
            !!heirUid,
        );
        if (release.glow > 0) {
            glowAdds.set(release.glowHome, (glowAdds.get(release.glowHome) || 0) + release.glow);
            unitsToGlow += release.glow;
        }
        if (heirUid && release.toHeir > 0) {
            unitsToHeir += release.toHeir;
            batch.update(d.ref, {
                holderUid: heirUid,
                units: release.toHeir,
                inheritedAt: FieldValue.serverTimestamp(),
                ...(r.sourceUid === uid ? { sourceUid: "departed" } : {}),
            });
        } else {
            batch.delete(d.ref);
        }
        await step();
    }
    for (const [home, units] of glowAdds) {
        batch.set(db.doc(`glow/${home}`), {
            units: FieldValue.increment(units),
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        await step();
    }
    // The witness sevenths (and gifts) others hold keep shining; only the departed uid unlinks.
    const sourced = await db.collection("rays").where("sourceUid", "==", uid).get();
    for (const d of sourced.docs) {
        if ((d.data() as Record<string, any>).holderUid === uid) continue; // released above
        batch.update(d.ref, { sourceUid: "departed" });
        await step();
    }
    await flush();
    return { rays: held.size, unitsToHeir, unitsToGlow };
}

async function purgeUserData(uid: string, heirUid?: string) {
    // The light first (the last spend), while the rest of the record still exists.
    const light = await releaseDepartingLight(uid, heirUid);
    const deleteWhere = async (coll: string, field: string) => {
        const qs = await db.collection(coll).where(field, "==", uid).get();
        for (let i = 0; i < qs.docs.length; i += 400) {
            const batch = db.batch();
            qs.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
            await batch.commit();
        }
        return qs.size;
    };
    const counts = {
        lifetrees: await deleteWhere("lifetrees", "ownerId"),
        pulses: await deleteWhere("pulses", "authorId"),
        visions: await deleteWhere("visions", "authorId"),
        links: await deleteWhere("links", "from"),
        ...light,
    };
    await db.collection("persons").doc(uid).delete().catch(() => undefined);
    await db.collection("users").doc(uid).delete().catch(() => undefined);
    try {
        await getAuth().deleteUser(uid);
    } catch (e: any) {
        // A missing Auth record is already the goal state (idempotent re-runs land here). Any
        // OTHER failure must surface: reporting success while the sign-in survives would leave
        // a live key to a purged account (Lumo's review, 2026-07-21). The data deletes above are
        // idempotent, so the caller simply runs the deletion again.
        if (e?.code !== "auth/user-not-found") {
            throw new HttpsError("internal", `The data was removed but the sign-in could not be: ${e?.message || e}. Run the deletion again.`);
        }
    }
    return counts;
}

export const deleteUserAsAdmin = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
    const callerUid = request.auth.uid;
    const targetUid = String(request.data?.uid || "").trim();
    if (!targetUid) throw new HttpsError("invalid-argument", "A target uid is required.");

    const superadmin = await db.collection("config").doc("superadmin").get();
    const callerIsSuper = superadmin.exists && superadmin.data()?.uid === callerUid;
    if (!(callerIsSuper || (await db.collection("admins").doc(callerUid).get()).exists)) {
        throw new HttpsError("permission-denied", "Staff only.");
    }
    if (superadmin.exists && superadmin.data()?.uid === targetUid && !callerIsSuper) {
        throw new HttpsError("permission-denied", "The node owner cannot be deleted.");
    }
    // Only the node owner may delete a fellow admin (protects the admin hierarchy).
    if (!callerIsSuper && (await db.collection("admins").doc(targetUid).get()).exists) {
        throw new HttpsError("permission-denied", "Only the node owner can delete an admin.");
    }

    const counts = await purgeUserData(targetUid);
    return { deleted: true, ...counts };
});

// RESET LIGHT (ring 2026-07-21) — the testing-phase restart: empties the WHOLE light economy,
// every ray and every glow, in one stroke. NODE OWNER ONLY (not staff): this erases value, so
// only the hand that answers for the instance may pull it. Nothing else is touched; the care
// was real and remains on the chains and caring records — the deleted light leaves the trees
// in better shape, so it is not lost. Light re-enters only through witnessed care.
export const resetLight = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
    const superadmin = await db.collection("config").doc("superadmin").get();
    if (!(superadmin.exists && superadmin.data()?.uid === request.auth.uid)) {
        throw new HttpsError("permission-denied", "Only the node owner may reset the light.");
    }
    const burn = async (coll: string): Promise<{ docs: number; units: number }> => {
        const qs = await db.collection(coll).get();
        let units = 0;
        for (let i = 0; i < qs.docs.length; i += 400) {
            const batch = db.batch();
            qs.docs.slice(i, i + 400).forEach(d => {
                units += typeof d.data().units === "number" ? d.data().units : 0;
                batch.delete(d.ref);
            });
            await batch.commit();
        }
        return { docs: qs.size, units };
    };
    const rays = await burn("rays");
    const glow = await burn("glow");
    console.log(`Light reset by ${request.auth.uid}: ${rays.docs} rays (${rays.units} units), ${glow.docs} glow homes (${glow.units} units).`);
    return { rays: rays.docs, rayUnits: rays.units, glowHomes: glow.docs, glowUnits: glow.units };
});

// Self-serve account deletion — the being erases itself. Server-side (admin) so the Auth user is
// removed cleanly regardless of how recently they signed in; the client used to delete the docs
// first and then fail on `requires-recent-login`, leaving the Auth user alive with no profile.
export const deleteMyAccount = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
    const uid = request.auth.uid;
    // The last spend's chosen heir (optional): must be another, existing being. Only the
    // SELF-SERVE path may name one; an admin deletion always follows the community cascade.
    let heirUid: string | undefined;
    const heirRaw = request.data?.heirUid;
    if (heirRaw !== undefined && heirRaw !== null && heirRaw !== "") {
        if (typeof heirRaw !== "string" || heirRaw === uid) throw new HttpsError("invalid-argument", "The heir must be another being.");
        const heirSnap = await db.collection("persons").doc(heirRaw).get();
        if (!heirSnap.exists) throw new HttpsError("not-found", "The chosen heir was not found.");
        heirUid = heirRaw;
    }
    // A farewell before the record is gone (best-effort; never blocks the deletion).
    try {
        const record = await getAuth().getUser(uid).catch(() => null);
        if (record?.email) {
            const text = "It was wonderful to have you. See you!";
            await writeMail({ to: [record.email], subject: "Goodbye from lightseed", html: composeSystemEmailHtml(text, "https://lightseed.online", "lightseed"), text, uid });
        }
    } catch (e) { console.warn("Goodbye email skipped:", e); }
    const counts = await purgeUserData(uid, heirUid);
    return { deleted: true, ...counts };
});

// ---------------------------------------------------------------------------
// The living world, visible — per-being link previews + the living sitemap.
//
// /b/<lid> is served by `beingPreview` (a hosting rewrite ahead of the ** catch-
// all): EVERYONE receives the same 200 page — the deployed index.html with its
// head meta swapped to the being's own name, words and image. Bots read the
// meta; a human's SPA boots and lidFromPath opens the being. No user-agent
// sniffing. PUBLIC beings only: anything node/community/private (or unknown)
// serves the UNMODIFIED shell — the generic card, never a leaked name. Every
// interpolated field is HTML-escaped: a being's name/body is user content
// entering raw HTML.
// ---------------------------------------------------------------------------

// Node 22 ships global fetch; the functions tsconfig lib (es2022) has no type for it.
// The slice of fetch these functions use (lib is es2022, no DOM): the shell as text for the
// /b/ card, a being's photo as bytes — bounded by a signal — for the face preview.
declare const fetch: (
    url: string,
    init?: { headers?: Record<string, string>; signal?: AbortSignal; redirect?: "follow" | "error" | "manual" },
) => Promise<{
    ok: boolean;
    headers: { get(name: string): string | null };
    text(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
}>;

// Mirrors src/domain/beingLink.ts lidFromPath — the lid a /b/ path names.
// Both door shapes (mirror of src/domain/beingLink + lid62): the canonical dashed lid AND
// the 22-char base62 compact form every printed QR now carries. The first version matched
// hex only, so a compact share link fell through to the generic face card.
const LID_RE = /^\/b\/([0-9a-zA-Z-]{8,})\/?$/;
const LID62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const lidFromDoor = (raw: string): string | null => {
    if (raw.length === 22) {
        let n = 0n;
        for (const ch of raw) {
            const v = LID62_ALPHABET.indexOf(ch);
            if (v < 0) return null;
            n = n * 62n + BigInt(v);
        }
        if (n >= (1n << 128n)) return null;
        const hex = n.toString(16).padStart(32, "0");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    return /^[0-9a-fA-F-]{8,}$/.test(raw) ? raw : null;
};

// Attribute-safe escape for user content entering raw HTML. (The email
// escapeHtml above leaves ' alone; meta content deserves all five.)
const escapeHtmlFull = (s: string): string => s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const collapseWhitespace = (s: string): string => s.replace(/\s+/g, " ").trim();
const truncate160 = (s: string): string => (s.length <= 160 ? s : `${s.slice(0, 159).trimEnd()}…`);

// The host the visitor actually asked for (hosting forwards it in x-forwarded-host),
// pattern-gated so a forged header can never inject into a fetch URL or the canonical.
const requestHost = (req: { hostname?: string; headers: Record<string, unknown> }): string => {
    const fwd = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
    const host = fwd || String(req.hostname || "");
    return /^[a-z0-9][a-z0-9.-]*$/i.test(host) ? host : "lightseed.online";
};

// THE MIRROR GUARD (the 22M-invocation lesson, 2026-07-27). These functions are also reachable
// on their raw *.run.app address, where `requestHost` returns the function's OWN host. Fetching
// the shell from that host called the function again, whose fallback redirect called it again:
// a self-sustaining loop that one bot knock kept alive for a week. So every public HTTP surface
// resolves the request to a CANONICAL host it actually serves; anything else (run.app included)
// collapses to the primary domain. The shell fetch also announces itself and is answered with an
// empty 204 if it ever reaches this function again, so recursion is impossible twice over.
const CANONICAL_HOSTS = new Set([
    "lightseed.online", "lifeseed.online",
    "lifeseed-75dfe.web.app", "lifeseed-75dfe.firebaseapp.com",
    "perauset.web.app", "perauset.com",
    "theohouse.web.app", "theohouse.org", "seed.theohouse.org",
    "enlightenednations.web.app",
    "mamaway.web.app",
]);
const SHELL_FETCH_UA = "lightseed-shell-fetch";
const canonicalHost = (req: { hostname?: string; headers: Record<string, unknown> }): string => {
    const host = requestHost(req).toLowerCase().replace(/^www\./, "");
    return CANONICAL_HOSTS.has(host) ? host : "lightseed.online";
};

interface PublicBeingCard {
    name: string;
    body: string;
    image?: string;
    // Present only for a public Light House — becomes a JSON-LD Place block.
    place?: { latitude?: number; longitude?: number };
}

// Server-side mirror of findBeingByLid (src/services/firebase/beings.ts), PUBLIC-ONLY:
// the admin SDK sees everything, so the visibility gate lives here, per collection.
// A lid names exactly one being — once a collection matches, its gate decides alone.
const findPublicBeingByLid = async (lid: string): Promise<PublicBeingCard | null> => {
    const one = async (coll: string) =>
        (await db.collection(coll).where("lid", "==", lid).limit(1).get()).docs[0];

    const treeDoc = await one("lifetrees");
    if (treeDoc) {
        const t = treeDoc.data() as any;
        // Absent visibility = public (legacy trees) — but a BED's absent default is
        // 'node' (domain/bed.ts), so only an explicit 'public' opens a bed.
        const isPublic = t.visibility === "public" || (t.visibility == null && t.treeType !== "BED");
        if (!isPublic) return null;
        return {
            name: String(t.name || ""),
            body: String(t.body || ""),
            image: (t.latestGrowthUrl || t.imageUrl || undefined) as string | undefined,
        };
    }

    const houseDoc = await one("lightHouses");
    if (houseDoc) {
        const h = houseDoc.data() as any;
        if (h.visibility !== "public") return null; // absent = 'community' — NOT public
        return {
            name: String(h.name || ""),
            body: String(h.body || ""),
            image: (h.imageUrl || undefined) as string | undefined,
            place: {
                latitude: typeof h.latitude === "number" ? h.latitude : undefined,
                longitude: typeof h.longitude === "number" ? h.longitude : undefined,
            },
        };
    }

    const visionDoc = await one("visions");
    if (visionDoc) {
        const v = visionDoc.data() as any;
        if (!(v.visibility === "public" || v.visibility == null)) return null;
        return {
            name: String(v.title || ""),
            body: String(v.body || ""),
            image: (v.imageUrl || undefined) as string | undefined,
        };
    }

    // Pulses — events, offerings, minted growths (the first version knew only the three
    // above, so a public event's share link fell to the generic card). PUBLIC only; the
    // absent-visibility legacy default is public (domain/pulseVisibility), and a private
    // reach always carries its explicit level, so it can never leak here.
    const pulseDoc = await one("pulses");
    if (pulseDoc) {
        const pu = pulseDoc.data() as any;
        if (!(pu.visibility === "public" || pu.visibility == null)) return null;
        return {
            name: String(pu.title || ""),
            body: String(pu.body || pu.content || ""),
            image: ((pu.imageUrls || [])[0] || pu.imageUrl || undefined) as string | undefined,
        };
    }

    return null;
};

// Replace the text between two captured delimiters with an already-escaped value.
// A replacer FUNCTION, never a replacement string: user content may contain `$&`
// and friends, which String.replace would expand.
const setBetween = (html: string, re: RegExp, value: string): string =>
    html.replace(re, (_m, pre: string, post: string) => `${pre}${value}${post}`);

// Swap the deployed shell's head meta for one being. All values arrive RAW and are
// escaped here, once, at the boundary.
const swapHeadMeta = (
    shell: string,
    raw: { title: string; description: string; image: string; url: string; card?: "summary" },
    placeLd?: object,
): string => {
    const title = escapeHtmlFull(raw.title);
    const description = escapeHtmlFull(raw.description);
    const image = escapeHtmlFull(raw.image);
    const url = escapeHtmlFull(raw.url);

    let out = shell;
    out = setBetween(out, /(<title>)[\s\S]*?(<\/title>)/, title);
    out = setBetween(out, /(<meta name="description" content=")[^"]*(")/, description);
    out = setBetween(out, /(<link rel="canonical" href=")[^"]*(")/, url);
    for (const [prop, value] of [
        ["og:title", title], ["og:description", description],
        ["og:url", url], ["og:image", image], ["og:image:alt", title],
    ] as const) {
        out = setBetween(out, new RegExp(`(<meta property="${prop}" content=")[^"]*(")`), value);
    }
    for (const [name, value] of [
        ["twitter:title", title], ["twitter:description", description], ["twitter:image", image],
        // A being's share rides the SMALL card (a compact square thumb beside the words),
        // not the face's full-width banner — pass card: 'summary' to shrink it.
        ...(raw.card ? ([["twitter:card", raw.card]] as const) : []),
    ] as const) {
        out = setBetween(out, new RegExp(`(<meta name="${name}" content=")[^"]*(")`), value);
    }
    // The static og:image dimensions/type describe og.png; for a being's own image
    // they would lie, so they are dropped.
    if (!raw.image.endsWith("/og.png")) {
        out = out.replace(/\n?\s*<meta property="og:image:(?:type|width|height)" content="[^"]*" \/>/g, "");
    }
    if (placeLd) {
        // <-escape < so user content can never break out via </script>. The replacement is a
        // FUNCTION for the same reason as setBetween: `$&`/`$'`/"$`" in user content would
        // otherwise be expanded by String.replace and splice document text into the script.
        const json = JSON.stringify(placeLd).replace(/</g, "\\u003c");
        out = out.replace("</head>", () => `<script type="application/ld+json">${json}</script>\n</head>`);
    }
    return out;
};

export const beingPreview = onRequest(async (req, res) => {
    // Belt and braces: if our own shell fetch ever lands here again, answer nothing at all.
    if (String(req.headers["user-agent"] || "") === SHELL_FETCH_UA) { res.status(204).end(); return; }
    // The deployed shell, fetched from the CDN at a CANONICAL host only. Through Hosting the
    // static /index.html is served before rewrites; on the raw run.app address the old
    // `requestHost` pointed the fetch back at this very function (the mirror guard above).
    const host = canonicalHost(req);
    let shell = "";
    try {
        const r = await fetch(`https://${host}/index.html`, { headers: { "user-agent": SHELL_FETCH_UA } });
        if (r.ok) shell = await r.text();
    } catch (e) {
        console.error("beingPreview: shell fetch failed:", e);
    }
    // No shell to dress: hand the visitor to the canonical CDN, never to "/" on the
    // current host (on run.app that relative redirect re-invoked this function).
    if (!shell) { res.redirect(302, `https://${host}/`); return; }

    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "public, max-age=300, s-maxage=600");
    try {
        const rawDoor = ((req.path || "").match(LID_RE) || [])[1];
        const lid = rawDoor ? lidFromDoor(rawDoor) : null;
        const being = lid ? await findPublicBeingByLid(lid) : null;
        if (!being || !being.name) { res.status(200).send(shell); return; } // generic card

        const description = truncate160(collapseWhitespace(being.body)) || `${being.name} — a living being on Lightseed.`;
        // The being's own photo rides as its FACE PREVIEW (/face/<door>.jpg, below): a small,
        // honest JPEG every crawler will fetch, never the stored original (2–28 MB).
        const own = being.image && /^https?:\/\//.test(being.image) ? being.image : null;
        const image = own ? facePreviewUrlOf(host, rawDoor, own) : `https://${host}/og.png`;
        const url = `https://${host}/b/${rawDoor}`;
        const placeLd = being.place ? {
            "@context": "https://schema.org",
            "@type": "Place",
            "name": being.name,
            "description": description,
            "url": url,
            ...(being.place.latitude != null && being.place.longitude != null ? {
                "geo": { "@type": "GeoCoordinates", "latitude": being.place.latitude, "longitude": being.place.longitude },
            } : {}),
        } : undefined;

        res.status(200).send(swapHeadMeta(shell, {
            title: `${being.name} — Lightseed`,
            description,
            image,
            url,
            card: "summary",
        }, placeLd));
    } catch (e) {
        console.error("beingPreview failed:", e);
        res.status(200).send(shell); // never a broken page — the generic shell stands in
    }
});

// --- FACE PREVIEW --------------------------------------------------------------------------
// /face/<door>.jpg — the small, honest picture behind a shared /b/ door. The card above
// points og:image here instead of at the being's stored photo, which can weigh 2–28 MB and
// which the strictest crawlers (WhatsApp, near 300 KB) refuse. The law — the ladder, the
// door, the cache key — lives in domain/facePreview (mirrored in ./facePreview); this
// endpoint owns the plumbing: resolve the being through the same public-only gate the card
// uses, fetch its photo (bounded), walk the ladder with sharp, keep the result in the
// bucket under a key that changes with the source, answer with JPEG bytes. Cached long at
// the CDN: the URL itself carries ?v=<digest>, so a new photo is a new URL, not a stale hit.
const FACE_BUCKET = "lifeseed-75dfe.firebasestorage.app";
const FACE_SOURCE_MAX_BYTES = 40 * 1024 * 1024;
const FACE_FETCH_TIMEOUT_MS = 20_000;
const FACE_GROUND = "#04070f"; // the night the app stands on — under any transparency

// The being's own photo, bounded: a foreign or runaway source never holds the function.
const fetchFaceSource = async (url: string): Promise<Buffer | null> => {
    const r = await fetch(url, { signal: AbortSignal.timeout(FACE_FETCH_TIMEOUT_MS), redirect: "follow" });
    if (!r.ok) return null;
    if (Number(r.headers.get("content-length") || 0) > FACE_SOURCE_MAX_BYTES) return null;
    const bytes = Buffer.from(await r.arrayBuffer());
    return bytes.length > FACE_SOURCE_MAX_BYTES ? null : bytes;
};

// Decode and fit ONCE (upright by EXIF, flattened onto the night, never enlarged), then walk
// the ladder from that small raster: each attempt is a cheap re-encode, not a re-decode of a
// 28 MB original. The first attempt under the budget wins; failing all, the smallest made.
const renderFacePreview = async (source: Buffer): Promise<Buffer> => {
    const [first] = facePreviewAttempts();
    const base = await sharp(source, { failOn: "none", limitInputPixels: 80_000_000 })
        .rotate()
        .flatten({ background: FACE_GROUND })
        .resize({ width: first.edge, height: first.edge, fit: "inside", withoutEnlargement: true })
        .raw()
        .toBuffer({ resolveWithObject: true });
    let best: Buffer | null = null;
    for (const { edge, quality } of facePreviewAttempts()) {
        const out = await sharp(base.data, { raw: { width: base.info.width, height: base.info.height, channels: base.info.channels } })
            .resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true })
            .jpeg({ quality, mozjpeg: true })
            .toBuffer();
        if (!best || out.length < best.length) best = out;
        if (out.length <= FACE_PREVIEW_MAX_BYTES) return out;
    }
    return best!;
};

export const facePreview = onRequest({ memory: "1GiB", timeoutSeconds: 60 }, async (req, res) => {
    const host = canonicalHost(req);
    // No face to show: the site's own og.png stands in, as it does on the card itself.
    const fallback = () => res.redirect(302, `https://${host}/og.png`);
    try {
        const door = facePreviewDoorOf(req.path || "");
        const lid = door ? lidFromDoor(door) : null;
        const being = lid ? await findPublicBeingByLid(lid) : null;
        const source = being?.image && /^https?:\/\//.test(being.image) ? being.image : null;
        if (!lid || !source) { fallback(); return; }

        const file = getStorage().bucket(FACE_BUCKET).file(facePreviewKeyOf(lid, source));
        const answer = (bytes: Buffer) => {
            res.set("Content-Type", "image/jpeg");
            res.set("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
            res.status(200).send(bytes);
        };
        const [exists] = await file.exists();
        if (exists) { answer((await file.download())[0]); return; }

        const original = await fetchFaceSource(source);
        if (!original) { fallback(); return; }
        const preview = await renderFacePreview(original);
        await file.save(preview, { contentType: "image/jpeg", resumable: false, metadata: { metadata: { source, lid } } });
        answer(preview);
    } catch (e) {
        console.error("facePreview failed:", e);
        fallback();
    }
});

// --- IMAGE VARIANTS ------------------------------------------------------------------------
// Every primary picture written to the bucket gets its small faces made here, once, at
// upload: thumbs/<path>@480.webp and @1200.webp (domain/imageVariant, mirrored in
// ./imageVariant). Fitted inside, never enlarged, upright by EXIF, alpha kept; immutable at
// the CDN, because a primary's path never changes (uploads are named by their moment, and
// the recode of stored primaries keeps path and token — ring 2026-09-06). A derived object
// never derives again (isDerivedImagePath), and a picture the decoder cannot read leaves no
// variant — the renderer's fallback to the primary stands.
const RASTER_IMAGE_RE = /^image\/(jpeg|jpg|png|webp|gif|heic|heif|avif|tiff)$/i;

export const deriveImageVariants = onObjectFinalized({ bucket: FACE_BUCKET, memory: "1GiB", timeoutSeconds: 120 }, async (event) => {
    const name = event.data.name || "";
    if (!name || isDerivedImagePath(name) || !RASTER_IMAGE_RE.test(event.data.contentType || "")) return;
    const bucket = getStorage().bucket(event.data.bucket);
    try {
        const [source] = await bucket.file(name).download();
        const upright = sharp(source, { failOn: "none", limitInputPixels: 80_000_000 }).rotate();
        for (const size of IMAGE_VARIANT_SIZES) {
            const out = await upright.clone()
                .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
                .webp({ quality: IMAGE_VARIANT_QUALITY })
                .toBuffer();
            await bucket.file(imageVariantKeyOf(name, size)).save(out, {
                contentType: "image/webp",
                resumable: false,
                metadata: { cacheControl: "public, max-age=31536000, immutable", metadata: { source: name } },
            });
        }
    } catch (e) {
        console.error(`deriveImageVariants failed for ${name}:`, e);
    }
});

// --- The living sitemap ------------------------------------------------------
// /sitemap.xml (a hosting rewrite; the static public/sitemap.xml is deleted so it
// can't shadow this). Home + every PUBLIC being as /b/<lid>. Only an explicit
// visibility 'public' is listed — which also keeps beds' non-public defaults and
// every absent-legacy doc out of the index (the preview above still serves those;
// the sitemap is an invitation, not the gate).
export const sitemap = onRequest(async (req, res) => {
    // Canonical host only: a sitemap served on the raw run.app address must still
    // advertise the real domain's URLs, never run.app ones (the mirror guard above).
    const host = canonicalHost(req);
    const xmlOf = (urls: string[]): string =>
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
    const home = `  <url>\n    <loc>https://${host}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`;
    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=3600, s-maxage=21600");
    try {
        const [trees, houses, visions] = await Promise.all([
            db.collection("lifetrees").where("visibility", "==", "public").get(),
            db.collection("lightHouses").where("visibility", "==", "public").get(),
            db.collection("visions").where("visibility", "==", "public").get(),
        ]);
        const beings: { lid: string; ms: number }[] = [];
        for (const snap of [trees, houses, visions]) {
            for (const d of snap.docs) {
                const x = d.data() as any;
                if (typeof x.lid === "string" && x.lid) {
                    beings.push({ lid: x.lid, ms: tsToMs(x.updatedAt) || tsToMs(x.createdAt) });
                }
            }
        }
        beings.sort((a, b) => b.ms - a.ms);
        const MAX_SITEMAP_BEINGS = 500;
        if (beings.length > MAX_SITEMAP_BEINGS) {
            console.warn(`sitemap: ${beings.length} public beings exceed the ${MAX_SITEMAP_BEINGS}-entry cap; newest kept.`);
        }
        const xmlEscape = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const entries = beings.slice(0, MAX_SITEMAP_BEINGS).map((b) => {
            const lastmod = b.ms ? `\n    <lastmod>${new Date(b.ms).toISOString().slice(0, 10)}</lastmod>` : "";
            return `  <url>\n    <loc>https://${host}/b/${xmlEscape(b.lid)}</loc>${lastmod}\n  </url>`;
        });
        res.status(200).send(xmlOf([home, ...entries]));
    } catch (e) {
        console.error("sitemap failed:", e);
        res.status(200).send(xmlOf([home])); // never a broken sitemap — home alone stands
    }
});

// --- THE OFFERING OF CARE: acceptance -------------------------------------------------------
// acceptOffering — a hand standing for the receiver (a tree's keeper / co-owner / steward, a
// vision's author) accepts an OPEN offering made to it, and the agreement is minted as TWIN
// BLOCKS: one on the offerer's tree chain, one on the receiver's own chain (a tree's, or the
// vision's), each naming the offering and the other side — the alignment shape, on server
// ground. Everything is server-read: the caller is the acceptor; the offering, the receiver,
// the offerer's tree and the acceptor's standing come from the documents; the pure law
// (judgeOfferingAccept, mirrored from domain/offering) decides; the seals follow the node's
// lock exactly as mintPulse does in the browser (./chain mirrors the hashing). No light moves:
// acceptance seals the agreement; appreciation stays a coming rung.
export const acceptOffering = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to accept an offering.");
    const acceptorUid = request.auth.uid;
    const offeringId = request.data?.offeringId;
    if (!offeringId || typeof offeringId !== "string") throw new HttpsError("invalid-argument", "offeringId is required.");

    return db.runTransaction(async (t) => {
        // ── all reads first ──
        const offeringRef = db.doc(`pulses/${offeringId}`);
        const offeringSnap = await t.get(offeringRef);
        const o = (offeringSnap.data() ?? {}) as Record<string, any>;
        const toKind = o.offeredToKind as OfferedToKind | undefined;
        const toId = typeof o.offeredToId === "string" ? o.offeredToId : "";
        const fromTreeId = typeof o.offeringFromTreeId === "string" ? o.offeringFromTreeId : "";
        const authorId = typeof o.authorId === "string" ? o.authorId : "";

        let receiver: Record<string, any> | null = null;
        let standing = false;
        if (toId && (toKind === "tree" || toKind === "vision")) {
            const receiverSnap = await t.get(db.doc(`${toKind === "tree" ? "lifetrees" : "visions"}/${toId}`));
            receiver = receiverSnap.exists ? (receiverSnap.data() as Record<string, any>) : null;
            if (receiver) {
                if (toKind === "tree") {
                    // The tree's carers: its keeper, and co_owner / steward links (rules' isTreeCarer).
                    const links = await Promise.all(["co_owner", "steward"].map((rel) => t.get(db.doc(`links/${acceptorUid}__${rel}__${toId}`))));
                    standing = receiver.ownerId === acceptorUid || links.some((l) => l.exists);
                } else {
                    standing = receiver.authorId === acceptorUid;
                }
            }
        }
        const fromTreeSnap = fromTreeId ? await t.get(db.doc(`lifetrees/${fromTreeId}`)) : null;
        const fromTree = fromTreeSnap?.exists ? (fromTreeSnap.data() as Record<string, any>) : null;

        const judgment = judgeOfferingAccept({
            acceptorUid,
            offering: { exists: offeringSnap.exists, type: o.type, status: o.offeringStatus, active: o.offeringActive, authorId, toKind, toId, fromTreeId },
            receiver: {
                exists: !!receiver,
                standing,
                diedAtMs: receiver?.diedAt && typeof receiver.diedAt.toMillis === "function" ? receiver.diedAt.toMillis() : null,
            },
            fromTree: { exists: !!fromTree },
        });
        if (judgment.outcome === "reject") throw new HttpsError(judgment.code, judgment.message);
        if (!receiver || !fromTree || !toKind) throw new HttpsError("failed-precondition", "The sides of this offering could not be read.");

        // The node's seal: locked nodes seal canonically, unlocked ones keep the legacy seal — the
        // same choice mintPulse makes, read from the host community the offering was made at.
        const domain = String(o.domain || "");
        let locked = false;
        if (domain) {
            const cradle = await t.get(db.collection("communities").where("domain", "==", domain).limit(1));
            locked = !!cradle.docs[0]?.data()?.chainLocked;
        }

        // The acceptor's name for the receiver-side block, by the same hand that wrote authorName elsewhere.
        const acceptorSnap = await t.get(db.doc(`users/${acceptorUid}`));
        const acceptorName = String(acceptorSnap.data()?.displayName || acceptorSnap.data()?.name || (toKind === "tree" ? receiver.name : receiver.title) || "A being");

        const { from, to } = offeringTwinBlocks({
            id: offeringId,
            lid: String(o.lid || ""),
            title: String(o.title || "An offering"),
            authorId,
            authorName: String(o.authorName || "A being"),
            domain,
            visibility: typeof o.visibility === "string" ? o.visibility : "public",
            toKind,
            toId,
            toName: String(o.offeredToName || (toKind === "tree" ? receiver.name : receiver.title) || "a being"),
            fromTreeId,
            fromTreeName: String(o.offeringFromTreeName || fromTree.name || "a tree"),
        }, { uid: acceptorUid, name: acceptorName });

        const mintedAt = Date.now();
        const seal = async (previousHash: string, record: Record<string, unknown>): Promise<string> =>
            locked ? computeCanonicalHash(previousHash, mintedAt, record) : createBlock(previousHash, record, mintedAt);

        const fromRef = db.collection("pulses").doc();
        const toRef = db.collection("pulses").doc();
        const fromRecord = { ...from, lid: mintLid(), id: fromRef.id, mintedAt, previousHash: String(fromTree.latestHash || ""), loveCount: 0, commentCount: 0 };
        const toRecord = { ...to, lid: mintLid(), id: toRef.id, mintedAt, previousHash: String(receiver.latestHash || ""), loveCount: 0, commentCount: 0 };
        const [fromHash, toHash] = await Promise.all([seal(fromRecord.previousHash, fromRecord), seal(toRecord.previousHash, toRecord)]);
        const stamp = locked ? { hashVersion: BLOCK_HASH_VERSION } : {};

        // ── writes: both twins, both heads, the offering's answer — one transaction ──
        t.set(fromRef, { ...fromRecord, ...stamp, hash: fromHash, createdAt: FieldValue.serverTimestamp() });
        t.update(db.doc(`lifetrees/${fromTreeId}`), { latestHash: fromHash, blockHeight: (Number(fromTree.blockHeight) || 0) + 1 });
        t.set(toRef, { ...toRecord, ...stamp, hash: toHash, createdAt: FieldValue.serverTimestamp() });
        t.update(db.doc(`${toKind === "tree" ? "lifetrees" : "visions"}/${toId}`), { latestHash: toHash, blockHeight: (Number(receiver.blockHeight) || 0) + 1 });
        t.update(offeringRef, {
            offeringStatus: "accepted",
            offeringAnsweredBy: acceptorUid,
            offeringAnsweredAt: FieldValue.serverTimestamp(),
            offeringAcceptedPulseIds: { from: fromRef.id, to: toRef.id },
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { fromPulseId: fromRef.id, toPulseId: toRef.id };
    });
});

// --- FACE EVENTS -------------------------------------------------------------------------
// /faceEvents(?domain=...) — the node speaking a face's happenings to whoever stands at it.
// The hybrid shape gave every mother site a plain <a> INTO the seed; this is the seed's
// voice travelling BACK: a JSON feed of one face's public AND node events, for any domain
// with a cradle (a community rooted by `domain` or answering at a `domainAliases` door).
// A visitor at the face IS at the node — so node-visibility gatherings greet them here —
// while firestore.rules stay strict for raw anonymous queries (the 2026-08-24 tightening).
// The law of what may ride the feed lives in domain/faceEvents (mirrored in ./faceEvents);
// this endpoint owns only the plumbing. Cached like beingPreview so bot knocks stay cheap.
export const faceEvents = onRequest({ cors: true }, async (req, res) => {
    res.set("Cache-Control", "public, max-age=300, s-maxage=600");
    const domain = feedDomainOf(req.query.domain, canonicalHost(req));
    if (!domain) { res.status(400).json({ error: "domain" }); return; }
    try {
        // A face answers by its NAME or at a DOOR — the same fallback as getCommunityByDomain.
        let cradle = await db.collection("communities").where("domain", "==", domain).limit(1).get();
        if (cradle.empty) cradle = await db.collection("communities").where("domainAliases", "array-contains", domain).limit(1).get();
        if (cradle.empty) { res.status(404).json({ error: "no cradle at this domain", events: [] }); return; }
        const home = String(cradle.docs[0].data().domain || domain);
        const pulses = await db.collection("pulses")
            .where("domain", "==", home)
            .where("type", "==", "event")
            .limit(200)
            .get();
        res.status(200).json({ domain: home, events: faceFeedOf(pulses.docs.map((d) => d.data() as Record<string, unknown>)) });
    } catch (e) {
        console.error("faceEvents failed:", e);
        res.status(200).json({ domain, events: [] }); // never a broken feed — silence stands in
    }
});

// --- THE LID INDEX ------------------------------------------------------------------------
// beings/{lid} -> { kind, collection, docId }: a true name written down beside the local
// address holding it today (root ring 2026-08-09; the law lives in src/domain/beingIndex.ts,
// mirrored here by ./beingIndex). Until now a lid was not ADDRESSED but SEARCHED FOR —
// findBeingByLid asks collection after collection until one answers.
//
// Written ONLY here, never by a client (firestore.rules refuses every client write to
// /beings), because an identity record a client could forge is not an identity record: anyone
// could claim a lid or re-point someone else's name.
//
// create(), never set(): a lid already written is NEVER re-pointed by a trigger. That is the
// frozen half of the law enforced by construction rather than by care. A legitimate move — an
// import, a restore, a migration — is a deliberate, trusted act and belongs to the backfill,
// which reports a disagreement instead of overwriting it.
//
// The index owns nothing. Every being still stands, still carries its lid, and still resolves
// by the old search if this collection is emptied.
const recordBeing = async (collection: string, docId: string, raw: unknown): Promise<void> => {
    const lid = (raw as { lid?: unknown } | undefined)?.lid;
    const entry = entryFor(collection, docId, lid);
    if (!entry) return; // no true name, or a collection the index does not address
    try {
        await db.collection("beings").doc(entry.lid).create({
            ...entry,
            recordedAt: FieldValue.serverTimestamp(),
        });
    } catch (e: unknown) {
        if ((e as { code?: number })?.code !== 6) {
            console.warn(`lid index: could not record ${collection}/${docId}`, e);
            return;
        }
        // 6 = ALREADY_EXISTS. Almost always the law working: triggers fire at least once, so a
        // re-run finds its own entry and must stay quiet. But the same refusal would hide a real
        // fault — one lid on two beings — so look once before swallowing it.
        const already = (await db.collection("beings").doc(entry.lid).get()).data();
        if (already && (already.collection !== entry.collection || already.docId !== entry.docId)) {
            console.error(
                `lid index: ONE TRUE NAME, TWO BEINGS — ${entry.lid} is written at `
                + `${already.collection}/${already.docId} and was just born at ${collection}/${docId}. `
                + `The index keeps the first; a human must decide.`,
            );
        }
    }
};

const onBeingBorn = (collection: string) =>
    onDocumentCreated(`${collection}/{docId}`, async (event) => {
        if (!event.data) return;
        await recordBeing(collection, event.params.docId, event.data.data());
    });

// One per addressed kind. Relations (links, alignments, covenants) carry lids too and are
// deliberately NOT indexed: they name bonds BETWEEN beings and are found through the beings
// they bind, so indexing them would map the whole graph to no one's benefit.
export const indexPersonLid = onBeingBorn("users");
export const indexTreeLid = onBeingBorn("lifetrees");
export const indexVisionLid = onBeingBorn("visions");
export const indexLightHouseLid = onBeingBorn("lightHouses");
export const indexCommunityLid = onBeingBorn("communities");
export const indexPulseLid = onBeingBorn("pulses");

// The backfill: every being born BEFORE the triggers above existed still has a true name and no
// entry. Staff-run, idempotent, safe to re-run. It writes ONLY missing entries — where an entry
// already exists and disagrees, it REPORTS and moves on, because re-pointing a lid is a
// deliberate, governed act (a move, an import) and never a sweep's side effect. It also names
// the fault the index's shape cannot catch on its own: two different lids claiming one address.
export const backfillLidIndex = onCall({ cors: true }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid || !(await isStaffUid(uid))) throw new HttpsError("permission-denied", "Staff only.");
    const apply = request.data?.apply === true;

    // The whole index once, into memory — NOT a read per being. A sweep that asks Firestore
    // for every lid one at a time is a sweep that times out on the first busy collection.
    const held = new Map<string, { kind?: string; collection?: string; docId?: string }>();
    (await db.collection("beings").get()).forEach((d) => held.set(d.id, d.data() as never));

    const missing: { entry: ReturnType<typeof entryFor>; address: string }[] = [];
    const disagreements: { lid: string; existing: string; found: string }[] = [];
    const claimed = new Map<string, string>(); // address -> first lid seen
    const collisions: { address: string; lids: string[] }[] = [];
    let nameless = 0;

    for (const collection of Object.values(COLLECTION_FOR_KIND)) {
        // select('lid'): the sweep needs a document's true name and nothing else. Pulling whole
        // pulse documents into memory to read one field is how a one-off migration runs out of it.
        const snap = await db.collection(collection).select("lid").get();
        for (const doc of snap.docs) {
            const entry = entryFor(collection, doc.id, doc.data()?.lid);
            if (!entry) { nameless++; continue; }

            const address = `${entry.collection}/${entry.docId}`;
            const firstLid = claimed.get(address);
            if (firstLid && firstLid !== entry.lid) collisions.push({ address, lids: [firstLid, entry.lid] });
            else claimed.set(address, entry.lid);

            const already = held.get(entry.lid);
            if (already) {
                if (already.collection !== entry.collection || already.docId !== entry.docId || already.kind !== entry.kind) {
                    disagreements.push({
                        lid: entry.lid,
                        existing: `${already.kind}:${already.collection}/${already.docId}`,
                        found: `${entry.kind}:${address}`,
                    });
                }
                continue;
            }
            missing.push({ entry, address });
        }
    }

    // Batched, 400 at a time (Firestore's limit is 500) — one round trip per batch, not per being.
    if (apply) {
        for (let i = 0; i < missing.length; i += 400) {
            const batch = db.batch();
            for (const { entry } of missing.slice(i, i + 400)) {
                batch.set(db.collection("beings").doc(entry!.lid), {
                    ...entry,
                    recordedAt: FieldValue.serverTimestamp(),
                });
            }
            await batch.commit();
        }
    }
    const written = missing.map((m) => `${m.entry!.kind}:${m.address}`);

    const report = { apply, wrote: written.length, nameless, disagreements, collisions };
    console.log("lid index backfill:", JSON.stringify(report));
    return report;
});

// --- The SSO door's mint (ring 2026-09-02) ----------------------------------------------------
// A signed-in caller receives a custom token for their OWN uid — no privilege moves, the token
// only re-speaks the session's identity — so a mother page beside a seed face (theohouse.org
// beside seed.theohouse.org) can sign in as the same person. WHO may ask is the door's law
// (src/domain/ssoDoor.ts + the /sso.html frame); this hand only ever answers with the asker's
// own name, so an unexpected caller gains nothing they do not already hold.
// Deploy hand, once: createCustomToken signs via IAM signBlob, so the functions runtime
// service account needs roles/iam.serviceAccountTokenCreator on itself.
export const mintSsoToken = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "The mint answers only the signed-in.");
    const token = await getAuth().createCustomToken(request.auth.uid);
    return { token };
});
