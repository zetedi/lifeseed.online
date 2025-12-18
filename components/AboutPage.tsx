
import React, { useState } from 'react';
import Logo from './Logo';
import { Icons } from './ui/Icons';
import { subscribeToNewsletter } from '../services/firebase';
import { Modal } from './ui/Modal';
import { useLanguage } from '../contexts/LanguageContext';

const ArticleImage = ({ src, alt }: { src: string, alt: string }) => {
    return (
        <span className="float-left mr-4 mb-2 mt-1">
             <img src={src} alt={alt} className="max-w-[150px] md:max-w-[200px] rounded-lg shadow-md border border-slate-200" onError={(e) => {
                 (e.target as HTMLImageElement).style.display = 'none'; 
             }}/>
        </span>
    );
};

const LinkButton = ({ href, children }: { href: string, children?: React.ReactNode }) => (
    <a 
        href={href} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="text-emerald-600 hover:text-emerald-800 font-semibold underline decoration-emerald-300 hover:decoration-emerald-600 transition-colors inline-block"
    >
        {children}
    </a>
);

export const AboutPage = () => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'phoenix' | 'tss' | 'whitepaper' | 'yantra' | 'steps'>('phoenix');
    const [showSubModal, setShowSubModal] = useState(false);
    const [email, setEmail] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const handleSubscribe = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateEmail(email)) {
            alert(t('invalid_email'));
            return;
        }
        setSubmitting(true);
        try {
            await subscribeToNewsletter(email);
            alert(`${t('subscribed_success')} ${email}`);
            setEmail("");
            setShowSubModal(false);
        } catch (e) {
            console.error("Subscription error", e);
            alert(t('subscription_failed'));
        }
        setSubmitting(false);
    };

    const stepsContent = [
      {
        title: "The first steps",
        content: (
          <div className="text-justify leading-relaxed space-y-12">
            <div>
                <p className="mb-4 text-lg font-light text-slate-800">
                We plant lightseed (our vision) with the seed of a tree we have a deep connection with in four realms:
                </p>
                <ul className="list-disc pl-6 space-y-3 mb-6 text-slate-700">
                <li>in our <b>spiritual heart</b>, with the intention of realization (or our highest goal)</li>
                <li>in the <b>soil</b> of an important place for us (or in a pot if we haven't found that place yet) for the tree to flourish (this will be our first lifetree)</li>
                <li>in our <b>community</b> or culture as an inspiration (e.g. The Secret Sun)</li>
                <li>in the <b>light</b>, in virtual (by creating our servers and online projects to be guided by nature)</li>
                </ul>
                <p className="italic text-slate-600 border-l-4 border-emerald-400 pl-4 py-2 bg-slate-50 rounded-r-lg">
                All four quadrants are ultimately (and intimately) connected with the animating force or lifeforce - the beginning of creation.
                </p>
            </div>

            <div className="flex flex-col items-center justify-center pt-10 pb-8 border-t border-slate-100 text-center space-y-6 bg-gradient-to-b from-transparent to-emerald-50/50 rounded-b-2xl -mx-6 px-6 mt-8">
                <div className="space-y-2">
                    <h3 className="text-2xl font-light text-emerald-800">{t('stand_for_trees')}</h3>
                    <p className="text-lg text-slate-600 max-w-md mx-auto">
                        {t('subscribe')}
                    </p>
                </div>
                <div className="p-4 bg-white rounded-full text-emerald-600 shadow-sm border border-emerald-100">
                    <Icons.Tree />
                </div>
                <button 
                    onClick={() => setShowSubModal(true)}
                    className="group bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-full shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center space-x-3 transform hover:-translate-y-0.5"
                >
                    <Icons.Send />
                    <span>{t('subscribe_action')}</span>
                </button>
            </div>
          </div>
        )
      }
    ];

    const phoenixContent = [
      {
        title: "Phoenix",
        content: (
          <div className="text-justify leading-relaxed">
            <ArticleImage src="/phoenix.jpg" alt="Phoenix"/>
            <p className="indent-8">
                The first living lifetree, <b>Phoenix</b>,
                planted with the intention to create a society built from self
                sustaining symbiotic organisms composed of light, trees, humans, nature
                and ai.
            </p>
          </div>
        ),
      },
      {
        title: "Mahameru, the mythical tree",
        content: (
          <div className="text-justify leading-relaxed">
            <ArticleImage src="/phoenix-willow-fire.png" alt="Mahameru" />
            <p className="indent-8">
                The first lifetree died. Its name is Mahameru, the three dimensional
                representation of the Sri Yantra. The name carried the intention: to
                connect to the deepest layer of creation and create a new society from
                there, from the bindu, from the center of the center, from the spiritual
                heart of the Universe and each and every one of us.
            </p>
          </div>
        ),
      },
      {
        title: "The nature of being",
        content: `It is vibration, so we can access it with dance. It is sound, so we can access it though singing and voice and music and it is light so we can access it with knowing, awareness, meditation and consciousness.`,
      },
    ];

    const tssContent = [
      {
        title: "The Secret Sun",
        content: (
          <p className="text-justify indent-8 leading-relaxed">
            The Secret Sun is the third part of the path of lightseed. After
            planting our intention in our heart, we plant a tree. Then the third
            part is to plant a seed in the community to foster a deeper connection
            with trees.
          </p>
        ),
      },
      {
        title: "Auspicious Signs",
        content: (
          <p className="text-justify leading-relaxed">
            For the tree named Phoenix, a platform was the best choice. interwoven with magic, the hill end up on the exact
            place where the permaculture design marked a place for a platform years
            before.
          </p>
        ),
      },
      {
        title: "Cosmic Timing and Symbolism",
        content: (
          <div className="text-justify leading-relaxed">
            The building took place through the summer solstice, the international
            yoga day and the full moon. The number 37 is present in every aspect of the platform.
            <br />
            <br />
            <i>
              “Bodhipakṣa-caryā, the practice of the 37 bodhipakṣadharmas (the
              principles conducive to bodhi) which are: the four applications of
              mindfulness, the four right efforts, the four bases of spiritual
              power, the five spiritual faculties, the five strengths, the seven
              factors of awakening and the noble eightfold path.” -
            </i>{" "}
            <LinkButton href="https://en.wikipedia.org/wiki/Bodhipakkhiy%C4%81dhamm%C4%81">
                Bodhipakkhiyādhammā
            </LinkButton>
          </div>
        ),
      },
    ];

    const whitePaperContent = [
      {
        title: "lightseed network: A Decentralized, Regenerative Ecosystem",
        content: (
          <div className="text-justify leading-relaxed">
            <p className="indent-8 my-2">
              The <b>lightseed network</b> is a decentralized, regenerative ecosystem
              rooted in the physical world, reimagining human-nature connection
              through blockchain, AI, and ecological impact. Each participant plants a <b>lifetree</b>, a
              real tree that anchors their digital identity on a custom Ethereum
              blockchain.
            </p>
            <p className="my-2">
              Planting a lifetree is a practical act, linking biological growth to a
              system powered by a proof-of-stake Ethereum fork and an online
              platform, lightseed.online. 
            </p>
          </div>
        ),
      },
      {
        title: "Lifetrees: Avatars of a New World",
        content: (
          <div className="text-justify leading-relaxed">
            <p className="indent-8 my-2">
              Each lifetree represents a profound symbiosis between humans, nature,
              and technology — an avatar that bridges the physical and digital
              realms. Mirrored as an ERC-721 NFT on
              the lightseed network's Ethereum blockchain.
            </p>
          </div>
        ),
      },
      {
        title: "The Gradual Guardianship Pathway",
        content: (
          <div className="text-justify leading-relaxed">
            <p className="indent-8 my-2">
              This step-by-step journey begins with emotional resonance and
              mindfulness, evolving into active creation and stewardship, guided by
              AI to promote health, joy, and sustainability.
            </p>
            <ul className="list-disc pl-4 pt-2 m-1 space-y-4">
              <li>
                <b>Become a Guardian: Resonance and Meditation</b>
                <br />
                Users start by adopting guardianship of an existing tree — one that
                resonates deeply and is reachable by foot.
              </li>
              <li>
                <b>AI-Guided Location Selection</b>
                <br />
                With the help of the network's collaborative AI, guardians receive personalized recommendations for
                their future lifetree location.
              </li>
            </ul>
          </div>
        ),
      },
    ];

    const renderContent = (items: {title: string, content: React.ReactNode | string}[]) => (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {items.map((item, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h2 className="text-xl font-light text-purple-900 mb-4 tracking-wide border-b border-purple-100 pb-2">{item.title}</h2>
                    <div className="text-slate-700 leading-relaxed font-serif">
                        {item.content}
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <div className="min-h-screen pb-20">
            <div className="relative bg-gradient-to-b from-purple-900 to-slate-900 text-white py-16 px-4">
                <div className="max-w-4xl mx-auto text-center">
                    <p className="text-purple-200 text-lg font-light tracking-wide">The Story, The Science, The Spirit</p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 -mt-8 relative z-10">
                 <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden min-h-[500px]">
                    <div className="flex border-b border-slate-100 overflow-x-auto">
                        {[
                            { id: 'phoenix', label: 'Phoenix' },
                            { id: 'tss', label: 'The Secret Sun' },
                            { id: 'whitepaper', label: 'White Paper' },
                            { id: 'yantra', label: 'The Yantra' },
                            { id: 'steps', label: 'The First Steps' }
                        ].map((tab) => (
                            <button 
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)} 
                                className={`flex-1 min-w-[120px] py-4 text-sm font-medium transition-colors whitespace-nowrap px-4 ${
                                    activeTab === tab.id 
                                    ? 'text-purple-600 border-b-2 border-purple-500 bg-purple-50/50' 
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="p-6 bg-slate-50/50 min-h-[500px]">
                        {activeTab === 'phoenix' && renderContent(phoenixContent)}
                        {activeTab === 'tss' && renderContent(tssContent)}
                        {activeTab === 'whitepaper' && renderContent(whitePaperContent)}
                        {activeTab === 'steps' && renderContent(stepsContent)}
                        {activeTab === 'yantra' && (
                            <div className="flex flex-col items-center justify-center space-y-8 py-10 animate-in fade-in zoom-in-95 duration-500">
                                <div className="p-8 bg-white rounded-full shadow-xl">
                                    <Logo width={200} height={200} />
                                </div>
                                <div className="max-w-xl text-center space-y-4">
                                    <h2 className="text-2xl font-light text-purple-900">The Seed of Life</h2>
                                    <p className="text-slate-600 font-serif leading-relaxed">
                                        The logo is based on the Seed of Life, a universal symbol of creation found in cultures across the globe. 
                                        Just as a seed contains the blueprint for the entire tree, each node in the lightseed network contains 
                                        the potential to regenerate the whole forest.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showSubModal && (
                <Modal title={t('subscription_title')} onClose={() => setShowSubModal(false)}>
                    <div className="space-y-4">
                        <p className="text-sm text-slate-500">{t('subscription_desc')}</p>
                        <form onSubmit={handleSubscribe} className="space-y-4">
                            <input 
                                type="email"
                                placeholder="Email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full border border-slate-300 rounded px-4 py-2"
                                required
                            />
                            <div className="flex justify-end">
                                <button type="submit" disabled={submitting} className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-50">
                                    {submitting ? "Subscribing..." : t('subscribe_action')}
                                </button>
                            </div>
                        </form>
                    </div>
                </Modal>
            )}
        </div>
    );
};
