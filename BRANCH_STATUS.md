# feat/flag-learningoutcomes-on — status

Turn the `learningOutcomes` feature flag ON (Veeresh's explicit call, 2026-10-03).

Base: `origin/main` at `0f0da58` (PR #44, learning-outcomes prototype, shipped dark).

## Done
- [x] Branch + worktree from origin/main; AGENTS.md read
- [x] `public/flags.json`: `learningOutcomes` false → true (`pwaUpdateToast` untouched, `version` untouched)

## Pending
- [ ] Commit + push (named files only: `public/flags.json`, `BRANCH_STATUS.md`)
- [ ] Open PR → merge per standing authorization
- [ ] Verify live `flags.json` serves `"learningOutcomes":true`

## Notes
- Config-only change, no code. Flag-on behavior was E2E-verified in PR #44 (6/6: record per commit, growth line, "My growth", reload persistence, unreachable-flags.json → dark default).
- Flags are boot-time and `flags.json` is network-first: takes effect on next app boot after the Pages deploy, with no client release and no SW-update wait.
- Players will start accumulating learning records and seeing the growth line + "My growth" section from their next boot.
