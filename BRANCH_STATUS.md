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
- [x] `src/game/review-deck.ts` — pure deck logic + fail-closed persistence
      (21 unit tests green)
- [x] `src/game/review-deck.test.ts` + package.json test-script registration
- [x] `game-app.tsx` integration: deck sync in onConfirm (miss → upsert,
      review answer → reschedule, newly-mastered → remove), review-run
      plumbing in Play/PlayLoaded (synthetic `Run`, due-order queue,
      per-card original question context, no session banking, no
      cleared-mode, review-complete screen), picker banner entry,
      boot drops review runs (fail closed)
- [x] `run-summary.tsx` — "Review my misses (N)" button in "My growth"
- [x] Gates so far: `npx tsc --noEmit` clean · `npm test` 616/616 green ·
      `node scripts/lint-cards.mjs` GATE PASSED · `npm run build:pages` green
- [x] Self-review round 1 (code-reviewer + ux hats): fixed 3 issues —
      stale picker banner (deck status now re-reads whenever the app
      returns to the picker), updater idempotency guard for the deck sync,
      honest review-complete copy ("further out every time", no
      fade-timing claim)
- [x] Infra rule adopted (parent directive 2026-10-05): all E2E via
      `flock ~/workspace/.e2e.lock` + `--workers=1`, and
      `--disable-dev-shm-usage` in playwright.config.ts launchOptions
      (test config only — no app code touched). This fixed the renderer
      crashes seen in the first E2E attempt (OOM-killed Chromium under
      concurrent suites, 794 MB /dev/shm).

## Pending
- [x] E2E `tests/e2e/review-deck.desktop.spec.ts` — **4/4 GREEN** on the
      final artifact (empty state, flag-off, review flow, persistence
      across reload). Two spec-only bugs found and fixed along the way
      (commitHit returns { committedAt } only; addInitScript re-seeds on
      reload — conditional seeding now).
- [ ] Open PR (target main) — NEVER merge; Veeresh merges — DONE: PR #62

## Gates — ALL GREEN (2026-10-05)
- `npx tsc --noEmit` clean · `npm test` 616/616 · `node scripts/lint-cards.mjs`
  GATE PASSED · `npm run build:pages` green · Playwright E2E 4/4 green
- Self-review (code-reviewer + ux hats): zero blockers.

## Rules
- Stage named files only (`git status` + `git diff --cached --stat` before
  each commit). Push early and often. Never break State/Country/Globe
  editions, scoring, share, streaks, story cards, or PR #58/60 reveal
  behavior. No labels on the map — ever.
