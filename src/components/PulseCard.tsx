
import React from 'react';
import { CardCarousel } from './ui/CardCarousel';
import { type Pulse, type Lightseed } from '../types';
import { Icons } from './ui/Icons';
import { useLanguage } from '../contexts/LanguageContext';
import { LoveButton } from './ui/LoveButton';
import { formatLight } from '../domain/light';
import { tabTone } from '../utils/tabTheme';
import type { ListDensity } from '../hooks/useListDensity';

import { Picture } from './ui/Picture';
interface PulseCardProps {
    pulse: Pulse;
    lightseed: Lightseed | null;
    onMatch: (p: Pulse) => void;
    onView?: (p: Pulse) => void;
    density?: ListDensity;
}

// The lift every card shares: a stronger pop on hover, and the same pop when tapped-and-held on
// mobile (`active:`). Imageless cards carry only their words — no placeholder artwork.
const POP = 'hover:shadow-xl hover:-translate-y-1 active:shadow-xl active:-translate-y-1 transition-all duration-300';

export const PulseCard = ({ pulse, lightseed, onMatch, onView, density = 'cards' }: PulseCardProps) => {
    const { t } = useLanguage();
    const images = pulse.imageUrls?.length ? pulse.imageUrls : (pulse.imageUrl ? [pulse.imageUrl] : []);
    const isOffering = pulse.type === 'offering';
    const appreciationLight = pulse.offeringAppreciationLight;
    const badge = pulse.type === 'event' ? 'EVENT' : pulse.type === 'tree_growth' ? 'GROWTH' : isOffering ? (pulse.offeringKind === 'bed' ? 'BED' : 'OFFERING') : '';
    const isEvent = pulse.type === 'event';
    const meta = isEvent && pulse.eventDate ? `${new Date(pulse.eventDate).toLocaleDateString()} · ${pulse.eventLocation || pulse.body}` : pulse.body;

    // The shared heart on this pulse (routed to lovePulse for pulses), sized per density below.
    const love = (countClassName: string, className = 'text-slate-400') => (
        <LoveButton collection="pulses" id={pulse.id} initialCount={pulse.loveCount || 0} showZero iconClassName="" className={className} countClassName={countClassName} />
    );

    const handleMatchClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent opening detail view
        onMatch(pulse);
    }

    const ringCls = pulse.care === 'watering' ? 'ring-2 ring-sky-500 ring-opacity-30' : pulse.type === 'tree_growth' ? 'ring-2 ring-emerald-500 ring-opacity-20' : isEvent ? 'ring-2 ring-sky-500 ring-opacity-20' : '';

    // The pulse's badges — shown over the image, or inline on text-only cards.
    const badges = (
        <>
            {pulse.care === 'watering'
                ? <span title={pulse.wateringConfirmation?.note || ''} className="bg-sky-100 text-sky-700 text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm">💧{typeof pulse.wateringConfirmation?.confidence === 'number' ? ` ${pulse.wateringConfirmation.confidence}%` : ''}{pulse.wateringConfirmedBy === 'guardian' ? ' ✓' : ''}</span>
                : badge && <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm ${isEvent ? 'bg-sky-100 text-sky-700' : isOffering ? 'text-white' : 'bg-emerald-100 text-emerald-600'}`} style={isOffering ? { backgroundColor: tabTone('offerings') } : undefined}>{badge}</span>}
            {/* A paused offering (visible only to its author) says so plainly. */}
            {isOffering && pulse.offeringActive === false && (
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-bold text-slate-600 shadow-sm">PAUSED</span>
            )}
            {/* Suggested appreciation after the contribution — never its admission price. */}
            {isOffering && !!appreciationLight && (
                <span title="Suggested appreciation after receiving this offering" className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black text-amber-950 shadow-sm">
                    <span className="[&>svg]:h-2.5 [&>svg]:w-2.5"><Icons.Sun /></span> {formatLight(appreciationLight)}
                </span>
            )}
            {images.length > 1 && <span className="bg-white/90 text-slate-600 text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm">{images.length} IMG</span>}
            {pulse.isMatch && <span className="bg-sky-100 text-sky-600 text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm">MATCH</span>}
        </>
    );

    // A small square avatar: the first image, or the initial on a soft tone (never fake artwork).
    const avatar = (size: string, text: string) => images.length > 0
        ? <Picture size={480} src={images[0]} alt="" className={`${size} shrink-0 rounded-lg object-cover bg-slate-100`} />
        : <div className={`${size} flex shrink-0 items-center justify-center rounded-lg ${text} ${isEvent ? 'bg-sky-50 text-sky-600' : 'bg-emerald-50 text-emerald-600'}`}>{(pulse.title || '·').charAt(0).toUpperCase()}</div>;

    // ROWS — one line of the list: avatar, title + description, love at the right.
    if (density === 'rows') {
        return (
            <div onClick={() => onView && onView(pulse)} className={`flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm ${POP} hover:-translate-y-0.5 active:-translate-y-0.5 ${ringCls}`}>
                {avatar('h-14 w-14', 'text-xl')}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <h3 dir="auto" className="truncate text-sm font-semibold text-slate-800">{pulse.title}</h3>
                        {pulse.carriedByName && <p className="truncate text-[10px] italic text-purple-500">🤲 {t('carried_by').replace('{name}', pulse.carriedByName)}</p>}
                        {badges}
                    </div>
                    <p dir="auto" className="mt-0.5 line-clamp-2 text-xs font-light leading-relaxed text-slate-500">{meta}</p>
                </div>
                {love('text-xs', 'shrink-0 text-slate-400')}
            </div>
        );
    }

    // MINI — a half-size card: small image (or initial), title, love.
    if (density === 'mini') {
        return (
            <div onClick={() => onView && onView(pulse)} className={`cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${POP} ${ringCls}`}>
                {images.length > 0 ? (
                    <div className="relative h-20 overflow-hidden bg-slate-100">
                        <CardCarousel images={images} alt={pulse.title} />
                    </div>
                ) : (
                    <div className={`flex h-20 items-center justify-center px-2 text-center ${isEvent ? 'bg-sky-50' : 'bg-emerald-50/60'}`}>
                        <p dir="auto" className="line-clamp-3 font-serif text-[11px] italic leading-snug text-slate-500">{pulse.body}</p>
                    </div>
                )}
                <div className="p-2">
                    <h3 dir="auto" className="truncate text-xs font-semibold text-slate-800">{pulse.title}</h3>
                        {pulse.carriedByName && <p className="truncate text-[10px] italic text-purple-500">🤲 {t('carried_by').replace('{name}', pulse.carriedByName)}</p>}
                    <div className="mt-1 flex items-center justify-between">
                        {love('text-[10px]')}
                        {badge && <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${isEvent ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-600'}`}>{badge}</span>}
                    </div>
                </div>
            </div>
        );
    }

    // CARDS — the full card (the original look). A fixed height so every card in the grid is the
    // same size, whatever it carries (image or words, long body or none); the top image/text block
    // stays h-36 and the love row pins to the bottom, so a text card's spare room reads as
    // breathing space rather than a ragged edge.
    return (
        <div
            onClick={() => onView && onView(pulse)}
            className={`flex h-60 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${POP} group cursor-pointer ${ringCls}`}
        >
            {images.length > 0 ? (
                // With an image: the photo carries the card, title overlaid.
                <div className="relative h-36 shrink-0 bg-slate-100 overflow-hidden group">
                    <div className="absolute top-2 right-2 z-20 flex gap-1">{badges}</div>
                    <CardCarousel images={images} alt={pulse.title} imgClassName="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent pointer-events-none"></div>
                    <div className="absolute bottom-2 left-3 right-3 text-white pointer-events-none">
                        <h3 dir="auto" className="text-sm font-bold tracking-wide truncate">{pulse.title}</h3>
                    </div>
                </div>
            ) : (
                // No image: let the words carry it — no placeholder artwork.
                <div className="flex h-36 shrink-0 flex-col justify-between p-3">
                    <div className="flex items-start justify-between gap-2">
                        <h3 dir="auto" className="line-clamp-2 text-base font-semibold tracking-wide text-slate-800">{pulse.title}</h3>
                        <div className="flex shrink-0 gap-1">{badges}</div>
                    </div>
                    <p dir="auto" className="line-clamp-3 font-serif text-sm italic leading-relaxed text-slate-500">{pulse.body}</p>
                </div>
            )}

            <div className="flex flex-1 flex-col p-3">
                {/* Text-only cards already show the body above — don't repeat it here. */}
                {(images.length > 0 || (isEvent && pulse.eventDate)) && (
                    <p dir="auto" className="text-slate-600 text-xs font-light leading-relaxed truncate">{meta}</p>
                )}
                <div className={`mt-auto flex items-center justify-between ${images.length > 0 || (isEvent && pulse.eventDate) ? 'pt-2 border-t border-slate-100' : ''}`}>
                    {love('text-xs', 'text-slate-500')}

                    {lightseed && lightseed.uid !== pulse.authorId && !pulse.isMatch && (
                        <button onClick={handleMatchClick} className="text-[10px] bg-slate-50 text-slate-500 hover:bg-sky-50 hover:text-sky-600 px-2 py-1 rounded transition-colors flex items-center gap-1">
                            <Icons.Link /> <span>Match</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
