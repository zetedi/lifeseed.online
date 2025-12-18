
import React, { useEffect, useState } from 'react';
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

export const Dashboard = ({ lightseed, stats, firstTreeImage, onSetTab, onPlant, onLogin }: DashboardProps) => {
    const { t } = useLanguage();
    const [quote, setQuote] = useState<string>("Loading Oracle...");
    const [networkStats, setNetworkStats] = useState({ trees: 0, pulses: 0, visions: 0 });

    useEffect(() => {
        // Lazy load the quote
        generateOracleQuote().then(setQuote);
        // Fetch global stats
        getNetworkStats().then(setNetworkStats);
    }, []);

    return (
        <div className="grid grid-cols-2 gap-3 sm:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Box 1: My Light HUD */}
            <div onClick={() => lightseed ? onSetTab('profile') : onLogin()} className="relative h-48 md:h-64 rounded-2xl overflow-hidden shadow-xl cursor-pointer group">
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
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            <div className="bg-black/20 rounded p-2 text-center">
                                <span className="block text-xs text-white/60">Trees</span>
                                <span className="font-bold">{stats.trees}</span>
                            </div>
                            <div className="bg-black/20 rounded p-2 text-center">
                                <span className="block text-xs text-white/60">Pulses</span>
                                <span className="font-bold">{stats.pulses}</span>
                            </div>
                            <div className="bg-black/20 rounded p-2 text-center">
                                <span className="block text-xs text-white/60">Visions</span>
                                <span className="font-bold">{stats.visions}</span>
                            </div>
                            <div className="bg-black/20 rounded p-2 text-center">
                                <span className="block text-xs text-white/60">Matches</span>
                                <span className="font-bold">{stats.matches}</span>
                            </div>
                        </div>
                    )}
                    
                    {stats.danger > 0 && (
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-full animate-pulse shadow-lg flex items-center gap-1 whitespace-nowrap z-20 border-2 border-white/20">
                            <Icons.Siren /> {stats.danger} TREE{stats.danger > 1 ? 'S' : ''} IN DANGER
                        </div>
                    )}
                </div>
            </div>

            {/* Box 2: Plant a Lifetree */}
            <div onClick={() => { if (!lightseed) onLogin(); else if (stats.trees === 0) onPlant(); else onSetTab('forest'); }} className="relative h-48 md:h-64 rounded-2xl overflow-hidden shadow-xl cursor-pointer group">
                <video 
                    src="/planting.mp4" 
                    autoPlay 
                    loop 
                    muted 
                    playsInline 
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform opacity-90" 
                />
                <div className="absolute inset-0 bg-black/10"></div>
                <div className="relative h-full p-4 flex flex-col justify-between text-white">
                    <div className="flex justify-between items-start">
                        <h2 className="text-sm sm:text-lg font-bold uppercase tracking-widest text-white drop-shadow-md">{t('be_mother_tree')}</h2>
                        <div className="p-2 bg-white/10 backdrop-blur rounded-lg"><Icons.Tree /></div>
                    </div>
                    <div className="text-sm font-medium uppercase tracking-wide border-t border-white/30 pt-2">{t('create_new_world')}</div>
                </div>
            </div>

            {/* Box 3: Oracle (Dynamic Quote) */}
            <div onClick={() => onSetTab('oracle')} className="relative h-48 md:h-64 rounded-2xl overflow-hidden shadow-xl cursor-pointer group">
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
                    <p className="text-xs sm:text-base italic leading-relaxed line-clamp-4 opacity-90 font-serif drop-shadow-sm">
                        {quote}
                    </p>
                </div>
            </div>

            {/* Box 4: Forest (Banner Style + Stats) */}
            <div onClick={() => onSetTab('forest')} className="relative h-48 md:h-64 rounded-2xl overflow-hidden shadow-xl cursor-pointer group">
                <img src="/mother.jpg" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform" />
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors"></div>
                <div className="relative h-full p-4 flex flex-col justify-between text-white">
                    <div className="flex justify-between items-start">
                        <h2 className="text-sm sm:text-lg font-bold uppercase tracking-widest text-white drop-shadow-md">{t('forest')}</h2>
                        <div className="p-2 bg-white/10 backdrop-blur rounded-lg"><Icons.Map /></div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-1 bg-white/10 backdrop-blur p-2 rounded-lg border border-white/10">
                        <div className="text-center">
                            <span className="block text-[10px] uppercase text-emerald-200">Trees</span>
                            <span className="font-bold text-sm">{networkStats.trees}</span>
                        </div>
                        <div className="text-center border-l border-white/10">
                            <span className="block text-[10px] uppercase text-sky-200">Pulses</span>
                            <span className="font-bold text-sm">{networkStats.pulses}</span>
                        </div>
                        <div className="text-center border-l border-white/10">
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
