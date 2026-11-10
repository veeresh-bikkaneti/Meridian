# Math Spec — P3 Math v1 (quiz loop, exact answers)

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
