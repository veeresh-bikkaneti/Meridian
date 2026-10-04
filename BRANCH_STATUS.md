# BRANCH_STATUS.md — fix/strip-2-weak-hooks

Post-merge follow-up to PR #52 (Wikipedia history enrichment, merged 2026-10-04 as `092b488`).

## Done
- [x] Stripped the 2 hook-fail hooks on the verification crew's strip list (SHIP-WITH-CAVEAT protocol):
  - `gn-5397059` Solvang, CA — was dates-only trivia ("founded in 1911… incorporated May 1, 1985"), missed "Danish Capital of America"
  - `gn-3188582` Tuzla — was "educational center and home to two universities", missed 9th-century history + Europe's only salt lake
- [x] Both records now `hookMissing: true`, `history`/`wiki` removed (surgical 2-line diff, formatting preserved)
- [x] Gates: `npm test` 916/916 (382 scripts + 534 src, 0 fail), `tsc --noEmit` clean, lint-cards GATE PASSED (8,797 with hook / 115,893 hook-missing / 0 legacy), `npm run build:pages` green
- [x] E2E `history-first-cards.desktop.spec.ts`: 2 passed (West Englewood, Barry Farms); Miami + Nashville fail identically on pristine main (pre-existing, unrelated — data untouched for those records)

## Pending
- [ ] PR + merge, then live verification
