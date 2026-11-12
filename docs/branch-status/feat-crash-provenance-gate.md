# Branch status — feat/crash-provenance-gate

PR 353. Crash-report provenance gate (worker). Root `BRANCH_STATUS.md` stays the integrator copy from main.

## Done

- Slices 1 and 2 landed on this branch: corroborate a real-client crash before paging, and escalate a can't-tell report.
- Council-verdict fixes T1–T6 are in the worker (see `docs/superpowers/plans/2026-11-08-crash-council-fixes.md`). The `*/15` cron stays proposed in `wrangler.toml`; `scheduled()` still dispatches the hourly digest on `event.cron`.
- Merged `origin/main` `2bd5ee96` (PR 424). The only content conflict was root `BRANCH_STATUS.md`. Took main's file. Main's Workers Logs block in `wrangler.toml` stayed, and this branch's cron comment stayed.

## Next

- Owner decides whether to merge PR 353. No deploy.

## Open questions

- Deferred on the branch: v2 diag fields, watchdog, sessionId ruling, DO dedupe.

## Ruled out

- Do not drop the provenance gate to match an older worker.
- Do not mark the `*/15` cron live. It stays proposed until a separately approved release.

## Graph

No nodes. This refresh only merges main and moves the branch record here.
