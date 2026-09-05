import { useState } from 'react';
import { Modal, modalButton } from './ui/Modal';
import { Icons } from './ui/Icons';
import { markWateredOffChain } from './../services/firebase';
import type { Lifetree } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { tabTone } from '../utils/tabTheme';

import { Picture } from './ui/Picture';
// THE CARE SHEET — the care droplet opens this small, focused modal instead of steering to a
// whole page: the target tree, a single "watered today" breath of care, a door to the full Care
// section for more (photo proof, schedule, witnessing), and — when one is starred — the vision.
// An inner BLUE glow (water, not the emerald of the app) sets it apart; full-screen on mobile so
// the small content uses the space and the thumb has room.
export const CareModal = ({ tree, sender, hasVision, onOpenCare, onOpenVision, onOffer, onClose }: {
    tree: Lifetree;
    sender: { uid: string; displayName?: string | null; photoURL?: string | null };
    hasVision?: boolean;
    onOpenCare: () => void;
    onOpenVision?: () => void;
    // Care with an OFFERING (ring 2026-09-06): opens the offer form pointed at this tree.
    onOffer?: () => void;
    onClose: () => void;
}) => {
    const { t } = useLanguage();
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);
    const img = tree.latestGrowthUrl || tree.imageUrl;

    const water = async () => {
        if (busy || done) return;
        setBusy(true);
        try { await markWateredOffChain(tree, sender); setDone(true); }
        catch { /* best-effort; the full Care view surfaces errors */ }
        setBusy(false);
    };

    return (
        // A compact CENTRED modal (not full-screen): the small content fills it, no empty space.
        <Modal title={t('care')} onClose={onClose}>
            {/* The inner blue glow — a pool of water light around the content. */}
            <div className="-m-4 flex flex-col items-center gap-4 p-6 text-center shadow-[inset_0_0_70px_rgba(59,130,246,0.3)]">
                <div className="relative">
                    {img
                        ? <Picture size={480} src={img} alt={tree.name} className="h-20 w-20 rounded-full border-4 border-white object-cover shadow-lg" referrerPolicy="no-referrer" />
                        : <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-emerald-700 text-white shadow-lg"><Icons.Tree /></div>}
                    <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-sky-500 text-white shadow"><Icons.Drop /></span>
                </div>

                <div>
                    <p className="text-lg font-light tracking-wide text-slate-800">{tree.name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{t('care_breath')}</p>
                </div>

                {done ? (
                    <p className="w-full rounded-2xl bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700">{t('watered_today')} 💧</p>
                ) : (
                    <button onClick={water} disabled={busy} className={modalButton('primary', { hue: 'sky' })}>
                        {busy ? t('watering_busy') : `${t('i_watered_today')} 💧`}
                    </button>
                )}

                {/* The third way to care: an offering to this tree, answered on its own leaf. */}
                {onOffer && (
                    <button onClick={onOffer} className={modalButton('primary', { extra: 'hover:brightness-110' })}
                        style={{ backgroundColor: tabTone('offerings'), boxShadow: '0 10px 15px -3px rgba(41,132,66,0.25)' }}>
                        <span className="[&>svg]:h-4 [&>svg]:w-4"><Icons.Sun /></span> {t('care_offer')}
                    </button>
                )}

                <div className="flex items-center gap-4">
                    <button onClick={onOpenCare} className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 transition-colors hover:text-sky-700">
                        {t('open_full_care')} <Icons.ArrowRight size={14} />
                    </button>
                    {hasVision && onOpenVision && (
                        <button onClick={onOpenVision} className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 transition-colors hover:text-amber-700">
                            <span className="[&>svg]:h-3.5 [&>svg]:w-3.5"><Icons.Eye /></span> {t('care_your_vision')}
                        </button>
                    )}
                </div>
            </div>
        </Modal>
    );
};
