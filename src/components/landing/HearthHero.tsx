import React, { useEffect, useState } from 'react';
import type { Community, Lightseed, Pulse } from '../../types';
import { fetchEventPulses } from '../../services/firebase';
import { eventFeedScope, eventsOnView } from '../../domain/pulseVisibility';
import { sanitizeRichText } from '../../utils/sanitize';
import { useLanguage } from '../../contexts/LanguageContext';

import { Picture } from '../ui/Picture';
// THE HEARTH HERO — the section registry's first citizen (ring 2026-08-16), designed with
// Zoltán for The O House: the fireplace that will stand at the centre of the dome, held in
// a circle (the dome's eye), the community's VISION breathing live from its own property
// (one mouth — edit the vision, the hero follows), and the place's coming gatherings
// visible to whoever stands at the door. One component, any hearth: everything specific to
// a community arrives as data.
interface HearthHeroProps {
  community: Community;
  props: Record<string, unknown>;
  lightseed: Lightseed | null;
  onViewEvent?: (event: Pulse) => void;
}

export const HearthHero: React.FC<HearthHeroProps> = ({ community, props, lightseed, onViewEvent }) => {
  const { t } = useLanguage();
  const imageUrl = (props.imageUrl as string) || community.heroImageUrl || '';
  const headline = (props.headline as string) || community.name;
  const showEvents = props.showEvents !== false;
  const maxEvents = (props.maxEvents as number) || 4;
  const accent = community.theme?.accent || '#eab308';

  const [events, setEvents] = useState<Pulse[]>([]);
  useEffect(() => {
    if (!showEvents || !community.domain) return;
    let alive = true;
    // The same one sentence every event surface speaks (the banner-leak lesson): a strict
    // portal scopes to its place; a signed-out visitor sees the public gatherings.
    const { levels, ownerUid } = eventFeedScope(
      { uid: lightseed?.uid },
      { reflectsPublic: community.reflectsPublic, strictScope: community.strictScope },
    );
    fetchEventPulses(undefined, community.domain, levels, ownerUid)
      .then(r => {
        if (!alive) return;
        const seen = eventsOnView(r.items, { signedIn: !!lightseed, showPast: false, nowMs: Date.now() });
        setEvents(seen.slice(0, maxEvents));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [community.domain, community.reflectsPublic, community.strictScope, lightseed, showEvents, maxEvents, lightseed?.uid]);

  const visionHtml = community.vision ? sanitizeRichText(community.vision).replace(/&nbsp;| /g, ' ') : '';

  return (
    <section className="relative mx-auto w-full max-w-3xl px-4 py-10 text-center">
      {/* The dome's eye — the fireplace held in a circle, the hearth's glow around it. */}
      {imageUrl && (
        <div className="relative mx-auto mb-8 h-56 w-56 md:h-72 md:w-72">
          <div className="absolute inset-0 rounded-full" style={{ boxShadow: `0 0 90px 18px ${accent}55` }} />
          <Picture size={1200}
            src={imageUrl}
            alt={headline}
            referrerPolicy="no-referrer"
            className="relative h-full w-full rounded-full border-4 object-cover shadow-2xl"
            style={{ borderColor: accent }}
          />
        </div>
      )}

      <h2 dir="auto" className="text-3xl font-light tracking-wide text-slate-800 md:text-4xl">{headline}</h2>

      {/* The vision — the community's own property, spoken live, never copied into props. */}
      {visionHtml && (
        <div
          dir="auto"
          className="prose prose-slate mx-auto mt-4 max-w-xl font-serif text-lg leading-relaxed text-slate-600"
          dangerouslySetInnerHTML={{ __html: visionHtml }}
        />
      )}

      {/* The coming gatherings, at the door — no sign-in asked just to see the fire lit. */}
      {showEvents && events.length > 0 && (
        <div className="mt-10">
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{t('hearth_gatherings')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {events.map(ev => (
              <button
                key={ev.id}
                type="button"
                onClick={() => onViewEvent?.(ev)}
                className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 p-3 text-left shadow-sm backdrop-blur transition-all hover:shadow-md"
              >
                {ev.imageUrl && (
                  <Picture size={480} src={ev.imageUrl} alt="" referrerPolicy="no-referrer" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                )}
                <span className="min-w-0">
                  <span dir="auto" className="block truncate text-sm font-bold text-slate-800 group-hover:text-slate-900">{ev.title}</span>
                  {ev.eventDate && (
                    <span className="block text-xs text-slate-500">{new Date(ev.eventDate).toLocaleString()}</span>
                  )}
                  {ev.eventLocation && <span className="block truncate text-xs text-slate-400">{ev.eventLocation}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
