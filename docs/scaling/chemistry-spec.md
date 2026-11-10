# Chemistry Spec — P6 Chemistry (small, honest scope)

## Header

| Field | Value |
|---|---|
| Topic | P6 Chemistry — a small, honest chemistry game scoped to what schools actually teach, built around a real verb (combine-and-watch), not a quiz |
| Status | **GATED** — do not start building until P2 has landed AND its own definition is signed, including the US-school scope question (see Definition of done) |
| Branch | `feat/chemistry-spec` (per this spec brief; the work packets call the P6 branch `feat/chemistry-basics` — confirm the branch name before the build agent starts) |
| Video count | **TO CONFIRM** — do not invent a number. The count is set by the signed definition once the scope question is answered, not by this spec. |
| Repo | veeresh-bikkaneti/Meridian — free browser geography game for kids, live at https://veeresh-bikkaneti.github.io/Meridian/ (project record, MEMORY.md; confidence HIGH as a project-internal fact — the live web search on 2026-11-10 returned other products named "Meridian" and did not independently verify the repo URL, so no web citation is claimed for it) |
| Sources consulted | `meridian-scaling-lens-breakdown.md` §0 (lines 15–151), §5 P6 (lines 971–1108), §12 staleness flags (lines 1899–1926), §13 open questions (lines 1927–1961); `meridian-scaling-work-packets.md` shared gates + dependency chart (lines 7–102), P6 (lines 394–444) |
| Spec date | 2026-11-10 |

## Expert seats

- **Scientist seat — VACANT (holder).** No physicist / chemist / general-scientist TOML exists in the installed persona packs (checked 2026-11-10; only data-scientist TOMLs, which do not fit). The seat's REQUIREMENTS stay: physics and chemistry only; the scientist writes and speaks in **children's language: simple words a 5th-grader follows**. Every script, clue, label, and host line must pass that test; a sentence a 5th-grader cannot follow is rewritten, not shipped. The holder is vacant, with the owner's three paths: (a) he names a human expert, (b) the coordinator finds and audits a candidate persona — nothing installs without his go-ahead, (c) carry as a recorded risk. Nothing in this spec is staffed.
- **Educator seat — BLOCKED.** No named educator exists. The named human educator / SME (a science educator) must sign IN WRITING, before build: (1) the US-school scope answer (what chemistry is taught per band), (2) the chemistry topic map per band, (3) the judging rule for this subject, (4) the machine-verification gate, demonstrated on one complete mode. Until that signature is on file, this packet stays GATED. The scope question **cannot be answered by an agent's web search alone** — search grounds facts; it does not certify a curriculum. A web search that finds a standards document is evidence for the educator to sign — it is not the signature.
- Five lenses also apply as usual: software architect, UI/UX designer, game developer, researcher, educator (blocked).

## Topic scope

- **Age band:** 5th grade and up only. No 5–7 content until the owner answers Q2 in writing.
- **Purpose:** school revision, not new teaching. What the game covers follows from the scope answer — nothing more.
- **The defining question FIRST (this packet's first deliverable):** what chemistry do US schools teach per band? The study and description contain **no chemistry scope at all** — the only source is the owner's remark (2026-11-07) that he does not know how much chemistry US schools teach. Do not invent scope. Research it against official US curriculum/standards documents (HIGH) or published state standards (MEDIUM), with document, version, date. If the answer is "almost none", that is the finding — the honest answer may then be a very small game or a shelf, not a subject launch. The packet must report that rather than invent scope.
- **In scope (per lens §5 + packets P6):** one chemistry mode with a real verb — combine-and-watch / classify / build-and-test — per the signed definition. Core verb: combine-and-watch (predict what happens when things combine, then see it). Element Detective (solve cases using clues from the periodic table) is the candidate format, only if the definition supports it. Every fact cited; every combination outcome machine-verified (the simulation's rules are data, checked, not improvised). Predict-then-see presentation: the mockup shows the prediction step and the visible outcome as two distinct moments.
- **P6/P7 sharing:** depends on the same simulation thinking as P7 — the two packets should share the "predict-then-see" engine shape where honest, but neither may wait for the other; if a shared engine is needed, it is defined in P2's spike, not invented here.
- **Out of scope:** any chemistry beyond the signed scope (no "general chemistry" drift); any quiz-format chemistry (dismissed by the council — do not mock one); any tiny-model use (P9, parked); any behaviour change to other games. World view, not US-heavy: the scope question is about US schools because that is the owner's question, but examples and settings must not default to the US only, and the topic map must say which curriculum it follows.

## Topic structure — no count invented

Structure only; the video count is **TO CONFIRM** once the scope question is answered and the definition is signed. The build agent turns this structure into videos once the count is set. Do not invent curriculum facts — each sub-topic below must cite the scope research before content is written; a topic with no scope citation is out of scope.

1. **Scope answer (deliverable zero)** — what chemistry US schools teach per band, written with sources, signed by the science educator. Everything below hangs off this answer.
2. **Combine-and-watch (core verb)** — predict what happens when things combine, then see it. The verb is stated with a fail state; a verb with no fail state is not a game.
3. **Classify** — sorting and grouping materials by their properties, per the signed scope.
4. **Build-and-test** — building something from parts and testing whether it works, per the signed scope.
5. **Element Detective (candidate format)** — solve cases using clues from the periodic table — only if the definition supports it.
6. **Predict-then-see judging** — prediction judged against the verified outcome rules; a test walks right prediction, wrong prediction, near-miss.
7. **Outcome rules as checked data** — every combination outcome is a checked data row with a source; a rule with no source is UNVERIFIED and must not ship.
8. **Small-scope consequence** — if the scope is small, the mockup reflects the scoped size; a big game mocked on a small scope is a scope lie. The mode may honestly be very small, or a shelf.

**Play surface:** one mode with a real verb, mocked first at 390px and 1280px. A quiz-format surface is dismissed by the council — do not mock one.

## Hard rules (owner's — in every file)

1. **Verify EVERY key fact with live web search:** source URL + confidence (HIGH/MEDIUM/LOW per lens §0.2) on every claim. No source = mark UNVERIFIED, never state it as fact. No stale facts.
2. **NO POLITICS anywhere.**
3. **Status GATED (educator sign-off in writing).** Educator seat BLOCKED — no named educator exists. Signer must approve in writing: curriculum + topic map + judging rule + verification gate (plus the US-school scope answer for this packet).
4. **Counts:** TO CONFIRM for this spec. Never present a proposed count as decided, never invent one.
5. **7-stage release pipeline applies** — no feature ships unless all seven ran: (1) code review, (2) architectural review, (3) design review, (4) feasibility analysis (works in a browser), (5) manual QA by real play-testing, (6) visual testers (effects in sync/consistent), (7) age-group playtest with feedback to the game player and game researcher. A review-only pass is not testing.
6. **Lazy-load law:** nothing loads until a kid picks it. No subject loads before selection; inside a chosen subject, prefetch of the next 1–2 items is allowed. Load budget numbers (initial JS ≤ 250 KB gzip; per-game chunk ≤ 500 KB gzip) are PROPOSALS, not measurements — baseline on P2's first build; breach = branch blocked.
7. **Host wrap-up (owner's rule, every question, every feature):** win or lose, correct or wrong, every question ends with the host retelling the story behind the answer as a very small, short animated cartoonish video clip — not lengthy.
8. **Mockup first:** the verb mockup is shown to the owner before building. A child must get it just by looking. Free, no paywalls, COPPA-safe (no accounts, no PII, no identifiers).
9. **Readiness audit (all four, demonstrated not promised):** (i) named curriculum + topic map, (ii) machine-verifiable judging rule, (iii) correctness checkable without an LLM near the data, (iv) core verb a child gets just by looking. Point (i) cannot pass until the scope question is answered.

## Verification protocol (lens §0 — forcing rule)

Before any question in this spec is answered, the build agent MUST: (1) run a live web search to ground the answer in current information — answering from its own knowledge is forbidden; (2) give every key fact a named site source (with URL where possible, plus access date) or an explicit confidence level (HIGH/MEDIUM/LOW per §0.2); (3) record any fact with no source as UNVERIFIED and never assert it; (4) re-check anything time-sensitive against a current source — a stale fact is wrong. A section completed without these four steps is incomplete. Full protocol: lens §0.

## Agent prompt (copy-paste block)

```
You are the build agent for Meridian P6 Chemistry (feat/chemistry-spec).
Repo: veeresh-bikkaneti/Meridian. SPEC ONLY in this file — do NOT generate
videos here; the build agent implements from this spec on branch
feat/chemistry-spec. Never commit, push, open PRs, or merge on your own;
the coordinator does all git work and merging stays the owner's decision,
per PR, per head.

EXPERTISE REQUIRED: Software Architect, UI/UX Designer, Game Developer,
Researcher, plus the SCIENTIST seat (VACANT holder — requirements stand:
physics and chemistry only) and the EDUCATOR seat (BLOCKED — no named
educator exists; see gate below). The SCIENTIST must write and speak in
CHILDREN'S LANGUAGE: simple words a 5th-grader follows, in every script,
clue, label, and host line.

TOPIC: A small, honest chemistry game for 5th grade and up — scoped to
what US schools actually teach at this level. VIDEO COUNT: TO CONFIRM —
set by the signed definition once the scope question is answered, never
invented here. Your FIRST deliverable is the scope question, answered in
writing with sources: what chemistry do US schools teach per band? If
the answer is "almost none", report that — the honest answer may be a
very small game or a shelf, not a subject launch. A web search that finds
a standards document is evidence for the educator to sign; it is NOT the
signature. Do not invent scope. No quiz-format chemistry — the real verb
is combine-and-watch (predict what happens when things combine, then see
it); classify / build-and-test are the alternates per the definition.

DELIVERABLES: scope answer (written, sourced); topic map following from
the scope; verb mockup (owner-shown before building, at 390px and
1280px); outcome-rules data with a source per rule; judging test plan.
Video clips: 10 seconds each.

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
judging rule + verification gate (+ the US-school scope answer for this
packet), screen recording of the built app (the mode played end to end
with a real verb and a visible outcome — no recording = the testing did
not happen). 7-stage release pipeline in full (code review, architectural
review, design review, feasibility, manual QA by real play-testing,
visual testers, age-group playtest). No self-certification.

VERIFICATION PROTOCOL: verify EVERY key fact with live web search;
source URL + confidence (HIGH/MEDIUM/LOW) on every claim; no source =
UNVERIFIED, never asserted as fact; no stale facts. Chemistry facts that
are wrong are silent failures — a wrong reaction taught fluently is the
failure this packet cannot absorb.

NO POLITICS anywhere. World view, not US-heavy. If the educator is
still unstaffed when you are assigned, your first job is to report that
the packet is blocked — not to build around it.
```

## Open questions for the owner

1. **Q1 (educator + curriculum):** who is the named science educator/SME, and which curriculum/standards does the scope answer use? Blocks every subject GO.
2. **Scope question:** what chemistry do US schools teach per band? — the packet's first deliverable, not an owner question, but it needs the educator to sign it. (No source exists in any input doc.)
3. **Video count:** TO CONFIRM — what count does the signed definition set once the scope is known?
4. **Small-or-shelf:** if US schools teach almost no chemistry at this level, do you want a very small game or a shelf?
5. **P6/P7 sharing:** one shared predict-then-see engine shape (defined in the P2 spike) or two separate surfaces?
6. **Q5 (load budget):** accept the proposed 250 KB / 500 KB starting numbers once baselined, and what tap → first-playable-paint time on what device is "fast enough"?
7. **Alert policy (study §10 Q7):** which funnel types, if any, may page a human? Unassigned — needs your decision before funnel types are defined.

## Definition of done

Done when: (a) the US-school scope question is answered in writing, with sources, and the game's scope follows from it; (b) one chemistry mode plays end to end with a real verb and a visible outcome (predict → see); (c) every fact is cited and every outcome is machine-verified; (d) load budget met on P2-measured numbers and lazy-load behaviour verified; (e) the readiness audit's four points are demonstrated; (f) the science educator's signature is on file; (g) every question ends with the host story clip; (h) the 7-stage release pipeline ran in full; (i) panel review passed with a screen recording.

## UNVERIFIED log (this spec)

- Repo/live-site identity: per project record (MEMORY.md), confidence HIGH as a project-internal fact; live web search 2026-11-10 did not independently verify the repo URL — no web citation claimed.
- Video count: TO CONFIRM — no number is stated anywhere in this spec.
- **The chemistry scope itself is UNVERIFIED** — no source in any input doc scopes chemistry per grade; the scope question is this packet's first deliverable. Every sub-topic above is structure only, pending that answer.
- Load-budget numbers (250 KB / 500 KB gzip): PROPOSAL, not measured (lens §12 flag 11).
- No other factual claims are made in this spec.
