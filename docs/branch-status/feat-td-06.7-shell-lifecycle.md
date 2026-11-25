# Branch status: feat/td-06.7-shell-lifecycle

- Branch: `feat/td-06.7-shell-lifecycle`
- Base: `origin/main` at `334d34b0c` (post-TD-06.6 #619 + TD-08.5 #617)
- PR: (draft, to be opened after all four commits)
- Goal: TD-06.7 — extract the shell-lifecycle owners (steps 5, 6, 7, 10)
  out of `src/components/game-app.tsx`, behavior unchanged. Four
  conventional commits in one draft PR. File stays in `src/components/`.

## Done

- Step 5 — Session, idle watchdog, discarded notice.
  New `src/components/use-shell-session.ts` (`useSessionState` +
  `useShellSession`): session store, idle warn / idle-ended flags,
  discarded notice + announcement, idle window, `ensureSession`,
  `killIdleSession`, activity listener + idle watchdog effects.
  GameApp calls the hook; `commit` still retires the notice via the
  returned setter. `game-app.tsx` 8,723 -> 8,562 lines.
  Tests: `use-shell-session.test.ts` (3 pass),
  `map-switched-notice-lifecycle.test.ts` (4 pass, retargeted to the
  new module), `game-app-lazy-boundary.test.ts` (18 pass).
  Gates: tsc PASS, lint:arch PASS, lint:nav PASS, provenance PASS.
  check-game-app-size currently FAILS (ceiling 8,723 > count 8,562);
  the ceiling is lowered once, after the last commit, per the brief.

- Step 6 — Overlay queue (first-visit, tutorial/invite, celebration/cleared).
  New `src/components/use-overlay-queue.tsx` (`useOverlayQueue`): the
  overlay state (tutorial, invite, first-visit modal, celebration,
  cleared) + the celebration element and cleared sound effect.
  GameApp calls the hook and mounts the queue; the prompt computation
  stays in the composer (it needs the tour callbacks). `mapMode` is a
  plain string so the module adds no upward-import row.
  `game-app.tsx` 8,562 -> 8,524 lines.
  Tests: `use-overlay-queue.test.ts` (3 pass). Gates: tsc PASS,
  lint:arch PASS, lint:nav PASS.

- Step 7 — Run controller (`commit`, `openRun`, `startReview`).
  New `src/components/use-run-controller.ts` (`useRunController`):
  `commit` (still the one `writeRun` + `setRun` writer, `writeRun`
  moved with it), `openRun` (still awaits `preloadTerritory()` before
  a run commits, still honors `runStartGenRef`, still skips territory
  preload for review runs via `startReview`), `startReview`.
  `game-app.tsx` 8,524 -> 8,277 lines.
  Tests: `use-run-controller.test.ts` (3 pass),
  `game-app-lazy-boundary.test.ts` (18 pass, #209 openRun pin
  retargeted to the new module). Gates: tsc PASS, lint:arch PASS,
  lint:nav PASS.

## Next

- Step 10 — Router hook (boot / `ready`, `inAppScreen`, hash / history).
- Then: lower `GAME_APP_SIZE_CEILING` to the new `wc -l`, update
  `docs/architecture/game-app-map.md` steps 5, 6, 7, 10 to done,
  run the full gates, open the draft PR.

## Open questions

- None. No owner ruling needed so far.

## Ruled out

- Moving `game-app.tsx` to `src/routes/` (deferred to the last PR).
- Creating `src/hooks/` (brief forbids it).
- Moving I/O off existing storage / session ports (deferred).
