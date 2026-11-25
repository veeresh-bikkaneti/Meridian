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

- Ceiling lowered to the new count: `GAME_APP_SIZE_CEILING` 8,723 ->
  8,274 (`scripts/check-game-app-size.mjs` + test). Map steps 5, 6,
  7 marked done in `docs/architecture/game-app-map.md`.
  Entry size is 324,522 B gzip — 657 B OVER the 323,865 B limit
  (base 334d34b0c is 323,822 B). The three extractions added ~700 B
  to the entry bundle; the cause is not yet isolated. This gate is
  FAILING and needs a follow-up.

## Next

- Step 10 — Router hook (boot / `ready`, `inAppScreen`, hash / history).
  DONE in the review-fix round: `src/components/use-shell-router.ts`
  owns `ready` / `setReady`, `inAppScreen`, `hashSeededRef`, the hash
  effect, `applyHashScreen`, the popstate + deep-link effects, and the
  boot effect (every exit still calls `setReady(true)`).
  `game-app.tsx` 8,274 -> 7,701 lines; ceiling lowered to 7,701.
  Map Step 10 marked done. Review fixes 2 (territory pins), 3 (M6
  regex), 4 (Step 10) all landed; narrow tests green.
- Entry-size overage: 324,895 B gzip vs 323,865 B limit (+1,030 B).
  STILL FAILING after Step 10. Root cause: the four hook extractions
  add ~1,073 B of routes-chunk overhead (base 323,822 B -> 324,895 B;
  routes chunk +2,559 raw bytes; index.js byte-identical). The code
  moved, it did not grow — the overhead is the module boundaries +
  named deps-object property names + reduced minification across
  modules. No duplication, no dead code, no new modules. Fix needs
  an owner decision (limit, or a deeper bundle restructure such as
  lazy-loading territory / session / journal data out of the entry).
- Then: lower `GAME_APP_SIZE_CEILING` to the new `wc -l`, update
  `docs/architecture/game-app-map.md` steps 5, 6, 7, 10 to done,
  run the full gates, open the draft PR.

## Open questions

- None. No owner ruling needed so far.

## Ruled out

- Moving `game-app.tsx` to `src/routes/` (deferred to the last PR).
- Creating `src/hooks/` (brief forbids it).
- Moving I/O off existing storage / session ports (deferred).
