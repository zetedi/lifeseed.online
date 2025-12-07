import React, { useState, useEffect, FormEvent } from 'react';
import {
  signInWithGoogle,
  logout,
  fetchPresents,
  createPresent,
  lovePresent,
  isPresentLoved,
  onAuthChange,
  fetchLifetrees,
  plantLifetree,
  getMyLifetree
} from './services/firebase';
import { generateLifetreeBio } from './services/gemini';
import { type Lightseed, type Present, type Lifetree } from './types';
import Logo from './components/Logo';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { type Language } from './utils/translations';

// --- THEME UTILS ---
const colors = {
  sky: "bg-slate-800", 
  earth: "bg-[#92400E]", 
  grass: "bg-[#65A30D]",
  snow: "bg-[#F8FAFC]",
};

// --- ICONS ---
const Icons = {
  Heart: ({ filled }: { filled: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={filled ? "#EF4444" : "none"} stroke="currentColor" strokeWidth="2" className={`w-5 h-5 ${filled ? 'text-red-500' : 'text-slate-400'}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  ),
  Hash: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-slate-400">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5" />
    </svg>
  ),
  Loc: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  ),
  Menu: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  ),
  Close: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
};

const useLifeseed = () => {
    const [lightseed, setLightseed] = useState<Lightseed | null>(null);
    const [lifetree, setLifetree] = useState<Lifetree | null>(null);
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
                const tree = await getMyLifetree(user.uid);
                setLifetree(tree);
            } else {
                setLightseed(null);
                setLifetree(null);
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const refreshTree = async () => {
        if (lightseed) {
            const tree = await getMyLifetree(lightseed.uid);
            setLifetree(tree);
        }
    }

    return { lightseed, lifetree, loading, refreshTree };
};

const Navigation = ({ lightseed, activeTab, setTab, onPlant, onPost, onLogin, onLogout }: any) => {
    const { t, language, setLanguage, isRTL } = useLanguage();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <nav className={`sticky top-0 z-30 ${colors.sky} text-white shadow-lg backdrop-blur-md bg-opacity-95`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-20 items-center">
                    {/* Brand */}
                    <div className="flex items-center space-x-3 cursor-pointer rtl:space-x-reverse" onClick={() => setTab('forest')}>
                        <div className="bg-white p-1 rounded-full shadow-inner">
                             <Logo width={40} height={40} />
                        </div>
                        <span className="font-light text-2xl tracking-wide lowercase hidden sm:block">lifeseed</span>
                    </div>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex space-x-6 rtl:space-x-reverse">
                        {['forest', 'posts', 'offerings'].map((tabKey) => (
                            <button 
                                key={tabKey}
                                onClick={() => setTab(tabKey)}
                                className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 ${activeTab === tabKey ? 'bg-white/10 text-white shadow-inner' : 'text-slate-300 hover:text-white'}`}
                            >
                                {t(tabKey as any)}
                            </button>
                        ))}
                    </div>

                    {/* Right Side: Auth & Lang */}
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
                                <button onClick={onPost} className={`hidden sm:flex ${colors.earth} hover:bg-[#78350f] text-white px-5 py-2 rounded-full text-sm font-medium shadow-md transition-transform active:scale-95`}>
                                    {t('create_present')}
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

                    {/* Mobile Hamburger */}
                    <div className="flex md:hidden items-center space-x-4 rtl:space-x-reverse">
                        <select 
                            value={language} 
                            onChange={(e) => setLanguage(e.target.value as Language)}
                            className="bg-slate-700 text-white text-xs rounded border-none py-1 pl-1 pr-1 cursor-pointer w-12"
                        >
                            <option value="en">EN</option>
                            <option value="es">ES</option>
                            <option value="hu">HU</option>
                            <option value="qu">QU</option>
                            <option value="sa">SA</option>
                            <option value="ja">JA</option>
                            <option value="ar">AR</option>
                        </select>
                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-white p-2">
                            {isMenuOpen ? <Icons.Close /> : <Icons.Menu />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu Dropdown */}
            {isMenuOpen && (
                 <div className="md:hidden bg-slate-800 border-t border-slate-700 pb-4 px-4">
                    <div className="flex flex-col space-y-2 mt-4">
                        {['forest', 'posts', 'offerings'].map((tabKey) => (
                            <button 
                                key={tabKey}
                                onClick={() => { setTab(tabKey); setIsMenuOpen(false); }}
                                className={`text-left px-3 py-3 rounded-md text-base font-medium ${activeTab === tabKey ? 'bg-white/10 text-white' : 'text-slate-300'}`}
                            >
                                {t(tabKey as any)}
                            </button>
                        ))}
                         {lightseed ? (
                            <>
                                <button onClick={() => { onPost(); setIsMenuOpen(false); }} className={`${colors.earth} text-white px-3 py-3 rounded-md text-base font-medium mt-4`}>
                                    {t('create_present')}
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

const LifetreeCard = ({ tree }: { tree: Lifetree }) => {
    const { t } = useLanguage();
    return (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 hover:shadow-xl transition-all duration-500 group">
            <div className="relative h-56 bg-slate-200 overflow-hidden">
                {tree.imageUrl ? (
                    <img src={tree.imageUrl} alt={tree.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                ) : (
                    <div className={`w-full h-full ${colors.sky} flex items-center justify-center`}>
                        <Logo width={80} height={80} className="opacity-20 text-white" />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent"></div>
                <div className="absolute bottom-4 left-4 right-4 text-white">
                    <h3 className="text-2xl font-light tracking-wide truncate">{tree.name}</h3>
                    <div className="flex items-center text-xs text-slate-300 mt-1 space-x-2 rtl:space-x-reverse">
                        {tree.locationName && <span className="flex items-center"><Icons.Loc /> <span className="ml-1 rtl:mr-1">{tree.locationName}</span></span>}
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
                <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400">{t('latest_hash')}</span>
                        <span className="text-[10px] font-mono text-slate-500 truncate w-32 bg-slate-50 p-1 rounded">{tree.latestHash?.substring(0, 16)}...</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-700">
                        <Logo width={16} height={16} />
                    </div>
                </div>
            </div>
        </div>
    );
};

const PresentCard = ({ present, lightseed }: { present: Present, lightseed: Lightseed | null }) => {
    const { t } = useLanguage();
    const [loved, setLoved] = useState(false);
    const [count, setCount] = useState(present.loveCount);

    useEffect(() => {
        if (lightseed) isPresentLoved(present.id, lightseed.uid).then(setLoved);
    }, [present, lightseed]);

    const handleLove = async () => {
        if (!lightseed) return;
        const newStatus = !loved;
        setLoved(newStatus);
        setCount(c => newStatus ? c + 1 : c - 1);
        await lovePresent(present.id, lightseed.uid);
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-0 overflow-hidden hover:shadow-md transition-shadow">
            <div className="bg-slate-50 px-5 py-2 border-b border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-mono">
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <Icons.Hash />
                    <span>{t('prev')}: {present.previousHash?.substring(0, 12)}...</span>
                </div>
                <span>{t('block')}: {present.hash?.substring(0, 8)}</span>
            </div>

            <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3 rtl:space-x-reverse">
                        <img src={present.authorPhoto || `https://ui-avatars.com/api/?name=${present.authorName}`} className="w-8 h-8 rounded-full bg-slate-200" alt="" />
                        <div>
                            <p className="text-sm font-semibold text-slate-800">{present.authorName}</p>
                            <p className="text-xs text-slate-400">{present.createdAt?.toDate().toLocaleDateString()}</p>
                        </div>
                    </div>
                    {present.type === 'OFFER' && (
                        <div className={`${colors.grass} text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm`}>
                            {present.price} ETH-L
                        </div>
                    )}
                </div>

                <h3 className="text-lg font-bold text-slate-800 mb-2">{present.title}</h3>
                <p className="text-slate-600 leading-relaxed font-light">{present.body}</p>

                <div className="mt-6 flex items-center space-x-6 rtl:space-x-reverse">
                    <button onClick={handleLove} disabled={!lightseed} className="flex items-center space-x-1.5 rtl:space-x-reverse group">
                        <Icons.Heart filled={loved} />
                        <span className={`text-sm ${loved ? 'text-red-500' : 'text-slate-400'} group-hover:text-red-500`}>{count}</span>
                    </button>
                    <button className="flex items-center space-x-1.5 rtl:space-x-reverse text-slate-400 hover:text-slate-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                        <span className="text-sm">{present.commentCount}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

const Modal = ({ children, onClose, title }: any) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-semibold text-slate-800">{title}</h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            <div className="p-6">
                {children}
            </div>
        </div>
    </div>
);

const AppContent = () => {
    const { t } = useLanguage();
    const { lightseed, lifetree, loading: authLoading, refreshTree } = useLifeseed();
    const [tab, setTab] = useState('forest');
    const [data, setData] = useState<any[]>([]);
    const [loadingData, setLoadingData] = useState(false);
    
    // Modals
    const [showPlantModal, setShowPlantModal] = useState(false);
    const [showPresentModal, setShowPresentModal] = useState(false);

    // Form States
    const [treeName, setTreeName] = useState('');
    const [treeSeed, setTreeSeed] = useState('');
    const [treeBio, setTreeBio] = useState('');
    const [presentTitle, setPresentTitle] = useState('');
    const [presentBody, setPresentBody] = useState('');
    const [presentPrice, setPresentPrice] = useState('');
    const [isPlanting, setIsPlanting] = useState(false);

    useEffect(() => {
        loadContent();
    }, [tab]);

    useEffect(() => {
        if (lightseed && !lifetree && !authLoading) {
            setShowPlantModal(true);
        }
    }, [lightseed, lifetree, authLoading]);

    const loadContent = async () => {
        setLoadingData(true);
        try {
            if (tab === 'forest') setData(await fetchLifetrees());
            else if (tab === 'posts') setData(await fetchPresents('POST'));
            else if (tab === 'offerings') setData(await fetchPresents('OFFER'));
        } catch(e) { console.error(e) }
        setLoadingData(false);
    };

    const handleGoogleLogin = async () => {
        try { await signInWithGoogle(); } catch(e) { alert(t('login_failed')); }
    };

    const handlePlant = async (e: FormEvent) => {
        e.preventDefault();
        if (!lightseed) return;
        setIsPlanting(true);
        
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(async (position) => {
                try {
                    await plantLifetree({
                        ownerId: lightseed.uid,
                        name: treeName,
                        body: treeBio,
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        locName: "Earth" 
                    });
                    await refreshTree();
                    setShowPlantModal(false);
                    loadContent();
                } catch(err) { alert(err); }
                setIsPlanting(false);
            }, (err) => {
                alert(t('geo_error'));
                setIsPlanting(false);
            });
        } else {
             alert(t('geo_error'));
             setIsPlanting(false);
        }
    };

    const handleCreatePresent = async (e: FormEvent) => {
        e.preventDefault();
        if (!lightseed || !lifetree) return;
        try {
            await createPresent({
                lifetreeId: lifetree.id,
                title: presentTitle,
                body: presentBody,
                authorId: lightseed.uid,
                authorName: lightseed.displayName || "Soul",
                authorPhoto: lightseed.photoURL || undefined,
                type: tab === 'offerings' ? 'OFFER' : 'POST',
                price: presentPrice ? Number(presentPrice) : undefined
            });
            setShowPresentModal(false);
            setPresentBody(''); setPresentTitle(''); setPresentPrice('');
            loadContent();
        } catch(err) { alert(err); }
    };

    const generateBio = async () => {
        if (!treeSeed) return;
        const bio = await generateLifetreeBio(treeSeed);
        setTreeBio(bio);
    }

    if (authLoading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50"><Logo className="animate-pulse" /></div>;

    return (
        <div className={`min-h-screen ${colors.snow} font-sans text-slate-800`}>
            <Navigation 
                lightseed={lightseed} 
                activeTab={tab} 
                setTab={setTab} 
                onLogin={handleGoogleLogin} 
                onLogout={logout} 
                onPlant={() => setShowPlantModal(true)}
                onPost={() => setShowPresentModal(true)}
            />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="mb-8">
                    <h1 className="text-4xl font-light text-slate-800 mb-2 capitalize tracking-tight">{t(tab as any)}</h1>
                    <div className="h-1 w-20 bg-emerald-500 rounded-full"></div>
                </div>

                {loadingData ? (
                    <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>
                ) : (
                    <div className={`grid gap-8 ${tab === 'forest' ? 'sm:grid-cols-2 lg:grid-cols-3' : 'max-w-3xl mx-auto'}`}>
                        {data.map((item) => (
                            tab === 'forest' 
                                ? <LifetreeCard key={item.id} tree={item as Lifetree} />
                                : <PresentCard key={item.id} present={item as Present} lightseed={lightseed} />
                        ))}
                        {data.length === 0 && (
                            <div className="col-span-full text-center py-20 text-slate-400">
                                <p className="text-xl font-light">{t('dormant')}</p>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Modals */}
            {showPlantModal && (
                <Modal title={t('plant_lifetree')} onClose={() => lifetree && setShowPlantModal(false)}>
                    <form onSubmit={handlePlant} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">{t('tree_name')}</label>
                            <input className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2 border" placeholder="e.g. The Eternal Oak" value={treeName} onChange={e=>setTreeName(e.target.value)} required />
                        </div>
                        <div className="bg-emerald-50 p-4 rounded-md">
                            <label className="block text-sm font-medium text-emerald-800">{t('ai_prompt')}</label>
                            <div className="flex gap-2 mt-2">
                                <input className="flex-1 rounded-md border-emerald-200 shadow-sm text-sm p-2 border" placeholder="Keywords: peace, mountains, code" value={treeSeed} onChange={e=>setTreeSeed(e.target.value)} />
                                <button type="button" onClick={generateBio} className="bg-emerald-600 text-white px-4 py-2 rounded-md text-sm">{t('generate')}</button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">{t('vision')}</label>
                            <textarea className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2 border" rows={3} value={treeBio} onChange={e=>setTreeBio(e.target.value)} required />
                        </div>
                        <p className="text-xs text-slate-500 italic">{t('connect_roots')}</p>
                        <button type="submit" disabled={isPlanting} className="w-full bg-emerald-600 text-white py-2 rounded-md hover:bg-emerald-700 disabled:opacity-50">
                            {isPlanting ? t('planting') : t('plant_lifetree')}
                        </button>
                    </form>
                </Modal>
            )}

            {showPresentModal && (
                <Modal title={t('create_present')} onClose={() => setShowPresentModal(false)}>
                    <form onSubmit={handleCreatePresent} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">{t('title')}</label>
                            <input className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2 border" value={presentTitle} onChange={e=>setPresentTitle(e.target.value)} required />
                        </div>
                        {tab === 'offerings' && (
                             <div>
                                <label className="block text-sm font-medium text-slate-700">{t('price')}</label>
                                <input type="number" className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2 border" value={presentPrice} onChange={e=>setPresentPrice(e.target.value)} required />
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-slate-700">{t('body')}</label>
                            <textarea className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2 border" rows={4} value={presentBody} onChange={e=>setPresentBody(e.target.value)} required />
                        </div>
                        <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded-md hover:bg-emerald-700">{t('mint')}</button>
                    </form>
                </Modal>
            )}
        </div>
    );
};

const App = () => (
    <LanguageProvider>
        <AppContent />
    </LanguageProvider>
);

export default App;