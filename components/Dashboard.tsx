
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './ui/Icons';
import Logo from './Logo';

interface DashboardProps {
    lightseed: any;
    myTreesCount: number;
    firstTreeImage?: string;
    onSetTab: (tab: string) => void;
    onPlant: () => void;
    onLogin: () => void;
}

export const Dashboard = ({ lightseed, myTreesCount, firstTreeImage, onSetTab, onPlant, onLogin }: DashboardProps) => {
    const { t } = useLanguage();

    const mahameruSvg = `data:image/svg+xml,%3Csvg width='800' height='800' viewBox='0 0 800 800' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100%25' height='100%25' fill='%23064e3b'/%3E%3Cdefs%3E%3Csymbol id='mahameru' viewBox='0 0 262 262'%3E%3Ccircle cx='131' cy='131' r='131' fill='none' stroke='%23FFD700' stroke-width='7'/%3E%3C/symbol%3E%3C/defs%3E%3Cuse href='%23mahameru' x='269' y='269'/%3E%3C/svg%3E`;
    const greenCirclesBg = `data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100' height='100' fill='%23064e3b' /%3E%3Ccircle cx='25' cy='25' r='10' fill='%23065f46' opacity='0.5' /%3E%3C/svg%3E`;

    return (
        <div className="grid grid-cols-2 gap-3 sm:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Box 1: My Light */}
            <div onClick={() => lightseed ? onSetTab('profile') : onLogin()} className="relative h-32 sm:h-48 md:h-64 rounded-2xl overflow-hidden shadow-xl cursor-pointer group">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-purple-600"></div>
                {lightseed && firstTreeImage && <img src={firstTreeImage} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-[5s]" />}
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors"></div>
                <div className="relative h-full p-2 sm:p-6 flex flex-col justify-between text-white">
                    <div className="flex justify-between items-start">
                        <h2 className="text-[10px] sm:text-sm md:text-2xl font-light uppercase tracking-widest truncate max-w-[70%]">My Light</h2>
                        <div className="p-1 sm:p-2 bg-white/10 backdrop-blur rounded-lg scale-75 sm:scale-100"><Icons.FingerPrint /></div>
                    </div>
                    <div className="text-[8px] sm:text-xs md:text-sm font-medium uppercase truncate">{lightseed ? lightseed.displayName : t('sign_in')}</div>
                </div>
            </div>

            {/* Box 2: Mother Tree */}
            <div onClick={() => { if (!lightseed) onLogin(); else if (myTreesCount === 0) onPlant(); else onSetTab('forest'); }} className="relative h-32 sm:h-48 md:h-64 rounded-2xl overflow-hidden shadow-xl cursor-pointer group">
                <img src="/mother.jpg" className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform" />
                <div className="absolute inset-0 bg-black/40"></div>
                <div className="relative h-full p-2 sm:p-6 flex flex-col justify-between text-white">
                    <div className="flex justify-between items-start">
                        <h2 className="text-[10px] sm:text-sm md:text-2xl font-light uppercase tracking-widest truncate max-w-[70%]">{t('be_mother_tree')}</h2>
                        <div className="p-1 sm:p-2 bg-white/10 backdrop-blur rounded-lg scale-75 sm:scale-100"><Icons.Tree /></div>
                    </div>
                    <div className="text-[8px] sm:text-xs md:text-sm uppercase truncate">{t('plant_lifetree')}</div>
                </div>
            </div>

            {/* Box 3: Oracle */}
            <div onClick={() => onSetTab('oracle')} className="relative h-32 sm:h-48 md:h-64 rounded-2xl overflow-hidden shadow-xl cursor-pointer group">
                <div className="absolute inset-0 bg-slate-900"></div>
                <img src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=800" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                <div className="relative h-full p-2 sm:p-6 flex flex-col justify-between text-white">
                    <div className="flex justify-between items-start">
                        <h2 className="text-[10px] sm:text-sm md:text-2xl font-light uppercase tracking-widest truncate max-w-[70%]">{t('oracle')}</h2>
                        <div className="p-1 sm:p-2 bg-white/10 backdrop-blur rounded-lg scale-75 sm:scale-100"><Icons.SparkleFill /></div>
                    </div>
                    <p className="text-[7px] sm:text-xs italic truncate">"Seek clarity..."</p>
                </div>
            </div>

            {/* Box 4: Forest */}
            <div onClick={() => onSetTab('forest')} className="relative h-32 sm:h-48 md:h-64 rounded-2xl overflow-hidden shadow-xl cursor-pointer group">
                <div className="absolute inset-0" style={{ backgroundImage: `url("${greenCirclesBg}")`, backgroundSize: '60px' }}></div>
                <img src={mahameruSvg} className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-screen" />
                <div className="relative h-full p-2 sm:p-6 flex flex-col justify-between text-white">
                    <div className="flex justify-between items-start">
                        <h2 className="text-[10px] sm:text-sm md:text-2xl font-light uppercase tracking-widest truncate max-w-[70%]">{t('forest')}</h2>
                        <div className="p-1 sm:p-2 bg-white/10 backdrop-blur rounded-lg scale-75 sm:scale-100"><Icons.Map /></div>
                    </div>
                    <div className="text-[8px] sm:text-xs md:text-sm uppercase truncate">{t('explore')}</div>
                </div>
            </div>
        </div>
    );
};
