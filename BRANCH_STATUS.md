# feat/difficulty-tiers — status

Difficulty tiers + fame-weighted dealing + subdivision labels. All feature work
gated green on this branch (see log below); parked at the wiki-merge gate per
the 2026-10-03 architectural directive.

## 2026-10-03 — merge order flipped by Veeresh's call
Veeresh: question details (state/country labels) must ship now, not wait for
Liz's Wikipedia push. Architectural update: THIS branch merges FIRST; the
Wikipedia merge rebases onto the new main afterward (its merge script is
idempotent and matches by stable place ID, so either order is safe).

## Merge resolution (origin/main = aa69434, PRs #44 learning-outcomes + #45 flag flip)
- `package.json`: union of test lists (main's `learning.test.ts` + branch's `tier-filter.test.ts`).
- `playwright.config.ts`: all four project entries (subdivision-labels, difficulty-picker, crash-loop-breaker, safari-launch).
- `src/components/game-app.tsx`: single import conflict — kept branch's `resolveRunPool`, main's lazy `SatelliteMap` + `MapErrorBoundary` (JSX already merged: lazy map inside the boundary).
- No chunk conflicts (main did not touch chunk data).
- Post-merge verification: tsc + full unit suite + build:pages re-run (below).

## Log (feature work — all gated before parking)
- 2026-10-03: dataset rebuild — difficulty (1-5) + subdivision stamped for 124,690 places, additive-preservative (byte-verified history/wiki/blurb, 0 mismatches); 12 curated starters pinned tier 1.
- 2026-10-03: learning-path picker (Easy/Medium/Hard), fame-weighted Efraimidis-Spirakis dealing, real 1x-2.5x scoring, subdivision labels (country `{Place}, {Subdivision}`; globe always 3-part).
- 2026-10-03: 425/425 unit green, tsc clean, lint-cards GATE PASSED, build:pages green, E2E (picker 5/5, subdivision 2/2, labels 3/3 + regression) green; tech-arch APPROVE WITH NOTES (applied); tone/docs/a11y APPROVE WITH NOTES (applied).
- 2026-10-03: PR #46 opened → merge conflicts with aa69434 resolved (this file) → merged.
