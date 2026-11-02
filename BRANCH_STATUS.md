# Branch status — fix/303-idle-kill-locators

- **Branch:** `fix/303-idle-kill-locators`
- **Base:** `main` @ `2a0527f` (#295 merged; tip re-read from origin at build start, 2026-11-02)

## Task capsule

TASK / requested outcome: For issue #303 (Meridian issue-clearing wave,
Wave 2 pilot) — the two E2E specs that still use the bare
`page.getByText("Your game ended after 2 minutes of inactivity.")`
idle-kill lookup get the same scoped-locator cure PR #302 applied for
#296, IF they hit the same collision. Open the PR. Test-only fix;
product code does not change.

Interpretations considered and selected reading: issue #303's own
step 1 governs — reproduce first on unmodified main; if a spec
collides, scope it; if it passes, record why instead of changing it.
Both specs' idle-kill flows go through the in-page idle kill
(`killIdleSession` in `src/components/game-app.tsx`), which sets the
discarded notice (reason "inactivity") — the code path whose sr-only
announcer duplicates the visible card's text — so a collision is
expected in both; the sealed solo runs below are the proof, not this
reasoning.

Tier and rationale: Tier 1 — one known defect pattern, two spec files,
clear repro inherited from #296 / PR #302.

Done condition / evidence: before-runs of both specs' idle-kill tests
sealed on unmodified main; after the fix both full spec files pass
solo; all repo gates sealed (tsc · npm test · test:worker ·
lint-cards · build:pages); PR opened against main. NO MERGE, no QA
silo, no panel in this stage — those are separate coordinator stages.

Files in scope: `tests/e2e/scout-false-demotion.desktop.spec.ts` +
`tests/e2e/session-score.spec.ts` (one locator each) + this file.
Out of scope (FORBIDDEN): product code, PR #302's spec and branch
(frozen), any other PR, branch protection.

## What changed and why

- Both specs DID collide — reproduced solo on unmodified main, each
  with #296's exact strict-mode signature (bare lookup resolves to 2
  elements: the sr-only `discarded-notice-announcer` + the visible
  `discarded-notice` card's paragraph). Both flows use the in-page
  idle kill, which sets the discarded notice (reason "inactivity").
- Fix, identical in form to PR #302's cure: scope each lookup into
  the visible card —
  `page.getByTestId("discarded-notice").getByText("Your game ended after 2 minutes of inactivity.")`
  — plus the same in-spec comment recording why it is scoped.
  No `.first()` band-aid, no assertion weakened, no timeout changed
  (both specs keep their original default `toBeVisible()` wait).

## Evidence (sealed: `~/workspace/meridian-issue-wave/evidence/303/`)

- [x] Diagnosis on unmodified main: `build-pages-before` exit 0;
  `e2e-before-scout-false-demotion` exit 1 and
  `e2e-before-session-score` exit 1 — each idle-kill test fails with
  the strict-mode signature above.
- [x] Gates on the fix tip: `tsc` 0 · `npm-test` 0 (scripts 850 pass
  / 11 skipped; src 1879/1879) · `test-worker` 0 (85/85) ·
  `lint-cards` 0 (GATE PASSED) · `build-pages` 0.
- [x] E2E after: scout-false-demotion full file **3 passed**, exit 0.
  session-score full file **6 passed / 2 failed**, exit 1 — the cured
  idle-timeout test passes; the 2 failures (`:77` HUD toggle —
  celebration overlay intercepts the click; `:509` share text — the
  spec's hardcoded Workers origin vs the Pages build's origin) are in
  tests this diff does not touch and BOTH reproduce on unmodified
  main with the same signatures (`e2e-control-main-session-score`,
  exit 1; `:509` solo on this branch fails with the identical origin
  mismatch, `e2e-after-session-score-share-solo`, exit 1) =
  pre-existing, not regressions.
- [x] Redundancy / other-instances grep: `redundancy-grep.log` — the
  only other bare instance on main is #296's own spec (fixed on the
  frozen PR #302 branch; untouched here).

## Status

- [x] Branch off current main (`2a0527f`, re-read); coordination ledger heartbeat posted
- [x] Diagnosis reproduced solo on unmodified main (both specs)
- [x] Scoped locator fix, consistent with PR #302's cure
- [x] Gates sealed (tsc · unit · worker · lint-cards · build:pages)
- [x] E2E after-fix solo runs sealed (both full spec files + main control)
- [x] PR opened against main (For #303)
- [ ] QA silo + panel — separate coordinator stages (not run here)
- [ ] Merge — owner's explicit per-PR word only
