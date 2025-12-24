
import React, { useRef, useEffect, useState } from 'react';
import { type Lifetree } from '../types';

interface Cluster {
    id: string; // ID of the center tree
    center: Lifetree;
    children: Lifetree[];
    lat: number;
    lng: number;
}

export const ForestMap = ({ trees, onView }: { trees: Lifetree[], onView: (tree: Lifetree) => void }) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);
    const markersLayer = useRef<any>(null);
    
    // State to track expanded clusters and their pagination page
    const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);
    const [clusterPage, setClusterPage] = useState<number>(0);

    // Lightseed Logo SVG String for Cluster Icon
    const logoSvg = `
    <svg width="100%" height="100%" viewBox="0 0 262 262" xmlns="http://www.w3.org/2000/svg">
        <defs><clipPath id="c"><circle cx="131" cy="131" r="131" /></clipPath></defs>
        <g>
            <circle cx="131" cy="131" r="131" fill="white" stroke="#334155" stroke-width="7" clip-path="url(#c)" />
            <circle cx="-35.28" cy="-29" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="-35.28" cy="35" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="-35.28" cy="99" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="-35.28" cy="163" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="-35.28" cy="227" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="-35.28" cy="291" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="20.15" cy="3" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="20.15" cy="67" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="20.15" cy="131" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="20.15" cy="195" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="20.15" cy="259" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="75.57" cy="-29" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="75.57" cy="35" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="75.57" cy="99" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="75.57" cy="163" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="75.57" cy="227" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="75.57" cy="291" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="131" cy="3" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="131" cy="67" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="131" cy="131" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="131" cy="195" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="131" cy="259" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="186.43" cy="-29" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="186.43" cy="35" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="186.43" cy="99" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="186.43" cy="163" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="186.43" cy="227" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="186.43" cy="291" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="241.85" cy="3" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="241.85" cy="67" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="241.85" cy="131" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="241.85" cy="195" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="241.85" cy="259" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="297.28" cy="-29" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="297.28" cy="35" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="297.28" cy="99" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="297.28" cy="163" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="297.28" cy="227" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="297.28" cy="291" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="75.57" cy="99" r="16" fill="white" stroke="#334155" stroke-width="3" clip-path="url(#c)" />
            <circle cx="75.57" cy="163" r="16" fill="white" stroke="#334155" stroke-width="3" clip-path="url(#c)" />
            <circle cx="131" cy="67" r="16" fill="white" stroke="#334155" stroke-width="3" clip-path="url(#c)" />
            <circle cx="131" cy="131" r="16" fill="white" stroke="#334155" stroke-width="3" clip-path="url(#c)" />
            <circle cx="131" cy="195" r="16" fill="white" stroke="#334155" stroke-width="3" clip-path="url(#c)" />
            <circle cx="186.43" cy="99" r="16" fill="white" stroke="#334155" stroke-width="3" clip-path="url(#c)" />
            <circle cx="186.43" cy="163" r="16" fill="white" stroke="#334155" stroke-width="3" clip-path="url(#c)" />
        </g>
    </svg>`;

    useEffect(() => {
        const checkLeaflet = setInterval(() => {
            const L = (window as any).L;
            if (L && mapContainer.current) {
                clearInterval(checkLeaflet);
                initMap(L);
            }
        }, 100);
        return () => clearInterval(checkLeaflet);
    }, []);

    const initMap = (L: any) => {
        if (!mapContainer.current || mapInstance.current) return;

        mapInstance.current = L.map(mapContainer.current, {
            zoomControl: false,
            attributionControl: false
        }).setView([20, 0], 2);
        
        // Use Esri World Imagery for Globe/Earth look
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
            maxZoom: 19
        }).addTo(mapInstance.current);

        L.control.zoom({ position: 'bottomright' }).addTo(mapInstance.current);
        markersLayer.current = L.layerGroup().addTo(mapInstance.current);
        
        mapInstance.current.on('zoomend', () => {
            setExpandedClusterId(null); // Close clusters on zoom
            updateMarkers(L);
        });

        // Click on map background closes cluster
        mapInstance.current.on('click', () => {
            setExpandedClusterId(null);
        });

        setTimeout(() => {
            mapInstance.current?.invalidateSize();
            updateMarkers(L);
        }, 250);
    }

    // Re-render markers when trees change or expansion state changes
    useEffect(() => {
        const L = (window as any).L;
        if (L && mapInstance.current) {
            updateMarkers(L);
        }
    }, [trees, expandedClusterId, clusterPage]);

    const getHtmlForTree = (tree: Lifetree, isSmall = false, delay = 0) => {
        const isNature = tree.isNature;
        const isDanger = tree.status === 'DANGER';
        const guardianCount = tree.guardians ? tree.guardians.length : 0;
        const sizeClass = isSmall ? 'w-10 h-10' : 'w-12 h-12';
        const borderClass = isSmall ? 'border' : 'border-2';
        
        // Prioritize latestGrowthUrl over standard imageUrl
        const displayImage = tree.latestGrowthUrl || tree.imageUrl || 'https://via.placeholder.com/150';
        
        // Force image fill
        const imgStyle = "width: 100%; height: 100%; object-fit: cover; display: block;";
        const animStyle = `animation-delay: ${delay}ms;`;

        if (isNature) {
            return `
            <div class="marker-pop relative ${sizeClass} hover:scale-110 transition-transform duration-300 group" style="${animStyle}">
                <div class="absolute inset-0 bg-sky-500 rounded-full animate-pulse opacity-20"></div>
                <div class="relative ${sizeClass} rounded-full ${borderClass} border-white shadow-xl overflow-hidden bg-white z-10">
                    <img src="${displayImage}" style="${imgStyle}" class="w-full h-full object-cover" />
                </div>
                <div class="absolute -top-1 -right-1 z-20 w-4 h-4 bg-sky-500 border border-white rounded-full flex items-center justify-center text-[8px] text-white font-bold shadow-md">
                    ${guardianCount}
                </div>
                ${isDanger ? `<div class="absolute -top-1 -left-1 z-20 w-3 h-3 bg-red-500 border border-white rounded-full animate-bounce"></div>` : ''}
            </div>`;
        }
        
        return `
        <div class="marker-pop relative ${sizeClass} hover:scale-110 transition-transform duration-300" style="${animStyle}">
            <div class="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20"></div>
            <div class="relative ${sizeClass} rounded-full ${borderClass} border-white shadow-xl overflow-hidden bg-white">
                <img src="${displayImage}" style="${imgStyle}" class="w-full h-full object-cover" />
            </div>
            ${tree.validated ? '<div class="absolute -top-1 -right-1 bg-emerald-500 border border-white w-3 h-3 rounded-full"></div>' : ''}
        </div>`;
    }

    const createPopupContent = (tree: Lifetree) => {
        const div = document.createElement('div');
        div.innerHTML = `
            <div class="text-center p-2 min-w-[150px]">
                <h3 class="font-bold text-lg text-slate-800 mb-1">${tree.name}</h3>
                <p class="text-xs text-slate-500 line-clamp-2 italic mb-2">"${tree.body}"</p>
                <button class="view-btn mt-2 bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-full w-full">View Tree</button>
            </div>
        `;
        div.querySelector('.view-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            onView(tree);
        });
        return div;
    }

    const updateMarkers = (L: any) => {
        if (!markersLayer.current || !mapInstance.current) return;
        markersLayer.current.clearLayers();

        // 1. Cluster Logic
        // We use pixels to determine clustering based on current zoom
        // Modified threshold to 50px so clustering only happens when markers (approx 48px)
        // physically touch or overlap, preventing premature clustering.
        const CLUSTER_THRESHOLD_PX = 50; 
        const clusters: Cluster[] = [];
        const processed = new Set<string>();
        const map = mapInstance.current;

        // Sort trees by age (Oldest first) to ensure the oldest is the "Seed" of the cluster
        const sortedTrees = [...trees].sort((a, b) => 
            (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
        );

        sortedTrees.forEach(tree => {
            if (processed.has(tree.id)) return;
            if (!tree.latitude || !tree.longitude) return;

            const treePoint = map.latLngToLayerPoint([tree.latitude, tree.longitude]);
            const cluster: Cluster = {
                id: tree.id,
                center: tree,
                children: [],
                lat: tree.latitude,
                lng: tree.longitude
            };
            processed.add(tree.id);

            // Find neighbors
            sortedTrees.forEach(other => {
                if (processed.has(other.id)) return;
                if (!other.latitude || !other.longitude) return;

                const otherPoint = map.latLngToLayerPoint([other.latitude, other.longitude]);
                if (treePoint.distanceTo(otherPoint) < CLUSTER_THRESHOLD_PX) {
                    cluster.children.push(other);
                    processed.add(other.id);
                }
            });

            clusters.push(cluster);
        });

        // 2. Render Clusters/Markers
        clusters.forEach(cluster => {
            const isExpanded = expandedClusterId === cluster.id;
            const count = 1 + cluster.children.length; // Center + Children

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
                 .addTo(markersLayer.current)
                 .bindPopup(createPopupContent(cluster.center));
            } else {
                // CLUSTER
                if (isExpanded) {
                    // --- SEED OF LIFE EXPANSION ---
                    
                    // 1. Render Center (Oldest) - Animate it too
                    const centerIcon = L.divIcon({
                        html: getHtmlForTree(cluster.center, false, 0),
                        className: 'z-[1000]', // Ensure center is on top
                        iconSize: [48, 48],
                        iconAnchor: [24, 24]
                    });
                    
                    const centerMarker = L.marker([cluster.lat, cluster.lng], { icon: centerIcon })
                        .addTo(markersLayer.current);
                    
                    centerMarker.bindPopup(createPopupContent(cluster.center));

                    // 2. Render Petals (Paged)
                    const ITEMS_PER_PAGE = 6;
                    const totalChildren = cluster.children.length;
                    
                    const showNextButton = totalChildren > (clusterPage + 1) * ITEMS_PER_PAGE;
                    const renderCount = showNextButton ? 5 : 6;
                    
                    const startIdx = clusterPage * ITEMS_PER_PAGE;
                    const visibleChildren = cluster.children.slice(startIdx, startIdx + renderCount);

                    visibleChildren.forEach((child, index) => {
                        // Calculate position in circle (Seed of Life pattern)
                        // To make them "touch" or "kiss":
                        // Center Radius (24px) + Child Radius (20px) + Gap (1px) = 45px Radius
                        const angle = (index * 60) * (Math.PI / 180); 
                        const radius = 45; 
                        
                        const centerPoint = map.latLngToLayerPoint([cluster.lat, cluster.lng]);
                        const childPoint = L.point(
                            centerPoint.x + radius * Math.cos(angle),
                            centerPoint.y + radius * Math.sin(angle)
                        );
                        const childLatLng = map.layerPointToLatLng(childPoint);

                        // Draw Stem Line (Optional, keeping it subtle as per previous structure)
                        // Using white/opacity to be visible on dark satellite map
                        L.polyline([[cluster.lat, cluster.lng], childLatLng], {
                            color: 'white',
                            weight: 1,
                            opacity: 0.3
                        }).addTo(markersLayer.current);

                        const childIcon = L.divIcon({
                            // Add delay based on index for bloom effect
                            html: getHtmlForTree(child, true, (index + 1) * 50), // Small version (40px)
                            className: '',
                            iconSize: [40, 40],
                            iconAnchor: [20, 20],
                            popupAnchor: [0, -20]
                        });

                        L.marker(childLatLng, { icon: childIcon })
                         .addTo(markersLayer.current)
                         .bindPopup(createPopupContent(child));
                    });

                    // Render "More" Button if needed (at the 6th position usually)
                    if (showNextButton || clusterPage > 0) {
                        // Position at 300 degrees (bottom rightish) or where the 6th item would be
                        const nextIndex = 5; 
                        const angle = (nextIndex * 60) * (Math.PI / 180);
                        const radius = 45;
                        const centerPoint = map.latLngToLayerPoint([cluster.lat, cluster.lng]);
                        const btnPoint = L.point(
                            centerPoint.x + radius * Math.cos(angle),
                            centerPoint.y + radius * Math.sin(angle)
                        );
                        const btnLatLng = map.layerPointToLatLng(btnPoint);

                        const btnHtml = `
                        <div class="marker-pop w-10 h-10 rounded-full bg-amber-500 border-2 border-white shadow-lg flex items-center justify-center text-white cursor-pointer hover:bg-amber-600 transition-colors" style="animation-delay: 300ms;">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                        </div>`;

                        const btnIcon = L.divIcon({
                            html: btnHtml,
                            className: '',
                            iconSize: [40, 40],
                            iconAnchor: [20, 20]
                        });

                        const btnMarker = L.marker(btnLatLng, { icon: btnIcon }).addTo(markersLayer.current);
                        btnMarker.on('click', (e: any) => {
                            L.DomEvent.stopPropagation(e);
                            if (showNextButton) {
                                setClusterPage(p => p + 1);
                            } else {
                                setClusterPage(0); // Reset to start
                            }
                        });
                    }

                } else {
                    // --- COLLAPSED CLUSTER (Logo) ---
                    // Using w-20 h-20 (80px) container to show the SVG clearly
                    // SVG is set to fill width/height
                    const html = `
                    <div class="relative w-16 h-16 group cursor-pointer hover:scale-110 transition-transform duration-300">
                        <div class="absolute inset-0 drop-shadow-xl">
                            ${logoSvg}
                        </div>
                        <div class="absolute top-0 right-0 w-6 h-6 bg-emerald-600 border-2 border-white text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md z-20">
                            ${count}
                        </div>
                    </div>
                    `;

                    const icon = L.divIcon({
                        html: html,
                        className: '',
                        iconSize: [64, 64],
                        iconAnchor: [32, 32]
                    });

                    const marker = L.marker([cluster.lat, cluster.lng], { icon });
                    marker.on('click', (e: any) => {
                        L.DomEvent.stopPropagation(e);
                        // Center map on cluster slightly to give space for expansion
                        map.setView([cluster.lat, cluster.lng], map.getZoom(), { animate: true });
                        setExpandedClusterId(cluster.id);
                        setClusterPage(0);
                    });
                    marker.addTo(markersLayer.current);
                }
            }
        });
    }

    useEffect(() => {
        return () => {
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
            `}</style>
            <div ref={mapContainer} style={{ width: '100%', height: '60vh', minHeight: '400px', zIndex: 1 }} className="w-full rounded-xl shadow-inner border border-slate-700 bg-slate-900" />
        </>
    );
};
