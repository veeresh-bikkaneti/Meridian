# BRANCH_STATUS — fix/234-crash-worker-dev-boot

**State: in progress (Coordinator B, SecOps & DevOps cluster, 2026-10-26). Owner merges only — do not merge.**
Base: `origin/main dbb83a3` (#225).

## What this branch does (#234)

`npx wrangler dev -c wrangler.toml` in `workers/crash-report` could
not boot: workerd validates every named export of the entry module
as a handler, and `src/index.ts` exports plain constants
(`ANOMALY_MIN_COUNT = 3`, plus seven more primitives and several
arrays) alongside the handler for its unit tests — the boot died on
the alphabetically first one. De-exporting them one by one would be
whack-a-mole and would break the tests that import four of them.

Fix (structural, local-dev only):

- New `workers/crash-report/src/dev-entry.ts`: a thin wrapper that
  re-exports only the default handler.
- `wrangler.toml`: `main` now points at `src/dev-entry.ts`, with a
  comment explaining why. Production never reads this file — a
  release bundles `src/index.ts` directly and uploads it through
  the API (README, "The release, step by step"), so production is
  untouched.
- README Files section documents the wrapper.

## Files

- `workers/crash-report/src/dev-entry.ts` (new)
- `workers/crash-report/wrangler.toml` (`main` + comment)
- `workers/crash-report/README.md` (Files section)
- `BRANCH_STATUS.md` (this file)

## Gates

- `npm run test:worker` — 42/42 pass.
- `npm run typecheck:worker` — clean.
- Boot proof (pinned wrangler from the worker's own `npm install`):
  `npx wrangler dev -c wrangler.toml` → "Ready on
  http://localhost:8787", `GET /health` → `{"ok":true}`,
  `POST /ingest` (README's example) → `{"ok":true,...}`; zero
  ANOMALY / "Incorrect type" errors in the log.
- Full root gates recorded in the PR / coordinator report.

## Pending

- Panel re-vote on the final tip, then the owner's merge call.
