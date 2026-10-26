# BRANCH_STATUS — fix/223-watchdog-byte-budget

**State: in progress (Coordinator B, SecOps & DevOps cluster, 2026-10-26). Owner merges only — do not merge.**
Base: `origin/main dbb83a3` (#225).

## What this branch does (#223)

The crash watchdog's 5120-byte budget was silently broken in
production: the budget test's fixture build id was 10 chars (rendered
exactly 5120), but production ids are 12 chars in CI (5122 bytes) and
14 for the timestamp fallback (5124). Fix, keeping the 5120 budget
(raising it was rejected — the shave is free and the budget guards
bytes inlined into every shell load):

- `scripts/crash-watchdog.mjs`: the embedded-source RENAME map now
  also renames `crashWatchdogMain` → `M` and `CSS` → `G` in the
  shipped output (neither is an object key or property, so this is
  semantics-preserving; `buildId` was deliberately NOT renamed — it
  is a payload key). Measured after: 7-char 5097, 10-char 5100,
  12-char 5102, 14-char 5104 bytes.
- `scripts/crash-watchdog.test.mjs`: the budget test now renders all
  four real build-id lengths instead of only the 10-char fixture.
- `docs/reviews/2026-10-21-remaining.md`: the stale "5118 bytes" line
  corrected to the measured values, with the reasoning recorded.

## Files

- `scripts/crash-watchdog.mjs`
- `scripts/crash-watchdog.test.mjs`
- `docs/reviews/2026-10-21-remaining.md`
- `BRANCH_STATUS.md` (this file)

## Gates

- `node --test scripts/crash-watchdog.test.mjs` — 42/42 pass.
- Full gates recorded in the PR / coordinator report.

## Pending

- Panel re-vote on the final tip, then the owner's merge call.
