# BRANCH_STATUS — fix/188-185-session-end-hints

**Branch:** `fix/188-185-session-end-hints`
**Base:** `main` at `5f24c6c` (2026-10-26)
**State: BUILT — gates in progress (2026-10-26).** Coordinator C
(UX/UI & Frontend + Game Squad) cluster branch 2 of 3. Not merged —
merge is the owner's word.

## Scope

- **#185 — GeoDetective hint counter resets on mid-mystery reload.**
  `LoopScreen`'s local `hintsUsedThisMystery` started at a blind zero
  on every mount. It now initializes from — and the per-mystery reset
  effect restores — the mystery's persisted `puzzle.hintsUsed`, so a
  one-per-round player (including the hints-on-by-default unset
  profile) cannot tap a second hint after reloading mid-mystery.
  The store count already blocked the Clean Round badge; this fixes
  the UI half.
- **#188 — Scout switched notice not retired on session end.**
  `killIdleSession` and the End-game summary-done handler in
  `game-app.tsx` now clear `mapSwitchedNote`, extending Block B's
  lifecycle rule (later flips retire it) to session end. The notice's
  "Your score is kept" claim dies with the session it describes.

## Files

- `src/game/loop/LoopScreen.tsx` — hydrate the hint counter (#185)
- `src/components/game-app.tsx` — clear the notice in
  `killIdleSession` + `onSummaryDone` (#188)
- `src/game/loop/hint-hydration.test.ts` — NEW source pin (#185)
- `src/components/map-switched-notice-lifecycle.test.ts` — NEW
  source pin (#188, with the manual-flip control)
- `tests/e2e/geodetective-hint.spec.ts` — NEW reload pin (#185)
- `tests/e2e/scout-notice-session-end.desktop.spec.ts` — NEW E2E:
  End-game leg + idle-kill leg (#188)
- `docs/scout-offer-policy.md` — session-end retirement rule (#188)
- `docs/handbook/02-game-design-decisions.md` — reload honesty note
  for GeoDetective hints (#185)

## Gates

- [ ] `npx tsc --noEmit`
- [ ] `npm test`
- [ ] `node scripts/lint-cards.mjs`
- [ ] `npm run build:pages`
- [ ] Playwright `--workers=1`: geodetective-hint,
      scout-notice-session-end, scout-toggle (regression neighbor)

## Out of scope

- #154 item 1 / PR #197 (test seam) — untouched.
- No merge, no branch-protection changes.
