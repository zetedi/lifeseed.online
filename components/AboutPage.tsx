
import React, { useState } from 'react';
import Logo from './Logo';
import { Icons } from './ui/Icons';
import { subscribeToNewsletter } from '../services/firebase';
import { Modal } from './ui/Modal';
import { useLanguage } from '../contexts/LanguageContext';

const SectionHeader = ({ children }: { children: React.ReactNode }) => (
    <h2 className="text-2xl font-light text-purple-900 mb-6 mt-12 tracking-wide flex items-center gap-3">
        {children}
    </h2>
);

const Paragraph = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
    <p className={`text-slate-700 leading-relaxed font-serif mb-6 text-justify text-lg ${className}`}>
        {children}
    </p>
);

// Helper to render specific geometric overlays for the Yantra section
const SymbolOverlay = ({ type }: { type: string }) => {
    const commonProps = {
        viewBox: "0 0 262 262",
        className: "absolute inset-0 w-full h-full",
        fill: "none",
        stroke: "#F59E0B", // Amber-500
        strokeWidth: "3"
    };

    switch (type) {
        case 'sun': // Circled Dot
            return (
                <svg {...commonProps}>
                    <circle cx="131" cy="131" r="64" />
                    <circle cx="131" cy="131" r="6" fill="#F59E0B" stroke="none" />
                </svg>
            );
        case 'hexagram': // Star
            return (
                <svg {...commonProps}>
                    <polygon points="131,35 214,179 48,179" />
                    <polygon points="131,227 48,83 214,83" />
                </svg>
            );
        case 'honeycomb': // Hexagon
            return (
                <svg {...commonProps}>
                    <polygon points="131,35 214,83 214,179 131,227 48,179 48,83" />
                </svg>
            );
        case 'infinity':
            return (
                <svg {...commonProps}>
                     <path d="M75 131 a 32 32 0 1 0 64 0 a 32 32 0 1 0 -64 0 M187 131 a 32 32 0 1 0 64 0 a 32 32 0 1 0 -64 0" strokeWidth="4" />
                </svg>
            );
        case 'lotus': // Petals
            return (
                <svg {...commonProps}>
                     <path d="M131 131 Q 163 99 131 67 Q 99 99 131 131" fill="rgba(245, 158, 11, 0.2)" />
                     <path d="M131 131 Q 163 163 131 195 Q 99 163 131 131" fill="rgba(245, 158, 11, 0.2)" />
                     <path d="M131 131 Q 99 99 67 131 Q 99 163 131 131" fill="rgba(245, 158, 11, 0.2)" />
                     <path d="M131 131 Q 163 99 195 131 Q 163 163 131 131" fill="rgba(245, 158, 11, 0.2)" />
                </svg>
            );
        case 'kabbalah': // Tree structure approximation
            return (
                <svg {...commonProps}>
                    <line x1="131" y1="35" x2="131" y2="227" />
                    <line x1="48" y1="83" x2="48" y2="179" />
                    <line x1="214" y1="83" x2="214" y2="179" />
                    <circle cx="131" cy="35" r="4" fill="#F59E0B" />
                    <circle cx="131" cy="131" r="4" fill="#F59E0B" />
                    <circle cx="131" cy="227" r="4" fill="#F59E0B" />
                    <circle cx="48" cy="83" r="4" fill="#F59E0B" />
                    <circle cx="214" cy="83" r="4" fill="#F59E0B" />
                </svg>
            );
        default: 
            return null;
    }
}

const SymbolCard = ({ title, description, type, link }: { title: string, description: string, type: string, link: string }) => (
    <div className="flex flex-col md:flex-row gap-6 items-center bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
        <div className="relative w-32 h-32 shrink-0">
             <div className="absolute inset-0 opacity-20">
                 <Logo width={128} height={128} />
             </div>
             <SymbolOverlay type={type} />
        </div>
        <div>
            <h3 className="text-amber-600 font-bold uppercase tracking-wider mb-2">{title}</h3>
            <p className="text-slate-600 text-sm mb-3">{description}</p>
            <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 hover:text-amber-500 flex items-center gap-1 transition-colors">
                <Icons.Link />
                <span>Read more</span>
            </a>
        </div>
    </div>
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
                        <div className="relative h-64 md:h-96 w-full rounded-2xl overflow-hidden shadow-2xl mb-8 group">
                             <img src="/tss.jpg" alt="The Secret Sun" className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-[3s]" />
                             <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                             <div className="absolute bottom-6 left-6 text-white">
                                 <h2 className="text-3xl font-light tracking-wide">The Secret Sun</h2>
                                 <p className="text-emerald-300 text-sm font-bold uppercase tracking-widest mt-1">Sacred Platform</p>
                             </div>
                        </div>

                        <Paragraph>
                            For the tree named Phoenix, the platform was the best choice. Since it is very close to the mediation path around the chateau of Hridaya France we cut a new path through the brumble towards the direction which seemed a better place for a platform. And it happened that the area and the platform itself is interwoven with magic. The first auspicious sign for building was the finding of the Bodhisattva stone, a big stone on the path. The hill does not have many stones and the Kogi people believe that finding a stone while cutting a path is a very good sign. After a couple of days of listening and cutting the way we ended up on the exact place where the permaculture design marked a place for a platform years before.
                        </Paragraph>

                        <SectionHeader>Sacred Alignments</SectionHeader>
                        <Paragraph>
                            The second auspicious sign was the holly tree, which in folklore is a sacred tree protecting the area from evil spirits and should not be cut, thus marking one side of the platform. The other side there was a group of small oak trees. These two trees are in constant battle according to folklore, emphasizing the polarity aspect. The other ones were the two stumps of the douglas firs which were cut about three years before. They were exactly across the middle so we could use them as a base and as a symbolic rebirth of the trees in a different form. The third one is the wild rose island which became apparent after the second cutting of the path and before starting of the building of the platform. When we marked the corners of the platform we hit another stone, the Heart Stone.
                        </Paragraph>

                        <SectionHeader>Cosmic Timing and Symbolism</SectionHeader>
                        <Paragraph>
                            The building took place through the summer solstice, the international yoga day and the full moon the next day, St John’s day (with a fire ceremony), St Peter’s day, Madeira Day (madeira means wood in Portuguese) and Keti Koti, the celebration of freedom from slavery in Netherlands. The number 37 is present in every aspect of the platform, sometimes deeply hidden. The marking in the concrete in the North-East corner is the number 37. There are 3x7 planks on the top. The platform wes consecrated on the second day of the seventh month, however the last layer of oil on top was soaking in the night of 3/7 and was sealed on that day with Shambo, a powerful shamanic drum. The reason why 37 was central to the symbolism is to emphasize the principles conducive to bodhi:
                        </Paragraph>
                        
                        <div className="bg-purple-50 p-6 rounded-r-2xl border-l-4 border-purple-500 italic text-purple-900 font-serif text-lg leading-relaxed shadow-sm mb-6">
                            “Bodhipakṣa-caryā, the practice of the 37 bodhipakṣadharmas (the principles conducive to bodhi) which are: the four applications of mindfulness, the four right efforts, the four bases of spiritual power, the five spiritual faculties, the five strengths, the seven factors of awakening and the noble eightfold path.” - Bodhipakkhiyādhammā
                        </div>

                        <SectionHeader>Numbers of the Universe</SectionHeader>
                        <Paragraph>
                            The other symbolic number present was the number 108. The reinforcing beams are 108 cm long each, pointing at the cosmic number prevalent in yoga, and the reason being that on average the Sun is 108 Suns away, the Moon is 108 Moons away and the Sun is 108 Earths wide.
                        </Paragraph>
                        
                        <SectionHeader>Polarity and Unity</SectionHeader>
                        <Paragraph>
                            The Yin-Yang symbol and the polarities are represented by how the middle beam is on different sides of the middle supporting beams. The handmade marks in the opposing corners also represents polarity - the one opposed to one marked with the heart does not have a mark, it’s emptiness, nothing - it’s either love or nothing. The other two opposing corners are the 37 representing the bodhisattvas and selflessness and the R, the mark of the individual, anonymous people who build the pyramids, the R put down by a desire to leave a trace and to mark. The two tree stumps below the platform are also symbolizing polarities with their roots hugging each other underground. - Heartmantra
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
                        
                        <div className="mb-10 text-center max-w-2xl mx-auto">
                            <SectionHeader>The Lifeseed Yantra</SectionHeader>
                            <Paragraph>
                                A Yantra is a geometric diagram, mainly from the Tantric traditions of the Indian religions. It is used for the worship of deities in temples or at home; as an aid in meditation; used for the benefits given by their supposed occult powers based on Hindu astrology and tantric texts. They are also used for adornment of temple floors, due mainly to their aesthetic and symmetric qualities.
                            </Paragraph>
                            <p className="text-sm text-slate-500 italic">It is a true yantra I believe.</p>
                        </div>

                        {/* Large Main Yantra */}
                        <div className="relative flex justify-center py-12 mb-16">
                             <div className="relative p-2 rounded-full border-2 border-amber-300 shadow-[0_0_80px_rgba(251,191,36,0.3)] bg-white">
                                <Logo width={300} height={300} />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <SymbolCard 
                                title="Sun & Consciousness" 
                                description="The circled dot represents the sun and consciousness. It is the center of the center, the bindu."
                                type="sun"
                                link="https://en.wikipedia.org/wiki/Circled_dot"
                            />
                            <SymbolCard 
                                title="Seed of Life" 
                                description="The seven circles imply that all life on Earth and the Universe is interconnected."
                                type="seed"
                                link="https://www.uniguide.com/seed-of-life-number-7-sacred-geometry/"
                            />
                            <SymbolCard 
                                title="Hexagram" 
                                description="It symbolizes God reaching down to man and man reaching up to God, the union of Heaven and earth."
                                type="hexagram"
                                link="https://en.wikipedia.org/wiki/Hexagram"
                            />
                            <SymbolCard 
                                title="Shambhala" 
                                description="The hidden inner and spiritual kingdom."
                                type="hexagram" // Reusing hexagram shape as it often relates to the heart chakra/kingdom
                                link="https://en.wikipedia.org/wiki/Shambhala"
                            />
                            <SymbolCard 
                                title="Sacred Lotus" 
                                description="It symbolizes the realization of inner potential."
                                type="lotus"
                                link="https://en.wikipedia.org/wiki/Sacred_lotus_in_religious_art"
                            />
                            <SymbolCard 
                                title="Honeycomb" 
                                description="The hexagonal structure symbolizing connection with nature and community."
                                type="honeycomb"
                                link="https://en.wikipedia.org/wiki/Honeycomb"
                            />
                             <SymbolCard 
                                title="Overlapping Circles" 
                                description="Connections to the DNA, the grid of life, and beyond."
                                type="infinity"
                                link="https://en.wikipedia.org/wiki/Overlapping_circles_grid"
                            />
                            <SymbolCard 
                                title="Tree of Life (Kabbalah)" 
                                description="The path of divine emanation and the map of the soul."
                                type="kabbalah"
                                link="https://en.wikipedia.org/wiki/Tree_of_life_(Kabbalah)"
                            />
                            <SymbolCard 
                                title="Infinity" 
                                description="The eternal flow of energy and the unified field."
                                type="infinity"
                                link="https://en.wikipedia.org/wiki/Infinity_symbol"
                            />
                        </div>

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
