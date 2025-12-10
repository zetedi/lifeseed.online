
import { useState, useEffect } from 'react';
import { onAuthChange, getMyLifetrees } from '../services/firebase';
import { type Lightseed, type Lifetree } from '../types';

export const useLifeseed = () => {
    const [lightseed, setLightseed] = useState<Lightseed | null>(null);
    const [myTrees, setMyTrees] = useState<Lifetree[]>([]);
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
                const trees = await getMyLifetrees(user.uid);
                setMyTrees(trees);
            } else {
                setLightseed(null);
                setMyTrees([]);
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const refreshTrees = async () => {
        if (lightseed) {
            const trees = await getMyLifetrees(lightseed.uid);
            setMyTrees(trees);
        }
    }
    const activeTree = myTrees.length > 0 ? myTrees[0] : null;
    return { lightseed, myTrees, activeTree, loading, refreshTrees };
};
