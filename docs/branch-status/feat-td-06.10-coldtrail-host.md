# Branch status: feat/td-06.10-coldtrail-host

- Branch: `feat/td-06.10-coldtrail-host`
- Base: `origin/main` at `d53bd3b8` (post-TD-06.8 #622)
- PR: (draft, to be opened by the parent)
- Goal: TD-06.10 — game-app-map step 14: extract the Cold Trail
  host into `src/game/coldtrail/ColdTrailHost.tsx`. Behavior
  unchanged.

## Done

- Cold Trail host: new `src/game/coldtrail/ColdTrailHost.tsx` owns
  what GameApp held inline for Cold Trail — the `React.lazy`
  TrailScreen (its load still raced against the chunk-load timeout,
  #209) and the leave wiring: clearing this area's persisted open
  flag (`writeColdTrailOpen(false)`), then the shell's close
  callback. GameApp keeps only the `coldTrailOpen` state and the
  render site's Suspense + `MapErrorBoundary` wrappers (the boundary
  is a components/root module; the composer owns it until it moves
  to layer 6 — the TD-06.6 age-profile host split). TrailScreen
  stays lazy, so MapLibre still loads only on tap-in.
- The `@/game/coldtrail/TrailScreen` import has left
  `src/components/game-app.tsx`; the composer renders
  `<ColdTrailHost onLeave={() => setColdTrailOpen(false)} />`.
- Baseline: checklist row 12's key
  (`src/components/game-app.tsx|@/game/coldtrail/TrailScreen`)
  removed. One new row added for the composer's host import
  (`src/components/game-app.tsx|@/game/coldtrail/ColdTrailHost`) —
  the sanctioned leftover-host row the §2 preamble allows (same
  shape as TD-06.6's age-profile host row and TD-06.8's map-mode
  hook row), cleared in the last PR. Net `noUpwardImport` is 104,
  unchanged from base; `LIMITS.noUpwardImport` stays 104.
  `noRawIo` stays 0. Shell-ban baseline untouched (6 entries).
- Size: `game-app.tsx` 7,481 → 7,476 lines; ceiling lowered to
  7,476 (script + test pins).
- Entry size: 310,464 B gzip against the 323,865 B cap (13,401 B
  to spare). No cap touched.
- Map doc: step 14 marked done (final-order table + §2 row 12).
- Pins retargeted (TD-06.7/06.8 pattern):
  `src/components/game-app-lazy-boundary.test.ts` now reads
  ColdTrailHost.tsx for the Trail lazy factory, the #209 timeout
  wrap, the branch render (branch renders the host; the host
  renders TrailScreen), the split leave wiring (host clears the
  flag, the composer's callback clears the state), and the Core
  F-4 no-prefetch guard on the loader's new home.
- Tests (narrow): game-app-lazy-boundary, map-error-boundary,
  coldtrail (cases, cases-moved, cases-pack, edge, engine,
  placement, store, themes, trail-heading-focus, webgl2-fallback),
  territory-lazy-boundary — 143 pass. Script tests:
  layer-baseline, check-game-app-size — 10 pass.
- Gates: tsc PASS, lint:arch PASS (noRawIo 0, noUpwardImport 104),
  lint:nav PASS, build:pages PASS, lint-cards GATE PASSED,
  check:entry-size PASS, check-game-app-size PASS,
  check-e2e-registration PASS, check-seed-seen-except GATE PASSED,
  merge-tree clean, check:provenance PASS (see final tip).

## Ruled out / deferred

- Moving the Suspense + `MapErrorBoundary` wrappers into the host:
  the boundary is a components/root module, so a host in
  `src/game/coldtrail` importing it would add an upward row of its
  own. The wrappers stay at the composer's render site, as with
  the age-profile host's lazy pieces (TD-06.6).

## Next step

- Review, then merge on the owner's word. TD-06.11 (GeoDetective
  host, step 15) starts only after this merges (one open game-app
  PR at a time).

## Graph

- Node: `branch:feat/td-06.10-coldtrail-host`
- Edge: `branch:feat/td-06.10-coldtrail-host` — depends-on → `doc:docs/architecture/game-app-map.md` (step 14)
- Edge: `branch:feat/td-06.10-coldtrail-host` — supersedes → the inline TrailScreen lazy + leave wiring in `src/components/game-app.tsx` (now `src/game/coldtrail/ColdTrailHost.tsx`)
