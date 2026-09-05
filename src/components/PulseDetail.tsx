import { useEffect, useState } from 'react';
import { Pulse, Lifetree } from '../types';
import { Icons } from './ui/Icons';
import { SuperDot } from './ui/SuperDot';
import { ProfileHero } from './ui/ProfileHero';
import { PulseInsightPanel } from './ui/PulseInsightPanel';
import { useSession } from '../contexts/SessionContext';
import { firestoreStore } from '../adapters/firestore';
import { vetoGrowthPulse, unmintLastPulse } from '../services/firebase/pulses';
import { getLifetreeById } from '../services/firebase';
import { announce } from '../services/refreshBus';
import { canVeto, isVetoed, vetoProgress, type VetoInput } from '../domain/guardianVeto';
import { unmintRefusal, STAFF_OVERRIDABLE_REFUSALS } from '../domain/unmint';
import { showAlert, showConfirm } from './ui/Dialog';
import { BeingQr } from './ui/BeingQr';
import { mintBeingQr } from '../services/firebase/beings';
import { useLanguage } from '../contexts/LanguageContext';

import { Picture } from './ui/Picture';
// The generic pulse view — a PROFILE, not a modal: the same ProfileHero + full-page scaffold as
// VisionProfile / EventProfile / AlignmentView, so every entity (tree, vision, event, alignment,
// pulse) opens into one profile anatomy (Indra's net). It still renders inside App's
// DetailWrapper overlay, so it keeps its own full-page slate background.

interface PulseDetailProps {
    pulse: Pulse;
    activeTree?: Lifetree | null;
    onClose: () => void;
    backLabel?: string;
    canEdit?: boolean;
    onEdit?: () => void;
}

export const PulseDetail = ({ pulse, activeTree, onClose, backLabel, canEdit, onEdit }: PulseDetailProps) => {
    const { t } = useLanguage();
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const images = pulse.imageUrls?.length ? pulse.imageUrls : (pulse.imageUrl ? [pulse.imageUrl] : []);

    // The guardians' conscience — on a growth mint, the tree's guardians may consensus-veto
    // (domain/guardianVeto). The chain stays append-only: a vetoed mint is marked, not erased.
    const { lightseed, isAdmin, isSuperAdmin } = useSession();
    const viewerUid = lightseed?.uid;
    const isGrowthMint = pulse.type === 'tree_growth' && !!pulse.lifetreeId;
    const [guardians, setGuardians] = useState<{ uid: string; sinceMs?: number }[]>([]);
    const [vetoes, setVetoes] = useState<string[]>(pulse.vetoes || []);
    const [isVetoing, setIsVetoing] = useState(false);
    useEffect(() => {
        if (!isGrowthMint) return;
        let alive = true;
        firestoreStore.linksTo(pulse.lifetreeId!, 'guardian')
            .then(links => { if (alive) setGuardians(links.map(l => ({ uid: l.from, sinceMs: (l as any).createdAt?.toMillis?.() || 0 }))); })
            .catch(() => {});
        return () => { alive = false; };
    }, [isGrowthMint, pulse.lifetreeId]);
    // Captured once per mount — the 72h veto window doesn't need a ticking clock.
    const [nowMs] = useState(() => Date.now());
    const vetoInput: VetoInput = {
        pulseType: pulse.type,
        pulseAuthorId: pulse.authorId || '',
        pulseCreatedAtMs: pulse.createdAt?.toMillis?.() || 0,
        guardians,
        vetoUids: vetoes,
        nowMs,
    };
    const vetoed = isGrowthMint && isVetoed(vetoInput);
    const viewerCanVeto = isGrowthMint && canVeto(vetoInput, viewerUid);
    const progress = vetoProgress(vetoInput);

    // THE UNMINT (domain/unmint) — the author of the tree's NEWEST block may take it back;
    // the chain shortens by one link, atomically, and only from the head. Any block kind
    // qualifies (growth, tree-sent reach, alignment) — the refusals carry the law.
    const isChainBlock = !!pulse.lifetreeId && !!pulse.hash && (pulse.type as string) !== 'decision';
    const [treeHead, setTreeHead] = useState<{ latestHash?: string } | null>(null);
    useEffect(() => {
        if (!isChainBlock || !viewerUid || pulse.authorId !== viewerUid) return;
        let alive = true;
        getLifetreeById(pulse.lifetreeId!)
            .then(tr => { if (alive) setTreeHead(tr ? { latestHash: (tr as { latestHash?: string }).latestHash } : null); })
            .catch(() => {});
        return () => { alive = false; };
    }, [isChainBlock, pulse.lifetreeId, pulse.authorId, viewerUid]);
    const unmintDenied = treeHead ? unmintRefusal(
        pulse as { authorId?: string; type?: string; lifetreeId?: string; hash?: string; wateringConfirmedBy?: string; seenBy?: string[]; loveCount?: number; vetoes?: string[]; matchId?: string; matchedLifetreeId?: string },
        treeHead, viewerUid) : 'unmint_not_last';
    const staffUnmint = !!unmintDenied && unmintDenied !== 'unmint_not_last' && (isAdmin || isSuperAdmin) && STAFF_OVERRIDABLE_REFUSALS.has(unmintDenied);
    const viewerCanUnmint = !!treeHead && (unmintDenied === null || staffUnmint);
    const [unminting, setUnminting] = useState(false);
    const handleUnmint = async () => {
        if (unminting || !(await showConfirm('unmint_confirm', { title: 'unmint', confirmText: 'unmint', danger: true }))) return;
        setUnminting(true);
        try {
            await unmintLastPulse(pulse as Parameters<typeof unmintLastPulse>[0]);
            announce('pulses', pulse.id);
            onClose();
        } catch (e: unknown) {
            showAlert((e as Error)?.message || 'err_action');
            setUnminting(false);
        }
    };
    const handleVeto = async () => {
        if (!viewerUid || isVetoing) return;
        if (!(await showConfirm('veto_confirm', { title: 'guardian_veto', confirmText: 'veto', danger: true }))) return;
        setIsVetoing(true);
        try {
            await vetoGrowthPulse(pulse.id, viewerUid);
            setVetoes(prev => prev.includes(viewerUid) ? prev : [...prev, viewerUid]);
        } catch (e: any) {
            showAlert(e?.message || 'Could not cast the veto.');
        }
        setIsVetoing(false);
    };

    return (
        <div className="min-h-screen animate-in fade-in zoom-in-95 duration-300 pb-20 bg-slate-50">
            {/* Hero — back button + type/status chips, then avatar + title + meta. */}
            <ProfileHero heroImageUrl={images[0]}>
                <div className="flex items-center justify-between mb-6">
                    <button onClick={onClose} className="flex items-center gap-2 text-white/70 hover:text-white text-sm font-medium">
                        <Icons.ArrowLeft />
                        <span>{backLabel || t('back')}</span>
                    </button>
                    <div className="flex items-center gap-2">
                        {pulse.type === 'event' && canEdit && onEdit && (
                            <button onClick={onEdit} className="flex items-center gap-1.5 rounded-full bg-sky-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-sky-700">
                                <Icons.Pencil /> {t('edit')}
                            </button>
                        )}
                        {viewerCanUnmint && (
                            <button onClick={handleUnmint} disabled={unminting}
                                title={t('unmint_confirm')}
                                className="relative flex items-center gap-1.5 rounded-full border border-red-300/40 bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-200 transition-colors hover:bg-red-500 hover:text-white disabled:opacity-50">
                                <Icons.Trash /> {t('unmint')}
                                {staffUnmint && <SuperDot />}
                            </button>
                        )}
                        {vetoed && (
                            <span className="flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                                ⊘ {t('vetoed_by_guardians')}
                            </span>
                        )}
                        {pulse.care === 'watering' && (
                            <span className="flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-700">
                                💧 {pulse.wateringConfirmedBy === 'ai' ? t('confirmed_by_ai') : pulse.wateringConfirmedBy === 'guardian' ? t('confirmed_by_guardian') : t('awaiting_confirmation')}
                            </span>
                        )}
                        {/* Type badge — the pulse's kind, worn as the status chip. */}
                        <span className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-200">
                            <Icons.Hash /> {pulse.type}
                        </span>
                        <BeingQr lid={pulse.lid} name={pulse.title} savedHref={pulse.qr?.href}
                            canMint={!!viewerUid && (pulse.authorId === viewerUid)}
                            onMint={(href) => mintBeingQr('pulses', pulse.id, href)}
                            className="h-8 w-8 border border-white/15 bg-white/10 text-slate-200 hover:bg-white/25 hover:text-white" />
                    </div>
                </div>
                <div className="flex items-center gap-4 sm:gap-5">
                    <div className="flex h-16 w-16 md:h-20 md:w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-emerald-50 text-emerald-500 shadow-xl">
                        {images[0]
                            ? <Picture size={1200} src={images[0]} className="h-full w-full object-cover" alt={pulse.title} referrerPolicy="no-referrer" />
                            : <Icons.Lightning />}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h1 dir="auto" className="min-w-0 break-words text-2xl font-light tracking-wide">{pulse.title}</h1>
                        <p className="mt-1 text-xs text-slate-300">
                            {t('by_name').replace('{name}', pulse.authorName || '')}
                        </p>
                        {/* Carried pulse — the bridge stays visible: a being's words, a human's hands. */}
                        {pulse.carriedByName && (
                            <p className="mt-0.5 text-[11px] text-slate-400">{t('carried_by').replace('{name}', pulse.carriedByName)}</p>
                        )}
                        {/* Spacetime — the WHEN (date + time) every pulse carries, and the WHERE when it has one. */}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 font-mono text-[10px] text-slate-300">
                                {new Date(pulse.createdAt?.toMillis()).toLocaleString()}
                            </span>
                            {pulse.eventLocation && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 font-mono text-[10px] text-slate-300">
                                    <Icons.Loc /> {pulse.eventLocation}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </ProfileHero>

            {/* Body — the pulse itself: images, event/watering context, and the text. */}
            <div className="mx-auto mt-6 max-w-3xl px-4 sm:px-6">
                <div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-6 shadow-lg">
                    {images.length > 0 && (
                        <div className="relative mb-6 h-96 w-full overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm group">
                            <img src={images[activeImageIndex]} alt={pulse.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                            {images.length > 1 && (
                                <div className="absolute bottom-4 left-4 right-4 flex gap-2 overflow-x-auto rounded-2xl bg-black/30 p-2 backdrop-blur-md">
                                    {images.map((url, index) => (
                                        <button
                                            key={url}
                                            onClick={() => setActiveImageIndex(index)}
                                            className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 ${activeImageIndex === index ? 'border-white' : 'border-white/30'}`}
                                        >
                                            <img src={url} className="h-full w-full object-cover" alt="" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {pulse.type === 'event' && (
                        <div className="mb-4 grid gap-2 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900">
                            {pulse.eventDate && <div><span className="font-bold">{t('when')}:</span> {new Date(pulse.eventDate).toLocaleString()}</div>}
                            {pulse.eventLocation && <div><span className="font-bold">Where:</span> {pulse.eventLocation}</div>}
                        </div>
                    )}
                    {pulse.care === 'watering' && (
                        <div className="mb-4 grid gap-1.5 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900">
                            <div className="flex items-center gap-2 font-bold"><Icons.Droplet size={16} /> <span>Watering</span></div>
                            {/* The AI's reading — a witness, not the authority. */}
                            {typeof pulse.wateringConfirmation?.confidence === 'number' && (
                                <div className="text-xs text-sky-800/90">
                                    <span className="font-semibold">AI reading:</span> {pulse.wateringConfirmation.confidence}% consistent with watering
                                    {pulse.wateringConfirmation?.note && <span className="italic">: “{pulse.wateringConfirmation.note}”</span>}
                                </div>
                            )}
                            {/* The human reading — who says "yes, this was cared for". */}
                            <div className="text-xs text-sky-800/90">
                                <span className="font-semibold">Cared for:</span>{' '}
                                {pulse.wateringConfirmedBy === 'guardian'
                                    ? 'confirmed by a guardian'
                                    : pulse.wateringConfirmedBy === 'ai'
                                        ? 'auto-accepted on the AI reading; a guardian can still confirm'
                                        : 'awaiting a guardian’s confirmation'}
                            </div>
                        </div>
                    )}
                    <p dir="auto" className="text-slate-600 leading-relaxed whitespace-pre-wrap font-serif text-lg">
                        {pulse.content || pulse.body}
                    </p>
                </div>

                {/* The guardians' conscience — consensus veto on a growth mint. */}
                {isGrowthMint && guardians.length > 0 && (
                    <div className={`mt-6 rounded-2xl border p-5 shadow-sm ${vetoed ? 'border-red-200 bg-red-50' : 'border-amber-100 bg-amber-50/50'}`}>
                        <h3 className={`mb-2 flex items-center text-xs font-bold uppercase tracking-wider ${vetoed ? 'text-red-500' : 'text-amber-600'}`}>
                            <Icons.Shield /><span className="ml-2">Guardians' conscience</span>
                        </h3>
                        {vetoed ? (
                            <p className="text-sm text-red-700">
                                This mint was vetoed by guardian consensus. It stands on the chain, marked and discounted.
                            </p>
                        ) : (
                            <div className="flex flex-wrap items-center gap-3">
                                <p className="text-sm text-amber-800">
                                    {progress.cast === 0
                                        ? 'The tree\'s guardians may veto this mint in consensus.'
                                        : `Veto: ${progress.cast} of ${progress.needed} guardians; it stands only in full agreement.`}
                                </p>
                                {viewerCanVeto && (
                                    <button onClick={handleVeto} disabled={isVetoing}
                                        className="rounded-full border border-red-300 bg-white px-4 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-600 hover:text-white disabled:opacity-50">
                                        {isVetoing ? 'Casting…' : 'Veto this mint'}
                                    </button>
                                )}
                                {!viewerCanVeto && viewerUid && vetoes.includes(viewerUid) && (
                                    <span className="text-xs font-bold text-red-500">{t('veto_cast')}</span>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* H2H Translation + Network Memory — RETURNED (ring 2026-08-21): the Per Auset
                    slimming (89a378b) moved the reading out of the pulse profile and it was missed.
                    The panel carries both the Translation Depth reading and the chain standing. */}
                <div className="mt-6">
                    <PulseInsightPanel pulse={pulse} activeTree={activeTree} />
                </div>
            </div>
        </div>
    );
}
