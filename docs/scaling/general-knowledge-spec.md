# General Knowledge Spec — P10 GK Trivia Quiz + P11 GK Current Affairs + P12 GK Detective

## Header

| Field | Value |
|---|---|
| Topic | General Knowledge, all three owner-picked options (2026-11-07, "All 3"): P10 GK Trivia Quiz (option A) + P11 GK Current Affairs (option B) + P12 GK Detective (option C) |
| Status | **GATED** — all three options. P11 carries an extra gate no other packet has: the owner's written ruling on the revision-rule tension (see below). Until the owner rules, P11 is definition-only. |
| Branch | `feat/general-knowledge-spec` (per this spec brief; the work packets propose `feat/gk-trivia-quiz`, `feat/gk-current-affairs`, `feat/gk-detective` — confirm the branch name(s) before the build agent starts; the three options may need three branches, one per option) |
| Video count | **TO CONFIRM** — do not invent a number, for any of the three options. The counts are set by the signed definitions, not by this spec. |
| Repo | veeresh-bikkaneti/Meridian — free browser geography game for kids, live at https://veeresh-bikkaneti.github.io/Meridian/ (project record, MEMORY.md; confidence HIGH as a project-internal fact — the live web search on 2026-11-10 returned other products named "Meridian" and did not independently verify the repo URL, so no web citation is claimed for it) |
| Sources consulted | `meridian-scaling-lens-breakdown.md` §0 (lines 15–151), §8 P10 (lines 1425–1558), §9 P11 (lines 1559–1714), §10 P12 (lines 1715–1852), §12 staleness flags (lines 1899–1926), §13 open questions (lines 1927–1961); `meridian-scaling-work-packets.md` shared gates + dependency chart (lines 7–102), P10 (lines 602–657), P11 (lines 658–719), P12 (lines 720–806) |
| Spec date | 2026-11-10 |

## Expert seats

- **General-knowledge seat: owner to name.** No seat is named by the owner for general knowledge — do not invent one. This is a gap, not a silent default: the build agent reports it as open.
- **Educator seat — BLOCKED.** No named educator exists. The named human educator / SME (a general-knowledge educator; for P11 a current-affairs educator) must sign IN WRITING, before build: (1) the GK topic map per band (P10) / the topic map + pipeline design (P11, signed once) / the case-topic map per band (P12), (2) the judging rule for each mode, (3) the machine-verification gate, demonstrated on one complete mode, (4) for P12, the game design (case structure, clue reveal, guess mechanic, win/loss, fail state, deduction verb). For P11, sign-off is **per item, not just per topic map** — every published item signed (or signed-off in a reviewed batch) before it ships. A math educator's signature does not cover this packet; for P12, the case bank's facts span subjects, so the signer must cover the case content or two signers must sign. Until the signature(s) are on file, all three options stay GATED.
- Five lenses also apply as usual: software architect, UI/UX designer, game developer, researcher, educator (blocked).

## Topic scope

- **Age band:** 5th grade and up only. No 5–7 content until the owner answers Q2 in writing.
- **Purpose:** school revision, not new teaching — **except P11, which FAILS that rule (see the OPEN ruling below).** P10 and P12 exist under the rule; P11 is recorded as failing it, not softened.
- **"School GK" is the boundary and it is fuzzy** — what counts as general knowledge a school teaches varies by country and curriculum. The definitions must name the GK topic map per band with sources; the boundary cannot be invented. If a definition cannot name it with sources, the build agent reports that rather than building a bank on a guessed boundary.
- **In scope (per lens §8–§10 + packets P10–P12):**
  - **P10 Trivia Quiz:** one trivia mode on P3's quiz loop (same run/session/scoring/review-deck machinery, new question bank and judging — if P3 has not landed, this option waits for the loop contract; it does not re-implement a loop). School-GK questions per the signed topic map, exact-answer judging in v1. Review deck wired to question topics (misses replay by topic; topic tags are part of the question record). No current affairs here; no detective format here.
  - **P11 Current Affairs:** one current-affairs mode (quiz loop or short news card, per the definition; mockup first). Fresh-content pipeline design FIRST — sourcing, dating, review, publication, retirement, with the staleness period stated as a number. Sourcing rules: trusted sources only (named list, each with publisher and why it is trusted); aggregators and social sources excluded. Every item dated at publication; no undated "current" claims anywhere; every item educator-signed before it ships. Expiry/retirement: a stale item must not be served — demonstrated by a test that walks an expired item being withheld, not asserted. Freshness is a permanent operational cost, not a one-time build: the definition must state who operates the pipeline after launch, or the mode ships with an expiry that visibly retires it.
  - **P12 GK Detective:** one detective mode on the GeoDetective machine (shuffled deck, exactly-once-per-cycle, cap, win/loss, clue reveal — each reused piece traced to a file in `src/game/loop/`). Cases built from cited GK facts (school GK, history, geography, science — cross-subject cases; the science in cases is physics/chemistry only, per the owner's scope — no other science strands are assigned here). Clues reveal facts step by step; guesses are candidate answers; the deduction must be visible. **The game design document comes FIRST and is a gate, not a phase:** case structure, clue reveal, guess mechanic, win/loss, fail state, deduction verb — signed before any code. A detective game without a real deduction verb is trivia with a detective skin — the design must prove the verb is real (a worked case where the clues, and only the clues, lead to the answer), or the packet returns to the owner rather than shipping trivia as a detective game.
- **Overlap rule (all three options):** the same fact must not be written three ways with three different answers across P5 (history), P7 (science), and P8 (journal). Overlapping facts cite one source — a fact with conflicting sources across packets is a contradiction to resolve before build.
- **Out of scope:** any GK beyond the signed school topic map; any trivia-for-trivia's-sake (facts with no school anchor); any current-affairs item without a trusted source, a date, or educator sign-off; any case without cited facts; any detective skin over a trivia loop; any tiny-model use (P9, parked); any behaviour change to geography or math. World view, not US-heavy: the school-GK boundary varies by country and curriculum; definitions must not default to one country's GK.

## ⚠️ P11 revision-rule tension — OPEN, do not decide

Recorded here exactly as the lens breakdown and work packets state it — **do not soften, do not drop, do not decide**:

> **P11 FAILS the standing "revision, not new teaching" rule.** Current affairs, by definition, teaches what just happened — new content, not revision of what school already taught. The owner picked it anyway ("All 3", 2026-11-07). Two honest resolutions; the owner must pick one **in writing** before any build:
> - **(a) Explicit recorded override** — the owner waives the revision rule for this packet only, carried as a named risk.
> - **(b) Reframe as revision** — every item anchored to a civics/history topic the child already met in school ("the news behind what you learned in school"); items with no school anchor are out of scope.
> An agent may never record the waiver itself. Until the owner rules, P11 is definition-only and GATED. The readiness audit cannot pass until the ruling is on file.

Also OPEN (Q16): what counts as school GK per band (and does it vary by country/curriculum), and the staleness period (how fast do items retire — a number with a rationale, e.g. "retire after N days unless re-verified"; "when it feels stale" is not a rule).

## Topic structure — no count invented

Structure only; the video count is **TO CONFIRM** for each of the three options in the signed definitions. The build agent turns this structure into videos once the counts are set. Do not invent curriculum facts — each sub-topic below must cite the signed definition before content is written; a sub-topic with no citation is out of scope.

### P10 — Trivia Quiz (option A)

1. **School-GK question bank** — per the signed topic map per band; bank + difficulty tiers; every question machine-verified (answer checked against its source, not trusted from the generator) and cited with a trusted source and a confidence level.
2. **Exact-answer judging (v1)** — a test walks right answer, wrong answer, near-miss.
3. **Review deck by topic** — misses replay by topic.
4. **Overlap-resolution table (P5/P7/P8)** — one source per overlapping fact.

### P11 — Current Affairs (option B)

5. **Fresh-content pipeline** — sourcing, dating, review, publication, retirement; staleness period stated as a number.
6. **Trusted-source list** — named list with publisher and why each source is trusted; aggregators and social sources excluded.
7. **Recency rules** — every item dated; every item shows its date; stale items visibly retired, never silently served (retired state mocked).
8. **Per-item sign-off flow** — a gate in the pipeline, not a checkbox after publication.
9. **Operator statement** — who operates the pipeline after launch, or the expiry fallback that visibly retires the mode.

### P12 — GK Detective (option C)

10. **Game design document (signed gate)** — case structure, clue reveal, guess mechanic, win/loss, fail state, deduction verb; one worked case proving the deduction verb is real.
11. **Case bank** — cases built from cited GK facts per the signed case-topic map per band; every case solution path machine-verified (checked, not trusted from the author).
12. **Clue economy** — how many clues, what each reveals; stated in the design AND playtested with the age group, not asserted (too hard teaches nothing — the child guesses blind; too easy is trivia).
13. **Overlap-resolution table (P5/P7/P8)** — one source per overlapping fact.

## Hard rules (owner's — in every file)

1. **Verify EVERY key fact with live web search:** source URL + confidence (HIGH/MEDIUM/LOW per lens §0.2) on every claim. No source = mark UNVERIFIED, never state it as fact. No stale facts — a stale fact presented as current is wrong (the standing warning that defines P11). Every P11 item must be dated; no undated "current" claims anywhere.
2. **NO POLITICS anywhere.** This is a hard line for this packet in particular: current-affairs and history content must be factual, sourced, and dated — no political framing, commentary, or present-day political examples.
3. **Status GATED (educator sign-off in writing).** Educator seat BLOCKED — no named educator exists. Signer must approve in writing: curriculum + topic map + judging rule + verification gate (plus the game design for P12, and per-item sign-off for P11).
4. **Counts:** TO CONFIRM for all three options. Never present a proposed count as decided, never invent one.
5. **7-stage release pipeline applies** — no feature ships unless all seven ran: (1) code review, (2) architectural review, (3) design review, (4) feasibility analysis (works in a browser), (5) manual QA by real play-testing, (6) visual testers (effects in sync/consistent), (7) age-group playtest with feedback to the game player and game researcher. A review-only pass is not testing.
6. **Lazy-load law:** nothing loads until a kid picks it. No subject loads before selection; inside a chosen subject, prefetch of the next 1–2 items is allowed. Load budget numbers (initial JS ≤ 250 KB gzip; per-game chunk ≤ 500 KB gzip) are PROPOSALS, not measurements — baseline on P2's first build; breach = branch blocked.
7. **Host wrap-up (owner's rule, every question, every feature):** win or lose, correct or wrong, every question ends with the host retelling the story behind the answer as a very small, short animated cartoonish video clip — not lengthy.
8. **Mockup first:** each mode's mockup is shown to the owner before building, at 390px and 1280px, for the youngest and oldest bands in scope. A child must get it just by looking. Free, no paywalls, COPPA-safe (no accounts, no PII, no identifiers).
9. **Readiness audit (all four, demonstrated not promised):** (i) named curriculum + topic map, (ii) machine-verifiable judging rule, (iii) correctness checkable without an LLM near the data, (iv) core verb a child gets just by looking. For P12, the signed game design sits on top of the audit.

## Verification protocol (lens §0 — forcing rule)

Before any question in this spec is answered, the build agent MUST: (1) run a live web search to ground the answer in current information — answering from its own knowledge is forbidden; (2) give every key fact a named site source (with URL where possible, plus access date) or an explicit confidence level (HIGH/MEDIUM/LOW per §0.2); (3) record any fact with no source as UNVERIFIED and never assert it; (4) re-check anything time-sensitive against a current source — a stale fact is wrong. A section completed without these four steps is incomplete. Full protocol: lens §0.

## Agent prompt (copy-paste block)

```
You are the build agent for Meridian General Knowledge: P10 GK Trivia
Quiz + P11 GK Current Affairs + P12 GK Detective
(feat/general-knowledge-spec). Repo: veeresh-bikkaneti/Meridian. SPEC
ONLY in this file — do NOT generate videos here; the build agent
implements from this spec on branch feat/general-knowledge-spec (three
options, one per mode — confirm branch name(s) before starting). Never
commit, push, open PRs, or merge on your own; the coordinator does all
git work and merging stays the owner's decision, per PR, per head.

EXPERTISE REQUIRED: Software Architect, UI/UX Designer, Game Developer,
Researcher, plus the GENERAL-KNOWLEDGE seat (owner to name — no seat is
named by the owner; report it as open, do not invent one) and the
EDUCATOR seat (BLOCKED — no named educator exists; see gate below).

TOPIC: General knowledge for 5th grade and up, all three owner-picked
options. P10: one trivia mode on P3's quiz loop, school-GK only,
exact-answer judging in v1. P11: one current-affairs mode with a
fresh-content pipeline (sourcing, dating, review, publication,
retirement, staleness period as a number) — DEFINITION-ONLY until the
owner rules in writing on the revision-rule tension: (a) explicit
recorded override, or (b) reframe as revision anchored to school-taught
civics/history. You may NEVER record that waiver yourself. P12: one
detective mode on the GeoDetective machine; the game design document is
a GATE, signed before any code, and must prove the deduction verb is
real. VIDEO COUNTS: TO CONFIRM for all three options — set by the
signed definitions, never invented here. "School GK" is the boundary and
it is fuzzy; if a definition cannot name it with sources, report that
rather than build a bank on a guessed boundary.

DELIVERABLES: P10 — GK boundary answer (sourced); topic map following
from the boundary; mode mockup; judging test plan; overlap-resolution
table (P5/P7/P8). P11 — pipeline design; trusted-source list; ruling
question for the owner with option (b) costed; format mockup with dates
visible on every item and a retired state; operator statement. P12 —
signed game design document; case-topic map with citations; one worked
case proving the deduction verb; judging test plan; overlap-resolution
table (P5/P7/P8). Video clips: 10 seconds each.

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
judging rule + verification gate (+ game design for P12; per-item
sign-off for P11), screen recording of the built app — no recording =
the testing did not happen. 7-stage release pipeline in full (code
review, architectural review, design review, feasibility, manual QA by
real play-testing, visual testers, age-group playtest). No
self-certification.

VERIFICATION PROTOCOL: verify EVERY key fact with live web search;
source URL + confidence (HIGH/MEDIUM/LOW) on every claim; no source =
UNVERIFIED, never asserted as fact; no stale facts. A stale fact
presented as current is wrong; a wrong or outdated "fact" taught to
children is the silent failure P11 cannot absorb.

NO POLITICS anywhere. World view, not US-heavy. If the educator is
still unstaffed when you are assigned, your first job is to report that
the packet is blocked — not to build around it.
```

## Open questions for the owner

1. **Q16 (P11 ruling — OPEN, blocks P11 build):** (a) explicit override of the revision rule, carried as a named risk, or (b) reframe as revision anchored to school-taught civics/history? In writing, before any P11 build.
2. **Q16 (school GK — OPEN):** what counts as school GK per band, and does it vary by country/curriculum? Needed by P10/P11/P12 definitions.
3. **Q16 (staleness period — OPEN):** how fast do P11 items retire? (A number with a rationale.)
4. **Q1 (educator + curriculum):** who is the named GK/current-affairs educator/SME, and which curriculum does the topic map follow?
5. **GK seat:** owner to name the general-knowledge seat-holder.
6. **Video counts:** TO CONFIRM — what counts do the signed definitions set for P10, P11, and P12?
7. **P11 operator:** who operates the fresh-content pipeline after launch? (If no operator is named, that is a finding — without one the mode rots in weeks; a mode with an expiry that visibly retires it is the fallback.)
8. **Q5 (load budget):** accept the proposed 250 KB / 500 KB starting numbers once baselined, and what tap → first-playable-paint time on what device is "fast enough"?
9. **Alert policy (study §10 Q7):** which funnel types, if any, may page a human? Unassigned — needs your decision before funnel types are defined.

## Definition of done

Done when: (a) P10 — one complete trivia mode plays end to end on the quiz loop; every question machine-verified and cited; judging test walks all cases; review deck replays by topic; overlaps resolved to one source per fact; (b) P11 — the owner's written ruling (option (a) or (b)) is on file; the pipeline design exists with the staleness period stated; one mode plays end to end; every item cited (trusted source), dated, and educator-signed; stale items retire automatically, demonstrated by a test that walks an expired item being withheld; (c) P12 — the game design document is written and signed, the deduction verb proven real; one detective mode plays end to end per the GeoDetective contract with a fail state; every case fact cited and every case solution path machine-verified; overlaps resolved; (d) for all three: load budget met on P2-measured numbers and lazy-load behaviour verified; educator sign-off on file; the readiness audit's four points demonstrated; every question ends with the host story clip; the 7-stage release pipeline ran in full; panel review passed with a screen recording.

## UNVERIFIED log (this spec)

- Repo/live-site identity: per project record (MEMORY.md), confidence HIGH as a project-internal fact; live web search 2026-11-10 did not independently verify the repo URL — no web citation claimed.
- Video counts: TO CONFIRM for P10, P11, and P12 — no number is stated anywhere in this spec.
- **P11 revision-rule tension is OPEN and undecided** — no ruling (a) or (b) is recorded in this spec; no waiver is recorded.
- **School-GK boundary is UNVERIFIED** — no curriculum citation names it yet; the boundary is the definitions' first job.
- **Staleness period is UNVERIFIED** — no number is set in this spec.
- Every sub-topic above is structure only; every question, item, and case fact is UNVERIFIED until §0 verification is done at build time.
- Load-budget numbers (250 KB / 500 KB gzip): PROPOSAL, not measured (lens §12 flag 11).
- No other factual claims are made in this spec.
