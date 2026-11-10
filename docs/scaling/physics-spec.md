# Physics Spec — P4 Algebra-in-Physics

> **Stage A addendum (2026-11-10).** The 14 physics families from the retired
> `feat/science-spec` list now live here as predict-then-see scenes, not as
> videos. The source of truth is [`docs/scaling/physics/items.json`](physics/items.json)
> (contract I2). Sources and the cause-then-effect table are in
> [`docs/scaling/physics/sources.md`](physics/sources.md). Check:
> `node --test docs/scaling/physics/items.test.mjs`.
> Where the P4 sections below disagree (5th-grade-only, generated videos,
> formulas inside the youngest group), this addendum wins. Build stays
> **GATED**. Stage B has not started.

## Stage A — predict-then-see scenes

**Count: PROPOSED 27 rows** across the 14 families. Proposed only. The signed
definition may drop, split, or close any row. Two rows (`physics:pulley:closed`,
`physics:wheel:closed`) are closed on purpose: no physical-science performance
expectation was found for those effects, so they are not taught.

**Groups (standard §1).** `7-10` uses measurement and multiplication only.
`10-18` and `18+` add rates and trigonometry. No `7-10` row uses algebra or
trigonometry. A grade-5 code may sit in `7-10`. Grade-1 codes `1-PS4-1` and
`1-PS4-3` are flagged in the sources for the educator: the group is grades 2–5.

**How a round plays (standard §3).** Hook with the `why` problem, the child
taps a prediction, the scene shows the cause and the effect, the host says
one or two sentences, a miss gets one retry then the review deck. Choices are
taps. Nothing is a generated video. Full, Lite, and Flat tiers (standard §5.2)
show the same cause and the same effect. Flat is a stepped diagram. three.js
loads with a dynamic import inside the scene, only after the player picks
physics. The host cartoon clip in the older sections below conflicts with
"scenes, not videos." That conflict is owner decision D3. Until the owner
speaks, the explain step is the scene plus two sentences, not a new clip.

**v1 scene when the build gate lifts.** `physics:ramp:faster-hits-harder`
(safe ramp: which ball moves the cup farther). Not built in this stage.

**Mastery.** A first-try correct prediction is "confident" (standard §4).
Mastered also requires a correct use-it-elsewhere round (standard §0). Misses
use the existing review deck and the `[0, 1, 3, 7, 14, 30]`-day ladder.
Wiring into `src/game/review-deck.ts` is integrator-only (contract I2). Until
then a subject records misses in its own module. No module is built yet.

**Council (roles, not a signature).** Architect: items are I2 data, one scene
family, no second engine. Game designer: one variable, predict before the
motion, closed card when the effect has no source. Accessibility: tap only,
no timer in `7-10`, the canvas gets a live region at build time. Skeptic:
steeper-is-faster, heavier-falls-faster, rough-always-shorter, pole names,
and simple-machine advantage are cut. Recorded in `sources.md`. This council
does not sign the educator rubric.

### Item index

The JSON holds the fields. This index is the same ids, for review.

| Id | Group | Why it opens | Standard | Builds on | Use it elsewhere |
|---|---|---|---|---|---|
| `physics:push:which-way` | 7-10 | A box blocks a door. Which way does a stronger push move it? | 3-PS2-1 | — | everyday life: a stuck gate |
| `physics:push:equal-pushes` | 7-10 | The line is 8 tiles away and one push is 2 tiles. | 3-PS2-2 | tables facts; which-way | geography: equal steps on a path |
| `physics:drop:down` | 7-10 | A ball on a shelf must land in the bucket. | 5-PS2-1 | which-way | everyday life: a tipped jug |
| `physics:friction:measure-slide` | 7-10 | Will the next equal push stop at the same mark? | 3-PS2-2 | length in centimetres; which-way | everyday life: a chair sliding toward a table |
| `physics:ramp:faster-hits-harder` | 7-10 | Which ball moves the cup farther? | 4-PS3-1 | which-way; longer-than | everyday life: a wagon bumping a bucket |
| `physics:arrive:equal-steps` | 7-10 | Which cart's equal steps reach the line first? | 3-PS2-2 | tables facts; equal-pushes | geography: walkers and a bridge |
| `physics:lever:seesaw` | 7-10 | You push one end of a board down. Which end goes down? | 3-PS2-2 | which-way | everyday life: a playground see-saw |
| `physics:pulley:closed` | 7-10 | A bucket must come up. The round is closed. | UNVERIFIED | seesaw | environment: a well bucket, not played |
| `physics:wheel:closed` | 7-10 | A cart must roll. The round is closed. | UNVERIFIED | which-way | everyday life: a market cart, not played |
| `physics:balance:tug` | 7-10 | When the two pushes match, which way does the gate go? | 3-PS2-1 | which-way | everyday life: a stuck gate |
| `physics:energy:wound-moves` | 7-10 | Which toy car moves, the wound one or the other? | 4-PS3-4 | which-way | everyday life: a wound music box |
| `physics:shadow:blocks` | 7-10 | Which sheet is opaque, and which is transparent? | 1-PS4-3 | — | everyday life: sheets in front of a lamp |
| `physics:mirror:sends-back` | 7-10 | Which object sends the lamp light back? | 1-PS4-3 | shadow | everyday life: a mirror across a room |
| `physics:sound:pluck` | 7-10 | Which string makes a sound? | 1-PS4-1 | — | everyday life: a string on a box |
| `physics:magnet:flip` | 7-10 | After one magnet is turned, does the direction change? | 3-PS2-3 | which-way | everyday life: a cabinet door |
| `physics:push:mass` | 10-18 | Same push, more boxes. Which motion changes more? | MS-PS2-2 | which-way | economics: a heavier delivery cart |
| `physics:push:table` | 10-18 | Mass matches, net force does not. Which row changes more? | HS-PS2-1 | mass; one-step equations | geography: a sled on a straight path |
| `physics:ramp:higher-stored` | 10-18 | Which cart on the hill has more stored energy? | MS-PS3-2 | faster-hits-harder | everyday life: a book on a high shelf |
| `physics:ramp:slope-ratio` | 10-18 | Two ramps, rise and run given. Which is steeper? | HSG.SRT.C.8 | missing side; faster-hits-harder; right angle | geography: a tower and its shadow, lengths given |
| `physics:arrive:unit-rate` | 10-18 | Two distance-and-time cards. Who reaches the bridge first? | 6.RP.A.3b | constant speed; equal-steps | economics: price for one metre of rope |
| `physics:energy:transfer` | 10-18 | The ball stops and the cup slides. Where did the motion go? | MS-PS3-5 | faster-hits-harder | everyday life: a ball hitting a cup |
| `physics:sound:medium` | 10-18 | Air path or empty gap. Which one carries the sound? | MS-PS4-2 | pluck | geography: a shout that still needs air |
| `physics:mirror:three-ways` | 10-18 | The card's key says reflect, absorb, or transmit. | MS-PS4-2 | sends-back | everyday life: window, curtain, mirror |
| `physics:magnet:closer` | 10-18 | Which pair of magnets pulls harder? | MS-PS2-3 | flip | everyday life: a knife and a rack magnet |
| `physics:ramp:adult-ratio` | 18+ | Two crane booms. Which drawing is steeper? | HSG.SRT.C.8 | slope-ratio | economics: two roof slopes and a stated cost step |
| `physics:arrive:adult-time` | 18+ | The card states distance = speed × time. The time is missing. | HSA.CED.A.4 | rearrange; unit-rate | economics: how long a delivery takes |
| `physics:energy:missing` | 18+ | The card states the missing energy change. What is it? | HS-PS3-1 | transfer; rearrange | everyday life: a workshop lift card |

```
K-12 STANDARD (docs/scaling/k12-learning-design-standard.md)
- Why first (§0): unit opens with a real problem that needs the skill; "why does this matter?" answered in the first minute: [x] every row's why is that problem. Closed rows say why they are not played.
- Headline goal (§0): bridge to the previous subject + playable real-life application: [x] buildsOn is the bridge. The why is the application. Map chain Ph1–Ph4.
- Use-it-elsewhere round in at least one other subject (cross-application web): [x] one useElsewhere string on every row.
- Bands served: [x] 7-10, 10-18, and 18+ and why — standard §1. 7-10 is measurement and multiplication. 10-18 and 18+ add rates and trigonometry.
- Objective per item, observable verb, "shown by": [x] items.json
- Standards cited per item (CCSS / NGSS PS / C3 / NGS) or UNVERIFIED: [x] sources.md, fetched 2026-11-10. Pulley and wheel are UNVERIFIED and closed.
- Loop mapped: hook / predict / see / explain / retry: [x] §3, tap then scene. Not a video.
- Mastery "confident" bar for this subject: [x] correct prediction on the first try, plus one use-it-elsewhere round to reach Mastered.
- Review-deck hookup (same deck, same ladder): [x] same ladder. Integrator wires review-deck.ts. Not wired in this stage.
- Post-clip retrieval check (journal + any video): [x] no clip. The prediction is the check. N/A for video.
- Motion tiers: Full / Lite / Flat described, learning parity stated: [x] §5.2. Same cause and effect on every tier. Not built.
- Accessibility: captions, tap alternative, no-timer default, SR live region: [x] taps only; no timer in 7-10; live region is a Stage B requirement. No captions because there is no clip.
- Privacy: no PII, no identifiers, local-only records: [x] §7. No accounts, no free text.
- Content screen (§7a) passed; cut items logged with reason: [x] sources.md cut log. No biology.
- Free: no revenue features; asset licences recorded: [x] no assets yet. Open licence required at Stage B.
- Educator rubric (docs/scaling/educator-gate-rubric.md) attached: [x] blank sign-off below. Not signed. Gate stays closed.
```

```
EDUCATOR SIGN-OFF
Spec: docs/scaling/physics-spec.md (Stage A addendum, 2026-11-10)
Signer: [name], [role], [band(s)], [subject]
Date: [YYYY-MM-DD]
Result: Approved / Approved after fixes / Not approved
Fixes: [list with owner]
Signature (typed name is fine): [ ]
```

## Header

| Field | Value |
|---|---|
| Topic | P4 Algebra-in-physics — solving for x where x is a physical quantity, on the GeoDetective deck/guess machine (Algebra Detective) |
| Status | **GATED** — do not start building until P3 has landed AND its own definition is signed (see Definition of done) |
| Branch | `feat/physics-spec` (per this spec brief; the work packets call the P4 branch `feat/algebra-physics` — confirm the branch name before the build agent starts) |
| Video count | **TO CONFIRM** — do not invent a number. The count is set by the signed definition (algebra topic map + physics topics per band), not by this spec. |
| Repo | veeresh-bikkaneti/Meridian — free browser geography game for kids, live at https://veeresh-bikkaneti.github.io/Meridian/ (project record, MEMORY.md; confidence HIGH as a project-internal fact — the live web search on 2026-11-10 returned other products named "Meridian" and did not independently verify the repo URL, so no web citation is claimed for it) |
| Sources consulted | `meridian-scaling-lens-breakdown.md` §0 (lines 15–151), §3 P4 (lines 656–800), §12 staleness flags (lines 1899–1926), §13 open questions (lines 1927–1961); `meridian-scaling-work-packets.md` shared gates + dependency chart (lines 7–102), P4 (lines 282–335) |
| Spec date | 2026-11-10 |

## Expert seats

- **Scientist seat — HELD by Spatial Data Scientist (`spatial-data-scientist.toml`).** Owner decision 2026-11-10: use the available science persona since the content is public knowledge. Imperfect fit, disclosed: spatial statistics, not physics/chemistry — no physicist/chemist TOML exists in the packs (only data-scientist TOMLs). The seat's REQUIREMENTS stay: physics and chemistry only; the scientist writes and speaks in **children's language: simple words a 5th-grader follows**. Every script, clue, label, and host line must pass that test; a sentence a 5th-grader cannot follow is rewritten, not shipped.
- **Educator seat — BLOCKED.** No named educator exists. The named human educator / SME must sign IN WRITING, before build: (1) the algebra topic map per band + the physics topics per band, (2) the equivalent-form rule (is `2x + 6` the same as `2(x + 3)`?), (3) the judging policy for this mode, (4) the machine-verification gate, demonstrated on one complete mode, (5) subject-matter correctness of the physics content — a math educator alone is not enough if the physics is wrong; the signer must cover both, or two signers must sign. Until the signature(s) are on file, this packet stays GATED.
- Five lenses also apply as usual: software architect, UI/UX designer, game developer, researcher, educator (blocked).

## Topic scope

- **Age band:** 5th grade and up only. Which band meets algebra and which meets functions is a P1-definition question, not this packet's to invent — research it as a question for P1, with curriculum citations.
- **Purpose:** school revision, not new teaching. Algebra and physics topics anchor to what school already taught at each band, per the named curriculum. A band assignment with no curriculum citation is UNVERIFIED.
- **In scope (per lens §3 + packets P4):** Algebra Detective on the GeoDetective machine — clues = solving steps, guesses = candidate values/forms, step-reveal mechanics, win/loss per the GeoDetective contract (shuffled deck, exactly-once-per-cycle, cap, win/loss). Equation engine: a small parser, not a CAS — parse + manipulate expressions, with its scope written (what it parses, what it refuses); a parser with no stated refusal set is incomplete. Expression normalizer implementing the definition's equivalent-form rule — implemented exactly as defined; if the normalizer cannot be built honestly at this scope, the packet shrinks to exact-form judging and says so (a normalizer that is confidently wrong is worse than none). Variable-manipulation UI (e.g. drag terms across the equals sign), mocked first at 390px and 1280px. Physics application problems per the signed topic map, every problem machine-verified, every physics fact cited with a source.
- **Game ideas that fit (subject to the signed definition):** Algebra Detective, Equation Builder, Function Lab (oldest band only).
- **P4/P7 split (agreed in definition, not guessed):** P4 = algebra applied to physics quantities; P7 = predict-what-happens forces/motion (qualitative, no formulas). An unagreed split is OPEN; the two packets must not build overlapping content.
- **Out of scope:** quiz-loop algebra (the quiz loop is P3's; this packet is the detective format); partial credit for shown working (v1 exact/normalized-form judging only — any partial-credit policy is a later phase needing educator sign-off); any tiny-model use (P9, parked); any behaviour change to math v1 or geography. World view, not US-heavy: physics examples and settings must not default to the US; curricula vary by country.

## Topic structure — no count invented

Structure only; the video count is **TO CONFIRM** in the signed definition. The build agent turns this structure into videos once the count is set. Do not invent curriculum facts — each sub-topic below must cite the signed definition before content is written; a sub-topic with no citation is out of scope.

1. **Algebra Detective (core mode)** — clues reveal one step of solving for x at a time; the reveal must read as a mystery, not a worksheet. Guesses are candidate values/forms. Loop contract stated in writing; a test walks win, loss, guess cap, clue reveal order.
2. **Solving for x — one step at a time** — clue = one solving step; the child follows the steps to the value.
3. **Equation Builder** — variable-manipulation UI (drag terms across the equals sign); mocked at 390px and 1280px.
4. **Equivalent forms** — the definition's rule decides whether `2x + 6` is the same as `2(x + 3)`; the normalizer implements exactly that rule. Judging test walks: right answer, wrong answer, equivalent form accepted/rejected per the rule, near-miss.
5. **Function Lab (oldest band only)** — graphs; changing x watches y move; register specified with playtest evidence from that age group.
6. **Physics applications — motion** — algebra applied to quantities of motion (e.g. speed from distance and time), per the signed physics topic map; every problem machine-verified, every formula cited with source and date.
7. **Physics applications — force** — algebra applied to force quantities, per the signed map; cited and machine-verified.
8. **Physics applications — energy** — algebra applied to energy quantities, per the signed map; cited and machine-verified.
9. **Clue economy and deduction** — how many clues, what each reveals; the mystery must be solvable from the clues, not guessed blind.
10. **Review and replay** — misses replay by the step where the solving went wrong (error type per step), reusing P3's review-deck machinery where honest.

**`Question` kind:** `equation` payload, with the `Result` evidence field carrying the steps used — mapped against P2's interfaces; an interface mismatch found late is rework, not a discovery.
**Deck reuse:** every reused GeoDetective piece is traced to a file (`src/game/loop/` per study §8); a reuse claim with no file trace is UNVERIFIED.

## Hard rules (owner's — in every file)

1. **Verify EVERY key fact with live web search:** source URL + confidence (HIGH/MEDIUM/LOW per lens §0.2) on every claim. No source = mark UNVERIFIED, never state it as fact. No stale facts. A physics fact with no citation is UNVERIFIED and out of scope.
2. **NO POLITICS anywhere.**
3. **Status GATED (educator sign-off in writing).** Educator seat BLOCKED — no named educator exists. Signer must approve in writing: curriculum + topic map + judging rule + verification gate (plus the equivalent-form rule and physics correctness for this packet; two signers if one does not cover both math and physics).
4. **Counts:** TO CONFIRM for this spec. Never present a proposed count as decided, never invent one.
5. **7-stage release pipeline applies** — no feature ships unless all seven ran: (1) code review, (2) architectural review, (3) design review, (4) feasibility analysis (works in a browser), (5) manual QA by real play-testing, (6) visual testers (effects in sync/consistent), (7) age-group playtest with feedback to the game player and game researcher. A review-only pass is not testing.
6. **Lazy-load law:** nothing loads until a kid picks it. No subject loads before selection; inside a chosen subject, prefetch of the next 1–2 items is allowed. Load budget numbers (initial JS ≤ 250 KB gzip; per-game chunk ≤ 500 KB gzip) are PROPOSALS, not measurements — baseline on P2's first build; breach = branch blocked.
7. **Host wrap-up (owner's rule, every question, every feature):** win or lose, correct or wrong, every question ends with the host retelling the story behind the answer as a very small, short animated cartoonish video clip — not lengthy.
8. **Mockup first:** the manipulation UI and clue-reveal mockups are shown to the owner before building. A child must get it just by looking. Free, no paywalls, COPPA-safe (no accounts, no PII, no identifiers).
9. **Readiness audit (all four, demonstrated not promised):** (i) named curriculum + topic map, (ii) machine-verifiable judging rule, (iii) correctness checkable without an LLM near the data, (iv) core verb a child gets just by looking.

## Verification protocol (lens §0 — forcing rule)

Before any question in this spec is answered, the build agent MUST: (1) run a live web search to ground the answer in current information — answering from its own knowledge is forbidden; (2) give every key fact a named site source (with URL where possible, plus access date) or an explicit confidence level (HIGH/MEDIUM/LOW per §0.2); (3) record any fact with no source as UNVERIFIED and never assert it; (4) re-check anything time-sensitive against a current source — a stale fact is wrong. A section completed without these four steps is incomplete. Full protocol: lens §0.

## Agent prompt (copy-paste block)

```
You are the build agent for Meridian P4 Algebra-in-physics
(feat/physics-spec). Repo: veeresh-bikkaneti/Meridian. SPEC ONLY in this
file — do NOT generate videos here; the build agent implements from this
spec on branch feat/physics-spec. Never commit, push, open PRs, or merge
on your own; the coordinator does all git work and merging stays the
owner's decision, per PR, per head.

EXPERTISE REQUIRED: Software Architect, UI/UX Designer, Game Developer,
Researcher, plus the SCIENTIST seat (Spatial Data Scientist — requirements stand:
physics and chemistry only) and the EDUCATOR seat (BLOCKED — no named
educator exists; see gate below). The SCIENTIST must write and speak in
CHILDREN'S LANGUAGE: simple words a 5th-grader follows, in every script,
clue, label, and host line.

TOPIC: Algebra applied to physics — solving for x where x is a physical
quantity — on the GeoDetective deck/guess machine (Algebra Detective:
clues = solving steps, guesses = candidate values/forms), NOT the quiz
loop. VIDEO COUNT: TO CONFIRM — set by the signed definition, never
invented here. Equation engine: a small parser, not a CAS, with its
refusal set written. Normalizer implements the definition's equivalent-
form rule exactly — or the packet shrinks to exact-form judging and says
so. P4 = algebra applied to physics quantities; P7 = predict-what-
happens forces/motion. Do not build the same physics twice.

DELIVERABLES: engine + normalizer brief; detective-loop contract;
physics problem bank with a citation per fact and per formula; P4/P7
split agreement in writing; judging test plan. Video clips: 10 seconds
each.

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
judging rule + verification gate (+ equivalent-form rule and physics
correctness for this packet — two signers if one does not cover both),
screen recording of the built app (detective loop + equation judging +
lazy-load states — no recording = the testing did not happen). 7-stage
release pipeline in full (code review, architectural review, design
review, feasibility, manual QA by real play-testing, visual testers,
age-group playtest). No self-certification.

VERIFICATION PROTOCOL: verify EVERY key fact with live web search;
source URL + confidence (HIGH/MEDIUM/LOW) on every claim; no source =
UNVERIFIED, never asserted as fact; no stale facts. A wrong formula
taught fluently is the silent failure this packet cannot absorb.

NO POLITICS anywhere. World view, not US-heavy. If the educator is
still unstaffed when you are assigned, your first job is to report that
the packet is blocked — not to build around it.
```

## Open questions for the owner

1. **Q1 (educator + curriculum):** who is the named educator/SME (math + physics coverage, or two signers), and which curriculum does the topic map follow (varies by country)?
2. **Q3 (judging):** is `2x + 6` the same answer as `2(x + 3)`? Decided in P1's definition — needs the owner's word with educator input.
3. **Video count:** TO CONFIRM — what count does the signed definition set for algebra-in-physics?
4. **Band placement:** which band meets algebra, which meets functions? (P1-definition question.)
5. **P4/P7 split:** confirm in definition that P4 owns formulas and P7 owns qualitative predict-what-happens — or adjust the line.
6. **Q5 (load budget):** accept the proposed 250 KB / 500 KB starting numbers once baselined, and what tap → first-playable-paint time on what device is "fast enough"?
7. **Alert policy (study §10 Q7):** which funnel types, if any, may page a human? Unassigned — needs your decision before funnel types are defined.

## Definition of done

Done when: (a) Algebra Detective plays end to end per the GeoDetective contract (clues reveal solving steps, guesses judged by the normalizer, win/loss matches the contract); (b) the equivalent-form rule is implemented exactly as defined, with a test walking right answer, wrong answer, equivalent form accepted/rejected per the rule, near-miss; (c) every physics problem is machine-verified and every physics fact cited with a source; (d) the P4/P7 split is agreed in writing; (e) load budget met on P2-measured numbers and lazy-load behaviour verified as in P3; (f) educator signature(s) on file; (g) every question ends with the host story clip; (h) the 7-stage release pipeline ran in full; (i) panel review passed with a screen recording.

## UNVERIFIED log (this spec)

- Repo/live-site identity: per project record (MEMORY.md), confidence HIGH as a project-internal fact; live web search 2026-11-10 did not independently verify the repo URL — no web citation claimed.
- Video count: TO CONFIRM — the sections below do not set a video count. The Stage A addendum replaces videos with scenes and states a separate row count, PROPOSED 27, which is not a decision.
- Every sub-topic above is structure only; its curriculum anchoring and every physics formula are UNVERIFIED until the signed definition cites them per band and §0 verification is done at build time.
- Load-budget numbers (250 KB / 500 KB gzip): PROPOSAL, not measured (lens §12 flag 11).
- No other factual claims are made in this spec.
