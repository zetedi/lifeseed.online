
import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './ui/Icons';
import Logo from './Logo';
import { updateLifetree } from '../services/firebase';

export const LifetreeDetail = ({ tree, onClose, onPlayGrowth, onValidate, myActiveTree, currentUserId }: any) => {
   const { t } = useLanguage();
   const isOwner = currentUserId === tree.ownerId;
   
   const [isEditing, setIsEditing] = useState(false);
   const [editName, setEditName] = useState(tree.name);
   const [editLat, setEditLat] = useState(tree.latitude || 0);
   const [editLng, setEditLng] = useState(tree.longitude || 0);
   const [isSaving, setIsSaving] = useState(false);

   const handleSave = async () => {
       setIsSaving(true);
       try {
           await updateLifetree(tree.id, {
               name: editName,
               latitude: Number(editLat),
               longitude: Number(editLng)
           });
           setIsEditing(false);
           // Simple visual feedback; real data will update via parent fetch or listeners in a real app, 
           // but here we just rely on parent reload or optimistic UI if we had it.
           // For this structure, we close edit mode. The parent might need a refresh trigger 
           // but since we don't have a callback for that here easily without prop drilling, 
           // we assume the user will see changes next time or we alert.
           // Ideally, we'd call a refresh function passed from parent.
           // For now, let's just close.
       } catch (e) {
           console.error(e);
           alert("Failed to save changes.");
       }
       setIsSaving(false);
   };
    
    return (
        <div className="min-h-screen animate-in fade-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-4 flex items-center justify-between">
                <button onClick={onClose} className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 font-medium">
                    <Icons.ArrowLeft />
                    <span>{t('back_forest')}</span>
                </button>
                <h2 className="text-xl font-light tracking-wide truncate max-w-[200px]">{isEditing ? "Editing Tree" : tree.name}</h2>
                <div className="w-8">
                    {isOwner && !isEditing && (
                        <button onClick={() => setIsEditing(true)} className="text-sm text-slate-500 hover:text-emerald-600 underline">
                            Edit
                        </button>
                    )}
                </div> 
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
                    <div className="absolute bottom-6 left-6 text-white w-full pr-12">
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
                        {isEditing ? (
                            <input 
                                className="text-3xl md:text-4xl font-thin tracking-tight bg-black/30 border-b border-white/50 text-white w-full focus:outline-none p-1"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                            />
                        ) : (
                            <h1 className="text-4xl md:text-5xl font-thin tracking-tight">{tree.name}</h1>
                        )}
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
                            <div className="py-2 border-b border-slate-50">
                                <span className="text-slate-500 text-sm block mb-1">GPS Coordinates</span>
                                {isEditing ? (
                                    <div className="flex space-x-2">
                                        <input 
                                            type="number" step="any"
                                            className="border p-1 rounded w-1/2 text-sm" 
                                            value={editLat} 
                                            onChange={e => setEditLat(e.target.value)}
                                            placeholder="Lat"
                                        />
                                        <input 
                                            type="number" step="any"
                                            className="border p-1 rounded w-1/2 text-sm" 
                                            value={editLng} 
                                            onChange={e => setEditLng(e.target.value)}
                                            placeholder="Lng"
                                        />
                                    </div>
                                ) : (
                                    <span className="text-slate-800 font-mono text-sm">{tree.latitude?.toFixed(4)}, {tree.longitude?.toFixed(4)}</span>
                                )}
                            </div>
                             <div className="flex justify-between py-2">
                                <span className="text-slate-500 text-sm">Validator</span>
                                <span className="text-slate-800 font-mono text-sm">{tree.validatorId ? tree.validatorId.substring(0, 8) + '...' : t('unvalidated')}</span>
                            </div>

                            {isEditing && (
                                <div className="flex space-x-2 mt-4 pt-4 border-t border-slate-100">
                                    <button onClick={handleSave} disabled={isSaving} className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-emerald-700">
                                        {isSaving ? "Saving..." : "Save Changes"}
                                    </button>
                                    <button onClick={() => { setIsEditing(false); setEditName(tree.name); setEditLat(tree.latitude); setEditLng(tree.longitude); }} disabled={isSaving} className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg text-sm font-bold hover:bg-slate-300">
                                        Cancel
                                    </button>
                                </div>
                            )}
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
