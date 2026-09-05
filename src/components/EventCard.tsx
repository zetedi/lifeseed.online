import React, { useEffect, useState } from 'react';
import { CardCarousel } from './ui/CardCarousel';
import { Icons } from './ui/Icons';
import { LoveButton } from './ui/LoveButton';
import { firestoreStore } from '../adapters/firestore';
import type { Community, Pulse } from '../types';

import { Picture } from './ui/Picture';
// ONE event card, shared by the home hero banner and the Events section (DRY). A solid card, so
// it reads the same on a coloured banner or a white page. The image carries four corners:
//   top-left  — the countdown (In / N / days; Today in one word)
//   top-right — the seats (participants, N/max)
//   bottom-left  — the host community's face (a door to it)
//   bottom-right — the loves (opposite corner of the countdown, by request)
// Title + when/where sit beneath; an optional `actions` slot holds edit/delete on the events page.
export const EventCard = ({ event, onOpen, community, onOpenCommunity, participantCount, actions, className, isDark = false }: {
    event: Pulse;
    onOpen: () => void;
    community?: Community | null;   // the host community's face, resolved by the caller
    onOpenCommunity?: () => void;   // when set, the face becomes a door to the community
    participantCount?: number;      // supply to skip the card's own read; else it reads once
    actions?: React.ReactNode;      // edit/delete etc. (events page); absent on the hero
    className?: string;             // width/shrink for the context (default w-full)
    isDark?: boolean;               // the night theme (prop-driven, like Dashboard's isDark)
}) => {
    // When the caller supplies the count, use it directly; otherwise read the participant links
    // once (the async callback sets state, so no synchronous setState in the effect body).
    const [fetched, setFetched] = useState<number | null>(null);
    useEffect(() => {
        if (typeof participantCount === 'number') return;
        let alive = true;
        firestoreStore.linksTo(event.id, 'participant').then(l => { if (alive) setFetched(l.length); }).catch(() => {});
        return () => { alive = false; };
    }, [event.id, participantCount]);
    const count = typeof participantCount === 'number' ? participantCount : (fetched ?? 0);

    // eslint-disable-next-line react-hooks/purity -- a countdown reads "now"; frequent re-renders keep it honest
    const nowMs = Date.now();
    const days = (() => {
        if (!event.eventDate) return null;
        const ms = Date.parse(event.eventDate);
        if (Number.isNaN(ms) || ms < nowMs) return null; // a past event wears no countdown
        return Math.ceil((ms - nowMs) / 86400000);
    })();
    const max = event.eventMaxParticipants || 0;
    const faceName = event.communityName || community?.name || 'Community';
    const showFace = !!(event.communityId || community);

    return (
        <button onClick={onOpen} className={`group relative flex flex-col overflow-hidden rounded-xl border text-left shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'} ${className ?? 'w-full'}`}>
            <div className={`relative aspect-[4/3] w-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                {(event.imageUrls?.length || event.imageUrl)
                    ? <CardCarousel images={event.imageUrls?.length ? event.imageUrls : [event.imageUrl!]} alt={event.title} />
                    : <div className="flex h-full w-full items-center justify-center text-slate-300"><Icons.Loc /></div>}

                {/* top-left: how soon */}
                {days !== null && (
                    <span className="absolute left-1.5 top-1.5 flex flex-col items-center rounded-md bg-black/30 px-1.5 py-0.5 leading-tight text-white backdrop-blur-sm">
                        {days === 0 ? (
                            <span className="text-[10px] font-bold">Today</span>
                        ) : (
                            <>
                                <span className="text-[8px] uppercase tracking-wide text-white/75">In</span>
                                <span className="text-xs font-bold tabular-nums">{days}</span>
                                <span className="text-[8px] uppercase tracking-wide text-white/75">{days === 1 ? 'day' : 'days'}</span>
                            </>
                        )}
                    </span>
                )}

                {/* top-right: the gathering's seats */}
                {(max > 0 || count > 0) && (
                    <span className="absolute right-1.5 top-1.5 flex flex-col items-center rounded-md bg-black/30 px-1.5 py-0.5 leading-tight text-white backdrop-blur-sm">
                        <span className="text-xs font-bold tabular-nums">{max ? `${count}/${max}` : count}</span>
                        <span className="text-[8px] uppercase tracking-wide text-white/75">{count === 1 && !max ? 'tree' : 'trees'}</span>
                    </span>
                )}

                {/* bottom-left: the host community's face, a door to its profile */}
                {showFace && (
                    <span
                        role={onOpenCommunity ? 'button' : undefined}
                        tabIndex={onOpenCommunity ? 0 : undefined}
                        title={`Hosted by ${faceName}`}
                        onClick={onOpenCommunity ? (e) => { e.stopPropagation(); onOpenCommunity(); } : undefined}
                        onKeyDown={onOpenCommunity ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onOpenCommunity(); } } : undefined}
                        className={`absolute bottom-1.5 left-1.5 flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-emerald-600 text-[11px] font-bold text-white shadow-md ${onOpenCommunity ? 'transition-transform hover:scale-110' : ''}`}
                    >
                        {community?.logoUrl
                            ? <Picture size={480} src={community.logoUrl} className="h-full w-full object-cover" alt={faceName} referrerPolicy="no-referrer" />
                            : faceName.charAt(0).toUpperCase()}
                    </span>
                )}

                {/* bottom-right: love this event (the countdown's opposite corner). The shared heart,
                    rendered inline (a <span role=button>) so it never nests a <button> inside the
                    card's own button; a badge bg appears once there are loves. */}
                <LoveButton
                    inline
                    collection="pulses"
                    id={event.id}
                    initialCount={event.loveCount || 0}
                    noun="this event"
                    className="absolute bottom-1.5 right-1.5 rounded-full px-1.5 py-0.5 text-white"
                    activeClassName="bg-black/30 backdrop-blur-sm"
                    iconClassName="[&>svg]:h-4 [&>svg]:w-4 drop-shadow"
                />
            </div>

            <div className="flex min-w-0 items-start justify-between gap-2 p-2.5">
                {/* flex-1 so the text column (and the hairline) always fill the card width, even when
                    the title/description are short; otherwise the column shrinks to its content and
                    the separator stops short of the right edge. */}
                <div className="min-w-0 flex-1">
                    <p className={`truncate text-base font-light tracking-wide ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{event.title}</p>
                    <p className={`truncate text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {event.eventDate ? new Date(event.eventDate).toLocaleDateString() : ''}{event.eventLocation ? ` · ${event.eventLocation}` : ''}{max ? ` · max ${max}` : ''}
                    </p>
                    {/* The event's own words, small, beneath the place; a hairline parts them. */}
                    {(event.content || event.body) && (
                        <>
                            <div className={`mt-1.5 border-t ${isDark ? 'border-slate-800/60' : 'border-slate-100'}`} />
                            <p dir="auto" className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-slate-400">{event.content || event.body}</p>
                        </>
                    )}
                </div>
                {actions && (
                    <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>{actions}</div>
                )}
            </div>
        </button>
    );
};
