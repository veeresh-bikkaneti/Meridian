# Branch status — fix/296-idle-kill-locator

- **Branch:** `fix/296-idle-kill-locator`
- **Base:** `main` @ `2a0527f` (#295 merged)

## Task capsule

TASK / requested outcome: For issue #296 (Meridian issue-clearing wave,
PR W4) — make `tests/e2e/scout-notice-session-end.desktop.spec.ts` pass
on current main by scoping its idle-kill text lookup into the visible
discarded-notice card, prove it with a green solo E2E run, and open
the PR. Test-only fix; product code does not change.

Tier and rationale: Tier 1 — one bug, one file, clear repro (diagnosis
below matched the coordinator's sealed failure signature exactly).

Done condition / evidence: diagnosis reproduced solo on unmodified
main (1 failed / 1 passed, the failure being the strict-mode violation
on the idle-kill text); after the fix the same spec solo = 2/2 pass;
PR opened against main. NO MERGE — merging is the owner's step.

Files in scope: `tests/e2e/scout-notice-session-end.desktop.spec.ts`
(one locator) + this file. Out of scope: product code, and the same
bare-text pattern in other specs (listed in the PR body, not fixed here).

## What changed and why

- At spec:90 the idle-kill assertion used a bare
  `page.getByText("Your game ended after 2 minutes of inactivity.")`.
  Since PR #287 the same text also lives in the sr-only announcer
  (`data-testid="discarded-notice-announcer"`, `role=status`), so the
  bare lookup resolves to 2 elements and Playwright strict mode fails
  it — even though the visible notice renders correctly.
- Fix: scope the lookup into the visible card —
  `page.getByTestId("discarded-notice").getByText("Your game ended after 2 minutes of inactivity.")`.
  No `.first()` band-aid, no assertion weakened: the test still proves
  the visible idle-kill notice is shown, then
  `map-switched-notice` count 0 and phase no longer `aim`.

## Evidence (sealed: `~/workspace/meridian-issue-wave/evidence/296/`)

- [x] Diagnosis on unmodified main: `build-pages-before.log` /
  `.exit` (=0); `e2e-before.log` / `e2e-before.exit` (=1) —
  **1 failed, 1 passed**; the single failure is the strict-mode
  violation at spec:91 (2 elements: `discarded-notice-announcer` +
  the visible card's paragraph), matching
  `evidence/verify/e2e-pins.log` on main `2a0527f`.
- [x] After the fix: `e2e-after.log` / `e2e-after.exit` (=0) —
  **2 passed**.
- [x] Redundancy / other-instances grep: `redundancy-grep.log` —
  grep for the exact idle-kill string across `tests/e2e/`. See PR body
  for the full list; only this spec is fixed in this PR.

## Status

- [x] Diagnosis reproduced and sealed
- [x] Scoped locator fix (visible card only)
- [x] Solo E2E green (2/2), sealed
- [x] PR opened against main (For #296, not closing it)
- [ ] Panel review — separate stage, run by the coordinator
- [ ] Merge — owner's explicit per-PR word only
