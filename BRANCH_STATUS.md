# BRANCH_STATUS — fix/e2e-watchdog-milestone-assertion

- **Branch:** `fix/e2e-watchdog-milestone-assertion` · **Base:** `main` @ `63d8286952b8f3cee8dd80415d3b10c323fb3188`
- **Cluster:** T2 (pre-existing E2E failures surfaced by PR #340's verification gate; PR #340 itself untouched)
- **Manifest:** `~/workspace/meridian-pr340-e2e/CONSENSUS-MANIFEST.md` §2-T2 (incl. condition C-4), scope §3, verification §4
- **Execution token:** `AUTH_RUN_TDD_IMPLEMENTATION`
- **Merge:** NOT authorized — this branch stops at committed, gated, PR-ready (no PR opened, not pushed by the builder).

## Task capsule

TASK / requested outcome: fix the `crash-watchdog.spec.ts:164` test defect —
its `lastMilestone === "data_chunk_load_start"` assertion fails on pristine
main and on PR #340's tip because `recordMilestone`
(`src/lib/observability.ts:1451–1471`) is last-write-wins and a menu remount
legitimately records `storyteller_ready` after the chunk milestone.

Tier and rationale: Tier 2 council programme (signed Consensus Manifest);
this branch is the T2 execution slice — one test, test-only change.

Done condition / evidence: RED signature reproduced on the unmodified tree;
after the fix, the breadcrumb HISTORY assertion passes and all 5
crash-watchdog tests pass; all §4 gates green (below).

Files in scope: `tests/e2e/crash-watchdog.spec.ts` (the :164 test block
only) + this file. Protected and untouched: `package-lock.json`,
`src/game/data/**`, `.scratch/`, other worktrees, `src/lib/observability.ts`,
`src/lib/chunk-recovery.ts`, `workers/**`, and the other 4 tests in
`crash-watchdog.spec.ts` (byte-untouched, incl. the seeded-trail test whose
`lastMilestone` assertion covers a previous session's trail — the
crash-report contract is preserved there).

## The fix

In the :164 test only:

- Prose comment reworded: the breadcrumb trail "still carries
  `data_chunk_load_start` in its history" (no longer claims it via
  `lastMilestone`).
- Read/assert block replaced: parse the breadcrumb JSON, map its `history`
  entries to names, and assert (1) the trail is non-null; (2)
  `indexOf("data_chunk_load_start") >= 0`; (3) per C-4 exists-after
  semantics — `lastIndexOf("storyteller_ready") === -1` OR
  `lastIndexOf("storyteller_ready") > indexOf("data_chunk_load_start")`
  (`storyteller_ready` also occurs at boot, so a first-occurrence check
  would false-red).
- The `lastMilestone` equality is deleted, with a comment stating why
  (recordMilestone last-write-wins; a `storyteller_ready` lastMilestone is
  explicitly not a failure).
- Diff: `tests/e2e/crash-watchdog.spec.ts` +17/−6, hunks confined to the
  :164 test.

Known caveat (manifest, not loosened for): MAX_HISTORY=12 eviction cannot
trigger on this test's choreography.

Owner-eye item O1 (recorded in the manifest, NOT fixed here): a cosmetic
mascot milestone (`storyteller_ready`) can overwrite a crash-diagnostic
milestone in breadcrumb `lastMilestone`, degrading what a later
`suspected_crash` reports — an owner/architecture ruling on
diagnostic-vs-cosmetic milestone precedence is still owed.

## RED evidence (unmodified tree)

- `npm ci` — exit 0 (365 packages).
- `npm run build:pages` — PASS on retry (`logs-gate/t2/red-build2.log`,
  `_shell.html` produced). First attempt (`red-build.log`) was OOM-killed
  during prerender while three sibling branches built in parallel —
  environment contention, evidenced by the OOM kill + successful retry.
- Playwright, only the :164 test, `--workers=1` under
  `flock ~/workspace/.e2e.lock` (`logs-gate/t2/red-164.log`):
  **1 failed** — `expect(crumbMilestone).toBe("data_chunk_load_start")`
  at :224, Received: `"storyteller_ready"`. Exact predicted signature.

## GREEN evidence (after the fix)

All runs with `VITE_KOFI_URL=https://ko-fi.com/thesaltandpepperguy` and
`PLAYWRIGHT_CHROMIUM_EXECUTABLE=$HOME/.cache/ms-playwright/chromium-1243/chrome-linux/chrome`;
logs in `~/workspace/meridian-pr340-e2e/logs-gate/t2/`:

- `npx tsc --noEmit` — PASS, exit 0 (`tsc.log`)
- `npm test` — PASS, exit 0 (`npm-test.log`): scripts suite 1032 tests
  (1021 pass, 11 skipped, 0 fail); src suite 2268/2268 pass, 0 fail
- `npm run test:worker` — PASS, 145/145, 0 fail (`test-worker.log`)
- `npm run typecheck:worker` — PASS, exit 0 (`typecheck-worker.log`)
- `node scripts/lint-cards.mjs` — PASS, prints `GATE PASSED` (`lint-cards.log`)
- `npm run build:pages` — PASS, exit 0, prerender 1 page (`build-green.log`)
- Playwright `tests/e2e/crash-watchdog.spec.ts` (all 5 tests),
  `--workers=1` under flock — **5 passed, 0 failed** (`playwright-green.log`)

## Status

- [x] RED confirmed on unmodified tree (exact signature)
- [x] Fix applied per manifest §2-T2 + C-4 (one cure pass, first-try GREEN)
- [x] All §4 verification gates PASS
- [ ] Push / PR / merge — NOT authorized; coordinator's / owner's word only
