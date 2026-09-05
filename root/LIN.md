# LIN: what world we are creating

The seed: purpose, ontology, principles, language, invariants.
The evolving interpretation of the promise in `GENESIS.md`.

## Ontology: Indra's net

**Everything is a Being.** Every jewel is different, and every jewel reflects all
the others the same way. A Being has four aspects (`src/domain/being.ts`):

| Aspect | What | Where |
|---|---|---|
| **True name** | `lid`: UUIDv7, birth-time in its first bits, portable across nodes and years | every stored doc |
| **Story** | its chain: hash-linked pulses, append-only, unerasable | `pulses`, `domain/chain.ts` |
| **Circle** | its links: relations as entities, never arrays | `links` collection (the LIN) |
| **Face** | its profile: the shared anatomy of sections | `components/sections/` |

Humans, AIs, communities, nodes, trees, Light Houses, visions, events, pulses:
all Beings. Any intelligence can log in. Composite beings (communities, nodes)
additionally grow a **Council**, the organ by which many become one voice.

## Principles

1. **Quality, not quantity.** A being may plant as many personal lifetrees as
   there are UN member states (193 today): one tree to a country, one lightseed
   citizenship each. The personal cap is the Earth. Guarding stays intimate at
   132 trees, a circle where every being can be known. Growth happens by
   division (and intimacy), like Pando: one root system, many stems, each close
   enough to touch.
2. **Links, not arrays.** A relationship is itself an entity in the `links`
   collection with deterministic ids (`from__rel__to`). The only arrays permitted
   are rules-ACL denormalisations (e.g. `participantUids` on private reaches).
3. **The chain is append-only.** Nothing on a chain is ever rewritten or deleted;
   wrong things are *marked* (the guardian veto), never erased.
4. **Private by default, sensitive to light.** Opening something to the world is
   a deliberate act; some parts can be harmed by a gaze they are not ready for: a
   play copied before its story is whole. Two dials, kept apart: how far a being's
   own content *reaches out* (community → node → public), and how much of the
   wider public forest a node *reflects in*. A **node** is the sovereign data and
   governance boundary: its community holds and governs its own forest database.
   A **host** is a community portal on its own domain whose data is still held by
   a parent node; an address and community face are real, but they do not pretend
   to be data sovereignty.
   A **hub** is always a node — a sovereign place with its own data whose
   community has chosen to act as a portal onto the wider public forest.
   Reflection is a reversible community decision, not a different infrastructure
   class or a rank. Every hub is a node; not every node is a hub. Commons is a
   **mode, not a place**: a node may open that window or remain a scoped pond
   (Indra's net); there is no privileged hub.
5. **Data, not code.** Organisations get landings, themes, pages as *data*,
   never per-org source files.
6. **Paper outlives databases.** Every being carries a QR with its lid
   (`/b/<lid>`), the offline/online bridge.
7. **Light Houses root in trees, never before them.** A Light House is never built
   before a tree is planted; the tree that holds one becomes a **mother tree**.
8. **The care economy pays people, not platforms.** A yearly care price protects
   one tree; the price is a GLOBAL parameter of the instance, set by the
   instance covenant / board (21 at birth), split along 15/3/3: to the carer,
   the community, the node (spent on intelligence). Whoever is a member before
   payments launch keeps today's functions free.
9. **Power is visible.** A staff-only capability wears the amber dot (SuperDot).
   Carrying a being's voice always names the carrier.
10. **The internet has no weather, only moods.** Physical reality is first-class:
    real coordinates, real EXIF moments, real fires at real Light Houses.
11. **Separate the portable from the local.** The lid is portable; the model is
    replaceable; the root is shared; the Light House is local; the tree is rooted;
    the community retains agency. Most of the architecture is this one
    separation, applied again and again.

## The loop

No layer is supreme in isolation:

```
root ↕ code ↕ experience ↕ living beings and place ↕ reflection ↕ new ring
```

The root expresses the best understanding so far. The code tests it. Experience
refines it. Living beings and places judge it in ways no gate can. Reflection
names what happened. The ring makes it history. Then the root grows clearer.

## Language

*tend* (care as action) · *mint* (seal a moment onto a chain) · *water* (the
photo-proofed care pulse) · *keeper* (a community's owner) · *guardian* (a
no-privilege follow that vows protection) · *validated = initiated* (standing
in the web of trust) · *Light House* (a sacred place that keeps a light for others:
a point of orientation on the map, rooted in a mother tree) ·
*mother tree* (a tree holding a Light House) ·
*bed* (a being: a Lifetree with a place to sleep, inside a Light House *or* loose under open
stars at a coordinate; each stay a leaf on its chain, each tender a guardian. Home is soft and
optional: a loose bed that gathers can **graduate**, its tree becoming the mother tree a Light
House roots into. Seed → bed → gathering → Light House) ·
*vision* (a being, the **idea-twin of a tree**: when a tree is planted its Root Vision is born the
*same moment*; matter and idea, they diverge, each growing its own chain: the tree's of tending,
the vision's of **contributions**. A vision keeps its tree as a **shadow** (`lifetreeId`), so the two
growths can be laid side by side and compared) · *the Light Path* (the onboarding
trail, ultimately each community's own ruleset) · *reach* (one being speaking
to another) · *carry* (lending hands to a being's voice, always disclosed) ·
*consecrate* (create a Light House) · *release* (delete one) · *step in* (a
Light House sheltering a community) · *the door* (a community's join state:
open / invitation / closed: who may enter, distinct from who may see) ·
*steward* (a delegated door-keeper: accepts knocks, mints invitations; shares
the door, not the deed) · *invited by* (append-only provenance: how a
being arrived; a mark, never a power; the inviter gains nothing through the
door) · *node* (a sovereign community with a domain and its own governed forest
database; the domain is its address, not the source of its sovereignty) ·
*host* (a community portal with its own domain whose forest data is governed by
a parent node; it becomes a node only after it holds and governs its own
backend) ·
*hub* (always a node: a portal with its own data, opened by its community's
choice to reflect the wider public forest) · *commons* (the hub mode, not a
place or rank: reflection may be opened or closed while the node remains) ·
*reflect* (a node showing another node's public content; Indra's net as a
community-governed setting) ·
*offering* (a bed or service today, any honest contribution in the wider pattern: opened by
trust, never purchased; it may name a **suggested appreciation** in light that follows AFTER
it is received, an agreement and not a gate) ·
*appreciation* (taking an offering with care: the mint event of light; an
offering untaken is a token, and taken it becomes a token of appreciation) ·
*offer to* (an offering of CARE made to a being — a tree or a vision — from one of
the offerer's own trees; it lives on its own leaf and waits there: a service, a bed, or
CODE, a pull request offered to the Code Tree) · *accept* (the receiver's hand — a
tree's keeper, co-owner or steward, a vision's author — saying yes on the leaf: the
agreement is minted as TWIN BLOCKS, one on the offerer's tree chain and one on the
receiver's own chain, each naming the other; no light moves at acceptance) ·
*withdraw* (the offerer taking an open offering back — a mark, never a delete; an
answered offering never moves again) ·
*kindle* (to bring new light into being by tending life: the only origin of
light; witnessed care, bounded by the tended being's own rhythms) ·
*ray* (a lid-bearing being born of appreciation: care's visible trace, branching
like lightning at prisms, fading by spreading; it purchases nothing, it only
shines) · *prism* (a station where a ray branches onward: watched and vetoable
as far as its source cares to see) · *glow* (a community's ambient light: the sum of the light that fades as it
CIRCULATES through it, present-tense, fading when circulation stops; it
animates, never fuels; a being's own kindled light stays private until it
flows in a community) ·
*the sustaining seven* (a being's floor: seven planted, witnessed, tended
trees, roughly what a body asks of the living world) · *dwelling* (49 days of
belonging in one community: seven dwellings and the festival days fill a year;
invited, never enforced) · *the Moment* (see GENESIS.md).

## Invariants: the reasons (these almost never change)

- **Life is primary.**
- **Communities retain agency.**
- **Models are participants, not authorities.**
- **Identity belongs to beings.** The `lid` is never recycled, never renamed,
  never derived from a database id.
- **Truth is traceable.** Chains are append-only; chain fields (`hash`,
  `previousHash`, `genesisHash`, `blockHeight`, `authorId`, chain `createdAt`)
  are frozen after creation; the Moment is golden
  (`GENESIS_MOMENT_MS = 1566149243000`, `domain/genesis.ts`).
- **The cap is the Earth, and intimacy.** As many personal lifetrees as UN member
  states (193 today, one citizenship-tree per country) and 132 guarded per being,
  enforced server-side (`functions/onLifetreeCreated`): the client gate is
  courtesy, the function is law.
- **Conscience is collective and non-destructive.** The guardian veto needs ALL
  eligible guardians (author excluded), within 72 hours, and marks, never deletes.
- **Understanding precedes action.** The reason under almost every practice:
  read the root, review deeply, ask before committing, ring after deciding,
  test before trusting. Don't move faster than understanding.

## Practices: the habits the invariants grow (excellent today, allowed to evolve)

- Read the root before acting; never silently contradict it; when the code
  reveals a better truth, propose a change to the root.
- Add a ring to `DECISIONS.md` after significant decisions. Correct with new
  rings, never rewrite: a knot isn't hidden; it's integrated.
- Green gates before merging: `npm run check`; rules changes also pass
  `npm run test:rules`.
- New logic begins in `domain/` as a pure, tested function.
- `ARCHITECTURE.md` is maintained beside the code, debts listed honestly.
- Deep roots permit greater speed: when first principles are clear, fewer
  decisions have to be rediscovered every week.
- **Every metaphor eventually points to code; every piece of code eventually
  points back to lived experience.** The poetry and the implementation must keep
  illuminating each other; a project that stops doing this is growing a
  mythology, not a root.
- **The code human translates, or becomes a priest.** One human who deeply
  understands the code may be enough for a small circle, but their
  understanding must continually flow into tests, architecture, readable
  explanations, review records, and teachable patterns. The ideal code human is
  not the only one allowed to see; they are responsible for helping everyone
  else see as far as they reasonably can.
