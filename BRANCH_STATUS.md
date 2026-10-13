# BRANCH_STATUS — perf/globe-tier-split (perf Task 2)

**PUSH OK, DO NOT MERGE** — owner merges. Stacked on `claude/hopeful-darwin-dp7ket` (Task 1 harness).

## Done
- `scripts/globe-tiers.mjs`, `scripts/build-globe-tiers.mjs`: derive `src/game/data/geonames/tiers/globe-t1..t5.json` from the canonical `chunks/globe.json` (unchanged).
- Dataset builder + Wikipedia merge regenerate tiers; prebuild gate (`check-generated-places.mjs`) fails if they drift.
- `generated-places.ts`: Globe loads per fame tier (cached per tier), merged back into canonical order; `placesFor(edition, region, choice?)`.
- `game-app.tsx`: passes the learning path; `places` reloads when `difficultyChoice` changes.
- `vite.config.ts`: canonical `globe.json` stubbed out of the bundles.
- Tests: generated-places, pool, tier-filter, scripts/globe-tiers.

## Pending
- Full Playwright run (see PR description for results).
