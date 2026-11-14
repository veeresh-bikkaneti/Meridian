# Math Spec — P3 Math v1 (quiz loop, exact answers)

> **Stage A addendum (2026-11-10).** Measurement, rates and algebra, and geometry and trigonometry are specified in [Applied strand](#applied-strand-stage-a-2026-11-10) and in [`docs/scaling/math/applied/items.json`](math/applied/items.json). Groups follow standard §1. Where the P3 sections below disagree (5th-grade-only, algebra out of scope), the addendum wins for this branch. Build stays **GATED**. The build branch name awaits owner decision D5 (`feat/math-spec` or `feat/math-tricks`).


## Header

| Field | Value |
|---|---|
| Topic | P3 Math v1 — first new game: math revision on the existing quiz loop, exact-answer judging only |
| Status | **GATED** — do not start building until P1 is signed AND P2 has landed (see Definition of done) |
| Branch | `feat/math-spec` (per this spec brief; the work packets call the P3 branch `feat/math-tricks` — confirm the branch name before the build agent starts) |
| Video count | **TO CONFIRM** — do not invent a number. The count is set by the signed definition (P1 topic map), not by this spec. |
| Repo | veeresh-bikkaneti/Meridian — free browser geography game for kids, live at https://veeresh-bikkaneti.github.io/Meridian/ (project record, MEMORY.md; confidence HIGH as a project-internal fact — the live web search on 2026-11-10 returned other products named "Meridian" and did not independently verify the repo URL, so no web citation is claimed for it) |
| Sources consulted | `meridian-scaling-lens-breakdown.md` §0 (lines 15–151), §2 P3 (lines 484–655), §12 staleness flags (lines 1899–1926), §13 open questions (lines 1927–1961); `meridian-scaling-work-packets.md` shared gates + dependency chart (lines 7–102), P3 (lines 224–281) |
| Spec date | 2026-11-10 |

## Expert seats

- **Math seat: STATISTICIAN (statistician.toml) — closest fit, DISCLOSED.** The installed packs hold no school-math-teaching persona; statistician.toml is the closest fit and it is IMPERFECT: statistics background, not school-math teaching. The seat verifies the math is right and the tricks work; the children's-language teaching side stays with the (BLOCKED) educator seat. Do NOT present this seat as a math teacher.
- **Educator seat — BLOCKED.** No named educator exists. The educator must sign in writing, before build: (1) the math curriculum + topic map per band (5th grade up), (2) the judging policy — exact-answer-only in v1, (3) the machine-verification gate, demonstrated on one complete mode, (4) the error taxonomy — that the mistake types are real mistake types children make, at the right bands, (5) that the problem bank's content level is right for each band ("high content level" against 5th-grade readability). Until that signature is on file, this packet stays GATED.
- Five lenses also apply as usual: software architect, UI/UX designer, game developer, researcher, educator (blocked).

## Topic scope

- **Age band:** 5th grade and up only. The description's 5–7 math games (Number Hunt, Add-'Em-Up Café) and the study's "math ages 8–10 first" are superseded — out of scope until the owner re-admits 5–7 in writing (then it is a new packet, not a widening of this one).
- **Purpose:** school revision, not new teaching. Every problem practises what school already taught at that band, per P1's named curriculum. A topic with no curriculum citation is UNVERIFIED and out of scope.
- **In scope (per lens §2 + packets P3):** one math mode on the quiz loop — addition, subtraction, multiplication, division (per P1's map), with big-number tricks, percentages/percentiles, and money/currency woven in as P1 specifies. Problem engine (generator + bank + difficulty tiers); every generated problem machine-verified (answer recomputed, not trusted from the generator); the verification gate runs in CI or as a prebuild check and fails the build on an unverified problem. Play surface: number line / ten-frame / equation board — one surface, chosen in design, mockup first. Review deck wired to error types (records what kind of mistake it was — e.g. "carried wrong" vs "times-table slip" — and replays misses by type, each error type with a detector). Math funnel events + milestones (new event names, drift test extended per game).
- **Game ideas that fit v1 (subject to P1's map):** Times Table Races, Division Diner, Fraction Kitchen, Measure-Up Workshop.
- **Out of scope:** partial credit for shown working; equivalent-form judging (v1 exact-answer-only); algebra (P4); Olympiad depth as a difficulty slider (dismissed by the council — Olympiad is a mode or a separate subject, placed by P1, not this packet); any tiny-model use (P9, parked); any 5–7 content; any behaviour change to the geography game. World view, not US-heavy: money/currency examples must not default to the US only; curricula vary by country, and the topic map must say which curriculum it follows.

## Topic structure — no count invented

Structure only; the video/problem count is **TO CONFIRM** in the signed definition. The build agent turns this structure into videos once the count is set. Do not invent curriculum facts — each sub-topic below must cite P1's signed map before content is written; a sub-topic with no map citation is out of scope.

1. **Addition** — per P1's map, by band; big-number addition tricks as game mechanics (tricks are the game, not a footnote).
2. **Subtraction** — per P1's map, by band; big-number subtraction tricks.
3. **Multiplication** — per P1's map, by band; times-table races; shortcuts for multi-digit multiplication.
4. **Division** — per P1's map, by band; division tricks for big numbers.
5. **Fractions** — per P1's map; the wrong-cut-visibility rule applies: a wrong fraction cut must be *visible* (the child can see why the pizza is wrong).
6. **Percentages / percentiles** — woven in per P1's map.
7. **Money / currency** — woven in per P1's map; world view, not US-only.
8. **Measurement** — Measure-Up Workshop, per P1's map.
9. **Big-number tricks** — the owner's core ask: shortcuts for adding, multiplying, and dividing big numbers, aimed also at ambitious kids and Olympiad aspirants (placement decided by P1 — mode, difficulty, or separate subject — not by this packet).
10. **Review deck by error type** — the deck records error types and replays misses by type; the "wrong maths taught fluently" risk is mitigated only by the demonstrated verification gate.
11. **Depth ladder per band** — concrete objects → pictures → bare numbers → abstract symbols, designed per subject, mocked at 390px and 1280px for the youngest and oldest bands in scope. The 14–18 register (escape-room cases, labs, real challenge, humour that is not childish) is specified with playtest evidence, not asserted.

**Play surface:** one surface (number line / ten-frame / equation board), chosen in design, mockup shown to the owner before building.
**Judging (v1):** exact-answer-only. A test walks: right answer, wrong answer, equivalent form rejected in v1, near-miss with a carrying error. A judging rule no test walks is UNVERIFIED.
**Scoring base:** math's base comes from correctness (and speed, if P1's policy says so) — the formula is written with its inputs named; a formula with an unnamed input is incomplete.
**Failure behaviour:** a load failure must never reset a streak or eat a guess (retry + state preserved + offline fallback); each failure state is reachable and tested, not described.

## Hard rules (owner's — in every file)

1. **Verify EVERY key fact with live web search:** source URL + confidence (HIGH/MEDIUM/LOW per lens §0.2) on every claim. No source = mark UNVERIFIED, never state it as fact. No stale facts.
2. **NO POLITICS anywhere.**
3. **Status GATED (educator sign-off in writing).** Educator seat BLOCKED — no named educator exists. Signer must approve in writing: curriculum + topic map + judging rule + verification gate (plus the error taxonomy for this packet).
4. **Counts:** TO CONFIRM for this spec. Never present a proposed count as decided, never invent one.
5. **7-stage release pipeline applies** — no feature ships unless all seven ran: (1) code review, (2) architectural review, (3) design review, (4) feasibility analysis (works in a browser), (5) manual QA by real play-testing, (6) visual testers (effects in sync/consistent), (7) age-group playtest with feedback to the game player and game researcher. A review-only pass is not testing.
6. **Lazy-load law:** nothing loads until a kid picks it. No subject loads before selection; inside a chosen subject, prefetch of the next 1–2 items is allowed. Load budget numbers (initial JS ≤ 250 KB gzip; per-game chunk ≤ 500 KB gzip) are PROPOSALS, not measurements — baseline on P2's first build; breach = branch blocked.
7. **Host wrap-up (owner's rule, every question, every feature):** win or lose, correct or wrong, every question ends with the host retelling the story behind the answer as a very small, short animated cartoonish video clip — not lengthy.
8. **Mockup first:** the play surface mockup is shown to the owner before building. A child must get it just by looking. Free, no paywalls, COPPA-safe (no accounts, no PII, no identifiers).
9. **Readiness audit (all four, demonstrated not promised):** (i) named curriculum + topic map, (ii) machine-verifiable judging rule, (iii) correctness checkable without an LLM near the data, (iv) core verb a child gets just by looking.

## Verification protocol (lens §0 — forcing rule)

Before any question in this spec is answered, the build agent MUST: (1) run a live web search to ground the answer in current information — answering from its own knowledge is forbidden; (2) give every key fact a named site source (with URL where possible, plus access date) or an explicit confidence level (HIGH/MEDIUM/LOW per §0.2); (3) record any fact with no source as UNVERIFIED and never assert it; (4) re-check anything time-sensitive against a current source — a stale fact is wrong. A section completed without these four steps is incomplete. Full protocol: lens §0.

## Agent prompt (copy-paste block)

```
You are the build agent for Meridian P3 Math v1 (feat/math-spec).
Repo: veeresh-bikkaneti/Meridian. SPEC ONLY in this file — do NOT generate
videos here; the build agent implements from this spec on branch
feat/math-spec. Never commit, push, open PRs, or merge on your own;
the coordinator does all git work and merging stays the owner's decision,
per PR, per head.

EXPERTISE REQUIRED: Software Architect, UI/UX Designer, Game Developer,
Researcher, plus the MATH seat (STATISTICIAN, statistician.toml — closest fit, DISCLOSED: statistics background, not school-math teaching; verifies the math and the tricks, NOT a math teacher) and the EDUCATOR seat
(BLOCKED — no named educator exists; see gate below).

TOPIC: Math revision for 5th grade and up on the existing quiz loop,
per P1's signed topic map. Addition, subtraction, multiplication,
division, big-number tricks, percentages/percentiles, money/currency.
VIDEO COUNT: TO CONFIRM — set by the signed definition, never invented
here. Judging: exact-answer-only in v1; no partial credit, no equivalent
forms. Every problem machine-verified (answer recomputed, not trusted
from the generator); the gate fails the build on an unverified problem.
Blocks P4 (algebra inherits math's judging and engine) — do not widen
v1 judging without the owner's word + educator sign-off.

DELIVERABLES: engine + judging brief with cited topic map; verification
gate demonstration; surface mockup (owner-shown before building, at
390px and 1280px); review-deck error taxonomy with detectors; funnel-
event registry; host-clip spec. Video clips: 10 seconds each.

TECH: v4 recipe — AI video-gen + Avocado TTS + ffmpeg. Storyteller
voice: Magnus, 86-138 Hz (project record). 1152x768, 24fps, h264+AAC.
Tap-to-play, preload=none. Captions/VTT + transcript per clip.
Lazy-load law: nothing loads until a kid picks it; prefetch of the next
1-2 items inside a chosen subject is allowed. A load failure must never
reset a streak or eat a guess. Host story clip after every question
(win or lose, correct or wrong) — very small, short animated cartoonish
video, not lengthy.

GATES (all must pass): tsc, npm test, test:worker, lint-cards GATE
PASSED, build:pages, Playwright E2E sequential --workers=1, panel
review, educator sign-off IN WRITING for curriculum + topic map +
judging rule + verification gate (+ error taxonomy for this packet),
screen recording of the built app (the math mode played end to end, plus
the load-failure/retry states — no recording = the testing did not
happen). 7-stage release pipeline in full (code review, architectural
review, design review, feasibility, manual QA by real play-testing,
visual testers, age-group playtest). No self-certification.

VERIFICATION PROTOCOL: verify EVERY key fact with live web search;
source URL + confidence (HIGH/MEDIUM/LOW) on every claim; no source =
UNVERIFIED, never asserted as fact; no stale facts. A wrong maths answer
teaches wrong maths — and the review deck will reinforce the error into
fluency — so the verification gate is demonstrated, not asserted.

NO POLITICS anywhere. World view, not US-heavy. If the educator is
still unstaffed when you are assigned, your first job is to report that
the packet is blocked — not to build around it.
```

## Open questions for the owner

1. **Q1 (educator + curriculum):** who is the named math educator/SME, and which curriculum does the topic map follow (varies by country)? Blocks every subject GO.
2. **Math seat:** RESOLVED by owner call 2026-11-10 — statistician.toml, closest fit, disclosed (not a math teacher). Teaching side stays with the blocked educator seat.
3. **Q2 (audience):** written confirmation that new games are 5th-grade-and-up only, and that 5–7 games drop out.
4. **Q3 (judging):** exact-answer only in math v1, or partial credit for shown working — and is `2x + 6` the same answer as `2(x + 3)`? (The equivalent-form half is decided in P1's definition, before P4 builds on it.)
5. **Q10 (Olympiad placement):** mode, difficulty, or separate subject — and does it live on the same home as school revision?
6. **Video count:** TO CONFIRM — what count does the signed definition set for math v1?
7. **Q5 (load budget):** accept the proposed 250 KB / 500 KB starting numbers once baselined, and what tap → first-playable-paint time on what device is "fast enough"?
8. **Alert policy (study §10 Q7):** which math funnel types, if any, may page a human? Unassigned — needs your decision before funnel types are defined.

## Definition of done

Done when: (a) one complete math mode plays end to end on the quiz loop for the bands P1 specifies; (b) every problem in the bank is machine-verified, with the gate running in CI (or as a prebuild check) and failing the build on an unverified problem; (c) judging implemented exactly as P1 wrote it, with a test walking right answer, wrong answer, equivalent form rejected in v1, near-miss with a carrying error; (d) review deck records error types and replays misses by type; (e) load budget met on P2-measured numbers and no-interaction network trace shows nothing math-related loads before selection; (f) educator sign-off on file (from P1, confirmed still valid for what was built — if the build diverged from the signed definition, it is not signed); (g) every question ends with the host story clip; (h) the 7-stage release pipeline ran in full; (i) panel review passed with a screen recording.

## UNVERIFIED log (this spec)

- Repo/live-site identity: per project record (MEMORY.md), confidence HIGH as a project-internal fact; live web search 2026-11-10 did not independently verify the repo URL — no web citation claimed.
- Video/problem count: TO CONFIRM — no number is stated anywhere in this spec.
- Every sub-topic above is structure only; its curriculum anchoring is UNVERIFIED until P1's signed map cites it per band.
- Load-budget numbers (250 KB / 500 KB gzip): PROPOSAL, not measured (lens §12 flag 11).
- No other factual claims are made in this spec.

## Applied strand (Stage A, 2026-11-10)

**Status: GATED.** Stage B (one Measure-Up unit) does not start until the owner lifts the build gate. No code under `src/subjects/math-applied/`. No code gates were run for this addendum.

**Counts: PROPOSED.** 35 items (11 in `7-10`, 23 in `10-18`, 1 in `18+`). Not a video count. The P3 video count above stays **TO CONFIRM**. Grade bands from the plan: `7-10` is grades 2–5, `10-18` is grades 5–12, `18+` is beyond grade 12. Each item's group follows its standard's grade. Grade 5 may sit in either younger group; the two grade-5 items (`5.MD.A.1`, `5.MD.C.5a`) are in `10-18` because they need the number strand's decimal and multi-digit skills. High-school codes are `10-18`, not `18+`. The one `18+` item has no school code.

**D5, still open.** The build branch name awaits owner decision D5: `feat/math-spec` or `feat/math-tricks` (`k12-plan-review.md`). This work stays on `feat/math-spec` until the owner picks. Stage B does not start on either name until that pick and the build gate.

### What this strand owns

Measurement, rates and algebra, geometry and trigonometry. Algebra and trigonometry are `10-18` and `18+` only (standard §0, map age note). The number strand (counting, place value, multiplication, division, fractions, percent) belongs to `feat/math-definition`. This file cites those skills by contract I2 id only. The ids are the ones on `origin/feat/math-definition` at `9f87b717` (not on `main` yet). If that branch renames an id, the integrator tells this branch.

| Unit | Chain step | Items (PROPOSED) | Real life | Environment link |
|---|---|---|---|---|
| `measure` | M1 Measure-Up | 14 | shelves, borders, jugs, clocks | rain depth in a gauge; river length in metres |
| `geometry` | map web, geometry and measurement | 6 | frames, ramps, grid maps | rain barrel; map scale |
| `rates` | M4 | 9 | rope price, a trip, a stall budget | water used per day. No glacier speed is stated |
| `trig` | map web, trigonometry | 6 | a pole and its shadow, ramp steepness, a bearing | tower height from a shadow. No real height is stated |

`7-10` is only `measure` and `geometry:shape-sort`. `rates` and `trig` have no `7-10` item, on purpose.

### K-12 standard block

```
K-12 STANDARD (docs/scaling/k12-learning-design-standard.md)
- Why first (§0): unit opens with a real problem that needs the skill; "why does this matter?" answered in the first minute: [x] every item's `why` is that problem. The ramp unit spells the first minute below.
- Headline goal (§0): bridge to the previous subject + playable real-life application: [x] `buildsOn` is the bridge; the why is the application. The ramp scene is specified, not built.
- Use-it-elsewhere round in at least one other subject (cross-application web): [x] one round per item, from the map web.
- Bands served: [x] 7-10, 10-18, 18+. 7-10 is measurement and shapes only, because algebra and trigonometry are barred there (standard §1, map age note).
- Objective per item, observable verb, "shown by": [x] the table below.
- Standards cited per item (CCSS / NGSS PS / C3 / NGS) or UNVERIFIED: [x] CCSS, sources in math/applied/sources.md, fetched 2026-11-10. One item is UNVERIFIED.
- Loop mapped: hook / predict / see / explain / retry: [x] ramp unit below; other items use the same five steps (standard §3).
- Mastery "confident" bar for this subject: [x] the number strand's proposed bar (exact, no hint, no retry). This branch does not write a second bar. See below.
- Review-deck hookup (same deck, same ladder): [x] described. Wiring `learning.ts` and `review-deck.ts` is integrator-only and not done.
- Post-clip retrieval check (journal + any video): [n/a] this strand has no video clip. Host wrap-up is specified as a short scene. Whether that scene is video or real-time animation awaits owner decision D3.
- Motion tiers: Full / Lite / Flat described, learning parity stated: [x] ramp unit below. Not built.
- Accessibility: captions, tap alternative, no-timer default, SR live region: [x] specified below. Not built.
- Privacy: no PII, no identifiers, local-only records: [x] standard §7. No accounts, no free text.
- Content screen (§7a) passed; cut items logged with reason: [x] cuts below.
- Free: no revenue features; asset licences recorded: [x] no price, no ads. No new asset yet, so no licence to record.
- Educator rubric (docs/scaling/educator-gate-rubric.md) attached: [x] blank block below. Not signed. The gate stays GATED.
```

### Items (contract I2)

Source of truth: [`math/applied/items.json`](math/applied/items.json). Edit the JSON, then refresh this table. `math/applied/items.test.mjs` checks the shape.

Every number in a why is a problem given. It is not a fact about a real river, tower, product, or safety rule.

| Id | Group | Objective | Standard | Why first | Builds on | Use it elsewhere |
|---|---|---|---|---|---|---|
| `math-applied:measure:length-cm` | 7-10 | After this, a child can measure the length of a shelf in centimetres, shown by lining a ruler up with the shelf and entering the centimetre reading. | [2.MD.A.1](https://www.thecorestandards.org/Math/Content/2/MD/) | A shelf must reach from one bracket to the other. Guessing the length wastes the board. What length does the ruler show? | none | environment: centimetres of rain in a straight gauge, read off the scale |
| `math-applied:measure:longer-than` | 7-10 | After this, a child can compare two measured lengths and compute how much longer one is, shown by entering the centimetre gap between a board and a shelf. | [2.MD.A.4](https://www.thecorestandards.org/Math/Content/2/MD/) | A board and a shelf are both measured. If the board is shorter, it does not reach. How many centimetres longer or shorter is it? | `math-applied:measure:length-cm` | everyday life: picking a board that reaches a shelf, and by how many centimetres |
| `math-applied:measure:choose-unit` | 7-10 | After this, a child can estimate a length and choose centimetres or metres, shown by picking the unit for a short shelf and for a long path before measuring. | [2.MD.A.3](https://www.thecorestandards.org/Math/Content/2/MD/) | A shelf is short and the path to the river is long. A centimetre ruler is the wrong tool for the path. Which unit fits each one? | `math-applied:measure:length-cm` | geography: metres for a river path, centimetres for a short gap on a map |
| `math-applied:measure:elapsed-time` | 7-10 | After this, a child can compute the minutes between two clock times, shown by tapping the minute count on a line of minutes. | [3.MD.A.1](https://www.thecorestandards.org/Math/Content/3/MD/) | The clock shows when a walk starts and when it must end. How many minutes sit between those two times? | none | geography: minutes between two clock times on a short walk |
| `math-applied:measure:perimeter` | 7-10 | After this, a child can compute the distance around a polygon from its side lengths, shown by entering the total of the sides of a sandbox border. | [3.MD.D.8](https://www.thecorestandards.org/Math/Content/3/MD/) | A sandbox needs a border all the way around. Measuring one side does not tell how much border to cut. | `math-applied:measure:length-cm` | everyday life: border around a sandbox or a picture frame |
| `math-applied:measure:area-tiles` | 7-10 | After this, a child can find an area by counting unit squares with no gaps, shown by tapping each square on a floor and entering the count. | [3.MD.C.6](https://www.thecorestandards.org/Math/Content/3/MD/) | A floor must be covered with square tiles. Gaps and overlaps waste tiles. How many tiles cover it with none left over and none missing? | `math-applied:measure:length-cm` | chemistry: how many square tiles cover the bottom of a tray |
| `math-applied:measure:liquid-marks` | 7-10 | After this, a child can read a liquid volume in millilitres on a jug, shown by tapping the mark that matches 250 millilitres. | [3.MD.A.2](https://www.thecorestandards.org/Math/Content/3/MD/) | A recipe asks for 250 millilitres (a quarter of a litre) of water. Which line on the jug is that amount? | `math-applied:measure:choose-unit` | chemistry: reading millilitres of liquid on a jug |
| `math-applied:measure:right-angle` | 7-10 | After this, a child can sort a corner as a right angle, sharper than a right angle, or more open than a right angle, shown by placing three corners into those three groups. | [4.G.A.1](https://www.thecorestandards.org/Math/Content/4/G/) | A picture frame needs square corners. A corner that is too sharp or too open makes the frame crooked. | none | physics: sorting a ramp corner with the floor as square, sharper, or more open |
| `math-applied:measure:angle-degrees` | 7-10 | After this, a child can measure an angle in whole-number degrees with a protractor, shown by entering the degree reading for a ladder set against a wall. | [4.MD.C.6](https://www.thecorestandards.org/Math/Content/4/MD/) | A card beside a ladder shows 75. Only a protractor tells whether the ladder matches that number. | `math-applied:measure:right-angle` | physics: the degree reading of a ramp, compared with a number printed on a card |
| `math-applied:measure:rect-area` | 7-10 | After this, a child can compute the area of a rectangle from its length and its width, shown by entering the number that matches a full tile count. | [4.MD.A.3](https://www.thecorestandards.org/Math/Content/4/MD/) | Counting every tile on a long floor is slow. The length and the width are known. Which multiplication gives the same count? | `math-applied:measure:area-tiles`, `math-number:tables:facts` | economics: how many tiles a rectangular floor needs, from its length and its width |
| `math-applied:measure:convert-metric` | 10-18 | After this, a child can compute a length in metres from a length in kilometres, shown by entering the metres for a map label of 2.4 kilometres. | [5.MD.A.1](https://www.thecorestandards.org/Math/Content/5/MD/) | A map labels a river stretch 2.4 kilometres. The tape is marked in metres. How many metres is that walk? | `math-applied:measure:choose-unit`, `math-number:place:decimal-shifts` | geography: a map distance converted from kilometres to metres |
| `math-applied:measure:volume-box` | 10-18 | After this, a child can compute how many unit cubes fill a rectangular box, shown by packing the box on screen and entering the same number the edge lengths give. | [5.MD.C.5a](https://www.thecorestandards.org/Math/Content/5/MD/) | A crate must hold boxes. How many unit cubes fit inside before the crate is built? | `math-applied:measure:area-tiles`, `math-number:tables:multi-digit` | chemistry: how much liquid a rectangular tank holds, in unit cubes |
| `math-applied:measure:accuracy` | 10-18 | After this, a child can compare a reported length with the smallest mark on the tape, shown by rejecting 2.4837 metres when the tape shows centimetres and entering the reading the tape can support. | [HSN.Q.A.3](https://www.thecorestandards.org/Math/Content/HSN/Q/) | A tape shows centimetres. A report writes 2.4837 metres for a beam. Those extra digits are smaller than the tape can show. What should the report say? | `math-applied:measure:length-cm`, `math-applied:measure:convert-metric` | economics: a timber order that does not pretend more precision than the tape |
| `math-applied:measure:survey-check` | 18+ | After this, an adult can compare two beam measurements with the tape's smallest mark, shown by choosing a remeasure when they disagree by more than that mark. | UNVERIFIED | Two crews measure one beam and disagree by more than the tape's smallest mark. Which report can a buyer use? Fit: reviewers split. One says no code fits; one says HSN.Q.A.3, which measure:accuracy already uses for how many digits to report. The human signer picks. | `math-applied:measure:accuracy` | everyday life: measuring a beam again before an order is placed |
| `math-applied:geometry:shape-sort` | 7-10 | After this, a child can sort rectangles out of other shapes, shown by tapping only the shapes with four square corners. | [2.G.A.1](https://www.thecorestandards.org/Math/Content/2/G/) | A frame needs a piece with four square corners. Which of these pieces is that shape? | `math-applied:measure:right-angle` | everyday life: choosing the piece for a picture frame |
| `math-applied:geometry:scale-drawing` | 10-18 | After this, a child can compute a real length from a scale drawing, shown by entering the ground length when the map says 1 centimetre stands for 2 kilometres and the drawing is 4 centimetres. | [7.G.A.1](https://www.thecorestandards.org/Math/Content/7/G/) | A map says 1 centimetre stands for 2 kilometres. The river on the map is 4 centimetres long. The picture length is not the river length. How long is it on the ground? | `math-applied:measure:convert-metric`, `math-number:place:decimal-shifts`, `math-number:tables:facts` | geography: map scale, the real distance from a drawing |
| `math-applied:geometry:coordinates` | 10-18 | After this, a child can compute the length of a horizontal or vertical side on a coordinate grid, shown by entering the distance between a bridge and a camp that share one coordinate. | [6.G.A.3](https://www.thecorestandards.org/Math/Content/6/G/) | A grid map places a bridge and a camp on the same horizontal line. How long is the side between them, using the coordinates, without walking it? | `math-applied:measure:length-cm`, `math-number:place:compare` | geography: the length of a route side on a coordinate map |
| `math-applied:geometry:pythagoras` | 10-18 | After this, a child can compute the sloping side of a right triangle, shown by entering the board length of a ramp whose rise, ground run, and square ground corner are given. | [8.G.B.7](https://www.thecorestandards.org/Math/Content/8/G/) | A ramp must reach a door. The rise and the ground run are known, and the corner on the ground is square. How long is the sloping board, before it is cut? | `math-applied:measure:right-angle`, `math-applied:measure:length-cm`, `math-number:tables:multi-digit` | physics: the distance a ball travels along a straight ramp, which is the sloping side |
| `math-applied:geometry:distance-points` | 10-18 | After this, a child can compute the straight-line distance between two coordinate points, shown by entering the distance between a bridge and a camp that do not share a grid line. | [8.G.B.8](https://www.thecorestandards.org/Math/Content/8/G/) | A bridge and a camp sit at two grid points that do not share a line. How long is the straight line between them? | `math-applied:geometry:pythagoras`, `math-applied:geometry:coordinates` | geography: straight-line distance between two places on a coordinate map |
| `math-applied:geometry:cylinder-volume` | 10-18 | After this, a child can compute the volume of a cylinder, shown by entering the volume of a rain barrel when the problem says to use 3.14 in the circle rule. | [8.G.C.9](https://www.thecorestandards.org/Math/Content/8/G/) | A rain barrel is a cylinder. How much water fits? Packing cubes leaves gaps at the round wall. | `math-applied:measure:volume-box`, `math-number:tables:multi-digit` | environment: how much water a cylindrical barrel holds, using the problem's stated 3.14, which is not claimed as exact |
| `math-applied:rates:unit-rate` | 10-18 | After this, a child can compute a unit rate, shown by entering the coins for one metre of rope and tapping the cheaper stall. | [6.RP.A.2](https://www.thecorestandards.org/Math/Content/6/RP/) | One stall sells 3 metres of rope for 6 coins. Another sells 5 metres for 8 coins. Which is cheaper for one metre? Comparing the two totals does not answer it. | `math-number:division:standard-algorithm` | physics: metres travelled in one second, from a stated distance and a stated time |
| `math-applied:rates:constant-speed` | 10-18 | After this, a child can compute a steady pace and use it on a longer path, shown by entering kilometres in one hour and the hours for 20 kilometres. | [6.RP.A.3b](https://www.thecorestandards.org/Math/Content/6/RP/) | A path is 12 kilometres and takes 3 hours at one steady pace. How far in one hour, and how long for a path of 20 kilometres? | `math-applied:rates:unit-rate` | environment: litres of water each day, from a stated total and a stated number of days |
| `math-applied:rates:proportion` | 10-18 | After this, a child can identify the constant of proportionality in a table, shown by entering the single number that fills every missing row of hours and kilometres. | [7.RP.A.2b](https://www.thecorestandards.org/Math/Content/7/RP/) | A walk covers the same distance each hour. A table shows hours and kilometres. Guessing a new total for each row is the slow way. What single number fills every missing row? | `math-applied:rates:constant-speed` | geography: travel time between two places when the pace stays the same |
| `math-applied:rates:one-step` | 10-18 | After this, a child can compute the missing part of a one-step trail problem, shown by selecting the matching number sentence and entering how far the walker has gone on a 12 kilometre trail when 5 kilometres remain. | [6.EE.B.7](https://www.thecorestandards.org/Math/Content/6/EE/) | A trail is 12 kilometres and 5 kilometres are still ahead. How far has the walker already gone? Counting the whole trail again does not name the missing part. | `math-number:place:compare` | economics: a count of items times a price in coins equals a total; find the missing price |
| `math-applied:rates:two-step` | 10-18 | After this, a child can compute how many cups fit a budget that has a one-time charge plus a charge per cup, shown by entering the cup count for 4 coins once, 3 coins per cup, and a budget of 19 coins. | [7.EE.B.4a](https://www.thecorestandards.org/Math/Content/7/EE/) | A stall adds 4 coins once, then 3 coins for each cup. The budget is 19 coins. How many cups fit? Adding the 4 once does not answer it. | `math-applied:rates:one-step` | economics: a fixed charge plus a price per metre, and how many metres fit a budget |
| `math-applied:rates:slope-speed` | 10-18 | After this, a child can compare two distance-time lines and compute the speed the steeper line names, shown by tapping the faster trip and entering that speed. | [8.EE.B.5](https://www.thecorestandards.org/Math/Content/8/EE/) | Two trips are drawn as lines of distance against time. The steeper line is the faster trip. Which line, and what speed does the steepness name? | `math-applied:rates:proportion` | physics: on a straight track, the steeper distance-time line is the faster motion; no force is taught |
| `math-applied:rates:rearrange` | 10-18 | After this, a child can rearrange the problem's rule distance = speed × time to find the missing time, shown by entering the time when distance and speed are given. | [HSA.CED.A.4](https://www.thecorestandards.org/Math/Content/HSA/CED/) | The problem states distance = speed × time. Distance and speed are known. Time is the missing number, so the rule has to be turned around. | `math-applied:rates:one-step`, `math-applied:rates:constant-speed` | environment: the problem states fuel = use per hour × hours; find the hours from the fuel and the use per hour |
| `math-applied:rates:linear-model` | 10-18 | After this, a child can explain the starting amount and the daily change in a linear tank rule, shown by tapping which number is the start, which number is the daily change, and entering the day the tank reaches empty for the problem's givens. | [HSF.LE.B.5](https://www.thecorestandards.org/Math/Content/HSF/LE/) | A tank starts with a stated amount of water and loses a stated amount each day. What does the starting number mean, and what does the daily number mean, for the day the tank runs out? | `math-applied:rates:two-step`, `math-applied:rates:rearrange` | environment: water leaving a tank each day, as the two numbers in a linear rule |
| `math-applied:rates:break-even` | 10-18 | After this, a child can compute the length where two linear quotes cost the same, shown by entering that length from a graph of the two quotes. | [HSA.REI.C.6](https://www.thecorestandards.org/Math/Content/HSA/REI/) | Two workshops price a ramp. One charges more to show up and less per metre. The other does the reverse. At what length do they cost the same? | `math-applied:rates:two-step`, `math-applied:rates:slope-speed` | economics: the length where two price rules cost the same, with no price stated as a real quote |
| `math-applied:trig:ratios` | 10-18 | After this, a child can compute a side ratio for an acute angle and show it stays the same when the ramp is scaled, shown by entering rise divided by the sloping side for two ramps of the same steepness. | [HSG.SRT.C.6](https://www.thecorestandards.org/Math/Content/HSG/SRT/) | Two ramps have the same steepness and different sizes. Rise divided by the sloping side is the same number on both. That number belongs to the angle, not to the size. | `math-applied:geometry:pythagoras`, `math-applied:geometry:scale-drawing`, `math-number:fractions:divide` | physics: a small model ramp and a full-size ramp with the same angle share the same side ratio |
| `math-applied:trig:missing-side` | 10-18 | After this, a child can compute a missing side of a right triangle from an acute angle and one side, shown by entering the height of a pole from its shadow length and the sun's angle. | [HSG.SRT.C.8](https://www.thecorestandards.org/Math/Content/HSG/SRT/) | A pole casts a shadow. The shadow length and the sun's angle above the ground are both given. How tall is the pole, without climbing it? | `math-applied:trig:ratios`, `math-applied:measure:angle-degrees` | environment: the height of a tower from its shadow, by the same method, with no real tower height stated |
| `math-applied:trig:missing-angle` | 10-18 | After this, a child can compute an acute angle from two sides of a right triangle, shown by entering the degree steepness of a ramp from its rise and its run. | [HSG.SRT.C.8](https://www.thecorestandards.org/Math/Content/HSG/SRT/) | A ramp rises 1 metre over a 4 metre run. How steep is it in degrees, when a protractor cannot span the ramp? | `math-applied:trig:ratios`, `math-applied:measure:angle-degrees` | economics: the angle a roof order needs, with no price stated |
| `math-applied:trig:bearings` | 10-18 | After this, a child can compute a direction angle from two perpendicular distances, shown by entering the angle from north for 6 kilometres east and 8 kilometres north. | [HSG.SRT.C.8](https://www.thecorestandards.org/Math/Content/HSG/SRT/) | A boat must go 6 kilometres east and 8 kilometres north. Which angle from north does it point along? | `math-applied:trig:missing-angle` | geography: a direction angle between two places from two perpendicular distances |
| `math-applied:trig:triangle-area` | 10-18 | After this, a child can compute the area of a triangle that is not a right triangle, from two sides and the included angle, shown by drawing the perpendicular and entering the area. | [HSG.SRT.D.9](https://www.thecorestandards.org/Math/Content/HSG/SRT/) | A roof panel is a triangle that is not a right triangle. Two sides and the angle between them are known. How much sheet is needed? | `math-applied:trig:missing-side`, `math-applied:measure:rect-area` | economics: the sheet area a roof order needs, with no price stated |
| `math-applied:trig:law-of-sines` | 10-18 | After this, a child can compute a tower height from two angles and the distance between them, shown by entering the height when neither viewpoint is square-on to the tower. | [HSG.SRT.D.11](https://www.thecorestandards.org/Math/Content/HSG/SRT/) | A surveyor stands at two points on a straight path and measures the angles up to a tower. Neither spot is square-on to the tower. How tall is it? | `math-applied:trig:missing-side`, `math-applied:trig:missing-angle` | geography: the height of a tower that cannot be stood opposite, from two angles and the gap between them |

### Confident bar

Applied items use the bar the number strand proposes (exact answer, no hint, not a retry; Mastered needs a correct opening and a correct elsewhere round). Defined there so math has one bar. Speed is not an input. No timers in `7-10` (standard §6).

Until `src/game/learning.ts` can store `setting`, this subject would keep attempts in its own module state (contract I2). That file is not ours. No change is asked until Stage B.

### Measure-Up ramp (v1 candidate, not built)

PROPOSED: the v1 unit is a **ramp**, not a trip. A trip is `rates:constant-speed`, which cannot be a `7-10` round. A ramp can:

| Group | What the child does | Items |
|---|---|---|
| 7-10 | Measure the rise and the board. Sort the ground corner. Read the angle with a protractor against a number on a card. | `measure:length-cm`, `measure:longer-than`, `measure:right-angle`, `measure:angle-degrees` |
| 10-18 | Compute the board length. Compute the angle. Compute the height from two viewpoints that are not square-on (high school). | `geometry:pythagoras`, `trig:missing-angle`, `trig:law-of-sines` |
| 18+ | Same ramp, adult wording, no new code. If two measurements of the board disagree by more than the tape's smallest mark, choose a remeasure. | `measure:survey-check` |

The owner can still pick a trip for v1. That pick is part of lifting the gate, not made here.

Loop (standard §3), same learning on every tier:

1. **Hook (3–5 seconds).** A door is above the ground. The board in the yard is too short, or the ramp looks too steep. The picture shows the rise and the board before any rule.
2. **Predict.** The child taps a length or an angle before the scene moves.
3. **See.** Full: a three.js ramp (dynamic `import("three")`, disposed on exit, paused when the tab is hidden). Lite: the same ramp, low poly, no shadows. Flat: an SVG side view; the board still meets the door, or stops short, in steps. `usePrefersReducedMotion` forces Flat.
4. **Explain.** One or two sentences from the host: why the board was short, or why the angle was past the card. No new library. Characters already in the repo host it.
5. **Retry.** One hint, then the miss goes to the review deck.

### Motion, access, privacy

- Learning parity: Flat shows the same rise, run, board, and angle result as Full (standard §5.2).
- Tap targets at least 44 px. No drag required (standard §6). A protractor on Full is also three buttons: too small, matches, too big.
- No timer in `7-10`. Timers off by default everywhere.
- The canvas has a live region: "The board stops short of the door" / "The board meets the door".
- Colour is not the only signal.
- Nothing flashes more than 3 times a second.
- Records stay on the device. No name, no free text (standard §7).
- Open licence only, recorded beside the asset, when an asset exists. None yet.

### Review deck

Misses use the same `[0, 1, 3, 7, 14, 30]`-day ladder (standard §4). Not a second deck. A review round mixes 2 or 3 skills and can swap in the elsewhere setting.

PROPOSED error types for this strand, for the educator, not run:

| Type | Example the game can see |
|---|---|
| `unit-mismatch` | A kilometre label answered as if it were already metres. |
| `gap-in-count` | Area tiles counted with a gap left on the floor. |
| `scale-unread` | A map centimetre reported as the ground length. |
| `ratio-upside-down` | Run divided by rise when the item asked for rise over the sloping side. |
| `wrong-side-ratio` | The opposite side and the adjacent side swapped for the angle given. |

`wrong-side-ratio` is a label for a swap the game can check. It does not name a new trig fact.

### Content screen (standard §7a) — cuts

Left out, with the reason:

- Biology, including plants, animals, gardens-as-habitat, and the body. Borders are a sandbox or a frame, not a planted bed.
- Religion, mythology, sexuality, gender identity, parties, elections, living politicians.
- Interest, tax, and any price presented as a real or recommended price. Coins in a problem are givens.
- A "safe" ladder angle. 75 on the card is a problem given, not a safety standard (UNVERIFIED as a safety fact, so not stated as one).
- Glacier speed, a real river length, a real tower height, Ohm's law. The map and the CED.A.4 page mention these settings; no quantity is copied in.
- Percent. That item is `math-number:fractions:percent` (6.RP.A.3c). This strand's rate item is 6.RP.A.3b only.
- Inches, feet, and dollars as the play surface. The standards name them. The screen uses centimetres, metres, litres, and coins (world view).

### Design calls (PROPOSED, for the educator)

1. v1 scene is a ramp, so `7-10` is in the unit. A trip cannot be.
2. Three items share HSG.SRT.C.8 (missing side, missing angle, bearing). The observables differ. Merge them if the educator wants one item per code.
3. HSG.SRT.D.9 and D.11 are `(+)` high-school standards, so they sit in `10-18` with the other high-school codes. `18+` replays them in adult wording. It does not get a second code.
4. `measure:rect-area` is `7-10` because 4.MD.A.3 is grade 4. It uses multiplication; it does not teach it. The multiply step is `math-number:tables:facts`.
5. `measure:survey-check` is the one UNVERIFIED item. Drop it if the educator wants every item on a fetched code.
6. `rates:linear-model` uses the linear clause of HSF.LE.B.5 only. Exponential growth is not an item.

### Educator sign-off

Not signed. No agent signs this.

```
EDUCATOR SIGN-OFF
Spec: docs/scaling/math-spec.md (applied strand) + docs/scaling/math/applied/items.json
Signer: [name], [role], [band(s)], [subject]
Date: [YYYY-MM-DD]
Result: Approved / Approved after fixes / Not approved
Fixes: [list with owner]
Signature (typed name is fine): [ ]
```

### Stage B

Not started. The build gate is down. When it lifts, and after D5 is picked: one Measure-Up ramp as a subject module (contract I1), `released: false`, contracts I2 to I4, Full / Lite / Flat, tests first. Until Phase 0 merges, proof is tests plus a local harness that is not committed.

### Integrator

No shared file needs an edit for this addendum. Watch only: the number-strand ids above are not on `main` yet. `src/game/learning.ts` stays untouched until Stage B asks for a `setting` field.

## Adult (18+) rows, Stream F (PROPOSED)

These 18+ rows are proposed in v2 Stream F. Each is an UNVERIFIED adult round with a Fit note; educator review runs alongside, not as a gate.

- `math-applied:rates:tank-fill`
- `math-applied:geometry:fence-posts`
- `math-applied:trig:slope-ratio`
