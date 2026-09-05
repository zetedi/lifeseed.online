import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { SuperDot } from '../ui/SuperDot';
import Logo from '../Logo';
import { Pulse } from '../../types';

import { Picture } from '../ui/Picture';
// ChainTree — renders ANY being's chain (Indra's net). The "digital tree" is the universal
// chain renderer: every being (human, AI, community, node, tree) shares one profile anatomy,
// and its immutable pulse chain always draws as a living tree — trunk, branch, leaf, root.
// Being-generic on purpose: this component knows Pulses, never Lifetrees — community/node/
// person profiles bind their own root card and stats later.

// The being's root/genesis card — the ROOT of the chain, drawn from the being itself
// (most beings are planted with no genesis pulse; special ones carry one).
export interface ChainRoot {
    imageUrl?: string | null;
    name: string;
    body?: string | null;
    // Pre-formatted "planted" line, e.g. "12/03/2025 · Under the old oak".
    plantedLabel?: string;
    // Fallback hash shown when there is no genesis pulse (the being's own genesis hash).
    hash?: string | null;
}

// The root-to-latest ledger shown at the foot of the chain.
export interface ChainStats {
    blockHeight?: number;
    genesisHash?: string;
    latestHash?: string;
}

interface ChainTreeProps {
    genesisBlock?: Pulse | null;
    // Growth blocks, DESCENDING (newest first) — the crown renders at the top, the root below.
    blocks: Pulse[];
    loading: boolean;
    onViewPulse: (pulse: Pulse) => void;
    // When a block lives elsewhere (e.g. a commit on GitHub), its leaf renders as a real link
    // (new tab) instead of an onViewPulse card. Return undefined to keep the in-app behaviour.
    hrefForBlock?: (pulse: Pulse) => string | undefined;
    // The Care CTA at the crown — shown only when the viewer may care this being.
    canCare?: boolean;
    onCare?: () => void;
    // THE UNMINT PILL (domain/unmint) — rendered on the newest leaf's LOWER-OUTSIDE edge,
    // presentation-ready (the law lives in the caller): disabled carries the reason as its
    // title; staffDot marks a live-by-role hand with the amber SuperDot. When the head block
    // has no leaf here (tree-sent reaches never enter the public timeline), a slim fallback
    // pill renders at the crown instead.
    unmint?: {
        pulseId: string;
        title: string;
        disabled: boolean;
        reason: string | null;   // already-translated refusal text, when standing
        staffDot: boolean;
        busy: boolean;
        onUnmint: () => void;
    } | null;
    emptyText?: string;
    root?: ChainRoot | null;
    stats?: ChainStats | null;
}

// Collapse the middle of a long growth chain into one clickable line.
const COLLAPSE_AT = 6, CHAIN_HEAD = 3, CHAIN_TAIL = 2;

export const ChainTree: React.FC<ChainTreeProps> = ({
    genesisBlock,
    blocks,
    loading,
    onViewPulse,
    hrefForBlock,
    canCare,
    onCare,
    emptyText,
    root,
    stats,
    unmint,
}) => {
    const { t } = useLanguage();
    // The chain can be long, so the middle collapses into a clickable line.
    const [chainExpanded, setChainExpanded] = useState(false);

    if (loading) {
        return <p className="py-10 text-center text-sm text-slate-400">{t('chain_growing')}</p>;
    }
    if (blocks.length === 0 && !genesisBlock && !root) {
        return <p className="py-10 text-center text-sm text-slate-400">{emptyText || 'No pulses yet.'}</p>;
    }

    const chainCollapsible = blocks.length > COLLAPSE_AT;
    const hiddenChainCount = chainCollapsible && !chainExpanded ? blocks.length - CHAIN_HEAD - CHAIN_TAIL : 0;
    const COLLAPSED_MARKER = { _collapsed: true } as unknown as Pulse & { _collapsed?: boolean };
    const visibleChain: (Pulse & { _collapsed?: boolean })[] = (chainCollapsible && !chainExpanded)
        ? [...blocks.slice(0, CHAIN_HEAD), COLLAPSED_MARKER, ...blocks.slice(blocks.length - CHAIN_TAIL)]
        : blocks;

    return (
        <div className="rounded-2xl bg-slate-900 p-5 text-slate-200 shadow-sm md:p-8">
            <div className="relative flex flex-col items-start md:items-center">
                {/* Central Tree Trunk — real bark: the trunk texture tiled vertically along the
                    column (a centred strip of the image repeats down the trunk), with a cylinder
                    shading overlay (dark edges, faint centre highlight) so it keeps its depth.
                    Shape (rounded top/bottom), widths (w-4 / md:w-8) and z-layering unchanged. */}
                <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-4 md:w-8 -ml-2 md:-ml-4 rounded-t-full rounded-b-2xl shadow-inner overflow-hidden z-0"
                     style={{
                         backgroundColor: '#4E342E',
                         backgroundImage: 'url(/trunkb.webp)',
                         backgroundSize: '56px auto',
                         backgroundRepeat: 'repeat-y',
                         backgroundPosition: 'center top',
                     }}>
                    <div className="absolute inset-0" style={{
                        background: 'linear-gradient(90deg, rgba(20,10,5,0.65) 0%, rgba(20,10,5,0.15) 30%, rgba(255,240,220,0.12) 50%, rgba(20,10,5,0.15) 70%, rgba(20,10,5,0.65) 100%)',
                        boxShadow: 'inset 0 0 8px rgba(0,0,0,0.55)',
                    }}></div>
                </div>

                <div className="w-full space-y-12 md:space-y-24 pb-24 relative z-10">
                    {/* Care CTA — the crown at the top of the trunk, smaller now, with the
                        expand/collapse control sitting just beneath it. Caring is the care that
                        lets it grow. */}
                    {(canCare && onCare) || chainCollapsible ? (
                        <div className="flex w-full flex-col items-start gap-2 pl-12 md:items-center md:pl-0">
                            {canCare && onCare && (
                                <button onClick={onCare} title={t('care_this_tree_title')}
                                    className="relative z-10 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white ring-2 ring-yellow-300/60 shadow-[0_0_16px_rgba(250,204,21,0.5)] transition-all hover:bg-emerald-700 hover:shadow-[0_0_24px_rgba(250,204,21,0.8)] active:scale-95">
                                    <span className="[&>svg]:h-4 [&>svg]:w-4"><Icons.Drop /></span> <span>{t('care')}</span>
                                </button>
                            )}
                            {chainCollapsible && (
                                <button onClick={() => setChainExpanded(e => !e)} className="relative z-10 text-[11px] font-bold text-emerald-300 hover:text-emerald-200">
                                    {chainExpanded ? 'Collapse the middle' : `Expand all ${blocks.length} pulses`}
                                </button>
                            )}
                        </div>
                    ) : null}
                    {/* The head block has no leaf here (a tree-sent reach): the way back still
                        shows, slim, at the crown — the law's door never silently vanishes. */}
                    {unmint && !blocks.some(b => b.id === unmint.pulseId) && (
                        <div className="relative z-10 flex w-full justify-end pl-12 md:pl-0">
                            <button
                                type="button"
                                onClick={unmint.onUnmint}
                                disabled={unmint.disabled || unmint.busy}
                                title={unmint.reason || t('unmint_confirm')}
                                className="relative inline-flex items-center gap-1.5 rounded-full bg-red-500/90 px-3 py-1.5 text-[11px] font-bold text-white shadow transition-colors hover:bg-red-600 disabled:opacity-40"
                            >
                                <span className="[&>svg]:h-3 [&>svg]:w-3"><Icons.Trash /></span>
                                <span className="max-w-[180px] truncate">{unmint.title}</span> · {unmint.busy ? '…' : t('unmint')}
                                {unmint.staffDot && <SuperDot />}
                            </button>
                        </div>
                    )}
                    {visibleChain.map((pulse, index) => {
                        // The collapsed middle renders as one clickable horizontal line.
                        if (pulse._collapsed) {
                            return (
                                <div key="chain-collapsed" className="flex w-full justify-start pl-12 md:justify-center md:pl-0">
                                    <button onClick={() => setChainExpanded(true)}
                                        className="relative z-10 flex w-full items-center justify-center gap-2 rounded-full border-2 border-dashed border-emerald-300 bg-emerald-50/80 py-2.5 text-xs font-bold text-emerald-700 backdrop-blur-sm transition-colors hover:bg-emerald-100 md:max-w-md">
                                        <Icons.List />
                                        <span>{hiddenChainCount} more pulse{hiddenChainCount !== 1 ? 's' : ''} hidden, tap to expand</span>
                                    </button>
                                </div>
                            );
                        }
                        // Visual positioning logic:
                        // index 0, 2, 4 (Even) -> Right Side (Desktop)
                        // index 1, 3, 5 (Odd) -> Left Side (Desktop)
                        const isRightSide = index % 2 === 0;
                        const pulseImages = pulse.imageUrls?.length ? pulse.imageUrls : (pulse.imageUrl ? [pulse.imageUrl] : []);
                        const pulseBadge = pulse.type === 'event' ? 'EVENT' : pulse.type === 'tree_growth' ? 'GROWTH' : 'PULSE';
                        const blockHref = hrefForBlock?.(pulse);
                        const CardTag: React.ElementType = blockHref ? 'a' : 'div';
                        const cardProps = blockHref
                            ? { href: blockHref, target: '_blank', rel: 'noopener noreferrer' }
                            : { onClick: () => onViewPulse(pulse) };

                        return (
                            <div key={pulse.id} className={`flex w-full relative ${isRightSide ? 'md:justify-end' : 'md:justify-start'} justify-start`}>

                                {/* Container Wrapper */}
                                {/* Mobile: Padded left to avoid trunk. Desktop: Half width. */}
                                <div className={`
                                    w-full md:w-1/2 min-w-0 relative flex items-center
                                    pl-12 md:pl-0
                                    ${isRightSide ? 'md:pl-16' : 'md:pr-16 md:flex-row-reverse'}
                                `}>

                                    {/* Mobile Branch — a living green stem from trunk to leaf. */}
                                    <div className="md:hidden absolute top-1/2 -mt-[3px] left-[1.15rem] w-12 h-[6px] rounded-full pointer-events-none z-0"
                                         style={{
                                             background: 'linear-gradient(180deg, #34d399 0%, #047857 45%, #065f46 100%)',
                                             boxShadow: 'inset 0 1px 2px rgba(3,60,45,0.55)',
                                         }} />

                                    {/* Desktop Branch — the same green stem, at the height the
                                        old SVG line drew at (8px below the card's vertical centre). */}
                                    <div className={`hidden md:block absolute top-1/2 mt-[3px] w-20 h-[9px] rounded-full pointer-events-none z-0 ${isRightSide ? 'left-0 -ml-2' : 'right-0 -mr-2'}`}
                                         style={{
                                             background: 'linear-gradient(180deg, #34d399 0%, #047857 45%, #065f46 100%)',
                                             boxShadow: 'inset 0 1px 2px rgba(3,60,45,0.55)',
                                         }} />

                                    {/* Leaf Card */}
                                    <CardTag
                                        {...cardProps}
                                        className={`
                                            block relative bg-white border-2 border-emerald-700/80 hover:border-emerald-700
                                            shadow-[inset_0_3px_14px_rgba(4,90,55,0.28),0_4px_12px_rgba(4,120,87,0.2)]
                                            hover:shadow-[inset_0_3px_14px_rgba(4,90,55,0.28),0_0_26px_rgba(250,204,21,0.55)]
                                            transition-all cursor-pointer group w-full min-w-0 overflow-hidden md:max-w-sm
                                            rounded-[2rem] rounded-tr-none md:rounded-bl-[3rem]
                                            ${isRightSide
                                                ? 'md:text-left'
                                                : 'md:rounded-tr-[2rem] md:rounded-tl-none md:rounded-br-[3rem] md:rounded-bl-[2rem] md:text-right'}
                                            text-left z-10
                                        `}
                                    >

                                        <div className="p-4 md:p-6 relative z-10">
                                            <div className={`flex items-center gap-2 mb-3 ${isRightSide ? '' : 'md:flex-row-reverse'} flex-row`}>
                                                {pulseBadge === 'GROWTH' ? (
                                                    <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold">GROWTH</span>
                                                ) : pulseBadge === 'EVENT' ? (
                                                    <span className="bg-sky-100 text-sky-700 text-[10px] px-2 py-0.5 rounded-full font-bold">EVENT</span>
                                                ) : (
                                                    <span className="bg-sky-100 text-sky-700 text-[10px] px-2 py-0.5 rounded-full font-bold">PULSE</span>
                                                )}
                                                {pulse.offeringId && (
                                                    <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold" title={pulse.offeringRole === 'from' ? 'offered from this chain' : 'accepted on this chain'}>OFFERING ✓</span>
                                                )}
                                                {pulse.care === 'watering' && (
                                                    <span className="bg-sky-100 text-sky-700 text-[10px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1" title={pulse.wateringConfirmation?.note || ''}>💧 {typeof pulse.wateringConfirmation?.confidence === 'number' ? `${pulse.wateringConfirmation.confidence}%` : ''}{pulse.wateringConfirmedBy === 'guardian' ? ' ✓' : ''}</span>
                                                )}
                                                {/* Spacetime — the WHEN every block carries, and the WHERE when the pulse has one. */}
                                                <span className="text-xs text-slate-400 font-mono">
                                                    {new Date(pulse.createdAt?.toMillis()).toLocaleDateString()}
                                                    {pulse.eventLocation ? <span className="text-slate-400/80"> · {pulse.eventLocation}</span> : null}
                                                </span>
                                            </div>

                                            <div className={`flex gap-4 ${isRightSide ? '' : 'md:flex-row-reverse'} flex-row items-start`}>
                                                {pulseImages.length > 0 && (
                                                    <div className="relative shrink-0">
                                                        <Picture size={480} src={pulseImages[0]} className="w-16 h-16 rounded-lg object-cover bg-slate-50 border border-slate-100" />
                                                        {pulseImages.length > 1 && (
                                                            <span className="absolute -right-1 -top-1 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-600 shadow">{pulseImages.length}</span>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <h4 dir="auto" className="font-bold text-slate-800 text-base md:text-lg leading-tight mb-1 md:mb-2 break-words">{pulse.title}</h4>
                                                    <p dir="auto" className="text-xs text-slate-500 line-clamp-3 break-words">{pulse.body}</p>
                                                    {/* The bridge stays visible downstream: a being's words, a human's hands. */}
                                                    {pulse.carriedByName && <p className="mt-1 text-[10px] italic text-purple-500">🤲 {t('carried_by').replace('{name}', pulse.carriedByName)}</p>}
                                                </div>
                                            </div>

                                            <div className={`mt-4 pt-2 border-t border-slate-50 flex items-center gap-2 ${isRightSide ? '' : 'md:flex-row-reverse'}`}>
                                                <span className={`min-w-0 flex-1 text-[9px] font-mono text-slate-300 truncate ${isRightSide ? 'md:text-left' : 'md:text-right'} text-left`}>
                                                    Hash: {pulse.hash.substring(0, 16)}...
                                                </span>
                                                {/* The newest link's way back — on the leaf's lower OUTSIDE edge. */}
                                                {unmint?.pulseId === pulse.id && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); unmint.onUnmint(); }}
                                                        disabled={unmint.disabled || unmint.busy}
                                                        title={unmint.reason || t('unmint_confirm')}
                                                        className="relative inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-bold text-white shadow transition-colors hover:bg-red-600 disabled:opacity-40"
                                                    >
                                                        <span className="[&>svg]:h-3 [&>svg]:w-3"><Icons.Trash /></span>{unmint.busy ? '…' : t('unmint')}
                                                        {unmint.staffDot && <SuperDot />}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </CardTag>
                                </div>
                            </div>
                        );
                    })}

                    {/* Genesis / planting card — the ROOT of the chain. Always shown,
                        drawn from the being itself (most beings have no genesis pulse). */}
                    {root && (
                        <div className="flex w-full justify-start md:justify-center pt-8 md:pt-12 relative pl-12 md:pl-0">
                             {/* Root Connection SVG */}
                             <svg className="md:hidden absolute top-0 left-[1.15rem] w-8 h-12 text-[#5D4037] pointer-events-none z-0" viewBox="0 0 20 40" preserveAspectRatio="none">
                                 <path d="M0,0 L0,40" stroke="currentColor" strokeWidth="6" />
                             </svg>

                             {/* The base is the PLANTING card: the genesis block (root) carrying the vision. */}
                             <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border-4 border-[#3E2723] bg-[#5D4037] text-amber-100 shadow-xl ring-4 ring-emerald-600/25 md:w-auto">
                                 {root.imageUrl && (
                                     <div className="relative h-40 w-full">
                                         <Picture size={1200} src={root.imageUrl} alt={root.name} className="h-full w-full object-cover opacity-90" />
                                         <div className="absolute inset-0 bg-gradient-to-t from-[#5D4037] via-[#5D4037]/40 to-transparent" />
                                         <span className="absolute left-3 top-3 rounded-full bg-amber-100/90 px-2 py-0.5 text-[10px] font-bold text-amber-900 shadow">🌱 PLANTING</span>
                                     </div>
                                 )}
                                 <div className="p-6 text-center">
                                     <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-amber-500/30 bg-amber-900/50 text-amber-200">
                                         <Logo width={22} height={22} />
                                     </div>
                                     <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-200">{t('chain_root_genesis')}</h4>
                                     {root.body && <p dir="auto" className="mx-auto mb-2 max-w-xs text-sm italic leading-relaxed text-amber-50/90">"{root.body}"</p>}
                                     <p className="text-[11px] text-amber-200/70">{root.plantedLabel}</p>
                                     <p className="mt-3 break-all px-2 font-mono text-[10px] text-amber-100/50">{genesisBlock?.hash || root.hash}</p>
                                 </div>
                             </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Immutable chain stats — the root-to-latest ledger, at the foot of the chain. */}
            {stats && (
                <div className="relative mt-4 overflow-hidden rounded-2xl bg-slate-900 p-6 font-mono text-xs text-slate-300 shadow-inner">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Logo width={100} height={100} /></div>
                    <h3 className="mb-6 flex items-center font-bold uppercase tracking-wider text-emerald-400">
                        <Icons.Hash /><span className="ml-2">{t('chain_immutable')}</span>
                    </h3>
                    <div className="relative z-10 grid gap-4 sm:grid-cols-3">
                        <div>
                            <p className="mb-1 text-[10px] uppercase text-slate-500">{t('chain_block_height')}</p>
                            <p className="text-2xl text-white">{stats.blockHeight}</p>
                        </div>
                        <div className="break-all">
                            <p className="mb-1 text-[10px] uppercase text-slate-500">{t('genesis')} · root</p>
                            <p className="text-emerald-500/80" dir="ltr">{stats.genesisHash}</p>
                        </div>
                        <div className="break-all">
                            <p className="mb-1 text-[10px] uppercase text-slate-500">{t('latest_hash')}</p>
                            <p className="text-emerald-300" dir="ltr">{stats.latestHash}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
