# BRANCH_STATUS — fix/no-unrememberable-reloads

**Branch:** `fix/no-unrememberable-reloads`
**Base:** `main` at `5f6164b` (includes the PR #247 merge)
**State: MANIFEST SIGNED — the D6 fix (Liz's Option 2 ruling,
2026-10-25): stand down on unrememberable reloads. Tier 2 council
(ATDD → TDD contracts → adversarial rounds 1–2 → Chair sign-off)
complete; manifest at
`~/workspace/meridian-reload-loop-fix/CONSENSUS-MANIFEST-loop-fix.md`
(execution token issued). Build in progress: RED → GREEN → gates →
independent Reality Checker gate. The branch is LOCAL ONLY — not
pushed, no PR, not merged, not deployed. Slice 2 (crash-report
recovery outcomes) is NOT started; it comes after this fix merges.**
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

## Verification (local, this branch)

- Baseline (pristine main @ 5f6164b, same environment, logs in
  `~/workspace/meridian-reload-loop-fix/logs/`): chunk-recovery unit
  suite 29/29 (coordinator's own run before any change). Full gate
  baseline + branch numbers are recorded here when the gate run
  completes.
