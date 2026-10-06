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

## What's pending
1. `src/game/audio/sfx.ts` — the module
2. Wiring: LoopScreen (confirm blip / ring reveal / win arpeggio / lose sting / next-case deal) + home (card tap / difficulty select / speaker toggle)
3. Unit tests `src/game/audio/sfx.test.ts` (mapping endpoints + monotonic, toggle round-trip, no-crash without AudioContext) wired into `npm test`
4. `npx tsc --noEmit` clean
5. `npm test` full unit suite green
6. `npm run build:pages` production build green (needed for the E2E artifact)
7. Playwright E2E `tests/e2e/game-sfx.spec.ts` (stubbed AudioContext; game stays playable silent) + full E2E regression run
8. Push early and often (named files only); open PR (base: main) — DO NOT merge, Veeresh merges

## Spec §7 careful-abouts (all honored — see final report for code locations)
- Autoplay once-listeners load-bearing; iOS webkit prefix + in-gesture resume; mapping exponent/endpoints untouched; noise buffer cached once; no setInterval; initAudio StrictMode-idempotent; playDeal never on reload-restore.
