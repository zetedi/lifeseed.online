
import React, { useState } from 'react';
import Logo from './Logo';
import { Icons } from './ui/Icons';
import { subscribeToNewsletter } from '../services/firebase';
import { Modal } from './ui/Modal';
import { useLanguage } from '../contexts/LanguageContext';

const SectionHeader = ({ children }: { children: React.ReactNode }) => (
    <h2 className="text-2xl font-light text-purple-900 mb-6 mt-8 tracking-wide border-b border-purple-200 pb-2 flex items-center gap-3">
        <span className="w-8 h-px bg-purple-400"></span>
        {children}
    </h2>
);

const Paragraph = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
    <p className={`text-slate-700 leading-relaxed font-serif mb-6 text-justify text-lg ${className}`}>
        {children}
    </p>
);

export const AboutPage = () => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'vision' | 'phoenix' | 'sun' | 'path' | 'yantra'>('vision');
    const [showSubModal, setShowSubModal] = useState(false);
    const [email, setEmail] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubscribe = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await subscribeToNewsletter(email);
            alert(`${t('subscribed_success')} ${email}`);
            setShowSubModal(false);
        } catch (e) { alert(t('subscription_failed')); }
        setSubmitting(false);
    };

    const GENESIS_TEXT = `The purpose of lightseed is to bring joy. The joy of realizing the bliss of conscious, compassionate, grateful existence by opening a portal to the center of life. By creating a bridge between creator and creation, science and spirituality, virtual and real, nothing and everything. It is designed to intimately connect our inner Self, our culture, our trees and the tree of life, the material and the digital, online world into a sustainable and sustaining circle of unified vibration, sound and light. It aims to merge us into a common flow for all beings to be liberated, wise, strong, courageous and connected. It is rooted in nonviolence, compassion, generosity, gratitude and love. It is blockchain (truthfulness), cloud (global, distributed, resilient), ai (for connecting dreams and technology), regen (nature centric) native. It is an inspiration, an impulse towards a quantum leap in consciousness, a prompt both for human and artificial intelligence for action towards transcending humanity into a new era, a New Earth, Universe and Field with the help of our most important evolutionary sisters and brothers, the trees.`;

    const tabs = [
        { id: 'vision', label: 'The Vision' },
        { id: 'phoenix', label: 'Phoenix' },
        { id: 'sun', label: 'The Secret Sun' },
        { id: 'path', label: 'The Path' },
        { id: 'yantra', label: 'The Yantra' }
    ];

    return (
        <div className="min-h-screen pb-20 bg-[#FDFCFB]">
            {/* Header with Bigger Logo & Less Space */}
            <div className="bg-purple-900 text-white pt-8 pb-12 px-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('/bg-noise.png')] opacity-10"></div>
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <div className="flex justify-center mb-4">
                        {/* Increased Logo size, reduced padding around it */}
                        <div className="bg-white/10 p-2 rounded-full backdrop-blur-sm">
                            <Logo width={100} height={100} />
                        </div>
                    </div>
                    <h1 className="text-3xl font-light tracking-[0.2em] uppercase text-purple-100">.seed</h1>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="sticky top-0 z-40 bg-[#FDFCFB]/95 backdrop-blur border-b border-slate-200 shadow-sm">
                <div className="max-w-5xl mx-auto px-0 md:px-4">
                    <div className="flex overflow-x-auto no-scrollbar md:justify-center">
                        {tabs.map(tab => (
                            <button 
                                key={tab.id} 
                                onClick={() => setActiveTab(tab.id as any)} 
                                className={`flex-shrink-0 px-6 py-4 text-xs font-bold uppercase tracking-[0.15em] transition-all border-b-2 ${
                                    activeTab === tab.id 
                                        ? 'text-purple-900 border-purple-600 bg-purple-50/50' 
                                        : 'text-slate-400 border-transparent hover:text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto p-6 md:p-12 min-h-[60vh]">
                
                {/* THE VISION */}
                {activeTab === 'vision' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white p-8 md:p-12 rounded-xl shadow-xl border border-slate-100 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 via-purple-500 to-amber-500"></div>
                            <div className="absolute -right-10 -bottom-10 opacity-5 pointer-events-none">
                                <Logo width={300} height={300} />
                            </div>
                            
                            <h2 className="text-center text-xs font-bold text-slate-400 uppercase tracking-[0.3em] mb-8">Genesis Block • 000</h2>
                            
                            <div className="prose prose-lg prose-slate mx-auto">
                                <p className="font-serif text-xl md:text-2xl leading-relaxed text-slate-800 text-justify first-letter:text-5xl first-letter:font-bold first-letter:text-purple-900 first-letter:mr-3 first-letter:float-left">
                                    {GENESIS_TEXT}
                                </p>
                            </div>

                            <div className="mt-12 pt-8 border-t border-slate-100 flex justify-between items-end">
                                <div>
                                    <p className="text-xs text-slate-400 font-mono">HASH: 0x93...a7f2</p>
                                    <p className="text-xs text-slate-400 font-mono">STATUS: IMMUTABLE</p>
                                </div>
                                <Logo width={32} height={32} className="text-slate-300" />
                            </div>
                        </div>
                    </div>
                )}

                {/* PHOENIX */}
                {activeTab === 'phoenix' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                        <div className="relative h-64 md:h-96 w-full rounded-2xl overflow-hidden shadow-2xl group">
                            <img src="/phoenix.jpg" alt="Phoenix Tree" className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-[3s]" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                            <div className="absolute bottom-6 left-6 text-white">
                                <h2 className="text-3xl font-light tracking-wide">Phoenix</h2>
                                <p className="text-emerald-300 text-sm font-bold uppercase tracking-widest mt-1">The First Living Lifetree</p>
                            </div>
                        </div>

                        <div>
                            <SectionHeader>The Mythical Lifetree</SectionHeader>
                            <Paragraph>
                                Mahameru, the first lifetree died. Its name is Mahameru, the three dimensional representation of the Sri Yantra. The name carried the intention: to connect to the deepest layer of creation and create a new society from there, from the bindu, from the center of the center, from the spiritual heart of the Universe and each and every one of us.
                            </Paragraph>
                            <Paragraph>
                                His parent is from Place Jourdain in Brussels and it was planted from a branch. It survived the winter and new lovely leaves sprouted. However the insects loved it too much and I overcared. I've buried it in the same pot where I’ve planted a new branch of a willow tree from Waterloo.
                            </Paragraph>
                            <Paragraph>
                                This is where the name Phoenix is coming from: arising from the death of creation a new Cosmic heartbeat, a new Pulse. By the way Waterloo is the place of the war which ended feudalism and brought peace for a long time.
                            </Paragraph>
                            <div className="bg-purple-50 p-6 rounded-r-2xl border-l-4 border-purple-500 italic text-purple-900 font-serif text-lg leading-relaxed shadow-sm">
                                "This is why the first living lifetree is Phoenix, planted with the intention to create a society build from self sustaining intentional symbiotic organisms composed of light, trees, humans and intelligence."
                            </div>
                        </div>
                    </div>
                )}

                {/* THE SECRET SUN */}
                {activeTab === 'sun' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <SectionHeader>The Platform</SectionHeader>
                        <Paragraph>
                            The Secret Sun is the third part of the path of lightseed. After planting our intention in our heart, we plant a tree. Then the third part is to plant a seed in the community to foster a deeper connection with trees. For that a natural choice for example is to build a platform, a fountain, a bench, a guild, a bird feeder, a beehive or a piece of art close to the tree together with the members of the community.
                        </Paragraph>

                        <SectionHeader>Auspicious Signs</SectionHeader>
                        <Paragraph>
                            For the tree named Phoenix, the platform was the best choice. Since it is very close to the mediation path around the chateau of Hridaya France we cut a new path through the brumble towards the direction which seemed a better place for a platform. And it happened that the area and the platform itself is interwoven with magic.
                        </Paragraph>
                        <Paragraph>
                            The first auspicious sign for building was the finding of the <b>Bodhisattva stone</b>, a big stone on the path. The hill does not have many stones and the Kogi people believe that finding a stone while cutting a path is a very good sign.
                        </Paragraph>
                        <Paragraph>
                            The second auspicious sign was the holly tree, which in folklore is a sacred tree protecting the area from evil spirits and should not be cut, thus marking one side of the platform. The other side there was a group of small oak trees. These two trees are in constant battle according to folklore, emphasizing the polarity aspect.
                        </Paragraph>
                        
                        <SectionHeader>Sacred Foundations</SectionHeader>
                        <Paragraph>
                            The bigger path towards the building one one hand took through Assisi, and from there are four stones embedded in the concrete on each corner of the platform. The water contains water from the temple where St. Francis’s final resting place is. The tap was just above his chamber. And from an even more overarching perspective the unmarked corner has a flower of life pendant embedded from the temple of Osiris in Abydos, Egypt, where the flower of life symbol appeared the first time according to some archeologists.
                        </Paragraph>
                    </div>
                )}

                {/* THE PATH */}
                {activeTab === 'path' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-12 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-purple-200 before:to-transparent">
                            
                            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-purple-300 bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-purple-600 font-bold">1</div>
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 bg-white rounded-xl shadow-md border border-slate-100">
                                    <h3 className="font-bold text-purple-900 mb-2 uppercase tracking-wider text-sm">Resonance</h3>
                                    <p className="text-slate-600 text-sm">Adopt guardianship of an existing tree. Commit to regular visits for meditation, reflection, and quiet observation.</p>
                                </div>
                            </div>

                            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-purple-300 bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-purple-600 font-bold">2</div>
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 bg-white rounded-xl shadow-md border border-slate-100">
                                    <h3 className="font-bold text-purple-900 mb-2 uppercase tracking-wider text-sm">Selection</h3>
                                    <p className="text-slate-600 text-sm">Receive personalized recommendations for your future lifetree location, considering species, symbolism, and environment.</p>
                                </div>
                            </div>

                            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-purple-300 bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-purple-600 font-bold">3</div>
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 bg-white rounded-xl shadow-md border border-slate-100">
                                    <h3 className="font-bold text-purple-900 mb-2 uppercase tracking-wider text-sm">Nurturing</h3>
                                    <p className="text-slate-600 text-sm">Plant your lifetree seed or sapling in a pot. For urban dwellers, a bonsai serves as a perfect, resilient avatar.</p>
                                </div>
                            </div>

                            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-emerald-500 bg-emerald-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-white font-bold">4</div>
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 bg-emerald-50 rounded-xl shadow-md border border-emerald-100">
                                    <h3 className="font-bold text-emerald-900 mb-2 uppercase tracking-wider text-sm">Initiation</h3>
                                    <p className="text-emerald-800 text-sm">Transplant the tree into soil at a communal Mother Tree hub. A ceremony of rooting, sharing stories, and collective meditation.</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-16 text-center">
                            <button 
                                onClick={() => setShowSubModal(true)}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-full font-bold shadow-lg transition-all active:scale-95 flex items-center gap-2 mx-auto"
                            >
                                <Icons.Send />
                                <span>Join the Path</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* THE YANTRA */}
                {activeTab === 'yantra' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-center mb-10">
                            <div className="p-8 bg-white rounded-full shadow-2xl border border-slate-100">
                                <Logo width={150} height={150} />
                            </div>
                        </div>

                        <SectionHeader>Symbolism & Geometry</SectionHeader>
                        <Paragraph>
                            The visual identity of .seed is rooted in the <b>Sri Yantra</b>, specifically the bindu—the center of the center. It represents the unity of masculine and feminine divine principles and the fractal nature of the universe.
                        </Paragraph>

                        <SectionHeader>37: The Principles of Awakening</SectionHeader>
                        <Paragraph>
                            The number 37 is woven into the architecture of our physical spaces (like The Secret Sun platform). It symbolizes the <b>37 Bodhipakṣadharmas</b>—the qualities conducive to enlightenment, including mindfulness, energy, and wisdom.
                        </Paragraph>

                        <SectionHeader>108: The Cosmic Rhythm</SectionHeader>
                        <Paragraph>
                            108 is a number of cosmic wholeness. In the physical structures of the network, beams are often 108cm long. This connects us to the celestial scale: the Sun is roughly 108 Sun-diameters from Earth, and the Moon is 108 Moon-diameters from Earth. It connects the micro to the macro.
                        </Paragraph>

                        <SectionHeader>Polarity & Unity</SectionHeader>
                        <Paragraph>
                            The Yin-Yang symbol and the polarities are represented in our designs. Handmade marks in opposing corners of our structures often represent this duality—one marked with a heart (love), the other empty (void). It teaches us that at the core, it is either love or nothing.
                        </Paragraph>
                    </div>
                )}

            </div>

            {showSubModal && (
                <Modal title="Stay Connected" onClose={() => setShowSubModal(false)}>
                    <form onSubmit={handleSubscribe} className="space-y-6 p-6">
                        <p className="text-slate-500 font-serif italic text-center">Receive our transmission every 7 weeks.</p>
                        <input 
                            type="email" 
                            placeholder="Your Email" 
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            className="w-full border-b-2 border-slate-200 p-4 text-center text-lg focus:border-purple-500 outline-none transition-colors" 
                            required 
                        />
                        <button type="submit" disabled={submitting} className="w-full bg-purple-600 text-white py-4 rounded-xl font-bold text-lg shadow-xl hover:bg-purple-700 transition-all">
                            {submitting ? '...' : 'SUBSCRIBE'}
                        </button>
                    </form>
                </Modal>
            )}
        </div>
    );
};
