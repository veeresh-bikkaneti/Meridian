# BRANCH_STATUS.md — feat/game-sfx

**Branch:** `feat/game-sfx` (worktree: `~/workspace/meridian-worktrees/game-sfx`)
**Base:** `origin/main` @ `a838fc6` (PR #72 merge). Spec committed as `614d0dd` (not yet pushed — this branch owns pushing from here).
**Task:** Meridian's first audio pass — 100% Web Audio synthesized SFX, zero assets, exactly to the audio designer's spec (`docs/sfx-spec.md`, §4–§6 own the details).
**Status:** 🟡 IN PROGRESS

## Design (from spec)
- Single module `src/game/audio/sfx.ts`: 8 play fns + `initAudio()` + `is/setSoundEnabled()` + pure `distanceToFrequencyKm()`.
- Lazy AudioContext on first user gesture (pointerdown/keydown `{ once: true }` in app root; webkit prefix fallback; resume if suspended).
- Master chain: voice gain → masterGain(0.8) → DynamicsCompressor(−9 dB/6/12/3 ms/120 ms) → destination. Max 8 voices; ring/win/lose high priority; debounce 80 ms.
- Distance→pitch mapping `round(1568 * d^-0.28)` — DO NOT re-tune (−0.28 exponent, 1568/98 Hz endpoints are load-bearing).
- `meridian.sound` localStorage toggle, default ON, in Chart Room header. `prefers-reduced-motion` does NOT mute.

## What's done
- [x] Spec committed (614d0dd): `docs/sfx-spec.md`
- [x] `src/game/audio/sfx.ts` — the module (8 play fns, initAudio, toggle, distanceToFrequencyKm)
- [x] Wiring: LoopScreen (confirm/ring/win/lose/deal) + home (card tap/difficulty/toggle in Chart Room header)
- [x] Unit tests `src/game/audio/sfx.test.ts` — 11/11 green, wired into `npm test`
- [x] `npx tsc --noEmit` clean (via sibling checkout's tsc; worktree node_modules is a symlink, gitignored)
- [x] `npm test` full suite green — 727/727
- [x] Pushed: `feat/game-sfx` @ dfb4e48 (spec commit 614d0dd now on origin)
- [x] E2E spec `tests/e2e/game-sfx.spec.ts` (stubbed AudioContext; 4 tests)

## What's pending
1. `npm run build:pages` production build green (needed for the E2E artifact) — RUNNING
2. Playwright E2E `tests/e2e/game-sfx.spec.ts` via `flock ~/workspace/.e2e.lock --workers=1` + full E2E regression (no Globe/Country/State regressions)
3. Push (named files only); open PR (base: main) — DO NOT merge, Veeresh merges

## Spec §7 careful-abouts (all honored — see final report for code locations)
- Autoplay once-listeners load-bearing; iOS webkit prefix + in-gesture resume; mapping exponent/endpoints untouched; noise buffer cached once; no setInterval; initAudio StrictMode-idempotent; playDeal never on reload-restore.
