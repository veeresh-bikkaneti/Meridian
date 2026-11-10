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

- [x] Branch `feat/humanities-definitions` exists on the remote; HEAD
  re-verified via `git ls-remote origin feat/humanities-definitions`
  (see final commit SHA below).
- [x] `docs/scaling/humanities-definitions-spec.md` is the only file added
  in the first commit; later commits add sections to the same file only
  (plus `BRANCH_STATUS.md`, per the repo's branch convention, and the
  workspace-file corrections, which live outside the repo).
- [x] Every brief marked PREPARED — AWAITING EDUCATOR SIGN-OFF; the word
  "approved" appears nowhere as a claim about any brief (checked by grep
  on the final file: "approved" occurs only in "approved pilot pattern /
  approved video" for the journal v4 keeper and "approved by the owner's
  ear", never as an educator approval of a brief).
- [x] Every factual claim in §1–§6 has a source URL + access date or a
  confidence level. Claims from the workspace docs cite the doc + section.
  Live sources accessed 2026-11-10: C3 Framework grades 3–5 planning
  tool, National Archives Constitution transcription, NHTSA Child
  Pedestrian Safety Curriculum, Common Sense Media kids'-news list.
- [x] No code files touched. `git status` in the worktree shows only
  `docs/scaling/humanities-definitions-spec.md` and `BRANCH_STATUS.md`.

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
   direction (2026-11-07), as amended 2026-11-10: religion removed from
   the plan entirely. The 2026-11-07 list's religious items (Vaishno
   Devi, Ramayana, Mahabharata, Bhagavad Gita, Jerusalem, Islam/Quran,
   Guru Granth Sahib) are struck; the non-religious remainder (Himalayas
   as geography) stands. Each story's facts cite a primary or
   authoritative source (HIGH) — historical content with no citation is
   UNVERIFIED and out of scope. Each story needs a real visible verb
   (eruptions, waterfalls, battles); a story with no visible verb is
   deferred to a later tier, not forced. Most existing entries are static
   places and forcing a movie onto each would be slow pans.
   - **EXTENDED 2026-11-10 (owner, voice call) — the journal set must
     include these categories:** historical places, mythological places,
     famous spots, World War monuments, great leaders, and freedom
     fighters. This EXTENDS
     the 2026-11-07 list above — keep everything built, add on top. Both
     lists stand in this brief. **Scope note:** the current 106 entries
     (81 US + 25 global landmarks) are the BUILT set — these categories
     are the expansion, not a rebuild. P8 stays GATED: no building, and
     educator sign-off is needed before any of it is final. These
     categories are scope definition only, not approval to build.
     What is actually missing from the 106 is decided by the coverage
     audit in §2.8 — not by this list alone.
3. **Per-story verification checklist** — duration, full decode, video
   MD5 vs approved cut, frame checks, audio levels, bed-at-30%
   measurement, human listen check. Each check is a measurement with a
   recorded number; a check with no number is UNVERIFIED.
4. **Pilot limits fixed in the process** — hot peak (max −0.7 dB: add a
   limiter at −1 dB on any re-mix); unspoken "less predictable vents"
   clause (10 s fits ~8 s of speech); not a seamless loop; crowd drift in
   the final frame. Each limit has a fix in the process; a limit carried
   into 106 movies is a process failure.
5. **Tone review** for historical content (world wars, leaders,
   freedom fighters): tone and respect, not just fact-checking. A story
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
cited source; historical content cited, dated, tone-reviewed; movies stream on demand only, never precached; the
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
(g) tone review in the brief; (h) placement coordinated with P1;
(i) no invented loop; (j) per-story checks are measurements; (k) pilot
limits fixed in the process; (l) opening line cited ("Hey kids, have you
heard about this place?" — owner's direction).

### 2.5 Educator sign-off — BLOCKED (UNSTAFFED)

No educator persona exists. Nothing in this lens is approved. The named
human educator / SME must sign IN WRITING, before batch production:

1. The per-story production process.

**Blocked item:** the production process. Note the two gates are different people: the
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

### 2.8 Coverage verdict — what the 106 already has (audit 2026-11-10)

Audited against the actual 106 on main `f37dea50`: sources
`public/videos/journal-manifest.json` (106 movies) and
`src/components/home-journal.data.ts` (id, place, story — verbatim).
Full audit: `~/workspace/journal-106-coverage.md`. The verdict below is
transcribed from that audit, not re-derived here.

**COVERED — do not re-add:**

- **Historical places:** Alamo, Homestead, Oregon Trail sites (Chimney
  Rock, Scotts Bluff), Fort Robinson, Golden Spike, Colosseum, Giza,
  Machu Picchu, Chichén Itzá, Stonehenge, Angkor, Petra, Timbuktu, and
  more — already the bulk of the 106.
- **Famous spots:** Eiffel, Taj Mahal, Statue of Liberty, Grand Canyon,
  Niagara, Old Faithful, Golden Gate, Space Needle, White House,
  Rushmore, Sydney Opera House, Great Pyramid, Denali, Victoria Falls,
  Iguazú, Fuji, CN Tower, Neuschwanstein — already covered.

**PARTIAL:**

- **Religious importance:** sites YES (Sagrada Família, Fushimi Inari,
  Potala, Angkor, Timbuktu, Christ the Redeemer, Alamo as former
  mission). Pilgrimage destinations NO — no Mecca, Varanasi, Jerusalem,
  Vatican, Bodh Gaya, Amritsar, Santiago. Audit fact only — no
  expansion: religion was removed from the plan by the owner 2026-11-10;
  the pilgrimage and religions-epics spec branches were deleted.
- **Mythology:** essentially missing — only Uluru (sacred to the Anangu)
  and Robber's Cave (local legend) touch it. No Greek, Norse, Hindu or
  other mythology entry.

**MISSING entirely:**

- **World War monuments:** none. Only borderline is Memorial Stadium,
  named for Nebraskans lost in war, but the entry is about football —
  not a monument. (SAC Museum is Cold War bombers/missiles, not WWII.)
- **Great leaders:** no entry is about a leader. Closest is Rushmore's
  four faces (entry is about the carving, not the men); Arbor Lodge
  names J. Sterling Morton (Arbor Day founder).
- **Freedom fighters:** nothing. Closest is one line on Crazy Horse's
  death at Fort Robinson.

> **RULE FOR P8 (binding on the expansion): only add what is NOT in
> the 106.** The four gaps are: (1) World War monuments, (2) great
> leaders, (3) freedom fighters, (4) mythology. Do NOT duplicate historical places or famous spots —
> only add one of those if it fills a named gap (e.g. a WWII monument
> that is also a famous spot counts as a monument, not as a famous
> spot). The first batch (owner's choice, §2.6) is shaped by these four
> gaps, not by re-covering what the 106 already has.

P8 stays GATED (no building; educator sign-off before final). Everything
else in this brief stands.

## §3. P10 — GK Trivia Quiz (option A)

**Status: PREPARED — AWAITING EDUCATOR SIGN-OFF. GATED — do not build.**
Branch (proposed, confirm before use): `feat/gk-trivia-quiz`. **Gate to
clear first:** P2 landed AND its own definition signed (GK topic map per
band + judging rule + machine-verification gate) AND the readiness audit
passed. Leaf packet. Rides P3's quiz loop — build after the loop is
proven, or in parallel with P3 once P2's interfaces exist.

### 3.1 What the definition must contain

1. **GK boundary answer, sourced** — "school GK" is the boundary and it
   is fuzzy: what counts as general knowledge a school teaches varies by
   country and curriculum. The definition must name the GK topic map per
   band with sources; the boundary cannot be invented. If the definition
   cannot name it with sources, it reports that rather than building a
   bank on a guessed boundary. (Open: Q16 — what counts as school GK per
   band, varies by country/curriculum?)
2. **Topic map following from the boundary** — every topic cites the
   boundary research; a topic outside the map is out of scope.
3. **Judging rule** — exact-answer judging in v1; a test walks right
   answer, wrong answer, near-miss.
4. **Question-bank shape** — bank + difficulty tiers, every question
   machine-verified (answer checked against its source, not trusted from
   the generator) and cited with a trusted source + confidence level. The
   verification gate must be demonstrated on one complete mode; an
   asserted gate is UNVERIFIED.
5. **Review deck wiring** — misses replay by topic; topic tags are part
   of the question record (a question with no topic tag cannot be
   replayed by topic).
6. **Loop reuse traced to P2/P3** — same run/session/scoring/review-deck
   machinery as P3's quiz loop, new question bank and judging, against
   P2's `Question`/`Result` interfaces. If P3 has not landed, this packet
   waits for the loop contract — it does not re-implement a loop.
7. **Overlap rule** — the same fact must not be written three ways with
   three different answers across P5 (history), P7 (science), and P8
   (journal). Overlapping facts cite one source; a fact with conflicting
   sources across packets is a contradiction to resolve before build.

### 3.2 Scope

**In:** one trivia mode on the quiz loop: school-GK questions per the
signed topic map, exact-answer judging in v1; question bank + difficulty
tiers, every question machine-verified and cited; review deck wired to
question topics; host story clip after every question (§6.2); funnel
events + E2E specs; lazy loading per the guardrail (§6.3) — the GK chunk
loads only when a kid picks GK; inside GK, prefetch of the next 1–2 items
is allowed.

**Out:** current affairs (P11); detective format (P12); any GK beyond
the signed school topic map; any new teaching (revision only — this is
the rule the packet exists under); any tiny-model use (P9, parked); any
behaviour change to geography or math.

### 3.3 Acceptance criteria

(a) Loop reuse traced to P2/P3; (b) verification gate demonstrated;
(c) topic tags in the record; (d) load budget met on measured numbers
from P2; (e) mode mocked at 390px and 1280px, per-band presentation
mocked at both widths for both ends; (f) host clip spec bounded (§6.2);
(g) mode plays end to end on the quiz loop; (h) judging test walks all
cases; (i) review deck replays by topic; (j) overlaps resolved to one
source per fact; (k) GK boundary named with sources; (l) audit four
points demonstrated (§6.1).

### 3.4 Educator sign-off — BLOCKED (UNSTAFFED)

No educator persona exists. Nothing in this lens is approved. The named
human educator / SME (a general-knowledge educator) must sign IN WRITING,
before P10 can build:

1. The GK topic map per band.
2. The judging rule for this mode.
3. The machine-verification gate, demonstrated on one complete mode.

**Blocked items:** all three. A math educator's signature does not cover
this packet.

### 3.5 Open owner questions blocking P10

Q16 (what counts as school GK per band, varies by country/curriculum?),
Q1 (educator + curriculum). See §7.

### 3.6 Deliverable / definition of done

Deliverables: GK boundary answer (sourced); topic map following from the
boundary; mode mockup; judging test plan; overlap-resolution table
(P5/P7/P8). Done when the acceptance criteria above are met, the audit's
four points are demonstrated, and the educator signature is on file.

## §4. P11 — GK Current Affairs (option B)

**Status: PREPARED — AWAITING EDUCATOR SIGN-OFF. GATED — and carries an
extra gate no other packet has.** Branch (proposed, confirm before use):
`feat/gk-current-affairs`. **Gate to clear first:** P2 landed AND its own
definition signed AND the owner's WRITTEN ruling on the revision-rule
tension (option (a) or (b) below). Until the owner rules, this packet is
definition-only. Leaf packet.

### 4.1 The tension (do not soften, do not drop)

**This packet FAILS the standing "revision, not new teaching" rule.**
Current affairs, by definition, teaches what just happened — new content,
not revision of what school already taught. The owner picked it anyway
("All 3", 2026-11-07). Two honest resolutions; the owner must pick one in
writing before any build:

- **(a) Explicit recorded override** — the owner waives the revision rule
  for this packet only, carried as a named risk.
- **(b) Reframe as revision** — every item anchored to a civics/history
  topic the child already met in school; items with no school anchor are
  out of scope.

**An agent may never record the waiver itself. This spec records the two
options and the fact that neither is chosen. The ruling is OPEN (Q16) —
see §7.**

Also open: what counts as school GK per band, and the staleness period
(how fast items retire). A stale fact presented as current is wrong —
this is the standing warning that defines this packet (a president from
10–15 years ago presented as current is not contextual anymore). Every
item must be dated; no undated "current" claims anywhere. Audience is
5th grade and up.

### 4.2 What the definition must contain

1. **Fresh-content pipeline design, written FIRST** — sourcing, dating,
   review, publication, retirement — with the staleness period stated as
   a number with a rationale (e.g. "retire after N days unless
   re-verified"); a period stated as "when it feels stale" is not a rule.
   The pipeline is a deliverable, not an afterthought; a mode built
   before the pipeline exists is out of order.
2. **Sourcing rules** — trusted sources only (named list), every item
   cited; aggregators and social sources excluded. The named list is
   written with each source's publisher and why it is trusted; a source
   with no stated reason is LOW.
3. **Recency rules** — every item dated at publication; stale items
   retire automatically — demonstrated by a test that walks an expired
   item being withheld, not asserted.
4. **Operator statement** — who operates the pipeline after launch?
   Recorded even if the answer is "no operator named" — that is a
   finding, and without an operator the mode rots in weeks. A mode with
   an expiry that visibly retires it is the fallback, not a silent
   rotting feed.
5. **Mode format** — one current-affairs mode (quiz loop or short news
   card; mockup first at 390px and 1280px). Every item shows its date;
   stale items are visibly retired, never silently served. Per-band
   presentation mocked at both widths for both ends.
6. **Judging rule** per the definition — a test walks right answer,
   wrong answer, near-miss.
7. **Per-item sign-off flow** — every item educator-signed before it
   ships (see §4.5). The flow is a gate in the pipeline, not a checkbox
   after publication.
8. **Option (b) costed** — what "the news behind what you learned in
   school" would require in practice (school anchors per item). The
   deliverable is the costed shape of option (b); the choice between (a)
   and (b) is the owner's, in writing.

### 4.3 Scope

**In:** fresh-content pipeline design (written first); sourcing rules
(trusted sources only, named list); recency rules (every item dated;
staleness/expiry rule; no undated "current" claims); one current-affairs
mode (format per the definition; mockup first); every item
educator-signed before it ships; expiry/retirement behaviour
(demonstrated by test); host story clip after every question (§6.2);
funnel events + E2E specs; lazy loading per the guardrail (§6.3).

**Out:** anything presented as current without a date; evergreen trivia
(P10); detective format (P12); any item without a trusted source or
without educator sign-off; any tiny-model use (P9, parked); any behaviour
change to other games.

### 4.4 Acceptance criteria

(a) Pipeline design written with staleness period stated; (b) retirement
test walks the path; (c) operator named or the expiry fallback stated;
(d) load budget met on measured numbers from P2; (e) format mocked at
both widths; (f) dates visible on every item; (g) retired state mocked;
(h) per-band presentation mocked; (i) mode plays end to end under the
ruling; (j) judging test walks all cases; (k) per-item sign-off is a
pipeline gate; (l) host clip after every question; (m) owner's written
ruling on file; (n) audit four points demonstrated — noting the audit
cannot pass until the ruling is on file.

### 4.5 Grounding notes — background only, never evidence for the ruling

Accessed 2026-11-10. These name the kind of sources a definition author
would study when writing the trusted-source list. They do NOT choose the
list (that is the definition's job, with the educator) and they do NOT
resolve the tension.

- Kids'-news products exist as background comparables: TIME for Kids
  (https://www.timeforkids.com/ — news written for students K–6, editions
  by grade), Newsela (https://newsela.com/ — leveled articles, ages 8+),
  DOGOnews (https://www.dogonews.com/ — kids' current-events articles,
  K–12). Source: Common Sense Media, "Best News Sources for Kids",
  updated 2026-04-13,
  https://aiprot.commonsensemedia.org/lists/best-news-sources-for-kids
  (accessed 2026-11-10). Confidence MEDIUM as background: these are
  products, not the packet's trusted-source list; inclusion here does not
  endorse any of them.

### 4.6 Educator sign-off — BLOCKED (UNSTAFFED)

No educator persona exists. Nothing in this lens is approved. The named
human educator / SME (a current-affairs educator) must sign IN WRITING,
before P11 can build — and **per item, not just per topic map**:

1. The topic map + pipeline design (signed once).
2. **Every published item** (signed, or signed-off in a reviewed batch)
   before it ships. A math educator's signature does not cover this
   packet.

**Blocked items:** both. The per-item sign-off is the mitigation for the
revision-rule tension — it is not optional. Freshness is a permanent
operational cost, not a one-time build: without per-item sign-off, a
wrong or outdated "fact" taught to children is the silent failure this
packet cannot absorb.

### 4.7 Open owner questions blocking P11

Q16 (ruling (a) or (b), in writing, before any build; staleness period),
Q1 (educator + curriculum). **This packet cannot build without Q16
answered in writing.** See §7.

### 4.8 Deliverable / definition of done

Deliverables: pipeline design (sourcing, dating, review, publication,
retirement, staleness period); trusted-source list; ruling question for
the owner with option (b) costed; format mockup with dates visible;
operator statement. Done when the acceptance criteria above are met, the
audit's four points are demonstrated, the owner's written ruling is on
file, and the per-item sign-off flow is a pipeline gate.

## §5. P12 — General Knowledge Detective (option C)

**Status: PREPARED — AWAITING EDUCATOR SIGN-OFF. GATED — do not build.**
Branch (proposed, confirm before use): `feat/gk-detective`. **Gate to
clear first:** P2 landed AND its own definition signed (GK case-topic map
per band + game design + judging rule + machine-verification gate) AND the
game design itself signed before any code. The game design is a gate, not
a phase. Leaf packet.

### 5.1 What the definition must contain

1. **Game design document FIRST** — case structure, clue reveal, guess
   mechanic, win/loss, fail state, deduction verb — signed before any
   code is written. The design must prove the deduction verb is real: a
   worked case where the clues, and only the clues, lead to the answer.
   A detective game without a real deduction verb is trivia with a
   detective skin — the design must prove the verb is real, or the packet
   returns to the owner rather than shipping trivia as a detective game.
2. **Case-topic map per band** — GK cases from school GK, history,
   geography, science — cross-subject cases. Each case topic cites a
   curriculum document per band; a topic with no citation is UNVERIFIED.
3. **Case-bank shape** — cases built from cited GK facts, every case
   solution path machine-verified (the solution path checked, not trusted
   from the author). Every case fact cited with a trusted source and a
   confidence level (§0.1 per fact); a case with an uncited fact is
   UNVERIFIED as a case. The verification gate must be demonstrated on
   one complete case; an asserted gate is UNVERIFIED.
4. **Deck/guess machine reuse, traced to files** — GeoDetective
   (`src/game/loop/`): shuffled deck, exactly-once-per-cycle, cap,
   win/loss, clue reveal (study §8). A reuse claim with no file trace is
   UNVERIFIED.
5. **Clue economy** — how many clues, what each reveals. Stated in the
   design AND playtested with the age group, not asserted — a case too
   hard teaches nothing (the child guesses blind); a case too easy is
   trivia.
6. **Judging rule** per the definition — a test walks right guess, wrong
   guess, near-miss; a test walks the loop (win, loss, guess cap, clue
   order).
7. **Cross-subject fact coordination** — case facts span subjects;
   coordinate with P5 (history), P7 (science), P8 (journal) so the same
   fact is not written three ways. Overlapping facts cite one source; a
   contradiction is resolved before build.
8. **`Question` kind for cases and the `Result` evidence field** — mapped
   against P2's interfaces.

### 5.2 Scope

**In:** game design document (signed before build); one detective mode
on the GeoDetective machine: cases built from cited GK facts, clues
reveal step by step, guesses judged by the definition's rule; case bank
per the signed topic map, every case verified (solution path checked);
host story clip after every question/case (§6.2); funnel events + E2E
specs; lazy loading per the guardrail (§6.3).

**Out:** quiz-loop GK (P10); current affairs (P11); any case without
cited facts; any detective skin over a trivia loop (the deduction verb
must be real — if the design cannot prove it, the packet returns to the
owner); any tiny-model use (P9, parked); any behaviour change to other
games.

### 5.3 Acceptance criteria

(a) Design document signed, verb proven real (one worked case);
(b) loop plays end to end per the GeoDetective contract; (c) judging
test walks all cases; (d) overlaps resolved to one source per fact;
(e) deck reuse traced to files; (f) case verification demonstrated;
(g) interfaces mapped; (h) load budget met on measured numbers from P2;
(i) case flow mocked at both widths (390px and 1280px); (j) clue economy
stated and playtested; (k) per-band presentation mocked; (l) audit four
points demonstrated — noting the design gate (signed game design) sits
on top of the audit.

### 5.4 Educator sign-off — BLOCKED (UNSTAFFED)

No educator persona exists. Nothing in this lens is approved. The named
human educator / SME (a general-knowledge educator) must sign IN WRITING,
before P12 can build:

1. The case-topic map per band.
2. The game design (case structure, clue reveal, guess mechanic,
   win/loss, fail state, deduction verb).
3. The judging rule for this mode.
4. The machine-verification gate, demonstrated on one complete mode.

**Blocked items:** all four. The case bank's facts span subjects, so the
signer must cover the case content, or two signers must sign.

### 5.5 Open owner questions blocking P12

Q16 (what counts as school GK per band), Q1 (educator + curriculum).
See §7.

### 5.6 Deliverable / definition of done

Deliverables: signed game design document; case-topic map with citations;
one worked case proving the deduction verb; judging test plan;
overlap-resolution table (P5/P7/P8). Done when the acceptance criteria
above are met, the audit's four points are demonstrated, the design is
signed, and the educator signature(s) are on file.

## §6. Cross-cutting definitions

Transcribed from the packets' "Shared gates" (`meridian-scaling-
work-packets.md`, §"Shared gates") and the spec breakdown §2
(`meridian-scaling-spec-breakdown.md`). These apply to every packet in
§1–§5 and to every subject packet. Nothing here is new: it is the
definition record of decisions already made (owner 2026-11-07, council
2026-11-07).

### 6.1 The 7-stage release pipeline (decided, owner 2026-11-07)

**Rule: no feature ships unless all seven ran. A review-only pass is not
testing.**

| # | Stage | What it means |
|---|---|---|
| 1 | Code review | — |
| 2 | Architectural review | — |
| 3 | Design review | — |
| 4 | Feasibility analysis | Will it work in a browser |
| 5 | Manual QA | Real play-testing, not just code review |
| 6 | Visual testers | Effects in sync and consistent |
| 7 | Age-group playtest | A person of the target age plays it; feedback goes to the game player and the game researcher |

Source: packets ("Shared gates"); the debate does not list it — it is the
owner's rule, recorded in the packets. The description's open question 8
(full treatment vs a lighter set for new games) is resolved in favour of
the packets: full verification law + 7-stage pipeline on every packet
(§8 flag 4).

The pipeline sits on top of the readiness audit (all four points,
demonstrated not promised): (1) named curriculum + written topic map per
band; (2) judging rule that is machine-verifiable; (3) content
correctness checkable without an LLM near the data; (4) core verb a child
gets just by looking. And on top of the full verification law: full gates
(`tsc`, `npm test`, `test:worker`, `lint-cards` GATE PASSED, `build:pages`,
Playwright E2E sequential under the shared VM lock), screen recording of
the built app (no recording = testing did not happen), panel review of the
final tip, no self-certification, merge only on the owner's explicit
per-PR word. Mockup first; progressive check-ins to the branch.

### 6.2 The host wrap-up rule (decided, owner 2026-11-07)

**After every question — win or lose, correct or wrong — the host retells
the story behind the answer, followed by a very short animated cartoonish
clip. Short by rule; not a lecture, not lengthy. Applies to EVERY topic
and EVERY feature, because the audience is children.**

Source: packets ("Shared gates" + every packet); debate (Game Designer
seat). The model is the Who Wants to Be a Millionaire / Kaun Banega
Crorepati host, whose job is to tell the story no matter the answer.
Bounded by rule: the clip is very small and short; clip length is bounded
by the rule in each packet's acceptance criteria. For the journal (P8),
the story IS the clip — the "Hey kids, have you heard about this place?"
opening and the story retold.

### 6.3 The lazy-load guardrail (decided — rewritten guardrail)

**Nothing loads until a kid picks it. Inside a chosen subject, prefetch
the next 1–2 items only. A load failure must never reset a streak or eat
a guess (retry + state preserved + offline fallback).**

- Load budget (**PROPOSED, not measured**): initial JS ≤ 250 KB gzip;
  per-game chunk ≤ 500 KB gzip. Baselines on P2's first build, then gated
  in CI. Breach = branch blocked, never a silent raise. No packet may cite
  these numbers as measured (§8 flag 11).
- Enforced by: import-boundary test (shell has zero static game imports),
  tap → first-playable-paint measured on a real low-end phone,
  no-interaction network trace on every subject PR, three designed states
  per subject (loading / slow / failed-offline).
- The guardrail applies to media too (P8): journal movies stream on
  demand only, never precached.
- Source: debate ("The lazy-loading guardrail, rewritten"); packets
  ("Cross-cutting gates").

**Status note (Q14):** the debate lists Q14 as an open owner question
("do you accept the rewritten guardrail?"). The owner's direction since
treats the rewritten guardrail as a hard rule. Recorded here as
**decided by direction**, not by a written Q14 answer — if the owner
wants it re-asked, say so (§8 flag 8; §7 Q14). No written owner answer
exists.

### 6.4 Standing content rules (owner's rules, apply to every packet)

- Verify key facts independently — add site sources, or indicate
  confidence levels. Ground responses in current information with web
  searches. A stale fact (e.g. a president from 10–15 years ago presented
  as current) is wrong.
- No fabrication, ever — no LLM near place/content data. For math: no
  wrong answers — every generated problem machine-verified.
- Revision, not new teaching: games practise what school already taught.
  (P11's tension with this rule is recorded in §4.1, not softened.)
- A child must get it just by looking. Free, no paywalls, COPPA-safe (no
  accounts, no PII, no identifiers).
- **Educator gap — the binding constraint:** no educator persona exists
  (verified 2026-11-07: 157 TOMLs, none for education). The educator seat
  is UNSTAFFED; the researcher seat is a disclosed stand-in (UX
  Researcher — imperfect match, cannot speak to curricular alignment or
  subject-matter correctness). A named educator / subject-matter expert
  must sign, IN WRITING, the curriculum + topic map + judging rule +
  machine-verification gate for one complete mode — demonstrated on that
  mode, not promised for later. Until that signature exists, every subject
  packet stays GATED. Proceeding without one is only possible as an
  explicit, recorded owner decision carried as a risk — an agent may never
  record that decision itself. Three paths (owner's call): (a) name a
  human subject expert; (b) authorize finding and auditing an educator
  persona candidate (nothing installs without the owner's go-ahead);
  (c) proceed as a recorded risk.

### 6.5 One app for now (decided)

One app, one deploy, one flags file, one telemetry pipeline, one COPPA
posture. Written tripwire to revisit: different privacy posture,
different deploy cadence, or the shell cannot meet the load budget after
honest splitting. Tripwire acceptance itself is owner question Q13 (§7).

### 6.6 Thin progression contract in Phase 0 (decided)

Thin contract in Phase 0 (one passport / streak / badge namespace);
full design after two real games. The study (§9.6, Phase 4) put
cross-game progression late; the debate (tension resolution) and packets
(P2) put the thin contract in Phase 0 — **debate governs** (newer,
owner-facing, council-decided; §8 flag 3). Passport ownership
confirmation is still open (Q15, §7).

## §7. Open owner questions (recorded, never decided)

14 open questions (spec-breakdown §4 rows 30–42, 45). Q14 and Q15 are
recorded as decided-by-direction / council resolution, with written
confirmation still open — they are listed here so they are not lost.
**The binding ones:** Q1 (educator) blocks every subject GO; Q16 (P11
ruling) is the other hard block. Answering one unblocks the packet that
needs it.

| Q | Question | Blocks | Decider |
|---|---|---|---|
| Q1 | Educator seat + which curriculum (varies by country?) | Every subject (P1 signature → P3–P7, P10–P12); P8 process sign-off | Owner |
| Q2 | Audience written confirmation; do 5–7 games drop out? | P1 draft, P3 scope, all subjects' bands | Owner |
| Q3 | Judging policy: exact-only vs partial credit; is `2x + 6` = `2(x + 3)`? | P1, P3, P4 | Owner + educator (seat unstaffed) |
| Q4 | Phase 0 GO-evidence acceptance | P2 | Owner |
| Q5 | Load budget acceptance + tap-to-paint time/device | P2, all subjects | Owner |
| Q6 | Home order — what sits above the fold at 390px | P1 mockup, P8 placement | Owner |
| Q7 | 16–18 register — same brand or different? | P1 presentation specs | Owner |
| Q8 | Age-band split — two bands or one 14–18; years vs ages? | P1 | Owner |
| Q9 | Constitution verbatim vs paraphrase; game or shelf? | P5 | Owner + educator |
| Q10 | Olympiad placement — mode, difficulty, or separate subject? | P1, P3 | Educator (owner picks with educator input) |
| Q11 | Science spike authorization | P2 spike, P7 | Owner |
| Q12 | Model trigger acceptance + eligibility bar + parity | P9 (parked) | Owner |
| Q13 | One-app tripwire acceptance | P2 | Owner |
| Q16 | P11 ruling (a) override or (b) reframe; school-GK per band; staleness period | P11 (blocks build), P10/P12 definitions | Owner, in writing |
| Q14† | Lazy-load acceptance — decided by direction, no written answer | All subjects | Owner (confirm if re-ask wanted) |
| Q15† | Passport ownership — council resolution (thin contract in P2), owner confirmation open | P2 | Owner |

† Q14/Q15 are counted as decided in the breakdown (rows 43–44) but
neither has a written owner answer. They are carried here as
"decided-by-direction / resolution, confirmation open" — not as settled.

### Questions this workstream adds (recorded open, owner to answer)

- **P8-1 (v3 gate vs v4 keeper):** the packets' P8 gate names "the owner's
  listen-verdict on v3". The keeper is v4, and the owner's ear approved
  v4's Magnus narration on 2026-11-08. Does that approval satisfy the gate
  as written, or is a fresh listen-verdict required? **Open — owner.**
  Do not assume the gate is met.
- **P8-2 (batch size):** does the owner choose 10–15 entries for the
  first global tier, or another size? **Open — owner.**
- **P5-1 (constitution-first ordering):** the Researcher's conditional —
  if a single-jurisdiction constitution clears the audit before math,
  build order changes. **Conditional, not a plan** — it is a possibility
  to record, not a commitment to act on.

### Gaps with no owning packet (carried, not fixed by this workstream)

- **Alert policy for new games (unassigned):** the study (§10 Q7) asks
  who decides which new funnel types may page a human (the
  `narration_failed` precedent from the #311 fix). No packet owns this.
  Needs an owner decision before any subject's funnel types are defined.
- **Family / social features (deliberately no packet):** the study
  (§10 Q9) raises shared family accounts vs local-only family play;
  the packets omit it on purpose — a COPPA decision must come first.
  No packet may be written until the owner decides.

## §8. Stale-doc correction record (12 flags)

All 12 flags are from `meridian-scaling-spec-breakdown.md` §5 (and
`meridian-scaling-lens-breakdown.md` §12). Each flag below states the
corrected fact, where the stale text lived, what edit was made in place
in the workspace files on 2026-11-10 (workstream 4), and what was
deliberately NOT changed. Nothing was silently resolved; the original
wording is preserved with a dated correction marker next to it — history
is annotated, not rewritten.

| # | Flag | Corrected fact (wins) | Workspace edit (2026-11-10) |
|---|---|---|---|
| 1 | Audience 5–7 | **5th grade and up only** (owner, 2026-11-07) | `meridian-platform-project-description.md`: correction banner added after the intro; the two Maths 5–7 rows in the §4 chart marked `[SUPERSEDED 2026-11-10]`. NOT changed: the §3 age-band table (5–7 / 8–10 / 11–13) — it describes what Meridian ALREADY does in code today, a verified code fact. The Maths 8–10 rows were not flagged stale by any source and were left alone. Also fixed in the scaling docs themselves: "8–10 and 16–18 ends" → "5th-grade and 16–18 ends" in `meridian-scaling-work-packets.md` (P1), `meridian-scaling-debate.md`, and `meridian-scaling-lens-breakdown.md` (P1 UI/UX lens). |
| 2 | Math first band | **5th grade and up** (owner correction) | `meridian-end-to-end-study.md`: correction banner added at top; §9.6 Phase 1 row marked `[SUPERSEDED 2026-11-10]` in place. |
| 3 | Progression timing | **Thin contract in Phase 0; full design after two games** (debate governs) | `meridian-end-to-end-study.md`: §9.6 Phase 4 row marked `[SUPERSEDED 2026-11-10]` in place; covered in the top banner. |
| 4 | Quality process for new games | **Full verification law + 7-stage pipeline on every packet** (packets win) | `meridian-platform-project-description.md`: open question 8 marked `[RESOLVED 2026-11-10]` in place. |
| 5 | Passport | **Thin contract in Phase 0** (debate + packets P2; owner confirmation still open, Q15) | `meridian-platform-project-description.md`: the §1 passport line and the progression line both marked `[CORRECTED 2026-11-10]` in place. |
| 6 | Journal rotation | **1 entry per 30 minutes** (B8, PR #389 merged 2026-11-10; `JOURNAL_WINDOW_MS = 1_800_000`) | `meridian-end-to-end-study.md` §5 journal bullet marked `[SUPERSEDED 2026-11-10]`; `meridian-scaling-work-packets.md` P8 current-state line corrected in place (106 entries, 1 per 30 minutes, 53 hours) and the "36 set-movies" scope arithmetic struck. |
| 7 | Journal pilot pattern | **v4 keeper** (`old-faithful-story-v4.mp4`, Magnus, owner's ear 2026-11-08) | `meridian-scaling-work-packets.md` P8: sources line now cites NOTE-v4; status, objective, pattern, limits, dependencies, acceptance criteria, scope-out, educator note, and gap #7 all corrected/annotated in place. The v3 pattern details are kept as a labelled historical record, not as the pattern to build on. The v3-vs-v4 gate question is recorded OPEN (§7, P8-1) — not resolved by this edit. |
| 8 | Lazy-load acceptance (Q14) | **Decided by owner direction** (rewritten guardrail is a hard rule) | `meridian-scaling-work-packets.md` Q14 and `meridian-scaling-debate.md` Q14 both annotated `[CORRECTED 2026-11-10 — decided by direction, no written answer]`. NOT claimed as a written answer. |
| 9 | Alert policy for new games | **Unassigned — no packet owns it** (study §10 Q7) | NO EDIT — there is no stale text to correct; this is a gap, not a wrong fact. Carried in §7 as an owner decision still needed before any subject's funnel types are defined. |
| 10 | Family / social features | **Deliberately no packet** (COPPA decision must come first) | NO EDIT — no stale text to correct; deliberately omitted by the packets. Carried in §7. No packet may be written until the owner decides. |
| 11 | Load-budget numbers | **Proposals, not measurements** (250 KB / 500 KB gzip) | NO EDIT — verified on 2026-11-10 that every occurrence already labels them "proposed" (debate lines 107, 331–332, 538–539; plan line 135; packets gap #9). No doc cites them as measured. This spec's §6.3 repeats the PROPOSED status. |
| 12 | P11 revision-rule tension | **Rule-vs-decision conflict, not doc-vs-doc** ("All 3" pick vs revision rule) | NO EDIT — no stale text to correct; the tension is already recorded in packets P11 and spec-breakdown §5. Carried in §4.1 and §7 (Q16) as OPEN. |

**Files edited in place (workspace, outside the repo):**

- `~/workspace/meridian-platform-project-description.md` — banner + 2
  superseded chart rows + Q8 resolved + 2 passport corrections.
- `~/workspace/meridian-end-to-end-study.md` — banner + journal bullet +
  Phase 1 row + Phase 4 row.
- `~/workspace/meridian-scaling-work-packets.md` — sources line, P1
  band ends, P8 status/objective/current-state/pattern/limits/scope
  arithmetic/dependencies/acceptance/educator note/gap #7, Q14.
- `~/workspace/meridian-scaling-debate.md` — age-band ends, Q14.
- `~/workspace/meridian-scaling-lens-breakdown.md` — P1 band ends.
- `~/workspace/meridian-scaling-plan.md` — checked: no stale fact stated
  as current (its 5–7 mention is already a correction record). No edit.
- `~/workspace/meridian-scaling-spec-breakdown.md` — the flag register
  itself; no edit (it is the record these corrections implement).

**Verification of the corrections (2026-11-10):** after the edits, a grep
over `meridian-scaling-*.md` for `36 sets`, `2 hours`, `8–10 and 16–18`
returns only correction markers and the breakdown docs' own flag records
(which correctly quote the superseded wording as the thing superseded).
A grep over the description and study for the superseded phrasings
returns only the dated correction banners/markers. No remaining spot
states a superseded fact as current.

---

*Spec written 2026-11-10. No code changed, no repo writes outside this file,
no PRs, no merges.*
