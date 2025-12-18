
import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './ui/Icons';
import Logo from './Logo';
import { updateLifetree, toggleGuardianship, setTreeStatus } from '../services/firebase';

export const LifetreeDetail = ({ tree, onClose, onPlayGrowth, onValidate, onUpdate, myActiveTree, currentUserId }: any) => {
   const { t } = useLanguage();
   const isOwner = currentUserId === tree.ownerId;
   const isNature = tree.isNature;
   const isGuardian = tree.guardians && currentUserId && tree.guardians.includes(currentUserId);
   
   const [isEditing, setIsEditing] = useState(false);
   const [editName, setEditName] = useState(tree.name);
   const [editShortTitle, setEditShortTitle] = useState(tree.shortTitle || '');
   const [editBody, setEditBody] = useState(tree.body);
   const [editLat, setEditLat] = useState(tree.latitude || 0);
   const [editLng, setEditLng] = useState(tree.longitude || 0);
   const [isSaving, setIsSaving] = useState(false);
   
   // Local state for immediate UI feedback on actions
   const [localIsGuardian, setLocalIsGuardian] = useState(isGuardian);
   const [localStatus, setLocalStatus] = useState(tree.status || 'HEALTHY');

   const handleSave = async () => {
       setIsSaving(true);
       try {
           const updates = {
               name: editName,
               shortTitle: editShortTitle,
               body: editBody,
               latitude: Number(editLat),
               longitude: Number(editLng)
           };
           await updateLifetree(tree.id, updates);
           if (onUpdate) onUpdate(updates);
           setIsEditing(false);
       } catch (e) {
           console.error(e);
           alert("Failed to save changes.");
       }
       setIsSaving(false);
   };

   const handleToggleGuardian = async () => {
       if (!currentUserId) return;
       setIsSaving(true);
       try {
           const isJoining = !localIsGuardian;
           await toggleGuardianship(tree.id, currentUserId, isJoining);
           setLocalIsGuardian(isJoining);
           
           if (onUpdate) {
               const currentGuardians = tree.guardians || [];
               const newGuardians = isJoining 
                   ? [...currentGuardians, currentUserId]
                   : currentGuardians.filter((id: string) => id !== currentUserId);
               onUpdate({ guardians: newGuardians });
           }
       } catch(e: any) { alert(e.message); }
       setIsSaving(false);
   }

   const handleToggleDanger = async () => {
       if (!localIsGuardian) return;
       const newStatus = localStatus === 'DANGER' ? 'HEALTHY' : 'DANGER';
       if (newStatus === 'DANGER' && !confirm("Are you sure you want to report this tree is in DANGER? This will alert all guardians.")) return;
       
       setIsSaving(true);
       try {
           await setTreeStatus(tree.id, newStatus);
           setLocalStatus(newStatus);
           if (onUpdate) onUpdate({ status: newStatus });
       } catch(e: any) { alert(e.message); }
       setIsSaving(false);
   }

   const GuardianshipPanel = () => (
        <div className={`bg-sky-50 text-sky-900 p-6 rounded-2xl shadow-inner border border-sky-100 overflow-hidden relative ${!isNature ? 'mt-6' : ''}`}>
            <h3 className="text-sky-600 font-bold uppercase tracking-wider mb-4 flex items-center">
                <Icons.Shield />
                <span className="ml-2">Guardians</span>
            </h3>
            <p className="text-sm mb-6 text-sky-800/80">
                This tree is protected by the community. Join the guardians to monitor its health and add memories.
            </p>
            
            <div className="space-y-3">
                {currentUserId ? (
                    <button 
                        onClick={handleToggleGuardian}
                        disabled={isSaving}
                        className={`w-full py-3 rounded-xl font-bold uppercase tracking-widest shadow-lg transition-all active:scale-95 ${localIsGuardian ? 'bg-slate-200 text-slate-600 hover:bg-slate-300' : 'bg-sky-600 text-white hover:bg-sky-700'}`}
                    >
                        {localIsGuardian ? "Leave Guardianship" : "Join Guardianship"}
                    </button>
                ) : (
                    <p className="text-xs text-center italic">Sign in to become a guardian.</p>
                )}

                {localIsGuardian && (
                    <button 
                        onClick={handleToggleDanger}
                        disabled={isSaving}
                        className={`w-full py-3 rounded-xl font-bold uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center space-x-2 ${localStatus === 'DANGER' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-red-500 text-white hover:bg-red-600'}`}
                    >
                        {localStatus === 'DANGER' ? (
                            <><span>RESOLVE DANGER</span></>
                        ) : (
                            <><Icons.Siren /><span>REPORT DANGER</span></>
                        )}
                    </button>
                )}
            </div>
            <div className="mt-4 pt-4 border-t border-sky-200 text-xs text-sky-600 font-mono">
                Guardians: {tree.guardians ? tree.guardians.length + (localIsGuardian && !tree.guardians.includes(currentUserId) ? 1 : 0) - (!localIsGuardian && tree.guardians.includes(currentUserId) ? 1 : 0) : (localIsGuardian ? 1 : 0)}
            </div>
        </div>
   );
    
    return (
        <div className="min-h-screen animate-in fade-in zoom-in-95 duration-300">
            {/* Danger Banner */}
            {localStatus === 'DANGER' && (
                <div className="bg-red-600 text-white text-center py-2 font-bold animate-pulse sticky top-0 z-40">
                    <div className="flex items-center justify-center space-x-2">
                        <Icons.Siren />
                        <span>ALERT: THIS TREE IS IN DANGER</span>
                        <Icons.Siren />
                    </div>
                </div>
            )}

            {/* Header */}
            <div className={`sticky ${localStatus === 'DANGER' ? 'top-10' : 'top-0'} z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-4 flex items-center justify-between`}>
                <button onClick={onClose} className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 font-medium">
                    <Icons.ArrowLeft />
                    <span>{t('back_forest')}</span>
                </button>
                <div className="flex flex-col items-center">
                    <h2 dir="auto" className="text-xl font-light tracking-wide truncate max-w-[200px]">{isEditing ? "Editing..." : tree.name}</h2>
                    {tree.shortTitle && !isEditing && <span dir="auto" className="text-xs text-slate-400 font-bold uppercase tracking-widest">{tree.shortTitle}</span>}
                </div>
                <div className="min-w-[80px] flex justify-end">
                    {/* EDIT Button: Allowed for Owner OR Guardian */}
                    {((isOwner && !isNature) || isGuardian) && !isEditing && (
                        <button onClick={() => setIsEditing(true)} className="bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 px-4 py-2 rounded-full font-bold text-sm shadow-sm transition-colors flex items-center gap-1 border border-slate-200">
                            <Icons.Sparkles /> 
                            <span>{t('edit')}</span>
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
                            {isNature ? (
                                <span className="bg-sky-500 text-white text-xs px-2 py-0.5 rounded-full font-bold flex items-center">
                                    <Icons.Shield />
                                    <span className="ml-1">NATURE</span>
                                </span>
                            ) : tree.validated && (
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
                            <div className="space-y-2 max-w-md">
                                <input 
                                    dir="auto"
                                    className="text-3xl md:text-4xl font-thin tracking-tight bg-black/40 border-b border-white/50 text-white w-full focus:outline-none p-1"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    placeholder="Tree Name"
                                />
                                <input 
                                    dir="auto"
                                    className="text-sm font-bold tracking-widest uppercase bg-black/40 border-b border-white/50 text-white w-full focus:outline-none p-1"
                                    value={editShortTitle}
                                    onChange={(e) => setEditShortTitle(e.target.value)}
                                    placeholder="SHORT TITLE"
                                />
                            </div>
                        ) : (
                            <>
                                <h1 dir="auto" className="text-4xl md:text-5xl font-thin tracking-tight">{tree.name}</h1>
                                {tree.shortTitle && <p dir="auto" className="text-emerald-300 font-bold tracking-widest text-sm uppercase mt-1">{tree.shortTitle}</p>}
                            </>
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
                            {isEditing ? (
                                <textarea 
                                    dir="auto"
                                    className="w-full h-40 border border-slate-300 rounded p-2 text-lg font-serif italic text-slate-700 leading-relaxed focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={editBody}
                                    onChange={(e) => setEditBody(e.target.value)}
                                />
                            ) : (
                                <p dir="auto" className="text-lg font-serif italic text-slate-700 leading-relaxed">
                                    "{tree.body}"
                                </p>
                            )}
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">{t('tree_details')}</h3>
                            
                            <div className="flex justify-between py-2 border-b border-slate-50">
                                <span className="text-slate-500 text-sm">{t('steward')}</span>
                                <span dir="ltr" className="text-slate-800 font-mono text-sm">{isNature ? "Nature (System)" : tree.ownerId.substring(0, 10) + "..."}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-slate-50">
                                <span className="text-slate-500 text-sm">{t('location')}</span>
                                <span dir="auto" className="text-slate-800 font-mono text-sm">{tree.locationName}</span>
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
                                <span className="text-slate-800 font-mono text-sm">{tree.validatorId ? (tree.validatorId === 'GENESIS' || tree.validatorId === 'SYSTEM' ? 'Nature' : tree.validatorId.substring(0, 8) + '...') : t('unvalidated')}</span>
                            </div>

                            {isEditing && (
                                <div className="flex space-x-2 mt-4 pt-4 border-t border-slate-100">
                                    <button onClick={handleSave} disabled={isSaving} className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-emerald-700">
                                        {isSaving ? "Saving..." : "Save Changes"}
                                    </button>
                                    <button onClick={() => { setIsEditing(false); setEditName(tree.name); setEditShortTitle(tree.shortTitle || ''); setEditBody(tree.body); setEditLat(tree.latitude); setEditLng(tree.longitude); }} disabled={isSaving} className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg text-sm font-bold hover:bg-slate-300">
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Blockchain & Guard Panel */}
                    <div className="space-y-6">
                        {isNature ? (
                            <GuardianshipPanel />
                        ) : (
                            <>
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
                                            <p className="text-emerald-500/80" dir="ltr">{tree.genesisHash}</p>
                                        </div>
                                        <div className="break-all">
                                            <p className="text-slate-500 mb-1 uppercase text-[10px]">{t('latest_hash')}</p>
                                            <p className="text-emerald-300" dir="ltr">{tree.latestHash}</p>
                                        </div>
                                    </div>
                                </div>
                                <GuardianshipPanel />
                            </>
                        )}

                        {/* Validation Action */}
                        {myActiveTree && myActiveTree.validated && !tree.validated && myActiveTree.id !== tree.id && !isNature && (
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
