
import { useState, useEffect } from 'react';
import { onAuthChange, getMyLifetrees, getGuardedTrees } from '../services/firebase';
import { type Lightseed, type Lifetree } from '../types';

export const useLifeseed = () => {
    const [lightseed, setLightseed] = useState<Lightseed | null>(null);
    const [myTrees, setMyTrees] = useState<Lifetree[]>([]);
    const [guardedTrees, setGuardedTrees] = useState<Lifetree[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthChange(async (user) => {
            if (user) {
                setLightseed({ 
                    uid: user.uid, 
                    email: user.email, 
                    displayName: user.displayName,
                    photoURL: user.photoURL 
                });
                try {
                    const [owned, guarded] = await Promise.all([
                        getMyLifetrees(user.uid),
                        getGuardedTrees(user.uid)
                    ]);
                    setMyTrees(owned);
                    setGuardedTrees(guarded);
                } catch (e) {
                    console.error("Failed to fetch user trees", e);
                }
            } else {
                setLightseed(null);
                setMyTrees([]);
                setGuardedTrees([]);
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const refreshTrees = async () => {
        if (lightseed) {
            const [owned, guarded] = await Promise.all([
                getMyLifetrees(lightseed.uid),
                getGuardedTrees(lightseed.uid)
            ]);
            setMyTrees(owned);
            setGuardedTrees(guarded);
        }
    }
    const activeTree = myTrees.length > 0 ? myTrees[0] : null;
    return { lightseed, myTrees, guardedTrees, activeTree, loading, refreshTrees };
};
