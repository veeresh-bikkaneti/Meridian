# Branch status — fix/e2e-tutorial-tour-names (cluster T1)

- **Branch:** `fix/e2e-tutorial-tour-names`
- **Base:** main `63d8286952b8f3cee8dd80415d3b10c323fb3188`
- **Programme:** pre-existing E2E failure fixes T1–T4 (PR #340 verification gate leftovers). PR #340 itself is not touched by this branch. Per manifest C-8 this file is rewritten wholesale for this branch and describes only this fix.
- **Authorization / manifest:** Council Consensus Manifest, execution token `AUTH_RUN_TDD_IMPLEMENTATION` (§2-T1, incl. Chair rulings and conditions C-2/C-3). MERGE IS NOT AUTHORIZED — this package stops at committed, gated, PR-ready.

## The fix (T1 — tutorial tour accessible-name collision)

Root cause: two visible buttons shared the accessible name "Take the tour" — the invite button and the footer re-entry button (same handler) — so Playwright's role/name locator hit a strict-mode violation (tutorial.spec.ts:125/166/174 on the #340 branch; signature-identical failures on pristine main).

Changes (working diff `src/components/game-app.tsx | 1 +`, `tests/e2e/tutorial.spec.ts` = +3/−1; the manifest footprint said tutorial.spec.ts +5/−1, the difference being the dropped pin below):

1. `src/components/game-app.tsx` — added `aria-label="Take the tour again"` to the footer re-entry button (`data-testid="take-tour-link"`). Visible text unchanged ("🗺️ Take the tour"); invite untouched; handler unchanged. This is the only production edit in the T1 cluster. Trade-off recorded by the Chair (manifest C-1): distinct names remove a screen-reader disambiguation harm; a first-run SR user hears "again" for an untaken tour, mitigated because the footer offer is literally the second appearance of the offer on the same page (P2-11).
2. `tests/e2e/tutorial.spec.ts` —
   - `startTour` click scoped to the invite: `invite(page).getByRole("button", { name: "Take the tour" }).click()`.
   - Two pins in the :102 test: `getByRole("button", { name: "Take the tour again", exact: true })` is visible, and the designated non-vacuous carrier `getByTestId("take-tour-link")` has accessible name "Take the tour again".
   - The contracted exact-count pin (`"Take the tour"` count === 1) was DROPPED by Chair ruling: RED-before evidence (condition C-2, `logs-gate/t1/t1-red-before.log`) showed it passed pre-fix, i.e. non-probative; the testid accessible-name pin necessarily fails pre-fix and carries the proof.

## Verification (2026-11-08, finish run; logs in `~/workspace/meridian-pr340-e2e/logs-gate/t1/finish-*.log`)

Environment: `PLAYWRIGHT_CHROMIUM_EXECUTABLE=$HOME/.cache/ms-playwright/chromium-1243/chrome-linux/chrome`, `VITE_KOFI_URL=https://ko-fi.com/thesaltandpepperguy` (build and test time); E2E `--workers=1` under `flock ~/workspace/.e2e.lock` against the built artifact. `node_modules` was already present in this worktree — no `npm ci` was needed in this run.

| Gate | Result | Log |
|---|---|---|
| `npx tsc --noEmit` | PASS (exit 0) | finish-tsc.log |
| `npm test` | PASS (exit 0) — scripts suite 1021 pass / 0 fail / 11 skipped; src suite 2268 pass / 0 fail | finish-npm-test.log |
| `npm run test:worker` | PASS — 145 pass / 0 fail | finish-test-worker.log |
| `npm run typecheck:worker` | PASS (exit 0) | finish-typecheck-worker.log |
| `node scripts/lint-cards.mjs` | PASS — prints `GATE PASSED` | finish-lint-cards.log |
| `npm run build:pages` | PASS (exit 0) | finish-build-pages.log |
| Playwright `tests/e2e/tutorial.spec.ts` | PASS — 4 passed / 0 failed | finish-e2e-tutorial.log |
| Playwright `tests/e2e/mobile-home-overlap.spec.ts` (neighbour, condition C-3) | 6 passed / 20 failed — see neighbour comparison | finish-e2e-mobile.log |

## Neighbour comparison (mobile-home-overlap, C-3)

- Pristine main baseline (`logs-gate/t1/main-mobile-baseline.log`): **6 passed / 20 failed**.
- This branch: **6 passed / 20 failed**. The 20 failing test titles are **list-identical** to the baseline (verified by diff of the two failure lists) — all in the pre-existing families at spec lines 135 (zero overlapping boxes), 375 (banner zone), 435 (tap targets ≥44px), 511 (greeting speaker target), 619 (offline strip collapse), across 360px/390px × dark/light.
- **Zero new failures vs baseline; no failure outside the baseline families.** These neighbour failures are pre-existing breakage on main (owner-eye item O4 in the pipeline record), not T1 regressions, and are not fixed by this branch.

## Scope compliance

- Touched only the permitted files: `src/components/game-app.tsx` (footer button block only), `tests/e2e/tutorial.spec.ts`, and this file.
- Protected files untouched: `package-lock.json`, `src/game/data/**`, `.scratch/`, `src/lib/observability.ts`, `src/lib/chunk-recovery.ts`, `workers/**`, other worktrees.
- No visible player-facing string changed; the only new string is the aria-label above plus test-internal text.
- Pushed by the coordinator via GitHub API replay (current head in PIPELINE-STATE.md) — not merged, no PR opened; merge remains the owner's word.
