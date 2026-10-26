# BRANCH_STATUS — fix/no-unrememberable-reloads

**Branch:** `fix/no-unrememberable-reloads`
**Base:** `main` at `5f6164b` (includes the PR #247 merge)
**State: READY — independent Reality Checker verdict READY (no
blockers, no majors; two minors: the 5B-E title wording, fixed in
`c80859b`, and the checked dist buildId predating HEAD by
test/docs-only commits, source-identical — a rebuild from final HEAD
at merge time removes the question). The Reality Checker re-ran the
evidence first-hand: unit 41/41 branch + 29/29 baseline, full suite
1576/1576, tsc/lint/worker green, the 3 new E2E journeys 3/3, and
adjudicated both flagged items (5-test rewrite; fresh-page positive
control) as legitimate. The D6
fix (Liz's Option 2 ruling, 2026-10-25): stand down on
unrememberable reloads. Tier 2 council (ATDD → TDD contracts →
adversarial rounds 1–2 → Chair sign-off) complete; manifest at
`~/workspace/meridian-reload-loop-fix/CONSENSUS-MANIFEST-loop-fix.md`.
The branch is LOCAL ONLY — not pushed, no PR, not merged, not
deployed. Slice 2 (crash-report recovery outcomes) is NOT started;
it comes after this fix merges.**
It supersedes the previous contents of this file (the
`feat/crash-report-verdicts` branch record, whose history lives on
PR #247).

## Scope (exactly this)

Design: `meridian-crash-report-verdicts-design-2026-10-25.md` §3.5 F4b;
Slice 2 phase-1 report (BLOCKED, D6) at
`~/workspace/meridian-crash-slice2/REPORT-slice2.md`.

1. **The fix** (`src/lib/chunk-recovery.ts`, in place): at the reload
   decision, the stamp write must persist and read back verified
   (direct storage read, exact value). Storage null, any throw, or a
   mismatch stands recovery down for the rest of the page load — no
   auto-reload for that failure or any later one. Module header states
   the new rule in the council-pinned sentence.
2. **Tests** (`src/lib/chunk-recovery.test.ts`,
   `tests/e2e/chunk-recovery.desktop.spec.ts`, in place): 5 named
   rewrites of tests that pinned the old blocked-storage promise
   (5B, 5B-SRC-U, 5A-U, 5A-U clock leg, 2-U-blocked — the last three
   flagged in the manifest as a brief collision: they pin the same
   old promise through the same path), plus new blocked-mode,
   dangling-stamp, latch, and built-artifact journeys. Every other
   existing test passes unchanged.

Not in scope: Slice 2 (recovery outcomes), observability/worker
changes, any other file. Recorded limitations (manifest §5):
ephemeral-but-readable storage is undetectable from the page;
stand-down is field-unverifiable in this pass; MapErrorBoundary's
"Your game is safe" copy is inaccurate for the storage-blocked cohort
(out of scope here, flagged for separate routing).

## Verification (local, this branch; logs in `~/workspace/meridian-reload-loop-fix/logs/`)

- RED first: unit 24 pass / 17 fail (exactly the 5 rewrites + 12 new
  5C tests); the 3 new E2E journeys failed on the pre-fix artifact at
  `markerGone → true` (the page reloaded under sabotage). Mutations:
  no-read-back fails exactly the 5 predicted tests; no-sticky-latch
  fails exactly latch + heal.
- Gates, branch vs pristine-main baseline (same environment):
  `npx tsc --noEmit` exit 0 / 0 · `node scripts/lint-cards.mjs`
  GATE PASSED / GATE PASSED · `npm test` 1576/1576 / 1564/1564 (the
  delta is exactly the 12 new tests) · `npm run test:worker` 69/69 /
  69/69 · `npm run build:pages` exit 0 / 0.
- Playwright (chunk-recovery + crash-classification + crash-watchdog
  + crash-loop-breaker + observability): branch 20 passed / 2 failed;
  baseline 18 passed / 1 failed (the branch run includes the 3 new
  journeys, all passing). Failures: crash-watchdog "stale build"
  (fails on pristine too — pre-existing) and crash-classification
  "backgrounding" (documented visibility race: isolated re-runs fail
  2/2 on BOTH trees; passed once inside each tree's full-suite
  ordering — see `logs/flake-characterisation.txt`).
