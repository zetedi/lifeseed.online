import React from 'react';
import { Vision } from '../types/Types';
import { useInfiniteQuery } from '../hooks/useInfiniteQuery';
import { collection, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Icons } from '../components/Icons';

export const VisionCard = ({ vision }: { vision: Vision }) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-amber-100 overflow-hidden hover:shadow-lg transition-all duration-300 group">
            <div className="relative h-48 bg-amber-50 overflow-hidden">
                {vision.imageUrl ? (
                    <img src={vision.imageUrl} alt={vision.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-amber-300">
                        <Icons.Sparkles />
                    </div>
                )}
                {vision.link && (
                    <a href={vision.link} target="_blank" rel="noopener noreferrer" className="absolute top-2 right-2 bg-white/90 p-2 rounded-full text-amber-600 hover:text-amber-800 hover:scale-110 transition-all shadow-sm">
                        <Icons.Globe />
                    </a>
                )}
            </div>
            <div className="p-5">
                <h3 className="text-lg font-bold text-slate-800 mb-2">{vision.title}</h3>
                <p className="text-slate-600 text-sm font-light leading-relaxed line-clamp-3">
                    {vision.body}
                </p>
            </div>
        </div>
    );
};

export default function Visions() {
    const visionQuery = query(collection(db, 'visions'), orderBy('createdAt', 'desc'));
    const { data: visions, loading, lastElementRef } = useInfiniteQuery<Vision>(visionQuery);

    return (
        <div className="p-4 max-w-7xl mx-auto">
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {visions.length === 0 && !loading ? <p className="col-span-full text-center text-slate-400 py-10">No visions found.</p> : 
                    visions.map((item, index) => (
                        <div key={item.id} ref={index === visions.length - 1 ? lastElementRef : null}>
                            <VisionCard vision={item} />
                        </div>
                    ))
                }
                {loading && <p className="col-span-full text-center text-slate-400">Loading visions...</p>}
            </div>
        </div>
    );
};