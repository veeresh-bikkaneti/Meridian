# BRANCH_STATUS — fix/e2e-offline-loop-scenario

- **Branch:** `fix/e2e-offline-loop-scenario` · **Base:** `main` @ `63d8286952b8f3cee8dd80415d3b10c323fb3188`
- **Cluster:** T3 of the PR #340 leftover-failure programme (Consensus Manifest `AUTH_RUN_TDD_IMPLEMENTATION`, §2-T3 incl. condition C-5 and the Chair's header ruling).
- **Task:** Fix the pre-existing E2E failure at `tests/e2e/offline-content.spec.ts:203` — fails identically on pristine main and on PR #340's tip (baseline-matched, not a #340 regression).

## The fix (test/scenario defect — no production code touched)

The :203 test claimed to "warm the chunk cache" but `warmOnline` warms only the app shell; the lazy LoopScreen chunk was never fetched online, so offline it could not load, `MapErrorBoundary` showed its card, and the `GeoDetective` heading the test waits for never rendered.

- **:203 setup replaced** (assertions byte-unchanged): `warmOnline` → open the loop ONLINE via `openLoopViaButton` and wait for the Clue 1 article (chunk provably fetched) → return home via "Editions" + Meridian heading → remove exactly the localStorage keys `meridian.loop.v2` and `meridian.loop.open` (after the return home) → evict every service-worker cache entry whose URL contains `/loop/clues/` → `goOffline` → `openLoopViaButton` → original assertions, strict `expectNoErrors`, no preload exclusion.
- **Setup comment corrected**: warmOnline warms the shell only; the chunk is warmed by the online open; the clue file is evicted; the loop store is reset.
- **File header corrected** (+2/−2, Chair ruling): the over-broad claim that uncached loop content shows the designed offline notice now states the notice shows when the loop chunk was warmed online; unwarmed, the boundary card shows instead.
- **New fence test** immediately after :203 — "offline loop, chunk never warmed: boundary card instead of the offline notice": uses the original never-warmed setup and the home button locator directly (not `openLoopViaButton`). Reload-tolerant assertions in the manner of `chunk-boundary-copy.desktop.spec.ts` (poll for the settled state; the card may reappear after chunk-recovery's single latched reload, ≈11.5s dwell; no first-paint timing claims): alert visible containing "Couldn’t load GeoDetective." (U+2019), Try again button inside the alert, GeoDetective heading count 0, offline headline count 0. Deliberately NO zero-errors assertion (the boundary's `componentDidCatch` logs console errors by design), with a one-line comment saying so.

## Evidence (logs: `~/workspace/meridian-pr340-e2e/logs-gate/t3/`)

- **RED** (`red-203.log`): unmodified :203 test on the main-built artifact — FAIL with the predicted signature: `expect(locator).toBeVisible() failed — getByRole('heading', { name: 'GeoDetective' }), Timeout: 30000ms`.
- **GREEN** (`e2e-green.log`): full `tests/e2e/offline-content.spec.ts` — **6 passed (2.0m)**, `--workers=1` under `flock ~/workspace/.e2e.lock`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE` + `VITE_KOFI_URL` set. Run exit code was 1 despite 6/6 passing: the global `telemetry-spill-teardown` threw "telemetry escaped the E2E stub" over 1 crash-report `/ingest` request that failed while the context was offline. **Pre-existing, not from this fix**: the identical teardown error (same signature) appears in the pristine-main baseline run (`logs-gate/main-baseline-6.log`, 2 escapes) and in this branch's RED run of the unmodified test (`red-203.log`, 3 escapes):
  - :181 shell boots — 9.0s ✓
  - :203 uncached offline notice — 32.2s ✓
  - fence (never warmed) — 12.7s ✓ — wall-clock: the boundary card first satisfied its assertions inside the first poll window (a first satisfaction, not a post-reload observation; the post-reload state is deterministically the same card — chunk still uncached offline, reload latched to one); total test time 12.7s, no first-paint claim made.
  - cached replay — 30.4s ✓ · online no-notice — 18.5s ✓ · offline audio — 14.0s ✓
- **Gates** (all on this branch's tip): `npx tsc --noEmit` PASS (`tsc.log`) · `npm test` PASS — 1021 pass / 0 fail (scripts suite) + 2268 pass / 0 fail (src suite) (`npm-test.log`) · `npm run test:worker` PASS — 145 pass / 0 fail (`test-worker.log`) · `npm run typecheck:worker` PASS (`typecheck-worker.log`) · `node scripts/lint-cards.mjs` — GATE PASSED (`lint-cards.log`) · `npm run build:pages` PASS (`build-green.log`; RED-phase build `build-red.log`) · `npm ci` logged (`npm-ci.log`).

## Known note — :181 / T4 scope

The :181 test in this file may flake with a storyteller-CSS preload console error. That is cluster T4's pre-existing scope (scenario/assertion defect, settled by trace) — NOT fixed here, per the manifest. It did not occur in this branch's GREEN run (:181 passed in 9.0s).

## Merge-time obligation (T3 × T4 seam)

T3 and T4 both edit `tests/e2e/offline-content.spec.ts` (textually disjoint hunks; semantically coupled via `expectNoErrors`). **Whichever branch lands second must re-run the FULL `tests/e2e/offline-content.spec.ts` on the merged result** before that merge is called done.

## State

- Committed locally on `fix/e2e-offline-loop-scenario`; **pushed by the coordinator via GitHub API replay (current head in PIPELINE-STATE.md); no PR opened** (merge not authorized — packages stop at gated, PR-ready per the manifest).
- Files changed: `tests/e2e/offline-content.spec.ts`, `BRANCH_STATUS.md` (this file, this branch's record only, per C-8). Protected files untouched.
