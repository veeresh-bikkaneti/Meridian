# General Knowledge Spec — a mixed review round across subjects

> **Mission (owner, 2026-11-10):** most children don't understand why they
> learn multiplication, division, algebra and trigonometry. Every unit opens
> with a real problem that needs the skill, then teaches it, then has the
> child use it in another subject.

## Header

| Field | Value |
|---|---|
| Topic | General knowledge, **reframed (Stage A, 2026-11-10)** as a mixed review round that re-deals items the child already met in other subjects, so one skill shows up in several places (plan `docs/scaling/plans/feat-general-knowledge-spec.md`; map `subject-progression-map.md`, "General knowledge becomes the mixed review across the whole chain") |
| Status | **GATED.** Stage A (spec and data) done on this branch; Stage B (build) waits for the owner to lift the build gate for this branch. Educator seat vacant: no named educator has signed the rubric. |
| Branch | `feat/general-knowledge-spec` (stays open until dev work is complete) |
| Contract | I2 unit items (`docs/scaling/contracts.md`); I1 subject module and I3/I4 for Stage B only |
| Item counts | **PROPOSED:** 11 mixed-review items (6 for 7-10, 3 for 10-18, 2 for 18+), 6 geography fixtures, 5 example rounds. Not decided; the educator and owner set the real counts. |
| Data | `docs/scaling/general-knowledge/items.json` (mixed-review items), `fixtures/geography.items.json`, `rounds.json`; validator `items.test.mjs`; sources `sources.md`; council `council.md` |
| Spec date | 2026-11-10 |

## 1. The reframe — what a general-knowledge round is

A general-knowledge round is **not new trivia**. It deals 2–3 cards, each a
skill the child already met in another subject, now used in a new setting on
the globe (standard §4, "Interleave"; map, cross-application web):

- A **math** skill (subtracting, comparing, converting units, ratio, rate,
  trigonometry) is applied to a **geography** place from the existing globe
  deck (the Eiffel Tower, Sydney Opera House, Victoria Falls, Mount Everest in
  `src/game/starters.ts`).
- A **physics / earth-science** idea (shadows through the day) is applied to
  the same places.
- Each card's `buildsOn` points by id at the items it re-uses. Math links to
  the real number-strand data on main (`docs/scaling/math/number/items.json`)
  and physics to the real physics data on main (`docs/scaling/physics/items.json`,
  PR 398); geography links to fixtures in `docs/scaling/general-knowledge/fixtures/`
  until those subjects publish their own I2 items (contracts "copy the shape
  until the owning stream merges"). When they land, the fixture ids are
  swapped for the real ones and the fixtures are deleted.
- A round never mixes in a card above the child's group, mixes at least two
  source subjects, and never drills one skill (checked by the validator).
- Misses go to the **existing** review deck on the same `[0, 1, 3, 7, 14, 30]`
  day ladder, keyed by the item id (standard §4; contracts I2). Wiring subject
  items into `src/game/review-deck.ts` is integrator-only; until then the
  module keeps misses in its own state.

**Why this reframe.** The plan review (`k12-plan-review.md`, GK row) found
"mixed review of other subjects may serve better than new trivia", and the
map names general knowledge as the mixed review. It also shrinks the surface
for unsourced facts: every fact here is already sourced by its place or
subject, and the round only adds the computation.

## 2. Items (data in `general-knowledge/items.json`, PROPOSED)

Every item carries an observable objective with "shown by", a standard code
read live (or UNVERIFIED with a Fit note), the real problem that opens it,
its group, Builds on, and one use-it-elsewhere setting from the map's web.
The table is generated from the data; the data wins if they ever differ.

| Item | Group | Standard | Re-uses from | Builds on | Use it elsewhere |
|---|---|---|---|---|---|
| `general-knowledge:mixed:opera-years-ago` | 7-10 | 4.NBT.B.4 | geography, math-number | `geography:globe:sydney-opera-house`, `math-number:place:hundreds-tens-ones` | geography: placing landmarks on a timeline by how many years ago they opened |
| `general-knowledge:mixed:eiffel-antennas` | 7-10 | 4.NBT.B.4 | geography, math-number | `geography:globe:eiffel-tower`, `math-number:place:hundreds-tens-ones` | everyday life: finding how much higher a stack of boxes gets when one more box goes on top |
| `general-knowledge:mixed:older-landmark` | 7-10 | 4.NBT.A.2 | geography, math-number | `math-number:place:compare`, `geography:globe:eiffel-tower`, `geography:globe:sydney-opera-house` | geography: putting two events in time order on a timeline |
| `general-knowledge:mixed:falls-in-km` | 7-10 | 4.MD.A.1 | geography, math-number | `geography:globe:victoria-falls`, `math-number:place:compare` | everyday life: reading a trail sign in kilometres next to a map scale in metres |
| `general-knowledge:mixed:trip-buses` | 7-10 | 4.OA.A.3 | geography, math-number | `math-number:division:remainders`, `geography:globe:victoria-falls` | geography: planning a class trip to a place on the map |
| `general-knowledge:mixed:noon-shadow` | 7-10 | 5-ESS1-2 | geography, physics | `physics:shadow:blocks`, `geography:globe:eiffel-tower` | everyday life: reading the time from a sundial shadow |
| `general-knowledge:mixed:everest-vs-falls` | 10-18 | 6.RP.A.3 | geography, math-number | `geography:globe:everest`, `geography:globe:victoria-falls`, `math-number:division:two-digit-divisors` | geography: comparing the sizes of landforms on the globe |
| `general-knowledge:mixed:paris-sydney-flight` | 10-18 | 6.RP.A.3 | geography, math-number | `geography:globe:eiffel-tower`, `geography:globe:sydney-opera-house`, `math-number:fractions:percent` | physics: speed = distance ÷ time for a ball rolling down a ramp |
| `general-knowledge:mixed:tower-angle` | 10-18 | HSG-SRT.C.8 | geography | `geography:globe:eiffel-tower`, `general-knowledge:mixed:eiffel-antennas` | geography: finding the height of a mountain from an angle and a distance |
| `general-knowledge:mixed:great-circle` | 18+ | UNVERIFIED | geography | `general-knowledge:mixed:tower-angle`, `geography:globe:everest`, `geography:globe:victoria-falls` | geography: why flight paths drawn on a flat map look curved |
| `general-knowledge:mixed:falls-flow` | 18+ | UNVERIFIED | geography, math-number | `math-number:place:scientific`, `geography:globe:victoria-falls` | everyday life: comparing a household's water use per day with one second of the falls |

### Fixtures (stand-ins until the owning subject publishes I2 data)

| Fixture | Group | Standard | Stands in for | Use it elsewhere |
|---|---|---|---|---|
| `geography:globe:eiffel-tower` | 7-10 | D2.Geo.3.3-5 | geography fixture | geography: reading a city map to find a landmark |
| `geography:globe:sydney-opera-house` | 7-10 | D2.Geo.3.3-5 | geography fixture | geography: using a globe to tell which half of the world a city is in |
| `geography:globe:victoria-falls` | 7-10 | D2.Geo.3.3-5 | geography fixture | geography: following a river on a map to the place where it falls |
| `geography:globe:everest` | 7-10 | D2.Geo.3.3-5 | geography fixture | geography: finding mountain ranges on a relief map |
| `geography:globe:angkor` | 7-10 | D2.Geo.3.3-5 | geography fixture | geography: locating a stone complex on a map of Cambodia |
| `geography:globe:uluru` | 7-10 | D2.Geo.3.3-5 | geography fixture | geography: finding a desert landform on a map of Australia |

Geography fixture ids map to the live globe deck: `geography:globe:eiffel-tower`
= `globe-eiffel-tower`, `geography:globe:sydney-opera-house` =
`globe-sydney-opera-house`, `geography:globe:victoria-falls` =
`globe-victoria`, `geography:globe:everest` = `globe-everest`,
`geography:globe:angkor` = `globe-angkor`, `geography:globe:uluru` =
`globe-uluru`. The earlier
physics fixture `physics:light:shadow-noon` was removed (integrator fix,
2026-11-10): `noon-shadow` now builds on the real `physics:shadow:blocks`
(light is blocked to make a shadow, 4-PS4-2) from `docs/scaling/physics/items.json`.

### Example rounds (`rounds.json`, PROPOSED)

Five example rounds show the interleave rule (two for 7-10, two for 10-18,
one for 18+). In v1 the round is dealt from the child's own due and mastered
items, not from a fixed list.

### Problem numbers

Some hooks need numbers that are not facts (bus seats, a steady plane speed,
a distance and an angle). Each such item says so in its `why`, and the host
says "numbers for this problem" on screen. Every real fact and every worked
answer is in `general-knowledge/sources.md`.

## 3. How a card plays (standard §3 loop)

1. **Hook (why first, within 5 seconds):** the real problem from `why`, with
   the place on the globe (Flat tier: 2D map pin).
2. **Predict / attempt:** tap one of 3–4 answers (7-10: pictured choices, no
   typing beyond a number pad; no timer).
3. **See:** the globe flies to the place and the answer is shown as motion:
   two bars for 1,708 m vs 2,000 m, the antennas growing 59 feet, a shadow
   sweeping to its shortest point.
4. **Explain:** the host wrap-up retells why in one or two sentences at the
   group's reading level (owner's host rule; whether it is a clip or real-time
   animation is owner decision D3).
5. **Retry or move on:** one retry with a hint, then the card goes to the
   review deck.

**Confident bar (PROPOSED):** correct on the first try with no hint, in a
round where the card was mixed with at least one other skill. Because the
card is a use-it-elsewhere setting, a confident hit counts as one of the "two
different settings" a skill needs to reach Mastered (standard §0).

## 4. K-12 standard block (§9)

```
K-12 STANDARD (docs/scaling/k12-learning-design-standard.md)
- Why first (§0): unit opens with a real problem that needs the skill; "why does this matter?" answered in the first minute: [x] every item's `why` is the opening problem; the host answers it at Explain
- Headline goal (§0): bridge to the previous subject + playable real-life application: [x] bridge = `buildsOn` into math, geography and physics items; application = a real place on the globe
- Use-it-elsewhere round in at least one other subject (cross-application web): [x] every item has one `useElsewhere` setting from the map's web; the round itself is a use-it-elsewhere setting for the source skill
- Bands served: [x] 7-10, 10-18, 18+ — revision is useful at every level; 7-10 stays concrete (no algebra, trigonometry, rates or formulas, checked by the validator), 18+ gets haversine and powers of ten
- Objective per item, observable verb, "shown by": [x] all items (validator)
- Standards cited per item (CCSS / NGSS PS / C3 / NGS) or UNVERIFIED: [x] CCSS, C3 and one NGSS earth-science code read live 2026-11-10; two 18+ items UNVERIFIED with a Fit note
- Loop mapped: hook / predict / see / explain / retry: [x] §3 above
- Mastery "confident" bar for this subject: [x] PROPOSED in §3
- Review-deck hookup (same deck, same ladder): [x] §1; wiring is integrator-only
- Post-clip retrieval check (journal + any video): [n/a] no clips in this mode; the host wrap-up follows an answered card, so the card itself is the retrieval
- Motion tiers: Full / Lite / Flat described, learning parity stated: [x] §5
- Accessibility: captions, tap alternative, no-timer default, SR live region: [x] §5
- Privacy: no PII, no identifiers, local-only records: [x] §5; "years ago" answers are `currentYear − X`, with currentYear read from the device clock at play time (owner ruling, 2026-11-10), never a literal year; no item asks an age
- Content screen (§7a) passed; cut items logged with reason: [x] §6 CUT log
- Free: no revenue features; asset licences recorded: [x] no new assets in Stage A; Stage B reuses the globe and house art
- Educator rubric (docs/scaling/educator-gate-rubric.md) attached: [ ] OPEN — no named educator; sign-off block in §9 is blank
```

## 5. Motion tiers, accessibility, privacy

- **Full:** the existing three.js globe (dynamic `import("three")`, as in
  `home-globe.tsx`) flies to the place; bars, heights and shadows animate on
  the house easing curves (`motion-tokens.css`). **Lite:** same scene, low
  poly, no shadows or post-processing, 30 fps cap. **Flat:** a 2D map pin and
  stepped SVG diagrams (two bars, a before/after tower, three shadow
  pictures). Same question, same numbers, same scoring in every tier.
- `usePrefersReducedMotion` switches to Flat transitions; nothing flashes
  more than 3 times a second.
- Every prompt is read aloud (on by default for 7-10) and has text; every
  answer is a tap target ≥ 44px with a keyboard path; no timers in 7-10 and
  optional elsewhere; the canvas has a live region ("The pin landed on
  Victoria Falls").
- No accounts, names or free text; records stay in `localStorage`; the round
  makes no network call with learning data (standard §7).

## 6. Content screen (§7a) and CUT log

The six fixtures passed the screen. The original four are each a place and
an achievement told through a sourced number. Angkor Wat and Uluru are kept
as place-only entries (owner, 2026-11-10, PRs 399 and 416): architecture and
geography only, with no religion, belief, ritual or sacred status, and no
distance, height or depth in any story line. Mount Everest is kept 2–1 on
the condition that only the 2020 survey height and the location are used
(council C6).

Globe-deck places **cut** from fixtures (when in doubt, leave it out):

| Place in the deck | Reason |
|---|---|
| Ahu Tongariki, Chichén Itzá, Machu Picchu | Story centres on temples, epics or ceremonial sites (religion) |
| Giza Plateau | Royal burial monuments; the story is hard to tell without belief (doubt) |
| Petra | Not needed for v1; facades include tombs (doubt) |
| Serengeti, Puerto Ayora | Wildlife and tortoises (no biology) |
| Statue of Liberty | A national political symbol; the name invites politics (doubt) |
| Oia, Gullfoss | Kept for later: no sourced number fetched yet for a computation |

No item mentions religion, sexuality or gender identity, current or contested
politics, living things, war, or a child's age; the validator bans those
words in item text.

## 7. Earlier scope (P10 / P11 / P12)

The earlier version of this spec (2026-11-10) defined three owner-picked
options ("All 3", 2026-11-07): P10 trivia quiz, P11 current affairs, P12 GK
detective. The reframe above replaces the P10 trivia bank with the mixed
review round for v1 (council C1).

- **P12 GK detective** stays a later mode on the GeoDetective machine; its
  game design document remains a signed gate before any code.
- **P11 current affairs** is dropped. **G2 ANSWERED (2026-11-10):** P11 is
  out of scope under §7a (current or contested politics). The `{p11}`
  placeholder is removed.

## 8. Stage B (build) — GATED

Not started. Starts only when the integrator says the owner lifted the build
gate for this branch. Plan, unchanged from the branch plan: a subject module
at `src/subjects/general-knowledge/index.ts` (contract I1) with
`released: false`, reading I2 items from every registered subject (fixtures
until they land), Full / Lite / Flat with the same learning, tests first, all
`AGENTS.md` gates, and a screen recording. Until Phase 0 merges, proof is
tests plus a local harness that is not committed.

## 9. Educator sign-off (blank — gate stays shut)

```
EDUCATOR SIGN-OFF
Spec: docs/scaling/general-knowledge-spec.md + docs/scaling/general-knowledge/** @ [commit]
Signer: [name], [role], [band(s)], [subject]
Date: [YYYY-MM-DD]
Result: Approved / Approved after fixes / Not approved
Fixes: [list with owner]
Signature (typed name is fine): [ ]
```

## 10. Open questions for the owner

**G2 ANSWERED (2026-11-10):** P11 current affairs is out of scope under §7a
and is dropped. See §7.

1. **G1 (educator):** who signs the rubric for general knowledge? The signer
   must cover math, geography and earth science, or two signers sign.
2. **G3 (placement):** is general knowledge its own subject card, or a mode
   inside the existing "Review my misses" deck?
3. **G4 (counts):** the item, fixture and round counts are PROPOSED.
4. **G5 (curriculum):** CCSS, C3 and NGSS are US frameworks; which non-US
   equivalent should the topic map also name (standard §2 world-view rule)?
5. **G6 (units):** the official Eiffel Tower heights are in feet on its
   English page; the other places use metres. Keep each fact in its source's
   unit, or convert?
6. **G7 (source host):** this branch cites the CCSSO PDF for CCSS because the
   math strand's host blocked this agent; should all subjects use one host?

## 11. UNVERIFIED log

- Item counts: PROPOSED, not decided.
- `general-knowledge:mixed:great-circle` and `general-knowledge:mixed:falls-flow`: standard UNVERIFIED (18+, no single school code; Fit notes in the data).
- Mount Everest height: MEDIUM confidence (secondary source citing the 2020 joint survey reports).
- Earth's mean radius: MEDIUM confidence (secondary source citing IUGG).
- Readability of host lines: not measured in Stage A (no host lines written yet).
