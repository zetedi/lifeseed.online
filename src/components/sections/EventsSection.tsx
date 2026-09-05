import React, { useState, useEffect, useCallback, useRef } from 'react';
import { showAlert, showConfirm } from '../ui/Dialog';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSession } from '../../contexts/SessionContext';
import { announce } from '../../services/refreshBus';
import { useRefreshSignal } from '../../hooks/useRefreshSignal';
import { SuperDot } from '../ui/SuperDot';
import { Icons } from '../ui/Icons';
import { Pulse } from '../../types';
// updateEvent and deleteCommunityEvent are scope-agnostic despite the latter's name: both
// operate on a pulse id in the one ledger (events are pulses of type 'event' everywhere).
import { updateEvent, deleteCommunityEvent, uploadImage } from '../../services/firebase';
import { ImagePicker } from '../ui/ImagePicker';
import { SectionTitle } from '../ui/SectionTitle';
import { EventWeather } from '../ui/EventWeather';
import { visibilitiesForScope } from '../../domain/pulseVisibility';
import type { PulseVisibility } from '../../domain/pulse';

import { Picture } from '../ui/Picture';
// Being-generic events section. Events are conceptually the same for communities, nodes and
// personal profiles — only where they're rooted (and therefore how they're fetched/created)
// differs, so the owner binds those via `loadEvents` / `onCreate`. CommunityEvents is a thin
// wrapper over this; node- and personal-profile events tabs can bind their own scoping.
// IntelligenceSection follows the same pattern (CommunityIntelligence is its thin wrapper).

export type EventsScope = 'community' | 'node' | 'personal';

// The editable content of an event plus the author stamp — exactly the fields the form owns.
export interface EventDraft {
  title: string;
  body: string;
  content: string;
  imageUrl: string;
  imageUrls: string[];
  eventDate: string;
  eventLocation: string;
  visibility: PulseVisibility;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
}

interface EventsSectionProps {
  scope: EventsScope;
  canEdit: boolean;
  currentUserId?: string;
  // Author identity stamped onto newly created events.
  currentUserName?: string | null;
  currentUserPhoto?: string | null;
  onViewEvent?: (event: Pulse) => void;
  // Scope-bound fetch (already restricted to the visibility levels the viewer may query).
  // Must be referentially stable (useCallback in the owner) — it drives the refresh effect.
  loadEvents: () => Promise<Pulse[]>;
  // Scope-bound create (community/node/personal scoping is the caller's concern).
  onCreate: (draft: EventDraft) => Promise<unknown>;
  // Storage folder for event images, e.g. `communities/{id}/events`.
  uploadPathPrefix: string;
  // Author name used when the creator has no display name.
  fallbackAuthorName?: string;
  // Background for list thumbnails without an image (the owner's theme accent).
  placeholderColor?: string;
  // Who owns the scope these events live in (community keeper / profile owner). Used only
  // to decide whether a staff viewer's delete right is privilege (amber dot) or their own.
  scopeOwnerId?: string;
}

// Events section — list, create and edit events for any entity (community, node, personal).
export const EventsSection: React.FC<EventsSectionProps> = ({
  scope,
  canEdit,
  scopeOwnerId,
  currentUserId,
  currentUserName,
  currentUserPhoto,
  onViewEvent,
  loadEvents,
  onCreate,
  uploadPathPrefix,
  fallbackAuthorName = 'Member',
  placeholderColor,
}) => {
  const { t } = useLanguage();
  const { isAdmin, isSuperAdmin } = useSession();
  const isStaff = isAdmin || isSuperAdmin;

  const [events, setEvents] = useState<Pulse[]>([]);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventBody, setEventBody] = useState('');
  const [eventVisibility, setEventVisibility] = useState<PulseVisibility>('public');
  const [eventImageUrls, setEventImageUrls] = useState<string[]>([]);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [isEventSaving, setIsEventSaving] = useState(false);
  const [isUploadingEventImage, setIsUploadingEventImage] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);

  // Visibility choices follow the pulse scope. A personal profile has no dedicated pulse
  // scope (yet) — personal events live on the node ledger, so they get node-level audiences.
  const visibilityScope = scope === 'community' ? 'community' : 'node';

  // Only the newest fetch may land: membership (and so the visible levels) resolves a beat
  // after mount, and the wider second fetch must never be overwritten by the narrower first.
  const eventsSeq = useRef(0);
  const refreshEvents = useCallback(() => {
    const seq = ++eventsSeq.current;
    loadEvents().then(list => { if (seq === eventsSeq.current) setEvents(list); }).catch(() => {});
  }, [loadEvents]);
  // Re-fetch when an event changes anywhere else (e.g. deleted on its profile page).
  const eventsSignal = useRefreshSignal(['events']);
  useEffect(() => { refreshEvents(); }, [refreshEvents, eventsSignal]);

  const handleDeleteEvent = async (eventId: string) => {
    if (!(await showConfirm(t('delete_event_confirm'), { title: t('delete'), confirmText: t('delete'), danger: true }))) return;
    try {
      await deleteCommunityEvent(eventId);
      setEvents(prev => prev.filter(e => e.id !== eventId));
      announce('events', eventId);
    } catch (e: any) {
      showAlert(e?.message || 'err_event_delete');
    }
  };

  const handleAddEventImage = async (file: File) => {
    setIsUploadingEventImage(true);
    try {
      const url = await uploadImage(file, `${uploadPathPrefix}/${Date.now()}`);
      setEventImageUrls(prev => [...prev, url]);
    } catch (e) {
      console.error(e);
      showAlert('err_event_image');
    }
    setIsUploadingEventImage(false);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId || !eventTitle.trim() || isEventSaving) return;
    setIsEventSaving(true);
    try {
      const payload = {
        title: eventTitle.trim(),
        body: eventBody.trim(),
        content: eventBody.trim(),
        imageUrl: eventImageUrls[0] || '',
        imageUrls: eventImageUrls,
        eventDate: eventDate || '',
        eventLocation: eventLocation.trim(),
        visibility: eventVisibility,
      };
      if (editingEventId) {
        await updateEvent(editingEventId, payload); // author preserved
      } else {
        await onCreate({
          ...payload,
          authorId: currentUserId,
          authorName: currentUserName || fallbackAuthorName,
          authorPhoto: currentUserPhoto || undefined,
        });
      }
      setEventTitle('');
      setEventDate('');
      setEventLocation('');
      setEventBody('');
      setEventVisibility('public');
      setEventImageUrls([]);
      setEditingEventId(null);
      setShowEventForm(false);
      refreshEvents();
      // A NEW event tells every other events view (the dashboard banner, other tabs) to
      // re-fetch. An EDIT already announced itself from updateEvent, patch and all — a second,
      // patchless announce with the id would read as a removal and prune the event it just saved.
      if (!editingEventId) announce('events');
    } catch (error: any) {
      console.error(error);
      showAlert(error?.message || 'err_event_save');
    }
    setIsEventSaving(false);
  };

  // Begin editing an existing event: prefill the form and reveal it.
  const startEditEvent = (ev: Pulse) => {
    setEditingEventId(ev.id);
    setEventTitle(ev.title || '');
    setEventBody(ev.content || ev.body || '');
    setEventDate(ev.eventDate || '');
    setEventLocation(ev.eventLocation || '');
    setEventVisibility((ev.visibility as PulseVisibility) || 'public');
    setEventImageUrls(ev.imageUrls?.length ? ev.imageUrls : (ev.imageUrl ? [ev.imageUrl] : []));
    setShowEventForm(true);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <SectionTitle title={t('events')} sub={t('events_sub')} />
        {canEdit && (
          <button onClick={() => { const next = !showEventForm; setShowEventForm(next); if (!next) setEditingEventId(null); }} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-colors hover:bg-sky-700">
            {showEventForm ? <Icons.Close /> : <Icons.Plus />}<span>{editingEventId ? t('edit_event') : t('create_event')}</span>
          </button>
        )}
      </div>

      {canEdit && showEventForm && (
        <form onSubmit={handleCreateEvent} className="mb-8 space-y-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
          <input dir="auto" value={eventTitle} onChange={e => setEventTitle(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder={t('event_title_ph')} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <input type="datetime-local" value={eventDate} onChange={e => setEventDate(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <input dir="auto" value={eventLocation} onChange={e => setEventLocation(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder={t('location')} />
          </div>
          <textarea dir="auto" value={eventBody} onChange={e => setEventBody(e.target.value)} className="min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder={t('event_details_ph')} />
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase text-slate-400">{t('visibility')}</span>
            <select value={eventVisibility} onChange={e => setEventVisibility(e.target.value as PulseVisibility)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              {visibilitiesForScope(visibilityScope).map(v => <option key={v} value={v}>{t(`vis_${v}` as any)}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {eventImageUrls.map((url, index) => (
              <div key={url} className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                <img src={url} className="h-full w-full object-cover" alt={`${t('events')} ${index + 1}`} />
                <button type="button" onClick={() => setEventImageUrls(prev => prev.filter((_, i) => i !== index))} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-500 shadow-sm" title={t('remove')}>
                  <Icons.Close />
                </button>
              </div>
            ))}
            <ImagePicker onImageSelect={handleAddEventImage} loading={isUploadingEventImage} className="flex aspect-square cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white text-slate-400 hover:border-emerald-400 hover:text-emerald-600">
              <Icons.Plus />
            </ImagePicker>
          </div>
          <button type="submit" disabled={isEventSaving || isUploadingEventImage || !eventTitle.trim()} className="w-full rounded-2xl bg-sky-600 py-3 text-sm font-bold text-white shadow-lg shadow-sky-600/20 transition-all hover:bg-sky-700 disabled:opacity-50">
            {isEventSaving ? t('creating') : (editingEventId ? t('save_changes') : t('create_event'))}
          </button>
        </form>
      )}

      {events.length === 0 ? (
        <p className="text-center text-slate-400 py-10 text-sm">{t('no_events')}</p>
      ) : (
        <div className="space-y-3">
          {events.map(ev => (
            <div
              key={ev.id}
              onClick={() => onViewEvent?.(ev)}
              className={`group flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-3 shadow-sm ${onViewEvent ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}`}
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                {ev.imageUrl ? <Picture size={480} src={ev.imageUrl} className="h-full w-full object-cover" alt={ev.title} /> : <div className="h-full w-full" style={{ backgroundColor: placeholderColor }} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-bold text-slate-800">{ev.title}</p>
                <p className="truncate text-xs text-slate-500">
                  {ev.eventDate ? new Date(ev.eventDate).toLocaleString() : ''}{ev.eventLocation ? ` · ${ev.eventLocation}` : ''}
                </p>
              </div>
              <EventWeather location={ev.eventLocation} dateIso={ev.eventDate} className="shrink-0 rounded-full bg-sky-50 px-2 py-1 text-sky-800" />
              {(canEdit || ev.authorId === currentUserId) && (
                <button onClick={(e) => { e.stopPropagation(); startEditEvent(ev); }} title={t('edit')} className="shrink-0 rounded-full p-2 text-slate-400 transition-colors hover:bg-sky-50 hover:text-sky-600 sm:opacity-0 sm:group-hover:opacity-100">
                  <Icons.Pencil />
                </button>
              )}
              {canEdit && (
                <button onClick={(e) => { e.stopPropagation(); handleDeleteEvent(ev.id); }} title={t('delete')} className="relative shrink-0 rounded-full p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100">
                  <Icons.Trash />
                  {isStaff && ev.authorId !== currentUserId && scopeOwnerId !== currentUserId && <SuperDot />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
