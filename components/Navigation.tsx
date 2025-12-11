
import React, { useState } from 'react';
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
}

export const Navigation = ({ lightseed, activeTab, setTab, onPlant, onPulse, onLogin, onLogout, onProfile, onCreateVision, hasApiKey, onCheckKey, pendingMatchesCount, myTreesCount = 0 }: NavigationProps) => {
    const { t, language, setLanguage } = useLanguage();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

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
    
    // Helper to get active button style
    const getTabStyle = (key: string) => {
        if (activeTab === key) {
            if (key === 'visions') return `bg-amber-500 text-white shadow-lg shadow-amber-500/30`;
            if (key === 'forest') return `bg-emerald-600 text-white shadow-lg shadow-emerald-500/30`;
            if (key === 'pulses') return `bg-sky-600 text-white shadow-lg shadow-sky-500/30`;
            if (key === 'oracle') return `bg-indigo-600 text-white shadow-lg shadow-indigo-500/30`;
            return `bg-slate-700 text-white`;
        }
        return `text-emerald-100 hover:text-white hover:bg-white/10`;
    }

    // Dark Green Header
    return (
        <nav className={`sticky top-0 z-30 bg-emerald-900 border-b border-emerald-800 text-white shadow-md`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-20 items-center">
                    <div className="flex items-center space-x-3 cursor-pointer rtl:space-x-reverse" onClick={() => setTab('forest')}>
                        <div className="bg-white p-1 rounded-full shadow-inner animate-[pulse_3s_ease-in-out_infinite]">
                             <Logo width={40} height={40} />
                        </div>
                        <span className="font-light text-2xl tracking-wide lowercase hidden sm:block text-white drop-shadow-sm">.seed</span>
                    </div>

                    <div className="hidden md:flex space-x-3 rtl:space-x-reverse">
                        {['forest', 'pulses', 'visions', 'oracle', 'matches'].map((tabKey) => (
                            <button 
                                key={tabKey}
                                onClick={() => setTab(tabKey)}
                                className={`relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${getTabStyle(tabKey)}`}
                            >
                                {tabKey === 'matches' ? 'Matches' : t(tabKey as any)}
                                {tabKey === 'matches' && pendingMatchesCount > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="hidden md:flex items-center space-x-4 rtl:space-x-reverse">
                         {/* Only show button if we are in AI Studio environment or if key is present to indicate status */}
                         <button 
                             onClick={handleApiKeySelect}
                             className={`p-2 rounded-full transition-all flex items-center space-x-2 ${!hasApiKey ? 'bg-amber-500/20 text-amber-500 ring-1 ring-amber-500' : 'text-emerald-100 hover:text-white hover:bg-white/10'}`}
                             title={hasApiKey ? "Gemini Connected" : "Connect Gemini API (AI Studio Only)"}
                         >
                             <Icons.Key />
                             {!hasApiKey && <span className="text-xs font-bold">Connect AI</span>}
                         </button>

                         <select 
                            value={language} 
                            onChange={(e) => setLanguage(e.target.value as Language)}
                            className="bg-black/20 text-white text-xs rounded border-none py-1 pl-2 pr-6 cursor-pointer hover:bg-black/30"
                        >
                            <option className="text-slate-800" value="en">EN</option>
                            <option className="text-slate-800" value="es">ES</option>
                            <option className="text-slate-800" value="hu">HU</option>
                            <option className="text-slate-800" value="qu">QU</option>
                            <option className="text-slate-800" value="sa">SA</option>
                            <option className="text-slate-800" value="ja">JA</option>
                            <option className="text-slate-800" value="ar">AR</option>
                        </select>

                        {lightseed ? (
                            <>
                                {myTreesCount === 0 ? (
                                     <button onClick={onPlant} className={`hidden sm:flex ${colors.grass} hover:bg-emerald-700 text-white px-5 py-2 rounded-full text-sm font-medium shadow-md transition-transform active:scale-95 items-center`}>
                                        <Icons.Leaf />
                                        <span className="ml-1">{t('plant_lifetree')}</span>
                                    </button>
                                ) : activeTab === 'visions' ? (
                                     <button onClick={onCreateVision} className={`hidden sm:flex ${colors.earth} hover:bg-[#78350f] text-white px-5 py-2 rounded-full text-sm font-medium shadow-md transition-transform active:scale-95 items-center`}>
                                        {t('create_vision')}
                                    </button>
                                ) : (
                                    <button onClick={onPulse} className={`hidden sm:flex ${colors.earth} hover:bg-[#78350f] text-white px-5 py-2 rounded-full text-sm font-medium shadow-md transition-transform active:scale-95 items-center`}>
                                        <PulsatingDot />
                                        {t('emit_pulse')}
                                    </button>
                                )}
                                
                                <img 
                                    src={lightseed.photoURL || `https://ui-avatars.com/api/?name=${lightseed.displayName}`} 
                                    className="w-9 h-9 rounded-full border-2 border-emerald-700 cursor-pointer hover:border-emerald-500 transition-colors" 
                                    alt="Seed" 
                                    onClick={onProfile}
                                />
                                <button onClick={onLogout} className="text-emerald-100 hover:text-white text-sm font-medium shadow-sm">{t('sign_out')}</button>
                            </>
                        ) : (
                            <button onClick={onLogin} className={`flex items-center space-x-2 rtl:space-x-reverse bg-white text-slate-900 px-5 py-2 rounded-full text-sm font-bold shadow-md hover:bg-slate-100 transition-colors`}>
                                <span>{t('sign_in')}</span>
                            </button>
                        )}
                    </div>

                    <div className="flex md:hidden items-center space-x-4 rtl:space-x-reverse">
                         <button 
                             onClick={handleApiKeySelect}
                             className={`p-1 ${!hasApiKey ? 'text-amber-500' : 'text-emerald-100'}`}
                         >
                             <Icons.Key />
                         </button>
                        <select 
                            value={language} 
                            onChange={(e) => setLanguage(e.target.value as Language)}
                            className="bg-black/20 text-white text-xs rounded border-none py-1 pl-1 pr-1 cursor-pointer w-12"
                        >
                            <option className="text-slate-800" value="en">EN</option>
                            <option className="text-slate-800" value="es">ES</option>
                            <option className="text-slate-800" value="hu">HU</option>
                        </select>
                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-white p-2 relative hover:bg-white/10 rounded">
                            {isMenuOpen ? <Icons.Close /> : <Icons.Menu />}
                            {pendingMatchesCount > 0 && !isMenuOpen && <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></div>}
                        </button>
                    </div>
                </div>
            </div>

            {isMenuOpen && (
                 <div className="md:hidden bg-emerald-800 border-t border-emerald-700 pb-4 px-4 shadow-xl">
                    <div className="flex flex-col space-y-2 mt-4">
                         {lightseed && (
                             <button onClick={() => { onProfile(); setIsMenuOpen(false); }} className="flex items-center space-x-3 px-3 py-3 rounded-md bg-black/20">
                                <img src={lightseed.photoURL || `https://ui-avatars.com/api/?name=${lightseed.displayName}`} className="w-8 h-8 rounded-full" />
                                <span className="text-white font-medium">{t('profile')}</span>
                             </button>
                         )}
                        {['forest', 'pulses', 'visions', 'oracle', 'matches'].map((tabKey) => (
                            <button 
                                key={tabKey}
                                onClick={() => { setTab(tabKey); setIsMenuOpen(false); }}
                                className={`flex justify-between items-center text-left px-3 py-3 rounded-md text-base font-medium ${activeTab === tabKey ? 'bg-emerald-700 text-white' : 'text-emerald-100 hover:bg-white/10'}`}
                            >
                                <span>{tabKey === 'matches' ? 'Matches' : t(tabKey as any)}</span>
                                {tabKey === 'matches' && pendingMatchesCount > 0 && (
                                    <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingMatchesCount}</span>
                                )}
                            </button>
                        ))}
                         {lightseed ? (
                            <>
                                {myTreesCount === 0 ? (
                                    <button onClick={() => { onPlant(); setIsMenuOpen(false); }} className={`${colors.grass} text-white px-3 py-3 rounded-md text-base font-medium mt-4 flex items-center`}>
                                        <Icons.Leaf />
                                        <span className="ml-2">{t('plant_lifetree')}</span>
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
