# Science Spec — P7 Science Map (world that responds)

## Header

| Field | Value |
|---|---|
| Topic | P7 Science map — a world that responds (responsive simulation, not a quiz) |
| Status | **GATED** — do not build until the gate clears (see Definition of done) |
| Branch | `feat/science-spec` (per this spec brief; the work packets call the P7 branch `feat/science-map` — confirm the branch name before the build agent starts) |
| Video count | **PROPOSED 20–30** — 24 proposed below (14 physics + 10 chemistry). Proposed only, never decided; the signed definition may change the number. |
| Repo | veeresh-bikkaneti/Meridian — free browser geography game for kids, live at https://veeresh-bikkaneti.github.io/Meridian/ (project record, MEMORY.md; confidence HIGH as a project-internal fact — the live web search on 2026-11-10 returned other products named "Meridian" and did not independently verify the repo URL, so no web citation is claimed for it) |
| Sources consulted | `meridian-scaling-lens-breakdown.md` §0 (lines 15–151), §6 P7 (lines 1109–1248), §12 staleness flags (lines 1899–1926), §13 open questions (lines 1927–1961); `meridian-scaling-work-packets.md` shared gates + dependency chart (lines 7–102), P7 (lines 445–495) |
| Spec date | 2026-11-10 |

## Expert seats

- **Scientist seat — HELD by Spatial Data Scientist (`spatial-data-scientist.toml`).** Owner decision 2026-11-10: use the available science persona since the content is public knowledge. Imperfect fit, disclosed: spatial statistics, not physics/chemistry — no physicist/chemist TOML exists in the packs (only data-scientist TOMLs). The seat's REQUIREMENTS stay: physics and chemistry only; the scientist writes and speaks in **children's language: simple words a 5th-grader follows**. Every script, clue, label, and host line must pass that test; a sentence a 5th-grader cannot follow is rewritten, not shipped.
- **Educator seat — BLOCKED.** No named educator exists. The educator must sign in writing, before build: (1) the science topic map per band, (2) the simulation rules, (3) the judging rule, (4) the machine-verification gate, demonstrated on one complete mode. Until that signature is on file, this packet stays GATED.
- Five lenses also apply as usual: software architect, UI/UX designer, game developer, researcher, educator (blocked).

## Scope exclusion — read first

- **NO biology in this spec, anywhere.** Owner's words (2026-11-10): biology is excluded — "it's become controversial these days." No biology topics, no biology videos.
- The P7 section of the lens breakdown lists eight proposal ideas (Plant Lab, Water Cycle Journey, Food Web Weaver, Animal Homes, Body Quest, Element Detective, Physics Playground, Cell Explorer). Of those, the biology ones (Plant Lab, Food Web Weaver, Animal Homes, Body Quest, Cell Explorer) are **left out entirely** under this exclusion. Element Detective and Physics Playground survive only in their physics/chemistry form (see the list below).
- **Earth science / astronomy (e.g. the water cycle as an earth-science topic) is NOT in the 20–30 count and NOT assigned to the scientist seat.** It is recorded as "scope to confirm with owner" in Open questions below. Do not build it, do not count it.
- **This spec contains physics and chemistry videos only.**

## Topic scope

- **Age band:** 5th grade and up only. No 5–7 content until the owner answers Q2 in writing (lens §12 flag 1, §13 Q2).
- **Purpose:** school revision, not new teaching. Every video practises what school already taught at that band; a video that cannot anchor to a school-taught topic is out of scope for that band.
- **In scope (per lens §6 + packets P7):** one responsive world first — the definition chooses ONE responsive system; do not build all ideas at once. Core verb: act on a small simulation, see the consequence (predict-then-see: the child predicts, then tests). Judging: prediction judged against verified outcome rules. Simulation rules are checked data — every cause → effect rule verified with a source; no improvised outcomes. Simulation state must survive a load failure (retry + state preserved; failure never eats progress).
- **P4/P7 split (agreed in definition, not guessed):** P4 = algebra applied to physics quantities (formulas, solving for x). P7 science videos = predict-what-happens forces/motion, qualitative — no formulas here. An unagreed split is OPEN; the two packets must not build overlapping content.
- **P6/P7 overlap:** the chemistry videos below share the "predict-then-see" engine shape with P6 (chemistry). Sharing is decided via the P2 simulation spike, not invented here; neither packet waits for the other.
- **Out of scope:** any science quiz (dismissed by the council — a quiz with science words is not a science game); any physics content that duplicates P4; any biology topic or video (excluded, see above); any earth-science/astronomy topic until the owner confirms scope; any tiny-model use (P9, parked); any behaviour change to other games. World view, not US-heavy: examples and settings must not default to the US; curricula vary by country, and the topic map must say which curriculum it follows.

## Topic structure — 24 PROPOSED videos (not decided)

**Status of this list:** structure proposals only. No title below is verified content and no title asserts a fact. Before any video is scripted, every fact in it must be verified per §0 (live web search, named site source, confidence HIGH/MEDIUM/LOW) or marked UNVERIFIED and left out. The signed definition may replace, drop, or reorder any item.

### A. Physics — predict-what-happens forces and motion (14 proposed)

1. Push and pull — what moves when you push it?
2. Drop it and see — what falls, and how does it fall?
3. Friction — sliding on smooth vs rough ground.
4. Ramps — rolling down steep vs gentle slopes.
5. Who gets there first? — fast vs slow, without formulas.
6. Levers — lifting something heavy with a lever.
7. Pulleys — lifting with a pulley.
8. Wheel and axle — why wheels make work easier.
9. Balanced or not? — tug-of-war and balanced vs unbalanced forces.
10. Stored energy to moving energy — wind it up, let it go.
11. Shadows — light, shadow, and what blocks light.
12. Mirrors — reflections and where light bounces.
13. Sound from shaking — what makes a sound, and what stops it.
14. Magnets — what pulls together, what pushes apart.

### B. Chemistry — combine-and-watch, predict-then-see (10 proposed)

15. Solid, liquid, gas — what changes when things get hot or cold.
16. Melting and freezing — ice to water and back.
17. Where does the water go? — watching water dry up.
18. What dissolves? — stir it and see.
19. What makes it fizz? — mixing things and watching what happens.
20. Rust — what happens to metal left out in the rain?
21. Sorting materials — which ones a magnet pulls, which dissolve, which float.
22. Meet the elements — the periodic table as a detective board (Element Detective candidate — only if the signed definition supports it).
23. Tiny building blocks — everything is made of small pieces.
24. Kitchen chemistry — safe mixes in the kitchen, predict-then-see.

**Count check:** 14 physics + 10 chemistry = 24, inside the proposed 20–30 range. Nothing else is counted. Earth science / astronomy: 0 counted, scope to confirm.

## Hard rules (owner's — in every file)

1. **Verify EVERY key fact with live web search:** source URL + confidence (HIGH/MEDIUM/LOW per lens §0.2) on every claim. No source = mark UNVERIFIED, never state it as fact. No stale facts — a person in a role, a curriculum version, or a "current" claim must be re-checked at research time.
2. **NO POLITICS anywhere.** No political content, framing, or examples in any video, question, clue, or host line.
3. **Status GATED (educator sign-off in writing).** Educator seat BLOCKED — no named educator exists. Signer must approve in writing: curriculum + topic map + judging rule + verification gate (plus the simulation rules for this packet).
4. **Counts:** this is the only spec with a proposed count (20–30, proposed only). Never present it as decided.
5. **7-stage release pipeline applies** — no feature ships unless all seven ran: (1) code review, (2) architectural review, (3) design review, (4) feasibility analysis (works in a browser), (5) manual QA by real play-testing, (6) visual testers (effects in sync/consistent), (7) age-group playtest with feedback to the game player and game researcher. A review-only pass is not testing.
6. **Lazy-load law:** nothing loads until a kid picks it. No subject loads before selection; inside a chosen subject, prefetch of the next 1–2 items is allowed. Load budget numbers (initial JS ≤ 250 KB gzip; per-game chunk ≤ 500 KB gzip) are PROPOSALS, not measurements — baseline on P2's first build; breach = branch blocked.
7. **Host wrap-up (owner's rule, every question, every feature):** win or lose, correct or wrong, every question ends with the host retelling the story behind the answer as a very small, short animated cartoonish video clip — not lengthy.
8. **Mockup first:** the world mockup is shown to the owner before building. A child must get it just by looking. Free, no paywalls, COPPA-safe (no accounts, no PII, no identifiers).
9. **Readiness audit (all four, demonstrated not promised):** (i) named curriculum + written topic map per band; (ii) judging rule that is machine-verifiable; (iii) content correctness checkable without an LLM near the data; (iv) core verb a child gets just by looking.

## Verification protocol (lens §0 — forcing rule)

Before any question in this spec is answered, the build agent MUST: (1) run a live web search to ground the answer in current information — answering from its own knowledge is forbidden; (2) give every key fact a named site source (with URL where possible, plus access date) or an explicit confidence level (HIGH/MEDIUM/LOW per §0.2); (3) record any fact with no source as UNVERIFIED and never assert it; (4) re-check anything time-sensitive against a current source — a stale fact is wrong. A section completed without these four steps is incomplete. Full protocol: lens §0.

## Agent prompt (copy-paste block)

```
You are the build agent for Meridian P7 Science map (feat/science-spec).
Repo: veeresh-bikkaneti/Meridian. SPEC ONLY in this file — do NOT generate
videos here; the build agent implements from this spec on branch
feat/science-spec. Never commit, push, open PRs, or merge on your own;
the coordinator does all git work and merging stays the owner's decision,
per PR, per head.

EXPERTISE REQUIRED: Software Architect, UI/UX Designer, Game Developer,
Researcher, plus the SCIENTIST seat (Spatial Data Scientist — requirements stand:
physics and chemistry only) and the EDUCATOR seat (BLOCKED — no named
educator exists; see gate below). The SCIENTIST must write and speak in
CHILDREN'S LANGUAGE: simple words a 5th-grader follows, in every script,
clue, label, and host line. No biology content of any kind (owner's
exclusion, 2026-11-10). Earth science / astronomy is out of scope until
the owner confirms it — do not build it, do not count it.

TOPIC: Science as a world that responds, 5th grade and up, school
revision (not new teaching). One responsive world first (definition
chooses which); core verb: act on a small simulation, see the
consequence (predict-then-see). PROPOSED video count: 20-30 (24 proposed
in the spec: 14 physics + 10 chemistry). Proposed only — never present
the count as decided. P4 = algebra applied to physics quantities;
this packet = predict-what-happens forces/motion, qualitative, no
formulas. Share the predict-then-see engine shape with P6 only as the
P2 simulation spike defines it.

DELIVERABLES: world mockup (owner-shown before building, at 390px and
1280px); simulation-rules data with a source per rule; prediction-then-
see judging brief; P4/P7 split agreement in writing; spike assessment
(P2's simulation spike must prove the shell contract can carry a
responsive world — if it does not, this packet waits for a contract
revision and builds no parallel engine). Video clips: 10 seconds each.

TECH: v4 recipe — AI video-gen + Avocado TTS + ffmpeg. Storyteller
voice: Magnus, 86-138 Hz (project record). 1152x768, 24fps, h264+AAC.
Tap-to-play, preload=none. Captions/VTT + transcript per clip.
Lazy-load law: nothing loads until a kid picks it; prefetch of the next
1-2 items inside a chosen subject is allowed. Host story clip after
every round (win or lose, correct or wrong) — very small, short animated
cartoonish video, not lengthy.

GATES (all must pass): tsc, npm test, test:worker, lint-cards GATE
PASSED, build:pages, Playwright E2E sequential --workers=1, panel
review, educator sign-off IN WRITING for curriculum + topic map +
judging rule + verification gate (+ simulation rules for this packet),
screen recording of the built app (the world responding must be visible
in the recording, not just asserted in logs — no recording = the testing
did not happen). 7-stage release pipeline in full (code review,
architectural review, design review, feasibility, manual QA by real
play-testing, visual testers, age-group playtest). No self-certification.

VERIFICATION PROTOCOL: verify EVERY key fact with live web search;
source URL + confidence (HIGH/MEDIUM/LOW) on every claim; no source =
UNVERIFIED, never asserted as fact; no stale facts.

NO POLITICS anywhere. World view, not US-heavy. If the educator is
still unstaffed when you are assigned, your first job is to report that
the packet is blocked — not to build around it.
```

## Open questions for the owner

1. **Q1 (educator + curriculum):** who is the named science educator/SME, and which curriculum does the topic map follow (varies by country)? Blocks every subject GO.
2. **Q2 (audience):** written confirmation that new games are 5th-grade-and-up only, and that 5–7 content drops out.
3. **Q11 (science spike):** authorise the simulation prototype in Phase 0/1, or does science wait?
4. **Earth science / astronomy scope:** is the water cycle and any astronomy content in scope for this packet, or out? (Not counted, not assigned to the scientist seat, until you rule.)
5. **P4/P7 split:** confirm in definition that P7 stays qualitative predict-what-happens and P4 owns formulas — or adjust the line.
6. **P6/P7 chemistry overlap:** one shared predict-then-see engine, or two separate chemistry surfaces?
7. **Q5 (load budget):** accept the proposed 250 KB / 500 KB starting numbers once baselined, and what tap → first-playable-paint time on what device is "fast enough"?
8. **Q9-equivalent / alert policy (study §10 Q7):** which funnel types, if any, may page a human? Unassigned — no packet owns it; needs your decision before funnel types are defined.

## Definition of done

Done when: (a) one responsive science world plays end to end with visible, correct consequences; (b) every simulation rule is verified data with a source; (c) the prediction-then-see loop works as the definition specifies; (d) load budget met on P2-measured numbers and lazy-load behaviour verified, including a load failure mid-experiment preserving state; (e) the readiness audit's four points are demonstrated; (f) the P4/P7 split is agreed in writing; (g) the educator signature is on file; (h) the 7-stage release pipeline ran in full; (i) panel review passed with a screen recording of the built app; (j) no biology content exists in the build.

## UNVERIFIED log (this spec)

- Repo/live-site identity: per project record (MEMORY.md), confidence HIGH as a project-internal fact; live web search 2026-11-10 did not independently verify the repo URL — no web citation claimed.
- Every video title in §Topic structure is a PROPOSED structure item, not a verified fact; content facts for each video are UNVERIFIED until sourced per §0 at build time.
- Load-budget numbers (250 KB / 500 KB gzip): PROPOSAL, not measured (lens §12 flag 11).
- No other factual claims are made in this spec.
