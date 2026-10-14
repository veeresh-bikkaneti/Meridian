SAFE TO MERGE: YES - with the caveats below (squash-merge; the E2E suite has 93 failures in this VM that also fail on main)

# BRANCH_STATUS — claude/hopeful-darwin-dp7ket (PR #148, single working branch)

Owner merges. Folded in: #149 (deps), #150 (tier split). Close those two as "folded into #148".

## Done
- Measurement harness: `scripts/bundle-report.mjs`, `scripts/perf-globe-easy.mjs`, `docs/perf-baseline.md` (baseline, after, final summary).
- Globe tier split: five fame-tier files, loaded per learning path, merged back to canonical order. **Kill switch**: flag `globeTierSplit` (code default `false` = full pool; shipped `true` in `public/flags.json` in its own commit `70fa14c`; revert that one commit to turn it off).
- Fix for a bug found by the Opus review in the first tier-split commit: `Play` could render once with the old band's places and write a never-seen place into the new band's seen store. Keyed load state (`src/game/places-load-key.ts`); regression test `globe-band-switch.desktop.spec.ts` failed 3/3 before, passes now.
- In-run start notice (`run-start-notice.tsx`): offline "Try Medium/Hard" no longer fails silently; status + alert, Try again (reloads), Keep playing, Escape, focus ring.
- 34 unused dependencies removed; unit tests globbed (`src/**/*.test.ts`).
- Reviews: ARCH-REVIEWER and UX-REVIEWER (Opus) - plan review x2, diff review, UX re-review - all APPROVE-WITH-NITS at the end; findings in `docs/ops/reviews/` and the specs.
- Reports: `docs/ops/specs/ws-6-names-json.md`, `docs/ops/specs/ws-6-ios-signals.md`.

## Gates (final code)
tsc clean; `npm test` 772 script + 1,279 src, 0 fail; `node scripts/lint-cards.mjs` GATE PASSED; `npm run build:pages` and `npm run build` ok; `npm run test:worker` 18/18; full Playwright (617): 515 passed / 94 failed / 19 skipped, 93 of the 94 fail identically on a main-equivalent build (Chromium 141 VM), the 94th (`result-card-overflow.mobile:427`) is flaky on both (1 of 3 runs fails on each). 36/36 pass for the new specs + feature-flags + difficulty-picker + cleared-mode with the flag shipped ON.

## Caveats / owner decisions
- Real-device behaviour, GitHub Pages / Cloudflare transfer sizes, iOS: not verified.
- Deferred UX items (owner): nothing explains the picker after "Try again" reloads; the notice covers the result card's hide button at 390px; dark-mode edge.
- Offline: after only playing Easy, Medium/Hard on the Globe need the network (documented in `docs/feature-flags.md`).
- Pre-existing, not fixed: boot effect deletes `meridian.run` on band change; `safari-launch` boot-JS ceiling already red on main; `_shell.html not found post-build` messages for the `/` build.
- `Workers Builds: meridian` (Cloudflare) is red on every PR including main-based ones; real CI (`build (22.x)`) is green.
- WS-4 Phase 1 (satellite failure): implemented. One "Try again", then a visit-only switch to Scout Map (nothing stored); GeoDetective hides the map and keeps the loop going with one line. Spec `docs/ops/specs/ws-4-satellite-failure-phase1.md` (section 12). Gates: tsc clean, npm test 1,295 pass, lint-cards PASSED, build:pages ok, 6 new WS-4 E2E pass (5 were red first), UX review approved the strings. Charter change in `docs/scout-offer-policy.md`.
- Not started (needs your D-decisions or more time): WS-0 test harness (env-var Chromium path, tile fixture), WS-2 social previews, WS-3 Scout toggle in Globe, WS-4 Phase 2 (bundled Earth image) and Phase 3 (Sentinel-2), WS-5 home weight, branch audit.
