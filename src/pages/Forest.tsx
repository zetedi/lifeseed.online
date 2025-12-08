import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Lifetree } from '../types/Types';
import { LifetreeCard } from '../components/LifetreeCard';
import { Icons } from '../components/Icons';
import { useInfiniteQuery } from '../hooks/useInfiniteQuery';
import { collection, query, orderBy } from 'firebase/firestore';
import { db, validateLifetree, uploadImage, mintPulse } from '../lib/firebase';

export default function Forest() {
    const { t } = useLanguage();
    const { lightseed, myTrees } = useAuth();
    const myActiveTree = myTrees.length > 0 ? myTrees[0] : null;
    const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
    
    const forestQuery = query(collection(db, 'lifetrees'), orderBy('createdAt', 'desc'));
    const { data: trees, loading, lastElementRef } = useInfiniteQuery<Lifetree>(forestQuery);

    const handleQuickSnap = async (treeId: string, file: File) => {
         if (!lightseed) return;
         try {
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
         } catch(e: any) {
             console.error(e);
             alert("Error: " + e.message);
         }
    };

    const handleValidate = async (id: string) => {
        if (!myActiveTree) return;
        try {
            await validateLifetree(id, myActiveTree.id);
            alert("Validated!");
        } catch (e: any) {
            alert(e.message);
        }
    };

    return (
        <div className="p-4 max-w-7xl mx-auto">
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
                                    onValidate={handleValidate}
                                    onPlayGrowth={(id) => console.log('Play growth', id)}
                                    onQuickSnap={handleQuickSnap}
                                    onView={() => console.log('View tree', tree.id)}
                                />
                            </div>
                        );
                    })}
                    {loading && <p className="col-span-full text-center py-4 text-slate-400">Loading more trees...</p>}
                </div>
            ) : (
                <div className="bg-slate-100 h-[600px] rounded-xl flex items-center justify-center text-slate-400">
                    Map View
                </div>
            )}
        </div>
    );
};