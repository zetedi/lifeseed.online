
import React, { useState, useEffect } from 'react';
import { type Pulse, type Lifetree, type MatchProposal, type Vision, type VisionSynergy } from '../types';
import { getMyPulses, getMyVisions, getMyMatchesHistory } from '../services/firebase';
import { findVisionSynergies } from '../services/gemini';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './ui/Icons';
import { VisionCard } from './VisionCard';

export const LightseedProfile = ({ lightseed, myTrees, onViewTree, onDeleteTree, onViewVision, onPlant }: any) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'trees' | 'pulses' | 'visions' | 'history'>('trees');
    const [pulses, setPulses] = useState<Pulse[]>([]);
    const [visions, setVisions] = useState<Vision[]>([]);
    const [history, setHistory] = useState<MatchProposal[]>([]);
    const [loading, setLoading] = useState(false);
    
    // AI Matchmaking State
    const [synergies, setSynergies] = useState<VisionSynergy[]>([]);
    const [analyzing, setAnalyzing] = useState(false);

    // Check if any tree is validated to show source code
    const hasValidatedTree = myTrees.some((t: Lifetree) => t.validated);
    // Check if all trees are validated to allow planting new ones
    const allValidated = myTrees.length > 0 && myTrees.every((t: Lifetree) => t.validated);

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

    const handleMatchmaking = async () => {
        if (visions.length < 2) {
             const data = await getMyVisions(lightseed.uid);
             if (data.length < 2) {
                 alert("You need at least 2 visions to find synergies.");
                 return;
             }
             setVisions(data);
             // Proceed with fetched data
             performAnalysis(data);
        } else {
            performAnalysis(visions);
        }
    }

    const performAnalysis = async (vs: Vision[]) => {
        setAnalyzing(true);
        setSynergies([]);
        try {
            const results = await findVisionSynergies(vs);
            setSynergies(results);
        } catch (e: any) {
            alert("Analysis failed: " + e.message);
        }
        setAnalyzing(false);
    }

    if (!lightseed) return null;

    return (
        <div className="min-h-screen">
            <div className="relative bg-gradient-to-b from-slate-800 to-slate-900 text-white pb-10 pt-10 px-4">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
                    <div className="relative">
                        <img 
                            src={lightseed.photoURL || `https://ui-avatars.com/api/?name=${lightseed.displayName}`} 
                            className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white shadow-xl"
                        />
                        <div className="absolute bottom-1 right-1 bg-emerald-500 w-6 h-6 rounded-full border-4 border-slate-900"></div>
                    </div>
                    <div className="text-center md:text-left flex-1">
                        <h1 className="text-3xl font-light tracking-wide">{lightseed.displayName}</h1>
                        <p className="text-slate-400 text-sm font-mono mt-1">{lightseed.email}</p>
                        
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 mt-6">
                            <div className="text-center">
                                <span className="block text-2xl font-bold">{myTrees.length}</span>
                                <span className="text-xs text-slate-400 uppercase tracking-wider">{t('my_trees')}</span>
                            </div>
                            
                            {/* Create Tree Button for Validated Users */}
                            {allValidated && (
                                <button onClick={onPlant} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg transition-transform active:scale-95 flex items-center space-x-2">
                                    <Icons.Tree />
                                    <span>Create Tree</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Validation Banner moved inside dark header for better visibility and contrast */}
                {hasValidatedTree && (
                    <div className="max-w-4xl mx-auto mt-8 bg-slate-700/50 backdrop-blur border border-slate-600 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center space-x-3">
                            <div className="bg-emerald-500 p-2 rounded-full shrink-0">
                                <Icons.ShieldCheck />
                            </div>
                            <div className="text-center sm:text-left">
                                <h4 className="font-bold text-emerald-400">Contributor Access Unlocked</h4>
                                <p className="text-xs text-slate-300">You are a validated node in the .seed network.</p>
                            </div>
                        </div>
                        <a 
                            href="https://github.com/zetedi/lifeseed.online" 
                            target="_blank" 
                            rel="noreferrer" 
                            className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm font-mono transition-colors border border-white/10 flex items-center space-x-2 whitespace-nowrap"
                        >
                            <span>zetedi/lifeseed.online</span>
                            <Icons.Link />
                        </a>
                    </div>
                )}
            </div>

            <div className="max-w-4xl mx-auto px-4 mt-8">
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
                                {allValidated && (
                                     <div onClick={onPlant} className="border-2 border-dashed border-slate-300 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-slate-50 min-h-[100px] text-slate-400 hover:text-emerald-600 transition-all group">
                                        <div className="bg-slate-100 p-3 rounded-full group-hover:bg-emerald-100 transition-colors">
                                             <Icons.Tree />
                                        </div>
                                        <span className="font-bold mt-2 text-sm">Plant New Tree</span>
                                        <span className="text-[10px] text-slate-400">Expand your network</span>
                                    </div>
                                )}

                                {myTrees.length === 0 ? (
                                    !allValidated && <p className="text-slate-400 text-center py-10 col-span-full">No trees planted yet.</p>
                                ) : (
                                    myTrees.map((tree: Lifetree) => (
                                        <div key={tree.id} onClick={() => onViewTree(tree)} className="border border-slate-200 rounded-lg p-4 hover:shadow-md cursor-pointer transition-all flex items-center justify-between group bg-white">
                                            <div className="flex items-center space-x-4">
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
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onDeleteTree(tree.id); }} 
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                                title="Delete Tree"
                                            >
                                                <Icons.Trash />
                                            </button>
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
                                <div>
                                    <div className="flex justify-between items-center mb-6">
                                         <h3 className="text-lg font-bold">My Visions</h3>
                                         <button 
                                            onClick={handleMatchmaking}
                                            disabled={analyzing}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center space-x-2 transition-colors disabled:opacity-50"
                                         >
                                             {analyzing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Icons.Sparkles />}
                                             <span>AI Matchmaking</span>
                                         </button>
                                    </div>
                                    
                                    {synergies.length > 0 && (
                                        <div className="mb-8 bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                                            <h4 className="font-bold text-indigo-900 mb-3 flex items-center"><Icons.SparkleFill /> <span className="ml-2">Synergy Report</span></h4>
                                            <div className="space-y-3">
                                                {synergies.map((s, i) => (
                                                    <div key={i} className="bg-white p-3 rounded-lg shadow-sm border border-indigo-100/50">
                                                        <div className="flex justify-between items-start">
                                                            <div className="font-medium text-slate-800 text-sm">
                                                                <span className="text-indigo-600">{s.vision1Title}</span> + <span className="text-indigo-600">{s.vision2Title}</span>
                                                            </div>
                                                            <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-bold">{s.score}%</span>
                                                        </div>
                                                        <p className="text-xs text-slate-600 mt-2 leading-relaxed">{s.reasoning}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {visions.length === 0 ? <p className="col-span-full text-slate-400 text-center py-10">No visions created yet.</p> : visions.map((vision) => (
                                            <div key={vision.id} onClick={() => onViewVision(vision)} className="cursor-pointer">
                                                <VisionCard vision={vision} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                             )
                        )}
                        {activeTab === 'history' && (
                             loading ? <p className="text-center py-10 text-slate-400">Loading...</p> : (
                                <div className="space-y-4">
                                    {history.length === 0 ? <p className="text-slate-400 text-center py-10">No history yet.</p> : history.map((h) => (
                                        <div key={h.id} className="border border-slate-200 p-4 rounded-lg bg-slate-50 flex justify-between items-center">
                                            <div>
                                                <p className="font-bold text-sm text-slate-700">{h.status}</p>
                                                <p className="text-xs text-slate-500">{new Date(h.createdAt?.toMillis()).toLocaleDateString()}</p>
                                            </div>
                                            <div className="text-xs font-mono text-slate-400">{h.id.substring(0,8)}...</div>
                                        </div>
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
