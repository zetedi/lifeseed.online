
import React, { useRef, useEffect } from 'react';
import { type Lifetree } from '../types';

export const ForestMap = ({ trees }: { trees: Lifetree[] }) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);
    const markersLayer = useRef<any>(null);

    useEffect(() => {
        if (!mapContainer.current) return;
        const L = (window as any).L;
        if (!L) return;

        // Initialize Map
        if (!mapInstance.current) {
            mapInstance.current = L.map(mapContainer.current, {
                zoomControl: false,
                attributionControl: false
            }).setView([20, 0], 2);
            
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap & CartoDB',
                subdomains: 'abcd',
                maxZoom: 19
            }).addTo(mapInstance.current);

            // Add zoom control to bottom right
            L.control.zoom({ position: 'bottomright' }).addTo(mapInstance.current);

            markersLayer.current = L.layerGroup().addTo(mapInstance.current);
            
            // Force a resize check after mount to prevent gray tiles
            setTimeout(() => {
                mapInstance.current?.invalidateSize();
            }, 100);
        }

        // Update Markers
        if (markersLayer.current) {
            markersLayer.current.clearLayers();
            
            const bounds = L.latLngBounds([]);
            let hasMarkers = false;

            trees.forEach(tree => {
                if (tree.latitude && tree.longitude) {
                    hasMarkers = true;
                    bounds.extend([tree.latitude, tree.longitude]);
                    
                    const iconHtml = `
                        <div class="relative w-12 h-12 hover:scale-110 transition-transform duration-300">
                            <div class="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20"></div>
                            <div class="relative w-12 h-12 rounded-full border-2 border-white shadow-xl overflow-hidden bg-white">
                                <img src="${tree.imageUrl || 'https://via.placeholder.com/150'}" class="w-full h-full object-cover" />
                            </div>
                            ${tree.validated ? '<div class="absolute -top-1 -right-1 bg-emerald-500 border border-white w-4 h-4 rounded-full flex items-center justify-center"><div class="w-2 h-2 bg-white rounded-full"></div></div>' : ''}
                        </div>
                    `;
                    
                    const customIcon = L.divIcon({
                        html: iconHtml,
                        className: '',
                        iconSize: [48, 48],
                        iconAnchor: [24, 24],
                        popupAnchor: [0, -24]
                    });

                    L.marker([tree.latitude, tree.longitude], { icon: customIcon })
                        .addTo(markersLayer.current)
                        .bindPopup(`
                            <div class="text-center p-2 min-w-[150px]">
                                <h3 class="font-bold text-lg text-slate-800 mb-1">${tree.name}</h3>
                                <p class="text-xs text-slate-500 line-clamp-2 italic mb-2">"${tree.body}"</p>
                                <div class="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full inline-block">Block: ${tree.blockHeight || 0}</div>
                            </div>
                        `);
                }
            });

            // Auto-fit bounds if we have trees
            if (hasMarkers && mapInstance.current) {
                mapInstance.current.fitBounds(bounds, { 
                    padding: [50, 50], 
                    maxZoom: 14,
                    animate: true 
                });
            }
        }

        // Cleanup on unmount
        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
                markersLayer.current = null;
            }
        };
    }, [trees]); // Re-run if tree data changes

    return <div ref={mapContainer} className="w-full h-[600px] rounded-xl shadow-inner border border-slate-200 z-0 bg-slate-100" />;
};
