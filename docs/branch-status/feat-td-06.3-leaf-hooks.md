# TD-06.3 leaf hooks (game-app map step 3) — status

Branch `feat/td-06.3-leaf-hooks`, based on main `9314c6def54b3a8e66810408048c04f5f7c9cd86` (#606).

## Result

Map step 3 only: the four leaf state owners moved out of `src/components/game-app.tsx` into sibling modules under `src/components/` (same layer, same `components/root` feature area, so no new `noUpwardImport` rows). Behavior unchanged; `noUpwardImport` stays 120, `noRawIo` stays 0, shell-ban stays 10. `game-app.tsx`: 8,869 → 8,787 lines; `GAME_APP_SIZE_CEILING` lowered to 8,787.

## What moved

- `src/components/game-app-difficulty.ts` — `readDifficultyChoice` / `writeDifficultyChoice` (storage port, `STORAGE_KEYS.difficulty`) plus a new `useDifficultyChoice()` hook owning the `difficultyChoice` state and its persisted setter.
- `src/components/game-app-deck-status.ts` — `useDeckStatus` moved as-is.
- `src/components/game-app-chunk-reload-notice.ts` — `chunkReloadNotice` state, the dismiss callback, and the `consumeChunkReloadNotice()` wiring, still invoked at the ready-signal point (`[ready]` effect), not in a mount effect (F7d watchdog pin preserved, updated in `game-app-lazy-boundary.test.ts`).
- `src/components/game-app-reset-history-toast.ts` — `resetToast` / `historyResetEpoch`, the 3,500 ms auto-dismiss, `notifyHistoryReset()`, and the locked `RESET_HISTORY_SUCCESS_TOAST` copy.

Each module has a narrow node:test unit file next to it (SSR probe + storage round-trip for the difficulty port). `src/routes/` untouched (that is TD-06.4); `eslint/layer-baseline.json` untouched.
