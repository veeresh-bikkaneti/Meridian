# feat/feature-flags — status

Zero-cost, dependency-free feature flag system for Meridian.
Veeresh's intent: experimental tracks merge behind flags, disabled in prod until proven.

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

## Review fixes (2026-10-03 — both mandatory reviews returned FAIL; all findings fixed in one pass)
- [x] Kill-switch boot-time race: `loadFlags()` production promise is now memoized (`src/lib/flags.ts` — concurrent callers share one fetch; `testEnv` seam always fresh; `resetFlags()` clears the in-flight promise) and the `PwaUpdateToast` effect in `src/routes/__root.tsx` AWAITS the shared promise before reading `isEnabled("pwaUpdateToast")` (~1.5s timeout bounds the delay; first paint unaffected, only SW registration defers)
- [x] "Without a new deploy" corrected: header rewritten — a redeployed `public/flags.json` flips a flag without a new client release; `docs/feature-flags.md` notes pushing the file is a normal static deploy, and documents the irony (the kill-switch deploy ships a new SW version; quieted clients pick it up via network-first navigation, not the toast)
- [x] Remote-off now really unregisters: new exported `unregisterServiceWorker()` in `src/lib/pwa.ts` (no reload; current page keeps its controller until next navigation; subsequent boots SW-free), wired into the `__root.tsx` effect's flag-off path; semantics documented in `docs/feature-flags.md`
- [x] Non-blocking notes: `version` field documented as informational schema versioning; "dark in production" → "disabled in production"; `resetFlags()` stays exported (test-only, documented); `typeof window === "undefined"` early return added to `loadFlags()`
- [x] Gates re-run: `npx tsc --noEmit` clean · `npm test` 423/423 pass (411 + 12 new: 5 memoized-promise/await-ordering/SSR + 7 unregister) · `node scripts/lint-cards.mjs` GATE PASSED · `npm run build:pages` green · E2E 8/8 feature-flags (flag-off spec now proves the await pattern on 500ms realistic latency; new spec: live registration removed with zero page reloads) + 5/5 pwa specs against the built artifact

## Pending
- [ ] Technical-architect review (re-run) + tone/docs review (re-run)
- [ ] PR → merge → live verification

## Out of scope (by design)
- Do NOT touch the difficulty crew's picker files (separate branch, mid-build). This track ships the system + adoption pattern; the parent directs adoption after landing.
