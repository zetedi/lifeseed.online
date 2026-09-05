import { useEffect, useState } from 'react';
import { LightHouseCareCard } from './LightHouseCareCard';
import { Icons } from './ui/Icons';
import { ProfileHero } from './ui/ProfileHero';
import { ProfileLayout } from './ui/ProfileLayout';
import { SectionMenu, SectionItem } from './ui/SectionMenu';
import { SectionTitle } from './ui/SectionTitle';
import { SuperDot } from './ui/SuperDot';
import { showAlert, showConfirm } from './ui/Dialog';
import { BeingQr } from './ui/BeingQr';
import { LoveButton } from './ui/LoveButton';
import { mintBeingQr } from '../services/firebase/beings';
import { getCommunityById, updateLightHouse, getLifetreeById, getBedsForLightHouse } from '../services/firebase';
import { useRefreshSignal } from '../hooks/useRefreshSignal';
import { PlantBedModal } from './modals/PlantBedModal';
import { useSession } from '../contexts/SessionContext';
import { firestoreStore } from '../adapters/firestore';
import { LocationPicker } from './ui/LocationPicker';
import { announce } from '../services/refreshBus';
import { notify } from './ui/Toast';
import { lightHouseVisibility, type LightHouse, type LightHouseVisibility } from '../domain/lightHouse';
import type { Community, Lifetree } from '../types';
import { spokenLine } from '../utils/translations';
import { useLanguage } from '../contexts/LanguageContext';

import { Picture } from './ui/Picture';
// The Light House's own page — the shared profile anatomy (ProfileHero + ProfileLayout), so a
// sacred place opens like every other being: from its map marker, or from a community's
// LightHouses tab. Two sections: About (the story, the 3D door, the visibility chips) and
// Communities — the mirror of the community profile: which houses this Light House holds.

type LightHouseSection = 'about' | 'communities' | 'tree' | 'beds';

interface LightHouseProfileProps {
    lightHouse: LightHouse;
    onClose: () => void;
    backLabel?: string;
    canEdit?: boolean;
    // True when canEdit comes from staff privilege rather than being the keeper (amber dot).
    editIsStaffOnly?: boolean;
    onSetVisibility?: (id: string, visibility: LightHouseVisibility) => Promise<void>;
    onDelete?: (id: string) => Promise<void>;
    onViewCommunity?: (community: Community) => void;
    onViewTree?: (tree: Lifetree) => void;
}

export const LightHouseProfile = ({ lightHouse, onClose, backLabel = 'Back', canEdit = false, editIsStaffOnly = false, onSetVisibility, onDelete, onViewCommunity, onViewTree }: LightHouseProfileProps) => {
    const { t } = useLanguage();
    const visibility = lightHouseVisibility(lightHouse);
    const [section, setSection] = useState<LightHouseSection>('about');

    // The place, editable by keepers: tap the map (or refine the name), then save.
    const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(
        Number.isFinite(lightHouse.latitude) && Number.isFinite(lightHouse.longitude)
            ? { latitude: lightHouse.latitude!, longitude: lightHouse.longitude! }
            : null,
    );
    const [placeName, setPlaceName] = useState(lightHouse.locationName || '');
    const [isSavingPlace, setIsSavingPlace] = useState(false);
    const placeDirty = (coords?.latitude !== lightHouse.latitude) || (coords?.longitude !== lightHouse.longitude) || placeName.trim() !== (lightHouse.locationName || '');
    const savePlace = async () => {
        if (isSavingPlace) return;
        setIsSavingPlace(true);
        try {
            await updateLightHouse(lightHouse.id, {
                latitude: coords?.latitude,
                longitude: coords?.longitude,
                locationName: placeName.trim() || undefined,
            });
            announce('lightHouses', lightHouse.id);
            notify('🌍 The Light House found its place.');
        } catch (e: any) {
            showAlert(e?.message || 'Could not save the place.');
        }
        setIsSavingPlace(false);
    };

    // The circle of communities this Light House shelters — LIN edges plus the primary,
    // resolved lazily to their documents. Belonging is links, never arrays.
    const [homes, setHomes] = useState<Community[] | null>(null);
    useEffect(() => {
        let alive = true;
        firestoreStore.linksFrom(lightHouse.id, 'shelters')
            .then(links => {
                const ids = [...new Set([...(lightHouse.communityId ? [lightHouse.communityId] : []), ...links.map(l => l.to)])];
                return Promise.all(ids.map(id => getCommunityById(id).catch(() => null)));
            })
            .then(list => { if (alive) setHomes((list || []).filter(Boolean) as Community[]); })
            .catch(() => { if (alive) setHomes([]); });
        return () => { alive = false; };
    }, [lightHouse.id, lightHouse.communityId]);

    // The tree this Light House is ROOTED IN (lightHouse __rooted__ tree) — that tree is a
    // mother tree. A Light House is never built before a tree is planted.
    const [rootTree, setRootTree] = useState<Lifetree | null>(null);
    const [rootLoaded, setRootLoaded] = useState(false);
    // The keeper roots the Light House in one of THEIR OWN lifetrees — a personal avatar,
    // never a guarded nature tree: the mother is a being who answers for it.
    const { myTrees: sessionTrees } = useSession();
    const rootCandidates = (sessionTrees || []).filter((t: Lifetree) => !t.isNature);
    const [isRooting, setIsRooting] = useState(false);
    useEffect(() => {
        let alive = true;
        firestoreStore.linksFrom(lightHouse.id, 'rooted')
            .then(async links => {
                const tid = links[0]?.to;
                const t = tid ? await getLifetreeById(tid).catch(() => null) : null;
                if (alive) { setRootTree(t); setRootLoaded(true); }
            })
            .catch(() => { if (alive) setRootLoaded(true); });
        return () => { alive = false; };
    }, [lightHouse.id]);
    const rootIn = async (tree: Lifetree) => {
        if (isRooting) return;
        setIsRooting(true);
        try {
            if (rootTree) await firestoreStore.unlink(lightHouse.id, 'rooted', rootTree.id);
            await firestoreStore.link(lightHouse.id, 'rooted', tree.id);
            setRootTree(tree);
            notify(`🌳 ${lightHouse.name} is rooted in ${tree.name}, a mother tree now.`);
        } catch (e: any) { showAlert(e?.message || 'Could not root the Light House.'); }
        setIsRooting(false);
    };

    // Beds — a Light House's beds are BEINGS (domain/bed.ts): each its own Lifetree with a
    // profile, a chain (the leaves of who stayed), and a calendar. The keeper offers them; a
    // guest reserves them on the bed's own page. (The old whole-house count offer is retired.)
    const { lightseed } = useSession();
    const viewerUid = lightseed?.uid;
    const isKeeperViewer = !!viewerUid && lightHouse.ownerId === viewerUid;
    const bedsBump = useRefreshSignal(['beds']);
    const [bedList, setBedList] = useState<Lifetree[]>([]);
    const [showOfferBed, setShowOfferBed] = useState(false);
    useEffect(() => {
        let alive = true;
        getBedsForLightHouse(lightHouse.id).then(list => { if (alive) setBedList(list); }).catch(() => {});
        return () => { alive = false; };
        // viewerUid: the fetch reads auth at CALL time (node-visibility beds need a signed-in
        // viewer). If this profile mounts before the session hydrates (cold start via QR, deep
        // link, or an early tap), the first fetch runs signed-out and misses them; re-running on
        // hydration keeps the profile honest with the beds menu, whose house list is already
        // session-reactive (useVisibleLightHouses re-fetches on viewerUid).
    }, [lightHouse.id, bedsBump, viewerUid]);

    const sections: SectionItem[] = [
        { key: 'about', label: 'About', icon: <Icons.Sun /> },
        { key: 'tree', label: 'The Tree', icon: <Icons.Tree /> },
        { key: 'beds', label: `Beds${bedList.length > 0 ? ` (${bedList.length})` : ''}`, icon: <Icons.Moon /> },
        { key: 'communities', label: `Communities${homes && homes.length > 0 ? ` (${homes.length})` : ''}`, icon: <Icons.Globe /> },
    ];

    const handleDelete = async () => {
        if (!onDelete) return;
        if (!(await showConfirm(spokenLine('lh_release_confirm', { name: lightHouse.name || '' }), { title: 'lh_release', confirmText: 'release', danger: true }))) return;
        try { await onDelete(lightHouse.id); } catch (e: any) { showAlert(e?.message || 'Could not release the Light House.'); }
    };

    return (
        <div className="min-h-screen animate-in fade-in zoom-in-95 duration-300 pb-20 bg-slate-50">
            <ProfileHero heroImageUrl={lightHouse.imageUrl || '/lighthouse.webp'}>
                <div className="flex items-center justify-between mb-6">
                    <button onClick={onClose} className="flex items-center gap-2 text-white/70 hover:text-white text-sm font-medium">
                        <Icons.ArrowLeft />
                        <span>{backLabel}</span>
                    </button>
                    <div className="flex items-center gap-2">
                        {canEdit && onDelete && (
                            <button onClick={handleDelete} title="Release this Light House" aria-label="Release this Light House"
                                className="relative flex items-center gap-1.5 rounded-full border border-red-400/40 bg-red-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-red-200 transition-colors hover:bg-red-500 hover:text-white [&>svg]:h-3 [&>svg]:w-3">
                                <Icons.Trash /> Release
                                {editIsStaffOnly && <SuperDot />}
                            </button>
                        )}
                        <span className="flex items-center gap-1 rounded-full bg-amber-400/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-200 [&>svg]:h-3 [&>svg]:w-3">
                            <Icons.Sun /> Light House
                        </span>
                        <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-200">
                            {visibility}
                        </span>
                        <BeingQr lid={lightHouse.lid} name={lightHouse.name} savedHref={lightHouse.qr?.href}
                            canMint={canEdit}
                            onMint={(href) => mintBeingQr('lightHouses', lightHouse.id, href)}
                            className="h-8 w-8 border border-white/15 bg-white/10 text-slate-200 hover:bg-white/25 hover:text-white" />
                        <LoveButton collection="lightHouses" id={lightHouse.id} initialCount={lightHouse.loveCount || 0}
                            className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-slate-200 hover:bg-white/20" />
                    </div>
                </div>
                <div className="flex items-center gap-4 sm:gap-5">
                    <div className="flex h-16 w-16 md:h-20 md:w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-amber-200 bg-[#04070f] shadow-xl">
                        <Picture size={1200} src={lightHouse.imageUrl || '/lighthouse.webp'} className="h-full w-full object-cover" alt={lightHouse.name} referrerPolicy="no-referrer" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h1 dir="auto" className="min-w-0 break-words text-2xl font-light tracking-wide">{lightHouse.name}</h1>
                        {lightHouse.shortTitle && <p className="mt-1 text-sm font-bold uppercase tracking-widest text-amber-300">{lightHouse.shortTitle}</p>}
                        {lightHouse.locationName && (
                            <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] text-slate-300">
                                <Icons.Loc /> {lightHouse.locationName}
                            </p>
                        )}
                    </div>
                </div>
            </ProfileHero>

            <ProfileLayout
                menu={<SectionMenu items={sections} active={section} onSelect={(k) => setSection(k as LightHouseSection)} />}
            >
                {section === 'about' && (
                    <div className="space-y-6">
                        <SectionTitle title="About this Light House" sub="The place, its story, and its doors." />
                        {/* The founding care and its observation — the ceremony that makes it stand. */}
                        <LightHouseCareCard lightHouse={lightHouse} currentUserId={viewerUid} />
                        {lightHouse.body ? (
                            <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-lg">
                                <p dir="auto" className="whitespace-pre-line text-justify font-serif text-lg leading-relaxed text-slate-700">{lightHouse.body}</p>
                            </div>
                        ) : (
                            <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">{t('story_unwritten')}</p>
                        )}

                        {/* The 3D door — step into the Light House's Gaussian-splat scene. */}
                        {lightHouse.splatUrl && (
                            <a href={lightHouse.splatUrl} target="_blank" rel="noopener noreferrer"
                               className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow transition-colors hover:bg-amber-600">
                                Enter the Light House in 3D ✦
                            </a>
                        )}

                        {/* The place — keepers move the Light House with the map's help. */}
                        {canEdit && (
                            <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5 shadow-sm">
                                <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-amber-600">The place</h3>
                                <p className="mb-2 text-[11px] text-slate-500">{t('lh_map_move')}</p>
                                <LocationPicker value={coords} onChange={setCoords} className="h-56 w-full overflow-hidden rounded-xl border border-amber-100 shadow-inner" />
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <input value={placeName} onChange={e => setPlaceName(e.target.value)} placeholder={t('lh_place_ph')}
                                        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                                    <button onClick={savePlace} disabled={!placeDirty || isSavingPlace}
                                        className="rounded-full bg-amber-500 px-5 py-2 text-xs font-bold text-white shadow transition-colors hover:bg-amber-600 disabled:opacity-40">
                                        {isSavingPlace ? 'Saving…' : 'Save place'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Who may see it — keepers can open it wider or draw it back, right here. */}
                        {canEdit && onSetVisibility && (
                            <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5 shadow-sm">
                                <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-amber-600">{t('lh_who_sees')}</h3>
                                <div className="flex flex-wrap gap-2">
                                    {(['community', 'node', 'public'] as const).map(v => (
                                        <button key={v} type="button"
                                            onClick={() => { if (v !== visibility) onSetVisibility(lightHouse.id, v); }}
                                            className={`rounded-full border px-4 py-1.5 text-xs font-bold capitalize transition-all ${visibility === v ? 'border-amber-400 bg-amber-100 text-amber-800' : 'border-slate-200 bg-white text-slate-500 hover:border-amber-200'}`}>
                                            {v}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {section === 'tree' && (
                    <div>
                        <SectionTitle title="The Tree" sub="A Light House roots in a tree, never before one. The tree that holds it is a mother tree." />
                        {!rootLoaded ? (
                            <p className="py-8 text-center text-sm text-slate-400">Listening…</p>
                        ) : rootTree ? (
                            <div
                                onClick={onViewTree ? () => onViewTree(rootTree) : undefined}
                                role={onViewTree ? 'button' : undefined}
                                className={`flex items-center gap-4 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-4 shadow-sm ${onViewTree ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}`}
                            >
                                <Picture size={480} src={rootTree.latestGrowthUrl || rootTree.imageUrl || '/mahameru.svg'} alt="" className="h-16 w-16 shrink-0 rounded-full border-4 border-amber-300 object-cover bg-[#04070f] shadow" />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-lg font-light tracking-wide text-slate-800">{rootTree.name}</p>
                                    <p className="text-[10px] font-black uppercase tracking-wide text-amber-600">☀ Mother tree: this Light House is rooted here</p>
                                </div>
                                <Icons.ArrowRight size={18} className="shrink-0 text-amber-300" />
                            </div>
                        ) : (
                            <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                                This Light House is not rooted in a tree yet.
                            </p>
                        )}

                        {/* The keeper roots (or re-roots) the Light House in one of the domain's trees. */}
                        {canEdit && rootCandidates.length > 0 && (
                            <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
                                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-amber-600">{rootTree ? 'Re-root in another tree' : 'Root this Light House in a tree'}</p>
                                <div className="space-y-2">
                                    {rootCandidates.filter(t => t.id !== rootTree?.id).map(t => (
                                        <div key={t.id} className="flex items-center gap-3 rounded-xl border border-amber-100 bg-white p-2.5">
                                            <Picture size={480} src={t.latestGrowthUrl || t.imageUrl || '/mahameru.svg'} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover bg-[#04070f]" />
                                            <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{t.name}</p>
                                            <button onClick={() => rootIn(t)} disabled={isRooting}
                                                className="shrink-0 rounded-full bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-amber-600 disabled:opacity-50">
                                                {isRooting ? 'Rooting…' : 'Root here'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {section === 'beds' && (
                    <div className="space-y-6">
                        <SectionTitle title="Beds" sub="Places to sleep: each a being, with its own page and calendar." />

                        {bedList.length > 0 ? (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {bedList.map(bed => {
                                    const img = bed.latestGrowthUrl || bed.imageUrl || '';
                                    return (
                                        <button key={bed.id} type="button" onClick={() => onViewTree?.(bed)}
                                            className="group flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left shadow-sm transition-colors hover:border-slate-200 hover:bg-slate-50">
                                            {img
                                                ? <Picture size={480} src={img} alt={bed.name} className="h-14 w-14 flex-none rounded-xl object-cover" />
                                                : <span className="flex h-14 w-14 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 text-white [&>svg]:h-6 [&>svg]:w-6"><Icons.Moon /></span>}
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-bold text-slate-800">{bed.name}</p>
                                                <p className="truncate text-[11px] text-slate-400">{bed.body ? bed.body.slice(0, 60) : 'A place to sleep'}</p>
                                            </div>
                                            <span className="flex-none text-slate-300 [&>svg]:h-4 [&>svg]:w-4 group-hover:text-slate-500"><Icons.ChevronRight /></span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">{t('no_beds_yet')}</p>
                        )}

                        {isKeeperViewer && (
                            <button type="button" onClick={() => setShowOfferBed(true)}
                                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white shadow transition-colors hover:bg-emerald-700">
                                <span className="[&>svg]:h-4 [&>svg]:w-4"><Icons.Plus /></span>Offer a bed
                            </button>
                        )}

                        {showOfferBed && (
                            <PlantBedModal lightHouse={lightHouse} onClose={() => setShowOfferBed(false)}
                                onPlanted={() => announce('beds', lightHouse.id)} />
                        )}
                    </div>
                )}

                {section === 'communities' && (
                    <div>
                        <SectionTitle title="Communities" sub="The houses this Light House holds: the mirror of each community's Light Houses tab." />
                        {homes === null ? (
                            <p className="py-8 text-center text-sm text-slate-400">Listening…</p>
                        ) : homes.length === 0 ? (
                            <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                                No community has stepped into this Light House yet.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {homes.map(c => (
                                    <div
                                        key={c.id}
                                        onClick={onViewCommunity ? () => onViewCommunity(c) : undefined}
                                        role={onViewCommunity ? 'button' : undefined}
                                        aria-label={onViewCommunity ? `Open ${c.name}` : undefined}
                                        className={`group relative h-36 overflow-hidden rounded-2xl shadow-md ring-1 ring-slate-100 ${onViewCommunity ? 'cursor-pointer transition-shadow hover:shadow-lg' : ''}`}
                                    >
                                        {c.heroImageUrl ? (
                                            <Picture size={1200} src={c.heroImageUrl} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" alt={c.name} />
                                        ) : (
                                            <div className="absolute inset-0" style={{ backgroundColor: c.theme?.primary || '#0f766e' }} />
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/5" />
                                        <div className="absolute bottom-3 left-4 right-4 flex items-center gap-3 text-white">
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/30 bg-white/20 backdrop-blur">
                                                {c.logoUrl ? <Picture size={480} src={c.logoUrl} className="h-full w-full object-cover" alt="" /> : <Icons.Globe />}
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block truncate text-base font-light tracking-wide">{c.name}</span>
                                                <span className="block truncate text-[11px] text-slate-300">{c.domain}</span>
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </ProfileLayout>
        </div>
    );
};
