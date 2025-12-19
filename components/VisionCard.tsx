
import React from 'react';
import { type Vision } from '../types';
import { Icons } from './ui/Icons';

export const VisionCard = ({ vision }: { vision: Vision }) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg transition-all duration-300 group">
            <div className="relative h-36 bg-amber-50 overflow-hidden">
                {vision.imageUrl ? (
                    <img src={vision.imageUrl} alt={vision.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-amber-300">
                        <Icons.Sparkles />
                    </div>
                )}
                
                {/* Title Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent pointer-events-none"></div>
                <div className="absolute bottom-2 left-3 right-3 text-white pointer-events-none">
                     <h3 dir="auto" className="text-lg font-light tracking-wide truncate">{vision.title}</h3>
                </div>

                {vision.link && (
                    <a href={vision.link} target="_blank" rel="noopener noreferrer" className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full text-amber-600 hover:text-amber-800 hover:scale-110 transition-all shadow-sm z-10">
                        <Icons.Globe />
                    </a>
                )}
            </div>
            <div className="p-3">
                <p dir="auto" className="text-slate-600 text-xs font-light italic leading-relaxed truncate">
                    "{vision.body}"
                </p>
                {/* Matches layout height roughly by having same p-3 */}
            </div>
        </div>
    );
}
