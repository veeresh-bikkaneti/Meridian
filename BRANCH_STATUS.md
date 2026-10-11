# BRANCH_STATUS — fix/loop-typeahead-freeze

Branch: `fix/loop-typeahead-freeze` · Base: origin/main @ ec456a9 · Created: 2026-10-10.
**PUSH OK, DO NOT MERGE** — owner merges.

Standing rules: named-file staging only, never `git add -A`. COPPA-safe (no new
data collection; this change only reduces main-thread work).

## Why this branch exists

Veeresh reported the GeoDetective map **freezing** during his own play-test on the
live site (~22:13 CDT, 2026-10-10). Investigation identified the prime suspect:
the "Search the map" typeahead (`GuessInput`) runs a synchronous full scan of the
119k-entry place index on **every keystroke**, with no debounce — measured
80–207 ms of main-thread block per keystroke on server hardware (×2–4 on a phone).
While the main thread is blocked, the map cannot process touch input: the whole
GeoDetective screen, map included, freezes.

## Findings (evidence)

- **Ruled out — today's deploys:** #124 touched only `EarnedBadgeRow` (home dossier
  card); #125 touched only storyteller/home components; #123's `LoopMap.tsx`
  changes are Cold-Trail-only and inert when `placementActive` is unset (loop
  mode). None touches the GeoDetective map's active path.
- **Ruled out — deploy health:** live site serves `buildId ec456a976ea3` (= HEAD);
  Esri tile CDN responds 200; crash worker `/health` OK. Tiles are slowish
  (~1.5 s/tile from the VM) but MapLibre degrades gracefully — not a freeze.
- **Ruled out — map tap/paint/bottom-sheet/clue paths:** `nearestPlace` is a
  bounded grid search; `paintOverlays` builds small GeoJSON; the confirm sheet
  and clue cards are static; no loops found.
- **Confirmed — typeahead jank (benchmarked against real 11 MB names.json,
  119,038 entries):** 80–207 ms/keystroke, dominated by per-entry
  `normalizeLoopName(entry.r)` (regex ×4 + NFD, 119k× per keystroke) plus a full
  sort of all matches (71k for a 1-char query).
- **Crash pipeline:** worker has no query endpoint for recent reports; a
  main-thread stall would not produce a crash report anyway. No signal either way.

## Fix (this branch)

1. `src/game/loop/evaluate.ts` — cache the per-entry `"name + normalized region"`
   haystack in a `WeakMap` (transparent: identical strings, identical matches).
   Cuts the scan from 80–207 ms → 14–60 ms on the benchmark box.
2. `src/game/loop/guess-input.tsx` — debounce the query used for ranking (150 ms);
   the input stays immediately responsive, scans run on typing pauses. Enter
   flushes: if the debounced query is stale, the commit action runs one synchronous
   fresh scan so Enter always acts on the exact current text (old semantics kept).

## Tests

- `src/game/loop/evaluate.test.ts` — new test: repeated scans return identical
  results (cache transparency); fresh-identity arrays agree.
- Existing `guess-input.test.ts` / `evaluate.test.ts` suites must stay green
  (logic surface unchanged).
- E2E: `tests/e2e/geodetective.spec.ts` (typeahead flow) must stay green.

## Status

- [x] Branch created from origin/main
- [x] BRANCH_STATUS.md written
- [ ] Fix implemented
- [ ] Unit tests added + full suite green
- [ ] tsc + lint clean
- [ ] E2E geodetective specs green
- [ ] Pushed, PR opened (NO merge — Veeresh's word only)

## Still needed from Veeresh

- Exact repro steps for the freeze (was he typing in "Search the map", tapping the
  map, or opening clues?). If the freeze happens WITHOUT typing, this fix is a
  real perf win but not the root cause — say so and the investigation reopens
  (next suspects: tile CDN behavior on his network, device-specific).
