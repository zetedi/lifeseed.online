
import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import {
  logout,
  fetchEventPulses,
  createEvent,
  updateEvent,
  mintPulse,
  growVision,
  getVisionById,
  plantLifetree,
  uploadBase64Image,
  validateLifetree,
  unvalidateLifetree,
  proposeAlignment,
  acceptAlignment,
  rejectAlignment,
  signAlignmentCovenant,
  getCovenantForAlignment,
  getAlignmentById,
  getLifetreeById,
  getPulseById,
  createVision,
  deleteLifetree,
  deleteVision,
  ensureGenesis,
  syncInitiatesMirror,
  claimSuperAdmin,
  grantAdmin,
  revokeAdmin,
  getCommunityByDomain,
  getDataAuthority,
  listenToUserProfile,
  getPendingTreeInvites
} from './services/firebase';
import { setActiveIntelligenceId } from './services/intelligence';
import { SigningKeyNeedsRestoreError } from './services/keys';
import { tabTone, tabFg, CTA_GLOW } from './utils/tabTheme';
import { type Pulse, type Lifetree, type Alignment, type Vision, type Community, type DataAuthority, type ReachAudience } from './types';
import Logo from './components/Logo';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { SessionProvider, useSession } from './contexts/SessionContext';
import { isSeedShellHost, useConfig } from './hooks/useConfig';
import { useSiteTheme } from './hooks/useSiteTheme';
import { useReaches } from './hooks/useReaches';
import { useResonance } from './hooks/useResonance';
import { useHistoryLayers } from './hooks/useHistoryLayers';
import { useForestFeed } from './hooks/useForestFeed';
import { useOrderedEvents } from './hooks/useOrderedEvents';
import { useAlignmentCards } from './hooks/useAlignmentCards';
import { useAppRouting, topLevelRoute } from './hooks/useAppRouting';
import { GDPRBanner } from './components/GDPRBanner';
import { readPhotoProvenance } from './utils/exif';

// Components — the always-present shell (nav, footer, loaders, dialogs) stays statically imported.
import { Icons } from './components/ui/Icons';
import { Navigation } from './components/Navigation';
import { canEditEvent, eventFeedScope, eventsOnView } from './domain/pulseVisibility';
import { passesForestFilter, canViewTree } from './domain/views/forest';
import { isWateringOverdue } from './domain/watering';
import { isBedTree } from './domain/bed';
import { Loading } from './components/ui/Loading';
import { NetworkStatus } from './components/ui/NetworkStatus';
import { EventCard } from './components/EventCard';
import { CareModal } from './components/CareModal';
import { SectionHeader } from './components/ui/SectionHeader';
import { FullWidthTabs } from './components/ui/FullWidthTabs';
import { ScrollChevrons } from './components/ui/ScrollChevrons';
import { UpdateToast } from './components/ui/UpdateToast';
import { SilentUpdate } from './components/ui/SilentUpdate';
import { ToastHost, notify } from './components/ui/Toast';
import { setLightHouseVisibility, deleteLightHouse } from './services/firebase';
import { announce, onRefresh as onBusRefresh } from './services/refreshBus';
import { useRefreshSignal } from './hooks/useRefreshSignal';
import { findBeingByLid } from './services/firebase/beings';
import { lidFromPath, beingPath } from './domain/beingLink';
import { dataDomainFor, inviteIdFromPath, motherDoorUrl } from './domain/communityDoor';
import { asksSignIn, withoutSignInAsk } from './domain/ssoDoor';
import { getCommunityInvite, getCommunityById } from './services/firebase';
import type { CommunityInvite } from './types';
import type { LightHouse } from './domain/lightHouse';
import { CustomLandingPage } from './pages/CustomLandingPage';
import { Footer } from './components/ui/Footer';
import { PathwayCTA } from './components/PathwayCTA';
import { usePathwayFacts } from './hooks/usePathwayFacts';
import type { PathwayInput, PathwayStepKey } from './domain/pathway';
import { derivePathway } from './domain/pathway';
import { deriveCrownRole } from './domain/dataAuthority';
import { sustainingSeven } from './domain/sustainingSeven';
import { PathOverview } from './components/PathOverview';
import { Modal } from './components/ui/Modal';
import { useImageUpload } from './hooks/useImageUpload';
import { useForestFilters } from './hooks/useForestFilters';
import { useDashboardStats } from './hooks/useDashboardStats';
import { useObservatoryQuote } from './hooks/useObservatoryQuote';
import { useSuperAdminConsole } from './hooks/useSuperAdminConsole';
import { setChainLocked } from './domain/chain';
import { setTokenisationEnabled } from './domain/tokenisation';
import { LifeseedWidget } from './components/LifeseedWidget';
import { DialogHost, showAlert, showConfirm } from './components/ui/Dialog';
import { isExplicitlyValidatedTree } from './utils/validation';
import { speak, spokenLine } from './utils/translations';

import type { OfferedTo } from './domain/offering';
import { charter } from './config/charter';
// Route pages, detail overlays, and modals are code-split: each becomes its own chunk that loads
// only when first shown, so the initial bundle (and Quill, which only the modals use) no longer
// ships on first paint. Named exports are adapted to lazy()'s default-export contract.
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const LightseedProfile = lazy(() => import('./components/LightseedProfile').then(m => ({ default: m.LightseedProfile })));
const NewsletterAdmin = lazy(() => import('./components/NewsletterAdmin').then(m => ({ default: m.NewsletterAdmin })));
const CommunityList = lazy(() => import('./components/CommunityList').then(m => ({ default: m.CommunityList })));
const CommunityProfile = lazy(() => import('./components/CommunityProfile').then(m => ({ default: m.CommunityProfile })));
const CollabsPage = lazy(() => import('./pages/CollabsPage').then(m => ({ default: m.CollabsPage })));
const ObservatoryPage = lazy(() => import('./pages/ObservatoryPage').then(m => ({ default: m.ObservatoryPage })));
const ForestPage = lazy(() => import('./pages/ForestPage').then(m => ({ default: m.ForestPage })));
const BedsBrowsePage = lazy(() => import('./pages/BedsBrowsePage').then(m => ({ default: m.BedsBrowsePage })));
const VisionsPage = lazy(() => import('./pages/VisionsPage').then(m => ({ default: m.VisionsPage })));
const PulseFeedPage = lazy(() => import('./pages/PulseFeedPage').then(m => ({ default: m.PulseFeedPage })));
const LifetreeDetail = lazy(() => import('./components/LifetreeDetail').then(m => ({ default: m.LifetreeDetail })));
const BedProfile = lazy(() => import('./components/beds/BedProfile').then(m => ({ default: m.BedProfile })));
const VisionProfile = lazy(() => import('./components/VisionProfile').then(m => ({ default: m.VisionProfile })));
const EventProfile = lazy(() => import('./components/EventProfile').then(m => ({ default: m.EventProfile })));
const PulseDetail = lazy(() => import('./components/PulseDetail').then(m => ({ default: m.PulseDetail })));
const LightHouseProfile = lazy(() => import('./components/LightHouseProfile').then(m => ({ default: m.LightHouseProfile })));
const GrowthPlayerModal = lazy(() => import('./components/GrowthPlayerModal').then(m => ({ default: m.GrowthPlayerModal })));
const PlantTreeModal = lazy(() => import('./components/modals/PlantTreeModal').then(m => ({ default: m.PlantTreeModal })));
const AuthModal = lazy(() => import('./components/modals/AuthModal').then(m => ({ default: m.AuthModal })));
const EmitPulseModal = lazy(() => import('./components/modals/EmitPulseModal').then(m => ({ default: m.EmitPulseModal })));
const EventModal = lazy(() => import('./components/modals/EventModal').then(m => ({ default: m.EventModal })));
const OfferModal = lazy(() => import('./components/modals/OfferModal').then(m => ({ default: m.OfferModal })));
const OfferingProfile = lazy(() => import('./components/offerings/OfferingProfile').then(m => ({ default: m.OfferingProfile })));
const CreateVisionModal = lazy(() => import('./components/modals/CreateVisionModal').then(m => ({ default: m.CreateVisionModal })));
const DataModelCrystal = lazy(() => import('./components/about/DataModelCrystal').then(m => ({ default: m.DataModelCrystal })));
const AlignmentView = lazy(() => import('./components/sections/AlignmentView').then(m => ({ default: m.AlignmentView })));
const CovenantProfile = lazy(() => import('./components/CovenantProfile').then(m => ({ default: m.CovenantProfile })));
const ProfileReaches = lazy(() => import('./components/profile/ProfileReaches').then(m => ({ default: m.ProfileReaches })));

// The full-screen overlay every detail view (tree / vision / event / community) scrolls inside.
// Module-scope so it keeps a stable identity (an inline definition remounts its subtree — and
// resets scroll — on every parent render).
const DetailWrapper = ({ children, belowHeader = false }: { children?: React.ReactNode; belowHeader?: boolean }) => (
    // belowHeader: the overlay starts under the sticky header (h-20) so the page header
    // stays visible and usable — the community profile reads as a page, not a curtain.
    <div className={`fixed inset-x-0 bottom-0 z-40 overflow-y-auto bg-slate-900/90 backdrop-blur-sm ${belowHeader ? 'top-20' : 'top-0'}`}>
        {children}
    </div>
);

const AppContent = () => {
    const { t } = useLanguage();
    const { lightseed, myTrees, guardedTrees, activeTree, defaultTreeId, setDefaultTree, defaultVisionId, isAdmin, isSuperAdmin, isInitiate, loading: authLoading, refreshTrees } = useSession();
    // The set of trees the signed-in user guards (the LIN, via guardian links) — passed to cards
    // so a card can show its guardian affordance without a per-card read.
    const guardedTreeIds = useMemo(() => new Set(guardedTrees.map(t => t.id)), [guardedTrees]);
    // Declared before useAppRouting so its deep-link callback closes over the declared setter.
    const [selectedTree, setSelectedTree] = useState<Lifetree | null>(null);
    // Routing (tab + forest view mode + ?tree/?invite deep-links) lives in useAppRouting.
    const { tab, setTab, viewMode, setViewMode, inviteParam } = useAppRouting(
        (id) => { getLifetreeById(id).then(tr => { if (tr) setSelectedTree(tr); }).catch(() => {}); }
    );
    const [alignments, setAlignments] = useState<Alignment[]>([]);
    // Which section the tree detail should open at (e.g. 'care' from the profile's droplet).
    const [treeSectionHint, setTreeSectionHint] = useState<string | null>(null);
    const [selectedVision, setSelectedVision] = useState<Vision | null>(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clears the section hint when the tree detail closes; the hint is set from many call sites, so deriving it there is riskier than this reset
    useEffect(() => { if (!selectedTree) setTreeSectionHint(null); }, [selectedTree]);
    const [selectedAlignment, setSelectedAlignment] = useState<Alignment | null>(null);
    const [selectedCovenantId, setSelectedCovenantId] = useState<string | null>(null);
    const [selectedPulse, setSelectedPulse] = useState<Pulse | null>(null);
    // Bumped whenever we finish touching a tree (guardianship, edits) so the map re-reads it.
    const [mapRefreshKey, setMapRefreshKey] = useState(0);
    const [editingEvent, setEditingEvent] = useState<Pulse | null>(null);
    const [dashboardEvents, setDashboardEvents] = useState<Pulse[]>([]);
    // The Observatory's oracle quote (moved out of the dashboard card into the page header).
    const { observatoryQuote, quoteCopied: obsQuoteCopied, copyQuote: copyObservatoryQuote } = useObservatoryQuote(tab);
    const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
    // An invitation the visitor arrived holding (/i/<id>) — carried until used or dismissed.
    const [arrivedInvite, setArrivedInvite] = useState<CommunityInvite | null>(null);
    const [reachTree, setReachTree] = useState<Lifetree | null>(null);
    // Preselected audience for a requested reach — 'guardians' when opened from a danger alert.
    const [reachAudience, setReachAudience] = useState<ReachAudience | undefined>(undefined);
    // The Reach inbox as a large overlay — the envelope (and reach deep-links) open messages
    // in place instead of steering to the profile tab, which keeps its own Reaches tab.
    const [showReachModal, setShowReachModal] = useState(false);
    const [pendingTreeInvites, setPendingTreeInvites] = useState(0);
    const [hostCommunity, setHostCommunity] = useState<Community | null>(null);
    // The backend's public custody declaration. Until it resolves and matches a hosting
    // community, the crown stays "About" — sovereignty is never inferred from a hostname.
    const [dataAuthority, setDataAuthority] = useState<DataAuthority | null>(null);
    // Custom-landing domains: false = the organisation's own page fills the screen;
    // true = the visitor stepped through the corner seed-logo into the full app.
    const [seedView, setSeedView] = useState(false);
    // The care corner's modal (the small care sheet), open when the droplet is pressed.
    const [careModalOpen, setCareModalOpen] = useState(false);
    // A care ping in the reaches opens the simple care modal FOR THAT TREE — the same modal the
    // bead opens, aimed by the message instead of the default-tree cascade.
    const [careOverride, setCareOverride] = useState<Lifetree | null>(null);
    // The offering of care (ring 2026-09-06): the being the offer form is pointed at, when it is.
    const [offerTo, setOfferTo] = useState<OfferedTo | null>(null);
    // A Light House opened into its own profile page (from the map marker or the LightHouse tab).
    const [viewingLightHouse, setViewingLightHouse] = useState<LightHouse | null>(null);
    // The Path overview — the Light Path's full ruleset, opened from the card's label.
    const [showPathOverview, setShowPathOverview] = useState(false);
    // Outside the seed shell, hold the shell until we know whether this domain has a custom
    // landing — otherwise the seed flashes first and then jumps to the organisation's page.
    const [hostResolved, setHostResolved] = useState(() => isSeedShellHost(window.location.hostname));
    // The host community's answer has arrived (found or not) — the feed scopes only after this,
    // on every host (hostResolved above is the seed shell's paint gate, true from the start there).
    const [hostCommunityResolved, setHostCommunityResolved] = useState(false);
    // The lightseed community is the default "About" page when this node has none of its own.
    const [defaultCommunity, setDefaultCommunity] = useState<Community | null>(null);
    // Superadmin "switch to community view" — when set, the whole shell (theme, logo,
    // name, About page) renders as if this were the host community. Cleared via "Exit community".
    const [impersonatedCommunity, setImpersonatedCommunity] = useState<Community | null>(null);
    // Superadmin "carry this being's voice" (Aspen/Lumo …) — the bridge until AI beings can
    // sign for themselves (initiation ledger keys, later). Impersonation hides the bridge;
    // carrying reveals it: while set, pulses minted on THIS tree wear the being's name in the
    // display fields and name the carrier in carriedByName/disclosure — authorId stays the real
    // signed-in uid, so rules and provenance remain true. Never deception.
    const [carryingTree, setCarryingTree] = useState<Lifetree | null>(null);
    const [personalSiteTheme, setPersonalSiteTheme] = useState<any>(null);
    const [preferredIntelligenceId, setPreferredIntelligenceId] = useState<string | undefined>(undefined);
    const [personalSiteLogoUrl, setPersonalSiteLogoUrl] = useState('');
    const [personalSiteInherit, setPersonalSiteInherit] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Stats State for Dashboard
    const stats = useDashboardStats(lightseed, tab);
    

    // UI State
    const [showAuthModal, setShowAuthModal] = useState(false);

    const [showPlantModal, setShowPlantModal] = useState(false);
    // How the plant modal should open: optionally straight to a type's plant step
    // (e.g. the "Guard Tree" button jumps past the type selection).
    const [plantInit, setPlantInit] = useState<{ type?: 'LIFETREE' | 'GUARDED'; step?: number }>({});
    const openPlant = (init: { type?: 'LIFETREE' | 'GUARDED'; step?: number } = {}) => {
        setPlantInit(init);
        setShowPlantModal(true);
    };
    const [showPulseModal, setShowPulseModal] = useState(false);
    // When growing from a specific tree's page, the pulse modal targets THAT tree (not the
    // active one). Reset to null for the generic "emit pulse" entry points.
    const [pulseTargetTree, setPulseTargetTree] = useState<Lifetree | null>(null);
    // When growing from a vision's page, the pulse modal targets THAT vision (vision growth).
    const [pulseTargetVision, setPulseTargetVision] = useState<Vision | null>(null);
    const openPulseModal = (target: Lifetree | null = null) => { setPulseTargetTree(target); setPulseTargetVision(null); setShowPulseModal(true); };
    const openVisionGrowth = (vision: Vision) => { setPulseTargetVision(vision); setPulseTargetTree(null); setShowPulseModal(true); };
    const [showEventModal, setShowEventModal] = useState(false);
    const [showOfferModal, setShowOfferModal] = useState(false);
    // The offering being retold (its own modal layer, nested on the offering profile).
    const [editingOffering, setEditingOffering] = useState<Pulse | null>(null);
    // The Offerings page holds two full-width sub-tabs: the offering pulses, and beds (a bed IS an offering).
    const [offeringsSub, setOfferingsSub] = useState<'offerings' | 'beds'>('offerings');
    const [showVisionModal, setShowVisionModal] = useState(false);
    const [showGrowthPlayer, setShowGrowthPlayer] = useState<string | null>(null);
    const [matchCandidate, setMatchCandidate] = useState<Pulse | null>(null);
    const { uploading, handleImageUpload } = useImageUpload();
    const { showNatureTrees, setShowNatureTrees, showUserTrees, setShowUserTrees, showValidatedTrees, setShowValidatedTrees } = useForestFilters();

    const activeCommunity = impersonatedCommunity || hostCommunity;
    const isDevHost = /localhost|127\.0\.0\.1|^192\.168\.|\.local$/.test(window.location.hostname);
    // The App-level scope shared by the home carousel, Light Houses and beds. Feed content
    // derives the same law inside useForestFeed because it also needs the raw domain for strict
    // owner-tree behavior.
    const activeDataDomain = (isDevHost && isSuperAdmin)
        ? undefined
        : dataDomainFor(activeCommunity?.domain || window.location.hostname, activeCommunity?.reflectsPublic);

    const config = useConfig(activeCommunity);
    const { effectiveTheme, effectiveIsDark, configuredLogoUrl, toggleNightMode, backgroundStyle } =
        useSiteTheme({ config, impersonatedCommunity, lightseed, personalSiteTheme, personalSiteLogoUrl, personalSiteInherit });


    useEffect(() => {
        if (!lightseed) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- reset-on-signout before (not instead of) subscribing to the profile listener
            setPersonalSiteTheme(null);
            setPersonalSiteLogoUrl('');
            setPersonalSiteInherit(false);
            setActiveIntelligenceId(undefined);
            return;
        }

        return listenToUserProfile(lightseed.uid, (profile) => {
            setPersonalSiteTheme(profile?.siteTheme || null);
            setPersonalSiteLogoUrl(profile?.siteLogoUrl || '');
            setPersonalSiteInherit(!!profile?.siteInherit);
            setPreferredIntelligenceId(profile?.preferredIntelligenceId || undefined);
            // Mirror the choice so stateless AI helpers route through it everywhere.
            setActiveIntelligenceId(profile?.preferredIntelligenceId || undefined);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on uid on purpose: the lightseed object changes identity without the uid changing, and re-subscribing per object would churn the listener
    }, [lightseed?.uid]);

    // Live unread-reach count powering the nav's red envelope indicator (see useReaches).
    const unreadReaches = useReaches(lightseed, myTrees);

    // Pending alignments, hydrated with the two trees + matched pulses for the Observatory cards.
    const alignmentCards = useAlignmentCards(alignments, myTrees);

    // The paginated forest / pulse / vision / event / reach feed + infinite scroll (see useForestFeed).
    const { data, setData, loadContent, loadingMore, forestSentinelRef } = useForestFeed({
        tab, viewMode, lightseed, isSuperAdmin, isAdmin, setAlignments,
        hostReflectsPublic: (impersonatedCommunity || hostCommunity)?.reflectsPublic,
        hostDomain: (impersonatedCommunity || hostCommunity)?.domain,
        hostStrictScope: (impersonatedCommunity || hostCommunity)?.strictScope,
        hostCommunityId: (impersonatedCommunity || hostCommunity)?.id,
    });

    // The refresh bus, heard by the live feed: when an event/pulse is deleted anywhere
    // (its profile page, a community tab), prune it from the loaded list — no reload.
    useEffect(() => onBusRefresh(e => {
        if (!e.id) return;
        // An edit carries its patch — merge it into the loaded copy, whatever the tab shows
        // (events, pulses, offerings, trees, visions all ride the same whisper). A patchless
        // announce with an id stays what it always was: a removal to prune.
        if (e.patch) {
            const patch = e.patch;
            setData(prev => prev.some(item => item.id === e.id) ? prev.map(item => item.id === e.id ? { ...item, ...patch } : item) : prev);
            // The open tree page follows the same whisper: a mint moves the head (latestHash,
            // blockHeight, the latest face) and the profile's chain reloads from it.
            if (e.topic === 'trees') setSelectedTree(prev => (prev && prev.id === e.id ? { ...prev, ...patch } : prev));
        } else if (e.topic === 'events' || e.topic === 'pulses') {
            setData(prev => prev.some(item => item.id === e.id) ? prev.filter(item => item.id !== e.id) : prev);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setData is a stable setter from useForestFeed
    }), []);

    // Load the tab's content when the view changes — or when the active node's commons/domain
    // changes (flipping "reflect the commons" re-scopes the feed live, no refresh needed).
    // The first load waits until the feed knows WHERE it stands and WHO is looking: the host
    // community (its domain, its reflection choice) and the auth state. Loading earlier meant
    // three passes on every mount — signed-out, then signed-in, then re-scoped — each showing
    // a different set, items appearing and vanishing as the narrower pass landed.
    useEffect(() => {
        if (tab !== 'dashboard' && hostCommunityResolved && !authLoading) loadContent(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadContent is recreated per render; adding it would refetch the feed on every render (loop). It already closes over tab/viewMode/lightseed.
    }, [tab, lightseed?.uid, isSuperAdmin, isAdmin, viewMode, hostCommunityResolved, authLoading, (impersonatedCommunity || hostCommunity)?.reflectsPublic, (impersonatedCommunity || hostCommunity)?.domain, (impersonatedCommunity || hostCommunity)?.strictScope]);

    // Genesis + the host community depend only on the signed-in user, not the tab — so run them
    // once per session (and on login), not on every tab/view switch as they used to.
    useEffect(() => {
        ensureGenesis();
        syncInitiatesMirror(); // superadmin-gated inside; keeps initiates/{uid} true to the git ledger
        Promise.all([
            getCommunityByDomain(window.location.hostname).catch(() => null),
            getDataAuthority().catch(() => null),
        ]).then(([community, authority]) => {
            setHostCommunity(community);
            setDataAuthority(authority);
        }).finally(() => { setHostResolved(true); setHostCommunityResolved(true); });
    }, [lightseed?.uid]);

    // Load the lightseed community once as the default About page fallback.
    useEffect(() => {
        getCommunityByDomain(charter.domain).then(setDefaultCommunity).catch(() => {});
    }, []);

    // Pending Tree Circle invites — surfaced (separately) on the DM button.
    useEffect(() => {
        if (lightseed?.uid) getPendingTreeInvites(lightseed.uid).then(invs => setPendingTreeInvites(invs.length)).catch(() => {});
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reset-on-signout counterpart of the async fetch above
        else setPendingTreeInvites(0);
    }, [lightseed?.uid, tab]);

    // Arriving on an invite link, signed out, opens the join flow.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reacts to external URL state (?invite) once auth resolves; there is no render-time equivalent
        if (inviteParam && !lightseed && !authLoading) setShowAuthModal(true);
    }, [inviteParam, lightseed, authLoading]);

    // Arriving on a community invitation (/i/), signed out, opens the join door directly — the
    // auth modal greets by the community name and starts in sign-up (see the AuthModal render).
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reacts to the resolved /i/ arrival once auth settles; mirrors the ?invite effect above
        if (arrivedInvite && !lightseed && !authLoading) setShowAuthModal(true);
    }, [arrivedInvite, lightseed, authLoading]);

    // Seed the Intelligence Commons (default personas + Gemini Oracle) once a super-admin
    // is known. Idempotent and gated by Firestore rules.
    useSuperAdminConsole(isSuperAdmin, lightseed?.uid);

    // Sync the chain-lock flag from the node's community ("big red stamp"). Off until a node sets it.
    useEffect(() => {
        setChainLocked(!!(impersonatedCommunity || hostCommunity)?.chainLocked);
    }, [impersonatedCommunity, hostCommunity]);

    // The /b/<lid> door — a scanned QR lands here. Resolved once the session settles
    // (what the scanner may see depends on who they are), then the path is cleaned.
    useEffect(() => {
        if (authLoading) return;
        const lid = lidFromPath(window.location.pathname);
        if (!lid) return;
        // The address is KEPT (only normalized) — /b/<lid> is a real, refreshable door now:
        // the hosting rewrite serves the shell for it, and this effect re-opens the being.
        window.history.replaceState(window.history.state, '', beingPath(lid));
        findBeingByLid(lid, !!lightseed, { uid: lightseed?.uid, isStaff: isSuperAdmin || isAdmin }).then(found => {
            if (!found) { notify(speak('being_link_unseen')); return; }
            if (found.kind === 'tree') setSelectedTree(found.tree);
            else if (found.kind === 'lightHouse') setViewingLightHouse(found.lightHouse);
            else if (found.kind === 'vision') setSelectedVision(found.vision);
            else setSelectedPulse(found.pulse);
        }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot door: runs when auth settles; the path is consumed on first resolution
    }, [authLoading]);

    // The /i/<inviteId> door — a community invitation link lands here. The community is
    // shown to anyone (greeting first); the invitation itself is carried into the profile,
    // where signing in and entering happen. The path is consumed like the /b/ door's.
    useEffect(() => {
        if (authLoading) return;
        const inviteId = inviteIdFromPath(window.location.pathname);
        if (!inviteId) return;
        window.history.replaceState({}, '', '/');
        getCommunityInvite(inviteId).then(async invite => {
            const community = invite ? await getCommunityById(invite.communityId) : null;
            if (!invite || !community) { notify(speak('invite_not_found')); return; }
            setArrivedInvite(invite);
            setSelectedCommunity(community);
        }).catch(() => notify(speak('invite_not_found')));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot door: runs when auth settles; the path is consumed on first resolution
    }, [authLoading]);

    // The ?signin door (domain/ssoDoor) — a mother site's own "sign in" link (theohouse.org's
    // header door) lands here. Signed out, the sign-in dialog opens; either way the ask leaves
    // the address, so a copied URL is a door, not a demand. Consumed like the /b/ door's path.
    useEffect(() => {
        if (authLoading || !asksSignIn(window.location.search)) return;
        window.history.replaceState(window.history.state, '', window.location.pathname + withoutSignInAsk(window.location.search));
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reacts to the external ?signin ask once auth settles; mirrors the ?invite effect above
        if (!lightseed) setShowAuthModal(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot door: runs when auth settles; the ask is consumed on first resolution
    }, [authLoading]);

    // With the header visible above the community profile, a tab click should land on that
    // tab — not stay hidden behind the overlay. Navigating closes the community.
    useEffect(() => {
        setSelectedCommunity(null);
        setSelectedPulse(null);
    }, [tab]);

    // The browser tab wears the community's name AS ITS PROPERTIES SAY IT — the community
    // being viewed first, then the one driving the whole site (impersonated/host).
    useEffect(() => {
        const c = selectedCommunity || impersonatedCommunity || hostCommunity;
        document.title = c?.name ? c.name : '.seed: Lightseed, life recognising life';
    }, [selectedCommunity, impersonatedCommunity, hostCommunity]);

    // Sync the tokenisation flag (AI-token economy) from the node's community. Off until enabled.
    useEffect(() => {
        setTokenisationEnabled(!!(impersonatedCommunity || hostCommunity)?.tokenisationEnabled);
    }, [impersonatedCommunity, hostCommunity]);

    // Events for the logged-in home carousel — visibility-scoped to this viewer + place. Re-fetches
    // on the 'events' bus signal, so an edit/create/delete anywhere shows up in the banner too.
    const eventsRefresh = useRefreshSignal(['events']);
    const heroEventsSeq = useRef(0);
    useEffect(() => {
        // The hero events box shows THE SAME events as the events menu: one derivation
        // (domain/pulseVisibility eventFeedScope — the banner once leaked a lightseed event
        // onto Per Auset because it carried its own hand-copy of this law), one viewer cut
        // (eventsOnView: visitors see the node's own happenings; past days rest hidden), and
        // one ORDER (useOrderedEvents below — the banner is the same list's first reach).
        // It waits for the ground it stands on: until the host community has answered, its
        // strictness is unknown and the creator-never-lost merge would fold the viewer's own
        // events from EVERY domain into a strict face's hero for a breath (Per Auset,
        // 2026-09-03) — and only the newest fetch may land.
        if (!hostCommunityResolved || authLoading) return;
        const seq = ++heroEventsSeq.current;
        const { levels, ownerUid } = eventFeedScope(
            { uid: lightseed?.uid, isStaff: isSuperAdmin || isAdmin },
            { reflectsPublic: activeCommunity?.reflectsPublic, strictScope: activeCommunity?.strictScope },
        );
        fetchEventPulses(undefined, activeDataDomain, levels, ownerUid)
            .then(r => { if (seq === heroEventsSeq.current) setDashboardEvents(eventsOnView(r.items, { signedIn: !!lightseed, showPast: false, nowMs: Date.now() })); })
            .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on uid + host scope + bus signal; the lightseed object changes identity without uid changing
    }, [lightseed?.uid, isSuperAdmin, isAdmin, eventsRefresh, activeDataDomain, activeCommunity?.reflectsPublic, activeCommunity?.strictScope, hostCommunityResolved, authLoading]);

    // Browser back closes overlays LAYER BY LAYER instead of leaving the app. Ordered base-first;
    // the last open layer is topmost (closed first on Back). See useHistoryLayers.
    const openKeys = useHistoryLayers([
        { key: 'tree', open: !!selectedTree, close: () => setSelectedTree(null) },
        { key: 'lightHouse', open: !!viewingLightHouse, close: () => setViewingLightHouse(null) },
        { key: 'community', open: !!selectedCommunity, close: () => setSelectedCommunity(null) },
        { key: 'vision', open: !!selectedVision, close: () => setSelectedVision(null) },
        { key: 'alignment', open: !!selectedAlignment, close: () => setSelectedAlignment(null) },
        { key: 'covenant', open: !!selectedCovenantId, close: () => setSelectedCovenantId(null) },
        { key: 'pulse', open: !!selectedPulse, close: () => setSelectedPulse(null) },
        { key: 'auth', open: showAuthModal, close: () => setShowAuthModal(false) },
        { key: 'plant', open: showPlantModal, close: () => setShowPlantModal(false) },
        { key: 'pulseModal', open: showPulseModal, close: () => setShowPulseModal(false) },
        { key: 'eventModal', open: showEventModal, close: () => setShowEventModal(false) },
        { key: 'offerModal', open: showOfferModal, close: () => setShowOfferModal(false) },
        { key: 'editingOffering', open: !!editingOffering, close: () => setEditingOffering(null) }, // nested on an offering
        { key: 'visionModal', open: showVisionModal, close: () => setShowVisionModal(false) },
        { key: 'reachModal', open: showReachModal, close: () => setShowReachModal(false) },
        { key: 'editingEvent', open: !!editingEvent, close: () => setEditingEvent(null) },      // nested on a pulse detail
        { key: 'growthPlayer', open: !!showGrowthPlayer, close: () => setShowGrowthPlayer(null) }, // nested on a tree detail (or standalone)
    ]);

    // The address bar mirrors the open being: while a tree / light house / vision with a lid
    // stands on screen, the bar wears its /b/<lid> address — copyable and refreshable (a refresh
    // hits the /b/** hosting rewrite, the shell boots, and the arrival effect above re-opens it).
    // replaceState ONLY, and declared AFTER useHistoryLayers so its pushState (same commit, on
    // open) runs first and this write lands on the armed entry: the entry COUNT never changes,
    // so the back-button machinery's pushState/back() arithmetic is untouched. A being without
    // a lid leaves the bar alone; when the last of the three closes, the bar returns to '/'.
    const beingWasOpenRef = useRef(false);
    useEffect(() => {
        const top = selectedTree || viewingLightHouse || selectedVision;
        if (top) {
            beingWasOpenRef.current = true;
            if (top.lid) window.history.replaceState(window.history.state, '', beingPath(top.lid));
        } else if (beingWasOpenRef.current) {
            beingWasOpenRef.current = false;
            if (lidFromPath(window.location.pathname)) window.history.replaceState(window.history.state, '', '/');
        }
    }, [selectedTree, viewingLightHouse, selectedVision]);

    const handleTreeUpdate = (treeId: string, updates: any) => {
        setData(prev => prev.map(item => item.id === treeId ? { ...item, ...updates } : item));
        if (selectedTree?.id === treeId) {
            setSelectedTree(prev => prev ? { ...prev, ...updates } : null);
        }
        refreshTrees();
    };

    // THE TWO DOORS TO THE SAME ROOM: the envelope beside the profile and the Messages menu
    // both mount ProfileReaches → ReachInbox → ReachThread with EXACTLY these handlers — one
    // definition, so the mycelium behaves identically whichever door a being walks through.
    const openTreeFromReaches = (id: string, opts?: { closeReachModal?: boolean }) => {
        if (opts?.closeReachModal) setShowReachModal(false); // the modal must step aside, or it covers the tree it opened
        getLifetreeById(id).then(tr => { if (tr) setSelectedTree(tr); }).catch(() => {});
    };
    const openCareFromReaches = (id: string) => {
        // Care floats OVER the conversation — after the watering, you are still where the tree asked for you.
        getLifetreeById(id).then(tr => { if (tr) { setCareOverride(tr); setCareModalOpen(true); } }).catch(() => {});
    };

    const openReach = (tree: Lifetree | null, audience?: ReachAudience) => {
        // You reach FROM your own tree, so reaching needs a signed-in hand. Rather than open
        // a modal that cannot send, say so and offer the door (ring 2026-08-25).
        if (!lightseed?.uid) { notify(speak('reach_needs_signin')); setShowAuthModal(true); return; }
        setSelectedTree(null);
        setReachTree(tree);
        setReachAudience(audience);
        setShowReachModal(true);
    };

    // AI vision-resonance — the weekly-gated synergy analysis + favourites (see useResonance).
    const {
        synergies, isAnalyzingSynergy, lastSynergyAt, canRefreshResonance, synergyCooldownLeft, favoriteResonanceIds,
        toggleFavoriteResonance, handleAnalyzeSynergy, refreshResonanceObservatory, reachResonantTree,
    } = useResonance({
        data,
        preferredIntelligenceId,
        isStaff: isSuperAdmin || isAdmin,
        viewerUid: lightseed?.uid,
        openReach,
    });

    // Open the Direct Messages inbox as a large overlay (the envelope in the nav). The
    // profile keeps its own Reaches tab for direct visits; this no longer steers there.
    const openDirectMessages = () => {
        setReachTree(null);
        setReachAudience(undefined);
        setShowReachModal(true);
    };

    
    const handleQuickSnap = async (treeId: string, file: File) => {
        if (!lightseed) return;
        try {
            const url = await handleImageUpload(file, `users/${lightseed.uid}/growth/${treeId}/${Date.now()}`);
            await mintPulse({
                lifetreeId: treeId,
                type: 'tree_growth',
                title: 'Growth Snapshot',
                body: `Snapped on ${new Date().toLocaleDateString()}`,
                imageUrl: url,
                authorId: lightseed.uid,
                authorName: lightseed.displayName || "Soul",
                authorPhoto: lightseed.photoURL || undefined,
            });
            loadContent(true); 
        } catch (e: any) {
            console.error("Quick Snap Error:", e);
            showAlert(e?.message || 'err_picture');
        }
    }

    // After a tree growth mints: the open tree page and its forest card already followed the
    // head through the refresh bus (mintPulse announces the exact latestHash / blockHeight /
    // latest face); here only the session's tree lists and the feed catch up.
    const handleTreeGrown = () => {
        refreshTrees();
        loadContent(true);
    };

    const handleDeleteTree = async (treeId: string) => {
        if (!(await showConfirm('tree_delete_confirm', { title: 'delete_lifetree_title', confirmText: 'delete', danger: true }))) return;
        try {
            await deleteLifetree(treeId);
            await refreshTrees();
            loadContent(true);
        } catch (e: any) {
            console.error("Delete Tree Error:", e);
            showAlert(e?.message || 'err_tree_delete');
        }
    }

    const handleDeleteTreeConfirmed = async (treeId: string) => {
        try {
            await deleteLifetree(treeId);
            await refreshTrees();
            loadContent(true);
        } catch (e: any) {
            showAlert(e?.message || 'err_tree_delete');
        }
    }

    // A contribution sealed onto the vision's own chain. After it commits, refresh the open vision
    // so its chain head (blockHeight/latestHash) and the Contributions view reflect the new leaf.
    const handleGrowVision = async (vision: Vision, data: { title?: string; body?: string; imageUrl?: string; growthCategory?: string }) => {
        if (!lightseed) return;
        await growVision(vision, {
            ...data,
            authorId: lightseed.uid,
            authorName: lightseed.displayName || 'Soul',
            authorPhoto: lightseed.photoURL || undefined,
        });
        try {
            const fresh = await getVisionById(vision.id);
            if (fresh) setSelectedVision(prev => (prev && prev.id === fresh.id ? fresh : prev));
        } catch { /* the view simply keeps its prior head until reopened */ }
    };

    // A blocking overlay for the few operations that take a beat (a vision's cascade delete removes
    // its chain + links). Darkens the app, shows the spinner, and confirms in a snackbar when done.
    const [busyLabel, setBusyLabel] = useState<string | null>(null);
    const handleDeleteVisionInApp = async (visionId: string) => {
        if (!(await showConfirm('vision_delete_confirm', { title: 'delete_vision', confirmText: 'delete', danger: true }))) return;
        setBusyLabel('Releasing the vision…');
        try {
            await deleteVision(visionId);
            setSelectedVision(null);
            loadContent(true);
            setBusyLabel(null);
            notify('🌱 The vision was released.');
        } catch (e: any) {
            setBusyLabel(null);
            showAlert(e?.message || 'err_delete');
        }
    }

    const onAcceptAlignment = async (id: string) => {
        try {
            const res = await acceptAlignment(id);
            setAlignments(prev => prev.filter(a => a.id !== id)); // drop the accepted request
            await showAlert('aligned_toast', 'alignment_title');
            // Accepting an alignment also SIGNS its covenant (the canonical 2-party form) — additive:
            // the sync-block above stays, and the alignment gains a cryptographic twin the accepting
            // party signs in their own hand. Best-effort: a missing/unavailable signing key must never
            // block the accept (the alignment already succeeded). The covenant is minted lazily on the
            // first party to sign; when the initiator later opens it and signs, quorum 2 seals it.
            const alignment = await getAlignmentById(id).catch(() => null);
            let openedCovenant = false;
            if (alignment && lightseed?.uid) {
                try {
                    const signed = await signAlignmentCovenant(alignment);
                    // Clear any open alignment first: the overlay chain prefers it, and a covenant
                    // opened behind it would silently never show (the dead-button bug's root).
                    if (signed?.covenantId) { setSelectedAlignment(null); setSelectedCovenantId(signed.covenantId); openedCovenant = true; }
                } catch (covErr) {
                    // A key-custody conflict (no device key / stale device) must not stay silent:
                    // the covenant already exists (minted before signing), so open its profile —
                    // its Sign button routes the being through the SigningKeyModal properly.
                    if (covErr instanceof SigningKeyNeedsRestoreError) {
                        const cov = await getCovenantForAlignment(alignment.id).catch(() => null);
                        if (cov) { setSelectedAlignment(null); setSelectedCovenantId(cov.id); openedCovenant = true; }
                    } else {
                        console.warn('Covenant co-sign skipped:', covErr);
                    }
                }
            }
            // Open the resulting block on your chain — through the unified router, so the
            // freshly minted sync-block lands on the alignment view like everywhere else. If the
            // covenant profile opened (the co-sign landed), let it stand instead.
            const pulse = await getPulseById(res.targetPulseId).catch(() => null);
            if (pulse && !openedCovenant) await onViewPulseOrAlignment(pulse);
            loadContent(true);
        }
        catch(e:any) {
            console.error("Accept Alignment Error:", e);
            showAlert(e?.message || "Could not complete the alignment.");
        }
    }
    const onRejectAlignment = async (id: string) => {
        // Optimistically drop the declined card, then persist.
        setAlignments(prev => prev.filter(a => a.id !== id));
        try { await rejectAlignment(id); } catch (e) { console.error("Reject Alignment Error:", e); loadContent(true); }
    };
    const onViewAlignmentTree = async (treeId: string) => {
        const tr = await getLifetreeById(treeId).catch(() => null);
        if (tr) setSelectedTree(tr);
    };

    // THE single router for opening a pulse. An alignment sync-block (isMatch) opens the same
    // AlignmentView as the profile's alignments list — one view, reached from every surface
    // (feeds, tree leaves, dashboard, community events) — instead of the raw pulse modal.
    // Every sync-block carries the alignment id in `matchId` (legacy blocks were backfilled by
    // migrateBackfillMatchIds, run 2026-07-09). Everything else opens the pulse.
    const onViewPulseOrAlignment = async (p: Pulse) => {
        if (p.isMatch && p.matchId) {
            const alignment = await getAlignmentById(p.matchId).catch(() => null);
            if (alignment) { setSelectedTree(null); setSelectedAlignment(alignment); return; }
        }
        // A leaf opened from its own tree keeps the tree beneath it — the pulse overlay
        // paints above, and Back peels it away to land on the tree again.
        setSelectedTree(prev => (prev && p.lifetreeId === prev.id) ? prev : null);
        setSelectedPulse(p);
    };

    const filteredData = useMemo(() => data.filter((item: any) => {
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const text = (item.title || item.name || "") + " " + (item.body || "") + " " + (item.locationName || "") + " " + (item.eventLocation || "") + " " + (item.reachTreeName || "");
            if (!text.toLowerCase().includes(term)) return false;
        }
        if (tab === 'forest') {
            if (!canViewTree(item, { uid: lightseed?.uid, isStaff: isSuperAdmin || isAdmin, guardedIds: guardedTreeIds })) return false;
            if (!passesForestFilter(item, { showNature: showNatureTrees, showUser: showUserTrees, showValidated: showValidatedTrees }, isExplicitlyValidatedTree)) return false;
        }
        return true;
    }), [data, searchTerm, tab, showNatureTrees, showUserTrees, showValidatedTrees, lightseed?.uid, isSuperAdmin, isAdmin, guardedTreeIds]);

    // Trees of mine (owned or guarded) whose watering is overdue — drives the blue care marker
    // on the nav envelope, computed straight from the trees so it shows even before the daily
    // sweep mints a "water me" reach.
    // myTrees (owned, non-nature) and guardedTrees (guardian edges + owned nature) can overlap — a
    // tree you own AND hold a guardian link to sits in both. Dedupe by id so one thirsty tree is
    // counted once (the badge was reading 2 for a single overdue tree whose droplet draws once).
    const wateringNeededCount = useMemo(() => {
        const byId = new Map<string, Lifetree>();
        for (const tree of [...myTrees, ...guardedTrees]) byId.set(tree.id, tree);
        return [...byId.values()].filter(t => isWateringOverdue(t)).length;
    }, [myTrees, guardedTrees]);

    // --- The Pathway — the plain facts derivePathway reads (domain/pathway) ----------------
    // Session facts come straight from the trees/stats already in hand; the link-borne ones
    // (membership, followed visions, my circle, my community) from usePathwayFacts.
    const pathwayFacts = usePathwayFacts(lightseed, myTrees);
    const pathwayInput = useMemo<PathwayInput>(() => {
        // Most recent EXPLICIT care (lastCaredAt) across own + guarded trees. Planting alone
        // is not caring — no fallback to createdAt here (that's validation's window, not ours).
        const caredMillis = [...myTrees, ...guardedTrees]
            .map(t => (t.lastCaredAt && typeof t.lastCaredAt.toMillis === 'function' ? t.lastCaredAt.toMillis() : 0))
            .filter(ms => ms > 0);
        return {
            signedIn: !!lightseed,
            myTreesCount: myTrees.length,
            guardedCount: guardedTrees.length,
            lastCaredAtMs: caredMillis.length ? Math.max(...caredMillis) : null,
            wateringOverdue: wateringNeededCount > 0,
            connectionsCount: stats.alignments + alignments.length,
            isMember: pathwayFacts.isMember,
            followedVisionsCount: pathwayFacts.followedVisionsCount,
            circleSize: pathwayFacts.circleSize,
            tendedCount: pathwayFacts.tendedCount,
            // The floor of seven, read by the same pure rule as the profile card.
            sevenSustaining: lightseed ? sustainingSeven(myTrees, pathwayFacts.guardianEdges, lightseed.uid).sustaining : 0,
            ownsCommunity: pathwayFacts.ownsCommunity,
            communityHasCustomDomain: pathwayFacts.communityHasCustomDomain,
            communityHasTheme: pathwayFacts.communityHasTheme,
        };
    }, [lightseed, myTrees, guardedTrees, wateringNeededCount, stats.alignments, alignments.length, pathwayFacts]);
    // Every step's click routes into a flow that already exists — the CTA never invents one.
    const openTreeSection = (tree: Lifetree | undefined, section: string) => {
        if (tree) { setTreeSectionHint(section); setSelectedTree(tree); }
        else openPlant();
    };
    const pathwayActions: Record<PathwayStepKey, () => void> = {
        signUp: () => setShowAuthModal(true),
        plant: () => openPlant(),
        care: () => openTreeSection(myTrees[0] || guardedTrees[0], 'care'),
        connect: () => setTab('forest'),
        join: () => setTab('communities'),
        followVision: () => setTab('visions'),
        formCircle: () => openTreeSection(myTrees[0], 'circle'),
        plantSeven: () => setTab('profile'),
        nameCommunity: () => setTab('communities'),
        rootDomain: () => setTab('communities'),
        tailorTheme: () => setTab('communities'),
    };

    // The shared viewer cut (domain/pulseVisibility eventsOnView): signed-out visitors see
    // only the node's own happenings; past events rest behind the toggle. nowMs is a snapshot,
    // refreshed when the toggle is touched, so the memo stays pure of the live clock.
    const [showPastEvents, setShowPastEvents] = useState(false);
    const [eventsNowMs, setEventsNowMs] = useState(() => Date.now());
    const eventsForViewer = useMemo(
        () => eventsOnView(filteredData as Pulse[], { signedIn: !!lightseed, showPast: showPastEvents, nowMs: eventsNowMs }),
        [filteredData, lightseed, showPastEvents, eventsNowMs]
    );
    // From my ground (domain/eventOrder): my domain first, then nearness to my default
    // tree (free-text places geocoded best-effort), then soonness. The hero banner and the
    // events page order through the SAME hook (shared geocode cache), so they never diverge.
    const orderedEvents = useOrderedEvents(eventsForViewer, activeTree, (impersonatedCommunity || hostCommunity)?.domain);
    const orderedDashboardEvents = useOrderedEvents(dashboardEvents, activeTree, (impersonatedCommunity || hostCommunity)?.domain);

    const searchSuggestions = useMemo(() => (
        Array.from(new Set(data.map((item: any) => item.title || item.name).filter(Boolean)))
    ), [data]);

    if (authLoading) return (
        <div className="h-screen w-full flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 z-0" style={backgroundStyle}></div>
            <div className="relative z-10"><Loading /></div>
        </div>
    );

    // Custom-domain visitors wait a breath on neutral ground instead of seeing the seed flash
    // before the organisation's page takes over.
    if (!hostResolved) return (
        <div className="flex h-screen w-full items-center justify-center bg-[#faf6ec]">
            <Loading />
        </div>
    );

    // A custom-landing domain (e.g. Per Auset) greets with the organisation's own page — the
    // seed shell waits behind the corner logo. Staff previewing a community (community view on
    // the hub) reach the same landing through the same corner switcher. Overlays still render.
    const landingCommunity = impersonatedCommunity?.customLanding
        ? impersonatedCommunity
        : (hostCommunity?.customLanding && !impersonatedCommunity ? hostCommunity : null);
    // An arrival overlay (a scanned /b/ being, or an /i/ invitation) sets state that the landing
    // page never draws — and the URL is already consumed — so a QR scan or invite link on a
    // custom-landing domain would dead-end. When any arrival is pending, fall through to the full
    // seed shell so its overlay renders.
    const arrivalPending = [selectedCommunity, viewingLightHouse, selectedTree, selectedVision].some(Boolean);
    if (landingCommunity && !seedView && !arrivalPending) {
        return (
            <>
                <CustomLandingPage
                    community={landingCommunity}
                    lightseed={lightseed}
                    onSignIn={() => setShowAuthModal(true)}
                    onSignOut={() => { logout(); setCarryingTree(null); setTab('dashboard'); }}
                    onEnterSeed={() => setSeedView(true)}
                    onViewEvent={(p: Pulse) => { void onViewPulseOrAlignment(p); }}
                />
                <Suspense fallback={null}>
                    {selectedPulse && (
                        <DetailWrapper>
                            {selectedPulse.type === 'event' ? (
                                <div className="min-h-screen bg-slate-50">
                                    <EventProfile
                                        theme={effectiveTheme}
                                        pulse={selectedPulse}
                                        activeTree={activeTree}
                                        onClose={() => setSelectedPulse(null)}
                                        currentUserId={lightseed?.uid}
                                        myTrees={myTrees}
                                        hostStrictScope={(impersonatedCommunity || hostCommunity)?.strictScope}
                                    />
                                </div>
                            ) : (
                                <PulseDetail pulse={selectedPulse} activeTree={activeTree} onClose={() => setSelectedPulse(null)} backLabel={selectedTree && selectedPulse.lifetreeId === selectedTree.id ? `Back to ${selectedTree.name}` : 'Back'} />
                            )}
                        </DetailWrapper>
                    )}
                </Suspense>
                {showAuthModal && !lightseed && (
                    <AuthModal onClose={() => setShowAuthModal(false)} inviteId={inviteParam} inviteOnly={config.inviteOnly} theme={effectiveTheme} />
                )}
            </>
        );
    }


    const renderMainContent = () => {
        if (tab === 'dashboard') {
            return (
                <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
                    <Dashboard
                        stats={{
                            trees: myTrees.length,
                            pulses: stats.pulses,
                            visions: stats.visions,
                            alignments: stats.alignments,
                            danger: guardedTrees.filter(t => t.status === 'DANGER').length
                        }}
                        hostCommunity={impersonatedCommunity || hostCommunity || defaultCommunity}
                        theme={effectiveTheme}
                        isDark={effectiveIsDark}
                        events={orderedDashboardEvents}
                        onViewEvent={(p: Pulse) => { void onViewPulseOrAlignment(p); }}
                        onViewCommunity={setSelectedCommunity}
                        onSetTab={setTab}
                        onPlant={() => openPlant()}
                        onLogin={() => setShowAuthModal(true)}
                    />
                </div>
            );
        }

        if (tab === 'profile' && lightseed) {
            return (
                <LightseedProfile
                    onViewTree={(tree: Lifetree, section?: string) => { setTreeSectionHint(section || null); setSelectedTree(tree); }}
                    onDeleteTree={handleDeleteTree}
                    defaultTreeId={defaultTreeId}
                    onSetDefaultTree={setDefaultTree}
                    onViewVision={(v: Vision) => setSelectedVision(v)}
                    onViewPulse={(p: Pulse) => { void onViewPulseOrAlignment(p); }}
                    onViewAlignment={(a: Alignment) => setSelectedAlignment(a)}
                    onPlant={() => openPlant()}
                    onCreateVision={() => setShowVisionModal(true)}
                    onEmitPulse={() => openPulseModal()}
                    onClaimSuperAdmin={async () => {
                        const ok = await claimSuperAdmin(lightseed.uid);
                        if (ok) window.location.reload();
                        else showAlert('superadmin_claimed');
                    }}
                    onGrantAdmin={async (uid: string) => { await grantAdmin(uid); }}
                    onRevokeAdmin={async (uid: string) => { await revokeAdmin(uid); }}
                    onOpenNewsletterAdmin={() => setTab('newsletter')}
                    onReachTree={(tree: Lifetree) => openReach(tree)}
                    onOpenTreeById={openTreeFromReaches}
                    onOpenCareById={openCareFromReaches}
                    nodeTheme={config.theme}
                />
            );
        }

        if (tab === 'newsletter' && lightseed && isSuperAdmin) {
            return <NewsletterAdmin senderUid={lightseed.uid} onBack={() => setTab('profile')} />;
        }
        
        if (tab === 'about') {
            // The crown page is the hosting community's profile, driven entirely from data and
            // rendered by the same component used for every community. Its menu name is derived
            // independently (About / Host / Node / Hub) from backend authority. Off-domain or
            // before a host resolves, the lightseed community remains the fallback reading.
            const aboutCommunity = impersonatedCommunity || hostCommunity || defaultCommunity;
            if (!aboutCommunity) return <div className="min-h-screen flex items-center justify-center"><Loading /></div>;
            return (
                <CommunityProfile
                    onViewLightHouse={setViewingLightHouse}
                    community={aboutCommunity}
                    onViewTree={(tree: Lifetree) => setSelectedTree(tree)}
                    onClose={() => setTab('dashboard')}
                    onUpdate={(updates) => {
                        if (impersonatedCommunity && aboutCommunity.id === impersonatedCommunity.id) setImpersonatedCommunity(prev => prev ? { ...prev, ...updates } : null);
                        if (hostCommunity && aboutCommunity.id === hostCommunity.id) setHostCommunity(prev => prev ? { ...prev, ...updates } : null);
                        if (defaultCommunity && aboutCommunity.id === defaultCommunity.id) setDefaultCommunity(prev => prev ? { ...prev, ...updates } : null);
                    }}
                />
            );
        }

        if (tab === 'communities') {
            return (
                <CommunityList
                    onSelect={(community) => setSelectedCommunity(community)}
                    myTrees={myTrees}
                    currentUserId={lightseed?.uid}
                    host={impersonatedCommunity || hostCommunity}
                />
            );
        }

        if (tab === 'collab') {
            return (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8">
                    <CollabsPage theme={effectiveTheme} onSelectCommunity={setSelectedCommunity} quote={observatoryQuote} quoteCopied={obsQuoteCopied} onCopyQuote={copyObservatoryQuote} />
                </div>
            );
        }

        // Search box reused inside the Visions/Events/Pulses headers (under the title).
        const searchBox = (
            <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Icons.Search />
                </div>
                <input
                    dir="auto"
                    type="text"
                    list="search-suggestions"
                    className="block w-full pl-10 pr-3 py-2 border border-emerald-100 rounded-xl leading-5 bg-white/80 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm shadow-sm"
                    placeholder={t('search_placeholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <datalist id="search-suggestions">
                    {searchSuggestions.map((s, i) => <option key={i} value={s} />)}
                </datalist>
            </div>
        );

        return (
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 min-h-[80vh]">
                {tab === 'forest' && (
                    /* The forest's controls in the same band as every list: search left, the
                       grid/map switch, then the CTAs (lightseed glow) at the right. */
                    <SectionHeader
                        title={t('forest')}
                        tone={tabTone('forest', effectiveTheme)}
                        footer={
                            <div className="relative w-full">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><Icons.Search /></div>
                                <input
                                    dir="auto"
                                    type="text"
                                    list="search-suggestions"
                                    className="block w-full pl-10 pr-3 py-2 border border-white/20 rounded-xl leading-5 bg-white/90 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-white focus:border-white sm:text-sm shadow-sm"
                                    placeholder={t('search_placeholder')}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <datalist id="search-suggestions">
                                    {searchSuggestions.map((s, i) => <option key={i} value={s} />)}
                                </datalist>
                            </div>
                        }
                        toggle={
                            <div className="flex shrink-0 items-center rounded-full bg-white/15 p-0.5 backdrop-blur-sm">
                                <button onClick={() => setViewMode('grid')} title={t('list_view')} aria-pressed={viewMode === 'grid'}
                                    className={`rounded-full p-2 transition-all ${viewMode === 'grid' ? 'bg-white text-slate-800 shadow-sm' : 'text-white/75 hover:text-white'}`}>
                                    <Icons.List />
                                </button>
                                <button onClick={() => setViewMode('map')} title={t('map_view')} aria-pressed={viewMode === 'map'}
                                    className={`rounded-full p-2 transition-all ${viewMode === 'map' ? 'bg-white text-slate-800 shadow-sm' : 'text-white/75 hover:text-white'}`}>
                                    <Icons.Map />
                                </button>
                            </div>
                        }
                        action={
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => openPlant({ type: 'LIFETREE', step: 2 })}
                                    className={`bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all active:scale-95 ${CTA_GLOW}`}
                                    style={{ backgroundColor: effectiveTheme.primary }}
                                >
                                    <Icons.Tree />
                                    <span className="hidden sm:inline">{t('plant_lifetree')}</span>
                                    <span className="sm:hidden">Plant</span>
                                </button>
                                {myTrees.length > 0 && (
                                    <button
                                        onClick={() => openPlant({ type: 'GUARDED', step: 2 })}
                                        className={`bg-sky-600 hover:bg-sky-700 text-white px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all active:scale-95 ${CTA_GLOW}`}
                                        style={{ backgroundColor: effectiveTheme.secondary }}
                                    >
                                        <Icons.Shield />
                                        <span className="hidden sm:inline">{t('guard_tree')}</span>
                                        <span className="sm:hidden">{t('guard')}</span>
                                    </button>
                                )}
                            </div>
                        }
                    />
                )}

                {tab === 'observatory' && (
                    <ObservatoryPage
                        tone={tabTone('observatory', effectiveTheme)}
                        alignments={alignmentCards}
                        onAcceptAlignment={onAcceptAlignment}
                        onRejectAlignment={onRejectAlignment}
                        onViewAlignmentTree={onViewAlignmentTree}
                        isAnalyzingSynergy={isAnalyzingSynergy}
                        synergies={synergies}
                        lastSynergyAt={lastSynergyAt}
                        canRefreshResonance={canRefreshResonance}
                        synergyCooldownLeft={synergyCooldownLeft}
                        onRefreshResonance={refreshResonanceObservatory}
                        favoriteResonanceIds={favoriteResonanceIds}
                        onToggleFavorite={toggleFavoriteResonance}
                        onReach={reachResonantTree}
                        observatoryQuote={observatoryQuote}
                        quoteCopied={obsQuoteCopied}
                        onCopyQuote={copyObservatoryQuote}
                    />
                )}


                {tab === 'forest' ? (
                    <ForestPage
                        lightHouseDomain={activeDataDomain || null}
                        lightHousesPublicOnly={activeCommunity?.reflectsPublic === true}
                        onViewLightHouse={setViewingLightHouse}
                        effectiveIsDark={effectiveIsDark}
                        showNatureTrees={showNatureTrees} setShowNatureTrees={setShowNatureTrees}
                        showUserTrees={showUserTrees} setShowUserTrees={setShowUserTrees}
                        showValidatedTrees={showValidatedTrees} setShowValidatedTrees={setShowValidatedTrees}
                        viewMode={viewMode}
                        filteredData={filteredData}
                        loadingMore={loadingMore}
                        activeTree={activeTree}
                        mapRefreshKey={mapRefreshKey}
                        isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} isInitiate={isInitiate}
                        currentUserId={lightseed?.uid}
                        guardedTreeIds={guardedTreeIds}
                        sentinelRef={forestSentinelRef}
                        onView={setSelectedTree}
                        onReach={openReach}
                        onPlayGrowth={setShowGrowthPlayer}
                        onQuickSnap={handleQuickSnap}
                        onValidate={(id: string, nextValidated: boolean) => { (nextValidated
                            // Initiates (git ledger) validate in their own name, like the superadmin;
                            // everyone else signs with their validated tree (peer web of trust).
                            ? validateLifetree(id, (isSuperAdmin || isInitiate) ? lightseed!.uid : activeTree!.id)
                            : unvalidateLifetree(id)
                        ).then(() => { showAlert(nextValidated ? "Validated!" : "Validation removed."); loadContent(true); }); }}
                        onRefresh={() => loadContent(true)}
                    />
                ) : tab === 'visions' ? (
                    <VisionsPage
                        visions={filteredData}
                        synergies={synergies}
                        favoriteResonanceIds={favoriteResonanceIds}
                        onToggleFavorite={toggleFavoriteResonance}
                        onReach={reachResonantTree}
                        isAnalyzingSynergy={isAnalyzingSynergy}
                        onAnalyze={handleAnalyzeSynergy}
                        canAnalyze={data.length >= 2}
                        lightseed={lightseed}
                        onCreateVision={() => setShowVisionModal(true)}
                        onSelectVision={setSelectedVision}
                        loadingMore={loadingMore}
                        viewer={{ uid: lightseed?.uid, isStaff: isSuperAdmin || isAdmin }}
                        searchBox={searchBox}
                        tone={tabTone('visions', effectiveTheme)}
                    />
                ) : tab === 'events' ? (
                    <PulseFeedPage
                        title={t('events')}
                        tone={tabTone('events', effectiveTheme)}
                        fg={tabFg('events')}
                        densityKey="events"
                        searchBox={
                            <div className="flex w-full items-center gap-2">
                                <div className="min-w-0 flex-1">{searchBox}</div>
                                {/* Past events rest behind this toggle; the clock snapshot refreshes
                                    on each touch so "today" stays honest in a long-lived session. */}
                                <button
                                    onClick={() => { setEventsNowMs(Date.now()); setShowPastEvents(v => !v); }}
                                    title={t('past_events_hint')}
                                    className={`whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-medium shadow-sm transition-colors ${showPastEvents
                                        ? 'border-emerald-600 bg-emerald-600 text-white'
                                        : 'border-emerald-100 bg-white/80 text-slate-500 hover:text-slate-700'}`}
                                >
                                    {t('past_events')}
                                </button>
                            </div>
                        }
                        action={lightseed && (
                            <button onClick={() => setShowEventModal(true)} className={`bg-sky-600 hover:bg-sky-700 text-white px-4 py-1.5 rounded-full text-sm font-bold transition-all flex items-center gap-2 active:scale-95 whitespace-nowrap ${CTA_GLOW}`}>
                                <Icons.Plus /> <span>{t('create_event')}</span>
                            </button>
                        )}
                        items={orderedEvents}
                        emptyText={t('no_events_found')}
                        loadingMore={loadingMore}
                        lightseed={lightseed}
                        onMatch={(p: Pulse) => { setSelectedPulse(p); openPulseModal(); }}
                        onView={(p: Pulse) => { void onViewPulseOrAlignment(p); }}
                        pattern
                        // Big-cards density uses the shared EventCard; its community face opens
                        // the host community (the same resolution the dashboard banner uses).
                        renderBigCard={(ev: Pulse) => {
                            const host = impersonatedCommunity || hostCommunity || defaultCommunity;
                            const face = host && (!ev.communityId || ev.communityId === host.id) ? host : null;
                            return (
                                <EventCard
                                    event={ev}
                                    onOpen={() => { void onViewPulseOrAlignment(ev); }}
                                    community={face}
                                    onOpenCommunity={face ? () => setSelectedCommunity(face) : undefined}
                                    isDark={effectiveIsDark}
                                />
                            );
                        }}
                    />
                ) : tab === 'offerings' ? (
                    // Offerings holds two full-width sub-tabs: the offering pulses, and beds (a bed
                    // is an offering). The strip renders inside each sub-page's SectionHeader band.
                    (() => {
                        const offeringsTabs = (
                            <FullWidthTabs
                                active={offeringsSub}
                                onChange={(k) => setOfferingsSub(k as 'offerings' | 'beds')}
                                // One tone for the whole strip: the active sub-tab's, matching its band below.
                                tone={tabTone(offeringsSub === 'beds' ? 'beds' : 'offerings', effectiveTheme)}
                                tabs={[
                                    { key: 'offerings', label: 'Offerings', icon: <Icons.Exchange /> },
                                    { key: 'beds', label: 'Beds', icon: <Icons.Moon /> },
                                ]}
                            />
                        );
                        return offeringsSub === 'beds' ? (
                            <BedsBrowsePage
                                onViewTree={setSelectedTree}
                                lightHouseDomain={activeDataDomain || null}
                                lightHousesPublicOnly={activeCommunity?.reflectsPublic === true}
                                theme={effectiveTheme}
                                tabs={offeringsTabs}
                            />
                        ) : (
                            <PulseFeedPage
                                title="Offerings"
                                tone={tabTone('offerings', effectiveTheme)}
                                densityKey="offerings"
                                searchBox={searchBox}
                                action={lightseed && (
                                    <button onClick={() => setShowOfferModal(true)} style={{ backgroundColor: tabTone('offerings') }} className={`hover:brightness-110 text-white px-4 py-1.5 rounded-full text-sm font-bold transition-all flex items-center gap-2 active:scale-95 whitespace-nowrap ${CTA_GLOW}`}>
                                        <Icons.Plus /> <span>{t('offer_make')}</span>
                                    </button>
                                )}
                                items={filteredData}
                                emptyText="No offerings yet. Offer a bed or a service to the circle."
                                loadingMore={loadingMore}
                                lightseed={lightseed}
                                onMatch={(p: Pulse) => { setSelectedPulse(p); openPulseModal(); }}
                                onView={(p: Pulse) => { void onViewPulseOrAlignment(p); }}
                                pattern
                                tabs={offeringsTabs}
                                searchOnTablet
                            />
                        );
                    })()
                ) : tab !== 'observatory' && tab !== 'profile' && tab !== 'inspiration' && tab !== 'about' && tab !== 'dashboard' && tab !== 'newsletter' && tab !== 'communities' && (
                    <PulseFeedPage
                        title={t('pulses')}
                        tone={tabTone('pulses', effectiveTheme)}
                        densityKey="pulses"
                        searchBox={searchBox}
                        action={lightseed && (
                            <button onClick={() => openPulseModal()} className={`bg-orange-600 hover:bg-orange-700 text-white px-4 py-1.5 rounded-full text-sm font-bold transition-all flex items-center gap-2 active:scale-95 whitespace-nowrap ${CTA_GLOW}`}>
                                <Icons.Pulse /> <span>{t('emit_pulse')}</span>
                            </button>
                        )}
                        items={filteredData}
                        emptyText={t('no_trees_found')}
                        loadingMore={loadingMore}
                        lightseed={lightseed}
                        onMatch={(p: Pulse) => { setMatchCandidate(p); openPulseModal(); }}
                        onView={(p: Pulse) => { void onViewPulseOrAlignment(p); }}
                    />
                )}
            </main>
        );
    };

    return (
        <div className={`min-h-screen relative font-sans flex flex-col ${effectiveIsDark ? 'text-slate-100' : 'text-slate-800'}`}>
            <div className="fixed inset-0 z-0 pointer-events-none" style={backgroundStyle}></div>
            {/* New-deploy prompt — the service worker waits for consent instead of silent swap. */}
            <UpdateToast />
            <ToastHost />
            {/* Blocking busy overlay — a darkened backdrop + the spinner while an operation runs
                (e.g. a vision's cascade delete). Above modals (z-100); the snackbar confirms after. */}
            {busyLabel && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-sm" role="status" aria-live="polite">
                    <Loading size={56} />
                    <p className="text-sm font-medium text-white/90">{busyLabel}</p>
                </div>
            )}
            {/* Page-level scroll affordance — only on the main page (hidden while a detail/modal is open). */}
            {openKeys.length === 0 && <ScrollChevrons axis="y" fixed />}

            {/* THE CARE CORNER (Zoltán, 2026-07-22) — care, one thumb-tap from anywhere.
                Bottom LEFT (the community switcher owns bottom right), mirroring its size.
                Context-sensitive: an open tree is the target; otherwise the default tree.
                One tap lands on the target's Care section; the drop pulses sky when the
                target is thirsty. The daily gesture of the whole economy, given one home. */}
            {lightseed && (() => {
                const careTarget = careOverride || selectedTree || activeTree || myTrees[0] || null;
                if (!careTarget) return null;
                const thirsty = isWateringOverdue(careTarget) || wateringNeededCount > 0;
                return (
                    // A full-width strip that MIRRORS the nav's container (same max-w-7xl mx-auto
                    // and px steps), so the bead sits at the same x as the logo on EVERY screen,
                    // narrow or ultra-wide. pointer-events pass through except on the bead.
                    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40">
                        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                            {/* translateX(calc(20px - 50%)) centres the bead (any size) under the
                                40px logo's centre, 20px from this container's left edge — so the two
                                stay aligned even as the bead grows. */}
                            <div className="relative inline-block" style={{ transform: 'translateX(calc(20px - 50%))' }}>
                                <button
                                    onClick={() => setCareModalOpen(true)}
                                    title={t('care_for_tree').replace('{name}', careTarget.name)}
                                    aria-label={t('care_for_tree').replace('{name}', careTarget.name)}
                                    className={`pointer-events-auto relative block transition-transform hover:scale-110 active:scale-95 ${
                                        thirsty ? 'animate-pulse' : ''
                                    }`}
                                >
                                    {/* A THIN white cloud: a bead-sized white disc BLURRED, so its edge is a
                                        gaussian falloff, pure white right at the rim, fading soft to nothing
                                        over ~half the bead's radius. Bead-sized (not larger) so the solid
                                        core hides behind the bead and only the wisp shows; the blur, not a
                                        gradient stop, does the fading, so there is no band and no hard circle. */}
                                    <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[58px] w-[58px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white blur-[6px]" />
                                    {/* The droplet itself, drawn by Lumo — the bead IS the button, 58px. */}
                                    <img src="/droplet.svg" alt="" draggable={false} className="relative h-[58px] w-[58px] object-contain" />
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* The care droplet's modal — a small care sheet for the target tree. */}
            {careModalOpen && lightseed && (() => {
                const careTarget = careOverride || selectedTree || activeTree || myTrees[0] || null;
                if (!careTarget) return null;
                return (
                    <CareModal
                        tree={careTarget}
                        sender={{ uid: lightseed.uid, displayName: lightseed.displayName, photoURL: lightseed.photoURL }}
                        hasVision={!!defaultVisionId}
                        onOpenCare={() => {
                            setCareModalOpen(false);
                            // The care sheet floats OVER a reach conversation, but the FULL care
                            // view is a whole overlay — the reach modal must step aside, or it
                            // covers the very care it opened (the openTreeFromReaches lesson).
                            setShowReachModal(false);
                            setTreeSectionHint('care');
                            if (!selectedTree || selectedTree.id !== careTarget.id) setSelectedTree(careTarget);
                        }}
                        onOpenVision={defaultVisionId ? async () => {
                            setCareModalOpen(false);
                            setShowReachModal(false); // same step-aside: the vision opens in front
                            const vision = await getVisionById(defaultVisionId).catch(() => null);
                            if (vision) { setSelectedTree(null); setSelectedVision(vision); }
                        } : undefined}
                        onOffer={() => {
                            setCareModalOpen(false);
                            setShowReachModal(false);
                            setOfferTo({ kind: 'tree', id: careTarget.id, lid: careTarget.lid, name: careTarget.name, keeperUid: careTarget.ownerId });
                            setShowOfferModal(true);
                        }}
                        onClose={() => { setCareModalOpen(false); setCareOverride(null); }}
                    />
                );
            })()}

            {/* The corner switcher back to the organisation's page — on its own domain, and for
                staff standing in community view on the hub. It MIRRORS the care bead: the same
                max-w-7xl content container, but right-anchored, its centre 20px from the container's
                right edge and on the SAME horizontal line as the bead's centre (bead centre = bottom-4
                + 29px = 45px; this 48px avatar sits at bottom-[21px] so its centre is 45px too). So the
                logo (top-left), the bead (bottom-left) and this community avatar (bottom-right) read as
                three aligned corners of the content, not one pinned to the raw viewport edge. */}
            {landingCommunity && seedView && (
                <div className="pointer-events-none fixed inset-x-0 bottom-[21px] z-40">
                    <div className="mx-auto max-w-7xl px-4 text-right sm:px-6 lg:px-8">
                        <button
                            onClick={() => setSeedView(false)}
                            title={`Back to ${landingCommunity.name}`}
                            aria-label={`Back to ${landingCommunity.name}`}
                            className="pointer-events-auto relative inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white shadow-xl ring-2 ring-amber-300/70 transition-transform hover:scale-110 active:scale-95"
                            style={{ transform: 'translateX(calc(50% - 20px))' }}
                        >
                            {landingCommunity.logoUrl
                                ? <img src={landingCommunity.logoUrl} alt="" className="h-full w-full object-cover" />
                                : landingCommunity.heroImageUrl
                                    ? <img src={landingCommunity.heroImageUrl} alt="" className="h-full w-full object-cover" />
                                    : <Icons.ArrowLeft />}
                        </button>
                    </div>
                </div>
            )}

            <div className="relative z-20 flex-1">
                {impersonatedCommunity && (
                    <div className="sticky top-0 z-40 flex items-center justify-center gap-3 bg-amber-500 px-4 py-1.5 text-center text-xs font-bold text-white shadow-md">
                        <span className="truncate">{t('viewing_as').replace('{name}', impersonatedCommunity.name)}</span>
                        <button
                            onClick={() => { setImpersonatedCommunity(null); setTab('dashboard'); window.scrollTo(0, 0); }}
                            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/25 px-2.5 py-0.5 font-bold uppercase tracking-wide hover:bg-white/40"
                        >
                            <Icons.Close /> Exit community
                        </button>
                    </div>
                )}
                {isSuperAdmin && carryingTree && (
                    /* Honest provenance banner — mirrors the community-view banner above. The
                       bridge stays visible the whole time: the being's words, the carrier's hands. */
                    <div className="sticky top-0 z-40 flex items-center justify-center gap-3 bg-purple-600 px-4 py-1.5 text-center text-xs font-bold text-white shadow-md">
                        <span className="truncate">{t('carrying_line').replace('{tree}', carryingTree.name).replace('{name}', lightseed?.displayName || t('you'))}</span>
                        <button
                            onClick={() => setCarryingTree(null)}
                            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/25 px-2.5 py-0.5 font-bold uppercase tracking-wide hover:bg-white/40"
                        >
                            <Icons.Close /> Stop carrying
                        </button>
                    </div>
                )}
                {(
                    <Navigation
                        activeTab={tab}
                        // A menu tab ALWAYS lands on its tab: close EVERY being-detail overlay first.
                        // The Light House renders in a FIXED wrapper, so without this the tab
                        // changed underneath while the house stayed on top (a dead-looking menu).
                        setTab={(t: string) => {
                            setSelectedTree(null); setSelectedVision(null); setSelectedPulse(null);
                            setViewingLightHouse(null); setSelectedCommunity(null);
                            setSelectedAlignment(null); setSelectedCovenantId(null);
                            setTab(t);
                        }}
                        onLogin={() => setShowAuthModal(true)}
                        onLogout={() => { logout(); setCarryingTree(null); setTab('dashboard'); }}
                        onProfile={() => {
                            // The profile avatar ALWAYS lands on the profile — close any being-detail
                            // overlay sitting on top (a tree opened from the profile would otherwise stay).
                            setSelectedTree(null); setViewingLightHouse(null); setSelectedCommunity(null);
                            setSelectedVision(null); setSelectedAlignment(null); setSelectedCovenantId(null); setSelectedPulse(null);
                            setTab('profile');
                        }}
                        pendingAlignmentsCount={alignments.length}
                        reachNotificationsCount={unreadReaches}
                        treeInviteCount={pendingTreeInvites}
                        careAlertCount={wateringNeededCount}
                        onOpenReachInbox={openDirectMessages}
                        logoUrl={configuredLogoUrl}
                        appName={isSeedShellHost(window.location.hostname) ? '.seed' : config.name}
                        crownRole={deriveCrownRole(impersonatedCommunity || hostCommunity, dataAuthority)}
                        // An open event names itself in the header (mobile label + tablet centre).
                        pageLabel={selectedPulse?.type === 'event' ? 'Event' : undefined}
                        isNightMode={effectiveIsDark}
                        theme={effectiveTheme}
                        onToggleNightMode={toggleNightMode}
                    />
                )}
                
                {/* The Pathway — THE ONE next step on the trail, for visitors and members alike.
                    Gated on pathwayFacts.loaded so the wrong stage never flashes while the
                    link-borne facts are still in flight. Dismissable per step (localStorage). */}
                {/* PathwayCTA owns its own wrapper spacing: when the Light Path is off or the
                    step is dismissed it renders null — no phantom padding left behind. */}
                {!selectedTree && !selectedVision && !selectedPulse && pathwayFacts.loaded && tab === 'dashboard' && (
                    <PathwayCTA
                        input={pathwayInput}
                        actions={pathwayActions}
                        theme={effectiveTheme}
                        isDark={effectiveIsDark}
                        onOpenOverview={() => setShowPathOverview(true)}
                    />
                )}
                <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><Loading /></div>}>
                {selectedTree ? (
                    <div className="animate-in fade-in duration-200">
                        {isBedTree(selectedTree) ? (
                        <BedProfile
                            bed={selectedTree}
                            onClose={() => { setSelectedTree(null); setMapRefreshKey(k => k + 1); }}
                            onViewTree={setSelectedTree}
                            onViewPulse={onViewPulseOrAlignment}
                            onUpdate={(updates: Partial<Lifetree>) => handleTreeUpdate(selectedTree.id, updates)}
                            onDelete={() => { setSelectedTree(null); setMapRefreshKey(k => k + 1); }}
                        />
                        ) : (
                        <LifetreeDetail
                            tree={selectedTree}
                            onClose={() => { setSelectedTree(null); setMapRefreshKey(k => k + 1); }}
                            onPlayGrowth={setShowGrowthPlayer}
                            onValidate={(id: string, nextValidated: boolean) => (nextValidated
                                ? validateLifetree(id, (isSuperAdmin || isInitiate) ? lightseed!.uid : activeTree!.id)
                                : unvalidateLifetree(id)
                            ).then(() => {
                                handleTreeUpdate(id, {
                                    validated: nextValidated,
                                    validatorId: nextValidated ? ((isSuperAdmin || isInitiate) ? lightseed!.uid : activeTree!.id) : null,
                                });
                                showAlert(nextValidated ? "Validated!" : "Validation removed.");
                                loadContent(true);
                            })}
                            onUpdate={(updates: Partial<Lifetree>) => handleTreeUpdate(selectedTree.id, updates)}
                            onDelete={() => { handleDeleteTreeConfirmed(selectedTree.id); setSelectedTree(null); }}
                            onCreatePulse={() => openPulseModal(selectedTree)}
                            onReachTree={(tree: Lifetree) => openReach(tree)}
                            onAlertGuardians={() => openReach(selectedTree, 'guardians')}
                            onViewPulse={onViewPulseOrAlignment}
                            initialSection={treeSectionHint || undefined}
                            // Superadmin voice-bridge: carry this being's pulses (see carryingTree).
                            carrying={carryingTree?.id === selectedTree.id}
                            onCarry={isSuperAdmin ? setCarryingTree : undefined}
                            isDefaultTree={defaultTreeId === selectedTree.id}
                            onSetDefault={() => { setDefaultTree(selectedTree.id); showAlert(`${selectedTree.name} is now your default tree.`); }}
                            targetUserProfile={{ onlyValidatedCanReach: selectedTree.onlyValidatedCanReach }}
                        />
                        )}
                        {showGrowthPlayer && <GrowthPlayerModal treeId={showGrowthPlayer} onClose={() => setShowGrowthPlayer(null)} />}
                    </div>
                ) : selectedVision ? (
                    <div className="animate-in fade-in duration-200">
                        <VisionProfile
                            vision={selectedVision}
                            onClose={() => setSelectedVision(null)}
                            currentUserId={lightseed?.uid}
                            onDelete={handleDeleteVisionInApp}
                            myTrees={myTrees}
                            onGrow={(v) => openVisionGrowth(v)}
                            onViewPulse={(p) => setSelectedPulse(p)}
                            onOffer={(v) => { setOfferTo({ kind: 'vision', id: v.id, lid: v.lid, name: v.title, keeperUid: v.authorId, rootTreeId: v.lifetreeId }); setShowOfferModal(true); }}
                            onViewTree={(tree) => { setSelectedVision(null); setSelectedTree(tree); }}
                            hostStrictScope={(impersonatedCommunity || hostCommunity)?.strictScope}
                        />
                    </div>
                ) : selectedAlignment ? (
                    <div className="animate-in fade-in duration-200">
                        <AlignmentView
                            alignment={selectedAlignment}
                            currentUserId={lightseed?.uid}
                            onClose={() => setSelectedAlignment(null)}
                            onViewTree={(tree) => { setSelectedAlignment(null); setSelectedTree(tree); }}
                            notify={notify}
                        />
                    </div>
                ) : selectedCovenantId ? (
                    <div className="animate-in fade-in duration-200">
                        <CovenantProfile
                            covenantId={selectedCovenantId}
                            currentUserId={lightseed?.uid}
                            onClose={() => setSelectedCovenantId(null)}
                            notify={notify}
                        />
                    </div>
                ) : (selectedPulse && selectedPulse.type === 'offering') ? (
                    // An offering has its own being-face; its tree view is its lifecycle.
                    <div className="animate-in fade-in duration-200">
                        <OfferingProfile
                            offering={selectedPulse}
                            onClose={() => setSelectedPulse(null)}
                            onUpdate={(u) => setSelectedPulse(prev => prev ? { ...prev, ...u } : prev)}
                            onEdit={() => setEditingOffering(selectedPulse)}
                        />
                    </div>
                ) : (selectedPulse && selectedPulse.type === 'event') ? (
                    // Events render in-flow (below the sticky nav header), like the tree/vision views.
                    <div className="animate-in fade-in duration-200">
                        <EventProfile
                            theme={effectiveTheme}
                            pulse={selectedPulse}
                            activeTree={activeTree}
                            onClose={() => setSelectedPulse(null)}
                            canEdit={canEditEvent(selectedPulse, { uid: lightseed?.uid, isStaff: isSuperAdmin || isAdmin }, { hostCommunity })}
                            onEdit={() => setEditingEvent(selectedPulse)}
                            currentUserId={lightseed?.uid}
                            myTrees={myTrees}
                            hostStrictScope={(impersonatedCommunity || hostCommunity)?.strictScope}
                        />
                    </div>
                ) : renderMainContent()}
                </Suspense>
                <GDPRBanner />

                {/* THE MOTHER DOOR (ring 2026-08-22) — a seed-cradle portal wears a corner door
                    back to the community's own site; the landing's corner seed, mirrored. */}
                {(() => {
                    const home = motherDoorUrl(impersonatedCommunity || hostCommunity, window.location.hostname);
                    if (!home) return null;
                    const c = impersonatedCommunity || hostCommunity;
                    return (
                        <a href={home} title={c?.domain}
                            className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white shadow-2xl transition-transform hover:scale-110 active:scale-95">
                            {c?.logoUrl
                                ? <img src={c.logoUrl} alt={c?.name || ''} className="h-full w-full object-cover" />
                                : <span className="text-slate-600"><Icons.Globe /></span>}
                        </a>
                    );
                })()}

                {showAuthModal && !lightseed && (
                    <AuthModal onClose={() => setShowAuthModal(false)} inviteId={inviteParam} inviteOnly={config.inviteOnly} theme={effectiveTheme}
                        startMode={arrivedInvite ? 'signup' : undefined}
                        greetName={arrivedInvite ? selectedCommunity?.name : undefined} />
                )}

                {/* The Path, whole — the Light Path's ruleset with the walker's position lit. */}
                {showPathOverview && (
                    <Modal title="The Path" onClose={() => setShowPathOverview(false)}>
                        <div className="max-h-[70vh] overflow-y-auto p-1 pr-2">
                            <PathOverview current={derivePathway(pathwayInput).stage} />
                        </div>
                    </Modal>
                )}
            </div>

            <Footer community={impersonatedCommunity || hostCommunity || defaultCommunity} theme={effectiveTheme} isDark={effectiveIsDark} />

            <Suspense fallback={null}>
            {/* Non-event pulses keep the full-screen overlay (they carry their own sticky top bar).
                Offerings are excluded too: they wear their own being-face (OfferingProfile). */}
            {selectedPulse && selectedPulse.type !== 'event' && selectedPulse.type !== 'offering' && (
                <DetailWrapper belowHeader>
                    <PulseDetail
                        pulse={selectedPulse}
                        activeTree={activeTree}
                        onClose={() => setSelectedPulse(null)}
                        backLabel={selectedTree && selectedPulse.lifetreeId === selectedTree.id ? `Back to ${selectedTree.name}` : 'Back'}
                        canEdit={canEditEvent(selectedPulse, { uid: lightseed?.uid, isStaff: isSuperAdmin || isAdmin }, { hostCommunity })}
                        onEdit={() => setEditingEvent(selectedPulse)}
                    />
                </DetailWrapper>
            )}

            {editingEvent && (
                <EventModal
                    lightseed={lightseed}
                    event={editingEvent}
                    scope={editingEvent.communityId ? 'community' : 'node'}
                    onClose={() => setEditingEvent(null)}
                    uploading={uploading}
                    handleImageUpload={handleImageUpload}
                    onCreate={async (data: any) => {
                        // updateEvent itself announces the edit WITH its patch, which every
                        // open list merges (a second, patchless announce read as a removal
                        // and made the edited event vanish from the feed).
                        await updateEvent(editingEvent.id, data);
                        setSelectedPulse(prev => prev && prev.id === editingEvent.id ? { ...prev, ...data } : prev);
                        setEditingEvent(null);
                    }}
                />
            )}

            {selectedCommunity && (
                <DetailWrapper belowHeader>
                    <CommunityProfile
                    onViewLightHouse={setViewingLightHouse}
                        community={selectedCommunity}
                        arrivedInvite={arrivedInvite}
                        onSignIn={() => setShowAuthModal(true)}
                        onViewTree={(tree: Lifetree) => { setSelectedCommunity(null); setSelectedTree(tree); }}
                        onViewEvent={(p: Pulse) => { setSelectedCommunity(null); void onViewPulseOrAlignment(p); }}
                        onClose={() => { setSelectedCommunity(null); setArrivedInvite(null); setMapRefreshKey(k => k + 1); }}
                        onUpdate={(updates) => {
                            setSelectedCommunity(prev => prev ? { ...prev, ...updates } : null);
                            // Whisper the edit to every open communities list, so its card wears
                            // the new face (appearance, name, vision) without a reload.
                            if (selectedCommunity) announce('communities', selectedCommunity.id);
                            // If this is the host (or default/dev) community, refresh the app shell so
                            // settings like showStats/theme apply to the dashboard immediately, not on reload.
                            if (selectedCommunity && hostCommunity && selectedCommunity.id === hostCommunity.id) {
                                setHostCommunity(prev => prev ? { ...prev, ...updates } : null);
                            }
                            if (selectedCommunity && defaultCommunity && selectedCommunity.id === defaultCommunity.id) {
                                setDefaultCommunity(prev => prev ? { ...prev, ...updates } : null);
                            }
                        }}
                        onEnterCommunityView={isSuperAdmin ? (community) => {
                            setImpersonatedCommunity(community);
                            setSelectedCommunity(null);
                            setTab('about');
                            // Community view opens in the seed; the corner switcher lets staff
                            // flip to the community's custom landing and back.
                            setSeedView(true);
                            window.scrollTo(0, 0);
                        } : undefined}
                    />
                </DetailWrapper>
            )}

            {viewingLightHouse && (
                <DetailWrapper belowHeader>
                    <LightHouseProfile
                        lightHouse={viewingLightHouse}
                        onClose={() => setViewingLightHouse(null)}
                        onViewCommunity={setSelectedCommunity}
                        // Opening a bed/tree from a Light House closes the house overlay so the
                        // detail comes to the foreground (selectedTree renders in-flow, beneath the
                        // fixed DetailWrapper — without this it opens in the background).
                        onViewTree={(t) => { setViewingLightHouse(null); setSelectedTree(t); }}
                        canEdit={isSuperAdmin || isAdmin || viewingLightHouse.ownerId === lightseed?.uid}
                        editIsStaffOnly={viewingLightHouse.ownerId !== lightseed?.uid && (isSuperAdmin || isAdmin)}
                        onDelete={async (id) => {
                            await deleteLightHouse(id);
                            setViewingLightHouse(null);
                            announce('lightHouses', id);
                            notify(speak('lh_released'));
                        }}
                        onSetVisibility={async (id, v) => {
                            await setLightHouseVisibility(id, v);
                            setViewingLightHouse(prev => prev && prev.id === id ? { ...prev, visibility: v } : prev);
                            announce('lightHouses', id);
                            notify(speak(spokenLine('lh_visibility_now', { v: v === 'community' ? speak('vis_community') : speak(v === 'public' ? 'vis_public' : 'vis_node') })));
                        }}
                    />
                </DetailWrapper>
            )}


            {/* Direct Messages as a large overlay: the nav envelope and reach deep-links open the
                inbox here, in place, instead of steering to the profile's Reaches tab. */}
            {showReachModal && lightseed && (
                <DetailWrapper>
                    {/* Mobile: near-full-screen with a whisper of margin + radius, so the messages
                        card visibly floats OVER the app; on desktop it centres vertically, so the
                        top and bottom margins are equal. */}
                    <div className="mx-auto w-full max-w-6xl px-2 py-2 sm:flex sm:min-h-full sm:flex-col sm:justify-center sm:px-6 sm:py-6 lg:py-10">
                        <div className="relative min-h-[calc(100dvh-1rem)] rounded-2xl bg-white p-3 pt-3 shadow-2xl sm:min-h-0 sm:p-6 sm:pt-4">
                            <button
                                onClick={() => setShowReachModal(false)}
                                title="Close"
                                aria-label="Close messages"
                                className="absolute right-3 top-3 z-10 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                            >
                                <Icons.Close />
                            </button>
                            <ProfileReaches
                                lightseed={lightseed}
                                myTrees={myTrees}
                                reachPartner={reachTree}
                                reachAudience={reachAudience}
                                onConsumeReach={() => { setReachTree(null); setReachAudience(undefined); }}
                                onOpenTreeById={(id: string) => openTreeFromReaches(id, { closeReachModal: true })}
                                onOpenCareById={openCareFromReaches}
                            />
                        </div>
                    </div>
                </DetailWrapper>
            )}

            {showGrowthPlayer && !selectedTree && <GrowthPlayerModal treeId={showGrowthPlayer} onClose={() => setShowGrowthPlayer(null)} />}

            {showPlantModal && (
                <PlantTreeModal
                    lightseed={lightseed}
                    initialType={plantInit.type}
                    initialStep={plantInit.step}
                    onClose={() => setShowPlantModal(false)}
                    onPlant={async (data: any) => {
                        await plantLifetree(data);
                        await refreshTrees();          // refresh the My Trees section immediately
                        if (tab === 'forest') loadContent(true); // and the forest/map
                    }}
                    uploading={uploading}
                    handleImageUpload={handleImageUpload}
                    readPhotoProvenance={readPhotoProvenance}
                />
            )}

            {showEventModal && (
                <EventModal
                    lightseed={lightseed}
                    onClose={() => setShowEventModal(false)}
                    uploading={uploading}
                    handleImageUpload={handleImageUpload}
                    onCreate={async (data: any) => {
                        await createEvent(data);
                        if (tab === 'events') loadContent(true);
                    }}
                />
            )}

            {showOfferModal && (
                <OfferModal
                    to={offerTo ?? undefined}
                    onClose={() => { setShowOfferModal(false); setOfferTo(null); }}
                    onCreated={() => { if (tab === 'offerings') loadContent(true); }}
                />
            )}

            {editingOffering && (
                <OfferModal
                    offering={editingOffering}
                    onClose={() => setEditingOffering(null)}
                    onSaved={(updates) => {
                        setSelectedPulse(prev => prev && prev.id === editingOffering.id ? { ...prev, ...updates } : prev);
                        if (tab === 'offerings') loadContent(true);
                    }}
                />
            )}

            {showPulseModal && (
                <EmitPulseModal
                    lightseed={lightseed}
                    activeTree={activeTree}
                    matchCandidate={matchCandidate}
                    targetTree={pulseTargetTree}
                    targetVision={pulseTargetVision}
                    onClose={() => { setShowPulseModal(false); setPulseTargetTree(null); setPulseTargetVision(null); }}
                    onMint={async (data: any) => {
                        // Carrying a being's pulse: only the DISPLAY + provenance fields change —
                        // the block is still signed by (authorId =) the real uid, and carriedByName/
                        // disclosure keep the bridge visible until beings sign for themselves.
                        if (isSuperAdmin && carryingTree && data.lifetreeId === carryingTree.id) {
                            const beingName = carryingTree.shortTitle
                                ? `${carryingTree.name}, ${carryingTree.shortTitle}`
                                : carryingTree.name;
                            const carrierName = lightseed?.displayName || 'a superadmin';
                            await mintPulse({
                                ...data,
                                authorName: carryingTree.name,
                                authorPersonName: beingName,
                                carriedByName: carrierName,
                                disclosure: `This pulse was carried by ${carrierName} from ${beingName}.`,
                            });
                        } else {
                            await mintPulse(data);
                        }
                    }}
                    onGrowVision={handleGrowVision}
                    onProposeAlignment={async (data: any) => { await proposeAlignment(data); }}
                    onGrown={handleTreeGrown}
                    uploading={uploading}
                    handleImageUpload={handleImageUpload}
                    uploadBase64Image={uploadBase64Image}
                />
            )}

            {showVisionModal && (
                <CreateVisionModal
                    lightseed={lightseed}
                    activeTree={activeTree}
                    trees={myTrees}
                    onClose={() => setShowVisionModal(false)}
                    onCreate={async (data: any) => { await createVision(data); }}
                    uploading={uploading}
                    handleImageUpload={handleImageUpload}
                    uploadBase64Image={uploadBase64Image}
                />
            )}
            </Suspense>

            {/* Alerts/confirms must be the TOP layer. At the root — outside the `relative z-20`
                content wrapper — so its z-[100] competes at root level and beats every overlay
                (DetailWrapper z-40, Modal z-50); inside the wrapper it was trapped in a z-20
                stacking context and errors hid behind open detail views. */}
            <DialogHost />
        </div>
    );
}

const App = () => {
  const route = topLevelRoute();

  // The widget is an early return and must carry its OWN LanguageProvider: the i18n sweep
  // taught LifeseedWidget to speak (useLanguage), and a speaker without a provider throws —
  // the seed button on partner domains rendered blank white until this wrap (2026-08-15).
  if (route.kind === 'widget') return <LanguageProvider><SilentUpdate /><LifeseedWidget domain={route.domain} /></LanguageProvider>;

  // The data model — a hidden, full-screen /model route. Not linked anywhere (need-to-know);
  // reach it by typing the URL. Logo top-left (the usual place) returns to the app.
  // (Trailing slash tolerated.)
  if (route.kind === 'model') {
    return (
      <div className="min-h-screen bg-[#05080a] p-3 sm:p-6">
        <SilentUpdate />
        <a href="/" title="Back to lightseed" aria-label="Back to lightseed"
           className="fixed left-4 top-4 z-50 rounded-full bg-white/10 p-1.5 shadow-lg backdrop-blur transition-colors hover:bg-white/20">
          <Logo width={38} height={38} />
        </a>
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loading /></div>}>
          {/* pt-14 keeps the card header clear of the fixed logo. */}
          <div className="mx-auto max-w-[1440px] pt-14"><DataModelCrystal /></div>
        </Suspense>
      </div>
    );
  }

  return (
    <LanguageProvider>
      <SessionProvider>
        <AppContent />
        {/* The network's face: slow-wire loader, upload progress, offline snackbar. */}
        <NetworkStatus />
      </SessionProvider>
    </LanguageProvider>
  );
};

export default App;
