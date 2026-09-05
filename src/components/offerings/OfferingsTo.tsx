import { useEffect, useState } from 'react';
import { getOfferingsTo } from '../../services/firebase';
import { offeringStatusOf } from '../../domain/offering';
import { formatLight } from '../../domain/light';
import { Icons } from '../ui/Icons';
import { Picture } from '../ui/Picture';
import { useLanguage } from '../../contexts/LanguageContext';
import type { Pulse } from '../../types';

// THE OFFERINGS MADE TO A BEING (ring 2026-09-06) — the receiver finds them on the being's own
// face: each a door to the offering's leaf, where it is answered. Open ones first.
export const OfferingsTo = ({ kind, id, onView }: { kind: 'tree' | 'vision'; id: string; onView: (p: Pulse) => void }) => {
    const { t } = useLanguage();
    const [offerings, setOfferings] = useState<Pulse[] | null>(null);
    useEffect(() => {
        let live = true;
        getOfferingsTo(kind, id).then(list => { if (live) setOfferings(list); }).catch(() => { if (live) setOfferings([]); });
        return () => { live = false; };
    }, [kind, id]);
    if (!offerings || offerings.length === 0) return null;
    const rank = (p: Pulse) => (offeringStatusOf(p) === 'open' ? 0 : 1);
    const statusKey = (p: Pulse) => `offering_status_${offeringStatusOf(p) || 'open'}` as const;
    const tone = (p: Pulse) => ({ open: 'bg-amber-50 text-amber-700', accepted: 'bg-emerald-50 text-emerald-700', withdrawn: 'bg-slate-100 text-slate-500', declined: 'bg-slate-100 text-slate-500' })[offeringStatusOf(p) || 'open'];
    return (
        <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                <span className="text-amber-500 [&>svg]:h-4 [&>svg]:w-4"><Icons.Sun /></span> {t('offerings_to_this')}
            </div>
            <ul className="space-y-2">
                {[...offerings].sort((a, b) => rank(a) - rank(b)).map(p => (
                    <li key={p.id}>
                        <button type="button" onClick={() => onView(p)} className="flex w-full items-center gap-3 rounded-xl border border-slate-100 px-3 py-2 text-left transition-colors hover:bg-slate-50">
                            {p.imageUrl
                                ? <Picture size={480} src={p.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                                : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 [&>svg]:h-4 [&>svg]:w-4"><Icons.Sun /></span>}
                            <span className="min-w-0 flex-1">
                                <span dir="auto" className="block truncate text-sm font-medium text-slate-800">{p.title}</span>
                                <span className="block truncate text-xs text-slate-400">{p.authorName || ''}{p.offeringAppreciationLight ? ` · ${formatLight(p.offeringAppreciationLight)}` : ''}</span>
                            </span>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${tone(p)}`}>{t(statusKey(p))}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};
