# BRANCH_STATUS.md — feat/misses-review-deck

**Branch:** `feat/misses-review-deck` · **Base:** `origin/main @ ea3117b`
**Worktree:** `~/workspace/meridian-worktrees/misses-deck` (dedicated — do not touch other worktrees)
**Task:** Misses-review deck (game-review improvement #1, approved by Veeresh 2026-10-05) —
a spaced-repetition review deck of the player's misses that closes the loop the
reveal opens. Builds on the `learningOutcomes` per-place learning records
(`src/game/learning.ts`); client-side only; never blocks play; never a gate.

## Design (game-designer + frontend + ux hats, 2026-10-05)
- The deck is a synthetic `Run` (`regionId "review-deck"`, typed edition
  `"globe"`) reusing the PlayLoaded game loop — no forked map/reveal code.
- Each deck card snapshots its original question context at miss time
  (coords, story, original edition/region, hit radius, map mode, region
  bounds) so a review card replays the exact original question framing.
- Spaced repetition: Leitner-lite intervals [0, 1, 3, 7, 14, 30] days by
  consecutive successful reviews; a fresh miss is due immediately; a
  mastered place leaves the deck (mastery derived from learning records).
- Review answers record into learning records with the ORIGINAL
  edition/region (metrics stay truthful) but never bank into the session —
  review is practice, not scoring. Session totals, streaks, share, story
  cards: untouched.
- Entry points (invitations, never gates): picker banner below the edition
  grid + "Review my misses (N)" in the end-game "My growth" section.
  Gated on the `learningOutcomes` flag like the other growth surfaces.
- Reload mid-review fails closed to the picker (the deck in localStorage is
  the durable state; the session queue is rebuilt fresh each time).

## Done
- [x] Design settled (see above)

## Pending
- [ ] `src/game/review-deck.ts` — pure deck logic + fail-closed persistence
- [ ] `src/game/review-deck.test.ts` + package.json test-script registration
- [ ] `game-app.tsx` integration (deck sync in onConfirm, review-run
      plumbing in Play/PlayLoaded, picker entry, review-complete screen)
- [ ] `run-summary.tsx` — "Review my misses (N)" button
- [ ] `docs/learning-outcomes.md` — deck section
- [ ] Gates: `npx tsc --noEmit`, `npm test`, `node scripts/lint-cards.mjs`,
      `npm run build:pages`
- [ ] E2E `tests/e2e/review-deck.desktop.spec.ts` (empty state, review flow,
      persistence across reload) + playwright.config.ts project entry
- [ ] Self-review (code-reviewer + ux hats): zero blockers
- [ ] Open PR (target main) — NEVER merge; Veeresh merges

## Rules
- Stage named files only (`git status` + `git diff --cached --stat` before
  each commit). Push early and often. Never break State/Country/Globe
  editions, scoring, share, streaks, story cards, or PR #58/60 reveal
  behavior. No labels on the map — ever.
