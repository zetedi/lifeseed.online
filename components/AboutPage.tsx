
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

const LinkButton = ({ href, children }: { href: string, children: React.ReactNode }) => (
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
                planted with the intention to create a society build from self
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
                heart of the Universe and each and every one of us. His parent is from
                Place Jourdain in Brussels and it was planted from a branch. It survived
                the winter and new lovely leaves sprouted. However the insects loved it
                too much and I overcared. I've buried it in the same pot where I’ve
                planted a new branch of a willow tree from Waterloo. This is where the
                name Phoenix is coming from: arising from the death of creation a new
                Cosmic heartbeat, a new Pulse. By the way Waterloo is the place of the
                war which ended feudalism and brought peace for a long time.
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
            with trees. For that a natural choice for example is to build a
            platform, a fountain, a bench, a guild, a bird feeder, a beehive or a
            piece of art close to the tree together with the members of the
            community.
          </p>
        ),
      },
      {
        title: "Images of the Process",
        content: (
          <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-center text-slate-400">
            [Gallery Placeholder: Images of The Secret Sun process would appear here]
          </div>
        ),
      },
      {
        title: "Auspicious Signs",
        content: (
          <p className="text-justify leading-relaxed">
            For the tree named Phoenix, the platform was the best choice. Since it
            is very close to the mediation path around the chateau of Hridaya France
            we cut a new path through the brumble towards the direction which seemed
            a better place for a platform. And it happened that the area and the
            platform itself is interwoven with magic. The first auspicious sign for
            building was the finding of the Bodhisattva stone, a big stone on the
            path. The hill does not have many stones and the Kogi people believe
            that finding a stone while cutting a path is a very good sign. After a
            couple of days of listening and cutting the way we ended up on the exact
            place where the permaculture design marked a place for a platform years
            before.
          </p>
        ),
      },
      {
        title: "Sacred Alignments",
        content: (
          <p className="text-justify leading-relaxed">
            The second auspicious sign was the holly tree, which in folklore is a
            sacred tree protecting the area from evil spirits and should not be cut,
            thus marking one side of the platform. The other side there was a group
            of small oak trees. These two trees are in constant battle according to
            folklore, emphasizing the polarity aspect. The other ones were the two
            stumps of the douglas firs which were cut about three years before. They
            were exactly across the middle so we could use them as a base and as a
            symbolic rebirth of the trees in a different form. The third one is the
            wild rose island which became apparent after the second cutting of the
            path and before starting of the building of the platform. When we marked
            the corners of the platform we hit another stone, the Heart Stone.
          </p>
        ),
      },
      {
        title: "Cosmic Timing and Symbolism",
        content: (
          <div className="text-justify leading-relaxed">
            The building took place through the summer solstice, the international
            yoga day and the full moon the next day, St John’s day (with a fire
            ceremony), St Peter’s day, Madeira Day (madeira means wood in
            Portuguese) and Keti Koti, the celebration of freedom from slavery in
            Netherlands. The number 37 is present in every aspect of the platform,
            sometimes deeply hidden. The marking in the concrete in the North-East
            corner is the number 37. There are 3x7 planks on the top. The platform
            wes consecrated on the second day of the seventh month, however the last
            layer of oil on top was soaking in the night of 3/7 and was sealed on
            that day with Shambo, a powerful shamanic drum. The reason why 37 was
            central to the symbolism is to emphasize the principles conducive to
            bodhi:
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
      {
        title: "Numbers of the Universe",
        content: (
          <p className="text-justify leading-relaxed">
            The other symbolic number present was the number 108. The reinforcing
            beams are 108 cm long each, pointing at the cosmic number prevalent in
            yoga, and the reason being that on average the Sun is 108 Suns away, the
            Moon is 108 Moons away and the Sun is 108 Earths wide. -
          </p>
        ),
      },
      {
        title: "Polarity and Unity",
        content: (
          <div className="text-justify leading-relaxed">
            The Yin-Yang symbol and the polarities are represented by how the middle
            beam is on different sides of the middle supporting beams. The handmade
            marks in the opposing corners also represents polarity - the one opposed
            to one marked with the heart does not have a mark, it’s emptiness,
            nothing - it’s either love or nothing. The other two opposing corners
            are the 37 representing the bodhisattvas and selflessness and the R, the
            mark of the individual, anonymous people who build the pyramids, the R
            put down by a desire to leave a trace and to mark. The two tree stumps
            below the platform are also symbolizing polarities with their roots
            hugging each other underground. -{" "}
            <LinkButton href="https://www2.kenyon.edu/Depts/Religion/Fac/Adler/Reln260/Heartmantra.htm">
                Heartmantra
            </LinkButton>
          </div>
        ),
      },
      {
        title: "Sacred Foundations",
        content: `The bigger path towards the building one one hand took through Assisi, and from there are four stones embedded in the concrete on each corner of the platform. The water contains water from the temple where St. Francis’s final resting place is. The tap was just above his chamber. And from an even more overarching perspective the unmarked corner has a flower of life pendant embedded from the temple of Osiris in Abydos, Egypt, where the flower of life symbol appeared the first time according to some archeologists.`,
      },
    ];

    const whitePaperContent = [
      {
        title: "Lifetree Network: A Decentralized, Regenerative Ecosystem",
        content: (
          <div className="text-justify leading-relaxed">
            <p className="indent-8 my-2">
              The <b>Lifetree Network</b> is a decentralized, regenerative ecosystem
              rooted in the physical world, reimagining human-nature connection
              through blockchain, AI, and ecological impact. Inspired by mycorrhizal
              networks — nature’s underground web of resource-sharing trees and
              fungi — it integrates humans, organizations, and AI into a{" "}
              <b>digital mycelium</b>. Each participant plants a <b>lifetree</b>, a
              real tree that anchors their digital identity on a custom Ethereum
              blockchain, driving a sustainable future.
            </p>
            <p className="my-2">
              Planting a lifetree is a practical act, linking biological growth to a
              system powered by a proof-of-stake Ethereum fork and an online
              platform, lifeseed.online. Drawing on quantum entanglement as a
              metaphor for interconnectedness, inspired by photosynthesis’ quantum
              coherence, the network aligns human intent, agentic AI, and ecological
              cycles. Your lifetree is your identity and gateway to reciprocity,
              reconnecting humans with nature’s wisdom.
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
              realms to foster regenerative living. Mirrored as an ERC-721 NFT on
              the Lifetree Network's Ethereum blockchain, a lifetree forges
              unbreakable bonds with other participants, forming global networks of
              trust and reciprocity.
            </p>
            <p className="my-2">
              Pseudonymous identities ensure privacy while unlocking transparent,
              verified interactions, enabling the creation of "forests" as dynamic
              communities visualized through <b>lifeseed.online</b>’s interactive
              graphs. To make this vision accessible and transformative for all —
              regardless of location, resources, or experience — the Lifetree
              Network introduces a <b>Gradual Guardianship Pathway</b>.
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
              AI to promote health, joy, and sustainability. It addresses urban
              challenges, such as limited space in large cities, by incorporating
              flexible options like bonsai trees, ensuring that anyone can
              participate and thrive in harmony with the network's mycelial ethos.
            </p>
            <ul className="list-disc pl-4 pt-2 m-1 space-y-4">
              <li>
                <b>Become a Guardian: Resonance and Meditation</b>
                <br />
                Users start by adopting guardianship of an existing tree — one that
                resonates deeply and is reachable by foot. This could be a nearby
                oak in a park, a street-side maple, or any tree that evokes a sense
                of connection and calm. Through the mobile-optimized lifeseed.online
                platform, participants register their guardianship, linking it to
                their pseudonymous digital identity. The act is simple yet profound:
                Guardians commit to regular visits for meditation, reflection, or
                quiet observation, fostering mental health and joy through nature
                immersion. Shared experiences — such as journaling insights or
                uploading photos — are logged on the blockchain, earning initial
                NetLeaves (the network's decaying, regenerative ERC-20 token) to
                encourage ongoing engagement. This phase draws on the therapeutic
                benefits of tree-based mindfulness, reconnecting individuals with
                nature’s wisdom.
              </li>
              <li>
                <b>AI-Guided Location Selection:</b>
                <br />
                Aligning Intent with Ecology With the help of the network's
                collaborative AI, guardians receive personalized recommendations for
                their future lifetree location (if they choose so). The AI considers
                the Guardian's resonance factors like tree species or symbolic
                meaning, local environmental data (e.g., soil quality, sunlight via
                integrated APIs like Google Earth Engine), and ecological goals
                (e.g., carbon sequestration hotspots). For urban dwellers,
                suggestions prioritize nearby parks, community gardens, or even
                rooftop spaces. In arid or densely populated areas, the AI might
                recommend resilient species or collaborative planting sites. This
                step ensures the lifetree's placement maximizes regenerative impact,
                while QML optimizations simulate growth outcomes to inspire
                confidence and joy in the process.
              </li>
              <li>
                <b>Pot Planting: Nurturing the Seed</b>
                <br />
                Once a location is chosen (or even before), Guardians plant their
                lifetree seed or sapling in a pot — a portable, nurturing vessel
                that allows for initial growth in any setting, from apartments to
                balconies. This phase emphasizes care and intention, with the app
                providing AI - driven tips on watering, sunlight, and health
                monitoring. For large cities where soil access is limited, bonsai
                trees serve as an ideal alternative: Compact, resilient, and
                symbolically potent, bonsais enable urban participants to cultivate
                their avatar without space constraints, while still contributing to
                air purification and micro-carbon sequestration. The pot-planted
                lifetree is minted as a preliminary NFT, with metadata tracking its
                "incubation" stage and linking to NetLeaves rewards for milestones
                like first leaves or health check-ins.
              </li>
              <li>
                <b>Initiation Ceremony: Rooting in Soil</b>
                <br />
                The journey culminates in a ceremonial initiation, where the potted
                lifetree is transplanted into soil—either at the AI-selected site or
                a communal Mother Tree hub. These events, hosted at global gathering
                points, blend ritual and community: Participants share stories,
                meditate collectively, and witness their lifetree's rooting as a
                metaphor for personal and planetary growth. In urban contexts,
                bonsais may transition to shared gardens or parks via partnerships
                with local initiatives. The full NFT activation occurs here,
                embedding planting details (date, GPS coordinates with privacy
                controls) and unlocking advanced network features like forest
                formations and governance participation. This pathway transforms
                lifetree creation from a singular act into a mindful evolution,
                ensuring inclusivity for billions. Guardianship activities integrate
                seamlessly with the network's economy, where contributions like
                meditation shares or tree care generate NetLeaves, decaying to
                promote continuous flow and alignment with natural cycles. As
                lifetrees mature—potentially evolving into Mother Trees—they become
                hubs for activism, festivals, and AI-coordinated partnerships,
                driving deeper bonds and a thriving, regenerative future.
              </li>
            </ul>
          </div>
        ),
      },
      {
        title: "Economy of Flow: NetLeaves",
        content: (
          <div className="text-justify leading-relaxed">
            <p className="indent-8 my-2">
              Traditional currencies disconnect value from life. The Lifetree
              Network’s <b>NetLeaves</b>, an ERC-20 token, is a decaying,
              regenerative currency created through contributions like bartering or
              teaching. Tracked on the blockchain with a lineage, NetLeaves decay to
              ensure engagement, returning to the “trunk history” like tree rings.
              The decay rate depends on the creation bound to it, particularly when
              the creation is changing hands, ensuring that value remains tied to
              ongoing ecological and communal impact. Circular product cycles
              sequester carbon, earning credits e.g. via Verra’s API, ultimately
              optimized by quantum AI. It is a dawn of{" "}
              <b>transformational economy</b>, where NetLeaves are the currency of
              the future, a new paradigm for human engagement with the natural
              world.
            </p>
          </div>
        ),
      },
      {
        title: "AI as Mycelial Guide",
        content: (
          <div className="text-justify leading-relaxed">
            <p className="indent-8 my-2">
              Collaborative AI, powered by advanced LLMs and quantum machine
              learning (QML), matches lifetrees’ offerings (e.g., skills, resources)
              and needs (e.g., dreams, ecological visions) to foster regenerative
              partnerships. Delivered via lifeseed.online’s interfaces, AI aligns
              matches with ecological goals like carbon sequestration, using QML on
              quantum simulators to optimize connections.
              <b>Digital Mother Trees</b>, hosting edge AI servers, act as hubs,
              enhancing network coordination and trust with transparent, ethical
              algorithms.
            </p>
          </div>
        ),
      },
      {
        title: "Real-World Impact",
        content: (
          <div className="text-justify leading-relaxed">
            <p className="indent-8 my-2">
              Lifetrees drive activism, with <b>Mother Trees</b> as global gathering
              points for festivals and councils. Evolving lifetrees become Mother
              Trees, ecological and blockchain hubs running Ethereum nodes and AI
              servers, supporting forests through AI-driven connections. The
              network’s restartable design, backed by blockchain’s immutable ledger,
              ensures resilience, yielding more trees, deeper bonds, and a thriving
              future.
            </p>
          </div>
        ),
      },
      {
        title: "Technical Framework",
        content: (
          <div className="text-justify leading-relaxed">
            <p className="indent-8 my-2">
              The Lifetree Network integrates a custom Ethereum blockchain, a
              mobile-optimized React platform, and advanced AI to create a
              decentralized, regenerative ecosystem. Designed for scalability and
              ecological impact, the prototype leverages blockchain’s transparency,
              AI’s matchmaking, and real-world data to reconnect humans and nature.
              Digital Mother Trees in the digital mycelium are the ecosystem hubs.
            </p>
          </div>
        ),
      },
      {
        title: "lightseed.online vs. lifeseed.online",
        content: (
          <div className="text-justify leading-relaxed">
            <p className="indent-8 my-2">
              <b>lightseed.online</b> serves both as as an exaple of a journey of
              planting the seed of an intention (in this case to create the Lifetree
              Network) in the four realms and the source of the API and
              architecture. The singular lifetree journey will be very different,
              however the Tree we share. The Tree is the tree of life and the
              blockchain of the whole forest containing reference or the actual
              individual blockchains of the distributed nodes. <br />
            </p>
            <p className="indent-8 my-2">
              <b>lifeseed.online</b> is a where individual lifetrees become a
              forest. It is also a reference implementation of a lightseed node.
              Built to demonstrate key features like lifetree NFT minting and
              AI-driven matchmaking, lifeseed.online offers a tangible, working
              model to inspire developers and communities.
            </p>
          </div>
        ),
      },
      {
        title: "Ethereum Blockchain: The Network’s Backbone",
        content: (
          <div className="text-justify leading-relaxed">
            <p className="indent-8 my-2">
              The network operates on a proof-of-stake Ethereum fork, minimizing
              energy use per 2025’s sustainability standards. Arbitrum Layer 2
              ensures scalable, low-cost transactions for global adoption. Key
              components include:
            </p>
            <ul className="list-disc pl-4 pt-2 m-1 space-y-2">
              <li>
                <b>Lifetree NetLeaves:</b> An ERC-20 token, created through
                contributions (e.g., bartering, teaching), with Solidity 0.8.x smart
                contracts managing decay (e.g., 1% monthly based on ecological
                impact) and lineage. Chainlink oracles integrate data (e.g., tree
                growth, carbon sequestration) to trigger rewards or decay.{" "}
              </li>
              <li>
                <b>Lifetree Identities:</b> ERC-721 NFTs store metadata (e.g.,
                planting date, location) with pseudonymous privacy controls. Quantum
                key distribution (QKD) secures inter-blockchain communication,
                ensuring trust across networks.
              </li>
              <li>
                <b>Governance:</b> Smart contracts enable peer approval in groups of
                7 or 13, inspired by circle packing and consciousness patterns
                (e.g., six or twelve entities around a central one). Groups, hosted
                on Mother Tree nodes, vote on proposals (e.g., resource allocation,
                community projects) using weighted consensus. AI optimizes group
                formation, aligning members with ecological goals (e.g., carbon
                sequestration). Vetoes escalate to councils of 13, recorded
                immutably on the blockchain for transparency.
              </li>
            </ul>
            <p className="my-2">
              Mother Trees host Geth nodes, acting as decentralized blockchain hubs,
              enhancing network resilience. The fork is deployed using Hardhat, with
              a Sepolia testnet for pilot testing.
            </p>
          </div>
        ),
      },
      {
        title: "React Platform: Lifeseed.online",
        content: (
          <div className="text-justify leading-relaxed">
            <p className="indent-8 my-2">
              The lifeseed.online platform delivers a mobile-optimized web
              interface. Integrated with Ethereum via 'ethers.js', it includes:
              </p>
              <ul className="list-disc pl-4 pt-2 m-1 space-y-2">
                <li>
                  <b>NetLeaves Dashboard:</b> Tracks token balance, lineage, and
                  Verra API carbon credits. Lifetree Profile: Manages NFT-based
                  identities, with privacy options (e.g., hide coordinates).
                </li>
                <li>
                  <b>Transaction Graphs:</b> D3.js visualizes lifetree connections,
                  with QML enhancing trust-based line widths.{" "}
                </li>
                <li>
                  <b>Governance Interface:</b>Supports group-based (7 or 13)
                  proposal submissions, voting, and veto tracking, with real-time
                  updates on Mother Tree hubs.
                </li>
                <li>
                  <b>Mother Tree Hub Interface:</b> Monitors node status and
                  AI-driven matches for local communities.{" "}
                </li>
              </ul>
            <p className="my-2">
              The modular design supports future React Native apps, ensuring
              accessibility on mobile and desktop.
            </p>
          </div>
        ),
      },
      {
        title: "AI and Quantum Machine Learning",
        content: (
          <div className="text-justify leading-relaxed">
            <p className="indent-8 my-2">
              Collaborative AI drives regenerative partnerships, blending classical
              and quantum approaches:
            </p>
              <ul className="list-disc pl-4 pt-2 m-1 space-y-2">
                <li>
                  <b>Classical AI:</b> Advanced LLMs match lifetrees’ offerings
                  (e.g., skills, resources) and needs (e.g., dreams, ecological
                  visions), aligning with goals like carbon sequestration or
                  community resilience.
                </li>
                <li>
                  <b>Quantum Machine Learning:</b> QML (PennyLane) optimizes
                  matchmaking and governance, processing ecological and social data
                  (e.g., tree health, user contributions, peer approval).
                </li>
              </ul>
            <p className="my-2">
              Mother Trees host AI node servers (e.g., edge devices with QML
              models), coordinating local matches and governance. Ethical
              AI—transparent algorithms, bias mitigation, human oversight—ensures
              trust, addressing 2025’s fairness concerns.
            </p>
          </div>
        ),
      },
      {
        title: "Real-World Integration",
        content: (
          <div className="text-justify leading-relaxed">
            <p className="indent-8 my-2">
              The prototype integrates external data for impact:
            </p>
              <ul className="list-disc pl-4 pt-2 m-1 space-y-2">
                <li>
                  <b>Carbon Credits:</b>
                  Verra’s API verifies tree planting and recycling, issuing credits
                  to fund operations.
                </li>
                <li>
                  <b>Tree Monitoring:</b> Google Earth Engine’s satellite imagery
                  tracks lifetree health, feeding smart contracts via oracles.
                </li>
                <li>
                  <b>Quantum Sensing:</b> Photon-based sensors, planned for future
                  iterations, enhance Lifeseed Certification by measuring tree
                  vitality.
                </li>
                <li>
                  <b>NGO partnerships</b> (e.g., One Tree Planted) support scalable
                  planting, with 5–10 Mother Trees as initial hubs in the pilot.
                </li>
              </ul>
          </div>
        ),
      },
      {
        title: "Pilot Scope",
        content: (
          <div className="text-justify leading-relaxed">
            <p className="indent-8 my-2">
              The 2025 pilot targets 100–500 lifetrees, with 5–10 Mother Trees and
              at least three Digital Mother Trees as blockchain and AI hubs running
              lightseed nodes.
            </p>
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
                                        It consists of seven circles with the same diameter, representing the six days of creation. 
                                        Here, it symbolizes the fundamental connection between all living things, the digital and biological realms, 
                                        and the infinite potential contained within a single seed.
                                    </p>
                                    <p className="text-slate-600 font-serif leading-relaxed">
                                        Just as a seed contains the blueprint for the entire tree, each node in the Lifetree Network contains 
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
