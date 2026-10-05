# BRANCH_STATUS.md — feat/first-run-tutorial

**Branch:** `feat/first-run-tutorial` off `origin/main` @ `ea3117b`
**Worktree:** `~/workspace/meridian-worktrees/tutorial`
**Mission:** First-run 3-beat tutorial (game-review improvement #2 in the table, approved by Veeresh 2026-10-05 as "first-run tutorial"). Veeresh merges.

## Design (spec: game-review-recommendations.md, improvement #2)
- 3 beats, kid reading age ~10, skimmable, ADHD-friendly. Core verb (tap the map) within 30 seconds.
- Beat 1: aim-phase coachmark — tap the map, easy famous place (Eiffel Tower, Paris; curated tier-1 starter with an authored hook).
- Beat 2: reveal feedback — distance + "closer = more points" + every place tells its story.
- Beat 3: ends on a hook — "One place, one pin, one story. 100,000+ places to discover."
- Dismissible, NEVER blocks play: inline invitation banner on the menu (one tap still starts a game); every beat skippable; "seen" persisted client-side (localStorage `meridian.tutorialSeen`).
- Tour = isolated practice round: France country run with a single-place pool; no session banking, no learning record, no no-repeat-history pollution; reload mid-tour lands on the menu (sentinel pool check).
- No-labels policy holds; fail-closed everywhere.

## Status
- [x] `src/game/tutorial.ts` — seen-flag storage helpers (fail-closed), practice-round constants, `isTutorialRunPool` sentinel.
- [x] `src/game/tutorial.test.ts` — 10 unit tests (green); wired into `npm test`.
- [x] `src/components/tutorial-overlay.tsx` — invite banner + 3 beat overlays (dismissible, pointer-transparent beats 1–2, kid reading age ~10).
- [x] `src/components/game-app.tsx` — tutorial state in GameApp; `openRun` tutorial opt (single-place France pool, no history/banking/learning side effects); restore guard drops a persisted tour; beat 1→2 effect; card "Next place" → beat 3; invite on the top-level menu.
- [x] `tests/e2e/tutorial.spec.ts` + playwright `tutorial` project — invite, dismiss persistence, full 3-beat tour, beat-1 skip, reload-mid-tour, post-tour playability.
- [ ] Gates: `npx tsc --noEmit` ✓, `npm test` 605/605 ✓, `node scripts/lint-cards.mjs` GATE PASSED ✓, `npm run build:pages` ✓ (pre-review-fixes; rebuilding), Playwright E2E on the built artifact.
- [x] Self-review (code-reviewer + UX hats) — fixes applied: seen-flag marked only after the tour run starts (failed chunk load keeps the invite); beat-1 banner parks above the Drop pin pill on phones; overlay hidden on summary; Escape closes the beat-3 dialog; hooks-rule fix in TutorialOverlay.

## Rules
- Stage named files only. Push early and often. Existing features must not regress (boot path, edition picker, all editions, PR #58/60 reveal behavior, PWA/service worker).
