
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
                dir="ltr"
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/10 transition-colors group"
                title="Change Language"
            >
                <span className="text-emerald-100 group-hover:text-white transition-colors"><Icons.Globe /></span>
                <span className="font-bold text-emerald-100 group-hover:text-white uppercase text-sm transition-colors hidden md:inline">{language}</span>
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
    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const moreRef = useRef<HTMLDivElement>(null);
    const hasNotification = pendingMatchesCount > 0 || dangerTreesCount > 0;

    // Handle clicks outside "More" menu
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
    
    // Determine FAB Action based on active tab
    const getFabAction = () => {
        if (!lightseed) return onLogin;
        if (activeTab === 'forest') return onPlant;
        if (activeTab === 'visions') return onCreateVision;
        return onPulse; // Default to pulse for other tabs
    };

    const getFabIcon = () => {
        if (!lightseed) return <Icons.Key />; // Login icon
        if (activeTab === 'forest') return <Icons.Tree />;
        if (activeTab === 'visions') return <Icons.Sparkles />;
        return <PulsatingDot />;
    };

    const getFabLabel = () => {
        if (!lightseed) return t('sign_in');
        if (activeTab === 'forest') return t('plant_lifetree');
        if (activeTab === 'visions') return t('create_vision');
        return t('emit_pulse');
    };

    // --- RENDERERS ---

    // 1. Desktop Top Navigation (Classic Web Style)
    const renderDesktopNav = () => (
        <nav className="hidden md:block sticky top-0 z-30 bg-emerald-900 border-b border-emerald-800 text-white shadow-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-20 items-center">
                    {/* Brand */}
                    <div className="flex items-center space-x-3 cursor-pointer shrink-0 rtl:space-x-reverse" onClick={() => setTab('forest')}>
                        <div className="bg-white p-1 rounded-full shadow-inner animate-[pulse_3s_ease-in-out_infinite]">
                             <Logo width={40} height={40} />
                        </div>
                        <span dir="ltr" className="font-light text-2xl tracking-wide lowercase block text-white drop-shadow-sm">.seed</span>
                    </div>

                    {/* Tabs */}
                    <div className="flex-1 flex justify-center space-x-2">
                        {['forest', 'visions', 'pulses', 'matches', 'oracle', 'about'].map(tabKey => (
                            <button 
                                key={tabKey}
                                onClick={() => setTab(tabKey)}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === tabKey ? 'bg-white/20 text-white shadow-sm' : 'text-emerald-200 hover:text-white hover:bg-white/10'}`}
                            >
                                {t(tabKey as any)}
                            </button>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-4 rtl:space-x-reverse">
                         <button onClick={handleApiKeySelect} className={`p-2 rounded-full ${!hasApiKey ? 'text-amber-400 animate-pulse' : 'text-emerald-200'}`}><Icons.Key /></button>
                         <LanguageSelector language={language} setLanguage={setLanguage} />
                         {lightseed ? (
                            <div className="flex items-center space-x-4 rtl:space-x-reverse">
                                <button onClick={getFabAction()} className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-full text-sm font-bold shadow transition-transform active:scale-95 flex items-center gap-2">
                                    {getFabIcon()} <span>{getFabLabel()}</span>
                                </button>
                                <div onClick={onProfile} className="cursor-pointer relative">
                                    <img src={lightseed.photoURL || `https://ui-avatars.com/api/?name=${lightseed.displayName}`} className="w-9 h-9 rounded-full border-2 border-emerald-500" />
                                </div>
                            </div>
                         ) : (
                             <button onClick={onLogin} className="bg-white text-emerald-900 px-5 py-2 rounded-full text-sm font-bold shadow hover:bg-slate-100">{t('sign_in')}</button>
                         )}
                    </div>
                </div>
            </div>
        </nav>
    );

    // 2. Mobile App Bar (Top Scaffold)
    const renderMobileAppBar = () => (
        <div className="md:hidden sticky top-0 z-30 bg-emerald-900 text-white shadow-md px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2" onClick={() => setTab('forest')}>
                 <Logo width={32} height={32} />
                 <span dir="ltr" className="font-light text-xl lowercase">.seed</span>
            </div>
            <div className="flex items-center gap-2 rtl:space-x-reverse">
                <button onClick={handleApiKeySelect} className={`${!hasApiKey ? 'text-amber-400' : 'text-emerald-200/50'}`}><Icons.Key /></button>
                <LanguageSelector language={language} setLanguage={setLanguage} />
                {lightseed ? (
                    <img onClick={onProfile} src={lightseed.photoURL || `https://ui-avatars.com/api/?name=${lightseed.displayName}`} className="w-8 h-8 rounded-full border border-emerald-500" />
                ) : (
                    <button onClick={onLogin} className="text-sm font-bold bg-white text-emerald-900 px-3 py-1 rounded-full">{t('sign_in')}</button>
                )}
            </div>
        </div>
    );

    // 3. Mobile Bottom Navigation (Bottom Scaffold + FAB)
    const renderMobileBottomNav = () => (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40">
            {/* FAB - Center Docked */}
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 z-50">
                <button 
                    onClick={getFabAction()}
                    className="w-14 h-14 bg-emerald-500 rounded-full shadow-lg shadow-emerald-900/40 flex items-center justify-center text-white border-4 border-[#B2713A] active:scale-95 transition-transform"
                >
                    <div className="scale-125">{getFabIcon()}</div>
                </button>
            </div>

            {/* Bottom Bar */}
            <div className="bg-emerald-900 h-20 rounded-t-2xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex items-center justify-between px-2 text-xs font-medium text-emerald-200/70 relative">
                
                {/* Left Group */}
                <div className="flex-1 flex justify-around pr-8">
                    <button onClick={() => setTab('forest')} className={`flex flex-col items-center gap-1 ${activeTab === 'forest' ? 'text-white' : ''}`}>
                        <Icons.Tree />
                        <span>{t('forest')}</span>
                    </button>
                    <button onClick={() => setTab('visions')} className={`flex flex-col items-center gap-1 ${activeTab === 'visions' ? 'text-white' : ''}`}>
                        <Icons.Sparkles />
                        <span>{t('visions')}</span>
                    </button>
                </div>

                {/* Right Group */}
                <div className="flex-1 flex justify-around pl-8">
                    <button onClick={() => setTab('pulses')} className={`flex flex-col items-center gap-1 ${activeTab === 'pulses' ? 'text-white' : ''}`}>
                        <PulsatingDot />
                        <span>{t('pulses')}</span>
                    </button>
                    <button onClick={() => setIsMoreOpen(true)} className={`flex flex-col items-center gap-1 ${['matches', 'oracle', 'about', 'profile'].includes(activeTab) ? 'text-white' : ''}`}>
                        <div className="relative">
                            <Icons.Menu />
                            {hasNotification && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-emerald-900"></div>}
                        </div>
                        <span>{t('more')}</span>
                    </button>
                </div>
            </div>

            {/* Mobile Drawer (More Menu) */}
            {isMoreOpen && (
                <div className="fixed inset-0 z-50" onClick={() => setIsMoreOpen(false)}>
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
                    <div className="absolute bottom-0 left-0 right-0 bg-emerald-800 rounded-t-3xl p-6 animate-in slide-in-from-bottom-full duration-300">
                        <div className="w-12 h-1 bg-emerald-600/50 rounded-full mx-auto mb-6"></div>
                        <div className="grid grid-cols-4 gap-4 text-center text-emerald-100">
                             <button onClick={() => setTab('matches')} className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/5">
                                <div className="bg-rose-500/20 p-3 rounded-full text-rose-300 relative">
                                    <Icons.Link />
                                    {pendingMatchesCount > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{pendingMatchesCount}</span>}
                                </div>
                                <span className="text-xs">{t('matches')}</span>
                             </button>
                             <button onClick={() => setTab('oracle')} className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/5">
                                <div className="bg-indigo-500/20 p-3 rounded-full text-indigo-300"><Icons.SparkleFill /></div>
                                <span className="text-xs">{t('oracle')}</span>
                             </button>
                             <button onClick={onProfile} className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/5">
                                <div className="bg-emerald-500/20 p-3 rounded-full text-emerald-300"><Icons.FingerPrint /></div>
                                <span className="text-xs">{t('profile')}</span>
                             </button>
                             <button onClick={() => setTab('about')} className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/5">
                                <div className="bg-purple-500/20 p-3 rounded-full text-purple-300"><Icons.Shield /></div>
                                <span className="text-xs">{t('about')}</span>
                             </button>
                        </div>
                        {lightseed && (
                            <button onClick={onLogout} className="w-full mt-6 py-3 bg-black/20 rounded-xl text-emerald-200 font-bold hover:bg-black/30">
                                {t('sign_out')}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <>
            {renderDesktopNav()}
            {renderMobileAppBar()}
            {renderMobileBottomNav()}
        </>
    );
};
