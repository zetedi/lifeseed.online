
import React, { useState, useEffect } from 'react';
import { Vision } from '../types';
import { Icons } from './ui/Icons';
import { useLanguage } from '../contexts/LanguageContext';
import { joinVision, leaveVision } from '../services/firebase';

interface VisionDetailProps {
    vision: Vision;
    onClose: () => void;
    currentUserId?: string;
    onDelete?: (id: string) => void;
}

export const VisionDetail = ({ vision, onClose, currentUserId, onDelete }: VisionDetailProps) => {
    const { t } = useLanguage();
    
    const isAuthor = currentUserId === vision.authorId;
    const isRoot = vision.title.toLowerCase() === 'root vision';
    
    // Manage local joined state for immediate UI feedback
    const [isJoined, setIsJoined] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [participantCount, setParticipantCount] = useState(0);

    useEffect(() => {
        if (currentUserId && vision.joinedUserIds) {
            setIsJoined(vision.joinedUserIds.includes(currentUserId));
            setParticipantCount(vision.joinedUserIds.length);
        }
    }, [vision, currentUserId]);

    const handleJoinToggle = async () => {
        if (!currentUserId || isUpdating) return;
        setIsUpdating(true);
        
        try {
            if (isJoined) {
                await leaveVision(vision.id, currentUserId);
                setIsJoined(false);
                setParticipantCount(prev => Math.max(0, prev - 1));
            } else {
                await joinVision(vision.id, currentUserId);
                setIsJoined(true);
                setParticipantCount(prev => prev + 1);
            }
        } catch (e: any) {
            alert("Action failed: " + e.message);
        }
        setIsUpdating(false);
    }

    return (
        <div className="min-h-screen animate-in fade-in zoom-in-95 duration-300 pb-20">
             {/* Header */}
             <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-4 flex items-center justify-between">
                <button onClick={onClose} className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 font-medium">
                    <Icons.ArrowLeft />
                    <span>{t('back')}</span>
                </button>
                
                <div className="flex gap-2">
                    {currentUserId && !isAuthor && (
                        <button 
                            onClick={handleJoinToggle}
                            disabled={isUpdating}
                            className={`px-4 py-2 rounded-full font-bold text-xs shadow-sm transition-all border flex items-center gap-1 active:scale-95 ${isJoined ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600'}`}
                        >
                            <Icons.SparkleFill />
                            <span>{isJoined ? 'Joined' : 'Join Vision'}</span>
                        </button>
                    )}

                    {isAuthor && !isRoot && onDelete && (
                        <button 
                            onClick={() => onDelete(vision.id)}
                            className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-full font-bold text-xs shadow-sm transition-all border border-red-200 flex items-center gap-1 active:scale-95"
                        >
                            <Icons.Trash />
                            <span>Delete Vision</span>
                        </button>
                    )}
                </div>
                
                {isAuthor && isRoot && (
                    <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-[10px] font-bold border border-emerald-100 flex items-center gap-1">
                        <Icons.ShieldCheck />
                        <span>ROOT ANCHOR</span>
                    </div>
                )}
            </div>

            <div className="max-w-3xl mx-auto p-6 space-y-6">
                 <div className="relative h-96 w-full rounded-2xl overflow-hidden shadow-2xl bg-amber-50">
                     {vision.imageUrl ? (
                         <img src={vision.imageUrl} alt={vision.title} className="w-full h-full object-cover" />
                     ) : (
                         <div className="w-full h-full flex items-center justify-center text-amber-200">
                             <Icons.Sparkles />
                         </div>
                     )}
                     <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                     <div className="absolute bottom-6 left-6 right-6 text-white">
                         <h1 dir="auto" className="text-4xl md:text-5xl font-light tracking-tight mb-2">{vision.title}</h1>
                         <div className="flex items-center space-x-4 text-white/80 text-sm">
                             <span>Created by {vision.authorId.substring(0,6)}...</span>
                             {participantCount > 0 && (
                                <span className="flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full text-xs backdrop-blur-sm">
                                    <Icons.Globe /> {participantCount} joined
                                </span>
                             )}
                         </div>
                     </div>
                 </div>

                 <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-100">
                     <h2 className="text-sm font-bold text-amber-500 uppercase tracking-widest mb-4 flex items-center">
                         <Icons.FingerPrint /> 
                         <span className="ml-2">{t('vision')}</span>
                     </h2>
                     <p dir="auto" className="text-xl font-serif text-slate-700 leading-relaxed whitespace-pre-wrap">
                         {vision.body}
                     </p>
                     
                     {vision.link && (
                         <div className="mt-8 pt-6 border-t border-slate-100">
                             <a 
                                 href={vision.link} 
                                 target="_blank" 
                                 rel="noopener noreferrer" 
                                 className="inline-flex items-center space-x-2 text-amber-600 hover:text-amber-800 font-medium transition-colors"
                             >
                                 <Icons.Globe />
                                 <span>{vision.link}</span>
                             </a>
                         </div>
                     )}
                 </div>
            </div>
        </div>
    );
}
