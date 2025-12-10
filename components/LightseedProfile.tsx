
import React, { useState, useEffect } from 'react';
import { type Pulse, type Lifetree, type MatchProposal, type Vision } from '../types';
import { getMyPulses, getMyVisions, getMyMatchesHistory } from '../services/firebase';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './ui/Icons';
import { VisionCard } from './VisionCard';

export const LightseedProfile = ({ lightseed, myTrees, onViewTree }: any) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'trees' | 'pulses' | 'visions' | 'history'>('trees');
    const [pulses, setPulses] = useState<Pulse[]>([]);
    const [visions, setVisions] = useState<Vision[]>([]);
    const [history, setHistory] = useState<MatchProposal[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!lightseed) return;
        setLoading(true);
        const fetchData = async () => {
            if (activeTab === 'pulses') {
                const data = await getMyPulses(lightseed.uid);
                setPulses(data);
            } else if (activeTab === 'visions') {
                const data = await getMyVisions(lightseed.uid);
                setVisions(data);
            } else if (activeTab === 'history') {
                const data = await getMyMatchesHistory(lightseed.uid);
                setHistory(data);
            }
            setLoading(false);
        };
        fetchData();
    }, [activeTab, lightseed]);

    if (!lightseed) return null;

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="relative bg-gradient-to-b from-slate-800 to-slate-900 text-white pb-20 pt-10 px-4">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
                    <div className="relative">
                        <img 
                            src={lightseed.photoURL || `https://ui-avatars.com/api/?name=${lightseed.displayName}`} 
                            className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white shadow-xl"
                        />
                        <div className="absolute bottom-1 right-1 bg-emerald-500 w-6 h-6 rounded-full border-4 border-slate-900"></div>
                    </div>
                    <div className="text-center md:text-left">
                        <h1 className="text-3xl font-light tracking-wide">{lightseed.displayName}</h1>
                        <p className="text-slate-400 text-sm font-mono mt-1">{lightseed.email}</p>
                        <div className="flex items-center justify-center md:justify-start space-x-6 mt-6">
                            <div className="text-center">
                                <span className="block text-2xl font-bold">{myTrees.length}</span>
                                <span className="text-xs text-slate-400 uppercase tracking-wider">{t('my_trees')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 -mt-12">
                <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden min-h-[500px]">
                    <div className="flex border-b border-slate-100 overflow-x-auto">
                        <button 
                            onClick={() => setActiveTab('trees')} 
                            className={`flex-1 min-w-[100px] py-4 text-sm font-medium transition-colors ${activeTab === 'trees' ? 'text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50/50' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            {t('my_trees')}
                        </button>
                        <button 
                            onClick={() => setActiveTab('pulses')} 
                            className={`flex-1 min-w-[100px] py-4 text-sm font-medium transition-colors ${activeTab === 'pulses' ? 'text-sky-600 border-b-2 border-sky-500 bg-sky-50/50' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            {t('my_pulses')}
                        </button>
                        <button 
                            onClick={() => setActiveTab('visions')} 
                            className={`flex-1 min-w-[100px] py-4 text-sm font-medium transition-colors ${activeTab === 'visions' ? 'text-amber-600 border-b-2 border-amber-500 bg-amber-50/50' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            {t('visions')}
                        </button>
                        <button 
                            onClick={() => setActiveTab('history')} 
                            className={`flex-1 min-w-[100px] py-4 text-sm font-medium transition-colors ${activeTab === 'history' ? 'text-slate-600 border-b-2 border-slate-500 bg-slate-50/50' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            {t('my_matches')}
                        </button>
                    </div>

                    <div className="p-6">
                        {activeTab === 'trees' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {myTrees.length === 0 ? (
                                    <p className="text-slate-400 text-center py-10">No trees planted yet.</p>
                                ) : (
                                    myTrees.map((tree: Lifetree) => (
                                        <div key={tree.id} onClick={() => onViewTree(tree)} className="border border-slate-200 rounded-lg p-4 hover:shadow-md cursor-pointer transition-all flex items-center space-x-4">
                                            <img src={tree.imageUrl || 'https://via.placeholder.com/100'} className="w-16 h-16 rounded object-cover bg-slate-100" />
                                            <div>
                                                <h3 className="font-bold text-slate-800">{tree.name}</h3>
                                                <p className="text-xs text-slate-500">Block Height: {tree.blockHeight}</p>
                                                {tree.validated ? (
                                                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">VALIDATED</span>
                                                ) : (
                                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Pending</span>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                        {activeTab === 'pulses' && (
                            loading ? <p className="text-center py-10 text-slate-400">Loading...</p> : (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {pulses.length === 0 ? <p className="col-span-full text-slate-400 text-center py-10">No pulses emitted yet.</p> : pulses.map((pulse) => (
                                        <div key={pulse.id} className="border border-slate-100 rounded-lg overflow-hidden group">
                                            <div className="h-24 bg-slate-100 relative">
                                                {pulse.imageUrl ? (
                                                    <img src={pulse.imageUrl} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-300"><Icons.Hash /></div>
                                                )}
                                            </div>
                                            <div className="p-3">
                                                <h4 className="font-bold text-sm text-slate-800 line-clamp-1">{pulse.title}</h4>
                                                <div className="mt-1 flex items-center space-x-3 text-[10px] text-slate-400">
                                                    <span>{pulse.loveCount} Loves</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}
                         {activeTab === 'visions' && (
                             loading ? <p className="text-center py-10 text-slate-400">Loading...</p> : (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {visions.length === 0 ? <p className="col-span-full text-slate-400 text-center py-10">No visions created yet.</p> : visions.map((vision) => (
                                        <VisionCard key={vision.id} vision={vision} />
                                    ))}
                                </div>
                             )
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
