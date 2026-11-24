# TD-07.3 ratchet the stale caps — status

Branch `chore/td-07.3-ratchet-caps`, based on main `9314c6def54b3a8e66810408048c04f5f7c9cd86` (#606).

## Result

- `LIMITS.noUpwardImport` 129 → 120 and `LIMITS.shellBan` 14 → 10 in `scripts/test-regression-wave.mjs`, matching the live baseline counts on this tip (120 upward rows in `eslint/layer-baseline.json`, 10 shell-ban rows in `eslint/shell-ban-baseline.json`). `LIMITS.noRawIo` stays hard at 0. No cap was raised; the baselines themselves were not edited.
- `scripts/test-regression-wave.test.mjs` fixtures updated: the profile passes at the new caps (120 / 10) and fails at cap+1 (121 / 11), plus the raw-I/O hard-zero checks.
- `docs/handbook/07-engineering-and-ops.md` §4 Crash reporting: the residual current-tense "Pages shell" wording now calls `_shell.html` the static `build:pages` shell. The known-open check-4 failure, the workers.dev root fact, and "do not read (4/4) as fully green" are unchanged. This is the leftover TD-09.2 sentence from #608; `build:pages` remains a documented CI / static-build gate.
