
import React, { useState, useEffect, FormEvent } from 'react';
import {
  signInWithGoogle,
  logout,
  fetchPulses,
  mintPulse,
  fetchLifetrees,
  plantLifetree,
  uploadImage,
  uploadBase64Image,
  validateLifetree,
  proposeMatch,
  getPendingMatches,
  acceptMatch,
  fetchVisions,
  createVision
} from './services/firebase';
import { generateLifetreeBio, generateVisionImage } from './services/gemini';
import { type Pulse, type Lifetree, type MatchProposal } from './types';
import Logo from './components/Logo';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { colors } from './utils/theme';
import { useLifeseed } from './hooks/useLifeseed';

// Components
import { Icons } from './components/ui/Icons';
import { Modal } from './components/ui/Modal';
import { ImagePicker } from './components/ui/ImagePicker';
import { Navigation } from './components/Navigation';
import { LifetreeCard } from './components/LifetreeCard';
import { VisionCard } from './components/VisionCard';
import { PulseCard } from './components/PulseCard';
import { ForestMap } from './components/ForestMap';
import { LifetreeDetail } from './components/LifetreeDetail';
import { GrowthPlayerModal } from './components/GrowthPlayerModal';
import { OracleChat } from './components/OracleChat';
import { LightseedProfile } from './components/LightseedProfile';

const AppContent = () => {
    const { t } = useLanguage();
    const { lightseed, myTrees, activeTree, loading: authLoading, refreshTrees } = useLifeseed();
    const [tab, setTab] = useState('forest');
    const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
    const [data, setData] = useState<any[]>([]);
    const [matches, setMatches] = useState<MatchProposal[]>([]);
    const [selectedTree, setSelectedTree] = useState<Lifetree | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [hasApiKey, setHasApiKey] = useState(false);
    
    // UI State
    const [showPlantModal, setShowPlantModal] = useState(false);
    const [showPulseModal, setShowPulseModal] = useState(false);
    const [showVisionModal, setShowVisionModal] = useState(false);
    const [showGrowthPlayer, setShowGrowthPlayer] = useState<string | null>(null);
    const [matchCandidate, setMatchCandidate] = useState<Pulse | null>(null);

    // Form State
    const [treeName, setTreeName] = useState('');
    const [treeSeed, setTreeSeed] = useState('');
    const [treeBio, setTreeBio] = useState('');
    const [treeImageUrl, setTreeImageUrl] = useState('');
    
    const [pulseTitle, setPulseTitle] = useState('');
    const [pulseBody, setPulseBody] = useState('');
    const [pulseImageUrl, setPulseImageUrl] = useState('');
    const [isGrowth, setIsGrowth] = useState(false);
    const [uploading, setUploading] = useState(false);
    
    // Vision Form State
    const [visionTitle, setVisionTitle] = useState('');
    const [visionBody, setVisionBody] = useState('');
    const [visionLink, setVisionLink] = useState('');
    const [visionImageUrl, setVisionImageUrl] = useState('');

    const checkKey = async () => {
         const aiStudio = (window as any).aistudio;
         if (aiStudio && aiStudio.hasSelectedApiKey) {
             const has = await aiStudio.hasSelectedApiKey();
             setHasApiKey(has);
         } else {
             // Safe check thanks to vite config
             const key = process.env.API_KEY;
             setHasApiKey(!!key);
         }
    }

    useEffect(() => { 
        checkKey();
        loadContent(); 
    }, [tab, lightseed]);
    
    useEffect(() => { if (lightseed && myTrees.length === 0 && !authLoading) setShowPlantModal(true); }, [lightseed, myTrees]);

    const loadContent = async () => {
        setData([]); // Clear data before loading
        if (tab === 'forest') setData(await fetchLifetrees());
        else if (tab === 'pulses') setData(await fetchPulses());
        else if (tab === 'visions') setData(await fetchVisions());
        else if (tab === 'matches' && lightseed) setMatches(await getPendingMatches(lightseed.uid));
    };

    const handleImageUpload = async (file: File, path: string) => {
        setUploading(true);
        const url = await uploadImage(file, path);
        setUploading(false);
        return url;
    };
    
    const handleGenerateVisionImage = async () => {
        if (!visionBody) { alert("Please enter a vision description first."); return; }
        setUploading(true);
        try {
            const url = await generateVisionImage(visionBody);
            if (url) {
                setVisionImageUrl(url);
            } else {
                throw new Error("No image data returned from AI service.");
            }
        } catch (e: any) {
             alert(`Image generation failed: ${e.message}`);
        }
        setUploading(false);
    }

    const handleQuickSnap = async (treeId: string, file: File) => {
        if (!lightseed) return;
        try {
            const url = await handleImageUpload(file, `growth/${treeId}/${Date.now()}`);
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
            await loadContent(); 
        } catch (e: any) {
            alert("Error taking picture: " + e.message);
        }
    }

    const handlePlant = async (e: FormEvent) => {
        e.preventDefault();
        if (!lightseed) return;
        navigator.geolocation.getCurrentPosition(async (pos) => {
            try {
                await plantLifetree({ ownerId: lightseed.uid, name: treeName, body: treeBio, imageUrl: treeImageUrl, lat: pos.coords.latitude, lng: pos.coords.longitude });
                await refreshTrees(); setShowPlantModal(false); loadContent();
            } catch(e: any) { alert(e.message); }
        });
    };

    const handleEmitPulse = async (e: FormEvent) => {
        e.preventDefault();
        if (!lightseed || !activeTree) return;
        
        let finalImageUrl = pulseImageUrl;
        if (pulseImageUrl.startsWith('data:')) {
             setUploading(true);
             try {
                 finalImageUrl = await uploadBase64Image(pulseImageUrl, `pulses/ai/${Date.now()}`);
             } catch(e) {
                 setUploading(false);
                 alert("Failed to upload AI image");
                 return;
             }
             setUploading(false);
        }

        try {
            await mintPulse({
                lifetreeId: activeTree.id,
                type: isGrowth ? 'GROWTH' : 'STANDARD',
                title: pulseTitle,
                body: pulseBody,
                imageUrl: finalImageUrl,
                authorId: lightseed.uid,
                authorName: lightseed.displayName || "Soul",
                authorPhoto: lightseed.photoURL || undefined,
            });
            setShowPulseModal(false); setPulseTitle(''); setPulseBody(''); setPulseImageUrl(''); setIsGrowth(false); loadContent();
        } catch(e: any) { alert(e.message); }
    };
    
    const handleCreateVision = async (e: FormEvent) => {
        e.preventDefault();
        if (!lightseed || !activeTree) return;

        let finalImageUrl = visionImageUrl;
        if (visionImageUrl.startsWith('data:')) {
             setUploading(true);
             try {
                 finalImageUrl = await uploadBase64Image(visionImageUrl, `visions/ai/${Date.now()}`);
             } catch(e) {
                 setUploading(false);
                 alert("Failed to upload AI image");
                 return;
             }
             setUploading(false);
        }

        try {
            await createVision({
                lifetreeId: activeTree.id,
                authorId: lightseed.uid,
                title: visionTitle,
                body: visionBody,
                link: visionLink,
                imageUrl: finalImageUrl
            });
            setShowVisionModal(false); setVisionTitle(''); setVisionBody(''); setVisionLink(''); setVisionImageUrl(''); loadContent();
        } catch(e:any) { alert(e.message); }
    }
    
    const initiateMatch = async (e: FormEvent) => {
        e.preventDefault();
        if (!lightseed || !activeTree || !matchCandidate) return;
        try {
             await proposeMatch({
                 initiatorPulseId: "PENDING_CREATION",
                 initiatorTreeId: activeTree.id,
                 initiatorUid: lightseed.uid,
                 targetPulseId: matchCandidate.id,
                 targetTreeId: matchCandidate.lifetreeId,
                 targetUid: matchCandidate.authorId
             });
             alert("Match Proposed! Waiting for acceptance.");
             setShowPulseModal(false); setMatchCandidate(null);
        } catch(e:any) { alert(e.message); }
    }

    const onAcceptMatch = async (id: string) => {
        try { await acceptMatch(id); alert("Match Accepted! Blocks synced."); loadContent(); } 
        catch(e:any) { alert(e.message); }
    }

    // Filter Logic for Forest View
    const filteredData = data.filter((item: any) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        // Common props for searching
        const text = (item.title || item.name || "") + " " + (item.body || "") + " " + (item.locationName || "");
        return text.toLowerCase().includes(term);
    });

    if (authLoading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50"><Logo className="animate-pulse" /></div>;
    
    if (selectedTree) {
        return (
            <div className={`min-h-screen ${colors.snow} font-sans text-slate-800`}>
                <LifetreeDetail 
                    tree={selectedTree} 
                    onClose={() => setSelectedTree(null)} 
                    onPlayGrowth={setShowGrowthPlayer}
                    onValidate={(id: string) => validateLifetree(id, activeTree!.id).then(() => { alert("Validated!"); setSelectedTree(null); loadContent(); })}
                    myActiveTree={activeTree}
                />
                 {showGrowthPlayer && <GrowthPlayerModal treeId={showGrowthPlayer} onClose={() => setShowGrowthPlayer(null)} />}
            </div>
        )
    }

    if (tab === 'profile' && lightseed) {
        return (
            <div className={`min-h-screen ${colors.snow} font-sans text-slate-800`}>
                <Navigation 
                    lightseed={lightseed} 
                    activeTab={tab} 
                    setTab={setTab} 
                    onLogin={signInWithGoogle} 
                    onLogout={logout} 
                    onPlant={() => setShowPlantModal(true)} 
                    onPulse={() => setShowPulseModal(true)}
                    onCreateVision={() => setShowVisionModal(true)}
                    onProfile={() => setTab('profile')} 
                    hasApiKey={hasApiKey}
                    onCheckKey={checkKey}
                />
                <LightseedProfile 
                    lightseed={lightseed} 
                    myTrees={myTrees} 
                    onViewTree={(tree: Lifetree) => setSelectedTree(tree)}
                />
            </div>
        )
    }

    return (
        <div className={`min-h-screen ${colors.snow} font-sans text-slate-800`}>
            <Navigation 
                lightseed={lightseed} 
                activeTab={tab} 
                setTab={setTab} 
                onLogin={signInWithGoogle} 
                onLogout={logout} 
                onPlant={() => setShowPlantModal(true)} 
                onPulse={() => setShowPulseModal(true)}
                onCreateVision={() => setShowVisionModal(true)}
                onProfile={() => setTab('profile')} 
                hasApiKey={hasApiKey}
                onCheckKey={checkKey}
            />
            
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                {/* Search Bar for all tabs except matches/profile/oracle */}
                {tab !== 'matches' && tab !== 'profile' && tab !== 'oracle' && (
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <div className="relative w-full md:max-w-md">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <Icons.Search />
                            </div>
                            <input 
                                type="text"
                                className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm shadow-sm"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* View Switcher only for Forest */}
                        {tab === 'forest' && (
                            <div className="bg-white p-1 rounded-lg border border-slate-200 flex shadow-sm shrink-0">
                                <button 
                                    onClick={() => setViewMode('grid')}
                                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'grid' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    <div className="flex items-center space-x-2">
                                        <Icons.List />
                                        <span>{t('list_view')}</span>
                                    </div>
                                </button>
                                <button 
                                    onClick={() => setViewMode('map')}
                                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'map' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    <div className="flex items-center space-x-2">
                                        <Icons.Map />
                                        <span>{t('map_view')}</span>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Matches Inbox */}
                {tab === 'matches' && (
                    <div className="max-w-2xl mx-auto">
                        <h2 className="text-2xl font-light mb-6">Pending Matches</h2>
                        {matches.length === 0 ? <p className="text-slate-400">No pending requests.</p> : matches.map(m => (
                            <div key={m.id} className="bg-white p-4 rounded shadow-sm border border-slate-200 mb-4 flex justify-between items-center">
                                <div><p className="font-bold">Match Request</p><p className="text-sm text-slate-500">From another Tree</p></div>
                                <button onClick={() => onAcceptMatch(m.id)} className="bg-sky-500 text-white px-4 py-2 rounded">Accept & Sync</button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Oracle Chat */}
                {tab === 'oracle' && <OracleChat hasApiKey={hasApiKey} />}

                {/* Content Area */}
                {tab === 'forest' ? (
                    viewMode === 'map' ? (
                        <ForestMap trees={filteredData} />
                    ) : (
                        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                             {filteredData.length === 0 ? (
                                 <p className="col-span-full text-center text-slate-400 py-10">No trees found matching your search.</p>
                             ) : (
                                filteredData.map((item: any) => (
                                    <LifetreeCard 
                                        key={item.id} 
                                        tree={item} 
                                        myActiveTree={activeTree} 
                                        onPlayGrowth={setShowGrowthPlayer} 
                                        onQuickSnap={handleQuickSnap}
                                        onValidate={(id: string) => validateLifetree(id, activeTree!.id).then(() => { alert("Validated!"); loadContent(); })}
                                        onView={setSelectedTree}
                                    />
                                ))
                             )}
                        </div>
                    )
                ) : tab === 'visions' ? (
                    <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredData.length === 0 ? <p className="col-span-full text-center text-slate-400 py-10">No visions found.</p> : 
                            filteredData.map((item: any) => <VisionCard key={item.id} vision={item} />)
                        }
                    </div>
                ) : tab !== 'matches' && tab !== 'profile' && tab !== 'oracle' && (
                    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                        {data.map((item) => (
                             <PulseCard key={item.id} pulse={item} lightseed={lightseed} onMatch={(p: Pulse) => { setMatchCandidate(p); setShowPulseModal(true); }} />
                        ))}
                    </div>
                )}
            </main>

            {/* Growth Player Modal */}
            {showGrowthPlayer && <GrowthPlayerModal treeId={showGrowthPlayer} onClose={() => setShowGrowthPlayer(null)} />}

            {/* Plant Modal (Simplified) */}
            {showPlantModal && (
                <Modal title={t('plant_lifetree')} onClose={() => myTrees.length > 0 && setShowPlantModal(false)}>
                    <form onSubmit={handlePlant} className="space-y-4">
                        <ImagePicker onChange={(e: any) => handleImageUpload(e.target.files[0], `trees/${Date.now()}`).then(setTreeImageUrl)} previewUrl={treeImageUrl} loading={uploading} />
                        <input className="block w-full border p-2 rounded" placeholder="Tree Name" value={treeName} onChange={e=>setTreeName(e.target.value)} required />
                        <div className="flex gap-2"><input className="flex-1 border p-2 rounded" placeholder="Seed keywords" value={treeSeed} onChange={e=>setTreeSeed(e.target.value)} /><button type="button" onClick={() => generateLifetreeBio(treeSeed).then(setTreeBio)} className="bg-emerald-600 text-white px-4 rounded">AI</button></div>
                        <textarea className="block w-full border p-2 rounded" placeholder="Vision" value={treeBio} onChange={e=>setTreeBio(e.target.value)} required />
                        <button type="submit" disabled={uploading} className="w-full bg-emerald-600 text-white py-2 rounded">Plant</button>
                    </form>
                </Modal>
            )}

            {/* Vision Creation Modal */}
            {showVisionModal && (
                <Modal title={t('create_vision')} onClose={() => setShowVisionModal(false)}>
                    <form onSubmit={handleCreateVision} className="space-y-4">
                         <div className="border border-slate-200 p-4 rounded-xl text-center space-y-2">
                             {visionImageUrl ? (
                                 <img src={visionImageUrl} className="w-full h-40 object-cover rounded-lg" />
                             ) : (
                                 <div className="text-slate-400 h-40 flex items-center justify-center bg-slate-50 rounded-lg">No Image</div>
                             )}
                             <div className="flex gap-2 justify-center">
                                 <div className="relative overflow-hidden">
                                    <button type="button" className="text-sm text-slate-500 hover:text-slate-800 px-3 py-1 border rounded">{t('upload_photo')}</button>
                                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={(e) => { if(e.target.files?.[0]) handleImageUpload(e.target.files[0], `visions/${Date.now()}`).then(setVisionImageUrl) }} />
                                 </div>
                                 <button type="button" onClick={handleGenerateVisionImage} disabled={uploading} className="text-sm bg-amber-500 text-white px-3 py-1 rounded hover:bg-amber-600">{t('generate_image')}</button>
                             </div>
                         </div>

                        <input className="block w-full border p-2 rounded" placeholder={t('title')} value={visionTitle} onChange={e=>setVisionTitle(e.target.value)} required />
                        <textarea className="block w-full border p-2 rounded h-24" placeholder={t('body')} value={visionBody} onChange={e=>setVisionBody(e.target.value)} required />
                        <input className="block w-full border p-2 rounded" placeholder={t('webpage')} value={visionLink} onChange={e=>setVisionLink(e.target.value)} />
                        
                        <button type="submit" disabled={uploading} className="w-full bg-amber-500 text-white py-2 rounded font-bold hover:bg-amber-600 transition-colors">{t('create_vision')}</button>
                    </form>
                </Modal>
            )}

            {/* Pulse / Match Modal */}
            {showPulseModal && (
                <Modal title={matchCandidate ? "Propose Match" : t('emit_pulse')} onClose={() => { setShowPulseModal(false); setMatchCandidate(null); }}>
                    <form onSubmit={matchCandidate ? initiateMatch : handleEmitPulse} className="space-y-4">
                        {matchCandidate ? (
                             <div className="bg-sky-50 p-4 rounded text-sky-800">
                                Matching with <strong>{matchCandidate.title}</strong>. 
                                <br/><span className="text-xs">This will send a request to the owner.</span>
                             </div>
                        ) : (
                            <>
                                <ImagePicker onChange={(e: any) => handleImageUpload(e.target.files[0], `pulses/${Date.now()}`).then(setPulseImageUrl)} previewUrl={pulseImageUrl} loading={uploading} />
                                <div className="flex items-center space-x-2">
                                    <input type="checkbox" id="growth" checked={isGrowth} onChange={e => setIsGrowth(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
                                    <label htmlFor="growth" className="text-sm font-medium text-slate-700">This is a Growth Picture (Internal Pulse)</label>
                                </div>
                                <input className="block w-full border p-2 rounded" placeholder="Title" value={pulseTitle} onChange={e=>setPulseTitle(e.target.value)} required />
                                <textarea className="block w-full border p-2 rounded" placeholder="Body" value={pulseBody} onChange={e=>setPulseBody(e.target.value)} required />
                            </>
                        )}
                        <button type="submit" disabled={uploading} className="w-full bg-emerald-600 text-white py-2 rounded">{matchCandidate ? "Send Request" : t('mint')}</button>
                    </form>
                </Modal>
            )}
        </div>
    );
};

const App = () => (<LanguageProvider><AppContent /></LanguageProvider>);
export default App;
