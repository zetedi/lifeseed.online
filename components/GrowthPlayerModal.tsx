
import React, { useState, useEffect } from 'react';
import { type Pulse } from '../types';
import { fetchGrowthPulses } from '../services/firebase';
import { Modal } from './ui/Modal';

export const GrowthPlayerModal = ({ treeId, onClose }: { treeId: string, onClose: () => void }) => {
    const [images, setImages] = useState<Pulse[]>([]);
    const [index, setIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        // Set a timeout to avoid infinite loading if promise hangs
        const timeout = setTimeout(() => {
            if (loading) {
                setLoading(false);
                if (images.length === 0) setError("Request timed out. Check connection.");
            }
        }, 10000);

        fetchGrowthPulses(treeId)
            .then(data => {
                setImages(data.filter(p => p.imageUrl));
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setError("Failed to load growth images.");
                setLoading(false);
            });
            
        return () => clearTimeout(timeout);
    }, [treeId]);

    useEffect(() => {
        if (images.length > 1) {
            const timer = setInterval(() => setIndex(i => (i + 1) % images.length), 1000);
            return () => clearInterval(timer);
        }
    }, [images]);

    return (
        <Modal title="Growth Evolution" onClose={onClose}>
            {loading ? <div className="p-10 text-center">Loading Growth...</div> : (
                error ? <div className="p-10 text-center text-red-500">{error}</div> :
                images.length === 0 ? <div className="p-10 text-center">No growth pictures recorded yet.</div> :
                <div className="flex flex-col items-center">
                    <img src={images[index].imageUrl} className="w-full h-64 object-cover rounded-lg shadow-lg mb-4" />
                    <p className="text-center font-bold">{images[index].title}</p>
                    <p className="text-xs text-slate-500">{new Date(images[index].createdAt?.toMillis()).toLocaleDateString()}</p>
                    <div className="mt-4 flex gap-1">
                        {images.map((_, i) => <div key={i} className={`h-1 w-4 rounded ${i === index ? 'bg-emerald-500' : 'bg-slate-200'}`} />)}
                    </div>
                </div>
            )}
        </Modal>
    );
};
