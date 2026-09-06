# ARCHITECTURE: how it currently lives

The current organism: systems, boundaries, data flow, interfaces.

When architecture drifts from implementation, the code reveals the CURRENT
BEHAVIOR, not necessarily what the community intended, what life needs, or
what should happen next. When behavior drifts from the root or from lived
reality, the contradiction must be surfaced and consciously resolved. Sometimes
experience reveals the flaw before a test does; sometimes a vulnerable person
sees the danger before the maintainer understands the code; sometimes a tree
dies while every gate remains green. No layer is supreme in isolation.

## Stack

React 19 + TypeScript (full strict) + Vite + Tailwind, as a PWA
(`vite-plugin-pwa`, prompt-style updates via `UpdateToast`). Firebase: Firestore
(`ignoreUndefinedProperties: true`), Auth (dynamic authDomain per hosted domain),
Storage, Functions, multi-site Hosting (`app` → lifeseed-75dfe, `perauset`).

**The charter (ring 2026-09-06).** `node.json` at the repo root says what THIS node is: its
lid, name, domain and aliases, keeper, mail, push public key, Firebase project / bucket /
region / web config, and its faces (hosting target, site, the door each wears, custom
domains). The law is `src/domain/charter.ts` (validation and every derivation: the hosts a
face answers at, the origin, the public envelope, the hosting targets); `functions/src/
charter.ts` mirrors it and reads `functions/src/charter.json`; `scripts/charter-sync.mjs`
writes that copy, `public/.well-known/lightseed.json`, `.firebaserc` and the hosting entries
of `firebase.json`; `tests/charter.test.ts` holds mirror and copies true, and `npm run check`
refuses a tree out of step. Nothing in `src/` or `functions/` names the node by heart any
more. `scripts/create-node.mjs <charter> [--apply]` walks a charter to a living node — project,
web app, database, sites, secrets, sync, three deploys, custody — and says out loud the steps
only a console can take.
Leaflet is bundled from npm, lazy-loaded on first map render (`services/leaflet.ts`).

## Layers: the dependency direction

```
domain/     pure rules, no backend, no React: ALWAYS testable (tests/ mirrors it)
adapters/   the Store port (firestoreStore: links CRUD by deterministic id)
services/   Firebase aggregates (barrel: services/firebase.ts) + weather, refreshBus
hooks/      session (useLifeseed → SessionContext), feeds, facts, visible-lightHouses
components/ the faces; components/sections/ = the shared Being anatomy (8 organs)
pages/      tab-level shells; App.tsx is the single conductor (overlays, routing)
```

New logic starts in `domain/` with a test. UI reads domain truths; services carry
them; nothing in `domain/` imports upward.

## The collections (see /model in the app: the crystal)

`persons` `users` `admins` `config`: identity & account. The public, server-owned
`config/dataAuthority` singleton names the portable LID of the node governing
this backend (`version: 1`, `nodeLid`); browser clients cannot write it. A
person's signing history lives below `persons/{uid}` as append-only `keys` and
`keyEvents`; `keyRecoveries/{id}/witnesses/{uid}__{epoch}` holds the social recovery
proof, while the person doc names only the current epoch and active/frozen state.
`lifetrees`: the seed beings; chain fields frozen; provenance (`plantedAt`+coords).
`pulses`: one ledger for growth/care/events/decisions/reaches/offerings; an offering may carry
`offeringAppreciationLight` (suggested after-gift, never admission).
`links`: the LIN: `from__rel__to`; rels: guardian, co_owner, steward, observer,
member, joined, participant, join_request, **rooted** (Light House→tree),
**shelters** (Light House→community), **invited_by** (newcomer→community; append-only
provenance, grants nothing; see domain/communityDoor), and the first **Interbeing Matrix**
attestations (`collaborates_with`, `recognises`, `shares_resources_with`; community→community).
Doc id MUST equal `from__rel__to`
(rules bind it: authority is resolved by path, so an unbound id would be forgeable).
`visions` `communities` (bearing the **door**: open/invite/closed) `lightHouses`
`stays` `alignments` `supports` (server-only)
`intelligences` `personas` `memories` `providerCredentials`: the intelligence commons.
`networkInvites` `communityInvites` (shareable /i/ door keys; revoked, never deleted)
`treeOwnershipInvites` `communityTreeInvites` `inviteRequests`.

## Rules philosophy

Queries must be **provable**: list queries carry the constraints the rules demand
(visibility filters for the signed-out, `hostUid`/`participantUids` for inboxes).
Vision lists are a source-level union: public visitors query `public`; signed-in
viewers query `public` + `node` (until node membership becomes real) and merge
their own author-scoped records; staff may read the field. The rules deliberately
keep absent-visibility compatibility for a direct `get`, never for an
unconstrained `list` that could sweep private records.
Fine-grained gates live as pure domain functions (`canViewTree`,
`canViewLightHouse`, `canView` for pulses) mirrored by the rules; overlay updates
are constrained to exact key sets via `diff().affectedKeys().hasOnly(...)`.
Deterministic link ids make ownership checks O(1) (`exists(links/uid__rel__id)`).
Love is stronger than an overlay-key fence: rules couple the private `loves/{uid}`
slot to exactly +/- one on the parent's tally with `existsAfter` / `getAfter`, in
the same transaction. Neither slot nor count may move alone; pulse slots are
own-slot private too. The love-update branch repeats the parent's visibility gate,
so a known private id cannot be touched as an existence probe. Love has no economic
side effect: neither the being nor pulse path mints a token, ray, balance or reward.

## Flows worth knowing

- **Backend authority and the crown**: `config/dataAuthority` states which node
  governs this database. The shell compares its `nodeLid` with the hosting
  community's own LID and derives the last menu name without hostname inference:
  a different LID is **The Host** (a community domain on its parent node's data);
  the same LID is **The Node**, or **The Hub** when that community chooses public
  reflection. Missing or malformed authority makes no claim and remains
  **About**. The record is public so a signed-out visitor receives the same truth,
  but server-owned so a community cannot click itself into sovereignty.
- **Domain scoping**: every domain community begins scoped. Only an explicit
  `community.reflectsPublic == true` opens its authority backend's public forest;
  absent and false remain closed. Feeds carry this choice as one query signal:
  a domain means `domain == community.domain`, while no domain means reflection.
  No hostname inherits a data role. The seed-shell aliases remain for branding
  and local-development behavior only. A Host may reflect without becoming a
  Node; custody, not visibility, governs the crown. Custom landings remain
  community DATA.
- **The map**: pixel-space clustering (50px) over trees + Light House pseudo-beings;
  Light Houses seed clusters (lighthouse precedence); Seed-of-Life petal expansion;
  popups via Leaflet autoPan (bottom-anchored popups can never flip; don't try).
- **Refresh bus** (`services/refreshBus.ts`): mutation sites `announce(topic, id?, patch?)`;
  mounted views re-fetch, an edit's patch merges into loaded copies, and a patchless id
  prunes (so an edit must never announce twice). `mintPulse` announces the tree's new head;
  the shell merges it into the open tree and the profile's chain reloads when `latestHash`
  moves (the chain follows the head, ring 2026-09-03).
- **Being links**: `/b/<lid>` resolves permission-aware across collections
  (`findBeingByLid`) and opens the right profile; QRs are minted lazily onto docs.
- **Interbeing Matrix**: a community's founding owner or `keeper`-link peer proposes a typed
  relationship by minting its directed LIN edge (door stewards do not carry the outward voice).
  The other community acknowledges with its own reverse edge;
  reciprocity is pure derived state, never an ownership or acceptance field. The community
  profile's Interbeing section is the first end-to-end face. Domains are displayed as honest
  self-declared external anchors; verification remains a named future boundary. See
  `root/INTERBEING_MATRIX.md` for the plain contract.
- **The signing crystal**: first publication atomically anchors current key,
  lineage and epoch. V3 covenant/decision seals carry fingerprint + epoch and
  receive server time at rest. Routine rotation is old/new cross-signed in a
  callable; account access may only freeze; recovery activation requires three
  current witness signatures rooted in initiation or validated lifetrees.
- **The White Paper**: the About page bundles these exact root/ documents at
  build time (`?raw` imports); the deployed node carries the constitution it
  grew from, inspectable by anyone it serves.
- **The gate**: `npm run check` = tsc + eslint + vitest (unit), `npm run test:rules`
  = emulator suite. Deploy: `npm run build && firebase deploy --only
  hosting[,firestore:rules,functions]`. The firebase CLI is Homebrew-owned.

## Known debts (kept honestly)

- Backend custody is now explicit, but backend division is not: hosted domains
  still share their authority node's instance-wide Auth and database. The next
  boundary is a self-describing export/import and independent backend bootstrap;
  only after data actually moves may a former Host declare itself a Node.
- Key epochs are append-only and server-timed. New signatures bind fingerprint +
  epoch in their v3 payload and land with `recordedAt == request.time`; planned
  rotation is old/new cross-signed; account access may freeze but never replace;
  recovery needs three distinct initiated/validated-tree witnesses. Historical v2
  signatures remain readable without pretending they acquired a trustworthy
  receipt time after the fact. Explicit re-affirmation of disputed seals is not
  yet a product surface.
- Client-side visibility gates (trees, Light Houses) await full rules parity.
- Light House step-in consent is keeper-side only since the shelters migration.
- Mother-tree badge lives on the tree page only (no denormalised flag yet).
- Payments, hosted-AI node credential, and the AI-need chooser are scaffolded,
  not live (see ROADMAP).
- **Being births are not uniformly bound to their claimed hands.** Broad create
  paths for lifetrees, visions, pulses, communities, Light Houses, alignments and
  intelligences do not all bind ownership/authorship or safe birth defaults in the
  rules. In particular, a direct client can claim another owner/author or create a
  lifetree already validated. Close at CREATE with schema keysets and emulator tests
  before new Being kinds grow (first-sight ring, 2026-08-12).
- **Append-only is not yet system-wide.** The general pulse delete path still admits
  deletion of some chain blocks; vision deletion attempts to remove contributions;
  and explicit care advances a tree's head without persisting the described care
  block. Draft/mint/mark/release lifecycles need one exact law per chain-bearing type
  (first-sight ring, 2026-08-12).
- Ordinary block birth is client-computed and not checked by Firestore against a
  server-held head. Canonical verification proves stored-byte consistency, not by
  itself authorship, lawful creation or lived truth (first-sight ring, 2026-08-12).
- Load-bearing contracts remain manually mirrored across domain code, Firestore
  rules and the isolated Functions package. The light mirror test is one good seam;
  visibility, signing preimages, field sets, caps and lifecycles need equivalent
  conformance (first-sight ring, 2026-08-12).
- Pure-law and rules tests are stronger than the assembled experience: there is no
  automated component/end-to-end walk, and sparse event/offering feeds filter a
  bounded general-pulse sample, so real items can fall outside it as activity grows
  (first-sight ring, 2026-08-12).
- Layering is directional but incomplete: the Store port covers links, and the
  shell, Functions entry point and Firebase services remain large policy
  conductors (first-sight ring, 2026-08-12). CLOSED 2026-08-14: the domain layer
  itself is now import-sealed — zero imports from outside `src/domain/` (the
  `Stamp` time port replaced Firestore `Timestamp`; `words.ts` owns the key
  manifest the dictionary proves coverage of; the block hash lives in
  `chain/hash.ts`) — the `@lightseed/domain` extraction is a folder-move away.
- Scoped feeds paginated in document-id order (no createdAt composite for domain-scoped
  queries). CLOSED 2026-09-03: the `domain[, type][, visibility] + createdAt DESC` composites
  exist for pulses, trees and visions; every feed orders on the server, with an
  index-building fallback that ends pagination rather than continuing in the wrong order
  (`tests/indexes.test.ts` holds the index file to the queried shapes).
- **A reflecting node's own node-level items are absent from its feed.** Reflection queries
  PUBLIC only across the instance, so items at `node` visibility on the reflecting node itself
  are not shown there; a union (public anywhere + node here) needs two queries merged
  (ring 2026-09-03).
- Power is visible but broad: staff retain general mend/delete escape hatches. The
  present boundary is stewardship by known people, not resistance to stewards;
  retire broad powers into named capabilities over time (first-sight ring,
  2026-08-12).
