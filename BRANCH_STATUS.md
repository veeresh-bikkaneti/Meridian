# feat/learning-outcomes — status

Base: `origin/main` at `93fafa4` (feature flags, PR #43).

## Mission
Make learning real, measurable, and visible in Meridian — per Veeresh's standing product priority (2026-10-03): "user experience, user engagement, and learning outcomes — not just the game. Our users are players who want to learn and grow."

## Plan
- [x] Worktree + branch `feat/learning-outcomes` from origin/main; node_modules symlinked (never npm install); AGENTS.md read
- [x] Phase 1 — design doc `docs/learning-outcomes.md`: metrics, mastery rule, per-place learning record model, player-facing growth concept. Judgment calls marked for Veeresh. (2026-10-03)
- [x] Phase 2 — prototype behind `learningOutcomes` feature flag (default `false`, ships dark):
  - [x] `src/game/learning.ts` — pure module: record update (1000-place/8-attempt LRU caps), mastery derivation (2-in-a-row + 50%-radius confidence), growth-line copy bank, persistence (fail-closed, one `meridian:learning:v1` key), migration, M1/M3/M4 metrics
  - [x] Flag registered in `src/lib/flags.ts` + `public/flags.json` (false) + `docs/feature-flags.md` catalog, per the 4-step adopter pattern
  - [x] Hook in `onConfirm()` beside `bankPlace` (never inside); boot-time gated store load via shared `loadFlags()`
  - [x] Growth surfaces: reveal-card line (ResultCard) + end-game "My growth" section (RunSummaryCard); no dealing/scoring/session/card changes
  - [x] Unit tests: `src/game/learning.test.ts` (46 tests) + `src/lib/flags.test.ts` additions; wired into `npm test`
- [ ] Gates: unit (partial — new tests green; full suite pending) → typecheck ✓ → lint-cards ✓ → build:pages → tech-arch review → tone/docs/a11y review → E2E → PR → merge → live verify.

## Constraints
- Zero cost, zero new deps, no backend, no analytics vendor.
- Learning record is observational: must not disturb dealing (no-repeat), scoring, session logic, or the card pipeline.
- Ships dark behind the flag; flag defaults to current behavior. Follow `docs/feature-flags.md` adoption pattern exactly.
- Kid tone on every player-facing word.

## Log
- 2026-10-03: branch opened, pushed.
- 2026-10-03 (Phase 2): pure learning module + flag registration + React wiring + unit tests committed; `npx tsc --noEmit` clean, `node scripts/lint-cards.mjs` GATE PASSED. Decisions from the design doc treated as settled at its recommendations per coordinator directive (no re-deciding).
