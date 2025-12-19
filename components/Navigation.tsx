
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './ui/Icons';
import Logo from './Logo';

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
  pendingMatchesCount: number;
  myTreesCount: number;
  dangerTreesCount: number;
}

const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'hu', name: 'Magyar' },
    { code: 'qu', name: 'Runa Simi' },
    { code: 'sa', name: 'संस्कृतम्' },
    { code: 'ja', name: '日本語' },
    { code: 'ar', name: 'العربية' },
    { code: 'sw', name: 'Kiswahili' },
];

export const Navigation = ({ lightseed, activeTab, setTab, onPlant, onPulse, onLogin, onLogout, onProfile, onCreateVision, pendingMatchesCount, myTreesCount = 0, dangerTreesCount = 0 }: NavigationProps) => {
    const { t, language, setLanguage } = useLanguage();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const [isLangOpen, setIsLangOpen] = useState(false);
    const moreRef = useRef<HTMLDivElement>(null);
    const langRef = useRef<HTMLDivElement>(null);
    
    const hasNotification = pendingMatchesCount > 0 || dangerTreesCount > 0;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (moreRef.current && !moreRef.current.contains(event.target as Node)) setIsMoreOpen(false);
            if (langRef.current && !langRef.current.contains(event.target as Node)) setIsLangOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getTabStyle = (key: string) => {
        if (activeTab === key) {
            const themes: any = { 
                dashboard: 'bg-indigo-600', visions: 'bg-amber-500', forest: 'bg-emerald-600', 
                pulses: 'bg-sky-600', matches: 'bg-rose-600', oracle: 'bg-indigo-600', about: 'bg-purple-600'
            };
            return `${themes[key] || 'bg-slate-700'} text-white shadow-lg shadow-black/20 font-bold tracking-wide`;
        }
        return `text-emerald-100 hover:text-white hover:bg-white/10 font-medium`;
    }

    const mainTabs = ['forest', 'visions', 'pulses'];
    const moreTabs = ['matches', 'oracle', 'about'];

    return (
        <nav className="sticky top-0 z-30 bg-emerald-900 border-b border-emerald-800 text-white shadow-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-20 items-center">
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setTab('dashboard')}>
                        <div className="bg-white p-1 rounded-full group-hover:scale-110 transition-transform">
                             <Logo width={32} height={32} />
                        </div>
                        <span dir="ltr" className="font-light text-2xl lowercase tracking-wide">.seed</span>
                    </div>

                    {/* Desktop Navigation Tabs */}
                    <div className="hidden lg:flex items-center gap-2">
                        {mainTabs.map(tab => (
                            <button key={tab} onClick={() => setTab(tab)} className={`px-5 py-2.5 rounded-full text-sm transition-all ${getTabStyle(tab)}`}>
                                {t(tab as any)}
                            </button>
                        ))}
                        <div className="relative" ref={moreRef}>
                            <button onClick={() => setIsMoreOpen(!isMoreOpen)} className="flex items-center px-5 py-2.5 rounded-full text-sm font-medium text-emerald-100 hover:bg-white/10">
                                <span>{t('more')}</span>
                                {hasNotification && <span className="ml-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                            </button>
                            {isMoreOpen && (
                                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 text-slate-700">
                                    {moreTabs.map(tab => (
                                        <button key={tab} onClick={() => { setTab(tab); setIsMoreOpen(false); }} className="w-full text-left px-6 py-3 text-sm hover:bg-slate-50 flex justify-between font-medium">
                                            <span>{t(tab as any)}</span>
                                            {tab === 'matches' && pendingMatchesCount > 0 && <span className="bg-red-500 text-white text-[10px] px-2 rounded-full">{pendingMatchesCount}</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons: Visible on MD+ (Mid size and up) */}
                    <div className="hidden md:flex items-center gap-3 mx-4">
                        {lightseed && (
                            <>
                                {activeTab === 'visions' ? (
                                    <button onClick={onCreateVision} className="bg-amber-500 hover:bg-amber-600 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm flex items-center gap-2 transition-colors border border-amber-500/30">
                                        <Icons.Sparkles /> 
                                        <span className="hidden xl:inline">{t('create_vision')}</span>
                                    </button>
                                ) : (
                                    <button onClick={onPlant} className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm flex items-center gap-2 transition-colors border border-emerald-500/30">
                                        <Icons.Tree /> 
                                        {/* Text hidden on mid, visible on xl */}
                                        <span className="hidden xl:inline">{t('plant_lifetree')}</span>
                                    </button>
                                )}
                                
                                <button onClick={onPulse} className="bg-sky-600 hover:bg-sky-500 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm flex items-center gap-2 transition-colors border border-sky-500/30">
                                    <Icons.HeartPulse /> 
                                    <span className="hidden xl:inline">{t('emit_pulse')}</span>
                                </button>
                            </>
                        )}
                    </div>

                    {/* Right Side UI Controls */}
                    <div className="flex items-center gap-3">
                         <div className="relative" ref={langRef}>
                            <button onClick={() => setIsLangOpen(!isLangOpen)} className="bg-emerald-800 text-xs border border-emerald-700 rounded-full px-3 py-1 uppercase font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1">
                                <Icons.Globe />
                                <span>{language}</span>
                            </button>
                            {isLangOpen && (
                                <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-xl border py-2 z-50 text-slate-700">
                                    {languages.map(l => (
                                        <button key={l.code} onClick={() => { setLanguage(l.code as any); setIsLangOpen(false); }} className={`w-full text-left px-4 py-2 text-sm ${language === l.code ? 'bg-emerald-50 text-emerald-600 font-bold' : 'hover:bg-slate-50'}`}>
                                            {l.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                         </div>

                         {lightseed ? (
                            <div className="flex items-center gap-3">
                                <button onClick={onProfile} className="relative group">
                                    <img src={lightseed.photoURL || `https://ui-avatars.com/api/?name=${lightseed.displayName}`} className="w-10 h-10 rounded-full border-2 border-white/20 shadow-md group-hover:border-white transition-all" />
                                    {hasNotification && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 border-2 border-emerald-900 rounded-full"></span>}
                                </button>
                                <button onClick={onLogout} className="hidden lg:block text-xs font-bold uppercase tracking-widest text-emerald-200 hover:text-white transition-colors">
                                    {t('sign_out')}
                                </button>
                            </div>
                         ) : (
                            <button onClick={onLogin} className="bg-white text-emerald-900 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shadow-lg hover:bg-emerald-50 transition-all active:scale-95">
                                {t('sign_in')}
                            </button>
                         )}

                         <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="lg:hidden p-2 text-white hover:text-emerald-200 transition-colors">
                            {isMenuOpen ? <Icons.Close /> : <Icons.Menu />}
                         </button>
                    </div>
                </div>
            </div>

            {/* Mobile Sidebar/Menu */}
            {isMenuOpen && (
                <div className="lg:hidden bg-emerald-950 border-t border-emerald-800 py-6 px-4 flex flex-col gap-3 animate-in slide-in-from-top-full">
                    {lightseed && (
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            {activeTab === 'visions' ? (
                                <button onClick={() => { onCreateVision(); setIsMenuOpen(false); }} className="bg-amber-500 p-4 rounded-xl flex flex-col items-center gap-2 font-bold text-xs shadow-lg border border-amber-500/50 text-white">
                                    <Icons.Sparkles /> <span>{t('create_vision')}</span>
                                </button>
                            ) : (
                                <button onClick={() => { onPlant(); setIsMenuOpen(false); }} className="bg-emerald-600 p-4 rounded-xl flex flex-col items-center gap-2 font-bold text-xs shadow-lg border border-emerald-500/50">
                                    <Icons.Tree /> <span>{t('plant_lifetree')}</span>
                                </button>
                            )}
                            <button onClick={() => { onPulse(); setIsMenuOpen(false); }} className="bg-sky-600 p-4 rounded-xl flex flex-col items-center gap-2 font-bold text-xs shadow-lg border border-sky-500/50">
                                <Icons.HeartPulse /> <span>{t('emit_pulse')}</span>
                            </button>
                        </div>
                    )}
                    <button onClick={() => { setTab('dashboard'); setIsMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium ${activeTab === 'dashboard' ? 'bg-emerald-800 text-white' : 'text-emerald-100 hover:bg-emerald-900'}`}>Home</button>
                    {[...mainTabs, ...moreTabs].map(tab => (
                        <button key={tab} onClick={() => { setTab(tab); setIsMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium flex justify-between items-center ${activeTab === tab ? 'bg-emerald-800 text-white' : 'text-emerald-100 hover:bg-emerald-900'}`}>
                            <span>{t(tab as any)}</span>
                            {tab === 'matches' && pendingMatchesCount > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{pendingMatchesCount}</span>}
                        </button>
                    ))}
                    {lightseed && (
                        <button onClick={() => { onLogout(); setIsMenuOpen(false); }} className="w-full text-left px-4 py-4 rounded-xl text-sm font-bold text-rose-300 mt-6 border border-rose-900/30 bg-rose-950/20 hover:bg-rose-900/40 transition-all flex items-center justify-center gap-2">
                             <Icons.Close />
                             <span>{t('sign_out')}</span>
                        </button>
                    )}
                </div>
            )}
        </nav>
    );
};
