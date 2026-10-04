# BRANCH_STATUS.md — feat/cumulative-score-breakdown

## Problem (Veeresh, live play-test 2026-10-04)
1. **Bug:** HUD shows `SCORE 473` (session-cumulative) next to `0 placed`
   (run-scoped, resets on every edition switch). The placed-counter must be
   session-cumulative like the score.
2. **Feature:** at End game, the scoreboard must show a clear breakdown —
   per difficulty mode (hits + success rate, e.g. `Easy 8/10 (80%) · 240 pts`),
   which states played, which countries played, globe score — and the
   breakdown must be shareable (social media + text/SMS).

## Design
- `src/game/session.ts`: `bankPlace` gains `difficultyChoice` + `regionId`/`regionName`;
  session tracks `byDifficulty` (easy/medium/hard: score/places/hits) and
  `regions` (one row per region, first-seen order, replay accumulates);
  `summarizeSession` exposes both + per-mode success rates.
- `game-app.tsx`: HUD placed-counter → `session?.hits ?? run.hits`; thread the
  new bank fields through `onBankPlace` at the pin-commit call site.
- `run-summary.tsx`: end-game breakdown UI (per-difficulty with rates,
  per-region grouped states/countries/globe). `share.ts`/`share-action.ts`:
  compact text breakdown extending (not replacing) the 3-line share contract.
- **Consistency invariant:** share text and end-game screen render from the
  SAME `SessionSummary` object; explicit test asserts share numbers ==
  summary numbers.

## Status
- [x] Session core (types, bankPlace, summarize, readSession backfill, unit tests) — 530/530 green
- [x] App wiring (HUD placed-counter → session cumulative; bank threading; breakdown toggle)
- [x] Summary UI + share text (breakdown UI, share format, consistency test)
- [ ] E2E: extend tests/e2e/session-score.spec.ts (HUD accumulation across
  edition switch; summary breakdown; share text contains breakdown)
- [x] Full unit suite green (530/530)
- [x] `npx tsc --noEmit` clean
- [ ] Card gate GATE PASSED
- [ ] `npm run build:pages` green
- [ ] Technical-architect review
- [ ] Tone/docs review
- [ ] PR → merge → live verification

## Standing constraints
- New features must not break existing features (full E2E stays green).
- Client-side only, no backend, no accounts. Kid-friendly copy.
- Do NOT change: 2-minute idle timeout, streak display, scoring multipliers.
