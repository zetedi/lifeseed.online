import React, { useState, useEffect } from 'react';
import { Pulse, Lightseed } from '../types/Types';
import { Icons } from './Icons';
import { isPulseLoved, lovePulse } from '../lib/firebase';

interface PulseCardProps {
    pulse: Pulse;
    lightseed: Lightseed | null;
    onMatch: (pulse: Pulse) => void;
}

export const PulseCard: React.FC<PulseCardProps> = ({ pulse, lightseed, onMatch }) => {
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
        <div className={`bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200 hover:shadow-lg transition-all duration-300 group ${pulse.type === 'GROWTH' ? 'ring-2 ring-emerald-500 ring-opacity-20' : ''}`}>
             <div className="relative h-36 bg-slate-100 overflow-hidden group">
                 <div className="absolute top-2 right-2 z-20 flex space-x-1">
                    {pulse.type === 'GROWTH' && <span className="bg-emerald-100 text-emerald-600 text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm">GROWTH</span>}
                    {pulse.isMatch && <span className="bg-sky-100 text-sky-600 text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm">MATCH</span>}
                 </div>

                {pulse.imageUrl ? (
                    <img src={pulse.imageUrl} alt={pulse.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 bg-slate-50">
                        <Icons.Hash />
                    </div>
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent pointer-events-none"></div>
                <div className="absolute bottom-2 left-3 right-3 text-white pointer-events-none">
                     <h3 className="text-sm font-bold tracking-wide truncate">{pulse.title}</h3>
                </div>
            </div>

            <div className="p-3">
                <p className="text-slate-600 text-xs font-light leading-relaxed line-clamp-2 h-8">
                    {pulse.body}
                </p>
                <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center">
                    <button onClick={handleLove} disabled={!lightseed} className="flex items-center space-x-1 text-slate-500 hover:text-red-500 transition-colors">
                        <Icons.Heart filled={loved} />
                        <span className="text-xs">{count}</span>
                    </button>

                    {lightseed && lightseed.uid !== pulse.authorId && !pulse.isMatch && (
                        <button onClick={() => onMatch(pulse)} className="text-[10px] bg-slate-50 text-slate-500 hover:bg-sky-50 hover:text-sky-600 px-2 py-1 rounded transition-colors flex items-center space-x-1">
                            <Icons.Link /> <span>Match</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};