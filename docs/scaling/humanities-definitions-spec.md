# Meridian Scaling — Humanities + GK Definitions Spec

**Branch:** `feat/humanities-definitions`
**Base:** `origin/main` @ `f37dea50` (verified 2026-11-10)
**Status: PREPARED — AWAITING EDUCATOR SIGN-OFF.** No educator exists; nothing
in this spec is approved. No subject build is authorized by this file.

**What this is:** definition briefs only — no code, no game, no build. Workstream 4
of the Meridian scaling-plan push (2026-11-10). It transcribes the council
verdict of 2026-11-07 (CONDITIONAL GO for definition work and Phase 0 only;
subject feature branches are NOT GO) into definition briefs for five packets
plus the three cross-cutting definitions, and it records the correction of 12
stale-doc spots in the workspace docs.

**Sources transcribed (not re-decided):**

- `~/workspace/meridian-scaling-work-packets.md` — packets P5, P8, P10, P11, P12
  (2026-11-07).
- `~/workspace/meridian-scaling-lens-breakdown.md` — §4 P5, §7 P8, §8 P10,
  §9 P11, §10 P12, §12 staleness flags, §13 open owner questions (2026-11-10).
- `~/workspace/meridian-scaling-spec-breakdown.md` — §2 platform decisions,
  §5 staleness flags (2026-11-10).
- `~/workspace/meridian-scaling-debate.md` — council debate + verdict
  (2026-11-07).

Where a source doc states a fact that current main supersedes, this spec
records the corrected fact and the superseded source — it never silently
rewrites the source's history. Workspace-file corrections are listed in §8
and applied in place in `~/workspace/meridian-scaling-*.md` (and the two
source docs they point at, `meridian-platform-project-description.md` and
`meridian-end-to-end-study.md`).

---

## §0. Scope — what is in, what is out

### In scope (approved only)

1. **P5 brief** — social studies definition: road rules + history +
   constitution picker (two branches under one definition).
2. **P8 brief** — journal global expansion definition (re-based on B8).
3. **P10 brief** — GK Trivia Quiz definition.
4. **P11 brief** — GK Current Affairs definition (ruling recorded open).
5. **P12 brief** — GK Detective definition.
6. **Cross-cutting definitions** — the 7-stage release pipeline, the host
   wrap-up rule, the lazy-load guardrail.
7. **Stale-doc corrections** — the 12 flags of spec-breakdown §5, fixed in
   place in the workspace docs and recorded here (§8).

### Out of scope (never in this workstream)

- Any game or feature code of any kind. Any subject branch build.
- Any educator sign-off (no educator exists; the seat is UNSTAFFED).
- Any decision the owner has not made (see §7 open questions — recorded,
  never settled).
- Any change to `~/workspace/meridian-main`'s working tree (another branch
  with pre-existing state — left alone).
- Merges, PRs, force-pushes. Merging stays the owner's word, per PR per head.

---

## §0.1 Hard stops

1. No merges, no PRs, no force-push.
2. No game/feature code of any kind.
3. No educator sign-off — never write "approved" for any brief. Every brief
   is marked **PREPARED — AWAITING EDUCATOR SIGN-OFF**.
4. Stage named files only — never `git add -A`.
5. No decision recorded on the owner's behalf. Open questions stay open.
6. No fact asserted without a live web source (URL + date accessed) or an
   explicit confidence level (HIGH / MEDIUM / LOW with the evidence that
   earns it). A claim without one is not done.

---

## §0.2 What counts as done

This workstream is done when, on branch `feat/humanities-definitions`:

1. §1–§5 hold the five packet briefs (P5, P8, P10, P11, P12), each with
   status, gate, scope in/out, acceptance criteria, educator sign-off
   block, open owner questions, and verification.
2. §6 holds the three cross-cutting definitions transcribed verbatim in
   substance from the packets/shared gates.
3. §7 holds the open owner questions (recorded, not decided).
4. §8 holds the correction record for all 12 stale-doc flags, with the
   workspace-file edit for each (or an explicit statement that a flag is a
   gap with no stale text to correct, and why).
5. Every research/factual claim in §1–§6 carries a live web source
   (URL + date accessed 2026-11-10) or an explicit confidence level.
6. Branch pushed to `origin/feat/humanities-definitions`; head SHA
   re-verified with `git ls-remote` before reporting.

Partial landing is acceptable if reported honestly: briefs land in the
order P5, P8, P10, P11, P12, then cross-cutting, then stale-doc fixes.
A partial landing reported honestly beats a false "done".

---

## §0.3 Verification block (for this spec)

- [ ] Branch `feat/humanities-definitions` exists on the remote; HEAD
  re-verified via `git ls-remote origin feat/humanities-definitions`.
- [ ] `docs/scaling/humanities-definitions-spec.md` is the only file added
  in the first commit; later commits add sections to the same file only
  (plus the workspace-file corrections, which live outside the repo).
- [ ] Every brief marked PREPARED — AWAITING EDUCATOR SIGN-OFF; the word
  "approved" appears nowhere as a claim about any brief.
- [ ] Every factual claim in §1–§6 has a source URL + access date or a
  confidence level. Claims from the workspace docs cite the doc + section.
- [ ] No code files touched. `git status` in the worktree shows only
  `docs/scaling/humanities-definitions-spec.md` (modified/added).

---

## §1. P5 — Social studies: road rules + history + constitution picker

**Status: PREPARED — AWAITING EDUCATOR SIGN-OFF. GATED — do not build.**
Branches (from the debate): `feat/social-road-rules` (road rules + history)
and `feat/constitution-picker` (constitution) — two PRs, either order, once
the definition is signed. **Gate to clear first:** P2 landed AND its own
definition signed. Leaf packet.

> **Constitution-first conditional (recorded, not a commitment):** the
> Researcher's conditional — a single jurisdiction, fully sourced/dated/
> verified, may clear the readiness audit before P3 and go first. That is a
> possibility, not a commitment, and it depends on a definition that does
> not exist yet. Build order changes only if it clears the audit first.

### 1.1 What the definition must contain (the signed definition)

The definition is the gate-maker for P5. It must contain, in writing:

1. **Social-studies topic map per band** — road rules, history, social
   economy — for 5th grade and up. Any 5–7 content is out of scope until
   Q2 is answered in writing (owner, 2026-11-07 correction: audience is
   5th grade and up; the description's 5–7 games and the study's "math
   ages 8–10 first" are superseded — see §8 flags 1–2).
2. **Road-rules verb** — navigate / decide / avoid: a spatial decision
   under uncertainty, close to pin-dropping, with a decision, a
   consequence, and a fail state stated in writing. A loop missing any of
   the three is not a game.
3. **Constitution verb-or-shelf decision** — the playable verb (match
   flag → article; "which right protects this?" scenario cards; a
   timeline; or a "defend the clause" detective case — "You are the
   judge": scenario → governing clause → consequence), proven in a
   mockup (a decision, a fail state, a loop). If no verb can be built
   honestly, the deliverable is the game-vs-shelf question for the owner,
   not a shipped reader. The constitution picker as described is NOT a
   game yet (council, all seats).
4. **Per-jurisdiction sourcing plan** — every constitution fact cited and
   dated; the schema must require a citation + date per fact. A fact
   record with no citation field cannot be stored.
5. **Judging rule** — road-rules decisions judged by the rules of the
   road; constitution answers judged against cited text. A test must walk
   the judging path (right, wrong, near-miss).
6. **History fact-sharing mechanism** — one fact, one source, shared
   between the journal (story surface) and this packet (game surface).
   The mechanism must be named (shared file, shared lint, or shared
   review); a sharing rule with no mechanism is a wish. Every history
   fact cites the same source as the journal's telling of it.

### 1.2 Scope

**In:** road-rules game (navigate/decide/avoid, mockup first at 390px and
1280px); history game surface, journal-linked (shared facts, no
duplication); constitution picker (country/state selection, flag paired
with that jurisdiction's constitution, per-jurisdiction cited + dated
sourcing); social economy topics per the signed topic map; host story clip
after every question (§6.2); funnel events + E2E specs; lazy loading per
the guardrail (§6.3).

**Out:** any constitution fact without a cited, dated source; any
flag-as-hunt-target mechanic (forbidden by the existing flag rule — the
flag appears only beside an already-visible land/jurisdiction name);
any tiny-model use (P9, parked); any behaviour change to geography or math.

### 1.3 Acceptance criteria

(a) Definition signed before either branch; (b) fact-sharing mechanism
named; (c) constitution schema enforces citation + date; (d) load budget
met on measured numbers from P2 (the 250 KB / 500 KB gzip figures are
proposals, not measurements — §8 flag 11); (e) road-rules surface mocked
at 390px and 1280px; (f) constitution verb proven in the mockup, or the
shelf decision returned to the owner; (g) flag rule honoured in every
mock; (h) per-band presentation mocked (5th-grade end and 16–18 end);
(i) audit's four points demonstrated, not promised (§6.1).

### 1.4 Grounding notes — what source would verify the topic map

These are candidate sources the definition's author must check and the
educator must confirm. They are NOT the chosen curriculum (Q1 is open) and
NOT evidence for the topic map — they name where the boundary research
starts. All accessed 2026-11-10.

- **Civics per band (candidate, MEDIUM):** the College, Career, and Civic
  Life (C3) Framework for Social Studies State Standards (National
  Council for the Social Studies, 2013) sets grade 3–5 civics indicators
  — by the end of grade 5 students examine the origins and purposes of
  rules, laws, and key U.S. constitutional provisions (indicator
  D2.Civ.3.3-5). Source:
  https://ugc.padletcdn.com/uploads/padlet-uploads/2145377777/b68e27efe567818d6af3923b7f0fb0c0/Grade_3_5_Planning_Tool.pdf
  (C3 Framework Instructional Planning Guide, grades 3–5). State
  frameworks (e.g. Maryland Grade 5 Social Studies Framework;
  New York State K-12 Social Studies Framework) implement the same
  standards per state — the definition must name which state's framework
  it follows, because the map varies by state. Confidence MEDIUM: the
  C3 Framework is the national guidance states build on, but no state
  has been chosen.
- **Constitution text (HIGH):** the official transcription of the U.S.
  Constitution is published by the National Archives:
  https://www.archives.gov/founding-docs/constitution-transcript
  (accessed 2026-11-10). This is the HIGH-confidence verbatim source for
  the U.S. jurisdiction. Every other jurisdiction needs its own named
  official text; a jurisdiction with no named source is UNVERIFIED and
  out of scope.
- **Road rules / pedestrian safety (HIGH):** NHTSA publishes a Child
  Pedestrian Safety Curriculum — a 5-lesson curriculum for grades K–5
  covering walking near traffic, crossing streets, intersections, parking
  lots, and school bus safety — and bicycle safety education for children
  covering traffic signs and signals and riding with traffic:
  https://www.nhtsa.gov/pedestrian-safety/child-pedestrian-safety-curriculum
  (accessed 2026-11-10). HIGH as the source for the road-rules topic
  map's U.S. pedestrian content; driving-direction and sign content for
  older bands still needs its own named source (the definition must name
  it).
- **Verbatim vs paraphrase (research, not a decision):** the definition
  must cost both options — verbatim needs a plain-language layer;
  paraphrase needs per-fact citation and risks wrong civics. The decision
  is the owner's (Q9) with the educator. A wrong paraphrase teaches wrong
  civics silently — the cited-and-dated rule is the mitigation, and it
  must be demonstrated per jurisdiction, not asserted.

### 1.5 Educator sign-off — BLOCKED (UNSTAFFED)

No educator persona exists. Nothing in this lens is approved. The named
human educator / SME must sign IN WRITING, before P5 can build:

1. The social-studies topic map per band (road rules, history, social
   economy).
2. The constitution sourcing plan + the verbatim-vs-paraphrase decision.
3. The judging rule for this subject.
4. The machine-verification gate, demonstrated on one complete mode.
5. Per-jurisdiction constitution content — a civics/social-studies signer
   is required; a math educator's signature does not cover this packet.

**Blocked items:** all five.

### 1.6 Open owner questions blocking P5

Q9 (constitution verbatim vs paraphrase; game or shelf), Q1 (educator +
curriculum), Q6 (home order — which jurisdiction goes first is a
definition decision). See §7.

### 1.7 Deliverable / definition of done

Deliverables: road-rules surface mockup; constitution verb mockup (or
shelf question); sourcing plan with named sources per jurisdiction;
history fact-sharing mechanism; judging test plan. Done when the
acceptance criteria above are met, the audit's four points are
demonstrated, the game-or-shelf decision carries the owner's word, and
the educator signature is on file.

## §2. P8 — Journal global expansion

**Status: PREPARED — AWAITING EDUCATOR SIGN-OFF. GATED — do not start batch
production.** Branch (proposed, confirm before use):
`feat/journal-global-expansion`. **Gate to clear first:** the owner's
listen-verdict on the pilot AND a written per-story production process.
Leaf packet (the journal is a showcase, not a game loop); shares the home
surface — coordinate placement with P1's mockup.

### 2.1 Staleness applied — read this first

The packets' P8 facts are superseded in three places (§8 flags 6–7):

(a) **Rotation:** the study (§5) and packets (P8) say 36 sets rotating
every 2 hours. **Current fact: 1 entry per 30 minutes** (B8, owner
2026-11-09, PR #389 merged 2026-11-10;
`JOURNAL_WINDOW_MS = 1_800_000`, `src/components/home-journal.ts`,
verified read-only against current main 2026-11-10). 106 entries over 53
hours. Movies stream on demand only, never precached. Use B8.
(b) **Pilot pattern:** the packets cite the v3 pilot (`NOTE-v3.md`) as the
approved pattern. **Current fact: the keeper is v4**
(`old-faithful-story-v4.mp4`, `NOTE-v4.md`, Magnus voice approved by the
owner's ear 2026-11-08). The v3 citation is superseded.
(c) The v3 pilot's narration was never verified by ear (NOTE-v3 states
this plainly) — do not claim it was.

> **UNRESOLVED CONTRADICTION (do not resolve silently):** the packets'
> gate names "the owner's listen-verdict on v3". The current keeper is v4,
> and the owner's ear approved v4's Magnus narration on 2026-11-08. It is
> not recorded whether that approval satisfies the gate as written, or
> whether a fresh listen-verdict is required. Recorded here as an open
> question for the owner (§7, question P8-1). Do not assume the gate is
> met, and do not rewrite the gate.

### 2.2 What the definition must contain

1. **Per-story production process, written first:** narration script
   drawn only from the entry's facts + what is visible (no invented
   facts); per-story voice selection (excitement + deeper bass, different
   per story; deep story voice — movie-narrator feel, not a newsreader,
   per the owner's direction 2026-11-07); the "Hey kids, have you heard
   about this place?" opening; background bed at 30%; video-discipline
   (never re-render approved video to add audio). A story produced before
   the process exists is out of order.
2. **Global story list with citations and visible verbs** — the owner's
   direction (2026-11-07): India (Himalayas, Vaishno Devi, the seven
   sisters/holy rivers, Ramayana, Mahabharata, Bhagavad Gita), Jerusalem
   (Christian history), Islam (Quran), Sikhs (Guru Granth Sahib), Greek
   (Zeus and myths). Each story's facts cite a primary or authoritative
   source (HIGH) — religious/historical content with no citation is
   UNVERIFIED and out of scope. Each story needs a real visible verb
   (eruptions, waterfalls, battles); a story with no visible verb is
   deferred to a later tier, not forced. Most existing entries are static
   places and forcing a movie onto each would be slow pans.
3. **Per-story verification checklist** — duration, full decode, video
   MD5 vs approved cut, frame checks, audio levels, bed-at-30%
   measurement, human listen check. Each check is a measurement with a
   recorded number; a check with no number is UNVERIFIED.
4. **Pilot limits fixed in the process** — hot peak (max −0.7 dB: add a
   limiter at −1 dB on any re-mix); unspoken "less predictable vents"
   clause (10 s fits ~8 s of speech); not a seamless loop; crowd drift in
   the final frame. Each limit has a fix in the process; a limit carried
   into 106 movies is a process failure.
5. **Sensitivity review** for religious/historical content (Ramayana,
   Mahabharata, Bhagavad Gita, Quran, Guru Granth Sahib, Bible, Greek
   myths, Jerusalem): tone and respect, not just fact-checking. A story
   with facts right and tone wrong is a failure.
6. **Batch size** — curated tiers of 10–15 entries first, each with a
   real visible verb. 106 movies is ~3× the "36" first imagined. Batch
   size is the owner's choice — record it as a question, do not decide.
7. **Home placement** — coordinated with P1's mockup, not decided in
   this packet alone.

### 2.3 Scope

**In:** per-story production process (written first); global stories in
curated batches on top of the existing 106 (additive only — existing
stories untouched); each new story: place + storyline movie + narration +
cited source; religious/historical content cited, dated,
sensitivity-reviewed; movies stream on demand only, never precached; the
journal showcase stays light (the lazy-load guardrail applies to media
too, §6.3).

**Out:** any change to the approved pilot; any batch production before
the process + listen-verdict gates clear; any invented story facts; any
invented game loop for the journal (it is a showcase, not a game loop);
any tiny-model use (P9, parked); any behaviour change to the game.

### 2.4 Acceptance criteria

(a) Production process written; (b) rotation facts per B8 (1 entry per 30
minutes, 106 entries over 53 hours); (c) batch size is the owner's choice
on file; (d) media streams on demand only; (e) listen-along mockup — the
story must read without reading (a mockup that needs its text read aloud
to be understood fails); (f) voice direction cited (owner's 2026-11-07);
(g) sensitivity review in the brief; (h) placement coordinated with P1;
(i) no invented loop; (j) per-story checks are measurements; (k) pilot
limits fixed in the process; (l) opening line cited ("Hey kids, have you
heard about this place?" — owner's direction).

### 2.5 Educator sign-off — BLOCKED (UNSTAFFED)

No educator persona exists. Nothing in this lens is approved. The named
human educator / SME must sign IN WRITING, before batch production:

1. The per-story production process.
2. Religious/historical content — sensitivity + correctness (a wrong or
   careless telling of a sacred story is the failure this packet cannot
   absorb).

**Blocked items:** both. Note the two gates are different people: the
**listen-verdict is the owner's**, not an educator's — do not confuse the
two gates. The listen-verdict (does the voice land? does the story read
without reading?) is the owner's ear; the sensitivity + correctness
sign-off is the educator/SME. The v3-vs-v4 gate question (§2.1) is open
and must be answered by the owner.

### 2.6 Open owner questions blocking P8

Batch size (owner must choose 10–15 first, or another size); the
listen-verdict question (v3 gate vs v4 keeper — §2.1). See §7.

### 2.7 Deliverable / definition of done

Deliverables: written production process; global story list with
citations and visible verbs; per-story verification checklist;
batch-size question for the owner; v3-vs-v4 gate question for the owner.
Done when the acceptance criteria above are met, the process is written,
the listen-verdict question is answered by the owner, and the educator
sign-off is on file.

## §3. P10 — GK Trivia Quiz

*(Brief to follow: commit 3.)*

## §4. P11 — GK Current Affairs

*(Brief to follow: commit 3.)*

## §5. P12 — GK Detective

*(Brief to follow: commit 3.)*

## §6. Cross-cutting definitions

*(To follow: commit 4.)*

## §7. Open owner questions (recorded, never decided)

*(To follow: commit 4.)*

## §8. Stale-doc correction record (12 flags)

*(To follow: commit 5, after the workspace-file edits.)*

---

*Spec written 2026-11-10. No code changed, no repo writes outside this file,
no PRs, no merges.*
