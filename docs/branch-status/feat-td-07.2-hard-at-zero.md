# Branch status — feat/td-07.2-hard-at-zero

**Task:** TD-07.2 — hard at zero, without weakening the ratchet. `noRawIo` is already `[]` on this tip; the hole was `scripts/test-regression-wave.mjs` still pinning `LIMITS.noRawIo` at 13, which would have let the raw-I/O baseline grow back to 13 rows while the regression profile stayed green.

**What changed:**

- `scripts/test-regression-wave.mjs` — `LIMITS.noRawIo` is now `0`. The baseline is empty and must stay empty: with the cap at 0, any attempt to re-baseline a raw-I/O row (baseline length 1) fails the profile's Architecture lint row even when eslint itself exits 0. `noUpwardImport` (129) and `shellBan` (14) caps are unchanged. Nothing in the eslint configs or package.json was touched, so `--max-warnings 0` stays on `lint:arch` and `lint:nav`, and unbaselined violations still fail those gates as errors.
- `scripts/test-regression-wave.test.mjs` — tests written first and watched fail: the raw-I/O ratchet is hard at zero (`LIMITS.noRawIo === 0`); `archVerdict` fails at `noRawIo` 1 and at the old cap of 13; a one-row raw-I/O baseline fails `runProfile` ("Architecture lint" FAIL, exit 1) even with a passing eslint stub; a green stub run still needs an empty raw-I/O baseline. The `noUpwardImport`-over-cap assertion still proves non-zero gauges keep failing.
- `scripts/layer-rule.test.mjs` — mutation check: a raw `fetch()` outside `src/platform` (injected source, virtual file — no probe committed to `src/`) fires `platform/no-raw-io` with **error** severity, so CI fails rather than warns.

**Ruled out:**

- `eslint/layer-baseline.json`, `eslint/shell-ban-baseline.json` — untouched (shrink-only; no hand-flipped counts; #607 holds the shell baseline).
- `package.json`, `.github/workflows/**` — untouched (held by #606/#601). `--max-warnings 0` is verified still present on both lint scripts.
- No editor-config hook: unbaselined rows already error and the baseline is a per-violation shrink-only multiset, so the profile cap at 0 is the hard floor; hooking the eslint configs would add no pass/fail power while touching shared files.
- `feat/slice-h-hard-at-zero` — untouched (read for ideas only; its `--max-warnings 0` removal, `warn` severities, and `src/lib/zz-hard-at-zero-probe.ts` probe were **not** copied).

**Gates:** recorded in the pull request body.

**Open questions:** none.
