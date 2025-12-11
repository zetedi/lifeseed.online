import React, { useState, useEffect, FormEvent, useRef } from 'react';
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
  createVision,
  deleteLifetree,
  ensureGenesis
} from './services/firebase';
import { generateLifetreeBio, generateVisionImage } from './services/gemini';
import { type Pulse, type Lifetree, type MatchProposal, type Vision } from './types';
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
import { VisionDetail } from './components/VisionDetail';
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
    const [selectedVision, setSelectedVision] = useState<Vision | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [hasApiKey, setHasApiKey] = useState(false);
    
    // Pagination State
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    // UI State
    const [showPlantModal, setShowPlantModal] = useState(false);
    const [showPulseModal, setShowPulseModal] = useState(false);
    const [showVisionModal, setShowVisionModal] = useState(false);
    const [showGrowthPlayer, setShowGrowthPlayer] = useState<string | null>(null);
    const [matchCandidate, setMatchCandidate] = useState<Pulse | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [treeName, setTreeName] = useState('');
    const [treeShortTitle, setTreeShortTitle] = useState('');
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

    const mainContainerRef = useRef<HTMLDivElement>(null);

    // Clay Background with Seed of Life Pattern
    // Color: #B2713A (Clay)
    const svgBackground = `data:image/svg+xml,%3Csvg width='332.5537705' height='320' xmlns='http://www.w3.org/2000/svg'%3E%3Cstyle%3E .outerCircle %7B fill: %23B2713A; stroke: %23fff; stroke-width: 7; stroke-opacity: .3; %7D .circle %7B fill: none; stroke: %23fff; stroke-width: .3; stroke-opacity: .3; %7D .innerCircle %7B fill: %23B2713A; stroke: %23fff; stroke-width: 1.7; stroke-opacity: .4; %7D %3C/style%3E%3Crect width='100%25' height='100%25' fill='%23B2713A'/%3E%3Cdefs%3E%3CclipPath id='clean'%3E%3Crect width='332.5537705' height='320' /%3E%3C/clipPath%3E%3C/defs%3E%3Cg%3E%3Ccircle cx='-38.2768775' cy='-32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='-38.2768775' cy='32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='-38.2768775' cy='96' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='-38.2768775' cy='160' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='-38.2768775' cy='224' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='-38.2768775' cy='288' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='-38.2768775' cy='352' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='17.1487483' cy='0' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='17.1487483' cy='64' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='17.1487483' cy='128' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='17.1487483' cy='192' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='17.1487483' cy='256' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='17.1487483' cy='320' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='-32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='96' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='160' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='224' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='288' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='352' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='0' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='64' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='128' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='192' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='256' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='320' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='-32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='96' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='160' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='224' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='288' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='352' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='238.8512516' cy='0' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='238.8512516' cy='64' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='238.8512516' cy='128' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='238.8512516' cy='192' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='238.8512516' cy='256' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='238.8512516' cy='320' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='-32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='32' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='96' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='160' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='224' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='288' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='352' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='349.7025033' cy='0' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='349.7025033' cy='64' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='349.7025033' cy='128' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='349.7025033' cy='192' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='349.7025033' cy='256' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='349.7025033' cy='320' r='64' class='circle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='96' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3Ccircle cx='72.5743741' cy='160' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='64' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='128' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3Ccircle cx='128' cy='192' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='96' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3Ccircle cx='183.4256258' cy='160' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3Ccircle cx='294.2768775' cy='288' r='16' class='innerCircle' clip-path='url(%23clean)' /%3E%3C/g%3E%3C/svg%3E`;

    const backgroundStyle = {
        backgroundImage: `url("${svgBackground}")`,
        backgroundSize: '108px', 
        backgroundRepeat: 'repeat',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
    };

    const checkKey = async () => {
         const aiStudio = (window as any).aistudio;
         if (aiStudio && aiStudio.hasSelectedApiKey) {
             const has = await aiStudio.hasSelectedApiKey();
             setHasApiKey(has);
         } else {
             // Check global process only
             const key = (window as any).process?.env?.API_KEY;
             setHasApiKey(!!key);
         }
    }

    useEffect(() => { 
        checkKey();
        loadContent(true); 
        ensureGenesis(); // Ensure Genesis tree exists on app load
    }, [tab, lightseed]);
    
    // Infinite Scroll Listener
    useEffect(() => {
        const handleScroll = () => {
            if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
                if (!loadingMore && hasMore && tab !== 'matches' && tab !== 'oracle' && tab !== 'profile') {
                    loadContent(false);
                }
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [loadingMore, hasMore, tab, lastDoc]);

    const loadContent = async (reset = false) => {
        if (reset) {
            setData([]);
            setLastDoc(null);
            setHasMore(true);
        }

        // Avoid fetching if we're just matching/profile/oracle or no more data
        if (!reset && !hasMore) return;
        
        setLoadingMore(true);
        const currentLastDoc = reset ? undefined : lastDoc;

        try {
            if (tab === 'forest') {
                const res = await fetchLifetrees(currentLastDoc);
                setData(prev => reset ? res.items : [...prev, ...res.items]);
                setLastDoc(res.lastDoc);
                setHasMore(!!res.lastDoc);
            }
            else if (tab === 'pulses') {
                const res = await fetchPulses(currentLastDoc);
                setData(prev => reset ? res.items : [...prev, ...res.items]);
                setLastDoc(res.lastDoc);
                setHasMore(!!res.lastDoc);
            }
            else if (tab === 'visions') {
                const res = await fetchVisions(currentLastDoc);
                setData(prev => reset ? res.items : [...prev, ...res.items]);
                setLastDoc(res.lastDoc);
                setHasMore(!!res.lastDoc);
            }
            else if (tab === 'matches' && lightseed) {
                 // Matches don't support cursor pagination in this simplified version yet
                 const res = await getPendingMatches(lightseed.uid);
                 setMatches(res);
            }
        } catch(e) {
            console.error(e);
        }
        setLoadingMore(false);
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
            loadContent(true); 
        } catch (e: any) {
            alert("Error taking picture: " + e.message);
        }
    }

    const handlePlant = async (e: FormEvent) => {
        e.preventDefault();
        if (!lightseed || isSubmitting) return;
        setIsSubmitting(true);
        
        // Use provided name or default to user's display name
        const finalName = treeName.trim() || lightseed.displayName || "Anonymous Tree";

        navigator.geolocation.getCurrentPosition(async (pos) => {
            try {
                await plantLifetree({ 
                    ownerId: lightseed.uid, 
                    name: finalName, 
                    shortTitle: treeShortTitle,
                    body: treeBio, 
                    imageUrl: treeImageUrl, 
                    lat: pos.coords.latitude, 
                    lng: pos.coords.longitude 
                });
                await refreshTrees(); setShowPlantModal(false); loadContent(true);
            } catch(e: any) { alert(e.message); }
            finally { setIsSubmitting(false); }
        }, (err) => {
            // Handle geo error fallback
             plantLifetree({ 
                 ownerId: lightseed.uid, 
                 name: finalName, 
                 shortTitle: treeShortTitle,
                 body: treeBio, 
                 imageUrl: treeImageUrl 
             })
                .then(async () => { await refreshTrees(); setShowPlantModal(false); loadContent(true); })
                .catch(e => alert(e.message))
                .finally(() => setIsSubmitting(false));
        });
    };

    const handleDeleteTree = async (treeId: string) => {
        if (!window.confirm("Are you sure you want to delete this Lifetree? This cannot be undone.")) return;
        try {
            await deleteLifetree(treeId);
            await refreshTrees();
            loadContent(true);
        } catch (e: any) {
            alert("Error deleting tree: " + e.message);
        }
    }

    const handleEmitPulse = async (e: FormEvent) => {
        e.preventDefault();
        if (!lightseed || !activeTree || isSubmitting) return;
        setIsSubmitting(true);
        
        try {
            let finalImageUrl = pulseImageUrl;
            if (pulseImageUrl.startsWith('data:')) {
                 try {
                     finalImageUrl = await uploadBase64Image(pulseImageUrl, `pulses/ai/${Date.now()}`);
                 } catch(e) {
                     alert("Failed to upload AI image");
                     setIsSubmitting(false);
                     return;
                 }
            }

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
            setShowPulseModal(false); setPulseTitle(''); setPulseBody(''); setPulseImageUrl(''); setIsGrowth(false); loadContent(true);
        } catch(e: any) { alert(e.message); }
        finally { setIsSubmitting(false); }
    };
    
    const handleCreateVision = async (e: FormEvent) => {
        e.preventDefault();
        if (!lightseed || !activeTree || isSubmitting) return;
        setIsSubmitting(true);

        try {
            let finalImageUrl = visionImageUrl;
            if (visionImageUrl.startsWith('data:')) {
                 try {
                     finalImageUrl = await uploadBase64Image(visionImageUrl, `visions/ai/${Date.now()}`);
                 } catch(e) {
                     alert("Failed to upload AI image");
                     setIsSubmitting(false);
                     return;
                 }
            }

            await createVision({
                lifetreeId: activeTree.id,
                authorId: lightseed.uid,
                title: visionTitle,
                body: visionBody,
                link: visionLink,
                imageUrl: finalImageUrl
            });
            setShowVisionModal(false); setVisionTitle(''); setVisionBody(''); setVisionLink(''); setVisionImageUrl(''); loadContent(true);
        } catch(e:any) { alert(e.message); }
        finally { setIsSubmitting(false); }
    }
    
    const initiateMatch = async (e: FormEvent) => {
        e.preventDefault();
        if (!lightseed || !activeTree || !matchCandidate || isSubmitting) return;
        setIsSubmitting(true);
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
        finally { setIsSubmitting(false); }
    }

    const onAcceptMatch = async (id: string) => {
        try { await acceptMatch(id); alert("Match Accepted! Blocks synced."); loadContent(true); } 
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

    // Create unique suggestion list for datalist
    const searchSuggestions = Array.from(new Set(data.map((item: any) => item.title || item.name).filter(Boolean)));

    if (authLoading) return <div className="h-screen w-full flex items-center justify-center bg-[#B2713A]"><Logo className="animate-pulse text-white" /></div>;
    
    // DETAIL VIEWS WRAPPER to preserve background
    const DetailWrapper = ({children}: {children: React.ReactNode}) => (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-900/90 backdrop-blur-sm">
            {children}
        </div>
    );

    // Main Content Renderer based on active tab
    const renderMainContent = () => {
        if (tab === 'profile' && lightseed) {
            return (
                <LightseedProfile 
                    lightseed={lightseed} 
                    myTrees={myTrees} 
                    onViewTree={(tree: Lifetree) => setSelectedTree(tree)}
                    onDeleteTree={handleDeleteTree}
                    onViewVision={(v: Vision) => setSelectedVision(v)}
                    onPlant={() => setShowPlantModal(true)}
                />
            );
        }

        return (
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 min-h-[80vh]">
                {/* Search Bar for all tabs except matches/profile/oracle */}
                {tab !== 'matches' && tab !== 'profile' && tab !== 'oracle' && (
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <div className="relative w-full md:max-w-md">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <Icons.Search />
                            </div>
                            <input 
                                type="text"
                                list="search-suggestions"
                                className="block w-full pl-10 pr-3 py-2 border border-emerald-700 rounded-lg leading-5 bg-[#B2713A]/80 backdrop-blur placeholder-slate-400 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm shadow-sm"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <datalist id="search-suggestions">
                                {searchSuggestions.map((s, i) => <option key={i} value={s} />)}
                            </datalist>
                        </div>

                        {/* View Switcher only for Forest */}
                        {tab === 'forest' && (
                            <div className="bg-[#B2713A]/80 backdrop-blur p-1 rounded-lg border border-emerald-700 flex shadow-sm shrink-0">
                                <button 
                                    onClick={() => setViewMode('grid')}
                                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'grid' ? 'bg-emerald-600 text-white shadow' : 'text-emerald-300 hover:text-white'}`}
                                >
                                    <div className="flex items-center space-x-2">
                                        <Icons.List />
                                        <span>{t('list_view')}</span>
                                    </div>
                                </button>
                                <button 
                                    onClick={() => setViewMode('map')}
                                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'map' ? 'bg-emerald-600 text-white shadow' : 'text-emerald-300 hover:text-white'}`}
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
                    <div className="max-w-2xl mx-auto text-white">
                        <h2 className="text-2xl font-light mb-6">Pending Matches</h2>
                        {matches.length === 0 ? <p className="text-slate-400">No pending requests.</p> : matches.map(m => (
                            <div key={m.id} className="bg-white/90 p-4 rounded shadow-sm border border-slate-200 mb-4 flex justify-between items-center text-slate-800">
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
                             {filteredData.length === 0 && !loadingMore ? (
                                 <p className="col-span-full text-center text-slate-400 py-10">No trees found matching your search.</p>
                             ) : (
                                filteredData.map((item: any) => (
                                    <LifetreeCard 
                                        key={item.id} 
                                        tree={item} 
                                        myActiveTree={activeTree} 
                                        onPlayGrowth={setShowGrowthPlayer} 
                                        onQuickSnap={handleQuickSnap}
                                        onValidate={(id: string) => validateLifetree(id, activeTree!.id).then(() => { alert("Validated!"); loadContent(true); })}
                                        onView={setSelectedTree}
                                    />
                                ))
                             )}
                        </div>
                    )
                ) : tab === 'visions' ? (
                    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                        {filteredData.length === 0 && !loadingMore ? <p className="col-span-full text-center text-slate-400 py-10">No visions found.</p> : 
                            filteredData.map((item: any) => (
                                <div key={item.id} onClick={() => setSelectedVision(item)} className="cursor-pointer">
                                    <VisionCard vision={item} />
                                </div>
                            ))
                        }
                    </div>
                ) : tab !== 'matches' && tab !== 'profile' && tab !== 'oracle' && (
                    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                        {data.map((item) => (
                             <PulseCard key={item.id} pulse={item} lightseed={lightseed} onMatch={(p: Pulse) => { setMatchCandidate(p); setShowPulseModal(true); }} />
                        ))}
                    </div>
                )}

                {loadingMore && <div className="text-center py-4 text-emerald-300 text-sm animate-pulse">Growing root network...</div>}
            </main>
        );
    }

    return (
        <div className="min-h-screen relative font-sans text-slate-800">
            {/* Fixed Background */}
            <div className="fixed inset-0 z-[-1]" style={backgroundStyle}></div>
            {/* Overlay to increase opacity (whiten) the background - REMOVED PER REQUEST */}
            
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
                pendingMatchesCount={matches.length}
                myTreesCount={myTrees.length}
            />
            
            {renderMainContent()}

            {/* Modals & Overlays - Rendered at top level to ensure they appear even in Profile view */}
            {selectedTree && (
                <DetailWrapper>
                    <LifetreeDetail 
                        tree={selectedTree} 
                        onClose={() => setSelectedTree(null)} 
                        onPlayGrowth={setShowGrowthPlayer}
                        onValidate={(id: string) => validateLifetree(id, activeTree!.id).then(() => { alert("Validated!"); setSelectedTree(null); loadContent(true); })}
                        myActiveTree={activeTree}
                        currentUserId={lightseed?.uid}
                    />
                    {showGrowthPlayer && <GrowthPlayerModal treeId={showGrowthPlayer} onClose={() => setShowGrowthPlayer(null)} />}
                </DetailWrapper>
            )}

            {selectedVision && (
                <DetailWrapper>
                    <VisionDetail vision={selectedVision} onClose={() => setSelectedVision(null)} />
                </DetailWrapper>
            )}

            {/* Growth Player Modal (Standalone) */}
            {showGrowthPlayer && !selectedTree && <GrowthPlayerModal treeId={showGrowthPlayer} onClose={() => setShowGrowthPlayer(null)} />}

            {/* Plant Modal (Simplified) */}
            {showPlantModal && (
                <Modal title={t('plant_lifetree')} onClose={() => setShowPlantModal(false)}>
                    <form onSubmit={handlePlant} className="space-y-4">
                        <ImagePicker onChange={(e: any) => handleImageUpload(e.target.files[0], `trees/${Date.now()}`).then(setTreeImageUrl)} previewUrl={treeImageUrl} loading={uploading} />
                        <input className="block w-full border p-2 rounded" placeholder={`Tree Name (Default: ${lightseed?.displayName || 'Anonymous'})`} value={treeName} onChange={e=>setTreeName(e.target.value)} />
                        <input className="block w-full border p-2 rounded" placeholder={t('short_title')} value={treeShortTitle} onChange={e=>setTreeShortTitle(e.target.value)} />
                        <div className="flex gap-2"><input className="flex-1 border p-2 rounded" placeholder="Seed keywords" value={treeSeed} onChange={e=>setTreeSeed(e.target.value)} /><button type="button" onClick={() => generateLifetreeBio(treeSeed).then(setTreeBio)} disabled={uploading} className="bg-emerald-600 text-white px-4 rounded disabled:opacity-50">AI</button></div>
                        <textarea className="block w-full border p-2 rounded" placeholder="Vision" value={treeBio} onChange={e=>setTreeBio(e.target.value)} required />
                        <button type="submit" disabled={uploading || isSubmitting} className="w-full bg-emerald-600 text-white py-2 rounded disabled:opacity-50">
                            {isSubmitting ? 'Planting...' : 'Plant'}
                        </button>
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
                                 <button type="button" onClick={handleGenerateVisionImage} disabled={uploading} className="text-sm bg-amber-500 text-white px-3 py-1 rounded hover:bg-amber-600 disabled:opacity-50">{t('generate_image')}</button>
                             </div>
                         </div>

                        <input className="block w-full border p-2 rounded" placeholder={t('title')} value={visionTitle} onChange={e=>setVisionTitle(e.target.value)} required />
                        <textarea className="block w-full border p-2 rounded h-24" placeholder={t('body')} value={visionBody} onChange={e=>setVisionBody(e.target.value)} required />
                        <input className="block w-full border p-2 rounded" placeholder={t('webpage')} value={visionLink} onChange={e=>setVisionLink(e.target.value)} />
                        
                        <button type="submit" disabled={uploading || isSubmitting} className="w-full bg-amber-500 text-white py-2 rounded font-bold hover:bg-amber-600 transition-colors disabled:opacity-50">
                             {isSubmitting ? 'Creating...' : t('create_vision')}
                        </button>
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
                        <button type="submit" disabled={uploading || isSubmitting} className="w-full bg-emerald-600 text-white py-2 rounded disabled:opacity-50">
                            {isSubmitting ? 'Processing...' : (matchCandidate ? "Send Request" : t('mint'))}
                        </button>
                    </form>
                </Modal>
            )}
        </div>
    );
};

const App = () => {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
};

export default App;