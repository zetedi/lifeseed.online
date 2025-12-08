import React, { useState, FormEvent } from 'react';
import { Vision } from '../types/Types';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useInfiniteQuery } from '../hooks/useInfiniteQuery';
import { collection, query, orderBy } from 'firebase/firestore';
import { db, createVision, uploadBase64Image, uploadImage } from '../lib/firebase';
import { generateVisionImage } from '../services/gemini';
import { Icons } from '../components/Icons';
import { SimpleButton } from '../components/SimpleButton';
import { Modal } from '../components/Modal';
import { ImagePicker } from '../components/ImagePicker';
import { Input } from '../components/Input';

export const VisionCard = ({ vision }: { vision: Vision }) => {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-amber-100 dark:border-amber-900/30 overflow-hidden hover:shadow-lg transition-all duration-300 group">
            <div className="relative h-48 bg-amber-50 dark:bg-amber-950/20 overflow-hidden">
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
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">{vision.title}</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm font-light leading-relaxed line-clamp-3">
                    {vision.body}
                </p>
            </div>
        </div>
    );
};

export default function Visions() {
    const { t } = useLanguage();
    const { lightseed, myTrees } = useAuth();
    const activeTree = myTrees.length > 0 ? myTrees[0] : null;
    const [showVisionModal, setShowVisionModal] = useState(false);

    // Vision Form
    const [visionTitle, setVisionTitle] = useState('');
    const [visionBody, setVisionBody] = useState('');
    const [visionLink, setVisionLink] = useState('');
    const [visionImageUrl, setVisionImageUrl] = useState('');
    const [uploading, setUploading] = useState(false);

    const visionQuery = query(collection(db, 'visions'), orderBy('createdAt', 'desc'));
    const { data: visions, loading, lastElementRef } = useInfiniteQuery<Vision>(visionQuery);

    const handleImageUpload = async (file: File, path: string) => {
        setUploading(true);
        const url = await uploadImage(file, path);
        setUploading(false);
        return url;
    };

    const handleGenerateVisionImage = async () => {
        if (!visionBody) { alert("Please enter a vision description first."); return; }
        setUploading(true);
        try {
            const url = await generateVisionImage(visionBody);
            if (url) {
                setVisionImageUrl(url);
            } else {
                throw new Error("No image data returned from AI service.");
            }
        } catch (e: any) {
             alert(`Image generation failed: ${e.message}`);
        }
        setUploading(false);
    }

    const handleCreateVision = async (e: FormEvent) => {
        e.preventDefault();
        if (!lightseed || !activeTree) return;

        let finalImageUrl = visionImageUrl;
        setUploading(true);
        if (visionImageUrl.startsWith('data:')) {
             try {
                 finalImageUrl = await uploadBase64Image(visionImageUrl, `visions/ai/${Date.now()}`);
             } catch(e) {
                 setUploading(false);
                 alert("Failed to upload AI image");
                 return;
             }
        }

        try {
            await createVision({
                lifetreeId: activeTree.id,
                authorId: lightseed.uid,
                title: visionTitle,
                body: visionBody,
                link: visionLink,
                imageUrl: finalImageUrl
            });
            setShowVisionModal(false); 
            setVisionTitle(''); setVisionBody(''); setVisionLink(''); setVisionImageUrl('');
        } catch(e:any) { 
            alert(e.message); 
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="p-4 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-light">{t('visions')}</h1>
                {lightseed && activeTree && (
                    <SimpleButton onClick={() => setShowVisionModal(true)} className="bg-amber-500 text-white hover:bg-amber-600 rounded-full">
                        {t('create_vision')}
                    </SimpleButton>
                )}
            </div>

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

            {showVisionModal && (
                <Modal title={t('create_vision')} onClose={() => setShowVisionModal(false)}>
                    <form onSubmit={handleCreateVision} className="space-y-4">
                         <div className="border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-center space-y-2">
                             {visionImageUrl ? (
                                 <img src={visionImageUrl} className="w-full h-40 object-cover rounded-lg" alt="Vision" />
                             ) : (
                                 <div className="text-slate-400 h-40 flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-lg">No Image</div>
                             )}
                             <div className="flex gap-2 justify-center">
                                 <div className="relative overflow-hidden">
                                    <SimpleButton type="button" variant="outline" size="sm">{t('upload_photo')}</SimpleButton>
                                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={(e) => { if(e.target.files?.[0]) handleImageUpload(e.target.files[0], `visions/${Date.now()}`).then(setVisionImageUrl) }} />
                                 </div>
                                 <SimpleButton type="button" onClick={handleGenerateVisionImage} disabled={uploading} className="bg-amber-500 text-white hover:bg-amber-600" size="sm">{t('generate_image')}</SimpleButton>
                             </div>
                         </div>

                        <Input placeholder={t('title')} value={visionTitle} onChange={e=>setVisionTitle(e.target.value)} required />
                        <textarea className="block w-full border border-slate-200 dark:border-slate-800 bg-transparent p-2 rounded-md text-sm" placeholder={t('body')} value={visionBody} onChange={e=>setVisionBody(e.target.value)} required rows={4} />
                        <Input placeholder={t('webpage')} value={visionLink} onChange={e=>setVisionLink(e.target.value)} />
                        
                        <SimpleButton type="submit" disabled={uploading} className="w-full bg-amber-500 text-white hover:bg-amber-600">{t('create_vision')}</SimpleButton>
                    </form>
                </Modal>
            )}
        </div>
    );
};