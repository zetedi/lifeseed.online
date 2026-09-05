
import React, { useCallback, useEffect, useState } from 'react';
import { getTreesByDomain } from '../services/firebase';
import { type Lifetree } from '../types';
import Logo from './Logo';
import { speak } from '../utils/translations';
import { useLanguage } from '../contexts/LanguageContext';

import { Picture } from './ui/Picture';
interface Props {
    domain: string;
    onClose?: () => void;
}

export const LifeseedWidget: React.FC<Props> = ({ domain, onClose }) => {
    const { t } = useLanguage();
    const [trees, setTrees] = useState<Lifetree[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTrees = useCallback(async () => {
        if (!domain) { setLoading(false); return; }
        setLoading(true);
        setError(null);
        try {
            setTrees(await getTreesByDomain(domain));
        } catch (e: any) {
            console.error(e);
            setError(e?.message || 'Failed to load trees');
        } finally {
            setLoading(false);
        }
    }, [domain]);

    // Initial load
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchTrees flips the loading flag synchronously before awaiting the fetch; that's the loading-state pattern, not derived state
    useEffect(() => { fetchTrees(); }, [fetchTrees]);

    // Re-fetch whenever the parent page signals the widget was opened
    useEffect(() => {
        const handler = (e: MessageEvent) => {
            if (e.data === 'lifeseed-refresh') fetchTrees();
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [fetchTrees]);

    const handleClose = () => {
        if (onClose) { onClose(); return; }
        try { window.parent.postMessage('lifeseed-close', '*'); } catch { /* cross-origin */ }
    };

    return (
        <div className="flex flex-col h-screen bg-white overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <Logo width={28} height={28} />
                    <div>
                        <p className="text-xs text-slate-400 leading-none">trees at</p>
                        <p className="text-sm font-semibold text-emerald-700 leading-tight truncate max-w-[200px]">{domain || 'unknown'}</p>
                    </div>
                </div>
                <button
                    onClick={handleClose}
                    className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors text-xl leading-none"
                    aria-label="Close"
                >
                    ×
                </button>
            </div>

            {/* Tree list */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Loading...</div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-2 text-red-400 text-xs text-center px-6">
                        <p className="font-medium">{t('err_load_trees')}</p>
                        <p className="text-slate-400">{speak(error)}</p>
                    </div>
                ) : trees.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-400 text-sm text-center px-6">
                        <Logo width={40} height={40} />
                        <p>{t('no_trees_domain')}</p>
                        <a
                            href="https://lightseed.online"
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-600 hover:underline text-xs font-medium"
                        >
                            Plant one on lightseed.online →
                        </a>
                    </div>
                ) : (
                    <ul className="divide-y divide-slate-50">
                        {trees.map(tree => (
                            <li key={tree.id}>
                                <a
                                    href={`https://lightseed.online?tree=${tree.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex gap-3 p-3 hover:bg-slate-50 transition-colors"
                                >
                                    {(tree.latestGrowthUrl || tree.imageUrl) ? (
                                        <Picture size={480}
                                            src={tree.latestGrowthUrl || tree.imageUrl}
                                            alt={tree.name}
                                            className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-slate-100"
                                        />
                                    ) : (
                                        <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                            <Logo width={28} height={28} />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0 py-0.5">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-medium text-sm text-slate-800 truncate">{tree.name}</span>
                                            {tree.status === 'DANGER' && (
                                                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="In danger" />
                                            )}
                                        </div>
                                        {tree.shortTitle && <p className="text-xs text-slate-500 truncate mt-0.5">{tree.shortTitle}</p>}
                                        {tree.locationName && <p className="text-xs text-emerald-600 truncate mt-0.5">{tree.locationName}</p>}
                                    </div>
                                </a>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 flex-shrink-0">
                <a
                    href="https://lightseed.online"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-slate-400 hover:text-emerald-600 transition-colors"
                >
                    <Logo width={14} height={14} />
                    <span className="text-xs">lightseed.online</span>
                </a>
                <a
                    href="https://lightseed.online"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-full transition-colors font-medium"
                >
                    Plant a tree →
                </a>
            </div>
        </div>
    );
};
