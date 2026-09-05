
import React, { useRef, useState, ChangeEvent } from 'react';
import { showConfirm } from "./ui/Dialog";
import { type Lifetree } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './ui/Icons';
import { ValidationBadge } from './ValidationBadge';
import { canToggleValidation, isExplicitlyValidatedTree } from '../utils/validation';
import { canReachTree, type ReachTargetProfile } from '../utils/reachPermissions';
import { isWateringOverdue } from '../domain/watering';
import { tabTone } from '../utils/tabTheme';
import { ImageCropModal } from './ui/ImageCropModal';

import { Picture } from './ui/Picture';
interface LifetreeCardProps {
    tree: Lifetree;
    myActiveTree: Lifetree | null;
    isAdmin?: boolean;
    isSuperAdmin?: boolean;
    isInitiate?: boolean;
    currentUserId?: string;
    guardedTreeIds?: Set<string>;
    targetUserProfile?: ReachTargetProfile | null;
    onValidate: (id: string, nextValidated: boolean) => Promise<void>;
    onPlayGrowth: (id: string) => void;
    onQuickSnap: (id: string, file: File) => Promise<void>;
    onView: (tree: Lifetree) => void;
    onReach?: (tree: Lifetree) => void;
    onAlertGuardians?: (tree: Lifetree) => void;
}

export const LifetreeCard = ({ tree, myActiveTree, isAdmin, isSuperAdmin, isInitiate, currentUserId, guardedTreeIds, targetUserProfile, onValidate, onPlayGrowth, onQuickSnap, onView, onReach, onAlertGuardians }: LifetreeCardProps) => {
    const { t } = useLanguage();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    // A snapped/selected photo waiting to be cropped before it becomes a growth pulse.
    const [pendingSnap, setPendingSnap] = useState<File | null>(null);

    // Guardianship comes from the LIN (guardian links), passed down as a set.
    const isGuardian = !!currentUserId && !!guardedTreeIds?.has(tree.id);
    // Thirsty: any tree on a watering schedule that's past its due-date.
    const needsWater = isWateringOverdue(tree);
    const hasValidationBadge = isExplicitlyValidatedTree(tree);
    const showValidateAction = canToggleValidation({ tree, myActiveTree, isAdmin, isSuperAdmin, isInitiate });
    // The owner's privacy flag is mirrored onto the (world-readable) tree, so we can read it here.
    const targetProfile = targetUserProfile ?? { onlyValidatedCanReach: tree.onlyValidatedCanReach };
    const canReach = canReachTree({ targetTree: tree, targetUserProfile: targetProfile, myActiveTree, currentUserId, isAdmin, isSuperAdmin });

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setPendingSnap(e.target.files[0]); // crop first, then snap
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleCropped = async (file: File) => {
        setPendingSnap(null);
        setUploading(true);
        await onQuickSnap(tree.id, file);
        setUploading(false);
    };

    const triggerUpload = (e: React.MouseEvent) => {
        e.stopPropagation();
        fileInputRef.current?.click();
    }
    
    return (
        <div 
            onClick={() => onView(tree)}
            className={`bg-white rounded-lg overflow-hidden shadow-sm border border-slate-200 hover:shadow-xl hover:-translate-y-1 active:shadow-xl active:-translate-y-1 transition-all duration-300 group relative cursor-pointer ${tree.isNature ? 'ring-1 ring-sky-100' : (hasValidationBadge ? 'ring-1 ring-emerald-100' : '')}`}
        >
             <div className="absolute top-2 right-2 z-20 flex flex-col items-end gap-1">
                {tree.isNature ? (
                    <span className="bg-sky-100 text-sky-800 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center shadow-sm">
                        <Icons.Shield />
                        <span className="ml-1 text-[9px]">NATURE</span>
                    </span>
                ) : null}
                {isGuardian && (
                    <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center shadow-sm w-fit">
                        <Icons.Shield />
                        <span className="ml-1 text-[9px]">Guardian</span>
                    </span>
                )}
            </div>

            {/* Quick Snap - For Owner OR Guardian */}
             {(myActiveTree && myActiveTree.id === tree.id) || isGuardian ? (
                 <div className="absolute top-2 left-2 z-20">
                     <button 
                        onClick={triggerUpload} 
                        disabled={uploading}
                        className="flex items-center gap-1.5 bg-white/95 text-slate-800 px-2.5 py-1 rounded-full shadow-md hover:bg-white hover:text-emerald-700 transition-all active:scale-95"
                    >
                        {uploading ? <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div> : <Icons.Camera />}
                        <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">{t('quick_snap')}</span>
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                        onClick={(e) => e.stopPropagation()}
                    />
                 </div>
            ) : null}

            <div className="relative h-36 bg-slate-200 overflow-hidden group">
                {tree.latestGrowthUrl || tree.imageUrl || tree.id === 'GENESIS_TREE' ? (
                    <Picture size={480}
                        src={tree.latestGrowthUrl || tree.imageUrl || '/mahameru.svg'}
                        alt={tree.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[3s]"
                    />
                ) : (
                    // No image: the forest's own colour, not placeholder art.
                    <div className="h-full w-full" style={{ backgroundColor: tabTone('forest') }} />
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent pointer-events-none"></div>
                {hasValidationBadge && (
                    <div className="absolute bottom-2 right-2 z-20">
                        <ValidationBadge compact />
                    </div>
                )}
                <div className="absolute bottom-2 left-3 right-3 text-white pointer-events-none">
                    <h3 dir="auto" className="text-lg font-light tracking-wide truncate">{tree.name}</h3>
                    {tree.shortTitle && <p dir="auto" className="text-xs font-bold text-emerald-200 uppercase tracking-widest truncate">{tree.shortTitle}</p>}
                    <div className="flex items-center text-xs text-slate-300 mt-0.5 gap-2 rtl:space-x-reverse">
                         {!tree.isNature && <span className="px-1.5 py-0 border border-slate-500 rounded-full text-[9px] bg-slate-800/50 backdrop-blur">
                            {t('block')}: {tree.blockHeight || 0}
                        </span>}
                        {tree.isNature && tree.status === 'DANGER' && (
                            onAlertGuardians ? (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onAlertGuardians(tree); }}
                                    title="Message this tree's guardians"
                                    className="pointer-events-auto bg-red-500 text-white px-2 py-0.5 rounded-full text-[9px] font-bold animate-pulse hover:bg-red-600 active:scale-95 transition-all"
                                >
                                    DANGER · alert guardians
                                </button>
                            ) : (
                                <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[9px] font-bold animate-pulse">DANGER</span>
                            )
                        )}
                        {needsWater && (
                            <span className="bg-sky-500 text-white px-2 py-0.5 rounded-full text-[9px] font-bold animate-pulse inline-flex items-center gap-1">💧 NEEDS WATER</span>
                        )}
                    </div>
                </div>
            </div>
            <div className="p-3">
                <p dir="auto" className="text-slate-600 text-xs font-light italic leading-relaxed truncate">
                    "{tree.body}"
                </p>
                <div className="mt-3 pt-2 border-t border-slate-100 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <button onClick={(e) => { e.stopPropagation(); onPlayGrowth(tree.id); }} className="flex items-center gap-1 text-[10px] bg-primary/10 hover:bg-primary/20 text-primary px-2 py-1 rounded transition-colors uppercase tracking-wider font-semibold">
                        <Icons.Play />
                        <span>Growth</span>
                    </button>
                    {onReach && (
                        canReach ? (
                            <button onClick={(e) => { e.stopPropagation(); onReach(tree); }} className="flex items-center gap-1 text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-700 px-2 py-1 rounded transition-colors uppercase tracking-wider font-semibold">
                                <Icons.Reach />
                                <span>Reach</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                disabled
                                onClick={(e) => e.stopPropagation()}
                                title={t('only_if_validated')}
                                className="flex items-center gap-1 text-[10px] bg-slate-100 text-slate-400 px-2 py-1 rounded uppercase tracking-wider font-semibold cursor-not-allowed"
                            >
                                <Icons.Eye size={12} />
                                <span>{t('only_if_validated')}</span>
                            </button>
                        )
                    )}
                    
                    <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:flex-row">
                        {showValidateAction && (
                            <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    const nextValidated = !hasValidationBadge;
                                    const message = nextValidated ? 'Validate this tree?' : 'Remove validation from this tree?';
                                    if (await showConfirm(message, { title: 'Validation' })) onValidate(tree.id, nextValidated);
                                }}
                                className="text-[10px] bg-primary text-white px-3 py-1.5 rounded-full shadow hover:opacity-90 transition-all uppercase font-bold tracking-wider"
                            >
                                {hasValidationBadge ? 'Remove Validation' : t('validate_action')}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Crop the snapped photo before it becomes a growth pulse. The wrapper stops the
                overlay click from bubbling up to the card's onView handler. */}
            {pendingSnap && (
                <div onClick={(e) => e.stopPropagation()}>
                    <ImageCropModal
                        file={pendingSnap}
                        aspect={1}
                        title="Frame the growth"
                        onCancel={() => setPendingSnap(null)}
                        onConfirm={handleCropped}
                    />
                </div>
            )}
        </div>
    );
};
