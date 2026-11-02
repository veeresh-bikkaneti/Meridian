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

- (pending reproduction)

## Evidence (sealed: `~/workspace/meridian-issue-wave/evidence/303/`)

- (pending)

## Status

- [x] Branch off current main (`2a0527f`, re-read); coordination ledger heartbeat posted
- [ ] Diagnosis reproduced solo on unmodified main (both specs)
- [ ] Scoped locator fix, consistent with PR #302's cure
- [ ] Gates sealed (tsc · unit · worker · lint-cards · build:pages)
- [ ] E2E after-fix solo runs sealed (both full spec files)
- [ ] PR opened against main (For #303)
- [ ] Merge — owner's explicit per-PR word only (separate stage)
