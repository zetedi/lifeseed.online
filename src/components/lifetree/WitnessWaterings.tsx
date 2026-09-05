import React, { useState } from 'react';
import { showAlert } from '../ui/Dialog';
import { Icons } from '../ui/Icons';
import { useLanguage } from '../../contexts/LanguageContext';
import { witnessWatering } from '../../services/firebase';
import { spokenLine } from '../../utils/translations';
import type { Pulse } from '../../types';

import { Picture } from '../ui/Picture';
// The waterings of a tree no human has witnessed yet, and the circle's hand to witness them —
// the sun ring's mint, judged on server ground (witnessWatering). One face, shown wherever
// care is read: the Care tab beside "last watered", and the Circle. Who may witness is the
// circle minus the carer: the keeper, a co-owner, a steward or a guardian — never one's own
// care (ring 2026-09-03, "the circle witnesses"). The server judges standing and tenure; this
// only offers the button where it can succeed, and names the state of each watering honestly.
export const awaitingWitness = (pulses: Pulse[]): Pulse[] =>
    pulses.filter(p => p.care === 'watering' && p.wateringConfirmedBy !== 'guardian');

interface WitnessWateringsProps {
    treeName?: string;
    // The tree's growth blocks (newest first); the un-witnessed waterings are read from them.
    pulses: Pulse[];
    currentUserId?: string;
    // The viewer stands in the circle (owner / co-owner / steward / guardian).
    canWitness: boolean;
    // Reload the chain after a witness landed (the block now carries its confirmation).
    onWitnessed?: () => void;
    className?: string;
}

export const WitnessWaterings: React.FC<WitnessWateringsProps> = ({ treeName, pulses, currentUserId, canWitness, onWitnessed, className = '' }) => {
    const { t } = useLanguage();
    const [witnessing, setWitnessing] = useState<string | null>(null);
    const waiting = awaitingWitness(pulses).slice(0, 8);
    if (waiting.length === 0) return null;

    const handleWitness = async (p: Pulse) => {
        setWitnessing(p.id);
        try {
            const res = await witnessWatering(p.id);
            showAlert(res.kindled
                ? spokenLine('witness_kindled', { tree: treeName || t('tree') })
                : 'witness_already_lit');
            onWitnessed?.();
        } catch (e) { showAlert(e instanceof Error ? e.message : String(e)); }
        setWitnessing(null);
    };

    return (
        <div className={`rounded-2xl border border-sky-100 bg-sky-50/60 p-4 ${className}`}>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-sky-600">{t('witness_waterings')}</p>
            <div className="space-y-1.5">
                {waiting.map(p => {
                    const mine = !!currentUserId && p.authorId === currentUserId;
                    const when = p.createdAt?.toMillis ? new Date(p.createdAt.toMillis()).toLocaleDateString() : t('a_watering');
                    return (
                        <div key={p.id} className="flex items-center gap-3 rounded-xl border border-sky-100 bg-white p-2 shadow-sm">
                            {p.imageUrl
                                ? <Picture size={480} src={p.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                                : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-500 [&>svg]:h-5 [&>svg]:w-5"><Icons.Droplet /></span>}
                            <span className="min-w-0 flex-1 text-xs text-slate-600">
                                <span className="block truncate">{when}{p.authorPersonName ? ` · ${p.authorPersonName}` : ''}{p.wateringConfirmation?.note ? ` · ${p.wateringConfirmation.note}` : ''}</span>
                                <span className="block text-[10px] font-bold uppercase tracking-wide text-sky-500">
                                    {p.wateringConfirmedBy === 'ai' ? t('confirmed_by_ai') : t('awaiting_confirmation')}
                                </span>
                            </span>
                            {canWitness && !mine && (
                                <button
                                    onClick={() => handleWitness(p)}
                                    disabled={witnessing === p.id}
                                    className="shrink-0 rounded-full bg-sky-600 px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
                                >
                                    {witnessing === p.id ? '…' : t('witness')}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-sky-700/80">{t('witness_hint')}</p>
        </div>
    );
};
