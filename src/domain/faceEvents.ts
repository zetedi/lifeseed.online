// FACE EVENTS — what a face may show whoever stands at it.
//
// The hybrid shape (ring 2026-08-19) gave every mother site a door INTO the seed; this
// module is the seed speaking BACK through that door. A visitor standing at a face —
// theohouse.org, perauset.web.app, any domain with a cradle — is AT the node, whether or
// not they ever sign in: the face's own public AND node happenings greet them. Anything
// narrower (community, circle, private) never leaves the rules' gates, because this feed
// is served by the node itself (functions/faceEvents), not by loosening firestore.rules.
//
// Plain contract — guaranteed now: isFaceFeedVisible admits exactly 'public', 'node' and
// the legacy absent-visibility (= public) forms; faceFeedOf keeps only type 'event' rows
// that pass it, shapes them to the six feed fields, and orders dated gatherings soonest
// first with dateless ones last. The feed carries ONE face per gathering (imageUrl): the
// first http(s) entry of the pulse's imageUrls, else its single imageUrl — the same
// preference the seed's own card has — or '' when the gathering has no picture. Not
// guaranteed: past-event hiding (consumers decide, as domain/calendar does for the seed's
// own room) and community-rooted events (the feed carries a face's DOMAIN-stamped
// happenings only). Enforced by tests/faceEvents.test.ts, which also holds the
// functions/src/faceEvents.ts mirror true.

export const FACE_FEED_VISIBILITIES = ['public', 'node'] as const;

export type FaceFeedEvent = {
  lid: string;
  title: string;
  body: string;
  eventDate: string;
  visibility: string;
  imageUrl: string;
};

// Absent visibility is the legacy-public form — every early pulse predates the field.
// Only ABSENCE is legacy: a visibility that exists but is not a string is malformed
// data and must fall on the sealed side of the gate, never be mistaken for public.
const normalizedVisibility = (visibility: unknown): string | null =>
  visibility === undefined || visibility === null || visibility === ''
    ? 'public'
    : typeof visibility === 'string'
      ? visibility
      : null;

export const isFaceFeedVisible = (visibility: unknown): boolean => {
  const cloak = normalizedVisibility(visibility);
  return cloak !== null && (FACE_FEED_VISIBILITIES as readonly string[]).includes(cloak);
};

// A gathering's place in time: dated ones by their moment, dateless ones after every
// dated one (MAX_SAFE_INTEGER, never Infinity — two Infinities subtract to NaN and
// silently shuffle the sort).
const momentOf = (eventDate: string): number => {
  const t = Date.parse(eventDate);
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
};

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

// Only a web address may ride the feed as a picture: a blob:, data: or javascript: string
// stored by mistake would otherwise be handed to every face's <img> verbatim.
const isHttpUrl = (v: unknown): v is string => typeof v === 'string' && /^https?:\/\//i.test(v);

// The gathering's one face, the seed's own preference: the carousel's first picture wins,
// the single imageUrl stands in for it, and a pulse without a picture says so plainly.
export const faceImageOf = (row: Record<string, unknown>): string => {
  const many = Array.isArray(row.imageUrls) ? row.imageUrls.find(isHttpUrl) : undefined;
  return many ?? (isHttpUrl(row.imageUrl) ? row.imageUrl : '');
};

// Raw pulse rows (already narrowed to one domain at the query) → the feed. This filter
// is the LAST gate: whatever the query returned, only events wearing a feed-visible
// cloak pass, soonest gathering first.
export const faceFeedOf = (rows: Array<Record<string, unknown>>): FaceFeedEvent[] =>
  rows
    .filter((row) => row.type === 'event' && isFaceFeedVisible(row.visibility))
    .map((row) => ({
      lid: str(row.lid),
      title: str(row.title),
      body: str(row.body),
      eventDate: str(row.eventDate),
      visibility: normalizedVisibility(row.visibility) ?? 'public',
      imageUrl: faceImageOf(row),
    }))
    .sort((a, b) => momentOf(a.eventDate) - momentOf(b.eventDate));

// The domain a feed request names: an explicit ?domain= wins (a mother site asking about
// its own face), else the host the request stood at (the face's /faceEvents rewrite).
// Normalized lowercase without www; anything that does not look like a domain is refused
// rather than guessed.
export const feedDomainOf = (param: unknown, host: unknown): string | null => {
  const pick = (v: unknown): string | null => {
    if (typeof v !== 'string') return null;
    const d = v.trim().toLowerCase().replace(/^www\./, '');
    return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(d) ? d : null;
  };
  return pick(param) ?? pick(host);
};
