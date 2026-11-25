# 29 — Architecture cleanup programme (the work now moving on main)

## Intent

One line: pay down Meridian's architectural tech debt — layered imports,
browser I/O behind ports, content as validated records, the 8,894-line
`game-app.tsx` split — without changing anything a player sees.

## Why (origin)

The owner's word, 2026-11-23: "most of the work on main is moving to clean
up architectural tech debt. review and update." The programme itself began
with the guardrails docs (PR #544) and the owner's standing laws behind it:
one component per job, reuse = the same component code everywhere with
props changed, modularity as the way forward, and no step of the pipeline
skipped to save time. Raw browser I/O was measured in 70 files across
`src/`; screens imported each other's code; subject content lived behind
per-subject JSON adapters. Each of those made every feature in this pack
harder to build safely.

## Scope IN

- The six-layer map (`ARCHITECTURE.md` on main): content → domain/stores →
  platform ports → shared UI → feature screens → shell/routes. Imports
  point down only; shared code moves down, never sideways.
- Machine enforcement: `lint:arch` (`eslint/layer-rule.mjs`) with a
  per-violation baseline that only shrinks. Gauges: `noRawIo` (raw
  `fetch`/storage/`new Audio(` outside `src/platform`) and
  `noUpwardImport`.
- Phase 1: platform ports (storage, transport, audio/voice) and the sweep
  of every raw-I/O call site behind them.
- Phase 3: every subject's content as literal, build-validated
  `SubjectItem` records (validator in prebuild; frozen-fixture equality
  proves no player-visible change).
- Upward-imports sweep: shared modules moved down a layer (types/data to
  domain, presentational pieces to shared UI), old paths kept as
  re-export shims where a lane may not edit the importer.
- Phase 4: the `game-app.tsx` split per the merged map (#570) — state
  owners out first (fewest shared-state rows first), then views, the
  thin router to `src/routes` last.
- Phase 5: server hardening — runtime-only secrets, one migration
  runner, one response-headers module pinned against `public/_headers`.
- A flag-gated live Kanban (`/kanban`, draft #574) tracking the
  programme's handover items against the three baselines, target zero.

## Scope OUT

- No player-visible change in any slice (each slice's done-condition
  includes fixture/behaviour equality or "what a player sees is
  identical").
- No feature work: nothing in folders 01–28 is built by this programme;
  it changes the substrate those features will build on.
- Server code was out of the layer map until Phase 5 by design.
- The 13 `noRawIo` entries in five excluded files (`board.tsx`,
  `storyteller-home.tsx`, `LoopScreen.tsx`, `error-component.tsx`,
  `SubjectCase.tsx`) and the 15 + 1 baselined upward-import entries are
  named exceptions, not silent skips — they wait on owners or a layer
  ruling.

## Locked decisions

- The layer map is the one source of truth; `eslint/layer-rule.mjs` is
  its machine-readable copy, `ARCHITECTURE.md` the plain-words copy.
- Baselines only shrink: a slice deletes exactly the baseline lines it
  cures and adds none.
- Content migrations freeze the old exports to a fixture BEFORE editing
  and generate records by script (never retyped); projections must
  deep-equal the fixture.
- Phase 4 does NOT move `game-app.tsx` to `src/routes` first (that would
  hide its 21 upward-import rows instead of curing them); the thin
  router moves last, once it holds no screen state.
- Slices are sequenced by ownership: Phase 4's storage/history ports
  stay deferred until Phase 1 Part B (the lane that owns those files)
  has landed.

## Acceptance criteria

- `lint:arch` + the layer-baseline test pass on main with both gauges
  trending to zero and no slice ever adding a baseline line.
- Every slice: full gate set green (tsc, unit suites, worker tests,
  build, entry-size) and no player-visible change.
- Phase 3: for each subject, units + answers projections deep-equal the
  frozen pre-move fixture; item counts unchanged.
- Phase 4: each extraction PR shows which of the original 21
  `game-app` baseline rows it removed; a shrink-only size budget (PR 2)
  locks the file to only getting smaller after Part B.

## Assets & related work (in this folder / on main)

- This brief is the asset in the pack; the programme's records live on
  main and are cited, not copied: `ARCHITECTURE.md`,
  `docs/architecture/game-app-map.md` (#570), `docs/adr/0001-*`,
  `docs/branch-status/` (phase1-ports-sweep, phase3-gk-journals,
  phase4-game-app-map, arch-upward-imports-a, feat-phase0-shell-split,
  chore-phase-5-2-migrations, chore-phase-5-3-response-policy,
  feat-phase-5-1-runtime-secrets).
- PRs: #544, #548, #549, #552, #554, #555, #559, #562, #563, #565,
  #566, #568, #569, #572, #573 (merged); #571, #574 (open drafts).

## Open questions for the architect

1. **Sequencing vs the backlog:** Phase 4's split is ~19 extraction
   steps sequenced after Part B. Is that the right order against the
   feature backlog in this pack (story packs #9, friend challenges
   #11, hosts #5) — or should a feature land first on the un-split
   shell?
2. **The baselined remainder:** 15 upward-import entries (map engine,
   CSS, binary assets, colocated config) plus the map-crash-marker
   entry need a layer ruling — extend the map, or accept them as
   permanent named exceptions?
3. **The excluded 13:** after Part B, the last `noRawIo` entries sit
   in five files owned by other lanes. Is zero the right target, or
   is 13 a defensible floor?
4. **Phase 2:** the records name phases 0, 1, 3, 4, 5 — is the
   upward-imports sweep the de-facto Phase 2, and should it get a
   Part B of its own?
5. **Cost honesty:** the programme's lanes run at Tier-2 caps (400k
   tokens per PR, shared). Is the payoff — every future feature
   building on ports + records + a split shell — worth the remaining
   Phase 4 spend?

## Status & evidence

- Main @ `5930e930` (2026-11-23). Phase 0 MERGED; Phase 1 Part A
  MERGED (#569, `noRawIo` 164 → 45), Part B draft #571 (45 → 13);
  Phase 3 COMPLETE (six subjects); upward-imports A MERGED (#573,
  154 → 129); Phase 4 MAPPED ONLY (#570, docs); Phase 5.1 #550,
  5.2 #558 MERGED, 5.3 status record on main; Kanban draft #574.
- This item was added in pack v2 (2026-11-23) on the owner's order;
  it was not in the v1 register because the programme had not yet
  become main's main line when v1 was written.
