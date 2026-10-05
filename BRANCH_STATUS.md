# BRANCH_STATUS.md — fix/ci-runner-resilience

**Branch:** `fix/ci-runner-resilience` off `origin/main` @ `0aeac14`
**Worktree:** `~/workspace/ci-runner-fix` (fresh; sibling worktrees untouched)
**Mission:** Harden CI against the 2026-10-05 runner-capacity incident
(runs #37371985732 / #37371985856 cancelled after ~15 min queued:
"The job was not acquired by Runner of type hosted even after multiple attempts").
Veeresh merges.

## Done
- [x] Root-cause review (gh timelines + annotations + workflow read)
- [x] Pin runner image ubuntu-latest → ubuntu-24.04 (both workflows)
- [x] Add timeout-minutes (node.js.yml 20, pages.yml 15, watchdog 10)
- [x] New scheduled watchdog workflow + scripts/ci-watchdog.sh
- [x] Validation: YAML parse, bash -n, dry-run vs incident runs

## Pending
- [ ] BLOCKED: push rejected — OAuth token lacks `workflow` scope
  ("refusing to allow an OAuth App to create or update workflow
  `.github/workflows/ci-watchdog.yml` without `workflow` scope").
  SSH is proxy-blocked. Need Veeresh to run `gh auth refresh -s workflow`
  (or equivalent approved scope grant), then push + open PR.
- [ ] Push branch + open PR (target main) — NEVER merge; Veeresh merges
- [ ] Branch CI green on the PR

## Rules
- Stage named files only. Push early and often.
- No new third-party actions (gh CLI + built-ins only). No secrets.
- Watchdog never re-runs genuine code failures (see script guards).
