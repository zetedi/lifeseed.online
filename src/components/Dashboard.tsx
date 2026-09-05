
import { useEffect, useState, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSession } from '../contexts/SessionContext';
import { getNetworkStats, getLightHousesByDomain, getAllLightHouses, getRootedTrees, getCommunityById } from '../services/firebase';
import { dataDomainFor } from '../domain/communityDoor';
import { headerSurface } from '../domain/themeSurface';
import { treeCoordinates } from '../domain/views/forest';
import { PlantCTA } from './ui/PlantCTA';
import { Icons } from './ui/Icons';
import { ScrollChevrons } from './ui/ScrollChevrons';
import { QuoteCarousel } from './ui/QuoteCarousel';
import { quotesFor } from '../content/quotes';
import { useScrollEdges } from '../hooks/useScrollEdges';
import { MiniForestMap, type MapPoint } from './ui/MiniForestMap';
import { EventCard } from './EventCard';
import { fetchMyRays } from '../services/firebase/light';
import { formatLight } from '../domain/light';
import { Community, Pulse } from '../types';

import { Picture } from './ui/Picture';
export interface DashboardProps {
    stats: {
        trees: number;
        pulses: number;
        visions: number;
        alignments: number;
        danger: number;
    };
    hostCommunity?: Community | null;
    events?: Pulse[];
    onViewEvent?: (event: Pulse) => void;
    onViewCommunity?: (community: Community) => void;
    onSetTab: (tab: string) => void;
    onPlant: () => void;
    onLogin: () => void;
    // Themed domains colour the planting CTAs from Appearance settings.
    theme?: { primary?: string; surface?: string; background?: string; text?: string; neutral?: string };
    isDark?: boolean;
}




export const Dashboard = ({ stats, hostCommunity, events, onViewEvent, onViewCommunity, onSetTab, onPlant, onLogin, theme, isDark = false }: DashboardProps) => {
    // Themed domains colour the planting CTAs from Appearance (hub default stays emerald).
    const ctaPrimary = theme?.primary || '#059669';
    // The events banner wears the HEADER's actual surface — light where the header is
    // light (the hub), themed where a community themes it.
    const banner = headerSurface(theme, isDark);
    // Vanity counts stay hidden unless the node opts in from Appearance — the home is not numbers.
    const showStats = hostCommunity?.showStats === true;
    const { t, language } = useLanguage();
    // Session-derived values read straight from context (no longer prop-drilled from App).
    const { lightseed, activeTree, isSuperAdmin } = useSession();
    const firstTreeImage = activeTree?.latestGrowthUrl || activeTree?.imageUrl;
    // The signed-in being's own light, shown on the Home card under "Light of Value". Rays are
    // holder-private (light.ts), so this query only ever resolves for you; the sum is your light.
    // Key the private reading to the account it belongs to. On logout or account-switch the
    // derived label disappears immediately, before the next request resolves, so one being's
    // light can never flash on another being's Home card.
    const [lightReading, setLightReading] = useState<{ uid: string; label: string } | null>(null);
    const lightLabel = lightReading && lightReading.uid === lightseed?.uid ? lightReading.label : null;
    useEffect(() => {
        const uid = lightseed?.uid;
        if (!uid) return;
        let alive = true;
        fetchMyRays(uid)
            .then(rays => {
                if (alive) setLightReading({
                    uid,
                    label: formatLight(rays.reduce((sum, r) => sum + r.units, 0)),
                });
            })
            .catch(() => {});
        return () => { alive = false; };
    }, [lightseed?.uid]);
    const eventsScrollRef = useRef<HTMLDivElement>(null);
    // The event card's community door. Events are fetched BY DOMAIN, and older event pulses
    // carry no communityId — those belong to the domain's home, the host community, so the
    // door falls back to it rather than vanishing. With an id: the host opens from the doc in
    // hand; any other community resolves by id first.
    const openEventCommunity = async (ev: Pulse) => {
        if (!onViewCommunity) return;
        if (!ev.communityId) { if (hostCommunity) onViewCommunity(hostCommunity); return; }
        if (hostCommunity && hostCommunity.id === ev.communityId) { onViewCommunity(hostCommunity); return; }
        const community = await getCommunityById(ev.communityId).catch(() => null);
        if (community) onViewCommunity(community);
    };
    // The face on the card: the community we can already SHOW without a fetch (the host, when
    // the event is its own or carries no id); others show their name's initial.
    const eventCommunityFace = (ev: Pulse): Community | null =>
        hostCommunity && (!ev.communityId || ev.communityId === hostCommunity.id) ? hostCommunity : null;
    // (The card owns its own countdown + participant read now — see components/EventCard.)
    // Fade only the side(s) that hide a card — the same source the nav arrows read, so a fade
    // shows exactly where an arrow does (and neither when everything fits).
    const { canPrev: evPrev, canNext: evNext } = useScrollEdges(eventsScrollRef, 'x');
    const eventsMask = evPrev && evNext
        ? 'linear-gradient(to right, transparent, #000 2rem, #000 calc(100% - 2rem), transparent)'
        : evPrev ? 'linear-gradient(to right, transparent, #000 2rem)'
        : evNext ? 'linear-gradient(to right, #000 calc(100% - 2rem), transparent)'
        : undefined;
    const [networkStats, setNetworkStats] = useState({ trees: 0, pulses: 0, visions: 0 });

    // The Forest card shows a live mini-map of just the node's lighthouses + the mother trees they
    // root into — a small, dedicated fetch (not the whole forest feed). Scoped like the community /
    // forest view: a real node by its domain; the dev host (as superadmin) shows everything, so the
    // map isn't empty while developing.
    const [mapPoints, setMapPoints] = useState<MapPoint[]>([]);
    const isDevHost = typeof window !== 'undefined' && /localhost|127\.0\.0\.1|^192\.168\.|\.local$/.test(window.location.hostname);
    // Scope like the community/forest view: an explicitly reflecting place (or the dev host as
    // superadmin) shows every public Light House; a scoped place shows only its own domain's.
    const mapActiveDomain = hostCommunity?.domain || (typeof window !== 'undefined' ? window.location.hostname : '');
    const scopeDomain = (isDevHost && isSuperAdmin)
        ? undefined
        : dataDomainFor(mapActiveDomain, hostCommunity?.reflectsPublic);
    const reflectsPublic = hostCommunity?.reflectsPublic === true && !(isDevHost && isSuperAdmin);
    useEffect(() => {
        let alive = true;
        const publicOnly = !lightseed || reflectsPublic;
        (scopeDomain ? getLightHousesByDomain(scopeDomain, { publicOnly }) : getAllLightHouses({ publicOnly }))
            .then(async sancts => {
                const trees = await getRootedTrees(sancts.map(s => s.id));
                if (!alive) return;
                setMapPoints([
                    ...sancts.filter(s => typeof s.latitude === 'number' && typeof s.longitude === 'number')
                        .map(s => ({ lat: s.latitude as number, lng: s.longitude as number, kind: 'lighthouse' as const })),
                    ...trees.map(t => treeCoordinates(t)).filter((c): c is { lat: number; lng: number } => !!c)
                        .map(c => ({ lat: c.lat, lng: c.lng, kind: 'tree' as const })),
                ]);
            })
            .catch((e) => { console.warn('Mini-map lighthouse fetch failed:', e); if (alive) setMapPoints([]); });
        return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on scope + sign-in (lightseed?.uid); lightseed's object identity changes without the uid
    }, [scopeDomain, lightseed?.uid, reflectsPublic]);

    useEffect(() => {
        // The Forest card counts THIS place: only its own domain when the node is a scoped pond,
        // or the whole instance when it reflects the commons (getNetworkStats treats an absent
        // domain as unscoped). Reflection is explicit; an absent flag stays scoped.
        const activeDomain = hostCommunity?.domain || window.location.hostname;
        getNetworkStats(
            dataDomainFor(activeDomain, hostCommunity?.reflectsPublic),
            hostCommunity?.reflectsPublic === true,
        ).then(setNetworkStats);
    }, [lightseed, hostCommunity?.domain, hostCommunity?.reflectsPublic]);


    return (
        <div className="space-y-3 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* (The node banner that used to sit here is gone — About Node is the same page, and
                the node's face is moving toward a customizable page over the seed.) */}

            {/* Signed-out visitors: a full-width carousel of reflections (admin-editable per node)
                in place of the Home + Observatory cards. */}
            {!lightseed && <QuoteCarousel quotes={(hostCommunity?.carouselQuotes?.length ? hostCommunity.carouselQuotes : quotesFor(language))} />}

            {/* Events banner — logged-in only. Full width (home card → plant card), half a card
                tall. A distorted node/community hero, a living leaf texture, and an oversized
                EVENTS wordmark running behind the cards. Looks special with or without a hero. */}
            {lightseed && events && events.length > 0 && (
                // Outer wrapper does NOT clip, so the nav arrows can overhang the banner's border;
                // the inner banner keeps overflow-hidden for its rounded corners + wordmark wash.
                <div className="relative w-full">
                {/* The header-colour fill stays (the appearance setting), framed by ONLY the
                    amber border — the old amber GLOW shadow is gone (that faint shadow, half
                    hidden by the box's own edge, was the "white strip over the event shadow"). */}
                <div className="relative w-full overflow-hidden rounded-2xl h-80 md:h-96 border border-amber-300/70"
                     style={{ backgroundColor: banner.background }}>
                    {/* Cards float over the wash, under an explicit Events label. */}
                    <div className="relative z-10 flex h-full flex-col px-4 py-3">
                        <div className="mb-2 flex items-baseline gap-2">
                            <span className="text-sm sm:text-lg font-bold uppercase tracking-widest" style={{ color: banner.text }}>{t('events')}</span>
                            <span className="truncate text-[11px]" style={{ color: banner.muted }}>{t('events_sub')}</span>
                        </div>
                        {/* A half-seen card at a scrollable edge dissolves into the wash rather than
                            being hard-cut — but only on the side that actually hides a card. The
                            vertical padding gives each card's drop-shadow room to breathe instead of
                            being clipped by the scroller's edge. */}
                        <div ref={eventsScrollRef} className="scroll-hide-bar flex flex-1 items-stretch gap-7 overflow-x-auto py-3"
                             style={{ maskImage: eventsMask, WebkitMaskImage: eventsMask }}>
                        {events.map(ev => (
                            <EventCard
                                key={ev.id}
                                event={ev}
                                onOpen={() => onViewEvent?.(ev)}
                                community={eventCommunityFace(ev)}
                                onOpenCommunity={onViewCommunity ? () => { void openEventCommunity(ev); } : undefined}
                                className="w-48 shrink-0 md:w-60"
                                isDark={isDark}
                            />
                        ))}
                        </div>
                    </div>
                </div>
                <ScrollChevrons scrollRef={eventsScrollRef} axis="x" />
                </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:gap-8">
            {/* Box 1: Home HUD — signed-in only (signed-out visitors see the quote carousel) */}
            {lightseed && (
            <div onClick={() => lightseed ? onSetTab('profile') : onLogin()} className="relative h-56 md:h-72 lg:h-80 rounded-2xl overflow-hidden shadow-xl cursor-pointer group">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-purple-600"></div>
                {lightseed && firstTreeImage && <Picture size={1200} src={firstTreeImage} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-[5s]" />}
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors"></div>
                
                <div className="relative h-full p-4 flex flex-col justify-between text-white">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <h2 className="text-sm sm:text-lg font-bold uppercase tracking-widest text-white drop-shadow-md">{t('home')}</h2>
                            <div className="text-lg sm:text-xl font-light truncate max-w-[180px]">{lightseed ? lightseed.displayName : t('sign_in')}</div>
                            <div className="text-[10px] text-amber-200 font-mono uppercase tracking-widest mt-1">{t('light_of_value')}</div>
                            {/* How much light you hold: the sum of your rays (private to you). */}
                            {lightLabel && (
                                <div className="mt-1 flex items-center gap-1 text-amber-100 drop-shadow">
                                    <span className="text-amber-300 [&>svg]:h-3.5 [&>svg]:w-3.5"><Icons.Sun /></span>
                                    <span className="text-sm font-bold tabular-nums">{lightLabel}</span>
                                </div>
                            )}
                        </div>
                        {/* Stats on → a small tree in the corner (the CTA lives at the foot now). */}
                        {showStats && (
                            <div className="shrink-0 rounded-lg bg-white/10 p-2 backdrop-blur [&>svg]:h-5 [&>svg]:w-5"><Icons.Tree /></div>
                        )}
                    </div>

                    {/* Moved low: the CTA sits at the foot of the card (it clipped in the top-right).
                        Full counts only when the node opts in; else a minimal T/P/V/A in the corner. */}
                    <div className="space-y-2">
                        {showStats && (
                            <div className="grid grid-cols-2 bg-white/10 backdrop-blur p-2 rounded-lg border border-white/10">
                                <div className="text-center border-r border-b border-white/10 pb-2">
                                    <span className="block text-[10px] uppercase text-emerald-200">{t('trees')}</span>
                                    <span className="font-bold text-sm">{stats.trees}</span>
                                </div>
                                <div className="text-center border-b border-white/10 pb-2">
                                    <span className="block text-[10px] uppercase text-sky-200">{t('pulses')}</span>
                                    <span className="font-bold text-sm">{stats.pulses}</span>
                                </div>
                                <div className="text-center border-r border-white/10 pt-2">
                                    <span className="block text-[10px] uppercase text-amber-200">{t('visions')}</span>
                                    <span className="font-bold text-sm">{stats.visions}</span>
                                </div>
                                <div className="text-center pt-2">
                                    <span className="block text-[10px] uppercase text-rose-200">{t('alignments')}</span>
                                    <span className="font-bold text-sm">{stats.alignments}</span>
                                </div>
                            </div>
                        )}
                        <PlantCTA color={ctaPrimary} onClick={(e) => { e.stopPropagation(); onPlant(); }} />
                        {/* Stats off: a quiet tally just below the CTA — trees/pulses/visions/alignments.
                            Hidden for a day-one newcomer (all zero) so they meet no cold cipher of zeros. */}
                        {!showStats && stats.danger === 0 && (stats.trees + stats.pulses + stats.visions + stats.alignments) > 0 && (
                            <p className="text-right font-mono text-[10px] font-bold uppercase tracking-wider text-white/75 drop-shadow-md">T{stats.trees} P{stats.pulses} V{stats.visions} A{stats.alignments}</p>
                        )}
                    </div>

                    {stats.danger > 0 && (
                        <div className="absolute bottom-2 right-2 bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-full animate-pulse shadow-lg flex items-center gap-1 whitespace-nowrap z-20 border-2 border-white/20">
                            <Icons.Siren /> {stats.danger} {t('guard_tree')}!
                        </div>
                    )}
                </div>
            </div>
            )}

            {/* Box 2: Plant — signed-out only (signed-in users get the small CTA in the Home card). */}
            {!lightseed && (
            <div onClick={() => { if (!lightseed) onLogin(); else onPlant(); }} className="relative h-56 md:h-72 lg:h-80 rounded-2xl overflow-hidden shadow-xl cursor-pointer group">
                {/* Real bark — the middle of trunkb.jpg, webp-treated. The planting film retired. */}
                <img src="/trunkb.webp" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" />
                <div className="absolute inset-0 bg-black/25 group-hover:bg-black/20 transition-colors"></div>

                <div className="relative h-full p-4 flex flex-col justify-between text-white">
                    <div className="flex justify-between items-start">
                        <h2 className="text-sm sm:text-lg font-bold uppercase tracking-widest text-white drop-shadow-md">{t('the_tree')}</h2>
                        <div className="p-2 bg-white/10 backdrop-blur rounded-lg"><Icons.Tree /></div>
                    </div>
                    {/* The shared Plant CTA — same glowing two-line pill as the signed-in card. */}
                    <PlantCTA color={ctaPrimary} className="self-start sm:group-hover:scale-[1.03]" />
                </div>
            </div>
            )}

            {/* Box 4: Forest — a live mini-map of the real forest (non-interactive; tap opens it). */}
            <div onClick={() => onSetTab('forest')} className="relative h-56 md:h-72 lg:h-80 rounded-2xl overflow-hidden shadow-xl cursor-pointer group">
                <MiniForestMap points={mapPoints} className="absolute inset-0 h-full w-full bg-slate-900 isolate" />
                {/* Darker at top/bottom for the title + EXPLORE; a warm amber wash through the middle
                    ties the live map to the bark of the tree card. */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-amber-900/15 to-black/60 group-hover:from-black/45 group-hover:to-black/50 transition-colors"></div>
                <div className="relative h-full p-4 flex flex-col justify-between text-white">
                    <div className="flex justify-between items-start">
                        <h2 className="text-sm sm:text-lg font-bold uppercase tracking-widest text-white drop-shadow-md">{t('the_forest')}</h2>
                        <div className="p-2 bg-white/10 backdrop-blur rounded-lg"><Icons.Map /></div>
                    </div>
                    
                    {showStats && (
                    <div className="grid grid-cols-2 md:grid-cols-3 bg-white/10 backdrop-blur p-2 rounded-lg border border-white/10">
                        <div className="text-center border-r border-b md:border-b-0 border-white/10 pb-2 md:pb-0">
                            <span className="block text-[10px] uppercase text-emerald-200">{t('trees')}</span>
                            <span className="font-bold text-sm">{networkStats.trees}</span>
                        </div>
                        <div className="text-center border-b md:border-b-0 md:border-r border-white/10 pb-2 md:pb-0">
                            <span className="block text-[10px] uppercase text-sky-200">{t('pulses')}</span>
                            <span className="font-bold text-sm">{networkStats.pulses}</span>
                        </div>
                        <div className="text-center col-span-2 md:col-span-1 pt-2 md:pt-0">
                            <span className="block text-[10px] uppercase text-amber-200">{t('visions')}</span>
                            <span className="font-bold text-sm">{networkStats.visions}</span>
                        </div>
                    </div>
                    )}

                    {/* A tiny legend for the map marks, then EXPLORE + the minimal T/P/V tally. */}
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-3 text-[10px] font-medium text-white/85 drop-shadow-md">
                            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 shrink-0 rounded-full bg-yellow-300 shadow-[0_0_6px_2px_rgba(250,204,21,0.75)]" /> {t('light_houses')}</span>
                            <span className="flex items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full bg-yellow-300 shadow-[0_0_4px_1px_rgba(250,204,21,0.65)]" /> {t('mother_trees')}</span>
                        </div>
                        <div className="flex items-end justify-between gap-2 border-t border-white/30 pt-2">
                            <span className="text-sm font-medium uppercase tracking-wide">{t('explore')}</span>
                            {!showStats && (
                                <span className="whitespace-nowrap font-mono text-[10px] font-bold uppercase tracking-wider text-white/75 drop-shadow-md">T{networkStats.trees} P{networkStats.pulses} V{networkStats.visions}</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        </div>
    );
};
