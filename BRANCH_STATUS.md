# BRANCH_STATUS — feat/crash-recovery-outcome

**Branch:** `feat/crash-recovery-outcome`
**Base:** `main` at `bce7f15` (includes Slice 1, PR #247, and the D6
loop fix, PR #249)
**State: Slice 2 BUILT + gates run (2026-10-26).** Built under the
signed Tier 2 Consensus Manifest
(`~/workspace/meridian-crash-slice2/CONSENSUS-MANIFEST-slice2-build.md`),
including ADDENDUM 2 (Liz's Option A ruling, 2026-10-26).
**Not pushed, no PR, not merged, not deployed. Slice 3 not started.**

## Option A harness amendment (Liz, 2026-10-26)

The fake harness's write counting is scoped PER KEY
(`calls.setByKey` alongside the global counter; `countingThrowingStorage`
and the 2-U default-host stub gained the same per-key counts). ONLY the
counter expressions changed in exactly these 7 pre-existing tests —
every behavioural assertion byte-identical, no assertion weakened or
removed:

- `1-U`, `10-U`, `2-U`, `7-U` (×2 lines), `5C-U-roundtrip` — stamp pins
  now count writes to `meridian.chunkReloadAt` (expect 1).
- `6-U` — stamp pin counts `meridian.chunkReloadAt` (expect 0).
- `5C-U-offer` (×2 lines) — stamp pins count `meridian.chunkReloadAt`
  via `setsByKey` (expect 0 at the offer, 1 after the blocked failure).

Diff proof: `~/workspace/meridian-crash-slice2/logs2/optionA-test-diff.txt`.
Chunk suite after the amendment: **55/55** (41 pre-existing as amended
+ O1–O14).

## What Slice 2 built

- **chunk-recovery** (WIP `bad9f8a`, pre-existing this session): outcome
  marker `meridian.chunkRecovery`, pending-at-install state machine,
  observation-time terminal signals, pending-only clear countdown,
  optional host outcome hooks.
- **observability**: `init()` marker protocol in manifest order
  (terminal delete-silent; invalid split with `meridian.chunkReloadAt`
  corroboration → `marker_unreadable`; >24 h → `unconfirmed_expired`;
  claimed leftover → `unconfirmed_died` (+ `afterRecovery` on this
  boot's `suspected_crash`) / `unconfirmed_closed`, delete-before-emit;
  unclaimed → claim by spread + read-back, hold pending).
  `noteRecoverySignal` + singleton wrapper (GameApp's wiring target);
  confirmation legs latched in the closure (`gameLoaded` set inside
  `recordMilestone`); resolve = delete marker, set resolved, emit
  exactly once. `afterRecovery` choke point at `emit()` for
  captured-error types while pending+unresolved (never stamped false,
  not a classifier input). `recovery_outcome` added to the event-type
  union and protected in queue eviction. Classifier gains the
  `recovery_outcome` branch FIRST; `CLASSIFIER_VERSION` "1" → "2".
  Marker validity predicate identical to chunk-recovery's,
  fixture-tested in both test files.
- **Worker** (`workers/crash-report`): `EVENT_TYPES` +=
  `recovery_outcome` (the only schema change; no enum hard-validation —
  classifier + `tierOf` fail closed). `tierOf(type, recoveryOutcome?)`:
  crash-class ONLY for `repeat_failure`, counted-only otherwise;
  `handleRequest` passes the outcome. Classifier mirror + the five
  manifest why-lines verbatim. The Slice 1 `recovery_outcome` rejection
  pin was INVERTED to acceptance (expected evolution). No digest change
  (Slice 3 owns it).
- **GameApp wiring** (install call site only):
  `installChunkLoadRecovery(undefined, { buildId: CURRENT_BUILD_ID,
  onRecoverySignal })` routing signals to observability's
  `noteRecoverySignal` singleton wrapper.
- **E2E** (appended to `tests/e2e/chunk-recovery.desktop.spec.ts`,
  built artifact via `serveBuiltArtifact`, production path): S2-E1
  recovered/confirmed, S2-E2 repeat_failure, S2-E3 stood_down, S2-E4
  storage-blocked, S2-E5 leftover claimed+clean, S2-E6 leftover
  claimed+unclean (+afterRecovery), S2-E7 no-marker control — all pass.
- Consequential pin updates (same category as the worker inversion):
  stamped-`lcV` expectations "1" → "2" in `observability.test.ts` (5)
  and `crash-classification.mobile.spec.ts` (3) — the mechanical result
  of the mandated `CLASSIFIER_VERSION` bump. One tsc fix in the WIP
  O9-U test (annotated map param; assertion unchanged).

## Gates on the final head (logs `~/workspace/meridian-crash-slice2/logs2/final-*`)

- `npx tsc --noEmit` — clean
- `npm test` — scripts 832 pass / 0 fail (841, 9 skipped); src 1633/1633
  (pristine-base baseline: scripts 832/0, src 1592/1592)
- `npm run test:worker` — 85/85 (baseline 69/69)
- `node scripts/lint-cards.mjs` — GATE PASSED
- `npm run build:pages` — green
- Playwright crash-surface set (chunk-recovery.desktop,
  crash-classification.mobile, crash-watchdog, crash-loop-breaker,
  observability) — **27 passed / 2 failed**. Both failing names match
  the pristine-base baseline's two known failures:
  (1) crash-classification "backgrounding the tab records
  'backgrounded'; returning records 'foregrounded'" (visibility race,
  same mode as baseline);
  (2) crash-watchdog "stale build" — SAME test name as the baseline
  failure, but the first failing assertion differs: on this branch the
  spec's `ingested` length-1 pin trips earlier because the stale-build
  journey now also emits the designed Slice 2 `recovery_outcome`
  (stood_down) alongside the js_error; on pristine base the length
  assertions passed and the test failed later on the milestone race.
  The watchdog spec was NOT edited (outside the manifest's file list) —
  updating its exact-count pin to expect the stood_down outcome is a
  coordinator/Liz call.

## Not built / not tested

- Slice 3 (digest grouping, alerting policy §5.6, signature counters)
  — not started, per authorization.
- No push, no PR, no merge, no deploy. Worker deploy-order note for the
  eventual PR: the receiver whitelist must deploy BEFORE or WITH the
  client emitter, never after, or outcome events are 400-rejected.
