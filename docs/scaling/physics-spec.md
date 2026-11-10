# Physics Spec — P4 Algebra-in-Physics

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

- **Scientist seat — VACANT (holder).** No physicist / chemist / general-scientist TOML exists in the installed persona packs (checked 2026-11-10; only data-scientist TOMLs, which do not fit). The seat's REQUIREMENTS stay: physics and chemistry only; the scientist writes and speaks in **children's language: simple words a 5th-grader follows**. Every script, clue, label, and host line must pass that test; a sentence a 5th-grader cannot follow is rewritten, not shipped. The holder is vacant, with the owner's three paths: (a) he names a human expert, (b) the coordinator finds and audits a candidate persona — nothing installs without his go-ahead, (c) carry as a recorded risk. Nothing in this spec is staffed.
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
Researcher, plus the SCIENTIST seat (VACANT holder — requirements stand:
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
- Video count: TO CONFIRM — no number is stated anywhere in this spec.
- Every sub-topic above is structure only; its curriculum anchoring and every physics formula are UNVERIFIED until the signed definition cites them per band and §0 verification is done at build time.
- Load-budget numbers (250 KB / 500 KB gzip): PROPOSAL, not measured (lens §12 flag 11).
- No other factual claims are made in this spec.
