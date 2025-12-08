
import React, { useRef, useState, ChangeEvent } from 'react';
import { Lifetree } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './Icons';
import Logo from './Logo';

interface LifetreeCardProps {
    tree: Lifetree;
    myActiveTree: Lifetree | null;
    onValidate: (id: string) => void;
    onPlayGrowth: (id: string) => void;
    onQuickSnap: (id: string, file: File) => Promise<void>;
    onView: (tree: Lifetree) => void;
}

export const LifetreeCard: React.FC<LifetreeCardProps> = ({ tree, myActiveTree, onValidate, onPlayGrowth, onQuickSnap, onView }) => {
    const { t } = useLanguage();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setUploading(true);
            await onQuickSnap(tree.id, e.target.files[0]);
            setUploading(false);
            if(fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    const triggerUpload = (e: React.MouseEvent) => {
        e.stopPropagation();
        fileInputRef.current?.click();
    }
    
    return (
        <div 
            onClick={() => onView(tree)}
            className={`bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200 hover:shadow-lg transition-all duration-300 group relative cursor-pointer ${tree.validated ? 'ring-1 ring-emerald-100' : ''}`}
        >
             <div className="absolute top-2 right-2 z-20 flex space-x-2">
                {tree.validated && (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center shadow-sm">
                        <Icons.ShieldCheck />
                        <span className="ml-1 text-[9px]">{t('validated')}</span>
                    </span>
                )}
            </div>

             {myActiveTree && myActiveTree.id === tree.id && (
                 <div className="absolute top-2 left-2 z-20">
                     <button 
                        onClick={triggerUpload} 
                        disabled={uploading}
                        className="flex items-center space-x-1.5 bg-white/95 text-slate-800 px-2.5 py-1 rounded-full shadow-md hover:bg-white hover:text-emerald-700 transition-all active:scale-95"
                    >
                        {uploading ? <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div> : <Icons.Camera />}
                        <span className="text-[10px] font-bold uppercase tracking-wider">{t('quick_snap')}</span>
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        capture="environment" 
                        onChange={handleFileChange} 
                        onClick={(e) => e.stopPropagation()}
                    />
                 </div>
            )}

            <div className="relative h-36 bg-slate-200 overflow-hidden group">
                {tree.imageUrl ? (
                    <img src={tree.imageUrl} alt={tree.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[3s] animate-[pulse_4s_ease-in-out_infinite]" />
                ) : (
                    <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                        <Logo width={50} height={50} className="opacity-20 text-white animate-pulse" />
                    </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent pointer-events-none"></div>
                <div className="absolute bottom-2 left-3 right-3 text-white pointer-events-none">
                    <h3 className="text-lg font-light tracking-wide truncate">{tree.name}</h3>
                    <div className="flex items-center text-xs text-slate-300 mt-0.5 space-x-2 rtl:space-x-reverse">
                         <span className="px-1.5 py-0 border border-slate-500 rounded-full text-[9px] bg-slate-800/50 backdrop-blur">
                            Block: {tree.blockHeight || 0}
                        </span>
                    </div>
                </div>
            </div>
            <div className="p-3">
                <p className="text-slate-600 text-xs font-light italic leading-relaxed line-clamp-2 h-8">
                    "{tree.body}"
                </p>
                <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center">
                    <button onClick={(e) => { e.stopPropagation(); onPlayGrowth(tree.id); }} className="flex items-center space-x-1 text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-500 px-2 py-1 rounded transition-colors uppercase tracking-wider font-semibold">
                        <Icons.Play />
                        <span>Growth</span>
                    </button>
                    
                    <div className="flex space-x-2">
                        {myActiveTree && myActiveTree.validated && !tree.validated && myActiveTree.id !== tree.id && (
                            <button onClick={(e) => { e.stopPropagation(); onValidate(tree.id); }} className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded hover:bg-emerald-100 transition-colors uppercase font-bold">
                                {t('validate_action')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
