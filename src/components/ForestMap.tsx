
import React, { useRef, useEffect, useMemo, useState } from 'react';
import { type Lifetree } from '../types';
import { isExplicitlyValidatedTree } from '../utils/validation';
import { escapeHtml, safeImageUrl, DARK_IMAGE_FALLBACK } from '../utils/sanitize';
import { imageVariantUrlOf } from '../domain/imageVariant';
import { isWateringOverdue } from '../domain/watering';
import { Loading } from './ui/Loading';
import { Icons } from './ui/Icons';
import { treeCoordinates as getTreeCoordinates, forestMarkers } from '../domain/views/forest';
import { firestoreStore } from '../adapters/firestore';
import { loadLeaflet } from '../services/leaflet';
import type { LightHouse } from '../domain/lightHouse';
import { useVisibleLightHouses } from '../hooks/useVisibleLightHouses';

// A seat in marker HTML: the 480 variant in src, the primary a step behind it in data-primary.
// The map container's capture-phase error listener (below) swaps the primary in when the
// variant is not (yet) there. Both pass safeImageUrl — attribute-safe, http(s) or / only.
const seatAttrs = (url: string | null | undefined, fallback = ''): string => {
    const primary = safeImageUrl(url, fallback);
    const variant = safeImageUrl(imageVariantUrlOf(url, 480), fallback);
    return `src="${variant}" data-primary="${primary}"`;
};

interface Cluster {
    id: string;
    center: Lifetree;
    children: Lifetree[];
    lat: number;
    lng: number;
}

interface StackLevel {
    clusterId: string;  // ID of the root cluster (for matching which cluster is open)
    trees: Lifetree[];  // [center, ...petals, ...remaining]
    lat: number;
    lng: number;
}

// A lightHouse rides the map as a being like any other — this pseudo-tree shape lets it join
// the same clustering, petal expansion and popup plumbing the trees use.
type MapBeing = Lifetree & { __lightHouse?: LightHouse };

export const ForestMap = ({ trees, onView, onReach, onViewLightHouse, loading = false, onRefresh, primaryTree = null, refreshKey = 0, lightHouseDomain = null, lightHousesPublicOnly = false, showLightHouses = true, filtersOverlay = null }: { trees: Lifetree[], onView: (tree: Lifetree) => void, onReach?: (tree: Lifetree) => void, onViewLightHouse?: (s: LightHouse) => void, loading?: boolean, onRefresh?: () => void, primaryTree?: Lifetree | null, refreshKey?: number, lightHouseDomain?: string | null, lightHousesPublicOnly?: boolean, showLightHouses?: boolean, filtersOverlay?: React.ReactNode }) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);
    const leafletRef = useRef<any>(null);
    const containerObserverRef = useRef<ResizeObserver | null>(null);
    // The filters overlay lives INSIDE the map container's stacking context, below the popup
    // pane (700) — so an opening marker popup paints ABOVE the filters, not under them.
    const overlayRef = useRef<HTMLDivElement>(null);

    // Marker and popup pictures are HTML strings asking for their 480 variant; when one is not
    // (yet) there, the primary in data-primary takes its seat. Image errors do not bubble, so
    // this listens in the capture phase on the map's own container (popups live inside it).
    useEffect(() => {
        const el = mapContainer.current;
        if (!el) return;
        const fallBack = (e: Event) => {
            const t = e.target;
            if (t instanceof HTMLImageElement && t.dataset.primary && t.getAttribute('src') !== t.dataset.primary) t.src = t.dataset.primary;
            else if (t instanceof SVGImageElement && t.dataset.primary && t.getAttribute('href') !== t.dataset.primary) t.setAttribute('href', t.dataset.primary);
        };
        el.addEventListener('error', fallBack, true);
        return () => el.removeEventListener('error', fallBack, true);
    }, []);
    const markersLayer = useRef<any>(null);
    const updateMarkersRef = useRef<(L: any, force?: boolean) => void>(() => {});
    const expansionStackRef = useRef<StackLevel[]>([]);
    const lastMarkerRenderKeyRef = useRef('');
    // Ensures we only auto-frame the primary lifetree once (not on every data refresh,
    // so we never yank the view back while the user is panning around).
    const didInitialFocusRef = useRef(false);

    const [expansionStack, setExpansionStack] = useState<StackLevel[]>([]);
    // The map fills the vertical space it's given: from wherever it starts (just under the
    // header/filters) down to where the FOOTER still fits on screen. Everything below the map —
    // page paddings plus the footer itself — is measured as one constant gap (it doesn't change
    // with the map's height), so the footer's bottom lands exactly at the viewport's bottom.
    const [mapHeight, setMapHeight] = useState<number | string>('calc(100vh - 300px)');
    useEffect(() => {
        const measure = () => {
            const el = mapContainer.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const absTop = rect.top + window.scrollY;
            const footer = document.querySelector('footer');
            const below = footer
                ? footer.getBoundingClientRect().bottom - rect.bottom
                : 16;
            setMapHeight(Math.max(480, window.innerHeight - absTop - below + 16));
        };
        // Layout above and below the map shifts without any window resize (the Light Path
        // card dismisses, the footer's content arrives async, filters wrap) — so watch the
        // document body itself, coalesced through rAF. The formula is a fixed point: once the
        // height is right, re-measuring computes the same number and React bails out.
        let raf = 0;
        const onShift = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
        measure();
        window.addEventListener('resize', onShift);
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onShift) : null;
        ro?.observe(document.body);
        return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onShift); ro?.disconnect(); };
    }, []);
    const [isMapReady, setIsMapReady] = useState(false);
    const [markerCount, setMarkerCount] = useState(0);
    const visibleTrees = useMemo(() => trees.filter(tree => getTreeCoordinates(tree)), [trees]);
    const visibleTreeCount = visibleTrees.length;
    // Guardian counts come from the LIN (all 'guardian' edges), fetched and grouped by tree.
    // refreshKey re-fetches after we touch a tree (e.g. join/leave a guardianship in a detail view).
    const [guardianCounts, setGuardianCounts] = useState<Map<string, number>>(new Map());
    // Keyed on the tree ID SET, not the array identity — the parent hands us a fresh array
    // on unrelated re-renders, and each re-fetch here is a whole-collection Firestore read.
    const treeIdsKey = useMemo(() => visibleTrees.map(t => t.id).sort().join(','), [visibleTrees]);
    useEffect(() => {
        let alive = true;
        firestoreStore.linksByRel('guardian').then(links => {
            if (!alive) return;
            const counts = new Map<string, number>();
            for (const l of links) counts.set(l.to, (counts.get(l.to) || 0) + 1);
            setGuardianCounts(counts);
        }).catch(() => {});
        return () => { alive = false; };
    }, [treeIdsKey, refreshKey]);
    // LightHouses — one shared source with the forest grid (useVisibleLightHouses);
    // the map keeps only the placeable ones.
    const visibleLightHouses = useVisibleLightHouses(lightHouseDomain, refreshKey, lightHousesPublicOnly);
    const lightHouses = useMemo(
        () => visibleLightHouses.filter(x => Number.isFinite(x.latitude) && Number.isFinite(x.longitude)),
        [visibleLightHouses],
    );
    const lightHousesSignature = lightHouses.map(x => [x.id, x.latitude, x.longitude, x.imageUrl || '', x.splatUrl || ''].join(':')).join('|');
    const lightHouseBeings = useMemo<MapBeing[]>(() => lightHouses.map(s => ({
        id: `lightHouse__${s.id}`,
        name: s.name,
        ownerId: s.ownerId || '',
        latitude: s.latitude,
        longitude: s.longitude,
        imageUrl: s.imageUrl || '/lighthouse.webp',
        createdAt: s.createdAt,
        __lightHouse: s,
    } as MapBeing)), [lightHouses]);

    // Memoized + slimmed: only fields that change a marker's appearance (name included —
    // it labels the marker for screen readers). Excludes body/heavy text so this isn't
    // rebuilt megabyte-sized on every render once the map holds hundreds of trees.
    const treesSignature = useMemo(() => forestMarkers(visibleTrees, guardianCounts).map(m =>
        [m.id, m.name, m.lat, m.lng, m.status, m.kind, m.imageUrl, m.growthUrl, m.guardianCount, m.validated ? 'validated' : ''].join(':')
    ).join('|') + '#' + visibleTrees.filter(t => isWateringOverdue(t)).map(t => t.id).join(','), [visibleTrees, guardianCounts]);
    const expansionSignature = expansionStack.map(level => `${level.clusterId}:${level.lat}:${level.lng}:${level.trees.map(tree => tree.id).join(',')}`).join('|');

    useEffect(() => {
        expansionStackRef.current = expansionStack;
    }, [expansionStack]);

    // Leaflet popups are bottom-anchored and only ever grow upward — no offset or CSS class
    // can truly flip one below its marker. So we don't fight the geometry: autoPan pans the
    // MAP just enough for the popup to fit (the marker rides along, staying visible), on every
    // edge, at every zoom, with zero per-open math.
    const POPUP_OPTIONS = {
        autoPan: true,
        autoPanPadding: [28, 28] as [number, number],
        closeButton: false,
        offset: [0, -18] as [number, number],
        maxWidth: 260,
    };

    // Declared before the loader effect below so the effect closes over the declared function.
    const initMap = (L: any) => {
        if (!mapContainer.current || mapInstance.current) return;

        mapInstance.current = L.map(mapContainer.current, {
            zoomControl: false,
            attributionControl: false
        }).setView([20, 0], 2);
        mapInstance.current.whenReady(() => setIsMapReady(true));

        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
            maxZoom: 19,
            // A ring of parked tiles for smoother panning; CORS mode so responses are
            // non-opaque and the service worker's tile cache can actually hold them.
            keepBuffer: 4,
            crossOrigin: true
        }).addTo(mapInstance.current);

        L.control.zoom({ position: 'bottomright' }).addTo(mapInstance.current);
        markersLayer.current = L.layerGroup().addTo(mapInstance.current);

        mapInstance.current.on('zoomend', () => {
            if (expansionStackRef.current.length > 0) {
                setExpansionStack([]);
            } else {
                updateMarkersRef.current(L, true);
            }
        });

        // Click on map background collapses everything
        mapInstance.current.on('click', () => {
            setExpansionStack(prev => prev.length > 0 ? [] : prev);
        });

        // Leaflet caches its container size; re-measure exactly when the container's box
        // changes (the measured mapHeight landing, sidebars, orientation) — no guessed timers.
        const ro = new ResizeObserver(() => mapInstance.current?.invalidateSize());
        ro.observe(mapContainer.current);
        containerObserverRef.current = ro;

        requestAnimationFrame(() => {
            mapInstance.current?.invalidateSize();
            updateMarkersRef.current(L, true);
        });
    }

    useEffect(() => {
        let alive = true;
        loadLeaflet().then(L => {
            if (!alive) return;
            leafletRef.current = L;
            initMap(L);
            // The filters overlay sits inside Leaflet's container: without this, tapping a
            // filter would double as a map click (collapsing expansions, closing popups).
            if (overlayRef.current) {
                L.DomEvent.disableClickPropagation(overlayRef.current);
                L.DomEvent.disableScrollPropagation(overlayRef.current);
            }
        });
        return () => { alive = false; };
    }, []);

    useEffect(() => {
        const L = leafletRef.current;
        if (!L || !mapInstance.current || !isMapReady) return;
        const timer = window.setTimeout(() => {
            mapInstance.current?.invalidateSize();
            updateMarkersRef.current(L);
        }, 50);
        return () => window.clearTimeout(timer);
    }, [treesSignature, expansionSignature, lightHousesSignature, showLightHouses, loading, isMapReady]);

    useEffect(() => {
        if (!isMapReady || loading || visibleTreeCount === 0 || markerCount > 0) return;
        const L = leafletRef.current;
        if (!L || !mapInstance.current) return;

        const retry = window.setTimeout(() => {
            mapInstance.current?.invalidateSize();
            updateMarkersRef.current(L, true);
        }, 250);

        return () => window.clearTimeout(retry);
    }, [isMapReady, loading, visibleTreeCount, markerCount, treesSignature, expansionSignature]);

    // Default view — everyone lands on a populated frame, never an empty ocean:
    // with a primary lifetree, the seven nearest trees; without one (visitor, or not yet
    // planted), the whole forest. And if the view has already left the default world frame
    // (the user explored while data was still arriving), never yank it anywhere.
    useEffect(() => {
        if (!isMapReady || didInitialFocusRef.current) return;
        const L = leafletRef.current;
        const map = mapInstance.current;
        if (!L || !map) return;

        const c = map.getCenter();
        if (map.getZoom() !== 2 || Math.abs(c.lat - 20) > 0.5 || Math.abs(c.lng) > 0.5) {
            didInitialFocusRef.current = true; // the walker moved first — their view wins
            return;
        }

        const located = visibleTrees
            .map(getTreeCoordinates)
            .filter(Boolean) as { lat: number; lng: number }[];
        if (located.length === 0) return; // trees not loaded yet — retry when they arrive

        const center = primaryTree ? getTreeCoordinates(primaryTree) : null;
        didInitialFocusRef.current = true;

        if (!center) {
            map.fitBounds(L.latLngBounds(located.map(x => [x.lat, x.lng])).pad(0.2), { animate: false, maxZoom: 10 });
            return;
        }

        const nearest = located
            .map(x => ({ x, d: (x.lat - center.lat) ** 2 + (x.lng - center.lng) ** 2 }))
            .sort((a, b) => a.d - b.d)
            .slice(0, 7)
            .map(n => n.x);

        if (nearest.length >= 2) {
            const bounds = L.latLngBounds(nearest.map(x => [x.lat, x.lng]));
            map.fitBounds(bounds.pad(0.3), { animate: false, maxZoom: 16 });
        } else {
            // Only one tree to show — fall back to a ~100 km radius around it.
            map.fitBounds(L.latLng(center.lat, center.lng).toBounds(200000), { animate: false });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on treesSignature on purpose: visibleTrees changes identity every render; the one-shot initial focus only needs to re-run when the tree set actually changes
    }, [isMapReady, primaryTree, treesSignature]);

    const getHtmlForTree = (tree: Lifetree, isSmall = false, delay = 0) => {
        const sanct = (tree as MapBeing).__lightHouse;
        if (sanct) {
            const size = isSmall ? 'w-10 h-10' : 'w-12 h-12';
            const img = seatAttrs(sanct.imageUrl || '/lighthouse.webp', DARK_IMAGE_FALLBACK);
            return `
            <div class="marker-pop relative ${size} hover:scale-110 transition-transform duration-300" style="animation-delay: ${delay}ms;" role="button" aria-label="${escapeHtml(sanct.name)}, Light House">
                <div class="lightHouse-glow absolute -inset-4 rounded-full"></div>
                <div class="absolute -inset-1 rounded-full border-2 border-yellow-300/90"></div>
                <div class="relative ${size} rounded-full border-2 border-amber-400 overflow-hidden bg-[#04070f] shadow-xl z-10">
                    <img ${img} style="width:100%;height:100%;object-fit:cover;display:block;" />
                </div>
            </div>`;
        }
        const isNature = tree.isNature;
        const isDanger = tree.status === 'DANGER';
        const guardianCount = guardianCounts.get(tree.id) || 0;
        const sizeClass = isSmall ? 'w-10 h-10' : 'w-12 h-12';
        const borderClass = isSmall ? 'border' : 'border-2';
        // A tree with no face yet shows as a seed — planted, waiting to grow.
        const displayImage = seatAttrs(tree.latestGrowthUrl || tree.imageUrl || (tree.id === 'GENESIS_TREE' ? '/mahameru.svg' : '/seed.webp'), DARK_IMAGE_FALLBACK);
        const imgStyle = "width: 100%; height: 100%; object-fit: cover; display: block;";
        const animStyle = `animation-delay: ${delay}ms;`;

        const ariaName = escapeHtml(tree.name || 'lifetree');

        if (isNature) {
            return `
            <div class="marker-pop relative ${sizeClass} hover:scale-110 transition-transform duration-300 group" style="${animStyle}" role="button" aria-label="${ariaName}">
                ${isWateringOverdue(tree) ? '<div class="absolute -inset-1 rounded-full border-2 border-sky-400 animate-pulse z-20"></div>' : ''}
                <div class="absolute inset-0 bg-sky-500 rounded-full animate-pulse opacity-20"></div>
                <div class="relative ${sizeClass} rounded-full ${borderClass} border-white shadow-xl overflow-hidden bg-white z-10">
                    <img ${displayImage} style="${imgStyle}" class="w-full h-full object-cover" />
                </div>
                <div class="absolute -top-1 -right-1 z-20 w-4 h-4 bg-sky-500 border border-white rounded-full flex items-center justify-center text-[8px] text-white font-bold shadow-md">
                    ${guardianCount}
                </div>
                ${isDanger ? `<div class="absolute -top-1 -left-1 z-20 w-3 h-3 bg-red-500 border border-white rounded-full animate-bounce"></div>` : ''}
            </div>`;
        }

        return `
        <div class="marker-pop relative ${sizeClass} hover:scale-110 transition-transform duration-300" style="${animStyle}" role="button" aria-label="${ariaName}">
            ${isWateringOverdue(tree) ? '<div class="absolute -inset-1 rounded-full border-2 border-sky-400 animate-pulse z-20"></div>' : ''}
            <div class="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20"></div>
            <div class="relative ${sizeClass} rounded-full ${borderClass} border-white shadow-xl overflow-hidden bg-white">
                <img ${displayImage} style="${imgStyle}" class="w-full h-full object-cover" />
            </div>
            ${isExplicitlyValidatedTree(tree) ? '<div class="absolute -top-2 -right-2 rounded-full border border-emerald-200 bg-white/95 px-1.5 py-0.5 text-[8px] font-black tracking-[0.2em] text-yellow-400 shadow-sm">V<span class="ml-0.5 text-[6px] font-bold tracking-[0.12em] text-emerald-700">validated</span></div>' : ''}
            ${isDanger ? `<div class="absolute -top-1 -left-1 z-20 w-3 h-3 bg-red-500 border border-white rounded-full animate-bounce"></div>` : ''}
        </div>`;
    }

    const clusterPrimaryOf = (tree: Lifetree) => tree.latestGrowthUrl || tree.imageUrl || (tree.id === 'GENESIS_TREE' ? '/mahameru.svg' : '/seed.webp');
    const clusterImage = (tree: Lifetree) => safeImageUrl(imageVariantUrlOf(clusterPrimaryOf(tree), 480), DARK_IMAGE_FALLBACK);
    const clusterPrimary = (tree: Lifetree) => safeImageUrl(clusterPrimaryOf(tree), DARK_IMAGE_FALLBACK);

    // A cluster of nearby trees as a pie of their images (up to 4 slices, rest in the count badge).
    const getClusterPieHtml = (trees: Lifetree[], clusterId: string) => {
        const shown = trees.slice(0, 4);
        const k = shown.length;
        const size = 64;
        const cx = size / 2, cy = size / 2, r = size / 2 - 2;
        const safe = clusterId.replace(/[^a-zA-Z0-9]/g, '');

        if (k <= 1) {
            return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs><clipPath id="cc${safe}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs><circle cx="${cx}" cy="${cy}" r="${r}" fill="#e2e8f0"/><image href="${clusterImage(shown[0])}" data-primary="${clusterPrimary(shown[0])}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#cc${safe})"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="white" stroke-width="2"/></svg>`;
        }

        let defs = '';
        let body = '';
        for (let i = 0; i < k; i++) {
            const a0 = (i / k) * 2 * Math.PI - Math.PI / 2;
            const a1 = ((i + 1) / k) * 2 * Math.PI - Math.PI / 2;
            const x0 = (cx + r * Math.cos(a0)).toFixed(2), y0 = (cy + r * Math.sin(a0)).toFixed(2);
            const x1 = (cx + r * Math.cos(a1)).toFixed(2), y1 = (cy + r * Math.sin(a1)).toFixed(2);
            const large = (a1 - a0) > Math.PI ? 1 : 0;
            const path = `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
            const id = `s${safe}_${i}`;
            defs += `<clipPath id="${id}"><path d="${path}"/></clipPath>`;
            body += `<image href="${clusterImage(shown[i])}" data-primary="${clusterPrimary(shown[i])}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/><path d="${path}" fill="none" stroke="white" stroke-width="1.5"/>`;
        }
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs>${defs}</defs><circle cx="${cx}" cy="${cy}" r="${r}" fill="#e2e8f0"/>${body}<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="white" stroke-width="2"/></svg>`;
    };

    const createPopupContent = (tree: Lifetree) => {
        const sanct = (tree as MapBeing).__lightHouse;
        if (sanct) return createLightHousePopup(sanct);
        const primaryImage = tree.latestGrowthUrl || tree.imageUrl;
        const displayImage = primaryImage ? seatAttrs(primaryImage) : '';
        const div = document.createElement('div');
        div.innerHTML = `
            <div class="text-center min-w-[160px]">
                ${displayImage ? `<img ${displayImage} style="width:100%;height:120px;object-fit:cover;display:block;" class="rounded-t-lg" />` : ''}
                <div class="p-2">
                    <h3 class="font-bold text-sm text-slate-800 mb-1">${escapeHtml(tree.name)}</h3>
                    <p class="text-xs text-slate-500 line-clamp-2 italic mb-2">"${escapeHtml(tree.body)}"</p>
                    <div class="grid grid-cols-2 gap-2">
                        <button class="view-btn bg-emerald-600 text-white text-xs font-bold px-3 py-2.5 rounded-full w-full">View</button>
                        <button class="reach-btn bg-amber-500 text-white text-xs font-bold px-3 py-2.5 rounded-full w-full">Reach</button>
                    </div>
                </div>
            </div>
        `;
        div.querySelector('.view-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            onView(tree);
        });
        div.querySelector('.reach-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            onReach?.(tree);
        });
        return div;
    }

    const createLightHousePopup = (s: LightHouse) => {
        const div = document.createElement('div');
        div.innerHTML = `
            <div class="text-center min-w-[170px]">
                ${s.imageUrl ? `<img ${seatAttrs(s.imageUrl)} style="width:100%;height:110px;object-fit:cover;display:block;" class="rounded-t-lg" />` : ''}
                <div class="p-2.5">
                    <p class="text-[9px] font-bold uppercase tracking-[0.22em] text-amber-500">Light House</p>
                    <h3 class="font-bold text-sm text-slate-800 mt-0.5">${escapeHtml(s.name)}</h3>
                    ${s.locationName ? `<p class="text-[10px] text-slate-400 mt-0.5">${escapeHtml(s.locationName)}</p>` : ''}
                    ${s.body ? `<p class="text-xs text-slate-500 line-clamp-2 italic mt-1">${escapeHtml(s.body)}</p>` : ''}
                    <div class="mt-2 grid ${s.splatUrl ? 'grid-cols-2' : 'grid-cols-1'} gap-2">
                        <button class="lightHouse-view-btn bg-emerald-600 text-white text-xs font-bold px-3 py-2.5 rounded-full w-full">View</button>
                        ${s.splatUrl ? `<a href="${safeImageUrl(s.splatUrl)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center rounded-full bg-amber-500 px-3 py-2.5 text-xs font-bold text-white">In 3D ✦</a>` : ''}
                    </div>
                </div>
            </div>`;
        div.querySelector('.lightHouse-view-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            onViewLightHouse?.(s);
        });
        return div;
    };

    const updateMarkers = (L: any, force = false) => {
        if (!markersLayer.current || !mapInstance.current) return;

        const CLUSTER_THRESHOLD_PX = 50;
        const clusters: Cluster[] = [];
        const processed = new Set<string>();
        const map = mapInstance.current;
        const nextLayer = L.layerGroup();
        let nextMarkerCount = 0;
        const renderKey = `${map.getZoom?.() || ''}|${treesSignature}|${expansionSignature}|${lightHousesSignature}|${showLightHouses ? 'S' : 's'}|${loading ? 'loading' : 'ready'}`;

        if (!force && renderKey === lastMarkerRenderKeyRef.current) return;
        lastMarkerRenderKeyRef.current = renderKey;

        // One field of beings — but the lighthouses come first: a lightHouse SEEDS its
        // cluster, so wherever trees stand near one, the lightHouse is the face they gather
        // around, and opening it petals the trees out around the lightHouse.
        const sortedTrees = ([...visibleTrees, ...(showLightHouses ? lightHouseBeings : [])] as MapBeing[]).sort((a, b) => {
            const pa = (a as MapBeing).__lightHouse ? 0 : 1;
            const pb = (b as MapBeing).__lightHouse ? 0 : 1;
            return pa - pb || (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0);
        });
        // The expansion stack stores snapshots from click time; a data refresh must not
        // leave the open Seed of Life showing yesterday's images and statuses.
        const liveById = new Map(sortedTrees.map(t => [t.id, t]));

        // Project every tree to pixel space ONCE (the costly step), then cluster on the
        // cached points with squared-distance math — avoids ~n² Leaflet projections + sqrt.
        const points = sortedTrees.map(tree => {
            const coords = getTreeCoordinates(tree);
            if (!coords) return null;
            const p = map.latLngToLayerPoint([coords.lat, coords.lng]);
            return { tree, lat: coords.lat, lng: coords.lng, x: p.x, y: p.y };
        });
        const thresholdSq = CLUSTER_THRESHOLD_PX * CLUSTER_THRESHOLD_PX;

        for (let i = 0; i < points.length; i++) {
            const a = points[i];
            if (!a || processed.has(a.tree.id)) continue;
            const cluster: Cluster = { id: a.tree.id, center: a.tree, children: [], lat: a.lat, lng: a.lng };
            processed.add(a.tree.id);

            for (let j = i + 1; j < points.length; j++) {
                const b = points[j];
                if (!b || processed.has(b.tree.id)) continue;
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                if (dx * dx + dy * dy < thresholdSq) {
                    cluster.children.push(b.tree);
                    processed.add(b.tree.id);
                }
            }

            clusters.push(cluster);
        }

        // Determine active expansion state
        const topLevel = expansionStack.length > 0 ? expansionStack[expansionStack.length - 1] : null;
        const activeClusterId = expansionStack.length > 0 ? expansionStack[0].clusterId : null;

        clusters.forEach(cluster => {
            const count = 1 + cluster.children.length;

            if (count === 1) {
                // SINGLE TREE
                const icon = L.divIcon({
                    html: getHtmlForTree(cluster.center),
                    className: '',
                    iconSize: [48, 48],
                    iconAnchor: [24, 24],
                    popupAnchor: [0, -24]
                });
                L.marker([cluster.lat, cluster.lng], { icon })
                 .addTo(nextLayer)
                 .bindPopup(() => createPopupContent(cluster.center), POPUP_OPTIONS);
                nextMarkerCount += 1;

            } else if (cluster.id === activeClusterId && topLevel) {
                // EXPANDED — Seed of Life using current top-of-stack level
                // Deeper stack levels get higher z-index so they render on top
                const stackDepth = expansionStack.length;
                const depthZOffset = stackDepth * 1000;

                const levelTrees = topLevel.trees.map(t => liveById.get(t.id) || t);
                const centerTree = levelTrees[0];
                const children = levelTrees.slice(1);
                const hasMore = children.length > 6;
                // If overflow exists, reserve slot 5 (index 5) for the sub-cluster node
                const visibleChildren = hasMore ? children.slice(0, 5) : children;
                const remainingTrees = hasMore ? children.slice(5) : [];

                const centerPoint = map.latLngToLayerPoint([topLevel.lat, topLevel.lng]);

                // Sun-to-emerald vignette circle behind the expansion
                const vignetteSize = 180;
                const vignetteHtml = `<div style="width:${vignetteSize}px;height:${vignetteSize}px;border-radius:50%;background:radial-gradient(circle, rgba(253,224,71,0.5) 0%, rgba(167,243,208,0.3) 35%, rgba(110,231,183,0.15) 60%, transparent 80%);pointer-events:none;"></div>`;
                const vignetteIcon = L.divIcon({
                    html: vignetteHtml,
                    className: '',
                    iconSize: [vignetteSize, vignetteSize],
                    iconAnchor: [vignetteSize / 2, vignetteSize / 2]
                });
                L.marker([topLevel.lat, topLevel.lng], { icon: vignetteIcon, interactive: false, zIndexOffset: depthZOffset - 500 })
                 .addTo(nextLayer);
                nextMarkerCount += 1;

                // X button — positioned above the center
                const xPoint = map.layerPointToLatLng(L.point(centerPoint.x, centerPoint.y - 72));
                const isDeep = expansionStack.length > 1;
                const xHtml = `
                <div class="marker-pop flex items-center justify-center w-10 h-10 rounded-full border-2 border-white shadow-lg cursor-pointer hover:scale-110 transition-transform"
                     style="background:${isDeep ? '#f59e0b' : '#ef4444'};animation-delay:0ms;" role="button" aria-label="Close">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" style="width:14px;height:14px;">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </div>`;
                const xIcon = L.divIcon({ html: xHtml, className: '', iconSize: [40, 40], iconAnchor: [20, 20] });
                const xMarker = L.marker(xPoint, { icon: xIcon, zIndexOffset: depthZOffset + 500 });
                xMarker.on('click', (e: any) => {
                    L.DomEvent.stopPropagation(e);
                    setExpansionStack(prev => prev.slice(0, -1));
                });
                xMarker.addTo(nextLayer);
                nextMarkerCount += 1;

                // Center tree
                const centerIcon = L.divIcon({
                    html: getHtmlForTree(centerTree, false, 0),
                    className: '',
                    iconSize: [48, 48],
                    iconAnchor: [24, 24]
                });
                L.marker([topLevel.lat, topLevel.lng], { icon: centerIcon, zIndexOffset: depthZOffset })
                 .addTo(nextLayer)
                 .bindPopup(() => createPopupContent(centerTree), POPUP_OPTIONS);
                nextMarkerCount += 1;

                // Petals
                visibleChildren.forEach((child, index) => {
                    const angle = (index * 60) * (Math.PI / 180);
                    const radius = 45;
                    const childPoint = L.point(
                        centerPoint.x + radius * Math.cos(angle),
                        centerPoint.y + radius * Math.sin(angle)
                    );
                    const childLatLng = map.layerPointToLatLng(childPoint);

                    L.polyline([[topLevel.lat, topLevel.lng], childLatLng], {
                        color: 'white', weight: 1, opacity: 0.3
                    }).addTo(nextLayer);

                    const childIcon = L.divIcon({
                        html: getHtmlForTree(child, true, (index + 1) * 50),
                        className: '',
                        iconSize: [40, 40],
                        iconAnchor: [20, 20],
                        popupAnchor: [0, -20]
                    });
                    L.marker(childLatLng, { icon: childIcon, zIndexOffset: depthZOffset })
                     .addTo(nextLayer)
                     .bindPopup(() => createPopupContent(child), POPUP_OPTIONS);
                    nextMarkerCount += 1;
                });

                // Sub-cluster node at slot 5 if there are more trees
                if (hasMore) {
                    const angle = (5 * 60) * (Math.PI / 180);
                    const radius = 45;
                    const morePoint = L.point(
                        centerPoint.x + radius * Math.cos(angle),
                        centerPoint.y + radius * Math.sin(angle)
                    );
                    const moreLatLng = map.layerPointToLatLng(morePoint);
                    const moreDanger = remainingTrees.some(t => t.status === 'DANGER');

                    L.polyline([[topLevel.lat, topLevel.lng], moreLatLng], {
                        color: 'white', weight: 1, opacity: 0.3
                    }).addTo(nextLayer);

                    const moreHtml = `
                    <div class="marker-pop relative w-10 h-10 cursor-pointer hover:scale-110 transition-transform duration-300" style="animation-delay:${6 * 50}ms;" role="button" aria-label="${remainingTrees.length} more lifetrees">
                        <div class="absolute inset-0 drop-shadow-lg">
                            <img src="/logo.svg" alt="" style="width:100%;height:100%;display:block;" />
                        </div>
                        <div class="absolute -top-1 -right-1 w-5 h-5 bg-emerald-600 border-2 border-white text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow z-20">
                            ${remainingTrees.length}
                        </div>
                        ${moreDanger ? `<div class="absolute -top-1 -left-1 w-3 h-3 bg-red-500 border border-white rounded-full animate-bounce z-20"></div>` : ''}
                    </div>`;

                    const moreIcon = L.divIcon({ html: moreHtml, className: '', iconSize: [40, 40], iconAnchor: [20, 20] });
                    const moreMarker = L.marker(moreLatLng, { icon: moreIcon, zIndexOffset: depthZOffset });
                    moreMarker.on('click', (e: any) => {
                        L.DomEvent.stopPropagation(e);
                        // Push new level: remaining trees become the next center + petals.
                        // Guarded: a zoom/background-click can empty the stack while this
                        // marker is still on screen — clicking it then must be a no-op.
                        setExpansionStack(prev => prev.length === 0 ? prev : [...prev, {
                            clusterId: prev[0].clusterId,
                            trees: remainingTrees,
                            lat: topLevel.lat,
                            lng: topLevel.lng
                        }]);
                    });
                    moreMarker.addTo(nextLayer);
                    nextMarkerCount += 1;
                }

            } else if ((cluster.center as MapBeing).__lightHouse) {
                // COLLAPSED CLUSTER AROUND A LIGHTHOUSE — the lightHouse is the face; the
                // count badge tells how many beings gather in its light.
                const clusterTrees = [cluster.center, ...cluster.children];
                const hasDanger = clusterTrees.some(t => t.status === 'DANGER');
                const html = `
                <div class="relative w-12 h-12 group cursor-pointer transition-transform duration-300 hover:scale-125" style="transform-origin:center;" role="button" aria-label="${escapeHtml(cluster.center.name || 'Light House')}, ${count} beings">
                    ${getHtmlForTree(cluster.center)}
                    <div class="absolute -top-1.5 -right-1.5 w-6 h-6 bg-amber-500 border-2 border-white text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md z-20">
                        ${count}
                    </div>
                    ${hasDanger ? `<div class="absolute -top-1 -left-1 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full animate-bounce z-20"></div>` : ''}
                </div>`;

                const icon = L.divIcon({ html, className: '', iconSize: [48, 48], iconAnchor: [24, 24] });
                const marker = L.marker([cluster.lat, cluster.lng], { icon });
                marker.on('click', (e: any) => {
                    L.DomEvent.stopPropagation(e);
                    map.setView([cluster.lat, cluster.lng], map.getZoom(), { animate: true });
                    // The circle view: trees petal out AROUND the lightHouse at the center.
                    setExpansionStack([{
                        clusterId: cluster.id,
                        trees: [cluster.center, ...cluster.children],
                        lat: cluster.lat,
                        lng: cluster.lng
                    }]);
                });
                marker.addTo(nextLayer);
                nextMarkerCount += 1;

            } else {
                // COLLAPSED CLUSTER — pie of the member trees' images; grows on hover.
                const clusterTrees = [cluster.center, ...cluster.children];
                const hasDanger = clusterTrees.some(t => t.status === 'DANGER');
                const html = `
                <div class="relative w-16 h-16 group cursor-pointer transition-transform duration-300 hover:scale-150 hover:z-[400]" style="transform-origin:center;" role="button" aria-label="${count} lifetrees here">
                    <div class="absolute inset-0 drop-shadow-xl">
                        ${getClusterPieHtml(clusterTrees, cluster.id)}
                    </div>
                    <div class="absolute -top-1 -right-1 w-6 h-6 bg-emerald-600 border-2 border-white text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md z-20">
                        ${count}
                    </div>
                    ${hasDanger ? `<div class="absolute -top-1 -left-1 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full animate-bounce z-20"></div>` : ''}
                </div>`;

                const icon = L.divIcon({ html, className: '', iconSize: [64, 64], iconAnchor: [32, 32] });
                const marker = L.marker([cluster.lat, cluster.lng], { icon });
                marker.on('click', (e: any) => {
                    L.DomEvent.stopPropagation(e);
                    map.setView([cluster.lat, cluster.lng], map.getZoom(), { animate: true });
                    // Push first level: all trees in this cluster
                    setExpansionStack([{
                        clusterId: cluster.id,
                        trees: [cluster.center, ...cluster.children],
                        lat: cluster.lat,
                        lng: cluster.lng
                    }]);
                });
                marker.addTo(nextLayer);
                nextMarkerCount += 1;
            }
        });

        if (nextMarkerCount > 0 || visibleTreeCount === 0) {
            map.removeLayer(markersLayer.current);
            markersLayer.current = nextLayer.addTo(map);
            setMarkerCount(prev => prev === nextMarkerCount ? prev : nextMarkerCount);
        } else {
            setMarkerCount(prev => prev === 0 ? prev : 0);
        }
    }

    // Keep the ref pointing at the latest closure. Assigned post-commit (every render);
    // all readers are effects / timeouts / leaflet handlers, which also run post-commit.
    useEffect(() => {
        updateMarkersRef.current = updateMarkers;
    });

    useEffect(() => {
        return () => {
            containerObserverRef.current?.disconnect();
            containerObserverRef.current = null;
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, []);

    return (
        <>
            <style>{`
                @keyframes pop-in {
                    0% { transform: scale(0); opacity: 0; }
                    70% { transform: scale(1.1); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .marker-pop {
                    animation: pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                    opacity: 0;
                }
                @keyframes lightHouse-breathe {
                    0%, 100% { opacity: 0.55; transform: scale(1); }
                    50% { opacity: 0.95; transform: scale(1.12); }
                }
                .lightHouse-glow {
                    background: radial-gradient(circle, rgba(253,224,71,0.55) 0%, rgba(252,211,77,0.25) 55%, transparent 78%);
                    animation: lightHouse-breathe 3.2s ease-in-out infinite;
                    pointer-events: none;
                }
                /* The living breath: markers pulse a few times after appearing, then rest —
                   an always-on compositor loop per marker drains phone batteries. The danger
                   dot keeps bouncing: it is a call for help. */
                .marker-pop .animate-ping { animation-iteration-count: 6; }
                .marker-pop .animate-pulse { animation-iteration-count: 8; }
                @media (prefers-reduced-motion: reduce) {
                    .marker-pop { animation: none; opacity: 1; }
                    .marker-pop .animate-ping,
                    .marker-pop .animate-pulse,
                    .marker-pop .animate-bounce { animation: none; }
                    .lightHouse-glow { animation: none; opacity: 0.7; }
                }
            `}</style>
            <div className="relative">
                <div ref={mapContainer} style={{ width: '100%', height: mapHeight, minHeight: '480px', zIndex: 1 }} className="w-full rounded-xl shadow-inner border border-slate-700 bg-slate-900">
                    {filtersOverlay && (
                        /* 650: above Leaflet's map pane (400) and markers (600), below popups
                           (700) — so the filters float on the map yet popups open above them. */
                        <div ref={overlayRef} className="absolute left-3 top-3 max-w-[calc(100%-1.5rem)]" style={{ zIndex: 650 }}>
                            {filtersOverlay}
                        </div>
                    )}
                </div>
                {onRefresh && (
                    <button
                        onClick={() => {
                            // Re-frame the primary lifetree (the default 100 km view), then reload the forest.
                            const L = leafletRef.current;
                            const coords = primaryTree ? getTreeCoordinates(primaryTree) : null;
                            if (L && mapInstance.current && coords) {
                                mapInstance.current.fitBounds(L.latLng(coords.lat, coords.lng).toBounds(200000), { animate: true });
                            }
                            onRefresh();
                        }}
                        disabled={loading}
                        title="Refresh forest"
                        aria-label="Refresh forest"
                        className="absolute top-3 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-lg ring-1 ring-slate-200 transition-all hover:bg-white hover:text-emerald-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Icons.Refresh />
                    </button>
                )}
                {(loading || (isMapReady && visibleTreeCount > 0 && markerCount === 0)) && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-slate-950/30 backdrop-blur-[2px]">
                        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/90 px-6 py-5 shadow-lg">
                            <Loading />
                            <span className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">{loading ? 'Loading Forest' : 'Rendering Trees'}</span>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};
