import { describe, it, expect } from 'vitest';
import {
  FACE_FEED_VISIBILITIES, isFaceFeedVisible, faceFeedOf, faceImageOf, feedDomainOf,
} from '../src/domain/faceEvents';
import {
  FACE_FEED_VISIBILITIES as SERVER_FACE_FEED_VISIBILITIES,
  isFaceFeedVisible as serverIsFaceFeedVisible,
  faceFeedOf as serverFaceFeedOf,
  faceImageOf as serverFaceImageOf,
  feedDomainOf as serverFeedDomainOf,
} from '../functions/src/faceEvents';

// FACE EVENTS. A visitor standing at a face is AT the node: its public and node
// happenings greet them, and nothing narrower ever rides the feed. These tests hold
// the gate — and hold the functions mirror true against the domain law.

const event = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  type: 'event',
  lid: '019ea86e-0000-7000-8000-00000000bf17',
  title: 'The Heart Fire',
  body: 'The fourth fire at The O House.',
  eventDate: '2026-09-11T19:37',
  visibility: 'node',
  ...over,
});

describe('isFaceFeedVisible — the last gate', () => {
  it('admits public, node, and the legacy absent form', () => {
    expect(isFaceFeedVisible('public')).toBe(true);
    expect(isFaceFeedVisible('node')).toBe(true);
    expect(isFaceFeedVisible(undefined)).toBe(true);
    expect(isFaceFeedVisible('')).toBe(true);
  });

  it('refuses every sealed cloak', () => {
    for (const sealed of ['private', 'community', 'circle', 'unlisted', 'PUBLIC', 42]) {
      expect(isFaceFeedVisible(sealed)).toBe(false);
    }
  });
});

describe('faceFeedOf — shape and order', () => {
  it('keeps only events that pass the gate', () => {
    const feed = faceFeedOf([
      event(),
      event({ visibility: 'private', title: 'sealed' }),
      event({ type: 'observation', title: 'not an event' }),
      event({ visibility: 'public', title: 'open' }),
    ]);
    expect(feed.map(e => e.title)).toEqual(['The Heart Fire', 'open']);
  });

  it('orders dated gatherings soonest first, dateless after every dated one', () => {
    const feed = faceFeedOf([
      event({ eventDate: '', title: 'whenever' }),
      event({ eventDate: '2026-12-12T12:00', title: 'later' }),
      event({ eventDate: '2026-09-11T19:37', title: 'sooner' }),
      event({ eventDate: 'not a date', title: 'unreadable' }),
    ]);
    expect(feed.map(e => e.title)).toEqual(['sooner', 'later', 'whenever', 'unreadable']);
  });

  it('shapes to the six feed fields and normalizes the legacy cloak', () => {
    const [row] = faceFeedOf([event({ visibility: undefined, authorId: 'never-on-the-feed' })]);
    expect(row).toEqual({
      lid: '019ea86e-0000-7000-8000-00000000bf17',
      title: 'The Heart Fire',
      body: 'The fourth fire at The O House.',
      eventDate: '2026-09-11T19:37',
      visibility: 'public',
      imageUrl: '',
    });
    expect('authorId' in row).toBe(false);
  });

  it('never lets two dateless gatherings shuffle the sort (NaN comparator)', () => {
    const feed = faceFeedOf([
      event({ eventDate: '', title: 'a' }),
      event({ eventDate: '', title: 'b' }),
      event({ eventDate: '2026-01-01', title: 'dated' }),
    ]);
    expect(feed[0].title).toBe('dated');
    expect(feed).toHaveLength(3);
  });
});

describe('faceImageOf — the gathering\'s one face', () => {
  const fire = 'https://firebasestorage.googleapis.com/v0/b/x/o/fire.webp?alt=media';
  const drum = 'https://firebasestorage.googleapis.com/v0/b/x/o/drum.webp?alt=media';

  it('prefers the first picture of the carousel, as the seed\'s own card does', () => {
    expect(faceImageOf(event({ imageUrls: [drum, fire], imageUrl: fire }))).toBe(drum);
  });

  it('falls back to the single imageUrl, and to nothing at all', () => {
    expect(faceImageOf(event({ imageUrl: fire }))).toBe(fire);
    expect(faceImageOf(event({ imageUrls: [], imageUrl: fire }))).toBe(fire);
    expect(faceImageOf(event())).toBe('');
    expect(faceImageOf(event({ imageUrl: null, imageUrls: null }))).toBe('');
  });

  it('lets only a web address ride — never a blob, data or script string', () => {
    expect(faceImageOf(event({ imageUrl: 'javascript:alert(1)' }))).toBe('');
    expect(faceImageOf(event({ imageUrl: 'data:image/png;base64,AAAA' }))).toBe('');
    expect(faceImageOf(event({ imageUrls: ['blob:https://seed/x', 42, fire] }))).toBe(fire);
    expect(faceImageOf(event({ imageUrls: 'not-a-list', imageUrl: 'HTTP://UPPER.CASE/ok.jpg' }))).toBe('HTTP://UPPER.CASE/ok.jpg');
  });

  it('rides the feed as imageUrl', () => {
    const [row] = faceFeedOf([event({ imageUrls: [fire] })]);
    expect(row.imageUrl).toBe(fire);
  });
});

describe('feedDomainOf — which face is being asked about', () => {
  it('lets an explicit ?domain= win over the host', () => {
    expect(feedDomainOf('theohouse.org', 'lightseed.online')).toBe('theohouse.org');
  });

  it('falls back to the host the request stood at', () => {
    expect(feedDomainOf(undefined, 'seed.theohouse.org')).toBe('seed.theohouse.org');
  });

  it('normalizes case and www, and refuses what is not a domain', () => {
    expect(feedDomainOf('WWW.Theohouse.ORG', null)).toBe('theohouse.org');
    expect(feedDomainOf('not a domain', 'also not')).toBe(null);
    expect(feedDomainOf('javascript:alert(1)', undefined)).toBe(null);
    expect(feedDomainOf(42, {})).toBe(null);
  });
});

describe('the functions mirror stays true', () => {
  it('carries the same visibilities', () => {
    expect([...SERVER_FACE_FEED_VISIBILITIES]).toEqual([...FACE_FEED_VISIBILITIES]);
  });

  it('gates, shapes and orders identically', () => {
    const rows = [
      event(),
      event({ visibility: 'private' }),
      event({ visibility: undefined, eventDate: '', title: 'legacy' }),
      event({ visibility: 'public', eventDate: '2025-01-01', title: 'early' }),
      event({ type: 'reach' }),
      event({ imageUrls: ['blob:nope', 'https://a/1.webp'], imageUrl: 'https://a/2.webp', title: 'pictured' }),
      event({ imageUrl: 'javascript:alert(1)', title: 'unpictured' }),
    ];
    expect(serverFaceFeedOf(rows)).toEqual(faceFeedOf(rows));
    for (const row of rows) expect(serverFaceImageOf(row)).toBe(faceImageOf(row));
    for (const v of ['public', 'node', 'private', undefined, '']) {
      expect(serverIsFaceFeedVisible(v)).toBe(isFaceFeedVisible(v));
    }
    for (const [p, h] of [['theohouse.org', 'x'], [undefined, 'seed.theohouse.org'], ['bad domain', 'bad host']] as const) {
      expect(serverFeedDomainOf(p, h)).toBe(feedDomainOf(p, h));
    }
  });
});
