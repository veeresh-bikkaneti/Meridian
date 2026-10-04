# fix/wrong-answer-reveal-zoomout — status

Veeresh's bug report (2026-10-03): "during the play if player zooms in to drop a pin, if the answer is wrong player should be able to zoom out — or the grand reveal feature we already built should zoom out to show the correct answer regardless of the edition. That is not happening."

Approved design (2026-10-01, do not redesign): on a WRONG answer the camera pulls back to fit the player's pin AND the true location in one frame (framing scales with the error), draws the connecting line with the distance labeled, and the miss card leads with distance + small place summary.

Base: `origin/main` at `aa69434`.

## Done
- [x] Worktree + branch `fix/wrong-answer-reveal-zoomout` from origin/main; node_modules symlinked; AGENTS.md read

## Pending
- [ ] Reproduce with Playwright: seed run, deep zoom, wrong answer — observe reveal camera behavior
- [ ] Root-cause the reveal bounds/fit path (suspects: fit calc wrong from zoomed-in state, animation never fires, gestures disabled during reveal, reveal-watchdog forcing card while camera never moved)
- [ ] Check all three editions (Globe, Country, State)
- [ ] Fix: wrong answer → camera fits BOTH pins with padding, every edition, any starting zoom; manual zoom/pan allowed during+after reveal; correct-answer dive unchanged; reduced-motion instant fit
- [ ] Gates: unit (bounds/fit) → typecheck → build → tech-arch review → tone/docs/a11y review → E2E (all 3 editions, deep-zoom wrong answer, manual zoom-out, dive unchanged, reduced-motion) → PR → merge → live verify
