# Social Studies Spec: map-based mode

> **Map-based mode, Stage A (2026-11-10).** This is the plan for this
> branch. An earlier P5 draft (road rules, history, constitution picker)
> was removed from this file; git history keeps it. Its constitution picker
> is cut (see Cuts log).
> Status: **GATED** — no educator has signed `educator-gate-rubric.md`, and
> Stage B (build) waits for the owner to lift the build gate for this branch.
> Counts below are **PROPOSED**, not decided.

## Map-based mode: place, region, route, compare

**Mission fit.** Maps are where multiplication, division, ratios, algebra
(rates) and trigonometry (bearings) stop being school exercises: a scale bar
is multiplication, a travel time is division, a bearing is a right triangle.
Every item opens with the real problem that needs the skill, then teaches it,
then has the child use it in another subject ("use it elsewhere").

**Engine, read-only.** Reuse `distanceKm`, `initialBearing`, `windName8`,
`octantOf`, `formatDistance` in `src/game/geo.ts` and the map components in
`src/map/` (`satellite-map.tsx`, `pin-tap.ts`, `region-highlight.ts`). Nothing
there is edited. Four play verbs on that engine:

| Verb | What the child does on the map | Items (PROPOSED count: 17) |
|---|---|---|
| place | locate from clues, a grid reference, or coordinates | 3 |
| region | sort, measure area, compare crowding | 4 |
| route | scale to distance, distance to time, bearing | 7 |
| compare | pick the farther, the cheaper, the later | 3 |

Items are data in [`social-studies/items.json`](social-studies/items.json), in
the exact shape of contract I2 (`id`, `group`, `objective`, `standard`, `why`,
`buildsOn`, `useElsewhere`). Item ids are `social-studies:<verb>:<item>` and
stay stable forever. Groups: **7-10 = 7 items, 10-18 = 7, 18+ = 3** (PROPOSED).
No 7-10 item uses algebra or trigonometry; ids of other subjects in `buildsOn`
point at real ids from `math/number/items.json` and `math/applied/items.json`
(open item 3).

**Unit for Stage B** (route planning, one unit, `released: false`):
`route:count-the-steps` → `route:trip-clock` (7-10), `route:scale-ratio` →
`route:travel-time` (10-18). Same unit, two ladders, so "distance by map scale,
travel time" plays at each group's level.

### Standards and sources (live-checked 2026-11-10)

The corestandards.org and socialstudies.org pages could not be fetched (404
and 403). So **most codes stay UNVERIFIED on purpose**; a code is only entered
once its text is read from a live source.

| Code | Status | Evidence |
|---|---|---|
| NGS Standard 1 (maps, geographic representations, geospatial technologies, spatial thinking) | VERIFIED, HIGH | https://education.nationalgeographic.org/resource/geography-standard-1/ , read 2026-11-10 |
| CCSS 6.RP.A.3 (ratio and rate reasoning, real-world problems) | PARTIAL, MEDIUM | opening seen in https://ospi.k12.wa.us/sites/default/files/2022-12/mathstandards_grade6.pdf |
| CCSS 4.MD.A.2 (word problems with distances and intervals of time) | PARTIAL, MEDIUM | opening seen in a published alignment PDF (see the item's `source`) |
| C3 D2.Geo.* (maps, spatial views) | UNVERIFIED | socialstudies.org returned 403; candidates to check: D2.Geo.1 and D2.Geo.2 at the 3-5, 6-8 and 9-12 bands |
| CCSS 3.MD, 5.MD, 6.EE, 7.RP | UNVERIFIED | corestandards.org returned 404; candidates only, not entered in the data |
| CCSS 6.RP.A.3.b, 7.G.A.1 | HIGH | read live on 2026-11-11 at thecorestandards.org (6/RP and 7/G pages); entered on route:travel-time and route:scale-ratio |
| CCSS HSG-SRT.C.8 | HIGH | the live read the general-knowledge tower-angle row cites; entered on route:compass-bearing |

Item `standard` fields hold `"UNVERIFIED"` unless the row above is PARTIAL or
better. Upgrading them needs a person or a later session with a working source.
Facts such as population or area values are **not** stored in the items: rounds
take their numbers from the engine's data or from fictional round numbers
declared in the round, and any real figure needs a source + confidence at build.

### K-12 STANDARD block (standard §9)

```
K-12 STANDARD (docs/scaling/k12-learning-design-standard.md)
- Why first (§0): every item has a `why` problem, to be shown in the first 5 s and answered in the first minute: [x] drafted; [ ] educator-checked
- Headline goal (§0): bridge (buildsOn) + playable real-life application: [x] drafted for all 17
- Use-it-elsewhere round in at least one other subject: [x] every item lists 2-3 settings
- Bands served: 7-10 (concrete, scale bars, whole numbers), 10-18 (ratios, rates, bearings), 18+ (projection, great circles, cost comparison) — each verb has a ladder
- Objective per item, observable verb, "shown by": [x] all 17 (verbs: locate, sort, compare, estimate, compute, explain, choose)
- Standards cited per item: [ ] only 2 of 17 carry a (partial) CCSS code; the rest UNVERIFIED (table above)
- Loop mapped: hook = the `why`; predict = child commits a pin/number before the map answers; see = route line, scale bar and clock respond; explain = host line; retry = one hint then review deck: [x] designed, [ ] built
- Mastery "confident" bar: correct on the first try without a hint, within the round's tolerance (map pin) or exact (arithmetic); Mastered after two correct uses in two settings: [x] proposed
- Review-deck hookup: item id is the deck key (I2); until the integrator wires `review-deck.ts`, misses live in module state: [x] stated
- Post-clip retrieval check: no new video clips in v1; the round itself is the retrieval: [x] n/a, stated
- Motion tiers: Full = 3D globe path and animated route; Lite = same, low-poly 30 fps; Flat = 2D SVG route and stepped clock; same question, same scoring: [x] described, [ ] built
- Accessibility: tap alternative for every drag, no timers in 7-10, SR live region announces the result, colour never the only signal: [x] stated, [ ] axe-tested
- Privacy: no PII, no identifiers, records on the device only: [x]
- Content screen (§7a): [x] passed, 10 candidates cut (Cuts log)
- Free: no revenue features; no new assets in Stage A: [x]
- Educator rubric attached: [ ] NOT SIGNED — spec stays GATED
```

### Cuts log (standard §7a screen)

| Candidate | Cut because |
|---|---|
| Constitution picker (kid chooses a country, learns its constitution) | Contested or political in places; cannot be told neutrally for every country. §7a: when in doubt, leave it out. |
| "Who owns this region / disputed borders" rounds | Current or contested politics. Rounds use only regions whose outline the engine already treats as settled, and never ask who governs a place. |
| Capital-city politics, elections, parties, leaders' views | §7a, out entirely. |
| Road signs and road rules as a driving game | Not map-based and varies by country; parked, needs its own source plan (open item 4). |
| Pilgrimage routes, sacred sites, religious-calendar time zones | Religion is out of the plan. |
| Migration or refugee routes | Contested political topic; cut. |
| Population "which country is bigger" rankings tied to power | Invites comparison of nations in a political way; kept only as neutral density arithmetic on fictional towns. |
| Wildlife range, habitat and ecosystem maps | No biology anywhere. |
| Trade-war tariffs or sanctions routes | Current or contested politics. |
| Battle maps and troop movements | Remembrance only, no battle re-enactment (§7a); cut from this mode. |

### Open items for the integrator or owner

1. **Build gate:** Stage B waits for the owner to lift the gate for this branch.
2. **Educator:** no named human has signed the rubric; every item is unsigned.
3. **Cross-subject ids:** `buildsOn` now uses real math ids. `math-applied` ids come from `feat/math-spec` and are not on `main` yet; `items.test.mjs` skips that check with a message until they are.
4. **Road rules / signs:** deferred; needs a source plan per country and an owner call on scope.
5. **Standard codes:** C3 and most CCSS codes need a live source; corestandards.org and socialstudies.org were unreachable from this session.
6. **Counts:** 17 items and the 7 / 7 / 3 split are PROPOSED; video count is TO CONFIRM (no video in this mode).
7. **Contract I2 gap:** it has no field for the verb or a unit grouping; the verb lives in the id. No change requested.
