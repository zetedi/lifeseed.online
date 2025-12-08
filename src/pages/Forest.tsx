
import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Lifetree } from '../types';
import { LifetreeCard } from '../components/LifetreeCard';
import { Icons } from '../components/Icons';
import { useInfiniteQuery } from '../hooks/useInfiniteQuery';
import { collection, query, orderBy } from 'firebase/firestore';
import { db, validateLifetree, uploadImage, mintPulse } from '../services/firebase';

// Since we separated ForestMap in App.tsx (or if you want to move it here, you can), 
// For this refactor, I'll assume the Map view logic is passed down or handled here if simple.
// But to keep it modular, let's keep it clean.

interface ForestPageProps {
    myActiveTree: Lifetree | null;
    lightseed: any;
    onViewTree: (tree: Lifetree) => void;
    setShowGrowthPlayer: (id: string) => void;
    // Map view props or components would be passed here or imported
}

export const Forest = ({ myActiveTree, lightseed, onViewTree, setShowGrowthPlayer }: ForestPageProps) => {
    const { t } = useLanguage();
    const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
    
    // Performance: Use Infinite Scroll
    const forestQuery = query(collection(db, 'lifetrees'), orderBy('createdAt', 'desc'));
    const { data: trees, loading, lastElementRef } = useInfiniteQuery<Lifetree>(forestQuery);

    const handleQuickSnap = async (treeId: string, file: File) => {
         if (!lightseed) return;
         try {
            // Upload logic here or passed from parent context
            const url = await uploadImage(file, `growth/${treeId}/${Date.now()}`);
             await mintPulse({
                lifetreeId: treeId,
                type: 'GROWTH',
                title: 'Growth Snapshot',
                body: `Snapped on ${new Date().toLocaleDateString()}`,
                imageUrl: url,
                authorId: lightseed.uid,
                authorName: lightseed.displayName || "Soul",
                authorPhoto: lightseed.photoURL || undefined,
            });
            alert("Snapshot minted!");
         } catch(e) {
             console.error(e);
         }
    };

    return (
        <div>
             <div className="flex justify-end mb-4">
                <div className="bg-white p-1 rounded-lg border border-slate-200 flex shadow-sm shrink-0">
                    <button onClick={() => setViewMode('grid')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'grid' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-800'}`}>
                        <div className="flex items-center space-x-2"><Icons.List /><span>{t('list_view')}</span></div>
                    </button>
                    <button onClick={() => setViewMode('map')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'map' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-800'}`}>
                        <div className="flex items-center space-x-2"><Icons.Map /><span>{t('map_view')}</span></div>
                    </button>
                </div>
            </div>

            {viewMode === 'grid' ? (
                <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {trees.map((tree, index) => {
                        const isLast = index === trees.length - 1;
                        return (
                            <div key={tree.id} ref={isLast ? lastElementRef : null}>
                                <LifetreeCard 
                                    tree={tree} 
                                    myActiveTree={myActiveTree}
                                    onValidate={(id) => validateLifetree(id, myActiveTree!.id)}
                                    onPlayGrowth={setShowGrowthPlayer}
                                    onQuickSnap={handleQuickSnap}
                                    onView={onViewTree}
                                />
                            </div>
                        );
                    })}
                    {loading && <p className="col-span-full text-center py-4 text-slate-400">Loading more trees...</p>}
                </div>
            ) : (
                <div className="bg-slate-100 h-[600px] rounded-xl flex items-center justify-center text-slate-400">
                    {/* Placeholder for Map Component - ideally imported from components/ForestMap.tsx */}
                    Map View (Refactored to separate component)
                </div>
            )}
        </div>
    );
};
