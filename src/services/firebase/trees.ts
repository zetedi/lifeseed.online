import { collection, query, orderBy, getDocs, addDoc, setDoc, serverTimestamp, doc, getDoc, where, updateDoc, deleteDoc, limit, startAfter, QueryDocumentSnapshot, getCountFromServer, Timestamp } from 'firebase/firestore';
import { charter } from '../../config/charter';
import { announce } from '../refreshBus';
import { LIGHT_HOUSE_ROOT, type LightHouseCareAct } from '../../domain/lightHouse';
import { firestoreStore } from '../../adapters/firestore';
import { httpsCallable } from 'firebase/functions';
import { type Lifetree, type LightHouse, type TreeOwnershipInvite, type InvitableRole } from '../../types';
import { tendedTreeRoles, type TendingRole } from '../../domain/treeCircle';
import { createBlock } from '../../utils/crypto';
import { treePlantingGate, normalizeNodeLimits, DEFAULT_NODE_LIMITS, type NodeLimits } from '../../domain/limits';
import { BED_DEFAULT_VISIBILITY, BED_TREE_TYPE, bedPlantingProblem, excludeBedTrees, isBedTree, isRealPlace } from '../../domain/bed';
import { uuidv7 } from '../../utils/id';
import { GENESIS_MOMENT_MS, GENESIS_PLACE } from '../../domain/genesis';
import { oldEmeraldEarthThemeValues } from '../../utils/theme';
import { auth, db, functions, mapDoc, lifetreesCollection, visionsCollection, lightHousesCollection, pulsesCollection } from './core';
// getCommunityByDomain lives in ./spaces; trees ↔ spaces is a runtime-safe cycle (both use the
// import only inside function bodies, so ESM resolves the binding lazily on call).
import { getCommunityByDomain } from './spaces';

// Mahameru's face — a starry sky bearing Orion, in the code so it travels with every node.
// When no trees are planted, this is what remains: the sea of creation.
export const MAHAMERU_IMAGE = '/mahameru.svg';
// The Moment — see domain/genesis.ts: the one timestamp the network grows from.

export const ensureGenesis = async () => {
    const user = auth.currentUser;
    if (!user) return; // Skip if not logged in to avoid permission errors on config/superadmin

    const genesisId = 'GENESIS_TREE';
    const genesisRef = doc(db, 'lifetrees', genesisId);
    try {
        const genesisSnap = await getDoc(genesisRef);
        // Mahameru wears the starry sky, whatever it wore before (the doc once carried a
        // flower-of-life image, which outranked every fallback). latestGrowthUrl is the
        // display cache that wins over imageUrl in the renderers — align both. Staff-run.
        if (genesisSnap.exists()) {
            const g = genesisSnap.data() as any;
            const momentDrifted = (g.createdAt?.toMillis?.() !== GENESIS_MOMENT_MS) || !g.plantedAt;
            if ((g.imageUrl !== MAHAMERU_IMAGE || (g.latestGrowthUrl && g.latestGrowthUrl !== MAHAMERU_IMAGE) || momentDrifted)
                && await checkIsSuperAdmin(user.uid)) {
                await updateDoc(genesisRef, {
                    imageUrl: MAHAMERU_IMAGE, latestGrowthUrl: MAHAMERU_IMAGE,
                    // The Moment is the one: birth, place and meaning stay golden.
                    createdAt: Timestamp.fromMillis(GENESIS_MOMENT_MS),
                    plantedAt: Timestamp.fromMillis(GENESIS_MOMENT_MS),
                    plantedLatitude: GENESIS_PLACE.latitude,
                    plantedLongitude: GENESIS_PLACE.longitude,
                    plantedAltitudeM: GENESIS_PLACE.altitudeM,
                    latitude: GENESIS_PLACE.latitude,
                    longitude: GENESIS_PLACE.longitude,
                    locationName: GENESIS_PLACE.name,
                }).catch(() => {});
            }
        }
        if (!genesisSnap.exists()) {
            // Only Super Admins can initialize genesis on a new node
            const isSuper = await checkIsSuperAdmin(user.uid);
            if (!isSuper) return;

            const genesisBody = `The purpose of lightseed is to bring joy. The joy of realizing the bliss of conscious, compassionate, grateful existence by opening a portal to the center of life. By creating a bridge between creator and creation, science and spirituality, virtual and real, nothing and everything. It is designed to intimately connect our inner Self, our culture, our trees and the tree of life, the material and the digital, online world into a sustainable and sustaining circle of unified vibration, sound and light. It aims to merge us into a common flow for all beings to be liberated, wise, strong, courageous and connected. It is rooted in nonviolence, compassion, generosity, gratitude and love. It is blockchain (truthfulness), cloud (global, distributed, resilient), ai (for connecting dreams and technology), regen (nature centric) native. It is an inspiration, an impulse towards a quantum leap in consciousness, a prompt both for human and artificial intelligence for action towards transcending humanity into a new era, a New Earth, Universe and Field with the help of our most important evolutionary sisters and brothers, the trees.`;
            const genesisHash = await createBlock("0", { message: "Genesis Pulse" }, Date.now());
            await setDoc(genesisRef, {
                lid: uuidv7(),
                ownerId: 'GENESIS_SYSTEM', name: 'Mahameru', shortTitle: 'Live Light', body: genesisBody,
                imageUrl: MAHAMERU_IMAGE,
                latitude: GENESIS_PLACE.latitude, longitude: GENESIS_PLACE.longitude, locationName: GENESIS_PLACE.name,
                createdAt: Timestamp.fromMillis(GENESIS_MOMENT_MS),
                plantedAt: Timestamp.fromMillis(GENESIS_MOMENT_MS),
                plantedLatitude: GENESIS_PLACE.latitude, plantedLongitude: GENESIS_PLACE.longitude,
                plantedAltitudeM: GENESIS_PLACE.altitudeM,
                genesisHash, latestHash: genesisHash, blockHeight: 0,
                validated: true, validatorId: 'SYSTEM', isNature: true, domain: 'lightseed.online'
            });
            await setDoc(doc(db, 'visions', 'GENESIS_VISION'), {
                lid: uuidv7(),
                lifetreeId: genesisId, authorId: 'GENESIS_SYSTEM', title: "Mahameru", body: genesisBody, createdAt: serverTimestamp(), domain: 'lightseed.online'
            });
        }

        // Ensure default organizations for white-labeling
        const isSuper = await checkIsSuperAdmin(user.uid);
        if (isSuper) {
            const defaultOrgs = [
                {
                    id: 'lightseed.online',
                    name: 'lightseed',
                    domain: 'lightseed.online',
                    vision: 'Universal connection through nature and digital roots.',
                    imageUrls: [],
                    ownerId: user.uid,
                    theme: {
                        primary: '#059669',
                        secondary: '#0284c7',
                        accent: '#f59e0b',
                        neutral: '#334155',
                        background: '#ffffff',
                        surface: '#ffffff',
                        text: '#0f172a',
                        mode: 'light'
                    }
                },
                {
                    id: 'lifeseed.online',
                    name: 'lifeseed',
                    domain: 'lifeseed.online',
                    vision: 'A lively network for seeding growth and vitality.',
                    imageUrls: [],
                    ownerId: user.uid,
                    theme: { ...oldEmeraldEarthThemeValues }
                }
            ];

            for (const community of defaultOrgs) {
                const existingCommunity = await getCommunityByDomain(community.domain);
                if (!existingCommunity) {
                    const communityRef = doc(db, 'communities', community.id);
                    await setDoc(communityRef, {
                        ...community,
                        lid: uuidv7(), // every being is born with its Lightseed ID
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                    console.log(`Initialized default community: ${community.domain}`);
                }
            }
        }
    } catch (e) { console.warn("Genesis skip", e); }
}

// Mirror the git initiation ledger into Firestore so the security rules can check initiate rights
// server-side. Git is the source of truth (initiations/ in the repo, three-sponsor rule in CI);
// public/initiates.json is the build-time mirror; this pushes uid-bound records into
// initiates/{uid} and removes stale ones. Superadmin-only (the rules make initiates staff-write),
// best-effort, and run beside ensureGenesis on sign-in — so a deploy carrying a new initiate
// self-heals the mirror the next time the superadmin opens the app.
export const syncInitiatesMirror = async () => {
    const user = auth.currentUser;
    if (!user || !(await checkIsSuperAdmin(user.uid))) return;
    try {
        const { loadInitiates } = await import('../../domain/initiation');
        const ledger = (await loadInitiates()).filter(i => i.uid);
        const current = await getDocs(collection(db, 'initiates'));
        const wanted = new Map(ledger.map(i => [i.uid as string, i]));
        // Remove mirror docs the ledger no longer holds; write/update the ones it does.
        for (const d of current.docs) {
            if (!wanted.has(d.id)) await deleteDoc(d.ref);
        }
        for (const i of ledger) {
            await setDoc(doc(db, 'initiates', i.uid as string), {
                handle: i.handle, name: i.name, lid: i.lid, pubkey: i.pubkey,
                ...(i.domain ? { domain: i.domain } : {}),
                ...(i.genesis ? { genesis: true } : {}),
                initiatedAt: i.initiatedAt,
                syncedAt: serverTimestamp(),
            });
        }
    } catch (e) { console.warn('Initiates mirror sync skipped', e); }
};

// The real, on-chain hash of block 000 — the genesis pulse the whole network grows from.
// Shared by every node, so the about page can show the true founding hash. Returns null
// if the genesis tree isn't reachable (callers fall back to a placeholder).
export const getGenesisHash = async (): Promise<string | null> => {
    try {
        const snap = await getDoc(doc(db, 'lifetrees', 'GENESIS_TREE'));
        return snap.exists() ? ((snap.data() as Lifetree).genesisHash ?? null) : null;
    } catch (e) {
        console.warn("Genesis hash unavailable", e);
        return null;
    }
};

// Forest-card counters. A missing domain means the reflecting whole; a present domain means
// this place only. The caller derives that choice from community.reflectsPublic.
export const getNetworkStats = async (domain?: string, publicOnly = false) => {
    const scoped = !!domain;
    const d = domain?.replace(/^www\./, '');
    // A count (getCountFromServer) is rejected WHOLESALE unless EVERY matched doc is rule-readable
    // — so one private tree (or node tree, for a signed-out viewer) would otherwise zero the card.
    // The viewer's provable levels, mirroring the read rules: public only when signed out or
    // reflecting; public + node when signed in to a scoped place.
    const levels = publicOnly || !auth.currentUser?.uid ? ['public'] : ['public', 'node'];
    // In a scoped place, try the true (unfiltered) count first — accurate, and provable while
    // every matched doc is readable. Reflection skips that attempt and asks PUBLIC at the source.
    // null = the constrained count was rejected (e.g. a missing composite index).
    const provableCount = async (coll: string, extra: any[] = []): Promise<number | null> => {
        if (!publicOnly) {
            try {
                return (await getCountFromServer(query(collection(db, coll), ...extra))).data().count;
            } catch { /* retry with a provable visibility constraint */ }
        }
        try {
            return (await getCountFromServer(query(collection(db, coll), ...extra, where('visibility', 'in', levels)))).data().count;
        } catch { return null; }
    };
    const domainCons = scoped ? [where('domain', '==', d)] : [];
    // Counts run independently: one collection's rejection must not zero the others.
    const [trees, pulses, visions, beds] = await Promise.all([
        provableCount('lifetrees', domainCons),
        provableCount('pulses', domainCons),
        provableCount('visions', domainCons),
        // Beds are a Light House's furniture, not forest: subtract them from the unscoped tree
        // count. Scoped counts never see them — a bed carries no domain.
        scoped ? Promise.resolve(0) : provableCount('lifetrees', [where('treeType', '==', BED_TREE_TYPE)]),
    ]);
    return {
        trees: Math.max(0, (trees ?? 0) - (beds ?? 0)),
        pulses: pulses ?? 0,
        visions: visions ?? 0,
    };
}

// The node's planting caps, set by node admins on the admin page (config/limits, world-readable);
// nodes that never touched them get the defaults (12 lifetrees + 132 guarded = 144).
export const getNodeLimits = async (): Promise<NodeLimits> => {
    try {
        const snap = await getDoc(doc(db, 'config', 'limits'));
        return snap.exists() ? normalizeNodeLimits(snap.data()) : DEFAULT_NODE_LIMITS;
    } catch {
        return DEFAULT_NODE_LIMITS;
    }
};

// Staff-only by Firestore rules — the node admin page saves the caps here.
export const setNodeLimits = (limits: Partial<NodeLimits>) =>
    setDoc(doc(db, 'config', 'limits'), normalizeNodeLimits(limits) as any, { merge: true });

// The AI dial alone (ring 2026-08-25) — a targeted merge that writes ONLY nodeAiValidatedOnly,
// so toggling the node's AI never disturbs the planting/fullness caps beside it in config/limits.
export const setNodeAiValidatedOnly = (value: boolean) =>
    setDoc(doc(db, 'config', 'limits'), { nodeAiValidatedOnly: value }, { merge: true });

export const plantLifetree = async (data: Partial<Lifetree> & { ownerId: string; name: string; body?: string }) => {
    // Quality, not quantity: the node's caps (or the 12 + 132 = 144 defaults) per being.
    const plantingType: 'LIFETREE' | 'GUARDED' = (data.treeType as any) || (data.isNature ? 'GUARDED' : 'LIFETREE');
    const [mine, limits] = await Promise.all([getMyLifetrees(data.ownerId), getNodeLimits()]);
    const refusal = treePlantingGate(mine, plantingType, limits);
    if (refusal) throw new Error(refusal);

    const genesisHash = await createBlock("0", { msg: "Birth" }, Date.now());
    const currentHost = window.location.hostname.replace(/^www\./, '');
    // A tree belongs to the community at the current address — its canonical domain wins over
    // the raw hostname (so per-auset.web.app trees follow the community to its real domain).
    // Local development has no host-community document, so it plants into the default node.
    let domain = data.domain;
    if (!domain) {
        const isDevHost = /localhost|127\.0\.0\.1|^192\.168\.|\.local$/.test(currentHost);
        domain = (await getCommunityByDomain(currentHost))?.domain || (isDevHost ? charter.domain : currentHost);
    }

    // New trees inherit the owner's contact-privacy preference so the mirror stays consistent.
    let onlyValidatedCanReach = false;
    try {
        if (data.ownerId) {
            const ownerSnap = await getDoc(doc(db, 'users', data.ownerId));
            onlyValidatedCanReach = ownerSnap.exists() && ownerSnap.data()?.onlyValidatedCanReach === true;
        }
    } catch { /* default false */ }

    const treeDoc = await addDoc(lifetreesCollection, {
        ...data,
        lid: uuidv7(),
        domain,
        // Visibility is stamped HERE, not trusted to the caller: a tree born without the field
        // is invisible to every `visibility in [...]` query — forest, map, and the circle's
        // invite search alike (how The Aspen vanished; ring 2026-08-09).
        visibility: data.visibility || 'public',
        onlyValidatedCanReach,
        treeType: data.treeType || (data.isNature ? 'GUARDED' : 'LIFETREE'),
        createdAt: serverTimestamp(), genesisHash, latestHash: genesisHash, blockHeight: 0,
        validated: false, validatorId: null, status: 'HEALTHY'
        // Relations (guardian/co_owner/…) live in the `links` collection — no legacy arrays.
    });
    // A GUARDED (nature) tree has NO Root Vision — like a bed, it is stood-for, not dreamed
    // forward; its welcome lives in `body`. A LIFETREE's Root Vision is its idea-twin, born the
    // same moment WITH its own genesis chain (the 2026-07-17 twin ring), not mute.
    if (plantingType !== 'GUARDED') {
        const visionGenesis = await createBlock('0', { msg: 'Birth' }, Date.now());
        await addDoc(visionsCollection, {
            lid: uuidv7(),
            lifetreeId: treeDoc.id, authorId: data.ownerId, title: "Root Vision", body: data.body,
            genesisHash: visionGenesis, latestHash: visionGenesis, blockHeight: 0,
            createdAt: serverTimestamp(), domain,
        });
    }
    // A guarded (nature) tree is GUARDED, not worn: its planter is its first guardian —
    // the edge lives in the LIN, and the session lists it under guarded trees, not avatars.
    if (plantingType === 'GUARDED') {
        await setDoc(doc(db, 'links', `${data.ownerId}__guardian__${treeDoc.id}`),
            { lid: uuidv7(), type: 'link', rel: 'guardian', from: data.ownerId, to: treeDoc.id, createdAt: serverTimestamp() }).catch(() => {});
    }
    return treeDoc;
};

// Plant a BED — housed inside a Light House, or loose at a coordinate under open stars
// (domain/bed.ts). Mirrors plantLifetree's genesis seal, but: no `domain` (domain-scoped
// queries must never surface it), no Root Vision (the welcome lives in `body`), no guardian
// edge, and no planting-cap gate (furniture is not forest — the rules hold the real gate:
// housed beds need the house's keeper; loose beds need a place).
export const plantBed = async (draft: {
    name: string; lightHouseId?: string; latitude?: number; longitude?: number;
    locationName?: string; imageUrl?: string; body?: string;
}) => {
    const user = auth.currentUser;
    if (!user) throw new Error('err_signin_bed');
    const refusal = bedPlantingProblem(draft);
    if (refusal) throw new Error(refusal);
    if (draft.lightHouseId) {
        // HOUSED: only the Light House's keeper offers its beds.
        const house = await getLightHouseById(draft.lightHouseId);
        if (!house) throw new Error('err_lighthouse_gone');
        if (house.ownerId !== user.uid) throw new Error('err_bed_keeper_only');
    }

    // Only a REAL place is written (NaN / Infinity / off-Earth coordinates are nowhere).
    const hasPlace = isRealPlace(draft.latitude, draft.longitude);
    const genesisHash = await createBlock("0", { msg: "Birth" }, Date.now());
    return addDoc(lifetreesCollection, {
        lid: uuidv7(),
        ownerId: user.uid, // housed: the house's keeper; loose: whoever stands it — bound by the rules
        name: draft.name.trim(),
        ...(draft.imageUrl ? { imageUrl: draft.imageUrl } : {}),
        body: draft.body?.trim() || '',
        treeType: BED_TREE_TYPE,
        // A housed bed carries its house; a loose bed carries NO lightHouseId — its place is enough.
        ...(draft.lightHouseId ? { lightHouseId: draft.lightHouseId } : {}),
        ...(hasPlace ? { latitude: draft.latitude, longitude: draft.longitude } : {}),
        ...(draft.locationName?.trim() ? { locationName: draft.locationName.trim() } : {}),
        visibility: BED_DEFAULT_VISIBILITY,
        createdAt: serverTimestamp(), genesisHash, latestHash: genesisHash, blockHeight: 0,
        validated: false, validatorId: null, status: 'HEALTHY',
    });
};

// The beds standing in one Light House, earliest first. The visibility filter keeps the list
// query provable under the rules (default 'node' — see BED_DEFAULT_VISIBILITY); the keeper
// merge lets the house's keeper see even a bed drawn back to private.
// The beds a being owns (BED trees they planted) — for offering one for light. Beds are excluded
// from the normal `myTrees` list, so this reads them directly.
export const getMyBeds = async (uid: string): Promise<Lifetree[]> => {
    const snap = await getDocs(query(lifetreesCollection, where('ownerId', '==', uid), where('treeType', '==', BED_TREE_TYPE)));
    return snap.docs.map(d => mapDoc(d) as Lifetree).filter(isBedTree)
        .sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
};

export const getBedsForLightHouse = async (lightHouseId: string, publicOnly = false): Promise<Lifetree[]> => {
    const uid = auth.currentUser?.uid;
    const levels = uid && !publicOnly ? ['public', 'node'] : ['public'];
    const byId = new Map<string, Lifetree>();
    const add = (d: QueryDocumentSnapshot) => byId.set(d.id, mapDoc(d) as Lifetree);
    (await getDocs(query(lifetreesCollection,
        where('treeType', '==', BED_TREE_TYPE),
        where('lightHouseId', '==', lightHouseId),
        where('visibility', 'in', levels)))).docs.forEach(add);
    if (uid) {
        (await getDocs(query(lifetreesCollection,
            where('lightHouseId', '==', lightHouseId),
            where('ownerId', '==', uid)))).docs.forEach(add);
    }
    return [...byId.values()]
        .filter(isBedTree)
        .sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
};

// EVERY PUBLIC BED, wherever it sleeps. A bed is an offering, so an UNSCOPED view (a reflecting
// node, or one whose canopy is open) should find the public ones even when their Light House
// stands on another domain; the house scopes the house, never the bed's own openness. Strictly
// rule-provable (visibility == 'public'), so a signed-out visitor may read it too.
export const fetchPublicBeds = async (max = 48): Promise<Lifetree[]> => {
    const snap = await getDocs(query(lifetreesCollection,
        where('treeType', '==', BED_TREE_TYPE),
        where('visibility', '==', 'public'),
        limit(max)));
    return snap.docs
        .map(d => mapDoc(d) as Lifetree)
        .filter(isBedTree)
        .sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
};

export const updateLifetree = async (id: string, data: Partial<Lifetree>) => {
    await updateDoc(doc(db, 'lifetrees', id), { ...data });
    // The edit whispers its patch — every open list merges it (ring 2026-08-22).
    announce('trees', id, data as Record<string, unknown>);
};
export const deleteLifetree = (id: string) => deleteDoc(doc(db, 'lifetrees', id));
export const validateLifetree = (targetId: string, validatorId: string) => updateDoc(doc(db, 'lifetrees', targetId), { validated: true, validatorId });
export const unvalidateLifetree = (targetId: string) => updateDoc(doc(db, 'lifetrees', targetId), { validated: false, validatorId: null });

export const fetchLifetrees = async (lastD?: QueryDocumentSnapshot, domainFilter?: string, ownerUid?: string, levels?: string[] | null) => {
    const scopedDomain = domainFilter?.replace(/^www\./, '');
    const communityScoped = !!scopedDomain;
    // Only return trees this viewer may read (visibility levels), matching the rules — else the
    // list query is rejected. levels null/empty = no filter (staff / legacy callers).
    const visCons = (levels && levels.length) ? [where('visibility', 'in', levels)] : [];
    let q;
    if (communityScoped) {
        // Community view: this domain's trees, newest first ON THE SERVER — the composite
        // (domain, visibility, createdAt DESC) exists since ring 2026-09-03, so the cursor pages
        // the real stream (an unordered query paged in id order and showed a different sample
        // on every reload). The catch below keeps the forest loading while an index builds.
        q = query(lifetreesCollection, where('domain', '==', scopedDomain), ...visCons, orderBy('createdAt', 'desc'), limit(24));
    } else {
        q = query(lifetreesCollection, ...visCons, orderBy('createdAt', 'desc'), limit(12));
    }

    if (lastD) q = query(q, startAfter(lastD));
    let snap;
    let scopedFallback = false;
    try {
        snap = await getDocs(q);
    } catch (e) {
        // The composite (domain / visibility + createdAt) index may still be building — fall back
        // to a filter-only query so the forest keeps loading; sorted below.
        console.warn('Forest query fell back (composite index building?)', e);
        snap = await getDocs(communityScoped
            ? query(lifetreesCollection, where('domain', '==', scopedDomain), ...visCons, limit(60))
            : (visCons.length ? query(lifetreesCollection, ...visCons, limit(60)) : query(lifetreesCollection, limit(60))));
        scopedFallback = communityScoped;
    }
    let items = snap.docs.map(d => (mapDoc(d) as Lifetree));
    // A broad index fallback must never become a broad visible forest.
    if (communityScoped) items = items.filter(tree => (tree.domain || '') === scopedDomain);
    // Always newest-first (covers the unordered fallback).
    items = items.sort((a, b) => ((b.createdAt as any)?.toMillis?.() || 0) - ((a.createdAt as any)?.toMillis?.() || 0));

    // Pre-backfill safety: legacy trees have no `visibility` field, so a filtered query matches
    // none. If the first page comes back empty, retry unfiltered (rules still allow this while no
    // tree is private yet). After migrateTreeVisibility() runs, the filtered query just works.
    if (!lastD && visCons.length && items.length === 0) {
        try {
            const base = communityScoped
                ? query(lifetreesCollection, where('domain', '==', scopedDomain), orderBy('createdAt', 'desc'), limit(24))
                : query(lifetreesCollection, orderBy('createdAt', 'desc'), limit(12));
            const s2 = await getDocs(base);
            items = s2.docs.map(d => (mapDoc(d) as Lifetree))
                .sort((a, b) => ((b.createdAt as any)?.toMillis?.() || 0) - ((a.createdAt as any)?.toMillis?.() || 0));
        } catch { /* rules now block unfiltered (private trees exist) — keep empty */ }
    }

    if (communityScoped) {
        // The creator always sees their own trees on a community/custom domain,
        // even if those trees point at a different domain. Merge on the first page.
        if (ownerUid && !lastD) {
            const mine = await getDocs(query(lifetreesCollection, where('ownerId', '==', ownerUid)));
            const seen = new Set(items.map(t => t.id));
            mine.docs.forEach(d => {
                if (!seen.has(d.id)) items.push(mapDoc(d) as Lifetree);
            });
        }
        // The merged own trees need placing among the page (the page itself came ordered).
        items = items.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    }

    if (!lastD && !communityScoped) {
        const genesisSnap = await getDoc(doc(db, 'lifetrees', 'GENESIS_TREE'));
        if (genesisSnap.exists()) {
            const genesisTree = { id: genesisSnap.id, ...genesisSnap.data() } as Lifetree;
            if (!items.some(tree => tree.id === genesisTree.id)) {
                items.unshift(genesisTree);
            }
        }
    }

    // Beds are furniture, not forest — never listed among the trees (domain/bed.ts).
    // A fallback cursor belongs to a different query shape, so end pagination here.
    return { items: excludeBedTrees(items), lastDoc: scopedFallback ? null : (snap.docs[snap.docs.length-1] || null) };
}

// Whole forest at once (no pagination) — used by the map so every tree appears,
// not just the first page. Includes the creator's own trees and Genesis while reflecting.
export const fetchAllLifetrees = async (domainFilter?: string, ownerUid?: string, levels?: string[] | null): Promise<Lifetree[]> => {
    const scopedDomain = domainFilter?.replace(/^www\./, '');
    const communityScoped = !!scopedDomain;
    const visCons = (levels && levels.length) ? [where('visibility', 'in', levels)] : [];
    const byId = new Map<string, Lifetree>();
    const add = (d: any) => byId.set(d.id, mapDoc(d) as Lifetree);

    try {
        if (communityScoped) {
            (await getDocs(query(lifetreesCollection, where('domain', '==', scopedDomain), ...visCons))).docs.forEach(add);
        } else {
            (await getDocs(query(lifetreesCollection, ...visCons, orderBy('createdAt', 'desc'), limit(1000)))).docs.forEach(add);
        }
    } catch (e) {
        console.warn('Forest map query fell back (visibility index building?)', e);
        const fallback = await getDocs(visCons.length
            ? query(lifetreesCollection, ...visCons, limit(1000))
            : query(lifetreesCollection, limit(1000)));
        fallback.docs
            .filter(d => !communityScoped || (d.data().domain || '') === scopedDomain)
            .forEach(add);
    }

    // Pre-backfill safety: legacy trees lack `visibility`, so a filtered query matches none.
    // If nothing came back, retry unfiltered (rules allow it while no tree is private yet).
    if (visCons.length && byId.size === 0) {
        try {
            const base = communityScoped
                ? query(lifetreesCollection, where('domain', '==', scopedDomain))
                : query(lifetreesCollection, orderBy('createdAt', 'desc'), limit(1000));
            (await getDocs(base)).docs.forEach(add);
        } catch { /* rules now block unfiltered (private trees exist) — keep empty */ }
    }

    // The creator always sees their own trees, even pointed at another domain.
    if (ownerUid) {
        (await getDocs(query(lifetreesCollection, where('ownerId', '==', ownerUid)))).docs.forEach(add);
    }

    if (!communityScoped) {
        const genesisSnap = await getDoc(doc(db, 'lifetrees', 'GENESIS_TREE'));
        if (genesisSnap.exists()) byId.set(genesisSnap.id, { id: genesisSnap.id, ...(genesisSnap.data() as any) } as Lifetree);
    }

    // Beds are furniture, not forest — the map never shows one (domain/bed.ts).
    return excludeBedTrees(Array.from(byId.values()));
};

// A being's own trees — the personal forest. Beds the keeper owns are furniture — housed
// or loose — not trees they wear or guard: excluded here so the session (useLifeseed) and
// the planting gate never see them; getBedsForLightHouse is the housed beds' own door.
// ── grows_in (ring 2026-08-24): a tree standing in other gardens ─────────────────────────
// The tree's `domain` stays its one place-of-record; these edges only widen which
// community forests SHOW it. The rules hold the door: open → owner self-serve; else keeper.
export const standTreeInCommunity = (treeId: string, communityId: string) =>
    firestoreStore.link(treeId, 'grows_in', communityId);

export const withdrawTreeFromCommunity = (treeId: string, communityId: string) =>
    firestoreStore.unlink(treeId, 'grows_in', communityId);

export const communitiesTreeStandsIn = async (treeId: string): Promise<string[]> =>
    (await firestoreStore.linksFrom(treeId, 'grows_in')).map(l => l.to);

// Every tree standing in this community through a grows_in edge — fetched one by one so a
// tree this viewer may not read simply stays unseen (per-doc rules refusals are absorbed).
export const treesStandingIn = async (communityId: string): Promise<Lifetree[]> => {
    const links = await firestoreStore.linksTo(communityId, 'grows_in');
    const docs = await Promise.all(links.map(l =>
        getDoc(doc(db, 'lifetrees', l.from)).then(d => (d.exists() ? ({ id: d.id, ...d.data() } as Lifetree) : null)).catch(() => null)));
    return excludeBedTrees(docs.filter((t): t is Lifetree => !!t));
};

export const getMyLifetrees = async (uid: string) =>
    excludeBedTrees((await getDocs(query(lifetreesCollection, where('ownerId', '==', uid)))).docs.map(d => (mapDoc(d) as Lifetree)));

export const normalizeDomain = (domain: string) =>
    domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

export const getTreesByDomain = async (domain: string, ownerUid?: string): Promise<Lifetree[]> => {
    const normalized = normalizeDomain(domain);
    // Only return trees this viewer may READ, matching the rules (firestore.rules /lifetrees):
    // a signed-out reader gets public only, any signed-in member gets public + node — else the
    // WHOLE list query is rejected the moment one 'node'/'private' tree carries this domain.
    // (Mirrors fetchLifetrees; no orderBy keeps the composite index to domain + visibility.)
    const uid = auth.currentUser?.uid;
    const levels = uid ? ['public', 'node'] : ['public'];
    const byId = new Map<string, Lifetree>();
    const add = (d: QueryDocumentSnapshot) => byId.set(d.id, mapDoc(d) as Lifetree);

    try {
        (await getDocs(query(lifetreesCollection, where('domain', '==', normalized), where('visibility', 'in', levels)))).docs.forEach(add);
    } catch (e) {
        // Composite (domain + visibility) index still building — fall back to visibility-only
        // (single-field, always provable) and narrow to the domain client-side.
        console.warn('Community tree query fell back (visibility index building?)', e);
        (await getDocs(query(lifetreesCollection, where('visibility', 'in', levels))))
            .docs.map(d => mapDoc(d) as Lifetree)
            .filter(t => (t.domain || '') === normalized)
            .forEach(t => byId.set(t.id, t));
    }

    // Pre-backfill safety: legacy trees lack `visibility`, so the filtered query matches none.
    // If nothing came back, retry unfiltered (rules still allow it while no tree is private yet);
    // once a private tree exists this is denied and we honestly keep the list empty.
    if (byId.size === 0) {
        try {
            (await getDocs(query(lifetreesCollection, where('domain', '==', normalized)))).docs.forEach(add);
        } catch { /* rules now block the unfiltered read (private trees exist) — keep empty */ }
    }

    // The creator always sees their own trees here, even if they pointed a tree at a different
    // domain than this community. An owner-scoped query is always rule-provable (owner reads own).
    if (ownerUid) {
        const mine = await getDocs(query(lifetreesCollection, where('ownerId', '==', ownerUid)));
        mine.docs.forEach(add);
    }

    // Beds carry no domain, but the owner-merge above could carry them in — furniture stays out.
    return excludeBedTrees(Array.from(byId.values()));
};

// What a Light House query may ask for. The rules enforce membership AT REST (firestore.rules
// /lightHouses), so a signed-in caller's whole-collection read is now REJECTED the instant one
// community house exists — every read must be a rule-provable UNION. The viewer + their member
// communities are auto-derived from `auth`; a caller that already has them (useVisibleLightHouses)
// passes them to skip the extra member-links read. `publicOnly` forces the signed-out path.
export interface VisibleLightHouseOpts {
    publicOnly?: boolean;
    viewerUid?: string;
    memberCommunityIds?: string[];
}

const chunk10 = <T>(a: T[]): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < a.length; i += 10) out.push(a.slice(i, i + 10));
    return out;
};

// The communities this being has a `member` link to (mirrors the rules' isCommunityMember,
// membership branch). Community ownership also grants read at the rule, but a keeper's OWN houses
// are already caught by the ownerId sub-query below, so the member set is enough for the union.
const memberCommunityIdsOf = async (uid: string): Promise<string[]> =>
    (await getDocs(query(collection(db, 'links'), where('from', '==', uid), where('rel', '==', 'member'))))
        .docs.map(d => (d.data() as { to: string }).to);

// The Light Houses THIS viewer may read, assembled as a UNION of individually rule-provable
// sub-queries so no list read is ever rejected, then merged + deduped by id:
//   • public          — visibility == 'public'            [everyone; the public branch]
//   • node            — visibility == 'node'              [signed-in; the node branch]
//   • my community    — visibility == 'community' AND communityId in <my member communities>
//                       chunked ≤10 per 'in'              [isCommunityMember proves each]
//   • my own          — ownerId == me                     [the owner branch]
// Signed-out (or publicOnly) collapses to public alone. The belt (canViewLightHouse) still runs
// in the hook. NOTE: absent-visibility legacy houses (default 'community') are only surfaced to
// their community's members through the owner sub-query if theirs; today's create form always
// writes `visibility`, so new houses are fully covered.
const fetchVisibleLightHouses = async (opts?: VisibleLightHouseOpts): Promise<LightHouse[]> => {
    const byId = new Map<string, LightHouse>();
    const add = (d: QueryDocumentSnapshot) => byId.set(d.id, mapDoc(d) as LightHouse);
    const uid = opts?.publicOnly ? undefined : (opts?.viewerUid ?? auth.currentUser?.uid);
    if (!uid) {
        (await getDocs(query(lightHousesCollection, where('visibility', '==', 'public')))).docs.forEach(add);
        return [...byId.values()];
    }
    const mine = opts?.memberCommunityIds ?? await memberCommunityIdsOf(uid);
    const snaps = await Promise.all([
        getDocs(query(lightHousesCollection, where('visibility', '==', 'public'))),
        getDocs(query(lightHousesCollection, where('visibility', '==', 'node'))),
        getDocs(query(lightHousesCollection, where('ownerId', '==', uid))),
        ...chunk10(mine).map(ids =>
            getDocs(query(lightHousesCollection, where('visibility', '==', 'community'), where('communityId', 'in', ids)))),
    ]);
    snaps.forEach(snap => snap.docs.forEach(add));
    return [...byId.values()];
};

// LightHouses rooted in a community's domain, earliest first. Mirrors getTreesByDomain
// so the "First Tree" and "The LightHouse" tabs behave identically. Signed-out: the provable
// two-equality (domain + public) query, scoped at the source. Signed-in: the membership-scoped
// union, narrowed to this domain client-side (a per-domain community query would need a 3-field
// composite; the union stays 1-2 fields).
export const getLightHousesByDomain = async (domain: string, opts?: VisibleLightHouseOpts): Promise<LightHouse[]> => {
    const normalized = normalizeDomain(domain);
    const byBirth = (l: LightHouse[]) =>
        l.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
    const uid = opts?.publicOnly ? undefined : (opts?.viewerUid ?? auth.currentUser?.uid);
    if (!uid) {
        const snap = await getDocs(query(lightHousesCollection, where('domain', '==', normalized), where('visibility', '==', 'public')));
        return byBirth(snap.docs.map(d => (mapDoc(d) as LightHouse)));
    }
    const visible = await fetchVisibleLightHouses({ ...opts, viewerUid: uid });
    return byBirth(visible.filter(s => (s.domain || '') === normalized));
};

// The "mother trees" of a set of lightHouses: the trees each lighthouse is rooted into (the
// `lightHouse __rooted__ tree` LIN edge). Used by the dashboard mini-map, which shows only
// lighthouses + the trees they root. Best-effort per tree (a rooted tree may be private).
export const getRootedTrees = async (lightHouseIds: string[]): Promise<Lifetree[]> => {
    if (!lightHouseIds.length) return [];
    const linkSnaps = await Promise.all(lightHouseIds.map(sid =>
        getDocs(query(collection(db, 'links'), where('from', '==', sid), where('rel', '==', 'rooted'))).catch(() => null)
    ));
    const treeIds = [...new Set(linkSnaps.flatMap(snap => snap ? snap.docs.map(d => (d.data() as any).to as string) : []))];
    const trees = await Promise.all(treeIds.map(id =>
        getDoc(doc(db, 'lifetrees', id)).then(s => s.exists() ? ({ id: s.id, ...s.data() } as Lifetree) : null).catch(() => null)
    ));
    // A mother tree is never a bed — the mini-map shows forest only (domain/bed.ts).
    return trees.filter((t): t is Lifetree => t !== null && !isBedTree(t));
};

// Every placed Light House in the network — a reflecting map shows what the viewer may see, as the
// rule-provable membership union (fetchVisibleLightHouses). Signed-out sees public only.
export const getAllLightHouses = (opts?: VisibleLightHouseOpts): Promise<LightHouse[]> =>
    fetchVisibleLightHouses(opts);

// Consecrate a lightHouse — community keepers do this from the LightHouse tab.
export const createLightHouse = async (data: Partial<LightHouse> & { name: string; ownerId: string }) => {
    const ref = await addDoc(lightHousesCollection, {
        ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== '')),
        lid: uuidv7(),
        createdAt: serverTimestamp(),
    });
    // Consecration IS the founding care (ring 2026-08-24) — awaiting a keeper's eyes.
    try { await mintLightHouseCare({ id: ref.id, name: data.name, communityId: data.communityId }, 'consecration', { communityId: data.communityId }); } catch { /* the house stands regardless */ }
    return ref.id;
};

export const getLightHouseById = async (id: string): Promise<LightHouse | null> => {
    const snap = await getDoc(doc(db, 'lightHouses', id));
    return snap.exists() ? (mapDoc(snap as any) as LightHouse) : null;
};

// LightHouses sheltering a community — belonging lives in the LIN (lightHouse __shelters__
// community), plus the primary communityId scalar for lightHouses rooted there directly.
export const getLightHousesByCommunity = async (communityId: string): Promise<LightHouse[]> => {
    const [links, primary] = await Promise.all([
        getDocs(query(collection(db, 'links'), where('rel', '==', 'shelters'), where('to', '==', communityId))),
        getDocs(query(lightHousesCollection, where('communityId', '==', communityId))),
    ]);
    const out = new Map<string, LightHouse>();
    for (const d of primary.docs) out.set(d.id, mapDoc(d) as LightHouse);
    const missing = links.docs.map(l => (l.data() as any).from).filter((id: string) => !out.has(id));
    const fetched = await Promise.all(missing.map((id: string) => getLightHouseById(id).catch(() => null)));
    for (const s of fetched) if (s) out.set(s.id, s);
    return [...out.values()];
};

// The lightHouse steps into (shelters) a community — one LIN edge, minted by its keeper.
export const adoptLightHouse = async (lightHouseId: string, communityId: string) => {
    await setDoc(doc(db, 'links', `${lightHouseId}__shelters__${communityId}`),
        { lid: uuidv7(), type: 'link', rel: 'shelters', from: lightHouseId, to: communityId, createdAt: serverTimestamp() });
    // Stepping in IS a founding care — the record is best-effort, the shelter stands regardless.
    try { await mintLightHouseCare({ id: lightHouseId, name: '', communityId }, 'step_in', { communityId }); } catch { /* the link is the act */ }
};

// ── Light House care (ring 2026-08-24) ──────────────────────────────────────────────────
// A care act is a pulse on the one ledger (standalone LIGHT_HOUSE root — the house has no
// chain). One gesture warms two beings: the house's lastCaredAt and the community's move
// together. Consecration and step-in call this automatically — the FOUNDING cares.
export const mintLightHouseCare = async (
    lightHouse: Pick<LightHouse, 'id' | 'name' | 'communityId'>,
    act: LightHouseCareAct,
    opts?: { communityId?: string },
): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error('err_signin');
    const communityId = opts?.communityId || lightHouse.communityId || '';
    const domain = typeof window !== 'undefined' ? window.location.hostname.toLowerCase().replace(/^www\./, '') : '';
    const title = act === 'consecration' ? 'Consecration' : act === 'step_in' ? 'Step-in' : 'Care';
    const payload = {
        type: 'observation' as const,
        lightHouseId: lightHouse.id,
        ...(communityId ? { communityId } : {}),
        care: true,
        careAct: act,
        title,
        body: '',
        visibility: 'public' as const,
        domain,
        authorId: user.uid,
        authorName: user.displayName || '',
    };
    const hash = await createBlock(LIGHT_HOUSE_ROOT, payload, Date.now());
    const ref = await addDoc(pulsesCollection, {
        ...payload, lid: uuidv7(), loveCount: 0, commentCount: 0,
        previousHash: LIGHT_HOUSE_ROOT, hash, createdAt: serverTimestamp(),
    });
    // The touch — best-effort on each being; the record above stands regardless.
    try { await updateDoc(doc(db, 'lightHouses', lightHouse.id), { lastCaredAt: serverTimestamp(), updatedAt: serverTimestamp() }); } catch { /* not this hand's house */ }
    if (communityId) {
        try { await updateDoc(doc(db, 'communities', communityId), { lastCaredAt: serverTimestamp(), updatedAt: serverTimestamp() }); } catch { /* not this hand's community */ }
    }
    return ref.id;
};

// The founding record and its observations — for the house's Consecration card.
export const getLightHouseCareRecord = async (lightHouseId: string) => {
    const snap = await getDocs(query(pulsesCollection, where('lightHouseId', '==', lightHouseId), where('care', '==', true), where('visibility', '==', 'public')));
    const pulses = snap.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
        .sort((a, b) => ((a as { createdAt?: { toMillis?: () => number } }).createdAt?.toMillis?.() || 0) - ((b as { createdAt?: { toMillis?: () => number } }).createdAt?.toMillis?.() || 0));
    const founding = pulses[0] as ({ id: string; authorId?: string; authorName?: string; careAct?: string } | undefined);
    if (!founding) return null;
    const witnesses = (await getDocs(collection(db, 'pulses', founding.id, 'witnesses'))).docs
        .map(d => d.data() as { uid: string; lid: string; name?: string });
    return { founding, witnesses };
};

// A keeper observes the consecration — their own slot, their mortal uid as the doc id,
// their LID (the true name that survives the crossing) aboard. The rules refuse every
// other shape: another's slot, the consecrator's own hand, a borrowed lid.
export const witnessLightHouseCare = async (pulseId: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error('err_signin');
    const person = await getDoc(doc(db, 'persons', user.uid));
    const lid = (person.data() as { lid?: string } | undefined)?.lid;
    if (!lid) throw new Error('err_no_person');
    await setDoc(doc(db, 'pulses', pulseId, 'witnesses', user.uid), {
        uid: user.uid, lid, ...(user.displayName ? { name: user.displayName } : {}), witnessedAt: serverTimestamp(),
    });
};

// Move / describe a lightHouse — owner or staff, per the rules. Undefined and empty-string
// values are stripped (belt and braces alongside ignoreUndefinedProperties).
export const updateLightHouse = (lightHouseId: string, data: Partial<LightHouse>) =>
    updateDoc(doc(db, 'lightHouses', lightHouseId),
        Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== '')) as any);

// Release a lightHouse — owner or staff, per the rules. Its LIN edges (rooted, shelters)
// are released FIRST (while the ownership check can still see the doc), best-effort.
export const deleteLightHouse = async (lightHouseId: string) => {
    try {
        const links = await getDocs(query(collection(db, 'links'), where('from', '==', lightHouseId)));
        await Promise.all(links.docs
            .filter(d => ['rooted', 'shelters'].includes((d.data() as any).rel))
            .map(d => deleteDoc(d.ref).catch(() => {})));
    } catch { /* best-effort — the exists-guarded rules allow later staff cleanup */ }
    await deleteDoc(doc(db, 'lightHouses', lightHouseId));
};

// Open a lightHouse wider (or draw it back) — owner or staff, per the rules.
export const setLightHouseVisibility = (lightHouseId: string, visibility: 'community' | 'node' | 'public') =>
    updateDoc(doc(db, 'lightHouses', lightHouseId), { visibility });

export const checkIsAdmin = async (uid: string): Promise<boolean> => (await getDoc(doc(db, 'admins', uid))).exists();

export const getSuperAdminUid = async (): Promise<string | null> => {
    const snap = await getDoc(doc(db, 'config', 'superadmin'));
    return snap.exists() ? (snap.data() as any).uid : null;
};
export const checkIsSuperAdmin = async (uid: string): Promise<boolean> => (await getSuperAdminUid()) === uid;
export const SUPERADMIN_INVITE_ALLOTMENT = 144;

export const claimSuperAdmin = async (uid: string): Promise<boolean> => {
    const ref = doc(db, 'config', 'superadmin');
    if ((await getDoc(ref)).exists()) return false;
    await setDoc(ref, { uid, claimedAt: serverTimestamp() });
    // Super-admins seed the invite-only network: grant the full allotment.
    try { await updateDoc(doc(db, 'users', uid), { invitesRemaining: SUPERADMIN_INVITE_ALLOTMENT }); } catch (e) { console.warn('Could not set superadmin invites', e); }
    return true;
};
export const grantAdmin = (uid: string) => setDoc(doc(db, 'admins', uid), { grantedAt: serverTimestamp() });
export const revokeAdmin = (uid: string) => deleteDoc(doc(db, 'admins', uid));
export const getAdmins = async (): Promise<{ uid: string }[]> =>
    (await getDocs(collection(db, 'admins'))).docs.map(d => ({ uid: d.id }));
// Trees a user guards — a prism over their outgoing 'guardian' links (the LIN), then hydrate.
export const getGuardedTrees = async (uid: string): Promise<Lifetree[]> => {
    const links = await getDocs(query(collection(db, 'links'), where('from', '==', uid), where('rel', '==', 'guardian')));
    const ids = links.docs.map(d => (d.data() as any).to as string);
    const trees = await Promise.all(ids.map(async id => {
        try {
            const snap = await getDoc(doc(db, 'lifetrees', id));
            return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as Lifetree) : null;
        } catch { return null; } // e.g. a guarded tree the owner made private
    }));
    // Guardian links are self-serve, so one could point at a bed — furniture stays out.
    return trees.filter((t): t is Lifetree => t !== null && !isBedTree(t));
};

// The trees a being TENDS without owning them — its co_owner/steward links, hydrated, each
// carrying the role so the profile can name the hand honestly (domain/treeCircle
// tendedTreeRoles: co_owner outranks steward). Owned trees stay out: ownership needs no link.
export interface TendedTree { tree: Lifetree; role: TendingRole }

export const getTendedTrees = async (uid: string): Promise<TendedTree[]> => {
    const links = await getDocs(query(collection(db, 'links'),
        where('from', '==', uid), where('rel', 'in', ['co_owner', 'steward'])));
    const roles = tendedTreeRoles(links.docs.map(d => d.data() as { from: string; rel: string; to: string }), uid);
    const trees = await Promise.all([...roles.keys()].map(async id => {
        try {
            const snap = await getDoc(doc(db, 'lifetrees', id));
            return snap.exists() ? ({ id: snap.id, ...(snap.data() as object) } as Lifetree) : null;
        } catch { return null; } // a tended tree drawn back beyond this viewer's sight
    }));
    return trees
        .filter((t): t is Lifetree => t !== null && !isBedTree(t) && t.ownerId !== uid)
        .map(tree => ({ tree, role: roles.get(tree.id)! }));
};

// Trees participating in an event or vision — a prism over its incoming 'participant' links
// (from = treeId), then hydrate. Mirrors getGuardedTrees but keyed on the target entity.
export const getParticipatingTrees = async (entityId: string): Promise<Lifetree[]> => {
    const links = await getDocs(query(collection(db, 'links'), where('to', '==', entityId), where('rel', '==', 'participant')));
    const ids = links.docs.map(d => (d.data() as any).from as string);
    const trees = await Promise.all(ids.map(async id => {
        try {
            const snap = await getDoc(doc(db, 'lifetrees', id));
            return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as Lifetree) : null;
        } catch { return null; } // a participating tree that later went private
    }));
    // A bed never stands in an event or vision — participants are forest (domain/bed.ts).
    return trees.filter((t): t is Lifetree => t !== null && !isBedTree(t));
};

// --- Tree Circle: shared care of a Lifetree → a rooted community ---------------
const treeInvitesCollection = collection(db, 'treeOwnershipInvites');

export const createTreeInvite = async (params: {
    lifetree: Lifetree;
    invitedUserId: string;
    role: InvitableRole;
    message?: string;
    invitedByUserId: string;
    invitedByName?: string;
}): Promise<string> => {
    const { lifetree, invitedUserId, role } = params;
    if (!invitedUserId.trim()) throw new Error('err_choose_invitee');
    if (invitedUserId === lifetree.ownerId) throw new Error('err_owner_already');
    // Already holds this role? Check the LIN link (the single source of truth), not a legacy array.
    if ((await getDoc(doc(db, 'links', `${invitedUserId}__${role}__${lifetree.id}`))).exists()) throw new Error('err_role_already');
    // Single-field query + client filter, to avoid requiring a composite index.
    const existing = await getDocs(query(treeInvitesCollection, where('lifetreeId', '==', lifetree.id)));
    const hasPendingDupe = existing.docs.some(d => {
        const x = d.data() as any;
        return x.invitedUserId === invitedUserId && x.role === role && x.status === 'pending';
    });
    if (hasPendingDupe) throw new Error('err_invite_pending_role');
    const ref = await addDoc(treeInvitesCollection, {
        lifetreeId: lifetree.id,
        lifetreeName: lifetree.name || '',
        invitedByUserId: params.invitedByUserId,
        invitedByName: params.invitedByName || '',
        invitedUserId,
        role,
        status: 'pending',
        message: params.message || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
};

export const getPendingTreeInvites = async (userId: string): Promise<TreeOwnershipInvite[]> => {
    // Single-field query + client filter, to avoid requiring a composite index.
    const snap = await getDocs(query(treeInvitesCollection, where('invitedUserId', '==', userId)));
    return snap.docs.map(d => (mapDoc(d) as TreeOwnershipInvite)).filter(i => i.status === 'pending');
};

// Every invitation ever sent for a tree, newest first — the circle's own ledger (rules: the
// tree's carers may list by lifetreeId). Callers pick the pending ones to show and withdraw.
export const getSentTreeInvites = async (lifetreeId: string): Promise<TreeOwnershipInvite[]> => {
    const snap = await getDocs(query(treeInvitesCollection, where('lifetreeId', '==', lifetreeId)));
    return snap.docs.map(d => (mapDoc(d) as TreeOwnershipInvite))
        .sort((a, b) => ((b.createdAt as any)?.toMillis?.() || 0) - ((a.createdAt as any)?.toMillis?.() || 0));
};

export const declineTreeInvite = (inviteId: string) =>
    updateDoc(doc(db, 'treeOwnershipInvites', inviteId), { status: 'declined', declinedAt: serverTimestamp(), updatedAt: serverTimestamp() });

export const revokeTreeInvite = (inviteId: string) =>
    updateDoc(doc(db, 'treeOwnershipInvites', inviteId), { status: 'revoked', revokedAt: serverTimestamp(), updatedAt: serverTimestamp() });

// Accepting writes the tree's role arrays AND the rooted community — a protected,
// multi-document mutation, so it runs server-side (Cloud Function) with admin rights.
export const acceptTreeInvite = async (inviteId: string): Promise<{ communityId: string; lifetreeId: string }> => {
    const callable = httpsCallable(functions, 'acceptTreeInvite');
    const res = await callable({ inviteId });
    return res.data as { communityId: string; lifetreeId: string };
};

export const setTreeStatus = (id: string, status: string) => updateDoc(doc(db, 'lifetrees', id), { status });
