
import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { type Language } from '../utils/translations';
import Logo from './Logo';
import { Icons, PulsatingDot } from './ui/Icons';
import { colors } from '../utils/theme';

interface NavigationProps {
    lightseed: any;
    activeTab: string;
    setTab: (tab: string) => void;
    onPlant: () => void;
    onPulse: () => void;
    onLogin: () => void;
    onLogout: () => void;
    onProfile: () => void;
    onCreateVision: () => void;
    hasApiKey: boolean;
    onCheckKey: () => void;
    pendingMatchesCount: number;
    myTreesCount: number;
    dangerTreesCount: number;
}

const LanguageSelector = ({ language, setLanguage }: { language: Language, setLanguage: (l: Language) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const options = [
        { code: 'en', label: 'English' },
        { code: 'es', label: 'Español' },
        { code: 'qu', label: 'Runasimi' },
        { code: 'ar', label: 'العربية' },
        { code: 'ja', label: '日本語' },
        { code: 'hu', label: 'Magyar' },
        { code: 'sa', label: 'संस्कृत' },
        { code: 'sw', label: 'Kiswahili' },
    ];

    return (
        <div className="relative" ref={ref}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 transition-colors group"
                title="Change Language"
            >
                <span className="text-emerald-100 group-hover:text-white transition-colors"><Icons.Globe /></span>
                <span className="font-bold text-emerald-100 group-hover:text-white uppercase text-sm transition-colors">{language}</span>
            </button>
            
            {isOpen && (
                <div className="absolute top-full mt-2 right-0 w-32 bg-emerald-800 border border-emerald-700 rounded-lg shadow-xl overflow-hidden z-50 flex flex-col py-1 animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/20">
                    {options.map((opt) => (
                        <button
                            key={opt.code}
                            onClick={() => { setLanguage(opt.code as Language); setIsOpen(false); }}
                            className={`text-left px-4 py-2 text-sm text-emerald-100 hover:bg-white/10 transition-colors font-medium ${language === opt.code ? 'bg-white/20 text-white font-bold' : ''}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export const Navigation = ({ lightseed, activeTab, setTab, onPlant, onPulse, onLogin, onLogout, onProfile, onCreateVision, hasApiKey, onCheckKey, pendingMatchesCount, myTreesCount = 0, dangerTreesCount = 0 }: NavigationProps) => {
    const { t, language, setLanguage } = useLanguage();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const moreRef = useRef<HTMLDivElement>(null);
    
    const hasNotification = pendingMatchesCount > 0 || dangerTreesCount > 0;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
                setIsMoreOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleApiKeySelect = async () => {
        const aiStudio = (window as any).aistudio;
        if (aiStudio) {
            try {
                await aiStudio.openSelectKey();
                await onCheckKey();
            } catch (e) {
                console.error("API Key selection cancelled or failed", e);
            }
        }
    }
    
    const getTabStyle = (key: string) => {
        if (activeTab === key) {
            if (key === 'visions') return `bg-amber-500 text-white shadow-lg shadow-amber-500/30`;
            if (key === 'forest') return `bg-emerald-600 text-white shadow-lg shadow-emerald-500/30`;
            if (key === 'pulses') return `bg-sky-600 text-white shadow-lg shadow-sky-500/30`;
            if (key === 'matches') return `bg-rose-600 text-white shadow-lg shadow-rose-500/30`; // distinct color for matches
            if (key === 'oracle') return `bg-indigo-600 text-white shadow-lg shadow-indigo-500/30`;
            if (key === 'about') return `bg-purple-600 text-white shadow-lg shadow-purple-500/30`;
            return `bg-slate-700 text-white`;
        }
        return `text-emerald-100 hover:text-white hover:bg-white/10`;
    }

    const mainTabs = ['forest', 'visions', 'pulses'];
    const moreTabs = ['matches', 'oracle', 'about'];

    // Desktop Tab Renderer
    const renderTab = (tabKey: string) => (
        <button 
            key={tabKey}
            onClick={() => { setTab(tabKey); setIsMoreOpen(false); }}
            className={`relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap ${getTabStyle(tabKey)}`}
        >
            {t(tabKey as any)}
            {tabKey === 'matches' && pendingMatchesCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
            )}
        </button>
    );

    return (
        <nav className={`sticky top-0 z-30 bg-emerald-900 border-b border-emerald-800 text-white shadow-md`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-20 items-center">
                    <div className="flex items-center space-x-3 cursor-pointer shrink-0 rtl:space-x-reverse" onClick={() => setTab('forest')}>
                        <div className="bg-white p-1 rounded-full shadow-inner animate-[pulse_3s_ease-in-out_infinite]">
                             <Logo width={40} height={40} />
                        </div>
                        <span className="font-light text-2xl tracking-wide lowercase block text-white drop-shadow-sm">.seed</span>
                    </div>

                    {/* Desktop Menu */}
                    {/* Removed overflow-hidden to allow dropdown to show */}
                    <div className="hidden md:flex flex-1 justify-center space-x-1 lg:space-x-3 rtl:space-x-reverse px-4">
                        {/* Always visible on md+ */}
                        {mainTabs.map(tabKey => renderTab(tabKey))}

                        {/* Visible on Large Screens Only (xl+) */}
                        <div className="hidden xl:flex space-x-3 rtl:space-x-reverse">
                            {moreTabs.map(tabKey => renderTab(tabKey))}
                        </div>

                        {/* Dropdown for Medium/Large Screens (hides overflow items until XL) */}
                        <div className="xl:hidden relative z-50" ref={moreRef}>
                            <button 
                                onClick={() => setIsMoreOpen(!isMoreOpen)}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center space-x-1 ${moreTabs.includes(activeTab) ? 'bg-white/20 text-white' : 'text-emerald-100 hover:text-white hover:bg-white/10'}`}
                            >
                                <span>{t('more')}</span>
                                <svg className={`w-4 h-4 transition-transform ${isMoreOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                {pendingMatchesCount > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                    </span>
                                )}
                            </button>
                            {isMoreOpen && (
                                <div className="absolute top-full mt-2 right-0 w-48 bg-emerald-800 rounded-xl shadow-xl border border-emerald-700 overflow-hidden py-2 flex flex-col z-50 animate-in fade-in zoom-in-95 duration-100">
                                    {moreTabs.map(tabKey => (
                                        <button
                                            key={tabKey}
                                            onClick={() => { setTab(tabKey); setIsMoreOpen(false); }}
                                            className={`text-left px-4 py-3 text-sm font-medium hover:bg-white/10 flex justify-between items-center ${activeTab === tabKey ? 'text-white bg-white/10' : 'text-emerald-100'}`}
                                        >
                                            {t(tabKey as any)}
                                            {tabKey === 'matches' && pendingMatchesCount > 0 && (
                                                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingMatchesCount}</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="hidden md:flex items-center space-x-2 lg:space-x-4 shrink-0 rtl:space-x-reverse">
                         <button 
                             onClick={handleApiKeySelect}
                             className={`p-2 rounded-full transition-all flex items-center space-x-2 ${!hasApiKey ? 'bg-amber-500/20 text-amber-500 ring-1 ring-amber-500' : 'text-emerald-100 hover:text-white hover:bg-white/10'}`}
                             title={t('connect_gemini_tooltip')}
                         >
                             <Icons.Key />
                             {!hasApiKey && <span className="text-xs font-bold hidden lg:inline">{t('connect_ai')}</span>}
                         </button>

                         <LanguageSelector language={language} setLanguage={setLanguage} />

                        {lightseed ? (
                            <>
                                {activeTab === 'forest' || myTreesCount === 0 ? (
                                     <button onClick={onPlant} className={`hidden lg:flex ${colors.grass} hover:bg-emerald-700 text-white px-5 py-2 rounded-full text-sm font-medium shadow-md transition-transform active:scale-95 items-center`}>
                                        <Icons.Tree />
                                        <span className="ml-1">{t('plant_lifetree')}</span>
                                    </button>
                                ) : activeTab === 'visions' ? (
                                     <button onClick={onCreateVision} className={`hidden lg:flex ${colors.earth} hover:bg-[#78350f] text-white px-5 py-2 rounded-full text-sm font-medium shadow-md transition-transform active:scale-95 items-center`}>
                                        {t('create_vision')}
                                    </button>
                                ) : (
                                    <button onClick={onPulse} className={`hidden lg:flex ${colors.earth} hover:bg-[#78350f] text-white px-5 py-2 rounded-full text-sm font-medium shadow-md transition-transform active:scale-95 items-center`}>
                                        <PulsatingDot />
                                        {t('emit_pulse')}
                                    </button>
                                )}
                                
                                <div className="relative cursor-pointer" onClick={onProfile}>
                                    <img 
                                        src={lightseed.photoURL || `https://ui-avatars.com/api/?name=${lightseed.displayName}`} 
                                        className="w-9 h-9 rounded-full border-2 border-emerald-700 hover:border-emerald-500 transition-colors" 
                                        alt="Seed" 
                                    />
                                    {hasNotification && (
                                        <span className="absolute top-0 right-0 flex h-3 w-3">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-emerald-900"></span>
                                        </span>
                                    )}
                                </div>
                                <button onClick={onLogout} className="text-emerald-100 hover:text-white text-sm font-medium shadow-sm">{t('sign_out')}</button>
                            </>
                        ) : (
                            <button onClick={onLogin} className={`flex items-center space-x-2 rtl:space-x-reverse bg-white text-slate-900 px-5 py-2 rounded-full text-sm font-bold shadow-md hover:bg-slate-100 transition-colors`}>
                                <span>{t('sign_in')}</span>
                            </button>
                        )}
                    </div>

                    {/* Mobile Menu Toggle */}
                    <div className="flex md:hidden items-center space-x-4 rtl:space-x-reverse">
                         <button 
                             onClick={handleApiKeySelect}
                             className={`p-1 ${!hasApiKey ? 'text-amber-500' : 'text-emerald-100'}`}
                         >
                             <Icons.Key />
                         </button>
                        
                        <LanguageSelector language={language} setLanguage={setLanguage} />

                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-white p-2 relative hover:bg-white/10 rounded">
                            {isMenuOpen ? <Icons.Close /> : <Icons.Menu />}
                            {hasNotification && !isMenuOpen && <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-emerald-900"></div>}
                        </button>
                    </div>
                </div>
            </div>

            {isMenuOpen && (
                 <div className="md:hidden bg-emerald-800 border-t border-emerald-700 pb-4 px-4 shadow-xl animate-in slide-in-from-top-2 duration-200">
                    <div className="flex flex-col space-y-2 mt-4">
                         {lightseed && (
                             <button onClick={() => { onProfile(); setIsMenuOpen(false); }} className="flex items-center space-x-3 px-3 py-3 rounded-md bg-black/20 relative">
                                <div className="relative">
                                    <img src={lightseed.photoURL || `https://ui-avatars.com/api/?name=${lightseed.displayName}`} className="w-8 h-8 rounded-full" />
                                    {hasNotification && <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-black"></div>}
                                </div>
                                <span className="text-white font-medium">{t('profile')}</span>
                             </button>
                         )}
                        {[...mainTabs, ...moreTabs].map((tabKey) => (
                            <button 
                                key={tabKey}
                                onClick={() => { setTab(tabKey); setIsMenuOpen(false); }}
                                className={`flex justify-between items-center text-left px-3 py-3 rounded-md text-base font-medium ${activeTab === tabKey ? 'bg-emerald-700 text-white' : 'text-emerald-100 hover:bg-white/10'}`}
                            >
                                <span>{t(tabKey as any)}</span>
                                {tabKey === 'matches' && pendingMatchesCount > 0 && (
                                    <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingMatchesCount}</span>
                                )}
                            </button>
                        ))}
                         {lightseed ? (
                            <>
                                {activeTab === 'forest' || myTreesCount === 0 ? (
                                    <button onClick={() => { onPlant(); setIsMenuOpen(false); }} className={`${colors.grass} text-white px-3 py-3 rounded-md text-base font-medium mt-4 flex items-center`}>
                                        <Icons.Tree />
                                        <span className="ml-2">{t('plant_lifetree')}</span>
                                    </button>
                                ) : activeTab === 'visions' ? (
                                    <button onClick={() => { onCreateVision(); setIsMenuOpen(false); }} className={`${colors.earth} text-white px-3 py-3 rounded-md text-base font-medium mt-4 flex items-center`}>
                                        {t('create_vision')}
                                    </button>
                                ) : (
                                    <button onClick={() => { onPulse(); setIsMenuOpen(false); }} className={`${colors.earth} text-white px-3 py-3 rounded-md text-base font-medium mt-4 flex items-center`}>
                                        <PulsatingDot />
                                        {t('emit_pulse')}
                                    </button>
                                )}
                                <button onClick={onLogout} className="text-left px-3 py-3 text-emerald-300 hover:text-white">
                                    {t('sign_out')}
                                </button>
                            </>
                        ) : (
                             <button onClick={() => { onLogin(); setIsMenuOpen(false); }} className="bg-white text-slate-900 px-3 py-3 rounded-md text-base font-bold mt-4 shadow">
                                {t('sign_in')}
                            </button>
                        )}
                    </div>
                 </div>
            )}
        </nav>
    );
};
