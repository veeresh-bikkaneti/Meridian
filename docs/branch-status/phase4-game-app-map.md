# BRANCH_STATUS: phase4/game-app-map

**Branch:** `phase4/game-app-map`
**Base:** `384689534353bbda4920edaa938d9a5a40d4ab51` (`origin/main` after `git fetch`). The tip had not moved past the inventory SHA.
**Scope:** Phase 4 PR 1, docs only. Two new files. No code change and no merge.

## Done

- [x] Recorded a tagged inventory of `src/components/game-app.tsx` (8894 lines, 11 `inAppScreen` values, 21 `noUpwardImport` rows) in `docs/architecture/game-app-map.md`.
- [x] Listed each of the 21 baseline entries as an extraction checklist, with the PR that cures each row.
- [x] Listed non-test files that mention `game-app` and what each points at.
- [x] Recorded option A (split by screen) and option B (split by concern), then the chosen hybrid order: extract first, thin router last.
- [x] Drew the top-level screen statechart and a transition table with triggers at `path:line`.
- [x] Round 1 review: corrected Subjects I/O, the celebration primary spec, the chosen order (fewest shared-state rows first, with reasons where a dependency forced a step), and the then-current step 1 wording. Also the §1 row references, the BootSplash test command, the Choose range, the Cold Trail `pageshow` cite, the out-of-scope t2-rebase note, and this provenance record.
- [x] Owner amendment: do not move `game-app.tsx` to `src/routes` first. Keep the 21 rows as the extraction checklist. PR 2 is a shrink-only size budget after Part B. The thin router moves last. Fixed "Option A called" at the option A write-up.

## Gates

Run in this worktree at `384689534353bbda4920edaa938d9a5a40d4ab51`.

- [x] `npm ci` (needed; `node_modules` was missing). 458 packages added. The lockfile did not change.
- [x] `npm run lint:arch`. PASS.
- [x] `npm run check:provenance`. PASS. Re-run after the first commit (`59c8d414`), after the round 1 commit (`44882677`), and after the extract-before-router commit.
- [x] `git diff --name-only origin/main`. Exactly the two files below, after this commit.

## Files added

- `docs/architecture/game-app-map.md`
- `docs/branch-status/phase4-game-app-map.md`

## Open risks

- Line numbers are from `38468953`. Edge's Part B will move storage ports in `game-app.tsx` and will shift them. Re-check this map against main after Part B lands, and before PR 2.
- A leftover host or hook import on `src/components/game-app.tsx` is a new baseline row until the last PR moves the thin router to layer 6. Each extract PR must show, with `lint:arch`, which of the original 21 specifiers it removed and which leftover imports it added.
- If `game-app.tsx` changes on main before the extract PRs, the inventory, the statechart line citations, and the shared-row counts can drift.
- Mid-extract, two hash writers would desync Back and deep links. Keep one writer for the contract at 3504-3567.
- `handleManualMapMode` at 2260-2308 must stay above Play, or Play will fight the router.
- Lazy `SatelliteMap` at 619-620 must stay lazy, or the entry bundle will grow.
- When a screen leaves the file, update `src/components/ui/shell-registry.ts` and `src/components/game-app-lazy-boundary.test.ts`. Do not rewrite assertion text unless a path or testid moves.
- Do not start the deferred `src/platform` port move until edge's Part B has landed. That lane owns those files now.

## Bugs and gaps found

These were found while mapping. They are not fixed in this PR.

- No e2e or unit spec matches the exact strings "Couldn't load places", "Loading places", or "Fetching this region". Pool error and the `starting` loader are only covered indirectly, or by shell-registry unit tests.
- The challenge region picker at 4026-4084 still uses a hand-placed `HomeButton` and is not on `SiteHeader`. Shell registry id `challenge-menu` is recorded as baseline, not yet adopted.
- There is no TypeScript `InAppScreen` type. The union is only the computed value at 3484-3498.
- After Phase 1 Part A, this file still has 32 `noRawIo` baseline rows for raw `localStorage` and `sessionStorage`. That is leftover work for edge's Part B, not a regression in this PR.
- This file never reads `navigator.onLine`. Offline is only `startError` copy.

## Integrator

- Draft PR only. Do not mark it ready and do not merge until the owner says so.
- Do not rebase or force-push.
- PR 2 is a shrink-only size budget test for `game-app.tsx`, after edge's Part B merges. It is not a move to `src/routes`. The thin router moves to `src/routes` only as the last PR, once it routes and holds no screen state.
