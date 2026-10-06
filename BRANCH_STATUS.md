# BRANCH_STATUS.md — feat/celebration-audio-animation

## Spec
~/workspace/your_files/celebration-audio-animation-spec.md (264 lines)

## Veeresh's locked decisions
1. Globe spin: subtle loop. 2. Fanfare: 1.15s. 3. Pin drop: two new sounds.
4. Streak-50: Parade. 5. Sound default ON + mute-all button reachable in game.

## Active work
- [x] sfx.ts: 9 new functions + admitLoop + unit tests (shipped 2026-10-06: tsc clean, 19/19 sfx tests green; 7 shipped sounds byte-identical)
- [x] Mute button in game chrome (in addition to home header) — shared SoundToggle component (game-app.tsx); testid sound-toggle-game; same meridian.sound persistence, default ON, ON-confirms with card tap
- [x] Components: characters.tsx, confetti.tsx, celebration-overlay.tsx/.css, use-prefers-reduced-motion.ts (+ celebration-copy.ts, particle-caps.ts pure helpers for testability; 3 unit test files, 14 tests green; tsc clean; ~10.3KB gzipped prod code, within 12KB budget)
- [x] Wiring (2026-10-06): game-app.tsx (celebration state + ?celebration= seam + overlay render on all screens; cleared-dialog applause/fanfare via playCelebrationSound; Next-place chart-unroll sound; streak 10/25/50 cheers w/ 5s spacing; first-ever-win Parade overlay + playWin); LoopScreen (onCelebrate: 387 Legendary overlay once/cycle, first-win Parade); LoopMap (pin-drop pass/fail in the tap handler, camera/300ms gating); satellite-map (spin SFX start/stop, pointerup stop, narrow-in toast chime); new src/game/audio/play-guards.ts (spec §3 anti-annoyance: hidden-tab, 5s cheer, 60s grand, 500ms reject-tick) + unit tests
- [x] Narrative copy tone pass (celebration-copy.ts): region-neutral difficulty-clear line, idiomatic streak-25/50 lines; all ≤8/≤20 word limits hold
- [x] E2E: tests/e2e/sfx-stub.ts (shared stub extracted + extended: src loop/stop, filter, gain ramps), tests/e2e/celebration.spec.ts (seam render, dismiss ×/Escape, 4 variants, reduced-motion), game-sfx.spec.ts (spin start/transition/pointerup, in-game mute, streak-10 cheer via reload-seeded streak), cleared-mode.spec.ts (Easy applause, Hard fanfare, reduced-motion applause)
- [x] Full gates (2026-10-06): tsc clean, npm test 764/764 green, lint-cards GATE PASSED, build:pages green, Playwright E2E green — celebration 4/4, game-sfx 8/8, cleared-mode 10/10 (incl. 3 new applause/fanfare tests). Two E2E fixes landed after the first run: sfx-stub param ramps no longer clobber the setValueAtTime freq (restores the original stub's recording contract), and the spin-pointerup test targets .maplibregl-canvas (was ambiguous across starfield canvases).
- [ ] Open PR (Veeresh merges)

## Done
- [x] Spec read, sfx.ts architecture studied
- [x] Branch created from origin/main

## Wiring notes / deviations (2026-10-06)
- Pin-drop sounds live in **LoopMap.tsx** (not LoopScreen.tsx): the tap
  handler that decides accept/reject (`map.on("click")`, camera state, the
  300 ms guard) lives there; LoopScreen only receives the outcome.
- Hard-cleared dialog plays **playGrandFanfare** (not playMediumApplause):
  the spec §3 trigger table differentiates Easy/Medium (applause) vs Hard
  (fanfare/coronation); the 60 s grand cooldown drops it to applause.
- E2E "steal" (spin stolen by ring): covered by the existing unit test
  ("ring steals spin") — a real-flow E2E is impossible by construction
  (the spin SFX lives only during the 1200 ms intro; no ring can fire
  before the aim phase). E2E covers spin start, transition stop, and
  pointerup stop instead.
- `?celebration=` seam overlay cannot voice its SFX in E2E (autoplay:
  no gesture precedes the mount, so the context stays suspended). The
  recipe mapping is unit-tested; the fanfare/applause/cheer recipes are
  proven on gesture-backed flows (cleared-dialog, streak).
- Streak milestones are sound-only (no overlay) per the task; first-win
  overlay uses the silent `mystery-solved` variant (playWin fires once
  from the wiring, never doubled).
