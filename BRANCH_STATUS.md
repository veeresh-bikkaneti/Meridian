# BRANCH_STATUS — docs/221-194-observability-sync

**State: in progress (Coordinator B, SecOps & DevOps cluster, 2026-10-26). Owner merges only — do not merge.**
Base: `origin/main dbb83a3` (#225).

## What this branch does

- **#221 (residual only):** most of the stale Phase-1 passages named in
  the issue were already cured on main. This branch fixes what was
  left: the Files-section description of `wrangler.toml` in
  `workers/crash-report/README.md` (it still claimed a commented-out
  KV block "awaiting merge" — the uncommented block with the real
  namespace id is on main via PR #204), two leftover `cf.py`
  references (the current helper is `cf-version.py` and secrets ride
  with a version upload), and the same stale `cf.py` wording in the
  `wrangler.toml` header comment.
- **#221 rider:** handbook ch07 §4 now carries the caveat that
  `smoke:crash` check 4 is a known open failure on the workers.dev
  root, so "(4/4)" is not fully green.
- **#194:** event-type lists synced to the source of truth.
  `docs/observability.md` gains the missing `boot_failure` and
  `tile_failed` rows; handbook ch07 gains `boot_failure`. Both places
  now say plainly: the worker accepts 7 types, the client type lists
  13 (adding `storyteller_shown` and the `narration_*` types), and
  the extra 6 stay client-side.

## Files

- `workers/crash-report/README.md`
- `workers/crash-report/wrangler.toml` (header comment only)
- `docs/observability.md`
- `docs/handbook/07-engineering-and-ops.md`
- `BRANCH_STATUS.md` (this file)

## Gates

- Docs-only change; gate results recorded in the PR / coordinator report.

## Pending

- Panel re-vote on the final tip, then the owner's merge call.
