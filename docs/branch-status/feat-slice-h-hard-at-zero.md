# Branch status — feat/slice-h-hard-at-zero

## Capsule

TD-07.2 is still open (kanban card `arch-gates.flip`, column
Blocked; no GitHub issue). This slice does not wait for every
baseline to reach 0. One hard-at-zero rule sets every architecture
gauge: a baseline count of 0 is an error and fails CI, and any
count still above zero only warns. The same rule flips a gauge
when its baseline later reaches 0. No gauge is hand-set.

Live counts on this base, unchanged: noRawIo 0, noUpwardImport 129,
shell-ban 14.

## Where the rule lives

- `eslint/hard-at-zero.mjs` — `hardAtZero(count)` and the gauge-to-rule map.
- `eslint.config.mjs` — the one call that turns those counts into severities (`gaugeSeverity`).
- `.github/workflows/node.js.yml` — `lint:nav` and `lint:arch` use that map. A warning does not fail the job (`--max-warnings` is not passed).

## Not in this branch

Raising a baseline. Closing TD-07.2. Hand-flipping one gauge's severity string.
