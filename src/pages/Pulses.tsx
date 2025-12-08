import React, { useState, FormEvent } from 'react';
import { Pulse } from '../types/Types';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useInfiniteQuery } from '../hooks/useInfiniteQuery';
import { collection, query, orderBy } from 'firebase/firestore';
import { db, mintPulse, uploadBase64Image, uploadImage } from '../lib/firebase';
import { PulseCard } from '../components/PulseCard';
import { SimpleButton } from '../components/SimpleButton';
import { Modal } from '../components/Modal';
import { ImagePicker } from '../components/ImagePicker';
import { Input } from '../components/Input';

export default function Pulses() {
    const { t } = useLanguage();
    const { lightseed, myTrees } = useAuth();
    const activeTree = myTrees.length > 0 ? myTrees[0] : null;
    const [showPulseModal, setShowPulseModal] = useState(false);
    
    // Pulse Form State
    const [pulseTitle, setPulseTitle] = useState('');
    const [pulseBody, setPulseBody] = useState('');
    const [pulseImageUrl, setPulseImageUrl] = useState('');
    const [isGrowth, setIsGrowth] = useState(false);
    const [uploading, setUploading] = useState(false);

    const pulsesQuery = query(collection(db, 'pulses'), orderBy('createdAt', 'desc'));
    const { data: pulses, loading, lastElementRef } = useInfiniteQuery<Pulse>(pulsesQuery);

    const handleImageUpload = async (file: File, path: string) => {
        setUploading(true);
        const url = await uploadImage(file, path);
        setUploading(false);
        return url;
    };

    const handleEmitPulse = async (e: FormEvent) => {
        e.preventDefault();
        if (!lightseed || !activeTree) return;
        
        let finalImageUrl = pulseImageUrl;
        setUploading(true);
        if (pulseImageUrl.startsWith('data:')) {
             try {
                 finalImageUrl = await uploadBase64Image(pulseImageUrl, `pulses/ai/${Date.now()}`);
             } catch(e) {
                 setUploading(false);
                 alert("Failed to upload AI image");
                 return;
             }
        }

        try {
            await mintPulse({
                lifetreeId: activeTree.id,
                type: isGrowth ? 'GROWTH' : 'STANDARD',
                title: pulseTitle,
                body: pulseBody,
                imageUrl: finalImageUrl,
                authorId: lightseed.uid,
                authorName: lightseed.displayName || "Soul",
                authorPhoto: lightseed.photoURL || undefined,
            });
            setShowPulseModal(false); 
            setPulseTitle(''); setPulseBody(''); setPulseImageUrl(''); setIsGrowth(false);
        } catch(e: any) { 
            alert(e.message); 
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="p-4 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-light">{t('pulses')}</h1>
                {lightseed && activeTree && (
                    <SimpleButton onClick={() => setShowPulseModal(true)} className="bg-sky-600 text-white hover:bg-sky-700 rounded-full">
                        {t('emit_pulse')}
                    </SimpleButton>
                )}
            </div>

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

            {showPulseModal && (
                <Modal title={t('emit_pulse')} onClose={() => setShowPulseModal(false)}>
                    <form onSubmit={handleEmitPulse} className="space-y-4">
                        <ImagePicker 
                            onChange={(e: any) => handleImageUpload(e.target.files[0], `pulses/${Date.now()}`).then(setPulseImageUrl)} 
                            previewUrl={pulseImageUrl} 
                            loading={uploading} 
                        />
                        <div className="flex items-center space-x-2">
                            <input type="checkbox" id="growth" checked={isGrowth} onChange={e => setIsGrowth(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
                            <label htmlFor="growth" className="text-sm font-medium text-slate-700 dark:text-slate-300">This is a Growth Picture (Internal Pulse)</label>
                        </div>
                        <Input placeholder="Title" value={pulseTitle} onChange={e=>setPulseTitle(e.target.value)} required />
                        <textarea className="block w-full border border-slate-200 dark:border-slate-800 bg-transparent p-2 rounded-md text-sm" placeholder="Body" value={pulseBody} onChange={e=>setPulseBody(e.target.value)} required rows={4} />
                        <SimpleButton type="submit" disabled={uploading} className="w-full bg-sky-600 text-white">{t('mint')}</SimpleButton>
                    </form>
                </Modal>
            )}
        </div>
    );
};