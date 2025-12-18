
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
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

    const mahameruSvg = `data:image/svg+xml,%3Csvg width='800' height='800' viewBox='0 0 800 800' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100%25' height='100%25' fill='%23064e3b'/%3E%3Cdefs%3E%3Csymbol id='mahameru' viewBox='0 0 262 262'%3E%3Ccircle cx='131' cy='131' r='131' fill='none' stroke='%23FFD700' stroke-width='7'/%3E%3C/symbol%3E%3C/defs%3E%3Cuse href='%23mahameru' x='269' y='269'/%3E%3C/svg%3E`;
    const greenCirclesBg = `data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100' height='100' fill='%23064e3b' /%3E%3Ccircle cx='25' cy='25' r='10' fill='%23065f46' opacity='0.5' /%3E%3C/svg%3E`;

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
                            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-white/90">My Light</h2>
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

            {/* Box 2: Mother Tree */}
            <div onClick={() => { if (!lightseed) onLogin(); else if (stats.trees === 0) onPlant(); else onSetTab('forest'); }} className="relative h-48 md:h-64 rounded-2xl overflow-hidden shadow-xl cursor-pointer group">
                <img src="/mother.jpg" className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform" />
                <div className="absolute inset-0 bg-black/40"></div>
                <div className="relative h-full p-4 flex flex-col justify-between text-white">
                    <div className="flex justify-between items-start">
                        <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-white/90">{t('be_mother_tree')}</h2>
                        <div className="p-2 bg-white/10 backdrop-blur rounded-lg"><Icons.Tree /></div>
                    </div>
                    <div className="text-sm font-medium uppercase tracking-wide border-t border-white/30 pt-2">{t('plant_lifetree')}</div>
                </div>
            </div>

            {/* Box 3: Oracle */}
            <div onClick={() => onSetTab('oracle')} className="relative h-48 md:h-64 rounded-2xl overflow-hidden shadow-xl cursor-pointer group">
                <div className="absolute inset-0 bg-slate-900"></div>
                <img src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=800" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                <div className="relative h-full p-4 flex flex-col justify-between text-white">
                    <div className="flex justify-between items-start">
                        <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-white/90">{t('oracle')}</h2>
                        <div className="flex flex-col items-end">
                             <div className="p-2 bg-white/10 backdrop-blur rounded-lg mb-2"><Icons.SparkleFill /></div>
                             <GenesisSymbol />
                        </div>
                    </div>
                    <p className="text-xs italic truncate opacity-70">"Seek clarity..."</p>
                </div>
            </div>

            {/* Box 4: Forest */}
            <div onClick={() => onSetTab('forest')} className="relative h-48 md:h-64 rounded-2xl overflow-hidden shadow-xl cursor-pointer group">
                <div className="absolute inset-0" style={{ backgroundImage: `url("${greenCirclesBg}")`, backgroundSize: '60px' }}></div>
                <img src={mahameruSvg} className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-screen" />
                <div className="relative h-full p-4 flex flex-col justify-between text-white">
                    <div className="flex justify-between items-start">
                        <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-white/90">{t('forest')}</h2>
                        <div className="p-2 bg-white/10 backdrop-blur rounded-lg"><Icons.Map /></div>
                    </div>
                    <div className="text-sm font-medium uppercase tracking-wide border-t border-white/30 pt-2">{t('explore')}</div>
                </div>
            </div>
        </div>
    );
};
