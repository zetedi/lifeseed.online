
import React, { useEffect, useState, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { generateOracleQuote } from '../services/gemini';
import { getNetworkStats } from '../services/firebase';
import { Icons } from './ui/Icons';
import Logo from './Logo';

interface DashboardProps {
    lightseed: any;
    stats: {
        trees: number;
        pulses: number;
        visions: number;
        matches: number;
        danger: number;
    };
    firstTreeImage?: string;
    onSetTab: (tab: string) => void;
    onPlant: () => void;
    onLogin: () => void;
}

const GenesisSymbol = () => (
    <div className="grid grid-cols-4 gap-1 opacity-25">
        {[...Array(16)].map((_, i) => (
            <div 
                key={i} 
                className={`w-2 h-2 rounded-full ${i % 3 === 0 ? 'bg-emerald-300' : i % 2 === 0 ? 'bg-emerald-500' : 'bg-emerald-700'}`}
            ></div>
        ))}
    </div>
);

// Fallback SVG image
const lifetreeImage = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 800'%3E%3Cdefs%3E%3CradialGradient id='g' cx='50%25' cy='50%25' r='60%25'%3E%3Cstop offset='0%25' stop-color='%23d1fae5'/%3E%3Cstop offset='100%25' stop-color='%23047857'/%3E%3C/radialGradient%3E%3Cfilter id='glow'%3E%3CfeGaussianBlur stdDeviation='8' result='coloredBlur'/%3E%3CfeMerge%3E%3CfeMergeNode in='coloredBlur'/%3E%3CfeMergeNode in='SourceGraphic'/%3E%3C/feMerge%3E%3C/filter%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23g)'/%3E%3Cg opacity='0.3'%3E%3Ccircle cx='400' cy='400' r='350' fill='none' stroke='%23fff' stroke-width='1'/%3E%3Ccircle cx='400' cy='400' r='250' fill='none' stroke='%23fff' stroke-width='1'/%3E%3Cpath d='M400 50 L400 750 M50 400 L750 400' stroke='%23fff' stroke-width='1' stroke-dasharray='10 10'/%3E%3C/g%3E%3Cpath d='M400 800 C 350 700 300 650 400 550 C 500 650 450 700 400 800' fill='%235d4037' opacity='0.8'/%3E%3Cg transform='translate(0,-50)'%3E%3Ccircle cx='400' cy='400' r='160' fill='%2310b981'/%3E%3Ccircle cx='300' cy='350' r='100' fill='%2334d399' opacity='0.9'/%3E%3Ccircle cx='500' cy='350' r='100' fill='%2334d399' opacity='0.9'/%3E%3Ccircle cx='400' cy='250' r='120' fill='%23059669' opacity='0.9'/%3E%3Ccircle cx='250' cy='450' r='80' fill='%236ee7b7' opacity='0.8'/%3E%3Ccircle cx='550' cy='450' r='80' fill='%236ee7b7' opacity='0.8'/%3E%3C/g%3E%3Cg filter='url(%23glow)'%3E%3Ccircle cx='400' cy='350' r='15' fill='%23fcd34d'/%3E%3Ccircle cx='320' cy='300' r='12' fill='%23fcd34d' opacity='0.8'/%3E%3Ccircle cx='480' cy='300' r='12' fill='%23fcd34d' opacity='0.8'/%3E%3Ccircle cx='280' cy='420' r='10' fill='%23fbbf24' opacity='0.8'/%3E%3Ccircle cx='520' cy='420' r='10' fill='%23fbbf24' opacity='0.8'/%3E%3Ccircle cx='400' cy='220' r='18' fill='%23fff' opacity='0.9'/%3E%3C/g%3E%3Cpath d='M400 350 L 320 300 M 400 350 L 480 300 M 400 350 L 400 220' stroke='%23fff' stroke-width='2' opacity='0.4'/%3E%3C/svg%3E`;

export const Dashboard = ({ lightseed, stats, firstTreeImage, onSetTab, onPlant, onLogin }: DashboardProps) => {
    const { t } = useLanguage();
    const [quote, setQuote] = useState<string>("Loading Oracle...");
    const [networkStats, setNetworkStats] = useState({ trees: 0, pulses: 0, visions: 0 });
    const videoRef = useRef<HTMLVideoElement>(null);
    const [videoEnded, setVideoEnded] = useState(false);

    useEffect(() => {
        // Lazy load the quote
        generateOracleQuote().then(setQuote);
        // Fetch global stats
        getNetworkStats().then(setNetworkStats);
    }, []);

    const handleReplay = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play();
            setVideoEnded(false);
        }
    };

    return (
        <div className="grid grid-cols-2 gap-3 sm:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Box 1: My Light HUD */}
            <div onClick={() => lightseed ? onSetTab('profile') : onLogin()} className="relative h-[40vh] md:h-64 rounded-2xl overflow-hidden shadow-xl cursor-pointer group">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-purple-600"></div>
                {lightseed && firstTreeImage && <img src={firstTreeImage} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-[5s] opacity-50" />}
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors"></div>
                
                <div className="relative h-full p-4 flex flex-col justify-between text-white">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-sm sm:text-lg font-bold uppercase tracking-widest text-white drop-shadow-md">My Light</h2>
                            <div className="text-lg sm:text-xl font-light truncate max-w-[120px]">{lightseed ? lightseed.displayName : t('sign_in')}</div>
                        </div>
                        <div className="p-2 bg-white/10 backdrop-blur rounded-lg"><Icons.FingerPrint /></div>
                    </div>

                    {lightseed && (
                        <div className="grid grid-cols-2 bg-white/10 backdrop-blur p-2 rounded-lg border border-white/10 mt-2">
                            <div className="text-center border-r border-b border-white/10 pb-2">
                                <span className="block text-[10px] uppercase text-emerald-200">Trees</span>
                                <span className="font-bold text-sm">{stats.trees}</span>
                            </div>
                            <div className="text-center border-b border-white/10 pb-2">
                                <span className="block text-[10px] uppercase text-sky-200">Pulses</span>
                                <span className="font-bold text-sm">{stats.pulses}</span>
                            </div>
                            <div className="text-center border-r border-white/10 pt-2">
                                <span className="block text-[10px] uppercase text-amber-200">Visions</span>
                                <span className="font-bold text-sm">{stats.visions}</span>
                            </div>
                            <div className="text-center pt-2">
                                <span className="block text-[10px] uppercase text-rose-200">Matches</span>
                                <span className="font-bold text-sm">{stats.matches}</span>
                            </div>
                        </div>
                    )}
                    
                    {stats.danger > 0 && (
                        <div className="absolute bottom-2 right-2 bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-full animate-pulse shadow-lg flex items-center gap-1 whitespace-nowrap z-20 border-2 border-white/20">
                            <Icons.Siren /> {stats.danger} {t('guard_tree')}!
                        </div>
                    )}
                </div>
            </div>

            {/* Box 2: Plant a Lifetree */}
            <div onClick={() => { if (!lightseed) onLogin(); else if (stats.trees === 0) onPlant(); else onSetTab('forest'); }} className="relative h-[40vh] md:h-64 rounded-2xl overflow-hidden shadow-xl cursor-pointer group">
                <img src={lifetreeImage} className="absolute inset-0 w-full h-full object-cover" alt="Lifetree" />
                <video 
                    ref={videoRef}
                    src="/planting.mp4" 
                    autoPlay 
                    muted 
                    playsInline 
                    onEnded={() => setVideoEnded(true)}
                    className={`absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform opacity-90`}
                />
                <div className={`absolute inset-0 bg-black/10 ${videoEnded ? 'bg-black/40' : ''} transition-colors`}></div>
                
                {videoEnded && (
                    <div className="absolute top-2 right-2 z-20">
                        <button 
                            onClick={handleReplay}
                            className="bg-white/20 hover:bg-white/40 text-white p-2 rounded-full backdrop-blur-md transition-all hover:scale-110 shadow-lg border border-white/30"
                        >
                            <Icons.Refresh />
                        </button>
                    </div>
                )}

                <div className="relative h-full p-4 flex flex-col justify-between text-white">
                    <div className="flex justify-between items-start">
                        <h2 className="text-sm sm:text-lg font-bold uppercase tracking-widest text-white drop-shadow-md">{t('be_mother_tree')}</h2>
                        <div className="p-2 bg-white/10 backdrop-blur rounded-lg"><Icons.Tree /></div>
                    </div>
                    <div className="text-sm font-medium uppercase tracking-wide border-t border-white/30 pt-2">{t('create_new_world')}</div>
                </div>
            </div>

            {/* Box 3: Oracle (Dynamic Quote) */}
            <div onClick={() => onSetTab('oracle')} className="relative h-[40vh] md:h-64 rounded-2xl overflow-hidden shadow-xl cursor-pointer group">
                <div className="absolute inset-0 bg-slate-900"></div>
                <img src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=800" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                <div className="relative h-full p-4 flex flex-col justify-between text-white">
                    <div className="flex justify-between items-start">
                        <h2 className="text-sm sm:text-lg font-bold uppercase tracking-widest text-white drop-shadow-md">{t('oracle')}</h2>
                        <div className="flex flex-col items-end">
                             <div className="p-2 bg-white/10 backdrop-blur rounded-lg mb-2"><Icons.SparkleFill /></div>
                             <GenesisSymbol />
                        </div>
                    </div>
                    <p dir="auto" className="text-xs sm:text-base italic leading-relaxed line-clamp-4 opacity-90 font-serif drop-shadow-sm">
                        {quote}
                    </p>
                </div>
            </div>

            {/* Box 4: Forest (Banner Style + Stats) */}
            <div onClick={() => onSetTab('forest')} className="relative h-[40vh] md:h-64 rounded-2xl overflow-hidden shadow-xl cursor-pointer group">
                <img src="/mother.jpg" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform" />
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors"></div>
                <div className="relative h-full p-4 flex flex-col justify-between text-white">
                    <div className="flex justify-between items-start">
                        <h2 className="text-sm sm:text-lg font-bold uppercase tracking-widest text-white drop-shadow-md">{t('forest')}</h2>
                        <div className="p-2 bg-white/10 backdrop-blur rounded-lg"><Icons.Map /></div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 bg-white/10 backdrop-blur p-2 rounded-lg border border-white/10">
                        <div className="text-center border-r border-b md:border-b-0 border-white/10 pb-2 md:pb-0">
                            <span className="block text-[10px] uppercase text-emerald-200">Trees</span>
                            <span className="font-bold text-sm">{networkStats.trees}</span>
                        </div>
                        <div className="text-center border-b md:border-b-0 md:border-r border-white/10 pb-2 md:pb-0">
                            <span className="block text-[10px] uppercase text-sky-200">Pulses</span>
                            <span className="font-bold text-sm">{networkStats.pulses}</span>
                        </div>
                        <div className="text-center col-span-2 md:col-span-1 pt-2 md:pt-0">
                            <span className="block text-[10px] uppercase text-amber-200">Visions</span>
                            <span className="font-bold text-sm">{networkStats.visions}</span>
                        </div>
                    </div>

                    <div className="text-sm font-medium uppercase tracking-wide border-t border-white/30 pt-2">{t('explore')}</div>
                </div>
            </div>
        </div>
    );
};
