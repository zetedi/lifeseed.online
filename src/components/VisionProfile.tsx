import { useState, useEffect, useCallback } from 'react';
import { showAlert } from './ui/Dialog';
import { Vision, Pulse } from '../types';
import { Icons } from './ui/Icons';
import { SuperDot } from './ui/SuperDot';
import { useSession } from '../contexts/SessionContext';
import { BeingQr } from './ui/BeingQr';
import { LoveButton } from './ui/LoveButton';
import { mintBeingQr } from '../services/firebase/beings';
import { MahameruAvatar } from './ui/MahameruAvatar';
import { useLanguage } from '../contexts/LanguageContext';
import { canJoinVision } from '../domain/policy';
import { showsPlaceOfRecord } from '../domain/communityDoor';
import { PlaceOfRecord } from './ui/PlaceOfRecord';
import { getLifetreeById, getPulsesByVisionId, getPulsesByTreeId, mendVisionDomain } from '../services/firebase';
import { firestoreStore } from '../adapters/firestore';
import { participants, isParticipant } from '../domain/views/participation';
import { ProfileHero } from './ui/ProfileHero';
import { ProfileLayout } from './ui/ProfileLayout';
import { SectionTitle } from './ui/SectionTitle';
import { SectionMenu, SectionItem } from './ui/SectionMenu';
import { ChainTree } from './sections/ChainTree';
import { TreeParticipants } from './TreeParticipants';
import { Lifetree } from '../types';

import { Picture } from './ui/Picture';
// The vision's genesis is a sealed block, not a pulse (like a bed) — so the chain view draws its
// root from the vision itself; any pulse whose previousHash is the sentinel is treated as a root.
const isGenesisPulse = (p: Pulse) => p.previousHash === '0' || p.title === 'Genesis Pulse';

// The vision view, rendered through the shared profile scaffold so a vision reads like the community
// / lifetree / event profiles. Joining a vision is a self-serve 'joined' link (people); trees join
// via 'participant' links, shown in the Participants section.
interface VisionProfileProps {
    vision: Vision;
    onClose: () => void;
    currentUserId?: string;
    onDelete?: (id: string) => void;
    myTrees?: Lifetree[];
    // Grow this vision — seal a contribution onto the vision's OWN chain (growVision).
    onGrow?: (vision: Vision) => void;
    // Open the vision's root tree.
    onViewTree?: (tree: Lifetree) => void;
    // View a single contribution/leaf.
    onViewPulse?: (pulse: Pulse) => void;
    // The host's scoping — a strict-scoped host shows one place by definition, so the
    // place-of-record stamp (staff sight, staff mend) is hidden there entirely.
    hostStrictScope?: boolean | null;
}

type VisionSection = 'about' | 'participants' | 'contributions' | 'shadow';

export const VisionProfile = ({ vision, onClose, currentUserId, onDelete, myTrees, onGrow, onViewTree, onViewPulse, hostStrictScope }: VisionProfileProps) => {
    const { t } = useLanguage();
    const { isAdmin, isSuperAdmin } = useSession();
    const isAuthor = currentUserId === vision.authorId;
    const isRoot = vision.title.toLowerCase() === 'root vision';
    // A Root Vision on a GUARDED tree is a mistake (a guarded tree is stood-for, not dreamed
    // forward — it should never have had one), so its author may delete it. The Root Vision of a
    // personal LIFETREE stays its protected foundation and cannot be removed.
    const rootOnGuarded = isRoot && !!myTrees?.find(tr => tr.id === vision.lifetreeId && (tr.treeType === 'GUARDED' || tr.isNature));
    // The author may delete their own vision (a Root Vision only when it's the stray guarded kind).
    const canDeleteAsAuthor = isAuthor && (!isRoot || rootOnGuarded);
    // A superadmin may release ANY vision — the rules already grant staff the delete; the button
    // wears the amber SuperDot when it's this staff capability rather than the author's own hand.
    const canDeleteAsStaff = !!isSuperAdmin && !canDeleteAsAuthor;

    const [section, setSection] = useState<VisionSection>('about');
    const [isJoined, setIsJoined] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [participantCount, setParticipantCount] = useState(0);
    // The tree this vision is rooted in (vision.lifetreeId). Prefer the local copy; otherwise fetch
    // (the root tree may belong to someone else and not be in myTrees).
    const [rootTree, setRootTree] = useState<Lifetree | null>(null);
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- clears/short-circuits from the local cache before the async tree fetch below
        if (!vision.lifetreeId) { setRootTree(null); return; }
        const local = myTrees?.find(tr => tr.id === vision.lifetreeId);
        if (local) { setRootTree(local); return; }
        let alive = true;
        getLifetreeById(vision.lifetreeId).then(tr => { if (alive) setRootTree(tr); }).catch(() => {});
        return () => { alive = false; };
    }, [vision.lifetreeId, myTrees]);

    // Growing a vision seals a CONTRIBUTION onto the vision's OWN chain — no rooted tree required
    // now (the idea-twin grows independently). The vision belongs to its author, exactly as the
    // tree belongs to its owner (the twins each care their own chain); the Firestore rules gate
    // the chain advance to the author (or staff), so the button matches that gate.
    const canGrow = !!currentUserId && isAuthor;

    // The vision's own chain — its CONTRIBUTIONS. getPulsesByVisionId surfaces BOTH the new
    // vision-chained growVision blocks AND the historical vision_growth pulses once sealed onto the
    // rooted tree (they still carry visionId), so the timeline stays whole across the divergence.
    const [contribGenesis, setContribGenesis] = useState<Pulse | null>(null);
    const [contribBlocks, setContribBlocks] = useState<Pulse[]>([]);
    const [loadingContrib, setLoadingContrib] = useState(true);
    const loadContributions = useCallback(() => {
        setLoadingContrib(true);
        getPulsesByVisionId(vision.id).then(pulses => {
            setContribGenesis(pulses.find(isGenesisPulse) || null);
            setContribBlocks(pulses.filter(p => !isGenesisPulse(p)));
        }).catch(() => {}).finally(() => setLoadingContrib(false));
    // Re-runs when the vision's head advances (a fresh contribution) as well as per vision.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- head fields are refresh triggers, not body deps
    }, [vision.id, vision.blockHeight, vision.latestHash]);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async chain fetch kickoff
    useEffect(() => { loadContributions(); }, [loadContributions]);

    // The shadow TREE's chain (tree↔vision compare) — fetched only when this vision is rooted.
    const [shadowGenesis, setShadowGenesis] = useState<Pulse | null>(null);
    const [shadowBlocks, setShadowBlocks] = useState<Pulse[]>([]);
    const [loadingShadow, setLoadingShadow] = useState(false);
    const [shadowSide, setShadowSide] = useState<'vision' | 'tree'>('vision');
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- clears the shadow when the vision has no tree; the async fetch follows
        if (!vision.lifetreeId) { setShadowGenesis(null); setShadowBlocks([]); return; }
        let alive = true;
        setLoadingShadow(true);
        getPulsesByTreeId(vision.lifetreeId).then(pulses => {
            if (!alive) return;
            setShadowGenesis(pulses.find(isGenesisPulse) || null);
            setShadowBlocks(pulses.filter(p => !isGenesisPulse(p)));
        }).catch(() => {}).finally(() => { if (alive) setLoadingShadow(false); });
        return () => { alive = false; };
    }, [vision.lifetreeId]);

    // The chain's ROOT card + stats, drawn from the vision itself (its genesis is a sealed block).
    const visionChainRoot = {
        imageUrl: vision.imageUrl,
        name: vision.title,
        body: vision.body,
        plantedLabel: vision.createdAt?.toDate ? vision.createdAt.toDate().toLocaleDateString() : '',
        hash: vision.genesisHash,
    };
    const visionChainStats = { blockHeight: vision.blockHeight, genesisHash: vision.genesisHash, latestHash: vision.latestHash };

    // Participation as a prism over the LIN: the vision's incoming 'joined' links.
    useEffect(() => {
        let alive = true;
        firestoreStore.linksTo(vision.id, 'joined').then(links => {
            if (!alive) return;
            setIsJoined(isParticipant(links, currentUserId));
            setParticipantCount(participants(links).length);
        }).catch(() => {});
        return () => { alive = false; };
    }, [vision.id, currentUserId]);

    const handleJoinToggle = async () => {
        if (!canJoinVision(currentUserId) || isUpdating) return;
        setIsUpdating(true);
        try {
            if (isJoined) {
                await firestoreStore.unlink(currentUserId, 'joined', vision.id);
                setIsJoined(false);
                setParticipantCount(prev => Math.max(0, prev - 1));
            } else {
                await firestoreStore.link(currentUserId, 'joined', vision.id);
                setIsJoined(true);
                setParticipantCount(prev => prev + 1);
            }
        } catch (e: any) {
            showAlert(e?.message || 'err_action');
        }
        setIsUpdating(false);
    };

    const sections: SectionItem[] = [
        { key: 'about', label: 'About', icon: <Icons.Eye /> },
        { key: 'contributions', label: t('contributions'), icon: <Icons.Drop /> },
        // The shadow-compare only appears when the vision keeps a tree twin.
        ...(vision.lifetreeId ? [{ key: 'shadow', label: t('shadow'), icon: <Icons.Tree /> }] as SectionItem[] : []),
        { key: 'participants', label: 'Participants', icon: <Icons.Users /> },
    ];

    return (
        <div className="min-h-screen animate-in fade-in zoom-in-95 duration-300 pb-20 bg-slate-50">
            <ProfileHero heroImageUrl={vision.imageUrl || '/mahameru.svg'}>
                {/* Top bar — back + join / delete / root badge */}
                <div className="flex items-center justify-between mb-6">
                    <button onClick={onClose} className="flex items-center gap-2 text-white/70 hover:text-white text-sm font-medium">
                        <Icons.ArrowLeft />
                        <span>{t('back')}</span>
                    </button>
                    <div className="flex items-center gap-2">
                        {canGrow && onGrow && (
                            <button
                                onClick={() => onGrow(vision)}
                                className="flex items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-600 active:scale-95"
                            >
                                <Icons.Drop />
                                <span>{t('care')}</span>
                            </button>
                        )}
                        {currentUserId && !isAuthor && (
                            <button
                                onClick={handleJoinToggle}
                                disabled={isUpdating}
                                className={`flex items-center gap-1 rounded-full px-4 py-2 text-xs font-bold shadow-sm transition-all active:scale-95 ${isJoined ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-amber-500 text-white hover:bg-amber-600'}`}
                            >
                                <MahameruAvatar size={16} />
                                <span>{isJoined ? 'Joined' : 'Join Vision'}</span>
                            </button>
                        )}
                        {onDelete && (canDeleteAsAuthor || canDeleteAsStaff) && (
                            <button
                                onClick={() => onDelete(vision.id)}
                                title={canDeleteAsStaff ? 'Release this vision (staff)' : undefined}
                                className="flex items-center gap-1 rounded-full bg-red-500/15 px-4 py-2 text-xs font-bold text-red-300 border border-red-400/30 transition-colors hover:bg-red-500 hover:text-white"
                            >
                                {canDeleteAsStaff && <SuperDot />}
                                <Icons.Trash />
                                <span>{rootOnGuarded ? 'Delete (stray)' : 'Delete'}</span>
                            </button>
                        )}
                        {/* A personal tree's Root Vision is its foundation — the delete is present
                            but DISABLED, and the "cannot be deleted" reason lives in its hover
                            (the anchor message left the vision cards; it belongs only here). A
                            superadmin sees the live delete instead (they may release any vision). */}
                        {isAuthor && isRoot && !rootOnGuarded && !isSuperAdmin && (
                            <button
                                type="button"
                                disabled
                                title="This vision is the foundation of your tree and cannot be deleted."
                                className="flex cursor-not-allowed items-center gap-1 rounded-full border border-red-400/20 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-300/50"
                            >
                                <Icons.Trash />
                                <span>{t('delete')}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Avatar + title + meta */}
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
                    <div className="flex h-16 w-16 md:h-20 md:w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-amber-50 shadow-xl">
                        <Picture size={1200} src={vision.imageUrl || '/mahameru.svg'} className="h-full w-full object-cover" alt={vision.title} referrerPolicy="no-referrer" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 justify-center sm:justify-start">
                            <h1 dir="auto" className="min-w-0 break-words text-2xl font-light tracking-wide">{vision.title}</h1>
                            {participantCount > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs text-slate-200">
                                    <Icons.Users size={12} /> {participantCount} joined
                                </span>
                            )}
                            {vision.visibility && vision.visibility !== 'public' && (
                                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">{vision.visibility}</span>
                            )}
                            <BeingQr lid={vision.lid} name={vision.title} savedHref={vision.qr?.href}
                                canMint={isAuthor}
                                onMint={(href) => mintBeingQr('visions', vision.id, href)}
                                className="h-8 w-8 border border-white/15 bg-white/10 text-slate-200 hover:bg-white/25 hover:text-white" />
                            <LoveButton collection="visions" id={vision.id} initialCount={vision.loveCount || 0} className="rounded-full bg-white/15 px-2 py-1 text-white hover:bg-white/25" />
                            {rootTree && !isRoot && (
                                <button
                                    onClick={() => onViewTree?.(rootTree)}
                                    title={`Rooted in ${rootTree.name}`}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/40 bg-emerald-400/15 px-2.5 py-0.5 text-xs font-medium text-emerald-100 transition-colors hover:bg-emerald-400/30"
                                >
                                    {rootTree.imageUrl
                                        ? <Picture size={480} src={rootTree.imageUrl} alt="" referrerPolicy="no-referrer" className="h-4 w-4 rounded-full object-cover" />
                                        : <Icons.Tree />}
                                    <span className="max-w-[10rem] truncate">{t('rooted_in')} {rootTree.name}</span>
                                </button>
                            )}
                        </div>
                        <p className="mt-1 text-xs text-slate-300 text-center sm:text-left">Seeded by {vision.authorId.substring(0, 6)}…</p>
                    </div>
                </div>
            </ProfileHero>

            <ProfileLayout
                overlapClassName="-mt-8"
                menu={<SectionMenu items={sections} active={section} onSelect={(k) => setSection(k as VisionSection)} />}
            >
                {section === 'about' && (
                    <div>
                        <SectionTitle title={t('vision')} sub="What this vision is calling towards." />
                        {/* Where this vision sits relative to a tree: the tree's OWN root vision is its
                            anchor; any other vision merely roots INTO a tree, connecting to that root. */}
                        {rootTree && (
                            <button
                                onClick={() => onViewTree?.(rootTree)}
                                className="mb-6 flex w-full items-center gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-left transition-colors hover:bg-emerald-50"
                            >
                                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-white bg-emerald-100 shadow">
                                    {rootTree.latestGrowthUrl || rootTree.imageUrl
                                        ? <Picture size={480} src={rootTree.latestGrowthUrl || rootTree.imageUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                                        : <span className="flex h-full w-full items-center justify-center text-emerald-500"><Icons.Tree /></span>}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">{isRoot ? 'Root vision of' : t('rooted_in')}</p>
                                    <p className="truncate text-lg font-light tracking-wide text-slate-800">{rootTree.name}</p>
                                    <p className="truncate text-xs text-slate-500">{isRoot ? "This vision is the tree's foundation." : "Connects to this tree's root vision."}</p>
                                </div>
                                <span className="shrink-0 text-emerald-600"><Icons.ArrowRight /></span>
                            </button>
                        )}
                        {vision.imageUrl && (
                            <div className="mb-6 h-64 w-full overflow-hidden rounded-2xl border border-slate-100 bg-amber-50 shadow-sm">
                                <Picture size={1200} src={vision.imageUrl} alt={vision.title} className="h-full w-full object-cover" />
                            </div>
                        )}
                        <p dir="auto" className="whitespace-pre-wrap font-serif text-xl leading-relaxed text-slate-700">
                            {vision.body}
                        </p>
                        {vision.link && (
                            <div className="mt-8 border-t border-slate-100 pt-6">
                                <a href={vision.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-medium text-amber-600 transition-colors hover:text-amber-800">
                                    <Icons.Globe />
                                    <span className="break-all">{vision.link}</span>
                                </a>
                            </div>
                        )}
                        {/* The place-of-record stamp — staff sight, staff mend; hidden on a strict-
                            scoped host. The mend re-resolves the community grounding the same way
                            createVision did at birth (mendVisionDomain). */}
                        {showsPlaceOfRecord(isAdmin || isSuperAdmin, hostStrictScope) && (
                            <div className="mt-8 border-t border-slate-100 pt-6 text-sm text-slate-700">
                                <PlaceOfRecord
                                    beingId={vision.id}
                                    domain={vision.domain}
                                    hostStrictScope={hostStrictScope}
                                    onMend={(home) => mendVisionDomain(vision.id, home)}
                                />
                            </div>
                        )}
                    </div>
                )}

                {section === 'contributions' && (
                    <div className="space-y-6">
                        <SectionTitle title={t('contributions')} sub={t('contributions_sub')} />
                        <ChainTree
                            genesisBlock={contribGenesis}
                            blocks={contribBlocks}
                            loading={loadingContrib}
                            onViewPulse={onViewPulse ?? (() => {})}
                            canCare={!!canGrow && !!onGrow}
                            onCare={() => onGrow?.(vision)}
                            root={visionChainRoot}
                            stats={visionChainStats}
                            emptyText={t('no_contributions')}
                        />
                    </div>
                )}

                {section === 'shadow' && vision.lifetreeId && (
                    <div className="space-y-6">
                        <SectionTitle title={t('shadow')} sub={t('shadow_sub')} />
                        {/* One birth, two chains: a labelled toggle lays the twins side by side so the
                            viewer can compare how the idea grew (contributions) against how the tree
                            grew (caring). */}
                        <div className="flex items-center justify-center gap-2">
                            <button
                                onClick={() => setShadowSide('vision')}
                                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors ${shadowSide === 'vision' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                <Icons.Eye /> {t('vision')}
                            </button>
                            <button
                                onClick={() => setShadowSide('tree')}
                                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors ${shadowSide === 'tree' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                <Icons.Tree /> {rootTree?.name || t('tree')}
                            </button>
                        </div>
                        {shadowSide === 'vision' ? (
                            <ChainTree
                                genesisBlock={contribGenesis}
                                blocks={contribBlocks}
                                loading={loadingContrib}
                                onViewPulse={onViewPulse ?? (() => {})}
                                canCare={false}
                                onCare={() => {}}
                                root={visionChainRoot}
                                stats={visionChainStats}
                                emptyText={t('no_contributions')}
                            />
                        ) : (
                            <ChainTree
                                genesisBlock={shadowGenesis}
                                blocks={shadowBlocks}
                                loading={loadingShadow}
                                onViewPulse={onViewPulse ?? (() => {})}
                                canCare={false}
                                onCare={() => {}}
                                root={rootTree ? {
                                    imageUrl: rootTree.latestGrowthUrl || rootTree.imageUrl,
                                    name: rootTree.name,
                                    body: rootTree.body,
                                    plantedLabel: rootTree.createdAt?.toDate ? rootTree.createdAt.toDate().toLocaleDateString() : '',
                                    hash: rootTree.genesisHash,
                                } : null}
                                stats={rootTree ? { blockHeight: rootTree.blockHeight, genesisHash: rootTree.genesisHash, latestHash: rootTree.latestHash } : null}
                            />
                        )}
                    </div>
                )}

                {section === 'participants' && (
                    <div className="space-y-6">
                        <SectionTitle title="Participants" sub="The people and trees gathering around this vision." />
                        {participantCount > 0 && (
                            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
                                <span className="font-bold">{participantCount}</span> {participantCount === 1 ? 'person has' : 'people have'} joined this vision.
                            </div>
                        )}
                        <TreeParticipants entityId={vision.id} currentUserId={currentUserId} myTrees={myTrees} />
                    </div>
                )}
            </ProfileLayout>
        </div>
    );
};
