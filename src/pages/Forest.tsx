import React, { useState, useRef, FormEvent } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Lifetree } from '../types/Types';
import { LifetreeCard } from '../components/LifetreeCard';
import { Icons } from '../components/Icons';
import { Modal } from '../components/Modal';
import { ImagePicker } from '../components/ImagePicker';
import { SimpleButton } from '../components/SimpleButton';
import { Input } from '../components/Input';
import { useInfiniteQuery } from '../hooks/useInfiniteQuery';
import { collection, query, orderBy } from 'firebase/firestore';
import { db, validateLifetree, uploadImage, mintPulse, plantLifetree } from '../lib/firebase';
import { generateLifetreeBio } from '../services/gemini';

export default function Forest() {
    const { t } = useLanguage();
    const { lightseed, myTrees, refreshTrees } = useAuth();
    const myActiveTree = myTrees.length > 0 ? myTrees[0] : null;
    const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
    const [showPlantModal, setShowPlantModal] = useState(false);
    
    // Plant Form State
    const [treeName, setTreeName] = useState('');
    const [treeSeed, setTreeSeed] = useState('');
    const [treeBio, setTreeBio] = useState('');
    const [treeImageUrl, setTreeImageUrl] = useState('');
    const [uploading, setUploading] = useState(false);

    const forestQuery = query(collection(db, 'lifetrees'), orderBy('createdAt', 'desc'));
    const { data: trees, loading, lastElementRef } = useInfiniteQuery<Lifetree>(forestQuery);

    const handleImageUpload = async (file: File, path: string) => {
        setUploading(true);
        try {
            const url = await uploadImage(file, path);
            setUploading(false);
            return url;
        } catch (e) {
            setUploading(false);
            alert("Upload failed");
            return "";
        }
    };

    const handlePlant = async (e: FormEvent) => {
        e.preventDefault();
        if (!lightseed) return;
        if (!navigator.geolocation) {
            alert("Geolocation is required to plant a tree.");
            return;
        }
        navigator.geolocation.getCurrentPosition(async (pos) => {
            try {
                setUploading(true);
                await plantLifetree({ 
                    ownerId: lightseed.uid, 
                    name: treeName, 
                    body: treeBio, 
                    imageUrl: treeImageUrl, 
                    lat: pos.coords.latitude, 
                    lng: pos.coords.longitude 
                });
                await refreshTrees();
                setShowPlantModal(false);
                setTreeName(''); setTreeBio(''); setTreeImageUrl('');
            } catch(e: any) { 
                alert(e.message); 
            } finally {
                setUploading(false);
            }
        });
    };

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
             <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-light">{t('forest')}</h1>
                <div className="flex gap-4">
                    {lightseed && (
                        <SimpleButton onClick={() => setShowPlantModal(true)} className="bg-emerald-600 text-white hover:bg-emerald-700 rounded-full">
                            {t('plant_lifetree')}
                        </SimpleButton>
                    )}
                    <div className="bg-white p-1 rounded-lg border border-slate-200 flex shadow-sm shrink-0">
                        <button onClick={() => setViewMode('grid')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'grid' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-800'}`}>
                            <div className="flex items-center space-x-2"><Icons.List /><span>{t('list_view')}</span></div>
                        </button>
                        <button onClick={() => setViewMode('map')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'map' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-800'}`}>
                            <div className="flex items-center space-x-2"><Icons.Map /><span>{t('map_view')}</span></div>
                        </button>
                    </div>
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
                    Map View (Leaflet Integration)
                </div>
            )}

            {showPlantModal && (
                <Modal title={t('plant_lifetree')} onClose={() => setShowPlantModal(false)}>
                    <form onSubmit={handlePlant} className="space-y-4">
                        <ImagePicker 
                            onChange={(e: any) => handleImageUpload(e.target.files[0], `trees/${Date.now()}`).then(setTreeImageUrl)} 
                            previewUrl={treeImageUrl} 
                            loading={uploading} 
                        />
                        <Input placeholder="Tree Name" value={treeName} onChange={e=>setTreeName(e.target.value)} required />
                        <div className="flex gap-2">
                            <Input className="flex-1" placeholder="Seed keywords" value={treeSeed} onChange={e=>setTreeSeed(e.target.value)} />
                            <SimpleButton type="button" onClick={() => generateLifetreeBio(treeSeed).then(setTreeBio)} className="bg-emerald-600 text-white">AI</SimpleButton>
                        </div>
                        <textarea className="block w-full border border-slate-200 dark:border-slate-800 bg-transparent p-2 rounded-md text-sm" placeholder="Vision" value={treeBio} onChange={e=>setTreeBio(e.target.value)} required rows={4} />
                        <SimpleButton type="submit" disabled={uploading} className="w-full bg-emerald-600 text-white">Plant</SimpleButton>
                    </form>
                </Modal>
            )}
        </div>
    );
};