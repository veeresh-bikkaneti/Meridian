# Social Studies Spec — P5 Road Rules + History + Constitution Picker

> **Map-based mode, Stage A (2026-11-10) — read this section first.** It is
> the current plan for this branch. The earlier P5 draft further down is
> kept for the record and is **superseded wherever it conflicts** with this
> section, in particular: its "5th grade and up" age band (now three groups,
> standard §1), its constitution picker (cut, see Cuts log), and its
> "no politics" line (now the stricter content screen, standard §7a).
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
(`math:M1` …) use the chain steps of `subject-progression-map.md` as
placeholders until the math branch publishes real item ids (open item 3).

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
| CCSS 3.MD, 5.MD, 6.EE, 7.RP, 7.G.A.1, HSG-SRT.C.8 | UNVERIFIED | corestandards.org returned 404; candidates only, not entered in the data |

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
3. **Cross-subject ids:** `buildsOn` uses `math:M1…M5` placeholders. Needs the math branch's real item ids (or a rule in `contracts.md` for referring to chain steps).
4. **Road rules / signs:** deferred; needs a source plan per country and an owner call on scope.
5. **Standard codes:** C3 and most CCSS codes need a live source; corestandards.org and socialstudies.org were unreachable from this session.
6. **Counts:** 17 items and the 7 / 7 / 3 split are PROPOSED; video count is TO CONFIRM (no video in this mode).
7. **Contract I2 gap:** it has no field for the verb or a unit grouping; the verb lives in the id. No change requested.

---

*Earlier P5 draft follows (kept for the record; superseded where it conflicts, see above).*

## Header

| Field | Value |
|---|---|
| Topic | P5 Social studies — road rules + history + constitution picker (kid selects their own state/country, sees its flag, learns its constitution) |
| Status | **GATED** — do not start building until P2 has landed AND its own definition is signed (see Definition of done). Note: constitution-first for a single jurisdiction may clear the readiness audit before P3 and go first — a possibility, not a commitment. |
| Branch | `feat/social-studies-spec` (per this spec brief; the work packets use two branches under one packet — `feat/social-road-rules` for road rules + history and `feat/constitution-picker` for the constitution, two PRs in either order once the definition is signed — confirm the branch name(s) before the build agent starts) |
| Video count | **TO CONFIRM** — do not invent a number. The count is set by the signed definition (topic map per band + road-rules verb + constitution verb-or-shelf decision + per-jurisdiction sourcing plan), not by this spec. |
| Repo | veeresh-bikkaneti/Meridian — free browser geography game for kids, live at https://veeresh-bikkaneti.github.io/Meridian/ (project record, MEMORY.md; confidence HIGH as a project-internal fact — the live web search on 2026-11-10 returned other products named "Meridian" and did not independently verify the repo URL, so no web citation is claimed for it) |
| Sources consulted | `meridian-scaling-lens-breakdown.md` §0 (lines 15–151), §4 P5 (lines 801–970), §12 staleness flags (lines 1899–1926), §13 open questions (lines 1927–1961); `meridian-scaling-work-packets.md` shared gates + dependency chart (lines 7–102), P5 (lines 336–393) |
| Spec date | 2026-11-10 |

## Expert seats

- **Historian seat — OWNS this spec (world history, world wars, and social studies).** The historian owns the history and constitution content: every history fact and every constitution fact is sourced, cited, and dated under the historian's review.
- **Educator seat — BLOCKED.** No named educator exists. The named human educator / SME must sign IN WRITING, before build: (1) the social-studies topic map per band (road rules, history, social economy), (2) the constitution sourcing plan + the verbatim-vs-paraphrase decision, (3) the judging rule for this subject, (4) the machine-verification gate, demonstrated on one complete mode, (5) per-jurisdiction constitution content — a civics/social-studies signer is required; a math educator's signature does not cover this packet. Until the signature is on file, this packet stays GATED.
- Five lenses also apply as usual: software architect, UI/UX designer, game developer, researcher, educator (blocked).

## Topic scope

- **Age band:** 5th grade and up only. Any 5–7 social-studies content is out of scope until Q2 is answered in writing.
- **Purpose:** school revision, not new teaching. Road rules, history, and social economy anchor to what school already teaches at each band, per the named curriculum. A topic with no citation is UNVERIFIED and out of scope.
- **Owner's scope (2026-11-07):** social studies = driving directions, road signs, road rules, traffic, social economy, history, constitution. Kids select their own state/country to learn its constitution, shown with its flag.
- **In scope (per lens §4 + packets P5):**
  - **Road-rules game** — navigate / decide / avoid: a spatial decision under uncertainty, close to pin-dropping, with a decision, a consequence, and a fail state stated in writing (a loop missing any of the three is not a game). Mockup first at 390px and 1280px.
  - **History game surface, journal-linked** — one fact, one source, shared between the journal (story surface) and this packet (game surface). The sharing mechanism is named (shared file, shared lint, or shared review); a sharing rule with no mechanism is a wish. Every history fact cites the same source as the journal's telling of it; a fact with two different sources is a contradiction to resolve before build, not after.
  - **Constitution picker** — country/state selection, flag paired with that jurisdiction's constitution, per-jurisdiction sourcing (each fact cited and dated; the schema requires citation + date per fact — a fact record with no citation field cannot be stored). Playable verb as defined (flag → article matching, "which right protects this?" scenario cards, a timeline, or a "defend the clause" detective case — "You are the judge": scenario → governing clause → consequence) — or, if the verb cannot be built honestly, an explicit owner decision to ship it as a reference shelf instead of a game. The flag must never be a hunt target (existing flag rule): the mockup shows the flag only beside an already-visible land/jurisdiction name; any hunt-target use is a block.
  - **Social economy topics** per the signed topic map.
- **Out of scope:** any constitution content without a cited, dated source; any flag-as-hunt-target mechanic (forbidden); any tiny-model use (P9, parked); any behaviour change to geography or math. World view, not US-heavy: jurisdictions are picked by the kid, not defaulted to the US; the constitution picker must work for the kid's own country/state, and the sourcing plan names the source for each jurisdiction (official text HIGH, official publisher MEDIUM) — a jurisdiction with no named source is UNVERIFIED and out of scope.

## Topic structure — no count invented

Structure only; the video count is **TO CONFIRM** in the signed definition. The build agent turns this structure into videos once the count is set. Do not invent curriculum facts — each sub-topic below must cite the signed definition before content is written; a sub-topic with no citation is out of scope.

1. **Road signs** — recognising signs and what they mean, per the signed topic map per band.
2. **Road rules** — the rules of the road as decisions, not a reader: decide, see the consequence, fail state exists.
3. **Traffic** — traffic situations as spatial decisions under uncertainty.
4. **Driving directions** — navigating by directions; close to pin-dropping.
5. **Social economy** — topics per the signed topic map per band.
6. **History (journal-linked)** — game surface for history, sharing facts with the journal; no contradictory duplicates.
7. **World history** — historian-owned; per the signed topic map per band, sourced per fact.
8. **World wars** — historian-owned; per the signed topic map per band, sourced per fact, presented for the age band without graphic content (the per-band presentation decides what each band sees).
9. **Constitution picker — selection** — kid picks their own country/state; flag shown beside the already-visible jurisdiction name.
10. **Constitution picker — the verb** — match flag → article, "which right protects this?" scenario cards, a timeline, or "You are the judge" (scenario → governing clause → consequence). The verb is proven in the mockup (a decision, a fail state, a loop) — a reader with a flag is not a game. If no verb can be built honestly, the deliverable is the game-vs-shelf question for the owner, not a shipped reader.
11. **Constitution picker — sourcing** — per-jurisdiction sourcing plan; verbatim vs paraphrase decided (see Open questions); every fact cited and dated.

**Constitution game-or-shelf decision (OPEN — see below):** (a) plays as a game with the defined verb and a win state, or (b) ships as an explicitly owner-approved reference shelf. The owner's word must be on file for whichever it is; an agent may never record that decision itself.
**Judging:** road-rules decisions judged by the rules of the road; constitution answers judged against cited text. A test walks the judging path (right, wrong, near-miss).

## Hard rules (owner's — in every file)

1. **Verify EVERY key fact with live web search:** source URL + confidence (HIGH/MEDIUM/LOW per lens §0.2) on every claim. No source = mark UNVERIFIED, never state it as fact. No stale facts. Law/constitution facts are checked against the jurisdiction's own text or an official publisher; history facts against a cited historical source.
2. **NO POLITICS anywhere.** This is a hard line for this packet in particular: constitution and history content must be factual, sourced, and dated — no political framing, commentary, or present-day political examples. A wrong paraphrase teaches wrong civics silently — the cited-and-dated rule is the mitigation, demonstrated per jurisdiction, not asserted.
3. **Status GATED (educator sign-off in writing).** Educator seat BLOCKED — no named educator exists. Signer must approve in writing: curriculum + topic map + judging rule + verification gate (plus the constitution sourcing plan and verbatim-vs-paraphrase decision for this packet).
4. **Counts:** TO CONFIRM for this spec. Never present a proposed count as decided, never invent one.
5. **7-stage release pipeline applies** — no feature ships unless all seven ran: (1) code review, (2) architectural review, (3) design review, (4) feasibility analysis (works in a browser), (5) manual QA by real play-testing, (6) visual testers (effects in sync/consistent), (7) age-group playtest with feedback to the game player and game researcher. A review-only pass is not testing.
6. **Lazy-load law:** nothing loads until a kid picks it. No subject loads before selection; inside a chosen subject, prefetch of the next 1–2 items is allowed. Load budget numbers (initial JS ≤ 250 KB gzip; per-game chunk ≤ 500 KB gzip) are PROPOSALS, not measurements — baseline on P2's first build; breach = branch blocked.
7. **Host wrap-up (owner's rule, every question, every feature):** win or lose, correct or wrong, every question ends with the host retelling the story behind the answer as a very small, short animated cartoonish video clip — not lengthy.
8. **Mockup first:** the road-rules surface mockup and the constitution verb mockup are shown to the owner before building. A child must get it just by looking. Free, no paywalls, COPPA-safe (no accounts, no PII, no identifiers).
9. **Readiness audit (all four, demonstrated not promised):** (i) named curriculum + topic map, (ii) machine-verifiable judging rule, (iii) correctness checkable without an LLM near the data, (iv) core verb a child gets just by looking. Note the constitution-first conditional: a single jurisdiction, fully sourced/dated/verified, could clear the audit before math — record whether it does, do not assume it.

## Verification protocol (lens §0 — forcing rule)

Before any question in this spec is answered, the build agent MUST: (1) run a live web search to ground the answer in current information — answering from its own knowledge is forbidden; (2) give every key fact a named site source (with URL where possible, plus access date) or an explicit confidence level (HIGH/MEDIUM/LOW per §0.2); (3) record any fact with no source as UNVERIFIED and never assert it; (4) re-check anything time-sensitive against a current source — a stale fact is wrong. A section completed without these four steps is incomplete. Full protocol: lens §0.

## Agent prompt (copy-paste block)

```
You are the build agent for Meridian P5 Social studies
(feat/social-studies-spec). Repo: veeresh-bikkaneti/Meridian. SPEC ONLY
in this file — do NOT generate videos here; the build agent implements
from this spec on branch feat/social-studies-spec (two PRs once the
definition is signed: road rules + history, and constitution picker, in
either order). Never commit, push, open PRs, or merge on your own; the
coordinator does all git work and merging stays the owner's decision,
per PR, per head.

EXPERTISE REQUIRED: Software Architect, UI/UX Designer, Game Developer,
Researcher, plus the HISTORIAN seat (owns this spec — world history,
world wars, and social studies) and the EDUCATOR seat (BLOCKED — no
named educator exists; see gate below).

TOPIC: Social studies for 5th grade and up: road signs, road rules,
traffic, driving directions, social economy, history, constitution.
Kids select their own state/country, see its flag, learn its
constitution. VIDEO COUNT: TO CONFIRM — set by the signed definition,
never invented here. Road rules is the strongest non-quiz verb after
math: navigate / decide / avoid, with a decision, a consequence, and a
fail state. The constitution picker as described is NOT a game yet — it
needs a playable verb (flag -> article, "which right protects this?"
scenario cards, timeline, or "You are the judge") or an explicit owner
decision to ship it as a reference shelf. The flag must never be a hunt
target. History shares facts with the journal (one fact, one source).

DELIVERABLES: road-rules surface mockup (owner-shown before building,
at 390px and 1280px); constitution verb mockup (or the shelf question);
sourcing plan with named sources per jurisdiction; history fact-sharing
mechanism; judging test plan. Video clips: 10 seconds each.

TECH: v4 recipe — AI video-gen + Avocado TTS + ffmpeg. Storyteller
voice: Magnus, 86-138 Hz (project record). 1152x768, 24fps, h264+AAC.
Tap-to-play, preload=none. Captions/VTT + transcript per clip.
Lazy-load law: nothing loads until a kid picks it; prefetch of the next
1-2 items inside a chosen subject is allowed. Host story clip after
every question (win or lose, correct or wrong) — very small, short
animated cartoonish video, not lengthy.

GATES (all must pass): tsc, npm test, test:worker, lint-cards GATE
PASSED, build:pages, Playwright E2E sequential --workers=1, panel
review, educator sign-off IN WRITING for curriculum + topic map +
judging rule + verification gate (+ constitution sourcing plan and
verbatim-vs-paraphrase decision for this packet), screen recording of
the built app — no recording = the testing did not happen. 7-stage
release pipeline in full (code review, architectural review, design
review, feasibility, manual QA by real play-testing, visual testers,
age-group playtest). No self-certification.

VERIFICATION PROTOCOL: verify EVERY key fact with live web search;
source URL + confidence (HIGH/MEDIUM/LOW) on every claim; no source =
UNVERIFIED, never asserted as fact; no stale facts. Constitution facts
against the jurisdiction's own text or an official publisher; history
facts against a cited historical source.

NO POLITICS anywhere. World view, not US-heavy — jurisdictions are
picked by the kid, not defaulted to the US. If the educator is still
unstaffed when you are assigned, your first job is to report that the
packet is blocked — not to build around it.
```

## Open questions for the owner

1. **Q9 (constitution picker — OPEN, as the lens breakdown leaves it):** (a) verbatim text (with a plain-language layer) or paraphrase — and who cites and dates each fact? (b) game or shelf, if the "You are the judge" mechanic cannot be built honestly? Both need your word, with the educator. The research deliverable is the costed options; the decision is yours.
2. **Q1 (educator + curriculum):** who is the named civics/social-studies educator/SME, and which curriculum does the topic map follow (varies by country)?
3. **Q6 (home order):** which jurisdiction goes first, if constitution-first goes first? A definition decision, not this packet's to invent.
4. **Q2 (audience):** written confirmation that new games are 5th-grade-and-up only.
5. **Video count:** TO CONFIRM — what count does the signed definition set?
6. **Constitution-first conditional:** does a single fully-sourced jurisdiction clear the audit before P3, or not? (Possibility, not a commitment.)
7. **Q5 (load budget):** accept the proposed 250 KB / 500 KB starting numbers once baselined, and what tap → first-playable-paint time on what device is "fast enough"?
8. **Alert policy (study §10 Q7):** which funnel types, if any, may page a human? Unassigned — needs your decision before funnel types are defined.

## Definition of done

Done when: (a) the road-rules game plays end to end with a real decision verb and a fail state (not a reader); (b) the constitution picker either plays as a game with the defined verb and a win state, or ships as an explicitly owner-approved reference shelf — with the owner's word on file for which; (c) every constitution fact is cited and dated, with a confidence level where the source is not primary, and the verbatim-vs-paraphrase decision is recorded and implemented; (d) history content shares facts with the journal (no contradictory duplicates); (e) load budget met on P2-measured numbers and lazy-load behaviour verified; (f) educator sign-off on file; (g) every question ends with the host story clip; (h) the 7-stage release pipeline ran in full; (i) panel review passed with a screen recording.

## UNVERIFIED log (this spec)

- Repo/live-site identity: per project record (MEMORY.md), confidence HIGH as a project-internal fact; live web search 2026-11-10 did not independently verify the repo URL — no web citation claimed.
- Video count: TO CONFIRM — no number is stated anywhere in this spec.
- **Constitution questions Q9 (verbatim vs paraphrase; game or shelf) are OPEN** — no decision is recorded in this spec.
- Every sub-topic above is structure only; its curriculum anchoring and every constitution/history fact are UNVERIFIED until the signed definition cites them per band and §0 verification is done at build time.
- Load-budget numbers (250 KB / 500 KB gzip): PROPOSAL, not measured (lens §12 flag 11).
- No other factual claims are made in this spec.
