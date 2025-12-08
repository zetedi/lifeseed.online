
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { MatchProposal } from '../types/Types';
import { getPendingMatches, acceptMatch } from '../lib/firebase';
import { SimpleButton } from '../components/SimpleButton';

export default function Matches() {
    const { t } = useLanguage();
    const { lightseed } = useAuth();
    const [matches, setMatches] = useState<MatchProposal[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (lightseed) {
            setLoading(true);
            getPendingMatches(lightseed.uid).then(data => {
                setMatches(data);
                setLoading(false);
            });
        }
    }, [lightseed]);

    const onAcceptMatch = async (id: string) => {
        try { 
            await acceptMatch(id); 
            alert("Match Accepted! Blocks synced."); 
            // Refresh list
            if (lightseed) {
                const updated = await getPendingMatches(lightseed.uid);
                setMatches(updated);
            }
        } 
        catch(e:any) { alert(e.message); }
    }

    return (
        <div className="p-4 max-w-2xl mx-auto">
            <h2 className="text-2xl font-light mb-6">Pending Matches</h2>
            
            {!lightseed && <p className="text-slate-400">Please sign in to view matches.</p>}

            {lightseed && matches.length === 0 && !loading && (
                <p className="text-slate-400">No pending match requests.</p>
            )}

            {matches.map(m => (
                <div key={m.id} className="bg-white dark:bg-slate-900 p-4 rounded shadow-sm border border-slate-200 dark:border-slate-800 mb-4 flex justify-between items-center">
                    <div>
                        <p className="font-bold">Match Request</p>
                        <p className="text-sm text-slate-500">From another Tree</p>
                    </div>
                    <SimpleButton onClick={() => onAcceptMatch(m.id)} className="bg-sky-500 text-white hover:bg-sky-600">
                        Accept & Sync
                    </SimpleButton>
                </div>
            ))}
        </div>
    );
}
