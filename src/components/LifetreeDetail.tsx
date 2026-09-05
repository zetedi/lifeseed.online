
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { showAlert, showConfirm } from "./ui/Dialog";
import { useLanguage } from '../contexts/LanguageContext';
import { useSession } from '../contexts/SessionContext';
import { Icons } from './ui/Icons';
import { SuperDot } from './ui/SuperDot';
import { BeingQr } from './ui/BeingQr';
import { mintBeingQr } from '../services/firebase/beings';
import { getLightHouseById } from '../services/firebase';
import type { LightHouse } from '../domain/lightHouse';
import { EditPill, DeletePill } from './ui/HeroPills';
import { LoveButton } from './ui/LoveButton';
import { updateLifetree, setTreeStatus, getPulsesByTreeId, getMyHeadBlock, unmintLastPulse, getLifetreeById, exportTree } from '../services/firebase';
import { unmintRefusal, STAFF_OVERRIDABLE_REFUSALS } from '../domain/unmint';
import { Pulse, type Lifetree } from '../types';
import { canToggleValidation, isExplicitlyValidatedTree } from '../utils/validation';
import { canReachTree, type ReachTargetProfile } from '../utils/reachPermissions';
import { treeCircle } from '../domain/views/circle';
import { beingPath } from '../domain/beingLink';
import { firestoreStore } from '../adapters/firestore';
import { BeingProfile, type BeingSection } from './BeingProfile';
import { ChainTree } from './sections/ChainTree';
import { TreeCare } from './lifetree/TreeCare';
import { TreeCircle } from './lifetree/TreeCircle';
import { TreeGardens } from './lifetree/TreeGardens';
import { TreeConnections } from './lifetree/TreeConnections';
import { TreeDetails, type TreeDetailsUpdates } from './lifetree/TreeDetails';

import { Picture } from './ui/Picture';
import { OfferingsTo } from './offerings/OfferingsTo';
interface LifetreeDetailProps {
    tree: Lifetree;
    onClose: () => void;
    onPlayGrowth: (treeId: string) => void;
    onValidate: (treeId: string, nextValidated: boolean) => void;
    onUpdate?: (updates: Partial<Lifetree>) => void;
    onDelete?: () => void;
    onCreatePulse: () => void;
    onReachTree?: (tree: Lifetree) => void;
    onViewPulse: (pulse: Pulse) => void;
    onAlertGuardians?: () => void;
    isDefaultTree?: boolean;
    onSetDefault?: () => void;
    targetUserProfile?: ReachTargetProfile | null;
    initialSection?: string;
    // Superadmin voice-bridge: "carry this being's voice" (AI beings like Aspen/Lumo, until
    // they hold their own auth). Impersonation hides the bridge; carrying reveals it. Toggling
    // passes the tree (or null) up; while active, pulses on this tree wear the being's name in
    // display fields and name the carrier (carriedByName/disclosure) — authorId stays the real uid.
    carrying?: boolean;
    onCarry?: (tree: Lifetree | null) => void;
}

// One uniform action button: icon + label on desktop, icon-only on mobile; coloured per action.
const ActionBtn = ({ onClick, disabled, title, color, icon, label }: { onClick?: () => void; disabled?: boolean; title?: string; color: string; icon: React.ReactNode; label?: string }) => (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
        className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-bold shadow-sm transition-colors disabled:opacity-50 ${color}`}>
        <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        {label && <span className="hidden md:inline">{label}</span>}
    </button>
);

export const LifetreeDetail = ({ tree, onClose, onPlayGrowth, onValidate, onUpdate, onDelete, onCreatePulse, onReachTree, onViewPulse, onAlertGuardians, isDefaultTree, onSetDefault, targetUserProfile, initialSection, carrying, onCarry }: LifetreeDetailProps) => {
   const { t } = useLanguage();
   // Session-derived values from context (were prop-drilled from App).
   const { lightseed, activeTree, isAdmin, isSuperAdmin, isInitiate } = useSession();
   const currentUser = lightseed;
   const currentUserId = lightseed?.uid;
   const myActiveTree = activeTree;
   const isOwner = currentUserId === tree.ownerId;

   // LightHouses rooted IN this tree (lightHouse __rooted__ tree): holding even one makes
   // this a MOTHER TREE. Read-only here — rooting is done from the lightHouse's page.
   const [holdingLightHouses, setHoldingLightHouses] = useState<LightHouse[]>([]);
   useEffect(() => {
       let alive = true;
       firestoreStore.linksTo(tree.id, 'rooted')
           .then(links => Promise.all(links.map(l => getLightHouseById(l.from).catch(() => null))))
           .then(list => { if (alive) setHoldingLightHouses((list || []).filter(Boolean) as LightHouse[]); })
           .catch(() => {});
       return () => { alive = false; };
   }, [tree.id]);
   const isMotherTree = holdingLightHouses.length > 0;
   const isNature = tree.isNature;
   // Guardianship is a lightweight public follow with no powers — caring vests in the invited
   // roles (co_owner/steward), tracked as `isCarer` (see the circle effect below). The guardian
   // list itself lives in the Circle view; the nonce re-reads the circle when it changes there.
   const [guardianNonce, setGuardianNonce] = useState(0);
   const [isCarer, setIsCarer] = useState(false);
   const [isGuardian, setIsGuardian] = useState(false);
   const canDelete = isOwner || isAdmin || isSuperAdmin;
   // The amber dot: this viewer may delete ONLY through staff privilege, not ownership.
   const deleteIsStaffOnly = !isOwner && (isAdmin || isSuperAdmin);
   // Caring powers vest in the owner, invited co_owners/stewards, or staff — not lightweight
   // guardians (mirrors isTreeCarer in firestore.rules).
   const canEdit = isOwner || isCarer || isAdmin || isSuperAdmin;
   const hasValidationBadge = isExplicitlyValidatedTree(tree);
   const showValidateAction = canToggleValidation({ tree, myActiveTree, isAdmin, isSuperAdmin, isInitiate });
   // Owner privacy flag is mirrored onto the (world-readable) tree, so we read it here.
   const targetProfile = targetUserProfile ?? { onlyValidatedCanReach: tree.onlyValidatedCanReach };
   const canReach = canReachTree({ targetTree: tree, targetUserProfile: targetProfile, myActiveTree, currentUserId, isAdmin, isSuperAdmin });
   const [isEditing, setIsEditing] = useState(false);
   // Deleting asks through the one Dialog (the same confirm every destructive act uses).
   const handleRequestDelete = async () => {
       if (!(await showConfirm('tree_delete_confirm', { title: 'delete_lifetree_title', confirmText: 'delete', danger: true }))) return;
       onDelete?.();
   };
   // The hero owns the name/title edits; TreeDetails owns the rest and one Save writes both.
   const [editName, setEditName] = useState(tree.name);
   const [editShortTitle, setEditShortTitle] = useState(tree.shortTitle || '');
   const [isSaving, setIsSaving] = useState(false);

   // Immutable chain Visualization State
   const [genesisBlock, setGenesisBlock] = useState<Pulse | null>(null);
   const [growthBlocks, setGrowthBlocks] = useState<Pulse[]>([]);
   const [loadingChain, setLoadingChain] = useState(false);
   const [exporting, setExporting] = useState(false);

   // Local state for immediate UI feedback on actions
   const [localStatus, setLocalStatus] = useState(tree.status || 'HEALTHY');

   // Profile-like sections: the tree is a being with a digital body, details, guardians, care
   // and a circle. Everything can be a lifetree, so this reads like a profile.
   type TreeSection = 'digital' | 'details' | 'care' | 'circle';
   const [section, setSection] = useState<TreeSection>((initialSection as TreeSection) || 'digital');
   // A caller can steer the opening section (e.g. the profile droplet opens Care).
   // eslint-disable-next-line react-hooks/set-state-in-effect -- prop→state sync: re-steers the section when the caller changes initialSection/tree; a lazy initializer only covers first mount
   useEffect(() => { if (initialSection) setSection(initialSection as TreeSection); }, [initialSection, tree?.id]);

   // THE UNMINT DOOR (domain/unmint) — the tree owns its chain, so the tree page is where
   // the newest link is taken back. liveHead shadows the tree prop (the prop can't roll
   // back from here); the head BLOCK is fetched author-constrained (rules-provable).
   const [liveHead, setLiveHead] = useState<{ latestHash?: string; blockHeight?: number }>({ latestHash: tree.latestHash, blockHeight: tree.blockHeight });
   const [headBlock, setHeadBlock] = useState<Pulse | null>(null);
   const [unminting, setUnminting] = useState(false);
   useEffect(() => {
       // The prop is only the first breath — it goes stale the moment a mint lands from
       // another surface (the thread), which offered a below-head block and a refusal
       // dressed as a broken button (2026-08-15). The LIVE tree is the only honest head.
       // eslint-disable-next-line react-hooks/set-state-in-effect -- prop-seed before the live fetch below
       setLiveHead({ latestHash: tree.latestHash, blockHeight: tree.blockHeight });
       let alive = true;
       getLifetreeById(tree.id).then(fresh => {
           if (alive && fresh) setLiveHead({ latestHash: (fresh as Lifetree).latestHash, blockHeight: (fresh as Lifetree).blockHeight });
       }).catch(() => {});
       return () => { alive = false; };
   }, [tree.id, tree.latestHash, tree.blockHeight]);
   useEffect(() => {
       // eslint-disable-next-line react-hooks/set-state-in-effect -- clears the door for a non-owner before the async head fetch below
       if (!isOwner || !currentUserId || !liveHead.latestHash) { setHeadBlock(null); return; }
       let alive = true;
       getMyHeadBlock(tree.id, liveHead.latestHash, currentUserId)
           .then(p => { if (alive) setHeadBlock(p); })
           .catch(() => { if (alive) setHeadBlock(null); });
       return () => { alive = false; };
   }, [tree.id, liveHead.latestHash, isOwner, currentUserId]);
   // The staff hand may pass the social guards (co-held, not-author) — worn with the amber
   // dot, never silently — while the structural guards (below-head, witnessed) bind everyone.
   const headRefusal0 = headBlock ? unmintRefusal(
       headBlock as { authorId?: string; type?: string; lifetreeId?: string; hash?: string; wateringConfirmedBy?: string; seenBy?: string[]; loveCount?: number; vetoes?: string[]; matchId?: string; matchedLifetreeId?: string },
       { latestHash: liveHead.latestHash }, currentUserId) : null;
   const staffUnmint = !!headRefusal0 && (isAdmin || isSuperAdmin) && STAFF_OVERRIDABLE_REFUSALS.has(headRefusal0);
   const headRefusal = staffUnmint ? null : headRefusal0;
   const handleUnmintHead = async () => {
       if (!headBlock || unminting) return;
       if (!(await showConfirm('unmint_confirm', { title: 'unmint', confirmText: 'unmint', danger: true }))) return;
       setUnminting(true);
       try {
           await unmintLastPulse(headBlock as Parameters<typeof unmintLastPulse>[0]);
           setLiveHead(prev => ({ latestHash: headBlock.previousHash, blockHeight: (prev.blockHeight || 1) - 1 }));
           setHeadBlock(null);
           loadChain(); // the timeline sheds the unmade link (if it showed it at all)
       } catch (e) { showAlert(e instanceof Error ? e.message : String(e)); }
       setUnminting(false);
   };

   // Note: getPulsesByTreeId returns Descending order (Newest First). Extracted (and kept
   // referentially stable) so a witnessed watering can refresh the chain in place. Only the
   // NEWEST load may land: a slower, older fetch never overwrites a fresher chain.
   const chainSeq = useRef(0);
   const loadChain = useCallback(() => {
        const seq = ++chainSeq.current;
        setLoadingChain(true);
        getPulsesByTreeId(tree.id).then(pulses => {
            if (seq !== chainSeq.current) return;
            // A genesis PULSE exists only for special trees (e.g. GENESIS_TREE); normal trees are
            // planted with no pulse. The planting/root card is rendered from the tree itself, so
            // here we only pull any genesis pulse out of the growth leaves.
            const isGenesis = (p: Pulse) => p.previousHash === "0" || p.title === "Genesis Pulse";
            setGenesisBlock(pulses.find(isGenesis) || null);
            setGrowthBlocks(pulses.filter(p => !isGenesis(p)));
        }).finally(() => { if (seq === chainSeq.current) setLoadingChain(false); });
   }, [tree.id]);
   // The chain follows the head: whenever the tree's latestHash moves (a Care minted from the
   // Digital Tree, a watering, an unmint — announced on the refresh bus and merged into the
   // tree by the shell), the leaves reload. Keyed on the hash, not a counter, so the same
   // head never refetches twice.
   useEffect(() => { loadChain(); }, [loadChain, tree.latestHash]);

   const handleSave = async (details: TreeDetailsUpdates) => {
       setIsSaving(true);
       try {
           // `createdAt` arrives as a JS Date (Firestore stores it as a Timestamp on write) and
           // null clears locationName/domain — hence the cast to the tree's shape.
           const updates = { name: editName, shortTitle: editShortTitle, ...details } as unknown as Partial<Lifetree>;
           await updateLifetree(tree.id, updates);
           if (onUpdate) onUpdate(updates);
           setIsEditing(false);
       } catch (e) {
           console.error(e);
           showAlert('err_save_changes');
       }
       setIsSaving(false);
   };

   // TreeDetails resets its own fields; the shell resets the hero's pair and leaves edit mode.
   const handleCancelEdit = () => {
       setIsEditing(false);
       setEditName(tree.name);
       setEditShortTitle(tree.shortTitle || '');
   };

   const handleToggleDanger = async () => {
       if (!canEdit) return; // reporting danger writes the tree's status — a carer power, not a follow
       const newStatus = localStatus === 'DANGER' ? 'HEALTHY' : 'DANGER';
       if (newStatus === "DANGER" && !(await showConfirm('danger_confirm', { title: 'danger_report', confirmText: 'report', danger: true }))) return;

       setIsSaving(true);
       try {
           await setTreeStatus(tree.id, newStatus);
           setLocalStatus(newStatus);
           if (onUpdate) onUpdate({ status: newStatus });
       } catch (e) { showAlert(e instanceof Error ? e.message : String(e)); }
       setIsSaving(false);
   }

   // Tree Circle — shared care of this Lifetree. When someone accepts an invite a
   // community circle forms around the tree (see acceptTreeInvite Cloud Function).
   const canInviteToCircle = isOwner || isSuperAdmin;
   // The Tree Circle is now a prism over the LIN: fetch the tree's incoming links through the
   // Store port: the circle is a prism over this tree's incoming links. Re-reads when a
   // guardian joins/leaves (guardianNonce) so the circle stays in step with the toggle.
   const [circle, setCircle] = useState<ReturnType<typeof treeCircle>>({ groups: [], size: 0 });
   useEffect(() => {
       let alive = true;
       firestoreStore.linksTo(tree.id)
           .then(links => {
               if (!alive) return;
               setCircle(treeCircle(tree.ownerId, links));
               // A carer holds an invited co_owner/steward role link (guardian/observer don't care).
               setIsCarer(!!currentUserId && links.some(l => l.from === currentUserId && (l.rel === 'co_owner' || l.rel === 'steward')));
               // A guardian follows the tree's care without powers — Care shows them the
               // schedule read-only, with a door to ask for stewardship.
               setIsGuardian(!!currentUserId && links.some(l => l.from === currentUserId && l.rel === 'guardian'));
           })
           .catch(() => {});
       return () => { alive = false; };
   }, [tree.id, tree.ownerId, currentUserId, guardianNonce]);

   // Watering powers vest in the circle (owner / co-owner / steward / staff — rules allow
   // the same set); the schedule editor is gated exactly like editing.
   const canWater = !!currentUserId && (isCarer || isOwner || isAdmin || isSuperAdmin);
   const canManageSchedule = canEdit;
   // Witnessing is the circle's act — keeper, co-owner, steward or guardian (never one's own
   // care; the server judges standing + tenure). Staff privilege alone is not a standing.
   const canWitness = !!currentUserId && (isOwner || isCarer || isGuardian);

   // The root card of the chain — drawn from the tree itself (normal trees have no genesis
   // pulse), pre-formatted for the entity-generic ChainTree renderer.
   const chainRoot = {
       imageUrl: tree.imageUrl,
       name: tree.name,
       body: tree.body,
       plantedLabel: `${tree.createdAt?.toDate ? tree.createdAt.toDate().toLocaleDateString() : (tree.createdAt ? new Date((tree.createdAt?.toMillis?.() ?? tree.createdAt) as unknown as string | number).toLocaleDateString() : '')}${tree.locationName ? ` · ${tree.locationName}` : ''}`,
       hash: tree.genesisHash,
   };

   // The tree's avatar/banner image — its latest growth (or its planting image).
   const heroImg = tree.latestGrowthUrl || tree.imageUrl || '';
   const [shared, setShared] = useState(false);
   // The tree's action row — one definition, two homes (desktop name-column / mobile footer).
   // One calm green for every action: the icon differentiates, the tree stays forward.
   const ACTION_GREEN = 'bg-emerald-600 text-white hover:bg-emerald-700';
   const actionRow = (
                    <>
                        <ActionBtn onClick={() => onPlayGrowth(tree.id)} title="Play growth" color={ACTION_GREEN} icon={<Icons.Play />} label="Play" />
                        {canReach
                            ? <ActionBtn onClick={() => onReachTree?.(tree)} title="Reach" color={ACTION_GREEN} icon={<Icons.Reach />} label="Reach" />
                            : <ActionBtn disabled title={t('only_if_validated')} color="bg-white/20 text-white/70" icon={<Icons.Eye />} label={t('only_if_validated')} />}
                        {/* Care is a CARER's hand (owner/co_owner/steward — mirrors isTreeCarer
                            in the rules), not the owner's alone: an invited tender tends. */}
                        {canWater && !isEditing && <ActionBtn onClick={onCreatePulse} title={t('care_this_tree_title')} color={ACTION_GREEN} icon={<Icons.Drop />} label={t('care')} />}
                        {/* Carry this being's voice — superadmin voice-bridge, on trees they care
                            (owner/co_owner/steward). Impersonation hides the bridge; carrying
                            reveals it: the display author becomes the being, the carrier is named,
                            and the block stays signed by the real uid until beings sign themselves. */}
                        {isSuperAdmin && (isOwner || isCarer) && onCarry && !isEditing && (
                            <ActionBtn
                                onClick={() => onCarry(carrying ? null : tree)}
                                title={carrying ? 'Stop carrying this being\'s voice' : "Carry this being's voice; pulses name you as the carrier"}
                                color={carrying ? `${ACTION_GREEN} ring-2 ring-white/70` : ACTION_GREEN}
                                icon={<Icons.Intelligence />}
                                label={carrying ? 'Carrying' : 'Carry a pulse'}
                            />
                        )}
                    </>
   );

   // The link is the being door (/b/<lid>): hosting serves it through beingPreview, whose card
   // wears the tree's name, words and LATEST face — the static shell's ?tree= link answered
   // with the site's own card instead. Trees without a lid keep the old door.
   const handleShare = async () => {
       const url = tree.lid ? `${window.location.origin}${beingPath(tree.lid)}` : `${window.location.origin}/?tree=${tree.id}`;
       try {
           if (navigator.share) await navigator.share({ title: tree.name, url });
           else { await navigator.clipboard.writeText(url); setShared(true); setTimeout(() => setShared(false), 1500); }
       } catch { /* user cancelled the share sheet */ }
   };
   // The tree's sections — each `render` closes over this shell's state and handlers.
   const sections: BeingSection[] = [
       {
           // Digital Tree — the immutable growth chain, rendered by the universal
           // chain renderer (ChainTree). Chain loading stays here so Care can see the
           // growth blocks (pending waterings) and refresh them in place.
           key: 'digital', label: 'Digital Tree', icon: <Icons.Tree />, render: () => (
               <>
               <ChainTree
                   genesisBlock={genesisBlock}
                   blocks={growthBlocks}
                   loading={loadingChain}
                   onViewPulse={onViewPulse}
                   canCare={canWater}
                   onCare={onCreatePulse}
                   root={chainRoot}
                   stats={{ blockHeight: liveHead.blockHeight, genesisHash: tree.genesisHash, latestHash: liveHead.latestHash }}
                   unmint={isOwner && headBlock ? {
                       pulseId: headBlock.id,
                       title: headBlock.title || headBlock.type || '',
                       disabled: !!headRefusal,
                       reason: headRefusal0 ? t(headRefusal0) : null,
                       staffDot: staffUnmint,
                       busy: unminting,
                       onUnmint: handleUnmintHead,
                   } : null}
               />
               {/* The export ceremony (domain/export): the tree and its chain leave as JSON,
                   seals verbatim, images included — gathered with this hand's own sight. */}
               {canWater && (
                   <div className="mt-4 flex justify-end">
                       <button onClick={async () => {
                           if (exporting) return;
                           setExporting(true);
                           try { await exportTree(tree); } catch { showAlert('err_export'); }
                           setExporting(false);
                       }} disabled={exporting} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50">
                           <Icons.ArrowRight size={14} /> {exporting ? t('exporting') : t('export_tree')}
                       </button>
                   </div>
               )}
               </>
           ),
       },
       {
           key: 'details', label: t('tree_details'), icon: <Icons.Info />, render: () => (
               <TreeDetails
                   tree={tree}
                   isEditing={isEditing}
                   canEdit={canEdit}
                   canDelete={canDelete}
                   deleteIsStaffOnly={deleteIsStaffOnly}
                   isSaving={isSaving}
                   onSave={handleSave}
                   onCancelEdit={handleCancelEdit}
                   onRequestDelete={handleRequestDelete}
                   onVisibilityChange={async (visibility) => {
                       try {
                           await updateLifetree(tree.id, { visibility });
                           onUpdate?.({ visibility });
                       } catch (e) {
                           console.error(e);
                           showAlert('err_visibility');
                       }
                   }}
                   // Staff-only kind conversion — rescues trees planted with the wrong kind
                   // while testing. treeType + isNature flip together (the pair every view
                   // and the planting-limit gate read).
                   onConvertType={(isAdmin || isSuperAdmin) ? async () => {
                       const toGuarded = !(tree.treeType === 'GUARDED' || tree.isNature);
                       if (!(await showConfirm(
                           toGuarded
                               ? `Convert ${tree.name} into a GUARDED (nature) tree?`
                               : `Convert ${tree.name} into a personal LIFETREE?`,
                           { title: 'Convert tree kind', confirmText: 'Convert' },
                       ))) return;
                       try {
                           const updates = { treeType: toGuarded ? 'GUARDED' : 'LIFETREE', isNature: toGuarded } as Partial<Lifetree>;
                           await updateLifetree(tree.id, updates);
                           onUpdate?.(updates);
                           showAlert(toGuarded ? `${tree.name} now stands as a guarded tree.` : `${tree.name} is a lifetree again.`);
                       } catch (e: any) {
                           console.error(e);
                           showAlert(e?.message || 'Could not convert the tree.');
                       }
                   } : undefined}
               />
           ),
       },
       {
           key: 'care', label: 'Care', icon: <Icons.Droplet />, render: () => (
               // Carers care; GUARDIANS see the same card read-only (the schedule, the rhythm,
               // the pending witnesses) with a door to ask for stewardship. Outsiders see neither.
               (isOwner || isCarer || isAdmin || isSuperAdmin || isGuardian)
                   ? <>
                   <OfferingsTo kind="tree" id={tree.id} onView={onViewPulse} />
                   <TreeCare
                       tree={tree}
                       growthBlocks={growthBlocks}
                       currentUserId={currentUserId}
                       currentUserName={currentUser?.displayName}
                       currentUserPhoto={currentUser?.photoURL}
                       isOwner={isOwner}
                       canWater={canWater}
                       canManageSchedule={canManageSchedule}
                       canAskStewardship={isGuardian && !canWater}
                       canWitness={canWitness}
                       onUpdate={onUpdate}
                       onChainRefresh={loadChain}
                   />
                   </>
                   : <p className="rounded-2xl border border-slate-100 bg-white p-6 text-center text-sm text-slate-400">{t('circle_only_care')}</p>
           ),
       },
       {
           key: 'circle', label: 'Circle', icon: <Icons.Venn />, render: () => (
               <>
               <TreeCircle
                   tree={tree}
                   currentUserId={currentUserId}
                   currentUserName={currentUser?.displayName}
                   circle={circle}
                   growthBlocks={growthBlocks}
                   canEdit={canEdit}
                   canInviteRoles={canInviteToCircle}
                   canWitness={canWitness}
                   onChainRefresh={loadChain}
                   status={localStatus}
                   busy={isSaving}
                   onToggleDanger={handleToggleDanger}
                   onGuardianChange={() => setGuardianNonce(n => n + 1)}
               />
               {/* The gardens this tree also stands in (grows_in) — the circle is its people,
                   the gardens its places. */}
               <TreeGardens tree={tree} canManage={isOwner || isCarer} />
               {/* The longitudinal walk (ring 2026-08-25) — SUPERADMIN-ONLY for now (it is
                   for later); loads lazily, only when opened. */}
               {isSuperAdmin && <div className="mt-4"><TreeConnections tree={tree} /></div>}
               </>
           ),
       },
   ];

    return (
        <>
        <BeingProfile
            className="min-h-screen animate-in fade-in zoom-in-95 duration-300"
            onClose={onClose}
            backLabel={t('back')}
            sections={sections}
            activeSection={section}
            onSectionChange={(k) => setSection(k as TreeSection)}
            hero={{
                // Profile hero — a wide banner of the latest growth image with a circular avatar.
                imageUrl: heroImg,
                heroProps: {
                    imageClassName: 'opacity-70',
                    alwaysOverlay: true,
                    overlayClassName: 'bg-gradient-to-b from-slate-900/45 via-slate-900/55 to-slate-900/85',
                    maxWidth: 'max-w-5xl',
                    // Airy, matching the user profile's hero height — room for the menu + content
                    // to overlap up onto it (layoutProps below).
                    padding: 'pt-6 pb-16 px-4',
                    // Danger Banner — click to message this tree's guardians.
                    banner: localStatus === 'DANGER' && (
                        <button
                            type="button"
                            onClick={() => onAlertGuardians?.()}
                            disabled={!onAlertGuardians}
                            title="Message this tree's guardians"
                            className="w-full bg-red-600 text-white text-center py-2 font-bold animate-pulse sticky top-0 z-40 transition-colors hover:bg-red-700 disabled:cursor-default"
                        >
                            <div className="flex items-center justify-center space-x-2">
                                <Icons.Siren />
                                <span>ALERT: THIS TREE IS IN DANGER{onAlertGuardians ? ' (message guardians)' : ''}</span>
                                <Icons.Siren />
                            </div>
                        </button>
                    ),
                },
                // The standard top bar (BeingProfile): back on the left; the ACTION ROW (play,
                // reach, care, carry) + Edit + Delete on the right, on EVERY size now (the buttons
                // are icon-only on mobile, so all fit in the top bar). QR and Share ride beside the
                // name; the shield marks the avatar.
                actions: !isEditing ? (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        {actionRow}
                        {canEdit && <EditPill onClick={() => { setIsEditing(true); setSection('details'); }} />}
                        {canDelete && <DeletePill onClick={handleRequestDelete} staffDot={deleteIsStaffOnly} title="Delete tree" />}
                    </div>
                ) : undefined,
                body: (
                    <div className="flex items-center gap-3 sm:gap-4">
                    {/* Avatar — the latest growth image. */}
                    <div className="relative shrink-0">
                        {heroImg
                            ? <Picture size={480} src={heroImg} alt={tree.name} className="h-16 w-16 rounded-full border-4 border-white bg-white object-cover shadow-xl md:h-24 md:w-24" />
                            /* Mahameru wears the starry sky (Orion); every other imageless tree
                               a plain tree glyph. */
                            : tree.id === 'GENESIS_TREE'
                                ? <img src="/mahameru.svg" alt="Mahameru" className="h-16 w-16 rounded-full border-4 border-white object-cover shadow-xl md:h-24 md:w-24" />
                                : <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-emerald-700 text-white shadow-xl md:h-24 md:w-24"><Icons.Tree /></div>}
                        {/* The shield IS the validation marker, worn on the TOP-LEFT of the avatar
                            (like the user profile): green when validated, grey when not yet; for
                            those who may act it opens the modal. */}
                        <span className="absolute -top-1 -left-1 inline-flex">
                            <button
                                type="button"
                                disabled={!showValidateAction}
                                onClick={async () => {
                                    if (!showValidateAction) return;
                                    const nv = !hasValidationBadge;
                                    if (await showConfirm(nv ? 'Validate this tree?' : 'Remove validation from this tree?', { title: 'Validation' })) onValidate(tree.id, nv);
                                }}
                                title={hasValidationBadge ? (showValidateAction ? 'Validated: remove (staff)' : 'Validated') : (showValidateAction ? t('validate_action') : 'Not validated yet')}
                                aria-label={hasValidationBadge ? 'Validated' : 'Not validated'}
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white shadow-md transition-transform ${hasValidationBadge ? 'bg-emerald-500 text-white' : 'bg-slate-500/90 text-white/85'} ${showValidateAction ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
                            >
                                <Icons.ShieldCheck className="h-4 w-4 text-current" />
                            </button>
                            {hasValidationBadge && showValidateAction && <SuperDot />}
                        </span>
                    </div>
                    <div className="min-w-0 flex-1">
                        {isEditing ? (
                            <div className="max-w-md space-y-2">
                                <input dir="auto" className="w-full border-b border-white/40 bg-white/10 p-1 text-2xl font-light tracking-wide text-white focus:outline-none md:text-3xl" value={editName} onChange={e => setEditName(e.target.value)} placeholder={t('tree_name_ph')} />
                                <input dir="auto" className="w-full border-b border-white/40 bg-white/10 p-1 text-xs font-bold uppercase tracking-widest text-white focus:outline-none" value={editShortTitle} onChange={e => setEditShortTitle(e.target.value)} placeholder="SHORT TITLE" />
                            </div>
                        ) : (
                            <>
                                {/* Share rides beside the name; Delete waits at the section's far
                                    right — the header stays one compact block, no extra rows. */}
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <h1 dir="auto" className="break-words text-2xl font-light tracking-wide md:text-3xl">{tree.name}</h1>
                                    <button onClick={handleShare} title="Share this tree" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold text-white transition-colors hover:bg-white/25">
                                        <Icons.Link /> <span>{shared ? 'Copied' : 'Share'}</span>
                                    </button>
                                    <LoveButton collection="lifetrees" id={tree.id} initialCount={tree.loveCount || 0} className="rounded-full bg-white/15 px-2 py-0.5 text-white hover:bg-white/25" />
                                    <BeingQr lid={tree.lid} name={tree.name} savedHref={tree.qr?.href}
                                        canMint={canEdit}
                                        onMint={(href) => mintBeingQr('lifetrees', tree.id, href)}
                                        className="h-7 w-7 bg-white/15 text-white hover:bg-white/25" />
                                    {/* Favourite — just a star, beside the QR. Press to make this
                                        your default tree; filled once it is. */}
                                    {isOwner && onSetDefault && (
                                        <button
                                            onClick={() => { if (!isDefaultTree) onSetDefault(); }}
                                            disabled={isDefaultTree}
                                            title={isDefaultTree ? 'Your default tree' : 'Set as default tree'}
                                            aria-label={isDefaultTree ? 'Your default tree' : 'Set as default tree'}
                                            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-110 ${isDefaultTree ? 'text-amber-300' : 'text-white/70 hover:text-amber-200'}`}
                                        >
                                            <Icons.Star filled={isDefaultTree} size={17} />
                                        </button>
                                    )}
                                    {isNature && <span className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-sky-500 px-2 py-0.5 text-[10px] font-bold"><Icons.Shield /> NATURE</span>}
                                    {isMotherTree && <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-amber-950" title={`Holds ${holdingLightHouses.map(x => x.name).join(', ')}`}><Icons.Sun /> MOTHER TREE</span>}
                                    {tree.visibility && tree.visibility !== 'public' && <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">{tree.visibility}</span>}
                                </div>
                                {tree.shortTitle && <p dir="auto" className="mt-0.5 text-xs font-bold uppercase tracking-widest text-emerald-200">{tree.shortTitle}</p>}
                                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                    <span dir="ltr" className="truncate font-mono text-xs text-white/30" title={tree.id}>{tree.id}</span>
                                    {tree.plantedAt && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-200"
                                              title={Number.isFinite(tree.plantedLatitude) ? `Planted at ${tree.plantedLatitude?.toFixed(5)}, ${tree.plantedLongitude?.toFixed(5)}${Number.isFinite(tree.plantedAltitudeM) ? ` · ${Math.round(tree.plantedAltitudeM!)} m` : ''}` : 'The real planting moment'}>
                                            🌱 Planted {new Date(tree.plantedAt.toMillis()).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}
                                        </span>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                    </div>
                ),
            }}
            // Body — section menu on the left (desktop), a strip on mobile; the menu + content
            // sit slightly OVER the hero (like the user profile), the header extending behind them.
            layoutProps={{
                maxWidth: 'max-w-5xl',
                overlapClassName: '-mt-10',
                asideClassName: 'rounded-2xl border border-slate-100 bg-white p-2 shadow-lg lg:sticky lg:top-24',
                mainClassName: 'min-w-0 space-y-6',
            }}
        />

        </>
    )
};
