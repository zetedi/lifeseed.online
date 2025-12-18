
import React, { useState } from 'react';
import Logo from './Logo';
import { Icons } from './ui/Icons';
import { subscribeToNewsletter } from '../services/firebase';
import { Modal } from './ui/Modal';
import { useLanguage } from '../contexts/LanguageContext';

const SectionHeader = ({ children }: { children: React.ReactNode }) => (
    <h2 className="text-3xl font-light text-purple-900 mb-8 mt-12 tracking-wide border-b border-purple-200 pb-2 flex items-center gap-3">
        <span className="w-12 h-px bg-purple-400"></span>
        {children}
    </h2>
);

const SubHeader = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-xl font-bold text-slate-800 mb-4 mt-10 uppercase tracking-[0.15em] border-l-2 border-purple-500 pl-4">{children}</h3>
);

const Paragraph = ({ children, indent = true }: { children: React.ReactNode, indent?: boolean }) => (
    <p className={`text-slate-700 leading-relaxed font-serif mb-6 text-justify text-lg ${indent ? 'indent-10' : ''}`}>
        {children}
    </p>
);

const Quote = ({ children, cite }: { children: React.ReactNode, cite?: string }) => (
    <blockquote className="my-12 border-l-4 border-purple-400 pl-8 py-6 bg-purple-50 italic text-slate-700 rounded-r-3xl shadow-sm">
        <p className="text-xl leading-relaxed font-serif">“{children}”</p>
        {cite && <cite className="block mt-6 text-sm font-sans font-bold text-purple-800 tracking-widest uppercase">— {cite}</cite>}
    </blockquote>
);

export const AboutPage = () => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'phoenix' | 'tss' | 'whitepaper' | 'pathway'>('phoenix');
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

    return (
        <div className="min-h-screen pb-20 bg-[#FDFCFB]">
            {/* Hero Header - Purple & Compact */}
            <div className="relative bg-purple-900 text-white py-16 px-4 overflow-hidden">
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <div className="flex justify-center mb-6">
                        <div className="bg-purple-800/50 p-3 rounded-full">
                            <Logo width={48} height={48} />
                        </div>
                    </div>
                    <p className="text-purple-100 text-xl md:text-2xl font-light tracking-wide max-w-2xl mx-auto font-serif italic">
                        "A bridge between creator and creation, science and spirituality, virtual and real."
                    </p>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="max-w-5xl mx-auto px-4 -mt-8 relative z-20">
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
                    <div className="flex border-b border-slate-100 overflow-x-auto bg-white/90 backdrop-blur sticky top-0 z-30">
                        {[
                            { id: 'phoenix', label: 'Phoenix' },
                            { id: 'tss', label: 'Secret Sun' },
                            { id: 'whitepaper', label: 'Whitepaper' },
                            { id: 'pathway', label: 'Pathway' }
                        ].map(tab => (
                            <button 
                                key={tab.id} 
                                onClick={() => setActiveTab(tab.id as any)} 
                                className={`flex-1 min-w-[150px] py-6 text-xs font-bold uppercase tracking-[0.2em] transition-all px-8 ${activeTab === tab.id ? 'text-purple-900 border-b-4 border-purple-600 bg-purple-50/30' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-50'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="p-8 md:p-12 max-w-3xl mx-auto">
                        {/* PHOENIX TAB */}
                        {activeTab === 'phoenix' && (
                            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                                <SectionHeader>Phoenix</SectionHeader>
                                <Paragraph>
                                    The first living lifetree, <b>Phoenix</b>, was planted with the intention to create a society built from self-sustaining symbiotic organisms composed of light, trees, humans, nature, and AI.
                                </Paragraph>

                                <SectionHeader>Mahameru, the mythical tree</SectionHeader>
                                <Paragraph>
                                    The first lifetree died. Its name is <b>Mahameru</b>, the three-dimensional representation of the Sri Yantra. The name carried the intention: to connect to the deepest layer of creation and create a new society from there, from the bindu, from the center of the center, from the spiritual heart of the Universe and each and every one of us.
                                </Paragraph>
                                <Paragraph>
                                    His parent is from Place Jourdain in Brussels and it was planted from a branch. It survived the winter and new lovely leaves sprouted. However the insects loved it too much and I overcared. I've buried it in the same pot where I’ve planted a new branch of a willow tree from Waterloo. This is where the name Phoenix is coming from: arising from the death of creation a new Cosmic heartbeat, a new Pulse. By the way Waterloo is the place of the war which ended feudalism and brought peace for a long time.
                                </Paragraph>

                                <SectionHeader>The nature of being</SectionHeader>
                                <Paragraph indent={false}>
                                    It is vibration, so we can access it with dance. It is sound, so we can access it through singing and voice and music and it is light so we can access it with knowing, awareness, meditation and consciousness.
                                </Paragraph>
                            </div>
                        )}

                        {/* SECRET SUN TAB */}
                        {activeTab === 'tss' && (
                            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                                <SectionHeader>The Secret Sun</SectionHeader>
                                <Paragraph>
                                    The Secret Sun is the third part of the path of lightseed. After planting our intention in our heart, we plant a tree. Then the third part is to plant a seed in the community to foster a deeper connection with trees. For that a natural choice for example is to build a platform, a fountain, a bench, a guild, a bird feeder, a beehive or a piece of art close to the tree together with the members of the community.
                                </Paragraph>

                                <SectionHeader>Auspicious Signs</SectionHeader>
                                <Paragraph>
                                    For the tree named Phoenix, the platform was the best choice. Since it is very close to the mediation path around the chateau of Hridaya France we cut a new path through the brumble towards the direction which seemed a better place for a platform. And it happened that the area and the platform itself is interwoven with magic. 
                                </Paragraph>
                                <Paragraph>
                                    The first auspicious sign for building was the finding of the <b>Bodhisattva stone</b>, a big stone on the path. The hill does not have many stones and the Kogi people believe that finding a stone while cutting a path is a very good sign. After a couple of days of listening and cutting the way we ended up on the exact place where the permaculture design marked a place for a platform years before.
                                </Paragraph>

                                <SectionHeader>Sacred Alignments</SectionHeader>
                                <Paragraph>
                                    The second auspicious sign was the holly tree, which in folklore is a sacred tree protecting the area from evil spirits and should not be cut, thus marking one side of the platform. The other side there was a group of small oak trees. These two trees are in constant battle according to folklore, emphasizing the polarity aspect. 
                                </Paragraph>
                                <Paragraph>
                                    The other ones were the two stumps of the douglas firs which were cut about three years before. They were exactly across the middle so we could use them as a base and as a symbolic rebirth of the trees in a different form. The third one is the wild rose island which became apparent after the second cutting of the path and before starting of the building of the platform. When we marked the corners of the platform we hit another stone, the <b>Heart Stone</b>.
                                </Paragraph>

                                <SectionHeader>Cosmic Timing and Symbolism</SectionHeader>
                                <Paragraph>
                                    The building took place through the summer solstice, the international yoga day and the full moon the next day, St John’s day (with a fire ceremony), St Peter’s day, Madeira Day (madeira means wood in Portuguese) and Keti Koti, the celebration of freedom from slavery in Netherlands. The number 37 is present in every aspect of the platform, sometimes deeply hidden. 
                                </Paragraph>
                                <Paragraph>
                                    The marking in the concrete in the North-East corner is the number 37. There are 3x7 planks on the top. The platform was consecrated on the second day of the seventh month, however the last layer of oil on top was soaking in the night of 3/7 and was sealed on that day with Shambo, a powerful shamanic drum. The reason why 37 was central to the symbolism is to emphasize the principles conducive to bodhi:
                                </Paragraph>

                                <Quote cite="Bodhipakkhiyādhammā">
                                    Bodhipakṣa-caryā, the practice of the 37 bodhipakṣadharmas (the principles conducive to bodhi) which are: the four applications of mindfulness, the four right efforts, the four bases of spiritual power, the five spiritual faculties, the five strengths, the seven factors of awakening and the noble eightfold path.
                                </Quote>

                                <SectionHeader>Numbers of the Universe</SectionHeader>
                                <Paragraph>
                                    The other symbolic number present was the number 108. The reinforcing beams are 108 cm long each, pointing at the cosmic number prevalent in yoga, and the reason being that on average the Sun is 108 Suns away, the Moon is 108 Moons away and the Sun is 108 Earths wide.
                                </Paragraph>

                                <SectionHeader>Polarity and Unity</SectionHeader>
                                <Paragraph>
                                    The Yin-Yang symbol and the polarities are represented by how the middle beam is on different sides of the middle supporting beams. The handmade marks in the opposing corners also represents polarity - the one opposed to one marked with the heart does not have a mark, it’s emptiness, nothing - it’s either love or nothing. 
                                </Paragraph>
                                <Paragraph>
                                    The other two opposing corners are the 37 representing the bodhisattvas and selflessness and the R, the mark of the individual, anonymous people who build the pyramids, the R put down by a desire to leave a trace and to mark. The two tree stumps below the platform are also symbolizing polarities with their roots hugging each other underground. - Heartmantra
                                </Paragraph>

                                <SectionHeader>Sacred Foundations</SectionHeader>
                                <Paragraph indent={false}>
                                    The bigger path towards the building one one hand took through Assisi, and from there are four stones embedded in the concrete on each corner of the platform. The water contains water from the temple where St. Francis’s final resting place is. The tap was just above his chamber. And from an even more overarching perspective the unmarked corner has a flower of life pendant embedded from the temple of Osiris in Abydos, Egypt, where the flower of life symbol appeared the first time according to some archeologists.
                                </Paragraph>
                            </div>
                        )}

                        {/* WHITEPAPER TAB */}
                        {activeTab === 'whitepaper' && (
                            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                                <SectionHeader>Lifetree Network: A Decentralized, Regenerative Ecosystem</SectionHeader>
                                <Paragraph>
                                    The <b>Lifetree Network</b> is a decentralized, regenerative ecosystem rooted in the physical world, reimagining human-nature connection through blockchain, AI, and ecological impact. Inspired by mycorrhizal networks — nature’s underground web of resource-sharing trees and fungi — it integrates humans, organizations, and AI into a digital mycelium. Each participant plants a lifetree, a real tree that anchors their digital identity on a custom Ethereum blockchain, driving a sustainable future.
                                </Paragraph>
                                <Paragraph>
                                    Planting a lifetree is a practical act, linking biological growth to a system powered by a proof-of-stake Ethereum fork and an online platform, <b>lifeseed.online</b>. Drawing on quantum entanglement as a metaphor for interconnectedness, inspired by photosynthesis’ quantum coherence, the network aligns human intent, agentic AI, and ecological cycles. Your lifetree is your identity and gateway to reciprocity, reconnecting humans with nature’s wisdom.
                                </Paragraph>

                                <SubHeader>Lifetrees: Avatars of a New World</SubHeader>
                                <Paragraph>
                                    Each lifetree represents a profound symbiosis between humans, nature, and technology — an avatar that bridges the physical and digital realms to foster regenerative living. Mirrored as an ERC-721 NFT on the Lifetree Network's Ethereum blockchain, a lifetree forges unbreakable bonds with other participants, forming global networks of trust and reciprocity.
                                </Paragraph>
                                <Paragraph>
                                    Pseudonymous identities ensure privacy while unlocking transparent, verified interactions, enabling the creation of "forests" as dynamic communities visualized through lifeseed.online’s interactive graphs.
                                </Paragraph>

                                <SectionHeader>Economy of Flow: NetLeaves</SectionHeader>
                                <Paragraph>
                                    Traditional currencies disconnect value from life. The Lifetree Network’s <b>NetLeaves</b>, an ERC-20 token, is a decaying, regenerative currency created through contributions like bartering or teaching. Tracked on the blockchain with a lineage, NetLeaves decay (1% monthly) to ensure engagement, returning to the “trunk history” like tree rings. The decay rate depends on the creation bound to it, particularly when the creation is changing hands, ensuring that value remains tied to ongoing ecological and communal impact. Circular product cycles sequester carbon, earning credits e.g. via Verra’s API, ultimately optimized by quantum AI.
                                </Paragraph>

                                <SectionHeader>AI as Mycelial Guide</SectionHeader>
                                <Paragraph>
                                    Collaborative AI, powered by advanced LLMs and quantum machine learning (QML), matches lifetrees’ offerings (e.g., skills, resources) and needs (e.g., dreams, ecological visions) to foster regenerative partnerships. Delivered via lifeseed.online’s interfaces, AI aligns matches with ecological goals like carbon sequestration, using QML on quantum simulators to optimize connections. Digital Mother Trees, hosting edge AI servers, act as hubs, enhancing network coordination and trust with transparent, ethical algorithms.
                                </Paragraph>

                                <SectionHeader>Technical Framework</SectionHeader>
                                <Paragraph indent={false}>
                                    The network operates on a proof-of-stake Ethereum fork, minimizing energy use per 2025’s sustainability standards. Arbitrum Layer 2 ensures scalable, low-cost transactions for global adoption.
                                </Paragraph>
                                <ul className="list-disc pl-10 space-y-4 mb-8 text-slate-700 font-serif">
                                    <li><b>NetLeaves:</b> ERC-20 with Solidity 0.8.x smart contracts managing decay and lineage.</li>
                                    <li><b>Identities:</b> ERC-721 NFTs storing metadata (planting date, location) with QKD security.</li>
                                    <li><b>Governance:</b> Circle packing inspired peer approval (7 or 13), hosted on Mother Tree nodes.</li>
                                </ul>
                                
                                <SubHeader>Scope and Implementation</SubHeader>
                                <Paragraph>
                                    lightseed.online serves both as an example of a journey of planting the seed of an intention and the source of the API and architecture. lifeseed.online is where individual lifetrees become a forest. It is also a reference implementation of a lightseed node. The 2025 pilot targets 100–500 lifetrees, with 5–10 Mother Trees and at least three Digital Mother Trees as blockchain and AI hubs.
                                </Paragraph>
                            </div>
                        )}

                        {/* PATHWAY TAB */}
                        {activeTab === 'pathway' && (
                            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                                <SectionHeader>The Gradual Guardianship Pathway</SectionHeader>
                                <Paragraph indent={false}>
                                    This step-by-step journey begins with emotional resonance and mindfulness, evolving into active creation and stewardship, guided by AI to promote health, joy, and sustainability.
                                </Paragraph>

                                <SubHeader>1. Become a Guardian: Resonance and Meditation</SubHeader>
                                <Paragraph>
                                    Users start by adopting guardianship of an existing tree — one that resonates deeply and is reachable by foot. Through the mobile-optimized platform, participants register their guardianship. Guardians commit to regular visits for meditation, reflection, or quiet observation, fostering mental health and joy through nature immersion.
                                </Paragraph>

                                <SubHeader>2. AI-Guided Location Selection</SubHeader>
                                <Paragraph>
                                    With the help of the network's collaborative AI, guardians receive personalized recommendations for their future lifetree location. The AI considers resonance factors like tree species, symbolic meaning, and local environmental data (soil quality, sunlight).
                                </Paragraph>

                                <SubHeader>3. Pot Planting: Nurturing the Seed</SubHeader>
                                <Paragraph>
                                    Guardians plant their lifetree seed or sapling in a pot — a portable vessel allowing for initial growth in any setting. For large cities where soil access is limited, <b>bonsai trees</b> serve as an ideal alternative: Compact, resilient, and symbolically potent, bonsais enable urban participants to cultivate their avatar without space constraints.
                                </Paragraph>

                                <SubHeader>4. Initiation Ceremony: Rooting in Soil</SubHeader>
                                <Paragraph>
                                    The journey culminates in a ceremonial initiation, where the potted lifetree is transplanted into soil—either at the AI-selected site or a communal Mother Tree hub. These events blend ritual and community: Participants share stories, meditate collectively, and witness their lifetree's rooting as a metaphor for personal and planetary growth.
                                </Paragraph>

                                <div className="mt-20 bg-purple-900 text-white p-12 rounded-[3rem] text-center shadow-2xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-8 opacity-10">
                                        <Icons.Tree />
                                    </div>
                                    <h4 className="text-3xl font-light mb-4 tracking-widest uppercase">Stand for the Trees</h4>
                                    <p className="text-purple-100 mb-8 font-serif text-lg">"Plant your intention in the heart of the community."</p>
                                    <button 
                                        onClick={() => setShowSubModal(true)}
                                        className="bg-white text-purple-900 hover:bg-purple-50 font-bold py-4 px-12 rounded-full shadow-lg transition-all active:scale-95 flex items-center gap-3 mx-auto"
                                    >
                                        <Icons.Send />
                                        <span>SUBSCRIBE</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showSubModal && (
                <Modal title={t('subscription_title')} onClose={() => setShowSubModal(false)}>
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
