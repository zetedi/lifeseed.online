import React from 'react';
import { Pulse } from '../types/Types';
import { useAuth } from '../context/AuthContext';
import { useInfiniteQuery } from '../hooks/useInfiniteQuery';
import { collection, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PulseCard } from '../components/PulseCard';

export default function Pulses() {
    const { lightseed } = useAuth();
    const pulsesQuery = query(collection(db, 'pulses'), orderBy('createdAt', 'desc'));
    const { data: pulses, loading, lastElementRef } = useInfiniteQuery<Pulse>(pulsesQuery);

    return (
        <div className="p-4 max-w-7xl mx-auto">
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {pulses.map((pulse, i) => (
                    <div key={pulse.id} ref={i === pulses.length - 1 ? lastElementRef : null}>
                        <PulseCard 
                            pulse={pulse} 
                            lightseed={lightseed} 
                            onMatch={() => console.log('Match pulse', pulse.id)} 
                        />
                    </div>
                ))}
                {loading && <p className="col-span-full text-center text-slate-400">Loading pulses...</p>}
            </div>
        </div>
    );
};