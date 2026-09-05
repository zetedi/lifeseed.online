
import React, { useState, useEffect } from 'react';
import { showAlert } from "./ui/Dialog";
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './ui/Icons';
import { MahameruAvatar } from './ui/MahameruAvatar';
import { Community, Lifetree } from '../types';
import { fetchCommunities, createCommunity, getCommunityByDomain, getMyVisions } from '../services/firebase';
import { matchCommunities, type CommunityMatch } from '../domain/match';
import { communitiesOnView } from '../domain/communityDoor';
import { isTreeCircle } from '../domain/treeCircle';
import { isDomainVerified } from '../domain/domainVerification';
import { useRefreshSignal } from '../hooks/useRefreshSignal';
import { firestoreStore } from '../adapters/firestore';
import { notify } from './ui/Toast';
import { communityThemePresets } from '../utils/theme';
import { sanitizeRichText } from '../utils/sanitize';
import { Loading } from './ui/Loading';
import { Modal, ModalActions, modalButton } from './ui/Modal';
import { SectionHeader } from './ui/SectionHeader';
import { ListBox } from './ui/ListBox';
import { tabTone, CTA_GLOW } from '../utils/tabTheme';
import { useListDensity, type ListDensity } from '../hooks/useListDensity';
import { ViewDensityToggle } from './ui/ViewDensityToggle';
import { speak, spokenLine } from '../utils/translations';

import { Picture } from './ui/Picture';
interface CommunityListProps {
  onSelect: (community: Community) => void;
  myTrees: Lifetree[];
  currentUserId?: string;
  // The active place (impersonated || host): a STRICT portal lists only communities born
  // here or standing here (domain communitiesOnView), and stamps foundings with bornOn.
  host?: { domain?: string; strictScope?: boolean; reflectsPublic?: boolean } | null;
}

// The community's hero image IS the card's background; the content reads over it. Without an
// image the card wears the community's own colour (or the communities tone) — no placeholder art.
type CardStanding = 'keeper' | 'member' | 'requested' | 'joinable';

const StandingMark = ({ standing, community, onJoin, small = false }: { standing: CardStanding, community: Community, onJoin?: (community: Community) => void, small?: boolean }) => {
  const { t } = useLanguage();
  return (
  standing === 'keeper' ? <span className={`rounded-full bg-amber-400/90 font-black uppercase tracking-wide text-amber-950 shadow ${small ? 'px-2 py-0.5 text-[9px]' : 'px-3 py-1 text-[10px]'}`}>{t('keeper_badge')}</span>
  : standing === 'member' ? <span className={`rounded-full bg-emerald-500/90 font-black uppercase tracking-wide text-white shadow ${small ? 'px-2 py-0.5 text-[9px]' : 'px-3 py-1 text-[10px]'}`}>{t('member_badge')}</span>
  : standing === 'requested' ? <span className={`rounded-full bg-slate-400/60 font-black uppercase tracking-wide text-white shadow backdrop-blur ${small ? 'px-2 py-0.5 text-[9px]' : 'px-3 py-1 text-[10px]'}`}>{t('requested')}</span>
  : onJoin ? (
    <button onClick={(e) => { e.stopPropagation(); onJoin(community); }}
      className={`rounded-full bg-emerald-600 font-bold uppercase tracking-widest text-white shadow-lg transition-all hover:bg-emerald-500 active:scale-95 ${small ? 'px-3 py-1 text-[10px]' : `px-4 py-1.5 text-[11px] ${CTA_GLOW}`}`}>
      {t('join')}
    </button>
  ) : null
  );
};

const CommunityCard = ({ community, isGenesis = false, onSelect, standing = 'joinable', onJoin, density = 'cards' }: { community: Community, isGenesis?: boolean, onSelect: (community: Community) => void, standing?: CardStanding, onJoin?: (community: Community) => void, density?: ListDensity }) => {
  const { t } = useLanguage();
  const hero = (community as any).heroImageUrl || community.imageUrls?.[0];
  // A tree circle (the pre-community) wears its own mark where a community wears its domain.
  const circle = isTreeCircle(community);
  // A DNS-proven anchor wears its quiet check beside the address (domain/domainVerification).
  const verified = isDomainVerified(community);

  // ROWS — one line: logo, name+domain, standing.
  if (density === 'rows') {
    return (
      <div onClick={() => onSelect(community)}
        className={`flex cursor-pointer items-center gap-3 rounded-xl border bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${isGenesis ? 'border-amber-300 ring-2 ring-amber-300/30' : 'border-slate-100'}`}>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-slate-50 text-slate-400">
          {community.logoUrl ? <Picture size={480} src={community.logoUrl} className="h-full w-full object-cover" alt="" /> : <Icons.Globe />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-800">{community.name}{isGenesis && <span className="ml-2 text-[9px] font-black uppercase tracking-wide text-amber-600">Community 0</span>}</p>
          {circle
            ? <p className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-violet-600 [&>svg]:h-3 [&>svg]:w-3"><Icons.Venn /> {t('tree_circle_badge')}</p>
            : <p className="truncate font-mono text-[11px] text-slate-400">{community.domain}{verified && <span title={t('domain_verified')} className="ml-1 font-sans font-bold text-emerald-500">✓</span>}</p>}
        </div>
        <StandingMark standing={standing} community={community} onJoin={onJoin} small />
      </div>
    );
  }

  // MINI — a half-size card.
  if (density === 'mini') {
    return (
      <div onClick={() => onSelect(community)}
        className={`group relative flex min-h-[8.5rem] cursor-pointer flex-col justify-end overflow-hidden rounded-xl border shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl ${isGenesis ? 'border-amber-400 ring-2 ring-amber-400/25' : 'border-slate-100'}`}
        style={!hero ? { backgroundColor: (community as any).theme?.primary || tabTone('communities') } : undefined}>
        {hero && (<><Picture size={1200} src={hero} className="absolute inset-0 h-full w-full object-cover" alt={community.name} /><div className="absolute inset-0 bg-gradient-to-t from-black/75 to-black/10" /></>)}
        {!hero && <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />}
        <div className="relative z-10 flex items-end justify-between gap-2 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white drop-shadow">{community.name}</p>
            {circle
              ? <p className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-violet-200 [&>svg]:h-3 [&>svg]:w-3"><Icons.Venn /> {t('tree_circle_badge')}</p>
              : <p className="truncate font-mono text-[10px] text-emerald-200">{community.domain}{verified && <span title={t('domain_verified')} className="ml-1 font-sans font-bold text-emerald-300">✓</span>}</p>}
          </div>
          <StandingMark standing={standing} community={community} onJoin={onJoin} small />
        </div>
      </div>
    );
  }

  return (
  <div
      onClick={() => onSelect(community)}
      className={`group rounded-xl overflow-hidden shadow-sm hover:shadow-2xl active:shadow-2xl border transition-all cursor-pointer hover:-translate-y-1 active:-translate-y-1 relative min-h-[15rem] flex flex-col justify-end ${isGenesis ? 'border-amber-400 ring-4 ring-amber-400/20 md:col-span-2 lg:col-span-1' : 'border-slate-100'}`}
      style={!hero ? { backgroundColor: (community as any).theme?.primary || tabTone('communities') } : undefined}
  >
      {hero && (
          <>
              <Picture size={1200} src={hero} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" alt={community.name} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10"></div>
          </>
      )}
      {!hero && <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent"></div>}
      {isGenesis && (
          <div className="absolute top-4 left-4 z-20 bg-amber-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg flex items-center gap-1 uppercase tracking-tighter">
              <MahameruAvatar size={14} /> Community 0
          </div>
      )}
      <div className="relative z-10 p-5">
          <div className="mb-2.5 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/30 bg-white/20 backdrop-blur-md text-white">
                  {community.logoUrl ? (
                      <Picture size={480} src={community.logoUrl} className="h-full w-full object-cover" alt={`${community.name} logo`} />
                  ) : (
                      <Icons.Globe />
                  )}
              </div>
              <div className="min-w-0">
                  <h2 className="line-clamp-2 break-words text-lg font-bold text-white drop-shadow-md">{community.name}</h2>
                  {circle
                    ? <p className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-violet-200 drop-shadow-md [&>svg]:h-3.5 [&>svg]:w-3.5"><Icons.Venn /> {t('tree_circle_badge')}</p>
                    : <p className="truncate font-mono text-xs text-emerald-200 drop-shadow-md">{community.domain}{verified && <span title={t('domain_verified')} className="ml-1 font-sans font-bold text-emerald-300">✓</span>}</p>}
              </div>
          </div>
          <div
              className="text-white/85 text-sm line-clamp-2 mb-3 leading-relaxed overflow-hidden drop-shadow [&_img]:hidden"
              dangerouslySetInnerHTML={{ __html: community.vision ? sanitizeRichText(community.vision) : 'No vision shared yet.' }}
          />
          <div className="flex items-center justify-between gap-2">
              <button className="text-white font-bold text-xs uppercase tracking-widest flex items-center gap-1 group-hover:gap-2 transition-all drop-shadow">
                  View Profile <Icons.ArrowRight size={16} />
              </button>
              <StandingMark standing={standing} community={community} onJoin={onJoin} />
          </div>
      </div>
  </div>
); };

export const CommunityList: React.FC<CommunityListProps> = ({ onSelect, myTrees, currentUserId, host }) => {
  const { t } = useLanguage();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [genesisCommunity, setGenesisCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [density, setDensity] = useListDensity('communities');
  // Where the viewer already stands: keeper / member / requested — read from the LIN once.
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!currentUserId) return;
    let alive = true;
    Promise.all([
      firestoreStore.linksFrom(currentUserId, 'member').catch(() => []),
      firestoreStore.linksFrom(currentUserId, 'join_request').catch(() => []),
    ]).then(([members, requests]) => {
      if (!alive) return;
      setMemberIds(new Set(members.map(l => l.to)));
      setRequestedIds(new Set(requests.map(l => l.to)));
    });
    return () => { alive = false; };
  }, [currentUserId]);

  const standingOf = (c: Community): CardStanding =>
    c.ownerId === currentUserId ? 'keeper'
      : memberIds.has(c.id) ? 'member'
      : requestedIds.has(c.id) ? 'requested'
      : 'joinable';

  // Join straight from the card — the same request the community profile sends.
  const handleJoin = async (c: Community) => {
    if (!currentUserId) { showAlert('err_signin_join'); return; }
    try {
      await firestoreStore.link(currentUserId, 'join_request', c.id);
      setRequestedIds(prev => new Set([...prev, c.id]));
      notify(speak(spokenLine('join_request_sent', { name: c.name })));
    } catch (e: any) {
      showAlert(e?.message || 'Could not send the join request.');
    }
  };

  // Vision ↔ community resonance: the top three communities whose visions share the most
  // ground with the visions this being has created (domain/match — inspectable words, no AI).
  const [matches, setMatches] = useState<CommunityMatch<Community>[] | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const handleMatch = async () => {
    if (!currentUserId) { showAlert('err_signin_resonance'); return; }
    if (isMatching) return;
    setIsMatching(true);
    try {
      const visions = await getMyVisions(currentUserId);
      const texts = visions.map(v => `${v.title || ''} ${v.body || ''} ${(v as any).description || ''}`);
      if (texts.length === 0) {
        showAlert('resonance_need_vision');
      } else {
        const pool = [...communities, ...(genesisCommunity ? [genesisCommunity] : [])];
        const found = matchCommunities(texts, pool, 3);
        setMatches(found);
        if (found.length === 0) showAlert('resonance_no_ground');
      }
    } catch (e: any) {
      showAlert(e?.message || 'Could not read the resonance.');
    }
    setIsMatching(false);
  };

  const matchesSearch = (c: Community) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return `${c.name || ''} ${c.domain || ''} ${c.vision || ''}`.toLowerCase().includes(term);
  };
  const filteredCommunities = communities.filter(matchesSearch);
  const showGenesis = genesisCommunity && matchesSearch(genesisCommunity);

  // Re-fetch when any community is edited elsewhere (profile saves announce 'communities'),
  // so a card never shows yesterday's face after an appearance change.
  const communitiesSignal = useRefreshSignal(['communities']);
  useEffect(() => {
    const domain = window.location.hostname;

    Promise.all([
        fetchCommunities(),
        getCommunityByDomain(domain)
    ]).then(([allCommunities, currentDomainCommunity]) => {
      // If we found a community for current domain, mark it as genesis and filter it from the main list
      // A strict portal's list is its own garden (domain communitiesOnView) — the whole
      // network's communities stay home; reflecting/lenient hosts keep the wide view.
      const onView = communitiesOnView(allCommunities, { domain: host?.domain, strictScope: host?.strictScope, reflectsPublic: host?.reflectsPublic });
      if (currentDomainCommunity) {
          setGenesisCommunity(currentDomainCommunity);
          setCommunities(onView.filter(c => c.id !== currentDomainCommunity.id));
      } else {
          setCommunities(onView);
      }
      setLoading(false);
    }).catch((error) => {
      console.error("Failed to load communities", error);
      setCommunities([]);
      setGenesisCommunity(null);
      setLoading(false);
    });
  }, [communitiesSignal, host?.domain, host?.strictScope, host?.reflectsPublic]);

  const handleCreate = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUserId || !newName || !newDomain) return;
    
    setIsCreating(true);
    try {
      const newCommunity = {
        name: newName,
        domain: newDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
        vision: '',
        imageUrls: [],
        theme: communityThemePresets[0],
        ownerId: currentUserId,
        // The birthplace: the canonical face this founding happened on (frozen by the rules).
        bornOn: host?.domain || genesisCommunity?.domain || window.location.hostname.toLowerCase().replace(/^www\./, ''),
      };
      const created = await createCommunity(newCommunity);
      setCommunities(prev => [created, ...prev]);
      setShowCreate(false);
      setNewName('');
      setNewDomain('');
    } catch (e) {
      console.error(e);
      showAlert('err_community_create');
    }
    setIsCreating(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 pt-6 pb-4 sm:px-6 sm:pb-6 animate-in fade-in duration-500 overflow-x-hidden">
      <SectionHeader
        title={t('communities')}
        tone={tabTone('communities')}
        toggle={<ViewDensityToggle value={density} onChange={setDensity} />}
        footer={
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><Icons.Search /></div>
            <input
              dir="auto"
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-emerald-100 rounded-xl leading-5 bg-white/80 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm shadow-sm"
              placeholder={t('search_communities_ph')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        }
        action={(myTrees.length > 0 || currentUserId) ? (
          // The pair SHRINKS instead of overflowing: each button may give up width and cut its
          // label to an ellipsis, so two doors always fit one phone screen.
          <div className="flex min-w-0 items-center justify-end gap-2">
            {myTrees.length > 0 && (
              <button
                onClick={() => setShowCreate(true)}
                className={`bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-4 py-1.5 rounded-full text-sm font-bold transition-all flex min-w-0 items-center gap-1.5 active:scale-95 ${CTA_GLOW}`}
              >
                <Icons.Plus />
                {/* Short everywhere (2026-07-25): one word keeps the band CTAs the same size. */}
                <span className="truncate">{t('register')}</span>
              </button>
            )}
            {/* Match stands RIGHT of Register, wearing the same green: finding a community to
                join is at least as good a door as founding one (Zoltán, 2026-07-22). */}
            {currentUserId && (
              <button
                onClick={handleMatch}
                disabled={isMatching}
                className={`bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-4 py-1.5 rounded-full text-sm font-bold transition-all flex min-w-0 items-center gap-1.5 active:scale-95 disabled:opacity-60 ${CTA_GLOW}`}
              >
                <Icons.Venn />
                <span className="truncate">{isMatching ? 'Reading…' : 'Match'}</span>
              </button>
            )}
          </div>
        ) : undefined}
      >
        <ListBox tone={tabTone('communities')}>
        {loading ? (
          <div className="flex justify-center py-24">
            <Loading />
          </div>
        ) : (communities.length === 0 && !genesisCommunity) ? (
          <div className="bg-white/90 backdrop-blur-sm border border-slate-200 rounded-2xl p-12 md:p-20 text-center flex flex-col items-center shadow-xl animate-in zoom-in-95 duration-700">
              <div className="mb-8 p-6 bg-slate-50 rounded-full border border-slate-200 text-slate-300 rotate-12 group hover:rotate-0 transition-transform duration-500">
                  <Icons.Globe size={80} />
              </div>
              <h2 className="text-3xl font-light text-slate-950 mb-4">No Communities Registered</h2>
              <p className="text-slate-500 max-w-md mx-auto mb-10 leading-relaxed">
                  Be the first to plant a global vision. Communities connect vertical forest nodes into a unified brand and purpose.
              </p>
              {myTrees.length > 0 ? (
                  <button
                      onClick={() => setShowCreate(true)}
                      className="bg-emerald-600 text-white px-10 py-4 rounded-full font-bold shadow-xl hover:bg-emerald-700 transition-all flex items-center gap-2 active:scale-95"
                  >
                      <Icons.Plus />
                      <span>{t('start_community')}</span>
                  </button>
              ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-700 text-sm flex items-center gap-3">
                      <Icons.Tree />
                      <span>{t('community_need_tree')}</span>
                  </div>
              )}
          </div>
        ) : (filteredCommunities.length === 0 && !showGenesis) ? (
          <p className="text-center text-slate-500 py-16">{t('no_communities_match')}</p>
        ) : (
          <>
          {matches && matches.length > 0 && (
            <div className="mb-8 space-y-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">{t('resonant_from_visions')}</p>
                <button onClick={() => setMatches(null)} className="shrink-0 text-xs font-medium text-slate-400 transition-colors hover:text-slate-600">Clear</button>
              </div>
              {matches.map((m, i) => (
                <div key={m.community.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-100 bg-white p-3 shadow-sm">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-black text-white">{i + 1}</span>
                  <button onClick={() => onSelect(m.community)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-bold text-slate-800 hover:text-amber-700">{m.community.name}</span>
                    <span className="block truncate text-[11px] text-slate-400">
                      {Math.round(m.score * 100)}% shared ground · {m.shared.join(' · ')}
                    </span>
                  </button>
                  {standingOf(m.community) === 'joinable' ? (
                    <button onClick={() => handleJoin(m.community)}
                      className="shrink-0 rounded-full bg-emerald-600 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white shadow transition-all hover:bg-emerald-500 active:scale-95">
                      Join
                    </button>
                  ) : (
                    <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 capitalize">{standingOf(m.community)}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className={density === 'rows'
              ? 'space-y-2.5'
              : density === 'mini'
                ? 'grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4'
                : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8'}>
            {showGenesis && <CommunityCard community={genesisCommunity!} isGenesis={true} onSelect={onSelect} standing={standingOf(genesisCommunity!)} onJoin={handleJoin} density={density} />}
            {filteredCommunities.map(community => (
              <div key={community.id}>
                <CommunityCard community={community} onSelect={onSelect} standing={standingOf(community)} onJoin={handleJoin} density={density} />
              </div>
            ))}
          </div>
          </>
        )}
        </ListBox>
      </SectionHeader>

      {showCreate && (
        <Modal title={t('register_community')} onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="ml-1 text-xs font-bold uppercase text-slate-400">{t('name')}</label>
              <input
                type="text"
                required
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder={t('community_name_ph')}
              />
            </div>
            <div>
              <label className="ml-1 text-xs font-bold uppercase text-slate-400">{t('domain')}</label>
              <input
                type="text"
                required
                value={newDomain}
                onChange={e => setNewDomain(e.target.value)}
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="example.com"
              />
            </div>
            <ModalActions className="pt-2">
              <button type="button" onClick={() => setShowCreate(false)} className={modalButton('secondary', { extra: 'flex-1' })}>{t('cancel')}</button>
              <button type="submit" disabled={isCreating} className={modalButton('primary', { extra: 'flex-1' })}>
                {isCreating ? t('creating') : t('create_community')}
              </button>
            </ModalActions>
          </form>
        </Modal>
      )}
    </div>
  );
};
