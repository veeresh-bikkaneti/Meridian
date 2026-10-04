# fix/wrong-answer-reveal-zoomout — status

Veeresh's bug report (2026-10-03): "during the play if player zooms in to drop a pin, if the answer is wrong player should be able to zoom out — or the grand reveal feature we already built should zoom out to show the correct answer regardless of the edition. That is not happening."

Approved design (2026-10-01, do not redesign): on a WRONG answer the camera pulls back to fit the player's pin AND the true location in one frame (framing scales with the error), draws the connecting line with the distance labeled, and the miss card leads with distance + small place summary.

Base: `origin/main` at `aa69434`.

## Done
- [x] Worktree + branch `fix/wrong-answer-reveal-zoomout` from origin/main; node_modules symlinked; AGENTS.md read
- [x] **Root cause CONFIRMED (code):** `completeReveal()` in `src/map/zoom-space.ts` emits only `reveal-done` — it never re-enables gestures. The reveal starts with `{gestures: enabled:false}`; the old `completeSettle()` (pre-gap-view-rewrite) re-enabled them, but commit `f2cea32` ("Gap-view reveal") dropped it. Same gap in `skipChoreography()`, the synchronous hit path, and the reduced-motion jump-cut path. Result: after ANY reveal, the player is trapped at the pin — cannot pan/zoom to inspect the true spot. (Thresholds are inert once revealDone latches, so re-enabling is safe.)
- [x] Fix implemented: `{gestures: enabled:true}` at all four reveal terminals (+1 regression unit test). tsc clean, 46/46 zoom-space tests, 476/476 full suite, lint-cards gate. Committed `c7aba36`, pushed.
- [x] **Repro RESULTS (2026-10-04):** Playwright repro on the fixed build (globe/country/state, deep-zoom miss): the ease-to-fit pull-back was NEVER broken — Globe 5→4, Country 10→5, State 10→7; both markers framed in every edition; watchdog never fired. **The entire bug was the dead gestures** — the fix's only behavior change. Wheel-zoom post-card confirmed live in all 3 editions.
- [x] E2E specs written: `tests/e2e/reveal-zoomout.desktop.spec.ts` (globe/country/state miss-from-deep-zoom + hit regression) and `tests/e2e/reveal-zoomout.reduced.spec.ts` (reduced-motion jump-cut fit). Committed `c32e67f`+`0d752ea`, pushed.
- [x] E2E run 1: 3/4 pass — country miss, state miss, hit (all incl. live wheel-gesture assertion) GREEN. Globe miss failed on cold-start map-mount timeout in shared `startGlobeRun` (`.satellite-map` absent 15s+, first test of run; identical helper passed later) — harness flake, not the fix.
- [~] E2E re-runs: BLOCKED by environment, not the fix — (a) sibling crew deleted `difficulty-tiers` worktree, breaking my node_modules symlink (re-pointed to `gap-view-reveal`'s, playwright 1.63.0); (b) sibling `repeat-debug` E2E saturating the VM (load ~11, 0 free RAM) crashed the browser mid-test in 2 attempts. Watchdog queued: re-run globe-miss + reduced-motion once the sibling finishes.

## Pending
- [ ] E2E: globe-miss + reduced-motion green (watchdog queued)
- [x] Technical-architect review: PASS-WITH-NOTES — fix correct at right layer, no ordering hazards (revealDone latches before batch executes; batches run in one JS task under `withoutControllerEvents`). Follow-up (pre-existing, out of scope): dispatch-exception catch + watchdog-fire paths still leave gestures off — hardening item for a later pass.
- [x] Tone/docs/a11y review: PASS-WITH-NOTES — zero user-facing copy changed; no stale docs; keyboard +/- and reduced-motion fine; no focus changes. Two informational notes only.
- [ ] PR → merge per standing auth → live Pages verification (build-meta.json)

## Notes for parent
- Repro side-observations (pre-existing, out of scope): React minified error #418 hydration `pageerror` on every load (~1-1.7s, pre-gameplay, game unaffected); tile-watchdog flake (one Nebraska run `data-tile-status:"failed"`, re-run passed); Q2 post-reveal main-thread sluggishness in the harness (likely software-WebGL artifact).
- Veeresh 2026-10-04 (MEMORY.md): wants the reveal card to also show what the player selected alongside what was asked — separate enhancement, NOT this bug fix; flagging for scoping.
