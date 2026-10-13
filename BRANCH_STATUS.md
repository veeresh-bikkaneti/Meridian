# BRANCH_STATUS — chore/remove-unused-deps (perf Task 5, housekeeping)

**PUSH OK, DO NOT MERGE** — owner merges. Based on main @ d7a0fc8, independent of the other perf PRs.

## Done
- Removed 34 dependencies with zero imports anywhere (see PR description for the proof method);
  production client + server build output byte-identical before/after (except `_shell.html`, which differs between any two builds).
- `test` script: hand-maintained `src/...` file list → `'src/**/*.test.ts'` glob.
  Two test files had been forgotten (`src/game/data/iso-continents.test.ts`, `src/map/tile-status.test.ts`) and
  `src/game/geo.test.ts` was listed twice. Unit tests 1219 → 1236, all green.

## Pending
- Kept on purpose (no direct imports, but toolchain pins): `lightningcss`, `@tanstack/router-plugin`, all `@types/*`, `eslint`.
- Playwright: not re-run on this branch (artifact is byte-identical to main's); see PR description.
