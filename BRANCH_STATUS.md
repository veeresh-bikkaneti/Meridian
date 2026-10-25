# BRANCH_STATUS — fix/chunk-load-recovery

**Branch:** `fix/chunk-load-recovery`
**Base:** `main` at `a59ee4c` (includes the PR #244 merge)
**State: WORK COMPLETE — all gates green locally (see Verification);
the branch is LOCAL ONLY — not pushed, no PR yet (see Push status).**
It supersedes the previous contents of this file (the
`feat/wave2-mode-screens` branch record, whose history lives on its
own PR #244).

## Scope (exactly this — no drive-by changes)

Stale-chunk auto-recovery. A deploy that lands mid-session rotates the
content-hashed assets; the old tab's lazy-chunk URLs then 404 and the
dynamic import dies (type specimen: the 2026-10-24 crash report —
build fa9f36b, LoopScreen chunk, country/France). The failure lands in
an error boundary whose only recovery is a manual "Try again" tap.

1. **New pure module `src/lib/chunk-recovery.ts`** — a guarded
   auto-reload for chunk-load failures only:
   - reacts to the bundler's `vite:preloadError` event (verified
     present in the built bundle's preload helper) plus a backstop on
     window `error`/`unhandledrejection` filtered to the three known
     dynamic-import failure messages (Chromium/Safari/Firefox);
   - the decision is DEFERRED 1.5 s and stands down when the app's own
     confirmed-stale offer ("A new version of Meridian is available.")
     is on screen — the offer paths (openRun, LoopScreen) keep owning
     the failures they already catch, per the behavior pinned by
     `tests/e2e/crash-watchdog.spec.ts`;
   - a sessionStorage timestamp (`meridian.chunkReloadAt`) caps
     auto-reloads to one per 30 s per tab session, with an in-memory
     stamp behind it for storage-blocked browsers — a genuinely
     missing chunk can never cause a reload loop;
   - recovery only: crash reporting (observability) is untouched.
2. **Wiring: one call** — `installChunkLoadRecovery()` in
   game-app.tsx's boot effect, beside `initObservability()` /
   `installGlobalErrorHandlers()`, i.e. registered before any lazy
   screen import can fire. No other app code touched.
3. **Tests** — `src/lib/chunk-recovery.test.ts` (13 unit tests over a
   fake host: signature match, deferral, stand-down, window guard,
   storage-throws, idempotent install) and
   `tests/e2e/chunk-recovery.desktop.spec.ts` (2 specs against the
   built artifact: a dispatched `vite:preloadError` reloads exactly
   once and the guard blocks the immediate second; a chunk-signature
   unhandled rejection reloads once; unrelated errors never reload).

Not touched: `public/sw.js` (the reload composes with it — SW
navigations are network-first, so the fresh shell's new chunk URLs
load from the network; no skipWaiting/cache change needed), game
logic, security headers/CSP, dependencies.

## Verification (local, this branch)

- `npx tsc --noEmit` — clean
- `npm test` — scripts 832 pass / 0 fail / 9 skipped; src 1523/1523
  (1510 baseline + 13 new)
- `node scripts/lint-cards.mjs` — GATE PASSED
- `npm run build:pages` — green; the built entry + routes chunks
  contain the bundler's `vite:preloadError` dispatch and the guard key
- Playwright (built artifact): chunk-recovery 2/2, crash-loop-breaker
  green, observability 3/3
- KNOWN PRE-EXISTING FAILURE: `crash-watchdog.spec.ts` "stale build"
  test fails on the breadcrumb milestone assertion (expected
  `data_chunk_load_start`, got `storyteller_ready`). Proven unrelated:
  the identical failure reproduces against a pristine `a59ee4c` build
  (KOFI_E2E_DIST), and a sampling probe of the scenario on this branch
  shows the app's refresh offer wins with NO reload and NO guard stamp
  — the milestone is overwritten by the storyteller re-readying after
  the failed start, on base and branch alike.

## Push status

Local only. The parent agent replays the commits onto GitHub via the
API connector and opens the PR; merge awaits the owner's word.
