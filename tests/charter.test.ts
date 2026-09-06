import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  charterProblem, charterHosts, charterOrigin, charterOwnDomains, charterFaceDoor, charterPublicOf, firebasercOf, hostingOf,
  type Charter,
} from '../src/domain/charter';
import {
  charterProblem as sCharterProblem, charterHosts as sCharterHosts, charterOrigin as sCharterOrigin,
  charterOwnDomains as sCharterOwnDomains, charterFaceDoor as sCharterFaceDoor, charterPublicOf as sCharterPublicOf,
} from '../functions/src/charter';
import { speak } from '../src/utils/translations';

// THE CHARTER. One file says what a node is; the law derives everything else, the server
// mirrors the law, and the sync writes the files that must agree. These tests hold all three.

const node = JSON.parse(readFileSync(new URL('../node.json', import.meta.url), 'utf8')) as Charter;
const sound = (): Charter => JSON.parse(JSON.stringify(node));
const broken = (f: (c: Charter) => void) => { const c = sound(); f(c); return c; };

describe('charterProblem — what a sound charter is', () => {
  it('this node\'s own charter is sound', () => {
    expect(charterProblem(node)).toBeNull();
  });

  it('refuses each unsound thing by name', () => {
    expect(speak(charterProblem(broken(c => { (c as any).version = 2; }))!)).toMatch(/version/i);
    expect(speak(charterProblem(broken(c => { c.nodeLid = 'not-a-lid'; }))!)).toMatch(/true name/i);
    expect(speak(charterProblem(broken(c => { c.name = ' '; }))!)).toMatch(/name/i);
    expect(speak(charterProblem(broken(c => { c.domain = 'not a domain'; }))!)).toMatch(/domain/i);
    expect(speak(charterProblem(broken(c => { c.aliases = ['ok.online', 'bad_alias']; }))!)).toMatch(/domain/i);
    expect(speak(charterProblem(broken(c => { c.faces = []; }))!)).toMatch(/faces/i);
    expect(speak(charterProblem(broken(c => { c.faces[0].target = 'Bad Target'; }))!)).toMatch(/face/i);
    expect(speak(charterProblem(broken(c => { c.faces[1].site = c.faces[0].site; }))!)).toMatch(/face/i);
    expect(speak(charterProblem(broken(c => { c.faces[1].door = 'nope'; }))!)).toMatch(/face/i);
    expect(speak(charterProblem(broken(c => { c.firebase.projectId = 'P'; }))!)).toMatch(/project/i);
    expect(speak(charterProblem(broken(c => { c.firebase.web.apiKey = ''; }))!)).toMatch(/project/i);
    expect(speak(charterProblem(broken(c => { c.keeper.email = 'nobody'; }))!)).toMatch(/keeper/i);
    expect(speak(charterProblem(broken(c => { c.push.publicKey = 'short'; }))!)).toMatch(/push/i);
  });

  it('a node without push yet is still sound', () => {
    expect(charterProblem(broken(c => { c.push.publicKey = ''; }))).toBeNull();
  });
});

describe('what the charter derives', () => {
  it('answers at exactly the hosts the seed answered at by heart before the charter', () => {
    expect(charterHosts(node)).toEqual([
      'enlightenednations.web.app', 'lifeseed-75dfe.firebaseapp.com', 'lifeseed-75dfe.web.app', 'lifeseed.online',
      'lightseed.online', 'mamaway.web.app', 'perauset.com', 'perauset.web.app', 'seed.theohouse.org', 'theohouse.org',
      'theohouse.web.app',
    ]);
  });

  it('speaks from its own origin, knows its own domains and each face\'s door', () => {
    expect(charterOrigin(node)).toBe('https://lightseed.online');
    expect(charterOwnDomains(node)).toEqual(['lightseed.online', 'lifeseed.online']);
    expect(charterFaceDoor(node, 'theohouse')).toBe('seed.theohouse.org');
    expect(charterFaceDoor(node, 'nowhere')).toBe(null);
  });

  it('tells a stranger only what a stranger may know', () => {
    const pub = charterPublicOf(node) as Record<string, unknown>;
    expect(pub).toMatchObject({ nodeLid: node.nodeLid, domain: 'lightseed.online', push: { publicKey: node.push.publicKey } });
    expect(JSON.stringify(pub)).not.toContain(node.keeper.email);
    expect(JSON.stringify(pub)).not.toContain(node.firebase.web.apiKey);
    expect('firebase' in pub).toBe(false);
  });

  it('implies the hosting targets and one hosting entry per face', () => {
    expect(firebasercOf(node)).toEqual({
      projects: { default: 'lifeseed-75dfe' },
      targets: { 'lifeseed-75dfe': { hosting: { app: ['lifeseed-75dfe'], perauset: ['perauset'], theohouse: ['theohouse'], enlightenednations: ['enlightenednations'], mamaway: ['mamaway'] } } },
      etags: {},
    });
    const hosting = hostingOf(node, { predeploy: 'npm run build', public: 'dist', rewrites: [{ source: '**', destination: '/index.html' }] });
    expect(hosting.map(h => h.target)).toEqual(['app', 'perauset', 'theohouse', 'enlightenednations', 'mamaway']);
    expect(hosting[0]).toMatchObject({ target: 'app', predeploy: 'npm run build', public: 'dist' });
    expect(hosting[3]).toMatchObject({ public: 'dist', target: 'enlightenednations' });
    expect('predeploy' in hosting[3]).toBe(false); // face-og dresses the other faces between deploys
  });
});

describe('the files that must agree with node.json (scripts/charter-sync.mjs)', () => {
  const read = (rel: string) => JSON.parse(readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8'));
  it('the server\'s copy is the charter itself', () => {
    expect(read('functions/src/charter.json')).toEqual(node);
  });
  it('the public envelope is what the law says a stranger may know', () => {
    expect(read('public/.well-known/lightseed.json')).toEqual(charterPublicOf(node));
  });
  it('.firebaserc and firebase.json hosting follow the faces', () => {
    expect(read('.firebaserc')).toEqual(firebasercOf(node));
    const hosting = read('firebase.json').hosting as Array<Record<string, unknown>>;
    expect(hosting.map(h => h.target)).toEqual(node.faces.map(f => f.target));
    const { target: _t, ...template } = hosting[0];
    expect(hosting).toEqual(hostingOf(node, template));
    expect(hosting.slice(1).every(h => !('predeploy' in h))).toBe(true);
  });
});

describe('the functions mirror stays true', () => {
  it('judges and derives identically', () => {
    for (const c of [node, broken(c => { c.faces = []; }), broken(c => { c.keeper.email = 'x'; }), broken(c => { c.push.publicKey = ''; })]) {
      expect(sCharterProblem(c)).toBe(charterProblem(c));
    }
    expect(sCharterHosts(node)).toEqual(charterHosts(node));
    expect(sCharterOrigin(node)).toBe(charterOrigin(node));
    expect(sCharterOwnDomains(node)).toEqual(charterOwnDomains(node));
    expect(sCharterFaceDoor(node, 'perauset')).toBe(charterFaceDoor(node, 'perauset'));
    expect(sCharterPublicOf(node)).toEqual(charterPublicOf(node));
  });
});
