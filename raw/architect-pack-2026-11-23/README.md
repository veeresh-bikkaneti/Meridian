# Meridian — Architect Review Pack (2026-11-23)

## What this is

A self-contained review package for **every planned Meridian feature that is
still pending** — 28 items from the owner's register of 2026-11-20, plus the
challenge-URL item the owner added the same day. Each feature has its own
folder with a detailed prompt brief (intent, scope, locked decisions,
acceptance criteria, open questions) and the real assets behind it: mockup
screens, build captures, design notes, branch-status records, goal documents,
and one sample film.

Meridian is a free geography-learning game for kids (GeoDetective, Cold Trail,
map quizzes, story packs), live at meridian.knowledgetest.workers.dev.

## How to review

1. Start with `AUDIT-TABLE.md` (or `audit-table.csv`) — one row per feature:
   status today, what evidence is in the folder, and the decision needed.
2. Open the feature's folder and read its `PROMPT.md`.
3. Give **one verdict per feature**:
   - **ACCEPT** — the plan is sound as specified; it may proceed when the
     owner authorizes a build.
   - **REJECT** — the plan should not proceed as specified; say why.
   - **FEEDBACK** — constructive changes: scope cuts, sequencing, risks,
     simpler routes, missing evidence.
4. Where a brief lists *Open questions for the architect*, an answer to each
   is the most valuable output.

## Standing constraints (these bind every feature)

- **The 2026-11-20 merge freeze is history.** It held when pack v1 was
  written; since then the owner has merged again — PRs #547 and #551
  (2026-11-21) and the whole architecture programme below. This pack still
  authorizes nothing by itself: a verdict of ACCEPT is a design verdict,
  not a build or merge order — builds start only on the owner's word,
  per feature.
- **Content is sourced, never manufactured.** Facts, places, and flags come
  from authoritative sources with citations; anything unsourceable stays out
  rather than being invented.
- **Free to all. No sign-in, no accounts.** Secular-only landmarks/content.
- **Mockup before code** for any layout/UI work, at all viewports.
- **One component per job** — reuse means the same component code everywhere
  with props changed, never a per-page copy.
- **Owner-config playthrough gate**: detective/pair work is not "ready"
  until a full case is played in the owner's own configuration.
- Docs in this pack are plain-language on purpose (the owner has ADHD;
  bottom-line-first is a house rule, not a style choice).

## Architecture programme — the context for every verdict

Since 2026-11-20, main's main line of work is an architecture cleanup
programme, and it changes the ground under several features in this pack.
Target architecture (from `ARCHITECTURE.md` on main): six layers —
(1) content (data only), (2) domain & stores (pure logic, no React, no
browser globals), (3) **platform ports** (`src/platform/**`: storage,
transport, audio — the only layer allowed to touch the browser),
(4) shared UI components including the shell parts, (5) feature screens,
(6) shell & routes. One rule: **imports point down only**; shared code
moves down a layer, never sideways. The rule is machine-enforced by
`lint:arch` against a per-violation baseline that only shrinks, measured
by two gauges: `noRawIo` (raw browser I/O outside the ports) and
`noUpwardImport` (upward imports). Content ships as literal, build-validated
`SubjectItem` records.

Phase state at main `5930e930` (2026-11-23):

- **Phase 0 — foundations: MERGED.** Layer map + guardrails (#544),
  `lint:arch` with baseline (#548), `ci:required` gate runner (#549),
  Storybook (#552), response headers pinned to one module (#554),
  subjects registry (Phase 0 shell split).
- **Phase 1 — platform ports: Part A MERGED, Part B in flight.** Storage
  port (#563), transport port (#565), ClueScene audio onto the shared
  voice gate (#559), then the Part A sweep (#569): every raw I/O call
  outside `game-app.tsx` moved behind the ports, `noRawIo` 164 → 45.
  Draft **#571** (Part B) takes `game-app.tsx` onto the storage port,
  45 → 13; the last 13 sit in five excluded files.
- **Phase 3 — content as validated records: COMPLETE.** All six school
  subjects are literal `SubjectItem` records with build-time validators
  and frozen-fixture equality: math (#555), physics (#562), chemistry
  (#566), general knowledge + journals (#568), social studies (#572).
- **Layering sweep (upward imports): Part A MERGED.** #573 moved shared
  modules down a layer, `noUpwardImport` 154 → 129. Fifteen entries plus
  one map-crash-marker entry stay baselined and need a layer ruling.
- **Phase 4 — the `game-app.tsx` split: MAPPED, NOT STARTED.** #570
  merged the map + chosen hybrid plan: extract state owners
  fewest-shared-first, then views, thin router to `src/routes` last;
  a shrink-only size budget lands after Part B. It is explicitly
  sequenced after Phase 1 Part B.
- **Phase 5 — server hardening: largely MERGED.** Runtime secrets —
  the contact webhook secret is read at runtime only (#550, 5.1);
  one migration runner for build + PGLite (#558, 5.2); response policy
  pinned to one headers module (5.3, status record on main).
- **Also open:** draft **#574**, a flag-gated live build Kanban at
  `/kanban` tracking the programme's handover items against the three
  baselines (target zero).

Sequencing logic, for the architect's verdicts: foundations first so
every slice is measured; ports before the `game-app` split (Part B owns
files Phase 4 needs); content records subject-by-subject with fixture
equality so nothing player-visible changes; server last. Folder
`29-architecture-cleanup-programme` carries the programme as a
reviewable item of its own, including the open question of whether
Phase 4 is sequenced right against the feature backlog in this pack.

## Layout

- `AUDIT-TABLE.md` / `audit-table.csv` — the audit summary.
- `NN-slug/PROMPT.md` + copied assets — one folder per feature.
- `PACK-STATUS.md` — how this pack was built, including which features have
  thin evidence (named plainly there and in the audit table).
