// FACE EVENTS, server side — the pure half, with no Firestore in reach.
//
// Functions is its own TS project and cannot import src/domain, so this module MIRRORS
// src/domain/faceEvents.ts. The mirror is held true by the ROOT test suite
// (tests/faceEvents.test.ts imports BOTH and compares), the same arrangement
// beingIndex.ts has with src/domain/beingIndex.ts.
//
// index.ts owns only the plumbing: resolve the cradle at a domain, fetch its
// domain-stamped event pulses, and let this law say which of them the face may show.

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
