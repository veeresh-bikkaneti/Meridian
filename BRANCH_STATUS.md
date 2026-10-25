# BRANCH_STATUS — feat/crash-report-verdicts

**Branch:** `feat/crash-report-verdicts`
**Base:** `main` at `28c5fea` (includes the PR #245 merge)
**State: BUILD COMPLETE — all gates run, independent Reality Checker
gate pending. State below is the coordinator's record, not a verdict.
The branch is LOCAL ONLY — not pushed, no PR, not merged, not deployed
(Liz's authorization 2026-10-25 covers Slice 1 build + local commits only;
the parent replays via the GitHub API helper after the independent gate).**
It supersedes the previous contents of this file (the
`fix/chunk-load-recovery` branch record, whose history lives on PR #245).

## Scope (exactly this — Slice 1 of the crash-report verdicts design)

Design: `meridian-crash-report-verdicts-design-2026-10-25.md` §6 Slice 1
(A1+A2+A3). Reader wording: Liz-approved samples 2026-10-25
(✅ IGNORE — No action needed / 🔧 IGNORE — Fixed itself (confirmed) /
🚨 FIX — Developer action needed / ❔ WAIT — Can't tell from this report).
Consensus Manifest: `~/workspace/meridian-crash-verdicts/CONSENSUS-MANIFEST-slice1.md`
(signed, execution token issued; Councilor C's CHALLENGE resolved by the
manifest's binding constraints, none waived).

1. **Client stamps** (`src/lib/observability.ts`, in place): a pure
   classifier `classifyCrashVerdict(facts) → { verdict, whyKey }` plus
   evidence stamps — `bgTerminal` / `buildReplaced` / `trailStuck`
   (booleans, `suspected_crash` only, derived at `init()` from the stored
   trail before any payload trimming), `storageOk` (boolean, every event,
   at the single `emit()` choke point) and `lcV` (classifier version
   string, every event). Crash-class events also carry the client's
   provisional `verdict` / `whyKey`.
2. **Worker verdicts** (`workers/crash-report/src/index.ts`, in place):
   the mirrored classifier re-derives the verdict from the stamped facts
   at ingest (a client-stamped verdict is never rendered), and
   `buildAlert` renders verdict line first (Discord), verdict in the
   email subject, verdict + why in the email body, `action:` line on
   developer-needed only, existing fields kept below with "last step"
   wording and plain-language last-step values.
3. **Tests**: classifier table on both sides (trail shapes A–F +
   precedence + fail-closed missing fields + never `auto_fixed` in
   Slice 1), stamp tests through the real `createObservability`
   init/emit path, cap-survival, worker rendering/subject/banned-word
   tests, and a Playwright journey in
   `tests/e2e/crash-classification.mobile.spec.ts` (backgrounded kill →
   next boot → emitted `suspected_crash` carries the stamps).

Not in scope (later slices, not built here): no new event type
(`recovery_outcome` stays rejected), no recovery marker, no
`afterRecovery` stamp, no digest regrouping, no alerting-policy change,
no signature counters, no KV TTL, no build-currency fetch. `auto_fixed`
is structurally unreachable in Slice 1 — Slice 1 renders three verdicts.

Known limitations carried from the design (§3.5): a fully storage-blocked
session emits no `suspected_crash` at all, so `storageOk` cannot size
that blind spot (F4); the worker's re-derivation is a consistency check
over client-stamped facts, not independent verification (F9); verdict
mismatch surfacing is Slice 3, not Slice 1.

## Verification (local, this branch)

- Baseline (pristine main @ 28c5fea, same environment, logs in
  `~/workspace/meridian-crash-verdicts/logs/baseline/`): tsc clean;
  npm test scripts 832 pass / 0 fail, src 1539/1539; worker 42/42;
  lint-cards GATE PASSED; build:pages green; crash E2E specs 7 passed /
  1 failed — `crash-watchdog.spec.ts` "stale build" spec fails on
  pristine main too (pre-existing, not a Slice 1 regression).
- Branch numbers (logs in `~/workspace/meridian-crash-verdicts/logs/branch/`):
  tsc clean; npm test scripts 832 pass / 0 fail (identical to baseline),
  src 1563/1563 (1539 baseline + 24 new Slice 1 tests); worker 69/69
  (42 baseline + 27 new); lint-cards GATE PASSED; build:pages green —
  the built entry bundle contains the `bgTerminal` stamp and the
  classifier why-keys. Playwright (built artifact, crash surfaces):
  11 passed / 2 failed. Both failures are baseline-matched: the
  crash-watchdog "stale build" spec fails on pristine main in the same
  environment, and the crash-classification visibility spec fails solo
  on a pristine-main worktree build with the identical signature
  (`storyteller_ready` races past `backgrounded` — it passed in the
  first baseline batch run, failed in the RED run on the baseline
  artifact, and fails on pristine main solo; pre-existing timing race,
  untouched code path). The 2 new Slice 1 stamp journeys pass.

## Push status

LOCAL ONLY. Not pushed, no PR opened, not merged, not deployed — per
Liz's Slice 1 authorization. (The repo convention "push early and often"
is overridden here by the owner's explicit instruction for this branch.)
