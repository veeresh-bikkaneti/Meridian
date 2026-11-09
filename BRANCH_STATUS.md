# BRANCH_STATUS — fix/e2e-offline-preload-assertion

- **Branch:** `fix/e2e-offline-preload-assertion` · **Base:** `main` @ `63d8286952b8f3cee8dd80415d3b10c323fb3188`
- **Cluster:** T4 of the PR #340 leftover-failure programme (CONSENSUS-MANIFEST §2-T4, incl. condition C-6 and Chair ruling C-7).
- **Execution token:** `AUTH_RUN_TDD_IMPLEMENTATION`
- **Merge:** NOT authorized. This branch stops at committed, gated, PR-ready.

## Task capsule

TASK / requested outcome: fix the flaky zero-console-errors failure in
`tests/e2e/offline-content.spec.ts` test at (main) :181 — "offline: app
shell boots from cache, no dead error page" — with a NARROW exclusion for
exactly one manufactured console message at exactly one call site.

Defect (settled by trace evidence, manifest §2-T4): the storyteller CSS
is first requested only during the test's own offline reload and fails
`net::ERR_INTERNET_DISCONNECTED` by the test's own choreography; the
shell boots fully styled; `vite:preloadError` console visibility is BY
DESIGN (`src/lib/chunk-recovery.ts:769–771` deliberately does not
preventDefault). Class: scenario/assertion defect. The app is unchanged.

Tier and rationale: Tier 2 council programme — fix applied exactly as
the signed Consensus Manifest contracts it. No production code touched.

Files in scope: `tests/e2e/offline-content.spec.ts` (expectNoErrors
block + the :181 call site only) and this file. Protected and untouched:
`package-lock.json`, `src/game/data/**`, `.scratch/`, other worktrees,
`src/lib/chunk-recovery.ts`, `workers/**`.

## The fix

In `tests/e2e/offline-content.spec.ts`:

1. New constant `STORYTELLER_CSS_PRELOAD_RE` + explanatory comment above
   `expectNoErrors`. It matches ONLY sink entries of the form
   `console: Error: Unable to preload CSS for <APP_URL>assets/storyteller-<hash>.css`
   followed by whitespace-or-end (`(\s|$)` — the real entry carries a
   trailing stack line). The origin is built from the spec's existing
   `APP_URL` constant (regex-escaped), NOT a second hardcoded literal;
   the hash segment is the only wildcard: `[A-Za-z0-9_-]+`.
2. `expectNoErrors(sink, opts?)` gains ONE filter clause gated on
   `opts.allowStorytellerCssPreload`, alongside the existing #418 /
   Failed-to-load-resource / AJAXError exclusions (same precedent
   pattern).
3. ONLY the :181 test's call site opts in:
   `expectNoErrors(sink, { allowStorytellerCssPreload: true })`.
   All other call sites (main :238/:274/:295/:330) are byte-unchanged
   and still reject the message. Per Chair ruling C-7, the audio test
   (main :298) does NOT get the opt-in — no observed failure there;
   fail-first discipline.

Why this is not weakening a gate: the :181 test's functional assertions
(shell heading + sound toggle visible) run before `expectNoErrors` and
still must pass, so a genuinely broken shell still fails; the exclusion
removes exactly one message, one asset, one call site. Residual risk
(manifest C-6): within :181 the predicate cannot distinguish an
offline-induced failure from a genuinely missing storyteller CSS —
accepted only because the asset's existence in dist is independently
verified (this run's build produced
`dist/client/assets/storyteller-BiTY_7BJ.css`, 3.0K) and all other call
sites still reject the message.

## Predicate demonstration (condition C-6, done before claiming green)

Throwaway node script (NOT committed):
`~/workspace/meridian-pr340-e2e/logs-gate/t4/predicate-demo.mjs`,
output: `~/workspace/meridian-pr340-e2e/logs-gate/t4/predicate-demo.log`.

- POSITIVE — verbatim sink entry extracted from
  `logs-gate/main-181-runC.log` (also `leftover-run.log`):
  `console: Error: Unable to preload CSS for http://127.0.0.1:4123/Meridian/assets/storyteller-BiTY_7BJ.css`
  + trailing stack line → **match = true** ✓
- NEGATIVE — `styles-*.css` preload message → match = false ✓
- NEGATIVE — `storyteller-*.js` preload message → match = false ✓
- NEGATIVE — `pageerror:`-prefixed variant → match = false ✓

Result: **PREDICATE DEMO: PASS**

## Verification (this branch, built artifact, env: VITE_KOFI_URL + PLAYWRIGHT_CHROMIUM_EXECUTABLE set)

Logs: `~/workspace/meridian-pr340-e2e/logs-gate/t4/`

| Gate | Result | Log |
| :--- | :--- | :--- |
| `npm ci` | PASS (exit 0, 365 packages) | `npm-ci.log` |
| `npx tsc --noEmit` | PASS (exit 0) | `tsc.log` |
| `npm test` | PASS — 2268 pass / 0 fail | `npm-test.log` |
| `npm run test:worker` | PASS — 145 pass / 0 fail | `test-worker.log` |
| `npm run typecheck:worker` | PASS (exit 0) | `typecheck-worker.log` |
| `node scripts/lint-cards.mjs` | PASS — GATE PASSED | `lint-cards.log` |
| `npm run build:pages` | PASS (exit 0) on re-run — see note | `build-pages-rerun.log` |
| Playwright `offline-content.spec.ts` --workers=1 under flock | 4 passed / 1 failed (the 1 = pre-existing T3 scope, below) | `playwright-offline-content.log` |

Build note: the first `build:pages` attempt was OOM-killed during
prerender (exit 137, `build-pages.log`) while the T1/T2/T3 workers were
building concurrently on the same VM — environment contention, not this
change (this branch edits a test file only). The single evidenced-flake
re-run passed clean (exit 0, prerender complete, `_shell.html` written).

Playwright detail (5 tests in file):
- :181 test (now :201) "offline: app shell boots from cache" — **PASS**.
  The test is flaky by nature: what the fix guarantees is that IF the
  storyteller-CSS message appears it is now excluded, while the
  functional assertions still run.
- Cached-loop, online-loop, and audio tests — **PASS** (audio passes
  without the opt-in, as C-7 requires).
- One teardown error ("telemetry escaped the E2E stub", 2 requestfailed
  escapes) appears in the run — it also appears in
  `logs-gate/main-baseline-6.log` on pristine main: pre-existing,
  unrelated to this change.

## Pre-existing / out of scope (NOT a T4 regression)

- The :203 test ("offline loop, uncached: exact offline headline…", now
  :223) still **fails with the GeoDetective heading-timeout signature**
  (30s, in `openLoopViaButton`). That is cluster **T3's pre-existing
  scope** (branch `fix/e2e-offline-loop-scenario`), named here per the
  manifest verification matrix — not fixed in this branch, not a T4
  regression.

## Merge-time obligation (T3 × T4 seam)

T3 and T4 both edit `tests/e2e/offline-content.spec.ts` (textually
disjoint hunks; semantically coupled via `expectNoErrors`). **Whichever
branch lands second must re-run the FULL `offline-content.spec.ts`
file on the merged result** and record it.

## Latent risk recorded (owner-eye item O3)

The audio test (main :298) shares the `goOffline → reload` choreography
and the same armed storyteller-CSS race. Per Chair ruling C-7 it does
not get the opt-in without an observed failure; a future flake there is
diagnosed by the manifest (one-line opt-in pre-designed), not a new
mystery.
