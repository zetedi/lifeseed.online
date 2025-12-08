
import React, { useState, useEffect, FormEvent, useRef, ChangeEvent } from 'react';
import {
  signInWithGoogle,
  logout,
  fetchPulses,
  mintPulse,
  lovePulse,
  isPulseLoved,
  onAuthChange,
  fetchLifetrees,
  plantLifetree,
  getMyLifetrees,
  uploadImage,
  validateLifetree,
  proposeMatch,
  getPendingMatches,
  acceptMatch,
  fetchGrowthPulses
} from './services/firebase';
import { generateLifetreeBio } from './services/gemini';
import { type Lightseed, type Pulse, type Lifetree, type MatchProposal } from './types';
import Logo from './components/Logo';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { type Language } from './utils/translations';

// --- THEME ---
const colors = {
  sky: "bg-slate-800", 
  earth: "bg-[#92400E]", 
  grass: "bg-[#65A30D]",
  snow: "bg-[#F8FAFC]",
};

// --- ANIMATIONS ---
const PulsatingDot = () => (
    <span className="relative flex h-3 w-3 mr-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
    </span>
);

const Icons = {
  Heart: ({ filled }: { filled: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={filled ? "#EF4444" : "none"} stroke="currentColor" strokeWidth="2" className={`w-5 h-5 ${filled ? 'text-red-500' : 'text-slate-400'}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  ),
  Hash: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-slate-400"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5" /></svg>,
  Loc: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>,
  Menu: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>,
  Close: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
  Map: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" /></svg>,
  List: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>,
  Camera: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" /></svg>,
  ShieldCheck: () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-emerald-500"><path fillRule="evenodd" d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 00.374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 00-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08zm3.094 8.016a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>,
  Play: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" /></svg>,
  Link: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
};

const useLifeseed = () => {
    const [lightseed, setLightseed] = useState<Lightseed | null>(null);
    const [myTrees, setMyTrees] = useState<Lifetree[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthChange(async (user) => {
            if (user) {
                setLightseed({ 
                    uid: user.uid, 
                    email: user.email, 
                    displayName: user.displayName,
                    photoURL: user.photoURL 
                });
                const trees = await getMyLifetrees(user.uid);
                setMyTrees(trees);
            } else {
                setLightseed(null);
                setMyTrees([]);
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const refreshTrees = async () => {
        if (lightseed) {
            const trees = await getMyLifetrees(lightseed.uid);
            setMyTrees(trees);
        }
    }
    const activeTree = myTrees.length > 0 ? myTrees[0] : null;
    return { lightseed, myTrees, activeTree, loading, refreshTrees };
};

const Navigation = ({ lightseed, activeTab, setTab, onPlant, onPulse, onLogin, onLogout }: any) => {
    const { t, language, setLanguage } = useLanguage();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <nav className={`sticky top-0 z-30 ${colors.sky} text-white shadow-lg backdrop-blur-md bg-opacity-95`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-20 items-center">
                    <div className="flex items-center space-x-3 cursor-pointer rtl:space-x-reverse" onClick={() => setTab('forest')}>
                        <div className="bg-white p-1 rounded-full shadow-inner animate-[pulse_3s_ease-in-out_infinite]">
                             <Logo width={40} height={40} />
                        </div>
                        <span className="font-light text-2xl tracking-wide lowercase hidden sm:block">lifeseed</span>
                    </div>

                    <div className="hidden md:flex space-x-6 rtl:space-x-reverse">
                        {['forest', 'pulses', 'matches'].map((tabKey) => (
                            <button 
                                key={tabKey}
                                onClick={() => setTab(tabKey)}
                                className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 ${activeTab === tabKey ? 'bg-white/10 text-white shadow-inner' : 'text-slate-300 hover:text-white'}`}
                            >
                                {tabKey === 'matches' ? 'Matches' : t(tabKey as any)}
                            </button>
                        ))}
                    </div>

                    <div className="hidden md:flex items-center space-x-4 rtl:space-x-reverse">
                         <select 
                            value={language} 
                            onChange={(e) => setLanguage(e.target.value as Language)}
                            className="bg-slate-700 text-white text-xs rounded border-none py-1 pl-2 pr-6 cursor-pointer"
                        >
                            <option value="en">EN</option>
                            <option value="es">ES</option>
                            <option value="hu">HU</option>
                            <option value="qu">QU</option>
                            <option value="sa">SA</option>
                            <option value="ja">JA</option>
                            <option value="ar">AR</option>
                        </select>

                        {lightseed ? (
                            <>
                                <button onClick={onPulse} className={`hidden sm:flex ${colors.earth} hover:bg-[#78350f] text-white px-5 py-2 rounded-full text-sm font-medium shadow-md transition-transform active:scale-95 items-center`}>
                                    <PulsatingDot />
                                    {t('emit_pulse')}
                                </button>
                                <img src={lightseed.photoURL || `https://ui-avatars.com/api/?name=${lightseed.displayName}`} className="w-9 h-9 rounded-full border-2 border-slate-400" alt="Seed" />
                                <button onClick={onLogout} className="text-slate-300 hover:text-white text-sm">{t('sign_out')}</button>
                            </>
                        ) : (
                            <button onClick={onLogin} className={`flex items-center space-x-2 rtl:space-x-reverse bg-white text-slate-900 px-5 py-2 rounded-full text-sm font-bold shadow-md hover:bg-slate-100 transition-colors`}>
                                <span>{t('sign_in')}</span>
                            </button>
                        )}
                    </div>

                    <div className="flex md:hidden items-center space-x-4 rtl:space-x-reverse">
                        <select 
                            value={language} 
                            onChange={(e) => setLanguage(e.target.value as Language)}
                            className="bg-slate-700 text-white text-xs rounded border-none py-1 pl-1 pr-1 cursor-pointer w-12"
                        >
                            <option value="en">EN</option>
                            <option value="es">ES</option>
                            <option value="hu">HU</option>
                        </select>
                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-white p-2">
                            {isMenuOpen ? <Icons.Close /> : <Icons.Menu />}
                        </button>
                    </div>
                </div>
            </div>

            {isMenuOpen && (
                 <div className="md:hidden bg-slate-800 border-t border-slate-700 pb-4 px-4">
                    <div className="flex flex-col space-y-2 mt-4">
                        {['forest', 'pulses', 'matches'].map((tabKey) => (
                            <button 
                                key={tabKey}
                                onClick={() => { setTab(tabKey); setIsMenuOpen(false); }}
                                className={`text-left px-3 py-3 rounded-md text-base font-medium ${activeTab === tabKey ? 'bg-white/10 text-white' : 'text-slate-300'}`}
                            >
                                {tabKey === 'matches' ? 'Matches' : t(tabKey as any)}
                            </button>
                        ))}
                         {lightseed ? (
                            <>
                                <button onClick={() => { onPulse(); setIsMenuOpen(false); }} className={`${colors.earth} text-white px-3 py-3 rounded-md text-base font-medium mt-4 flex items-center`}>
                                    <PulsatingDot />
                                    {t('emit_pulse')}
                                </button>
                                <button onClick={onLogout} className="text-left px-3 py-3 text-slate-400">
                                    {t('sign_out')}
                                </button>
                            </>
                        ) : (
                             <button onClick={() => { onLogin(); setIsMenuOpen(false); }} className="bg-white text-slate-900 px-3 py-3 rounded-md text-base font-bold mt-4">
                                {t('sign_in')}
                            </button>
                        )}
                    </div>
                 </div>
            )}
        </nav>
    );
};

const ForestMap = ({ trees }: { trees: Lifetree[] }) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);

    useEffect(() => {
        if (!mapContainer.current) return;
        const L = (window as any).L;
        if (!L) return;

        if (!mapInstance.current) {
            mapInstance.current = L.map(mapContainer.current).setView([20, 0], 2);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(mapInstance.current);
        }

        // Clear existing layers
        mapInstance.current.eachLayer((layer: any) => {
            if (layer instanceof L.Marker) {
                mapInstance.current.removeLayer(layer);
            }
        });

        trees.forEach(tree => {
            if (tree.latitude && tree.longitude) {
                const iconHtml = `
                    <div class="relative w-12 h-12">
                        <div class="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20"></div>
                        <div class="relative w-12 h-12 rounded-full border-2 border-white shadow-lg overflow-hidden bg-white">
                            <img src="${tree.imageUrl || 'https://via.placeholder.com/150'}" class="w-full h-full object-cover" />
                        </div>
                    </div>
                `;
                
                const customIcon = L.divIcon({
                    html: iconHtml,
                    className: '',
                    iconSize: [48, 48],
                    iconAnchor: [24, 24]
                });

                L.marker([tree.latitude, tree.longitude], { icon: customIcon })
                    .addTo(mapInstance.current)
                    .bindPopup(`
                        <div class="text-center">
                            <h3 class="font-bold text-lg">${tree.name}</h3>
                            <p class="text-sm text-gray-600">${tree.body.substring(0, 50)}...</p>
                        </div>
                    `);
            }
        });
    }, [trees]);
    return <div ref={mapContainer} className="w-full h-[600px] rounded-xl shadow-inner border border-slate-200 z-0" />;
};

const LifetreeCard = ({ tree, myActiveTree, onValidate, onProposeMatch, onPlayGrowth }: any) => {
    const { t } = useLanguage();
    
    return (
        <div className={`bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 hover:shadow-xl transition-all duration-500 group relative ${tree.validated ? 'ring-1 ring-emerald-100' : ''}`}>
             <div className="absolute top-3 right-3 z-10 flex space-x-2">
                {tree.validated && (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-1 rounded-full font-bold flex items-center shadow-sm">
                        <Icons.ShieldCheck />
                        <span className="ml-1">{t('validated')}</span>
                    </span>
                )}
            </div>

            <div className="relative h-56 bg-slate-200 overflow-hidden">
                {tree.imageUrl ? (
                    <img src={tree.imageUrl} alt={tree.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[3s] animate-[pulse_4s_ease-in-out_infinite]" />
                ) : (
                    <div className={`w-full h-full ${colors.sky} flex items-center justify-center`}>
                        <Logo width={80} height={80} className="opacity-20 text-white animate-pulse" />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent"></div>
                <div className="absolute bottom-4 left-4 right-4 text-white">
                    <h3 className="text-2xl font-light tracking-wide truncate">{tree.name}</h3>
                    <div className="flex items-center text-xs text-slate-300 mt-1 space-x-2 rtl:space-x-reverse">
                         <span className="px-2 py-0.5 border border-slate-500 rounded-full text-[10px] bg-slate-800/50 backdrop-blur">
                            H: {tree.blockHeight || 0}
                        </span>
                    </div>
                </div>
            </div>
            <div className="p-6">
                <p className="text-slate-600 font-light italic leading-relaxed border-l-4 border-emerald-500 pl-4 rtl:border-l-0 rtl:border-r-4 rtl:pl-0 rtl:pr-4">
                    "{tree.body}"
                </p>
                <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap gap-2 justify-between items-center">
                    <button onClick={() => onPlayGrowth(tree.id)} className="flex items-center space-x-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded transition-colors">
                        <Icons.Play />
                        <span>Growth</span>
                    </button>
                    
                    <div className="flex space-x-2">
                        {myActiveTree && myActiveTree.validated && !tree.validated && myActiveTree.id !== tree.id && (
                            <button onClick={() => onValidate(tree.id)} className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded hover:bg-emerald-200 transition-colors">
                                {t('validate_action')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const GrowthPlayerModal = ({ treeId, onClose }: { treeId: string, onClose: () => void }) => {
    const [images, setImages] = useState<Pulse[]>([]);
    const [index, setIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchGrowthPulses(treeId).then(data => {
            setImages(data.filter(p => p.imageUrl));
            setLoading(false);
        });
    }, [treeId]);

    useEffect(() => {
        if (images.length > 1) {
            const timer = setInterval(() => setIndex(i => (i + 1) % images.length), 1000);
            return () => clearInterval(timer);
        }
    }, [images]);

    return (
        <Modal title="Growth Evolution" onClose={onClose}>
            {loading ? <div className="p-10 text-center">Loading Growth...</div> : (
                images.length === 0 ? <div className="p-10 text-center">No growth pictures recorded yet.</div> :
                <div className="flex flex-col items-center">
                    <img src={images[index].imageUrl} className="w-full h-64 object-cover rounded-lg shadow-lg mb-4" />
                    <p className="text-center font-bold">{images[index].title}</p>
                    <p className="text-xs text-slate-500">{new Date(images[index].createdAt?.toMillis()).toLocaleDateString()}</p>
                    <div className="mt-4 flex gap-1">
                        {images.map((_, i) => <div key={i} className={`h-1 w-4 rounded ${i === index ? 'bg-emerald-500' : 'bg-slate-200'}`} />)}
                    </div>
                </div>
            )}
        </Modal>
    );
};

const PulseCard = ({ pulse, lightseed, onMatch }: any) => {
    const { t } = useLanguage();
    const [loved, setLoved] = useState(false);
    const [count, setCount] = useState(pulse.loveCount);

    useEffect(() => {
        if (lightseed) isPulseLoved(pulse.id, lightseed.uid).then(setLoved);
    }, [pulse, lightseed]);

    const handleLove = async () => {
        if (!lightseed) return;
        const newStatus = !loved;
        setLoved(newStatus);
        setCount(c => newStatus ? c + 1 : c - 1);
        await lovePulse(pulse.id, lightseed.uid);
    }

    return (
        <div className={`bg-white rounded-xl shadow-sm border border-slate-100 p-0 overflow-hidden hover:shadow-md transition-shadow ${pulse.type === 'GROWTH' ? 'ring-2 ring-emerald-500 ring-opacity-20' : ''}`}>
            <div className="bg-slate-50 px-5 py-2 border-b border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-mono">
                <div className="flex items-center space-x-2">
                    {pulse.type === 'GROWTH' && <span className="bg-emerald-100 text-emerald-600 px-1 rounded font-bold">GROWTH</span>}
                    {pulse.isMatch && <span className="bg-sky-100 text-sky-600 px-1 rounded font-bold">MATCH</span>}
                    <span>BLOCK: {pulse.hash?.substring(0, 8)}</span>
                </div>
            </div>

            {pulse.imageUrl && (
                <div className="w-full h-64 overflow-hidden bg-slate-100">
                    <img src={pulse.imageUrl} alt={pulse.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                </div>
            )}

            <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-slate-400">{pulse.authorName}</p>
                    {lightseed && lightseed.uid !== pulse.authorId && !pulse.isMatch && (
                        <button onClick={() => onMatch(pulse)} className="text-xs bg-slate-100 hover:bg-sky-100 text-slate-500 hover:text-sky-600 px-2 py-1 rounded flex items-center">
                            <Icons.Link /> <span className="ml-1">Match</span>
                        </button>
                    )}
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">{pulse.title}</h3>
                <p className="text-slate-600 leading-relaxed font-light">{pulse.body}</p>
                <div className="mt-4 flex items-center space-x-6">
                    <button onClick={handleLove} disabled={!lightseed} className="flex items-center space-x-1.5 group">
                        <Icons.Heart filled={loved} />
                        <span className={`text-sm ${loved ? 'text-red-500' : 'text-slate-400'}`}>{count}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

// ... Modals (ImagePicker, etc) ... 
const Modal = ({ children, onClose, title }: any) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-semibold text-slate-800">{title}</h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
        </div>
    </div>
);
const ImagePicker = ({ onChange, previewUrl, loading }: any) => {
    const fileInput = useRef<HTMLInputElement>(null);
    return (
        <div className="space-y-2">
             <div onClick={() => fileInput.current?.click()} className={`border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-slate-50 transition-colors h-40 ${previewUrl ? 'border-none p-0' : ''}`}>
                <input type="file" ref={fileInput} className="hidden" accept="image/*" onChange={onChange} />
                {loading ? <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div> : previewUrl ? <img src={previewUrl} className="w-full h-full object-cover rounded-xl" /> : <div className="text-center text-slate-400"><Icons.Camera /><span className="text-xs mt-2 block">Upload Photo</span></div>}
             </div>
        </div>
    );
};

const AppContent = () => {
    const { t } = useLanguage();
    const { lightseed, myTrees, activeTree, loading: authLoading, refreshTrees } = useLifeseed();
    const [tab, setTab] = useState('forest');
    const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
    const [data, setData] = useState<any[]>([]);
    const [matches, setMatches] = useState<MatchProposal[]>([]);
    
    // UI State
    const [showPlantModal, setShowPlantModal] = useState(false);
    const [showPulseModal, setShowPulseModal] = useState(false);
    const [showGrowthPlayer, setShowGrowthPlayer] = useState<string | null>(null);
    const [matchCandidate, setMatchCandidate] = useState<Pulse | null>(null);

    // Form State
    const [treeName, setTreeName] = useState('');
    const [treeSeed, setTreeSeed] = useState('');
    const [treeBio, setTreeBio] = useState('');
    const [treeImage, setTreeImage] = useState<File | null>(null);
    const [treeImageUrl, setTreeImageUrl] = useState('');
    
    const [pulseTitle, setPulseTitle] = useState('');
    const [pulseBody, setPulseBody] = useState('');
    const [pulseImageUrl, setPulseImageUrl] = useState('');
    const [isGrowth, setIsGrowth] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => { loadContent(); }, [tab, lightseed]);
    useEffect(() => { if (lightseed && myTrees.length === 0 && !authLoading) setShowPlantModal(true); }, [lightseed, myTrees]);

    const loadContent = async () => {
        if (tab === 'forest') setData(await fetchLifetrees());
        else if (tab === 'pulses') setData(await fetchPulses());
        else if (tab === 'matches' && lightseed) setMatches(await getPendingMatches(lightseed.uid));
    };

    const handleImageUpload = async (file: File, path: string) => {
        setUploading(true);
        const url = await uploadImage(file, path);
        setUploading(false);
        return url;
    };

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
        try {
            await mintPulse({
                lifetreeId: activeTree.id,
                type: isGrowth ? 'GROWTH' : 'STANDARD',
                title: pulseTitle,
                body: pulseBody,
                imageUrl: pulseImageUrl,
                authorId: lightseed.uid,
                authorName: lightseed.displayName || "Soul",
                authorPhoto: lightseed.photoURL || undefined,
            });
            setShowPulseModal(false); setPulseTitle(''); setPulseBody(''); setPulseImageUrl(''); setIsGrowth(false); loadContent();
        } catch(e: any) { alert(e.message); }
    };
    
    const initiateMatch = async (e: FormEvent) => {
        e.preventDefault();
        if (!lightseed || !activeTree || !matchCandidate) return;
        try {
             // Find matching pulse of my own to link (simplified: using current form as the "Response Pulse")
             // Actually, handshake implies I select MY pulse and THEIR pulse.
             // For UI simplicity: I create a new "Response Pulse" right here to match theirs.
             
             // 1. Create my side of the pulse first (mint it)
             const myPulseId = `temp_${Date.now()}`; // In real app, mint it first. 
             // To keep it simple: We just Propose. Real implementation needs a pulse ID selector.
             // Let's assume user is picking their "Active Tree" as the source entity.
             
             await proposeMatch({
                 initiatorPulseId: "PENDING_CREATION", // Simplified: just linking trees for now in UI logic
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

    if (authLoading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50"><Logo className="animate-pulse" /></div>;

    return (
        <div className={`min-h-screen ${colors.snow} font-sans text-slate-800`}>
            <Navigation lightseed={lightseed} activeTab={tab} setTab={setTab} onLogin={signInWithGoogle} onLogout={logout} onPlant={() => setShowPlantModal(true)} onPulse={() => setShowPulseModal(true)} />
            
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                {/* Forest View Toggle */}
                {tab === 'forest' && (
                    <div className="flex justify-end mb-6">
                        <div className="bg-white p-1 rounded-lg border border-slate-200 flex shadow-sm">
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

                {/* Content Area */}
                {tab === 'forest' ? (
                    viewMode === 'map' ? (
                        <ForestMap trees={data} />
                    ) : (
                        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                             {data.map((item) => (
                                <LifetreeCard key={item.id} tree={item} myActiveTree={activeTree} onPlayGrowth={setShowGrowthPlayer} />
                             ))}
                        </div>
                    )
                ) : tab !== 'matches' && (
                    <div className="grid gap-8 max-w-3xl mx-auto">
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
