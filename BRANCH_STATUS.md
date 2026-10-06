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
- [x] `src/game/audio/sfx.ts` — the module (8 play fns, initAudio, toggle, distanceToFrequencyKm; module-local PRNG — never touches global Math.random/crypto)
- [x] Wiring: LoopScreen (confirm/ring/win/lose/deal) + home (card tap/difficulty/toggle in Chart Room header)
- [x] Unit tests `src/game/audio/sfx.test.ts` — 12/12 green, wired into `npm test`
- [x] `npx tsc --noEmit` clean
- [x] `npm test` full suite green — 728/728
- [x] `node scripts/lint-cards.mjs` — GATE PASSED
- [x] `npm run build:pages` green (rebuilt after PRNG fix @ 88e63be)
- [x] E2E `tests/e2e/game-sfx.spec.ts` — 4/4 green (stubbed AudioContext)
- [x] Full E2E regression: 158/162; 4 failures triaged (see below); targeted re-run of all 4 specs: 23/23 green
- [x] Pushed: `feat/game-sfx` @ 88e63be

## E2E triage (full run 2026-10-06, 162 tests)
- **reveal-pin-compare (Hungary→Iran): REAL regression from this branch** — `playCardTap`'s `Math.random()` jitter consumed one value from the spec's mocked deterministic sequence, shifting the seeded deal. Fixed: module-local mulberry32 PRNG in sfx.ts (commit 88e63be) + unit test asserting zero global `Math.random` draws. Re-run: 4/4 green.
- **question-randomization (90s timeout): flake** — VM contention; re-run passes (53.8s).
- **pinch-zoom (NaN zoom): flake** — re-run: 12/12 green.
- **safari-launch (boot-JS ceiling 2.51MB > 1.8MB): PRE-EXISTING on main** — built clean baseline @ a838fc6 in a scratch worktree: 2,507,113 bytes (index 435,371 + routes 2,071,742) already over the ceiling without any SFX change. This branch adds ~7KB (the sfx module). Flagged for Veeresh — not fixed here.

## What's pending
1. Open PR (base: main) — DO NOT merge, Veeresh merges
2. CI status check after PR open

## Notes
- Worktree `node_modules` is a symlink to `~/workspace/meridian-build/node_modules` (deps identical); gitignored, untracked.
- `npx` is shimmed in this environment — used `node_modules/.bin/{tsc,playwright}` directly.
- E2E runs serialized VM-wide via `flock ~/workspace/.e2e.lock --workers=1` per repo convention.

## Spec §7 careful-abouts (all honored — see final report for code locations)
- Autoplay once-listeners load-bearing; iOS webkit prefix + in-gesture resume; mapping exponent/endpoints untouched; noise buffer cached once; no setInterval; initAudio StrictMode-idempotent; playDeal never on reload-restore.
