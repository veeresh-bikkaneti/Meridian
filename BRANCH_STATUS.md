# feat/feature-flags — status

Zero-cost, dependency-free feature flag system for Meridian.
Veeresh's intent: experimental tracks merge behind flags, dark in prod until proven.

## Done
- [x] Worktree `~/workspace/meridian-worktrees/feature-flags`, branch `feat/feature-flags` from `origin/main` (3c32085) — replaced stale crash-investigation BRANCH_STATUS.md inherited by the worktree
- [x] node_modules symlinked; AGENTS.md read
- [x] `src/lib/flags.ts` — `FlagName` union (`"pwaUpdateToast"`), `FLAG_DEFAULTS` (= current prod behavior), `isEnabled()` (never throws), `loadFlags()` (network-first, ~1.5s timeout, fire-and-forget, never rejects; unknown names / non-boolean values ignored, fail closed to defaults)
- [x] `public/flags.json` — `{ "version": 1, "flags": { "pwaUpdateToast": true } }`, versioned in repo
- [x] Boot wiring — `void loadFlags()` at module scope in `src/routes/__root.tsx`; flag checked before `registerServiceWorker()` in `PwaUpdateToast`
- [x] First consumer: PWA update flow kill-switch (flag off → no SW registration, no toast; default true = today's behavior)
- [x] `public/sw.js` — `flags.json` network-first (small versioned flag cache, cache fallback only when network fails); `meridian-flags-*` added to activate-time cleanup; old-client network-default note documented
- [x] `src/lib/flags.test.ts` — 18 unit tests (defaults pre-load, override merge, unknown/non-boolean ignored, timeout/reject/invalid-JSON/malformed → defaults, never-throws/never-rejects); added to `npm test` file list
- [x] `docs/feature-flags.md` — adopter pattern (register → gate before init → set in flags.json → test both positions), kill-switch semantics, boot-time-not-reactive caveat, defaults-always-equal-prod rule, old-client SW note
- [x] `tests/e2e/feature-flags.spec.ts` — 6 specs (SW network-first, cache-offline-fallback, flag off/on/missing/slow/failing); `feature-flags` project added to playwright.config.ts

## Pending
- [x] Gates: `npx tsc --noEmit` clean · `npm test` full unit suite green (411 pass incl. 18 new flags tests) · `node scripts/lint-cards.mjs` GATE PASSED · `npm run build:pages` green (SW fingerprinted, flags.json in artifact) · E2E 7/7 feature-flags + 5/5 pwa specs pass against the built artifact
- [x] E2E hardening: excluded the pre-existing flaky React #418 hydration warning (same exclusion as pwa.spec.ts); fixed offline-fallback test to register the SW (flag on) so a controller exists
- [ ] Technical-architect review + tone/docs review
- [ ] PR → merge → live verification

## Out of scope (by design)
- Do NOT touch the difficulty crew's picker files (separate branch, mid-build). This track ships the system + adoption pattern; the parent directs adoption after landing.
