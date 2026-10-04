# fix/wrong-answer-reveal-zoomout — status

Veeresh's bug report (2026-10-03): "during the play if player zooms in to drop a pin, if the answer is wrong player should be able to zoom out — or the grand reveal feature we already built should zoom out to show the correct answer regardless of the edition. That is not happening."

Approved design (2026-10-01, do not redesign): on a WRONG answer the camera pulls back to fit the player's pin AND the true location in one frame (framing scales with the error), draws the connecting line with the distance labeled, and the miss card leads with distance + small place summary.

Base: `origin/main` at `aa69434`.

## Done
- [x] Worktree + branch `fix/wrong-answer-reveal-zoomout` from origin/main; node_modules symlinked; AGENTS.md read
- [x] **Root cause CONFIRMED (code):** `completeReveal()` in `src/map/zoom-space.ts` emits only `reveal-done` — it never re-enables gestures. The reveal starts with `{gestures: enabled:false}`; the old `completeSettle()` (pre-gap-view-rewrite) re-enabled them, but commit `f2cea32` ("Gap-view reveal") dropped it. Same gap in `skipChoreography()`, the synchronous hit path, and the reduced-motion jump-cut path. Result: after ANY reveal, the player is trapped at the pin — cannot pan/zoom to inspect the true spot. (Thresholds are inert once revealDone latches, so re-enabling is safe.)
- [x] Fix implemented: `{gestures: enabled:true}` at all four reveal terminals (+46th regression unit test). tsc clean, 46/46 zoom-space tests pass. Committed `c7aba36`, pushed.
- [x] Playwright repro worker spawned (deep-zoom miss in Globe/Country): verifying whether the gap-view ease itself also fails to zoom out, and whether gestures are dead post-card.

## Pending
- [ ] Repro results → determine if the ease-to-fit also needs a fix
- [ ] Full gates: unit (full suite) → typecheck ✓ → build → tech-arch review → tone/docs/a11y review → E2E (all 3 editions deep-zoom miss, manual zoom-out, dive unchanged, reduced-motion) → PR → merge → live verify
