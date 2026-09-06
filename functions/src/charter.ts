// THE CHARTER, server side — the pure half, with the node's own charter beside it.
//
// Functions is its own TS project and cannot import src/domain, so this module MIRRORS
// src/domain/charter.ts (the shape, the refusals, the derived hosts and origin) and reads the
// node's charter from ./charter.json, a copy of the repo's node.json written by
// scripts/charter-sync.mjs. tests/charter.test.ts holds the mirror AND the copy true.
import charterJson from "./charter.json";

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const isLid = (value: unknown): value is string => typeof value === "string" && UUID_V7.test(value);

export interface CharterFace {
    target: string;   // the firebase hosting target (a short slug)
    site: string;     // the hosting site id (<site>.web.app)
    door: string;     // the community domain this face wears (its Open Graph card, its cradle)
    domains: string[]; // custom domains served by this site
}

export interface Charter {
    version: 1;
    nodeLid: string;
    name: string;
    shortName: string;
    tagline: string;
    description: string;
    domain: string;       // the node's own address (its origin, its community's domain)
    aliases: string[];    // other domains that are this node itself (not a face of another place)
    repo: string;
    keeper: { email: string };
    mail: { from: string };
    push: { subject: string; publicKey: string };
    theme: { color: string; background: string };
    firebase: {
        projectId: string;
        region: string;
        bucket: string;
        web: { apiKey: string; authDomain: string; messagingSenderId: string; appId: string; measurementId?: string };
    };
    faces: CharterFace[];
}

const DOMAIN_RE = /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/;
const SLUG_RE = /^[a-z][a-z0-9-]{1,30}$/;
const SITE_RE = /^[a-z0-9][a-z0-9-]{3,29}$/;
const PROJECT_RE = /^[a-z][a-z0-9-]{4,29}$/;
const VAPID_RE = /^[A-Za-z0-9_-]{87}$/; // an uncompressed P-256 point, 65 bytes, base64url

export const isDomainName = (v: unknown): v is string => typeof v === 'string' && DOMAIN_RE.test(v);

// Why this charter cannot stand yet, or null when it may — in the order a maker meets them.
export const charterProblem = (c: Charter): string | null => {
    if (c.version !== 1) return 'charter_version';
    if (!isLid(c.nodeLid)) return 'charter_node_lid';
    if (!c.name?.trim() || !c.shortName?.trim()) return 'charter_name';
    if (!isDomainName(c.domain) || !Array.isArray(c.aliases) || !c.aliases.every(isDomainName)) return 'charter_domain';
    if (!Array.isArray(c.faces) || c.faces.length === 0) return 'charter_faces';
    const targets = new Set<string>();
    const sites = new Set<string>();
    for (const f of c.faces) {
        if (!SLUG_RE.test(f.target || '') || !SITE_RE.test(f.site || '') || !isDomainName(f.door)) return 'charter_face';
        if (!Array.isArray(f.domains) || !f.domains.every(isDomainName)) return 'charter_face';
        if (targets.has(f.target) || sites.has(f.site)) return 'charter_face';
        targets.add(f.target);
        sites.add(f.site);
    }
    const fb = c.firebase;
    if (!fb || !PROJECT_RE.test(fb.projectId || '') || !fb.bucket?.trim() || !fb.region?.trim()) return 'charter_project';
    if (!fb.web?.apiKey?.trim() || !fb.web?.appId?.trim() || !isDomainName(fb.web?.authDomain)) return 'charter_project';
    if (!c.keeper?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.keeper.email)) return 'charter_keeper';
    if (!c.push || !c.push.subject?.trim() || (c.push.publicKey && !VAPID_RE.test(c.push.publicKey))) return 'charter_push_key';
    return null;
};

// Every host this node answers at: each face's web.app door, every named domain, the auth
// domain. A request from any other host is not one of ours (canonicalHost falls back to the
// node's own domain).
export const charterHosts = (c: Charter): string[] => {
    const hosts = new Set<string>([c.domain, ...c.aliases, c.firebase.web.authDomain]);
    for (const f of c.faces) {
        hosts.add(`${f.site}.web.app`);
        hosts.add(f.door);
        for (const d of f.domains) hosts.add(d);
    }
    return [...hosts].map((h) => h.toLowerCase()).sort();
};

export const charterOrigin = (c: Charter): string => `https://${c.domain}`;

// The domains that are the node ITSELF (its own shell, its own auth domain), as opposed to
// the faces of other places it hosts.
export const charterOwnDomains = (c: Charter): string[] => [c.domain, ...c.aliases];

// The door a face wears, by hosting target — what face-og bakes into that face's card.
export const charterFaceDoor = (c: Charter, target: string): string | null =>
    c.faces.find((f) => f.target === target)?.door ?? null;

// What a stranger may know: the node's public envelope at /.well-known/lightseed.json — the
// first sentence of nodes speaking to nodes.
export const charterPublicOf = (c: Charter) => ({
    version: c.version,
    nodeLid: c.nodeLid,
    name: c.name,
    shortName: c.shortName,
    tagline: c.tagline,
    domain: c.domain,
    aliases: [...c.aliases],
    repo: c.repo,
    faces: c.faces.map((f) => ({ door: f.door, domains: [...f.domains] })),
    push: { publicKey: c.push.publicKey },
});


export const charter: Charter = charterJson as Charter;
const problem = charterProblem(charter);
if (problem) throw new Error(`functions/src/charter.json is not a sound charter: ${problem}`);
export const NODE_ORIGIN = charterOrigin(charter);
