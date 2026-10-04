# BRANCH_STATUS.md — fix/easy-repeat-band-pools

## Problem (Veeresh, live play-test 2026-10-04)
Easy mode in the State edition falls into "repeat mode": the same few
questions cycle over and over.

## Root cause
The dealing pool is band-filtered (Easy = fame tiers 1–2 narrows the catalog
BEFORE the pool is built), but the persistent no-repeat history
(`meridian:seen:v2:<edition>:<region>`) was shared across all difficulty
bands. One band's dealt places shrank the other bands' pools:
- Tier-2 places dealt on Medium were already "seen" when opening Easy, so
  the Easy pool opened small.
- Each Easy run shrank it further; the cycle reset only fires at exactly 0,
  so the pool could sit at 1–3 places for many runs — the dealer then cycled
  those few places ("repeat mode").
- The reset at 0 also wiped the other bands' history as collateral.

## Fix
- `seenStoreFor(edition, regionId, choice)` — history key is now
  `meridian:seen:v2:<edition>:<region>:<choice>`. Each band cycles
  independently; a band's cycle reset clears only its own history.
- One-time lazy migration: the first touch of a band's store folds the
  pre-band unscoped key into it and prunes the key (fail-open).
- Legacy v1 day-keyed entries now route to the medium band (the pre-picker
  backfill default) instead of the orphaned unscoped key.
- `poolForRunStart` and the dealer construction in game-app.tsx thread the
  difficulty choice through.

## Status
- [x] Fix implemented (src/game/trail.ts, src/components/game-app.tsx)
- [x] trail.test.ts: existing seen-store tests updated to 3-arg calls
- [x] 4 new regression tests (band independence, lazy migration, the
  repeat-mode scenario end-to-end, v1 routing)
- [x] Full unit suite green: 519/519
- [x] `npx tsc --noEmit` clean
- [x] `npm run build:pages` green
- [x] Card gate GATE PASSED
- [x] Playwright E2E difficulty-picker: 6/6 green (honest log: first full
  run 2/6 — the difficulty-picker project had been silently unrunnable due
  to a duplicate key in playwright.config.ts, then VM satellite-tile flakes
  and slow lazy-chunk loads failed 4; helpers.ts `commitPin` hardened with a
  3-attempt tile Retry loop (mirrors the designed UX, still fails a truly
  broken tile pipeline); final full run 5/6 with one slow-chunk flake, which
  passed on solo retry → 6/6)
- [x] Technical-architect review: APPROVE WITH NOTES (2 lows applied:
  E2E comment reworded for accuracy, run.difficultyChoice added to dealer
  useMemo deps; prevLastId post-migration wrinkle noted as very-low,
  transient, cosmetic — skipped)
- [x] Tone/docs review: APPROVE WITH NOTES (2 comment nits fixed)
- [ ] PR → merge → live verification

## Notes
- Easy Arkansas is 21 places (20 generated tier 1–2 + 1 curated starter); after
  the fix it deals the full 21 per cycle instead of collapsing to a handful.
- No dataset changes; no label/scoring changes.
