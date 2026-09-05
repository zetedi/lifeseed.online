
import { useState, useEffect } from 'react';
import { fetchGrowthPulses, getLifetreeById } from '../services/firebase';
import { Modal } from './ui/Modal';
import { Icons } from './ui/Icons';
import { speak } from '../utils/translations';
import { useLanguage } from '../contexts/LanguageContext';

import { Picture } from './ui/Picture';
// One frame of the evolution: the planting/genesis image first, then each growth pulse.
interface Frame {
    imageUrl?: string;
    title: string;
    subtitle?: string;
    createdAt?: any;
    isGenesis?: boolean;
}

export const GrowthPlayerModal = ({ treeId, onClose }: { treeId: string, onClose: () => void }) => {
    const { t } = useLanguage();
    const [frames, setFrames] = useState<Frame[]>([]);
    const [index, setIndex] = useState(0);
    const [done, setDone] = useState(false);
    const [playNonce, setPlayNonce] = useState(0); // bump to replay from the start
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let alive = true;
        const timeout = setTimeout(() => { if (alive) setLoading(false); }, 10000);

        Promise.all([getLifetreeById(treeId), fetchGrowthPulses(treeId)])
            .then(([tree, pulses]) => {
                if (!alive) return;
                // fetchGrowthPulses returns newest-first; the evolution plays OLDEST -> NEWEST.
                const growth = pulses.filter(p => p.imageUrl).reverse();
                const out: Frame[] = [];
                if (tree?.imageUrl) {
                    out.push({ imageUrl: tree.imageUrl, title: `${tree.name} · Planted`, subtitle: tree.body, createdAt: tree.createdAt, isGenesis: true });
                }
                growth.forEach(p => out.push({
                    imageUrl: p.imageUrl,
                    title: p.title,
                    subtitle: (p as any).care === 'watering' ? '💧 Watering' : undefined,
                    createdAt: p.createdAt,
                }));
                setFrames(out);
                setIndex(0);
                setLoading(false);
            })
            .catch(err => {
                if (!alive) return;
                console.error(err);
                setError("Failed to load growth images.");
                setLoading(false);
            });

        return () => { alive = false; clearTimeout(timeout); };
    }, [treeId]);

    // Play through ONCE (oldest -> newest), then stop and offer replay. Driving the index from a
    // single local counter keeps the frame + caption + dots perfectly in sync.
    useEffect(() => {
        if (frames.length === 0) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- rewinds playback when frames/playNonce change before starting the interval timer below; the reset and the timer must stay atomic
        setIndex(0);
        if (frames.length === 1) { setDone(true); return; }
        setDone(false);
        let i = 0;
        const timer = setInterval(() => {
            i += 1;
            if (i >= frames.length - 1) {
                setIndex(frames.length - 1);
                setDone(true);
                clearInterval(timer);
                return;
            }
            setIndex(i);
        }, 1400);
        return () => clearInterval(timer);
    }, [frames, playNonce]);

    const f = frames[index];
    const frameDate = (x: any) => x ? new Date(x?.toMillis?.() ?? x).toLocaleDateString() : '';

    return (
        <Modal title="Growth Evolution" onClose={onClose}>
            {loading ? <div className="p-10 text-center">Loading Growth...</div> : (
                error ? <div className="p-10 text-center text-red-500">{speak(error)}</div> :
                !f ? <div className="p-10 text-center">{t('no_growth_pictures')}</div> :
                <div className="flex flex-col items-center">
                    <div className="relative w-full">
                        <Picture size={1200} src={f.imageUrl} className="w-full h-64 object-cover rounded-lg shadow-lg mb-4" />
                        {f.isGenesis && (
                            <span className="absolute left-2 top-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 shadow">🌱 PLANTING</span>
                        )}
                        {/* Replay — appears once the evolution has played through. Same green-on-yellow
                            treatment as the hero Play Growth button. */}
                        {done && frames.length > 1 && (
                            <button
                                type="button"
                                onClick={() => setPlayNonce(n => n + 1)}
                                title="Replay growth"
                                className="absolute inset-0 mb-4 flex items-center justify-center rounded-lg bg-black/30 transition-colors hover:bg-black/40"
                            >
                                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-yellow-300 shadow-lg shadow-emerald-900/40 ring-2 ring-yellow-300/60 transition-transform active:scale-95">
                                    <Icons.Refresh />
                                </span>
                            </button>
                        )}
                    </div>
                    <p className="text-center font-bold">{f.title}</p>
                    {f.subtitle && (
                        <p className="mt-0.5 max-w-md text-center text-xs italic text-slate-500 line-clamp-2">
                            {f.isGenesis ? `"${f.subtitle}"` : f.subtitle}
                        </p>
                    )}
                    <p className="mt-1 text-xs text-slate-400">{frameDate(f.createdAt)}</p>
                    <div className="mt-4 flex flex-wrap justify-center gap-1">
                        {frames.map((fr, i) => <div key={i} className={`h-1 w-4 rounded ${i === index ? (fr.isGenesis ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-slate-200'}`} />)}
                    </div>
                </div>
            )}
        </Modal>
    );
};
