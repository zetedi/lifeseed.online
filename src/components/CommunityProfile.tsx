
import React, { useState, useEffect, useMemo } from 'react';
import { showAlert, showConfirm } from "./ui/Dialog";
import { useLanguage } from '../contexts/LanguageContext';
import { useSession } from '../contexts/SessionContext';
import { Icons } from './ui/Icons';
import { MahameruAvatar } from './ui/MahameruAvatar';
import { Community, CommunityInvite, Lifetree, Pulse, LightHouse } from '../types';
import { doorOf, checkInvite } from '../domain/communityDoor';
import { updateCommunity, uploadImage, getTreesByDomain, treesStandingIn, getParticipatingTrees, deleteCommunity, getCommunityByDomain, getLightHousesByDomain, getLightHousesByCommunity, getAllLightHouses, createLightHouse, adoptLightHouse, getPersonName, joinCommunityOpen, joinCommunityWithInvite, requestKeepership, withdrawKeeperRequest, formCommunityFromCircle } from '../services/firebase';
import { formCircleRefusal, isTreeCircle } from '../domain/treeCircle';
import { isDomainVerified } from '../domain/domainVerification';
import { CommunityVision } from './community/CommunityVision';
import { CommunityCouncil } from './community/CommunityCouncil';
import { CommunityEvents } from './community/CommunityEvents';
import { CommunityFirstTree } from './community/CommunityFirstTree';
import { CommunityLightHouse } from './community/CommunityLightHouse';
import { CommunityTreesTab } from './community/CommunityTreesTab';
import { CommunityMembers } from './community/CommunityMembers';
import { PathOverview } from './PathOverview';
import { CommunityIntelligence } from './community/CommunityIntelligence';
import { CommunityLight } from './community/CommunityLight';
import { CommunityDigitalTree } from './community/CommunityDigitalTree';
import { LoveButton } from './ui/LoveButton';
import { CommunityCodeChain } from './community/CommunityCodeChain';
import { CommunityAppearance } from './community/CommunityAppearance';
import { CommunityInterbeingMatrix } from './community/CommunityInterbeingMatrix';
import { BeingProfile, type BeingSection } from './BeingProfile';
import { SectionTitle } from './ui/SectionTitle';
import { SuperDot } from './ui/SuperDot';
import { normalizeTheme } from '../utils/theme';
import { canViewLightHouse, type LightHouse as LightHouseType } from '../domain/lightHouse';
import { notify } from './ui/Toast';
import { announce } from '../services/refreshBus';
import { useRefreshSignal } from '../hooks/useRefreshSignal';
import { LoreSection, loreTabs, type LoreTabId } from './about/AboutSections';
import { NodeGrowthTree } from './about/NodeGrowthTree';
import { queryableLevels, ownMergeUid } from '../domain/pulseVisibility';
import { firestoreStore } from '../adapters/firestore';
import { isParticipant } from '../domain/views/participation';
import { canCareForTree } from '../domain/policy';
import { speak, spokenLine } from '../utils/translations';

import { Picture } from './ui/Picture';
interface CommunityProfileProps {
  community: Community;
  // An invitation the viewer arrived holding (/i/<id>) — the door greets them by it.
  arrivedInvite?: CommunityInvite | null;
  // Open the auth modal — the signed-out invitee's door out of the greeting.
  onSignIn?: () => void;
  onUpdate?: (updates: Partial<Community>) => void;
  onClose: () => void;
  onViewTree?: (tree: Lifetree) => void;
  onViewLightHouse?: (s: LightHouseType) => void;
  // Open an event's page. Seeing an event implies at least viewer rights, so this is
  // offered to everyone — not gated behind edit permissions.
  onViewEvent?: (event: Pulse) => void;
  // Superadmin only — "switch to community view": render the whole app as this community.
  onEnterCommunityView?: (community: Community) => void;
}

const bareDomain = (d?: string) => (d || '').toLowerCase().replace(/^www\./, '');

export const CommunityProfile: React.FC<CommunityProfileProps> = ({
  community,
  arrivedInvite,
  onSignIn,
  onUpdate,
  onClose,
  onViewTree,
  onViewEvent,
  onEnterCommunityView,
  onViewLightHouse,
}) => {
  const { t } = useLanguage();
  // Session-derived values from context (were prop-drilled from App).
  const { lightseed, isAdmin, isSuperAdmin } = useSession();
  const currentUser = lightseed;
  const currentUserId = lightseed?.uid;
  // FULL PEERS (domain/keeperCircle, ring 2026-08-12): a `keeper` link holder edits, deletes
  // and keeps exactly as the founding ownerId does — resolved from the links load below.
  const [isKeeperByLink, setIsKeeperByLink] = useState(false);
  const canEdit = currentUserId === community.ownerId || isKeeperByLink || isSuperAdmin || isAdmin;
  const canDelete = currentUserId === community.ownerId || isKeeperByLink || isSuperAdmin;

  // Membership is a prism over the LIN ('member' links), read through the Store port. The owner
  // is implicitly a member (seeded synchronously so first render is correct); everyone else is
  // resolved from links below. Legacy memberIds arrays are no longer read.
  const memberSeed = !!currentUserId && community.ownerId === currentUserId;
  const [memberByLink, setMemberByLink] = useState(false);
  // Has this viewer already asked to join? (join_request link — see the Members tab.)
  const [joinRequested, setJoinRequested] = useState(false);
  const [joining, setJoining] = useState(false);
  // Has this viewer already asked to KEEP? (keeper_request link — answered in the Members tab.)
  const [keepRequested, setKeepRequested] = useState(false);
  const [keepAsking, setKeepAsking] = useState(false);
  // Stewardship — the delegated door-keepers (accept knocks, mint invitations).
  const [isSteward, setIsSteward] = useState(false);
  // The active profile section — controlled so a section (e.g. Light) can steer to another
  // (the Council). Undefined until the first change: BeingProfile keeps its own default first.
  const [section, setSection] = useState<string | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    firestoreStore.linksTo(community.id)
      .then(links => {
        if (!alive) return;
        setMemberByLink(isParticipant(links.filter(l => l.rel === 'member'), currentUserId));
        setJoinRequested(!!currentUserId && links.some(l => l.rel === 'join_request' && l.from === currentUserId));
        setIsSteward(!!currentUserId && links.some(l => l.rel === 'steward' && l.from === currentUserId));
        setIsKeeperByLink(!!currentUserId && links.some(l => l.rel === 'keeper' && l.from === currentUserId));
        setKeepRequested(!!currentUserId && links.some(l => l.rel === 'keeper_request' && l.from === currentUserId));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [community.id, currentUserId]);
  const isMember = memberSeed || memberByLink;

  // The DOOR (domain/communityDoor.ts) — how a non-member may enter, if at all.
  const door = doorOf(community);
  const inviteForHere = arrivedInvite && arrivedInvite.communityId === community.id ? arrivedInvite : null;
  const [inviterName, setInviterName] = useState('');
  useEffect(() => {
    if (!inviteForHere) return;
    getPersonName(inviteForHere.createdBy).then(n => setInviterName(n || '')).catch(() => {});
  }, [inviteForHere]);

  // Join — a request for the community's keeper(s), surfaced on their Members tab.
  const handleJoin = async () => {
    if (!currentUserId) { showAlert('err_signin_join'); return; }
    setJoining(true);
    try {
      await firestoreStore.link(currentUserId, 'join_request', community.id);
      setJoinRequested(true);
      notify(`🌱 Your request to join ${community.name} is on its way to its keepers.`);
    } catch (e: any) { showAlert(e?.message || 'Could not send the join request.'); }
    setJoining(false);
  };

  // Ask to KEEP — a keepership knock (keeper_request link); a sitting keeper answers, and
  // the server mints only after the living-tree proof (domain/keeperCircle).
  const handleAskToKeep = async () => {
    if (!currentUserId) { showAlert('err_signin_join'); return; }
    setKeepAsking(true);
    try {
      if (keepRequested) {
        await withdrawKeeperRequest(currentUserId, community.id);
        setKeepRequested(false);
      } else {
        await requestKeepership(currentUserId, community.id);
        setKeepRequested(true);
        notify(spokenLine('keeper_request_sent', {}));
      }
    } catch (e: any) { showAlert(e?.message || 'err_action'); }
    setKeepAsking(false);
  };
  // Step in through an OPEN door — no knock needed while the founding season lasts.
  const handleStepIn = async () => {
    if (!currentUserId) return;
    setJoining(true);
    try {
      await joinCommunityOpen(currentUserId, community.id);
      setMemberByLink(true);
      notify(`🌿 Welcome to ${community.name}.`);
    } catch (e: any) { showAlert(e?.message || 'Could not join.'); }
    setJoining(false);
  };
  // Enter holding an invitation — membership plus the append-only 'invited_by' mark.
  const handleEnterWithInvite = async () => {
    if (!currentUserId || !inviteForHere) return;
    const verdict = checkInvite({
      communityId: inviteForHere.communityId,
      createdBy: inviteForHere.createdBy,
      revokedAtMs: inviteForHere.revokedAt ? inviteForHere.revokedAt.toMillis() : null,
      expiresAtMs: inviteForHere.expiresAt ? inviteForHere.expiresAt.toMillis() : null,
    }, community.id, door, Date.now());
    if (!verdict.usable) {
      showAlert(verdict.reason === 'revoked' ? 'This invitation has been revoked.'
        : verdict.reason === 'expired' ? 'This invitation has expired.'
        : verdict.reason === 'door_closed' ? 'The door is closed for now; even invitations wait.'
        : 'This invitation belongs to another community.');
      return;
    }
    setJoining(true);
    try {
      const { remembered } = await joinCommunityWithInvite(currentUserId, inviteForHere);
      setMemberByLink(true);
      notify(remembered ? `🌿 Welcome to ${community.name}. Your arrival is remembered.` : `🌿 Welcome to ${community.name}.`);
    } catch (e: any) { showAlert(e?.message || 'The door did not open; the invitation may no longer stand.'); }
    setJoining(false);
  };
  // The visibility levels this viewer may query at community scope — shared by the events and
  // council (decisions) tabs, so a signed-out viewer only ever requests public docs. Memoized so
  // the tab components can safely depend on it without refetching every render.
  const communityLevels = useMemo(() => queryableLevels(
    { uid: currentUserId, isStaff: isSuperAdmin || isAdmin, communityIds: isMember ? [community.id] : [] },
    { communityId: community.id },
  ), [currentUserId, isSuperAdmin, isAdmin, isMember, community.id]);

  // Editable copies of the community fields (branding + vision).
  const [editName, setEditName] = useState(community.name);
  const [editVision, setEditVision] = useState(community.vision);
  const [editSocial, setEditSocial] = useState<{ instagram?: string; telegram?: string; whatsapp?: string; website?: string }>(community.socialLinks || {});
  const [editCarouselQuotes, setEditCarouselQuotes] = useState<string[]>(community.carouselQuotes || []);
  const [editCustomLanding, setEditCustomLanding] = useState(community.customLanding === true);
  const [editShowStats, setEditShowStats] = useState(community.showStats === true);
  const [editLandingPages, setEditLandingPages] = useState<{ id: string; label: string; html: string }[]>(community.landingPages || []);
  const [editTheme, setEditTheme] = useState(normalizeTheme(community.theme));
  const [logoUrl, setLogoUrl] = useState(community.logoUrl || '');
  const [heroImageUrl, setHeroImageUrl] = useState(community.heroImageUrl || '');
  const [imageUrls, setImageUrls] = useState<string[]>(community.imageUrls || []);
  const [isUploadingHero, setIsUploadingHero] = useState(false);

  const [linkedTrees, setLinkedTrees] = useState<Lifetree[]>([]);
  // Trees that joined this community via 'participant' links (invited, or self-joined).
  const [participatingTrees, setParticipatingTrees] = useState<Lifetree[]>([]);
  const [lightHouses, setLightHouses] = useState<LightHouse[]>([]);
  const lightHouseSignal = useRefreshSignal(['lightHouses']);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  // Which trees the signed-in user guards — read from their outgoing 'guardian' links (the LIN),
  // not the legacy tree.guardians array (which writes no longer touch).
  const [guardedTreeIds, setGuardedTreeIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset-on-signout before the async links fetch below
    if (!currentUserId) { setGuardedTreeIds(new Set()); return; }
    let alive = true;
    firestoreStore.linksFrom(currentUserId, 'guardian')
      .then(links => { if (alive) setGuardedTreeIds(new Set(links.map(l => l.to))); })
      .catch(() => {});
    return () => { alive = false; };
  }, [currentUserId]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Keep editable copies in sync whenever the community prop changes (e.g. after refresh).
  const imageUrlsKey = (community.imageUrls || []).join(',');
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prop→state sync of the editable copies; deriving instead would clobber in-flight edits
    setEditName(community.name);
    setEditVision(community.vision);
    setEditSocial(community.socialLinks || {});
    setEditTheme(normalizeTheme(community.theme));
    setLogoUrl(community.logoUrl || '');
    setHeroImageUrl(community.heroImageUrl || '');
    setImageUrls(community.imageUrls || []);
    setEditCustomLanding(community.customLanding === true);
    setEditShowStats(community.showStats === true);
    setEditLandingPages(community.landingPages || []);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on primitive fields (arrays via imageUrlsKey); socialLinks/imageUrls object identities change per fetch and would re-run this, clobbering in-flight edits
  }, [community.id, community.name, community.vision, community.logoUrl, community.heroImageUrl, community.theme, community.customLanding, community.showStats, imageUrlsKey]);

  useEffect(() => {
    // Own-tree merge only where the place allows it (domain ownMergeUid): a STRICT face
    // shows this place's forest and nothing else — the viewer's off-domain trees stay home.
    // PLUS the standing trees (grows_in, ring 2026-08-24): trees from other places that
    // entered this garden through its door — one tree, many gardens, every edge explicit.
    const host = { reflectsPublic: community.reflectsPublic, strictScope: community.strictScope };
    Promise.all([
      getTreesByDomain(community.domain, ownMergeUid(currentUserId, host)).catch(() => [] as Lifetree[]),
      treesStandingIn(community.id).catch(() => [] as Lifetree[]),
    ]).then(([byDomain, standing]) => {
      const seen = new Set(byDomain.map(t => t.id));
      setLinkedTrees([...byDomain, ...standing.filter(t => !seen.has(t.id))]);
    }).catch(() => {});
  }, [community.id, community.domain, currentUserId, community.reflectsPublic, community.strictScope]);

  useEffect(() => {
    // Rooted here (by domain) PLUS stepped-into (by communityIds), deduped. Signed-out
    // viewers may only run public-provable queries — the read rule refuses the rest.
    const publicOnly = !currentUserId;
    Promise.all([
      getLightHousesByDomain(community.domain, { publicOnly }).catch(() => [] as LightHouse[]),
      publicOnly ? Promise.resolve([] as LightHouse[]) : getLightHousesByCommunity(community.id).catch(() => [] as LightHouse[]),
    ]).then(([byDomain, byBelonging]) => {
      const seen = new Set<string>();
      setLightHouses([...byDomain, ...byBelonging].filter(s => !seen.has(s.id) && seen.add(s.id) !== undefined));
    }).catch(() => {});
  }, [community.domain, community.id, currentUserId, lightHouseSignal]);

  // LightHouses elsewhere in the network this community could step into — keepers only.
  const [adoptable, setAdoptable] = useState<LightHouse[]>([]);
  useEffect(() => {
    if (!canEdit || !currentUserId) { return; }
    let alive = true;
    Promise.all([getAllLightHouses(), firestoreStore.linksByRel('shelters')])
      .then(([all, shelterLinks]) => {
        if (!alive) return;
        const homesOf = new Map<string, string[]>();
        for (const l of shelterLinks) homesOf.set(l.from, [...(homesOf.get(l.from) || []), l.to]);
        setAdoptable(all.filter(s => {
          const homes = [...(s.communityId ? [s.communityId] : []), ...(homesOf.get(s.id) || [])];
          // Consent lives with the lightHouse: only its keeper (or staff) may step it in —
          // the rules enforce this, so the panel offers only what would actually succeed.
          const mayStepIn = s.ownerId === currentUserId || isSuperAdmin || isAdmin;
          return mayStepIn
            && !homes.includes(community.id)
            && s.domain !== community.domain
            && canViewLightHouse(s, { uid: currentUserId, isStaff: isSuperAdmin || isAdmin, memberCommunityIds: new Set<string>() }, homes);
        }));
      }).catch(() => {});
    return () => { alive = false; };
  }, [canEdit, currentUserId, isSuperAdmin, isAdmin, community.id, community.domain, lightHouseSignal]);

  // The lightHouses rooted in this domain THAT THIS VIEWER MAY SEE —
  // lightHouses are private (community-level) by default.
  // Homes come from the shelters links, so a stepped-in lightHouse is visible to members
  // of THIS community even when its primary home is elsewhere.
  const [shelterHomes, setShelterHomes] = useState<Map<string, string[]>>(new Map());
  useEffect(() => {
    let alive = true;
    firestoreStore.linksByRel('shelters').then(links => {
      if (!alive) return;
      const m = new Map<string, string[]>();
      for (const l of links) m.set(l.from, [...(m.get(l.from) || []), l.to]);
      setShelterHomes(m);
    }).catch(() => {});
    return () => { alive = false; };
  }, [lightHouseSignal]);
  const viewableLightHouses = useMemo(() => lightHouses.filter(s => canViewLightHouse(s, {
    uid: currentUserId,
    isStaff: isSuperAdmin || isAdmin,
    memberCommunityIds: isMember ? new Set([community.id]) : new Set(),
  }, [...(s.communityId ? [s.communityId] : []), ...(shelterHomes.get(s.id) || [])])), [lightHouses, shelterHomes, currentUserId, isSuperAdmin, isAdmin, isMember, community.id]);


  // The first lifetree rooted in this community's domain (earliest planted).
  const domainTrees = useMemo(() => {
    const d = bareDomain(community.domain);
    return linkedTrees
      .filter(tree => bareDomain(tree.domain) === d)
      .sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
  }, [linkedTrees, community.domain]);
  const firstTree = domainTrees[0] || null;

  // Load the trees standing with this community via participant links.
  useEffect(() => {
    let alive = true;
    getParticipatingTrees(community.id).then(ts => { if (alive) setParticipatingTrees(ts); }).catch(() => {});
    return () => { alive = false; };
  }, [community.id]);

  // The trees tab shows domain trees + participating trees, deduped.
  const communityTrees = useMemo(() => {
    const byId = new Map<string, Lifetree>();
    domainTrees.forEach(t => byId.set(t.id, t));
    participatingTrees.forEach(t => byId.set(t.id, t));
    return Array.from(byId.values());
  }, [domainTrees, participatingTrees]);

  const handleToggleGuardian = async (tree: Lifetree) => {
    if (!canCareForTree(currentUserId)) { showAlert('err_signin_guard'); return; }
    const join = !guardedTreeIds.has(tree.id);
    setTogglingId(tree.id);
    try {
      await (join ? firestoreStore.link(currentUserId, 'guardian', tree.id) : firestoreStore.unlink(currentUserId, 'guardian', tree.id));
      setGuardedTreeIds(prev => {
        const next = new Set(prev);
        if (join) next.add(tree.id); else next.delete(tree.id);
        return next;
      });
    } catch (e) {
      console.error(e);
      showAlert('err_guardianship');
    }
    setTogglingId(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatus(null);
    try {
      const updates = {
        name: editName,
        vision: editVision,
        imageUrls,
        theme: normalizeTheme(editTheme),
        logoUrl,
        heroImageUrl,
        socialLinks: editSocial,
        carouselQuotes: editCarouselQuotes.map(q => q.trim()).filter(Boolean),
        customLanding: editCustomLanding,
        showStats: editShowStats,
        landingPages: editLandingPages.filter(p => p.label.trim()),
      };
      await updateCommunity(community.id, updates);
      // Refresh from Firestore so the view reflects exactly what was persisted.
      const fresh = await getCommunityByDomain(community.domain);
      if (onUpdate) onUpdate(fresh ? { ...fresh } : updates);
      setStatus('Saved.');
      notify('🌱 Saved.');
      setTimeout(() => setStatus(null), 2500);
    } catch (e) {
      console.error(e);
      setStatus('Failed to save. Please try again.');
      notify(speak('err_save_retry'), 'error');
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!(await showConfirm('community_delete_confirm', { title: 'delete_community', confirmText: 'delete', danger: true }))) return;
    setIsDeleting(true);
    try {
      await deleteCommunity(community.id);
      onClose();
      window.location.reload();
    } catch (e) {
      console.error(e);
      showAlert('err_community_delete');
    }
    setIsDeleting(false);
  };

  const handleLogoUpload = async (file: File) => {
    setIsUploadingLogo(true);
    try {
      const url = await uploadImage(file, `communities/${community.id}/logo_${Date.now()}`);
      setLogoUrl(url);
      // Persist immediately so the change can't get lost before the next Save.
      await updateCommunity(community.id, { logoUrl: url });
      onUpdate?.({ logoUrl: url });
      setStatus('Saved');
    } catch (e: any) {
      console.error(e);
      setStatus(e?.message || 'Failed to upload logo.');
    }
    setIsUploadingLogo(false);
  };

  const handleHeroUpload = async (file: File) => {
    setIsUploadingHero(true);
    try {
      const url = await uploadImage(file, `communities/${community.id}/hero_${Date.now()}`);
      setHeroImageUrl(url);
      await updateCommunity(community.id, { heroImageUrl: url });
      onUpdate?.({ heroImageUrl: url });
      setStatus('Saved');
    } catch (e: any) {
      console.error(e);
      setStatus(e?.message || 'Failed to upload hero image.');
    }
    setIsUploadingHero(false);
  };

  const handleAddImage = async (file: File) => {
    setIsUploadingImage(true);
    try {
      const url = await uploadImage(file, `communities/${community.id}/${Date.now()}`);
      setImageUrls(prev => [...prev, url]);
    } catch (e: any) {
      console.error(e);
      setStatus(e?.message || 'Failed to upload image.');
    }
    setIsUploadingImage(false);
  };

  const handleRemoveImage = (index: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveHero = () => {
    // Persist immediately (like upload does) — otherwise the old photo returns
    // unless the user also remembers to hit Save.
    setHeroImageUrl('');
    updateCommunity(community.id, { heroImageUrl: '' }).catch(() => {});
    onUpdate?.({ heroImageUrl: '' });
  };

  // A circle's GRADUATION banner (domain/treeCircle formCircleRefusal): shown to the hands
  // that may form — the keeper circle, or a co-owner of the root tree. The server is the
  // one hand that stamps forming; this banner only carries the ask and the chosen name.
  const isUnformedCircle = community.formation === 'tree_co_ownership' && !community.formedAt;
  const [treeCoOwner, setTreeCoOwner] = useState(false);
  const [formName, setFormName] = useState('');
  const [forming, setForming] = useState(false);
  const [justFormed, setJustFormed] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- re-keys the draft + formed state when the profile switches communities
    setFormName((community.name || '').replace(/\s*Circle\s*$/i, '')); setJustFormed(false);
  }, [community.id, community.name]);
  useEffect(() => {
    if (!isUnformedCircle || !currentUserId || !community.rootLifetreeId) { setTreeCoOwner(false); return; }
    let alive = true;
    firestoreStore.linksFrom(currentUserId, 'co_owner')
      .then(links => { if (alive) setTreeCoOwner(links.some(l => l.to === community.rootLifetreeId)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [isUnformedCircle, currentUserId, community.rootLifetreeId]);
  const mayFormCommunity = isUnformedCircle && !justFormed && !!currentUserId
    && formCircleRefusal({
      formation: community.formation, formedAtMs: null,
      isCircleKeeper: canEdit, isTreeCoOwner: treeCoOwner,
    }) === null;
  const handleFormCommunity = async () => {
    const name = formName.trim();
    if (!name || forming) return;
    setForming(true);
    try {
      const res = await formCommunityFromCircle(community.id, name);
      setJustFormed(true);
      onUpdate?.({ name: res.name, visibility: 'public', ...(res.bornOn ? { bornOn: res.bornOn } : {}) });
      announce('communities');
      notify(spokenLine('circle_formed', { name: res.name }));
    } catch (e: any) {
      const m = String(e?.message || '');
      showAlert(m.includes('not_hand') ? 'circle_form_not_hand' : m.includes('already_formed') ? 'circle_form_already' : m || 'err_action');
    }
    setForming(false);
  };

  // Icons for the shared network-lore tabs (Path, Yantra).
  const loreIcons: Record<LoreTabId, React.ReactNode> = {
    genesis: <Icons.Hash />,
    whitepaper: <Icons.Tree />,
    yantra: <Icons.Venn />,
    protection: <Icons.ShieldCheck />,
  };

  // The Yantra, code lineage and seed lore belong to the two historical seed communities.
  // This is content identity only — not a claim about Hub role, custody or data scope.
  const isSeedLoreCommunity = ['lightseed.online', 'lifeseed.online'].includes(bareDomain(community.domain));

  // The community's sections — each `render` closes over this shell's state and handlers.
  const sections: BeingSection[] = [
    {
      key: 'vision', label: 'Vision', icon: <Icons.Eye />, render: () => (
        <CommunityVision
          community={community}
          canEdit={canEdit}
          isSuperAdmin={isSuperAdmin}
          currentUserId={currentUserId}
          firstTree={firstTree}
          linkedTrees={linkedTrees}
          editVision={editVision}
          onVisionChange={setEditVision}
          onSave={handleSave}
          isSaving={isSaving}
          saveDisabled={isSaving || isUploadingLogo || isUploadingImage}
          status={status}
          onUpdate={onUpdate}
        />
      ),
    },
    {
      key: 'digital', label: 'Digital Tree', icon: <Icons.Tree />, render: () => (
        <CommunityDigitalTree community={community} onViewPulse={onViewEvent} />
      ),
    },
    {
      key: 'firsttree', label: 'First Tree', icon: <Icons.Tree />, render: () => (
        <CommunityFirstTree
          community={community}
          firstTree={firstTree}
          onViewTree={onViewTree}
          guardedTreeIds={guardedTreeIds}
          togglingId={togglingId}
          onToggleGuardian={handleToggleGuardian}
        />
      ),
    },
    {
      key: 'lightHouse', label: 'Light Houses', icon: <Icons.Sun />, render: () => (
        <CommunityLightHouse
          community={community}
          lightHouses={viewableLightHouses}
          canEdit={canEdit}
          onCreate={async (draft) => {
            if (!currentUserId) return;
            await createLightHouse({
              ...draft,
              ownerId: currentUserId,
              domain: community.domain,
              communityId: community.id,
            });
            announce('lightHouses');
            notify('🌞 Light House consecrated.');
          }}
          onUploadImage={(file) => uploadImage(file, `communities/${community.id}/lightHouses/${file.name}`)}
          onOpen={onViewLightHouse}
          adoptable={adoptable}
          onAdopt={async (s) => {
            await adoptLightHouse(s.id, community.id);
            announce('lightHouses');
            notify(`${s.name} now holds this community too.`);
          }}
        />
      ),
    },
    {
      key: 'trees', label: 'Community Trees', icon: <Icons.Tree />, render: () => (
        <CommunityTreesTab
          community={community}
          currentUserId={currentUserId}
          communityTrees={communityTrees}
          onViewTree={onViewTree}
          guardedTreeIds={guardedTreeIds}
          togglingId={togglingId}
          onToggleGuardian={handleToggleGuardian}
        />
      ),
    },
    {
      key: 'model', label: 'Growth', icon: <MahameruAvatar size={20} />, render: () => (
        <div>
          <SectionTitle title="Growth" sub="How this node is crystallising: its trees weighted by their chain growth, links and pulses." />
          <NodeGrowthTree community={community} trees={domainTrees} onViewTree={onViewTree} />
        </div>
      ),
    },
    {
      key: 'events', label: 'Events', icon: <Icons.Loc />, render: () => (
        <CommunityEvents
          community={community}
          canEdit={canEdit}
          currentUserId={currentUserId}
          currentUserName={currentUser?.displayName}
          currentUserPhoto={currentUser?.photoURL}
          communityLevels={communityLevels}
          onViewEvent={onViewEvent}
        />
      ),
    },
    {
      key: 'council', label: t('council'), icon: <Icons.Venn />, render: () => (
        <CommunityCouncil community={community} canEdit={canEdit} currentUserId={currentUserId} communityLevels={communityLevels} />
      ),
    },
    {
      key: 'light', label: 'Light', icon: <Icons.Sun />, render: () => (
        <CommunityLight communityId={community.id} isKeeper={canEdit} onGoToCouncil={() => setSection('council')} />
      ),
    },
    {
      key: 'members', label: 'Members', icon: <Icons.Users />, render: () => (
        <CommunityMembers community={community} currentUserId={currentUserId} canManage={canEdit || isSteward} isOwner={canEdit} onCommunityUpdate={onUpdate} />
      ),
    },
    {
      key: 'interbeing', label: t('interbeing'), icon: <Icons.Link />, render: () => (
        <CommunityInterbeingMatrix community={community} canManage={canEdit} />
      ),
    },
    {
      key: 'path', label: 'The Path', icon: <Icons.ArrowRight />, render: () => (
        <div>
          <SectionTitle title="The Path" sub="From first seed to sovereign node: the onboarding trail, as a ruleset. In time each community will shape its own." />
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
            <PathOverview />
          </div>
        </div>
      ),
    },
    // The network's founding lore (Genesis, the Path, the Yantra, Protection) stays with the
    // central lightseed / lifeseed nodes — every community will have its own genesis and path.
    ...loreTabs.filter(() => isSeedLoreCommunity).map((tab): BeingSection => ({
      key: tab.id, label: tab.label, icon: loreIcons[tab.id], render: () => <LoreSection id={tab.id} />,
    })),
    // The seed communities' own body — the repo's git history drawn as a growth chain, like the lore.
    ...(isSeedLoreCommunity ? [{ key: 'codechain', label: 'Code chain', icon: <Icons.Hash />, render: () => <CommunityCodeChain /> } satisfies BeingSection] : []),
    ...(canEdit ? [
      {
        key: 'intelligence', label: 'Intelligence', icon: <Icons.Intelligence />, render: () => (
          <CommunityIntelligence community={community} canEdit={canEdit} currentUserId={currentUserId} onUpdate={onUpdate} />
        ),
      },
      {
        key: 'appearance', label: 'Appearance', icon: <Icons.Image />, render: () => (
          <CommunityAppearance
            community={community}
            editName={editName}
            onNameChange={setEditName}
            editTheme={editTheme}
            onThemeChange={setEditTheme}
            logoUrl={logoUrl}
            onLogoUpload={handleLogoUpload}
            uploadingLogo={isUploadingLogo}
            heroImageUrl={heroImageUrl}
            onHeroUpload={handleHeroUpload}
            uploadingHero={isUploadingHero}
            onRemoveHero={handleRemoveHero}
            imageUrls={imageUrls}
            onAddImage={handleAddImage}
            onRemoveImage={handleRemoveImage}
            uploadingImage={isUploadingImage}
            editSocial={editSocial}
            onSocialChange={setEditSocial}
            editCarouselQuotes={editCarouselQuotes}
            onCarouselQuotesChange={setEditCarouselQuotes}
            editCustomLanding={editCustomLanding}
            onCustomLandingChange={setEditCustomLanding}
            editShowStats={editShowStats}
            onShowStatsChange={setEditShowStats}
            editLandingPages={editLandingPages}
            onLandingPagesChange={setEditLandingPages}
            onSave={handleSave}
            isSaving={isSaving}
            saveDisabled={isSaving || isUploadingLogo || isUploadingImage}
            status={status}
          />
        ),
      },
    ] : []),
  ];

  return (
    <BeingProfile
      onClose={onClose}
      sections={sections}
      activeSection={section}
      onSectionChange={setSection}
      banner={mayFormCommunity ? (
        <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50/70 p-4">
          <p className="text-sm font-bold text-slate-800">{t('circle_form_title')}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{t('circle_form_desc')}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder={t('circle_form_name_ph')}
              className="w-56 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-violet-400"
            />
            <button onClick={handleFormCommunity} disabled={forming || !formName.trim()}
              className="rounded-full bg-violet-600 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-violet-500 disabled:opacity-50">
              {forming ? '…' : t('circle_form_button')}
            </button>
          </div>
        </div>
      ) : undefined}
      hero={{
        // Only the chosen hero — no gallery fallback, so removing the hero actually removes it.
        // The hero wears the USER profile's exact clothes (Zoltán, 2026-07-22): same default
        // padding/background, same compact row, same avatar size; the chips read the tree
        // count first, then the birth date.
        imageUrl: heroImageUrl,
        avatarRowClassName: 'flex flex-row items-center gap-3 sm:gap-5',
        titleRowClassName: 'flex flex-wrap items-center gap-x-3 gap-y-1.5 justify-start',
        actions: (
          <>
            {/* The DOOR — open: step in; invite: knock (or enter holding an invitation);
                closed: rest. Keepers accept knocks on the Members tab. Members see standing.
                Mobile keeps every action compact (icons, tight padding) so nothing overflows. */}
            {!currentUserId && inviteForHere && (
              <button onClick={() => onSignIn?.()} className="flex items-center gap-1 rounded-full border border-amber-300/50 bg-amber-400/15 px-2.5 py-1.5 text-[11px] font-bold text-amber-200 transition-colors hover:bg-amber-400 hover:text-white sm:px-4 sm:py-2 sm:text-xs">
                🎟 {t('signin_use_invitation')}
              </button>
            )}
            {currentUserId && !isMember && inviteForHere && (
              <button onClick={handleEnterWithInvite} disabled={joining} className="flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-amber-400 disabled:opacity-50 sm:px-4 sm:py-2 sm:text-xs">
                🎟 <span>{joining ? t('entering') : (inviterName ? t('enter_invited_by').replace('{name}', inviterName) : t('enter_invited'))}</span>
              </button>
            )}
            {currentUserId && !isMember && !inviteForHere && (
              door === 'open' ? (
                <button onClick={handleStepIn} disabled={joining} className="flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 sm:px-4 sm:py-2 sm:text-xs">
                  <Icons.Users size={14} /><span>{joining ? t('stepping_in') : t('step_in')}</span>
                </button>
              ) : door === 'closed' ? (
                <span className="flex items-center gap-1 rounded-full border border-slate-400/40 bg-slate-400/10 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 sm:px-4 sm:py-2 sm:text-xs">
                  {t('door_closed_short')}
                </span>
              ) : joinRequested ? (
                <span className="flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300 sm:px-4 sm:py-2 sm:text-xs">
                  <Icons.Users size={14} /> {t('requested')}
                </span>
              ) : (
                <button onClick={handleJoin} disabled={joining} className="flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 sm:px-4 sm:py-2 sm:text-xs">
                  <Icons.Users size={14} /><span>{joining ? t('asking') : t('join')}</span>
                </button>
              )
            )}
            {isMember && currentUserId !== community.ownerId && (
              <span className="flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300 sm:px-4 sm:py-2 sm:text-xs">
                <Icons.Users size={14} /> {t('member_badge')}
              </span>
            )}
            {/* Ask to KEEP — a member who isn't a keeper may knock for keepership. */}
            {isMember && currentUserId && !canEdit && (
              <button onClick={handleAskToKeep} disabled={keepAsking}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-50 sm:px-4 sm:py-2 sm:text-xs ${keepRequested
                  ? 'border border-violet-400/40 bg-violet-400/10 text-violet-300 hover:bg-violet-400/20'
                  : 'border border-violet-300/40 bg-violet-500/15 text-violet-200 hover:bg-violet-500 hover:text-white'}`}>
                🗝 <span>{keepRequested ? t('withdraw_ask') : t('ask_to_keep')}</span>
              </button>
            )}
            {onEnterCommunityView && (
              <button onClick={() => onEnterCommunityView(community)} className="flex items-center gap-1 rounded-full border border-amber-300/40 bg-amber-400/15 p-2 text-xs font-bold text-amber-200 transition-colors hover:bg-amber-400 hover:text-white sm:px-4 sm:py-2" title="See the whole site as this community">
                <Icons.Eye /><span className="hidden sm:inline">{t('switch_community_view')}</span>
              </button>
            )}
            {canDelete && (
              <button onClick={handleDelete} disabled={isDeleting} title="Delete community" aria-label="Delete community" className="relative flex items-center gap-1 rounded-full border border-red-400/30 bg-red-500/15 p-2 text-xs font-bold text-red-300 transition-colors hover:bg-red-500 hover:text-white sm:px-4 sm:py-2">
                <Icons.Trash /><span className="hidden sm:inline">{t('delete')}</span>
                {currentUserId !== community.ownerId && <SuperDot />}
              </button>
            )}
          </>
        ),
        avatar: (
          <div className="flex h-14 w-14 md:h-20 md:w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white shadow-xl">
            {logoUrl ? (
              <Picture size={480} src={logoUrl} className="h-full w-full object-cover" alt={`${community.name} logo`} referrerPolicy="no-referrer" />
            ) : (
              <span className="text-slate-300"><Icons.Globe /></span>
            )}
          </div>
        ),
        title: community.name,
        chips: (
          <>
            <span className="inline-flex items-baseline gap-1 text-slate-300">
              <span className="text-base font-bold text-white">{domainTrees.length}</span>
              <span className="text-xs text-slate-400">{domainTrees.length === 1 ? t('tree') : t('trees')}</span>
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-xs text-slate-300">
              Since {community.createdAt?.toDate ? community.createdAt.toDate().toLocaleDateString() : '—'}
            </span>
            {/* A circle wears its own mark; a community with an address wears the address. */}
            {isTreeCircle(community) ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/40 bg-violet-400/10 px-2.5 py-0.5 text-xs font-bold text-violet-300 [&>svg]:h-3.5 [&>svg]:w-3.5">
                <Icons.Venn /> {t('tree_circle_badge')}
              </span>
            ) : community.domain ? (
              <a href={`https://${community.domain}`} target="_blank" rel="noreferrer" title={isDomainVerified(community) ? t('domain_verified') : undefined} className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-mono text-emerald-300 hover:bg-emerald-400/20">
                <Icons.Globe size={12} /> {community.domain}
                {isDomainVerified(community) && <span className="font-sans font-bold text-emerald-300">✓</span>}
              </a>
            ) : null}
            <LoveButton collection="communities" id={community.id} initialCount={community.loveCount || 0} className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-white hover:bg-white/20" />
          </>
        ),
      }}
    />
  );
};
