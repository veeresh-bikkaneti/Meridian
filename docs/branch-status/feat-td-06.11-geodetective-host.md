# Branch status: feat/td-06.11-geodetective-host

- Branch: `feat/td-06.11-geodetective-host`
- Base: `origin/main` at `2cd88294` (post-TD-06.10 #624)
- PR: (draft, to be opened by the parent)
- Goal: TD-06.11 — game-app-map step 15: extract the GeoDetective
  host into `src/game/loop/GeoDetectiveHost.tsx`. Behavior
  unchanged.

## Done

- GeoDetective host: new `src/game/loop/GeoDetectiveHost.tsx` owns
  what GameApp held inline for GeoDetective — the `React.lazy`
  LoopScreen (its load still raced against the chunk-load timeout,
  #209) and the leave wiring: clearing this area's persisted open
  flag (`writeLoopOpen(false)`), then the shell's close callback.
  The shell's celebration callback passes through untouched (the
  host's props are LoopScreen's own, derived by type query — not a
  runtime edge). GameApp keeps only the `loopOpen` state and the
  render site's Suspense + `MapErrorBoundary` wrappers (the
  boundary is a components/root module; the composer owns it until
  it moves to layer 6 — the TD-06.6 age-profile host split).
  LoopScreen stays lazy, so MapLibre still loads only on tap-in.
- The `@/game/loop/LoopScreen` import has left
  `src/components/game-app.tsx`; the composer renders
  `<GeoDetectiveHost onLeave={() => setLoopOpen(false)} … />`.
- Baseline: checklist row 13's key
  (`src/components/game-app.tsx|@/game/loop/LoopScreen`) removed.
  One new row added for the composer's host import
  (`src/components/game-app.tsx|@/game/loop/GeoDetectiveHost`) —
  the sanctioned leftover-host row the §2 preamble allows (same
  shape as TD-06.6's age-profile host row, TD-06.8's map-mode hook
  row and TD-06.10's Cold Trail host row), cleared in the last PR.
  Net `noUpwardImport` is 104, unchanged from base;
  `LIMITS.noUpwardImport` stays 104. `noRawIo` stays 0.
- Shell-ban: unchanged at 6, same as base. The `homeButtonImport`
  row for `src/game/loop/LoopScreen.tsx` STAYS: it records
  LoopScreen.tsx's own end-of-flow `HomeButton` import (the screen
  file itself, untouched by this extraction), not the composer's
  wiring, so it does not move with the host. See Open questions.
- Size: `game-app.tsx` 7,476 → 7,471 lines; ceiling lowered to
  7,471 (script + test pins).
- Entry size: 310,466 B gzip against the 323,865 B cap (13,399 B
  to spare). No cap touched.
- Map doc: step 15 marked done (final-order table + §2 row 13).
- Pins retargeted (TD-06.10 pattern):
  `src/components/game-app-lazy-boundary.test.ts` now reads
  GeoDetectiveHost.tsx for the Loop lazy factory, the #209 timeout
  wrap, the branch render (branch renders the host; the host
  renders LoopScreen), the split leave wiring (host clears the
  flag, the composer's callback clears the state), and the Core
  F-4 no-prefetch guard on the loader's new home.
- Tests (narrow): game-app-lazy-boundary, map-error-boundary
  (source + behavior), shared-shell, territory-lazy-boundary and
  the loop suites (clue-watchdog, day, engine, evaluate,
  guess-input, guess-input-animate, loop-screen-animate,
  loop-screen-ports, names-codec, packs, place-resolve, rings,
  store, store-decks, store-topup, trail-evidence) — 257 pass.
  Script tests: layer-baseline, check-game-app-size — 10 pass.
- Gates: tsc PASS, lint:arch PASS (noRawIo 0, noUpwardImport 104),
  lint:nav PASS (shell-ban 6, same as base), build:pages PASS,
  lint-cards GATE PASSED, check:entry-size PASS,
  check-game-app-size PASS, check-e2e-registration PASS,
  check-seed-seen-except GATE PASSED, merge-tree clean,
  check:provenance PASS (see final tip).

## Ruled out / deferred

- Moving the Suspense + `MapErrorBoundary` wrappers into the host:
  the boundary is a components/root module, so a host in
  `src/game/loop` importing it would add an upward row of its own.
  The wrappers stay at the composer's render site, as with the
  Cold Trail host (TD-06.10).
- Removing LoopScreen's `homeButtonImport` shell-ban row: the row
  belongs to the screen file's own end-of-flow `HomeButton`, which
  this extraction does not move. Not cured here.

## Open questions

- Owner call (for the PR body): LoopScreen's end-of-flow
  `HomeButton` keeps its `homeButtonImport` shell-ban row after
  this extraction. Curing it means re-homing that end-of-flow
  button — a design decision, not part of the host extraction.
  Left in place pending the owner's word.

## Next step

- Review, then merge on the owner's word. This closes Lane 4
  (TD-06.8 → TD-06.10 → TD-06.11).

## Graph

- Node: `branch:feat/td-06.11-geodetective-host`
- Edge: `branch:feat/td-06.11-geodetective-host` — depends-on → `doc:docs/architecture/game-app-map.md` (step 15)
- Edge: `branch:feat/td-06.11-geodetective-host` — supersedes → the inline LoopScreen lazy + leave wiring in `src/components/game-app.tsx` (now `src/game/loop/GeoDetectiveHost.tsx`)
