# TD-06.5 — game-app-map step 3: extract the leaf hooks

Branch: `feat/td-06.5-leaf-hooks`
Base: origin/main `9314c6de` (#606 test seams)
Story: TD-06.5 — extract the four leaf state owners out of
`src/components/game-app.tsx`, behavior unchanged, so the composer only
calls them. Step 3 of `docs/architecture/game-app-map.md`. Step 4
(age-profile) and the TD-06.4 router move are not started.

## What changed

`game-app.tsx`: 8,869 → 8,800 lines (`wc -l`). One commit per hook:

- Picker difficulty → `src/components/use-difficulty-choice.ts`:
  `readDifficultyChoice` / `writeDifficultyChoice` moved verbatim (the
  storage-port read/write under `STORAGE_KEYS.difficulty`), plus a new
  `useDifficultyChoice` hook holding the state and the write-through
  setter game-app used inline.
- Deck status → `src/components/use-deck-status.ts`: the existing
  `useDeckStatus` moved as-is.
- Chunk-reload notice → `src/components/use-chunk-reload-notice.ts`:
  `useChunkReloadNotice` owns the notice flag; game-app calls its
  consume at the same ready point as before (F7d timing unchanged) and
  its dismiss from the notice's close button.
  `src/components/game-app-lazy-boundary.test.ts` F7d follows the moved
  symbol: it now pins the one consume call in game-app's ready effect
  and the one chunk-recovery consume inside the hook.
- Reset-history toast → `src/components/use-reset-history-toast.ts`:
  `useResetHistoryToast` owns `resetToast`, `historyResetEpoch` and
  the 3500 ms auto-dismiss; `showResetSuccess()` bumps the epoch and
  shows the toast. `RESET_HISTORY_SUCCESS_TOAST` moved with it, copy
  verbatim (locked, manifest 2026-10-28 §4).

Placement: siblings under `src/components/` (the components/root area),
importing only layers game-app already imports from — no new
`noUpwardImport` rows, `eslint/layer-baseline.json` untouched. The new
modules use relative import specifiers so `node --test` resolves them
(the `@/` alias does not resolve under the node test runner).

- New unit tests beside each module (SSR probe + pure-function tests,
  the repo's hook-test pattern): 13 tests.
- `scripts/check-game-app-size.mjs`: `GAME_APP_SIZE_CEILING` lowered
  8869 → 8800, matching the new count; its unit test updated to match.

## Gates

- `npx tsc --noEmit`: PASS
- `npm run lint:arch`: PASS (`noRawIo` 0, `noUpwardImport` 120 — both
  unchanged from base; baseline file not edited)
- `npm run lint:nav`: PASS (`shell-ban` 10 — unchanged from base)
- `npm run check:provenance`: PASS (real local run on the reproduced
  range before push; CI re-runs it)
- `npm run build:pages`: FAIL locally at the postbuild
  `fingerprint-sw.mjs` step only ("placeholder __BUILD_ID__ not found
  in dist/client/sw.js") — the pristine base tree fails identically,
  so this is environmental on this machine; the vite build and
  prerender completed and CI is decisive
- `node scripts/lint-cards.mjs`: PASS (GATE PASSED)
- `npm run check:entry-size`: PASS (323,637 B gzip, limit 323,865 B)
- `node scripts/check-game-app-size.mjs`: PASS (8,800 lines, at the
  8,800 ceiling)
- `node scripts/check-e2e-registration.mjs`: PASS (266 matched,
  2 excepted)
- `node scripts/check-seed-seen-except.mjs`: PASS (GATE PASSED)
- Narrow tests: the four new hook test files (13 tests) PASS;
  `scripts/check-game-app-size.test.mjs` 4/4 PASS; adjacent wiring
  tests (`game-app-lazy-boundary`, `first-visit-queue-wiring`,
  `shell-registry`, `shared-shell`) 72/72 PASS; full `npm test`
  (scripts + src suites) PASS; `npm run test:worker` 239/239 PASS
- Playwright: NOT RUN — no hook-owned spec needed; behavior unchanged
  and the moved wiring is pinned by the unit tests above

## Not done / next

- Draft PR only. Reviewer reviews; Veeresh merges on his word only.
- Next map step (not this lane): step 4, age-profile. The TD-06.4
  router move stays last, per the map.

## Graph

- Adds nodes: the four hook modules
  (`src/components/use-difficulty-choice.ts`,
  `src/components/use-deck-status.ts`,
  `src/components/use-chunk-reload-notice.ts`,
  `src/components/use-reset-history-toast.ts`) as extractions of
  game-app-map step 3 (TD-06.5), each `depends-on` the ports/modules
  they import. Integrator folds these in at merge; this branch does
  not edit `docs/knowledge/graph.json`.
