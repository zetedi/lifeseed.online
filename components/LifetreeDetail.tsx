
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './ui/Icons';
import Logo from './Logo';

export const LifetreeDetail = ({ tree, onClose, onPlayGrowth, onValidate, myActiveTree }: any) => {
   const { t } = useLanguage();
    
    return (
        <div className="min-h-screen bg-slate-50 animate-in fade-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-4 flex items-center justify-between">
                <button onClick={onClose} className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 font-medium">
                    <Icons.ArrowLeft />
                    <span>{t('back_forest')}</span>
                </button>
                <h2 className="text-xl font-light tracking-wide">{tree.name}</h2>
                <div className="w-8"></div> {/* Spacer for center alignment */}
            </div>

            <div className="max-w-4xl mx-auto p-6 space-y-8">
                {/* Hero */}
                <div className="relative h-64 md:h-96 w-full rounded-2xl overflow-hidden shadow-xl">
                    <img 
                        src={tree.imageUrl || 'https://via.placeholder.com/800x400'} 
                        className="w-full h-full object-cover" 
                        alt={tree.name}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    <div className="absolute bottom-6 left-6 text-white">
                        <div className="flex items-center space-x-3 mb-2">
                            {tree.validated && (
                                <span className="bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full font-bold flex items-center">
                                    <Icons.ShieldCheck />
                                    <span className="ml-1">{t('validated')}</span>
                                </span>
                            )}
                            <button onClick={() => onPlayGrowth(tree.id)} className="bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1 rounded-full flex items-center space-x-1 backdrop-blur-sm transition-colors">
                                <Icons.Play />
                                <span>PLAY GROWTH</span>
                            </button>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-thin tracking-tight">{tree.name}</h1>
                    </div>
                </div>

                {/* Info Grid */}
                <div className="grid md:grid-cols-2 gap-8">
                    
                    {/* Left: Bio & Meta */}
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center">
                                <Icons.FingerPrint />
                                <span className="ml-2">{t('vision')}</span>
                            </h3>
                            <p className="text-lg font-serif italic text-slate-700 leading-relaxed">
                                "{tree.body}"
                            </p>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">{t('tree_details')}</h3>
                            
                            <div className="flex justify-between py-2 border-b border-slate-50">
                                <span className="text-slate-500 text-sm">{t('steward')}</span>
                                <span className="text-slate-800 font-mono text-sm">{tree.ownerId.substring(0, 10)}...</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-slate-50">
                                <span className="text-slate-500 text-sm">{t('location')}</span>
                                <span className="text-slate-800 font-mono text-sm">{tree.locationName}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-slate-50">
                                <span className="text-slate-500 text-sm">Lat / Lng</span>
                                <span className="text-slate-800 font-mono text-sm">{tree.latitude?.toFixed(4)}, {tree.longitude?.toFixed(4)}</span>
                            </div>
                             <div className="flex justify-between py-2">
                                <span className="text-slate-500 text-sm">Validator</span>
                                <span className="text-slate-800 font-mono text-sm">{tree.validatorId ? tree.validatorId.substring(0, 8) + '...' : t('unvalidated')}</span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Blockchain */}
                    <div className="space-y-6">
                         <div className="bg-slate-900 text-slate-300 p-6 rounded-2xl shadow-inner font-mono text-xs overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Logo width={100} height={100} />
                            </div>
                            <h3 className="text-emerald-400 font-bold uppercase tracking-wider mb-6 flex items-center">
                                <Icons.Hash />
                                <span className="ml-2">Blockchain Ledger</span>
                            </h3>

                            <div className="space-y-4 relative z-10">
                                <div>
                                    <p className="text-slate-500 mb-1 uppercase text-[10px]">Block Height</p>
                                    <p className="text-2xl text-white">{tree.blockHeight}</p>
                                </div>
                                <div className="break-all">
                                    <p className="text-slate-500 mb-1 uppercase text-[10px]">{t('genesis')}</p>
                                    <p className="text-emerald-500/80">{tree.genesisHash}</p>
                                </div>
                                <div className="break-all">
                                    <p className="text-slate-500 mb-1 uppercase text-[10px]">{t('latest_hash')}</p>
                                    <p className="text-emerald-300">{tree.latestHash}</p>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        {myActiveTree && myActiveTree.validated && !tree.validated && myActiveTree.id !== tree.id && (
                             <button onClick={() => onValidate(tree.id)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold uppercase tracking-widest shadow-lg shadow-emerald-200 transition-all active:scale-95">
                                {t('validate_action')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
};
