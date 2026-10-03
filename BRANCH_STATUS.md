# feat/learning-outcomes — status

Base: `origin/main` at `93fafa4` (feature flags, PR #43).

## Mission
Make learning real, measurable, and visible in Meridian — per Veeresh's standing product priority (2026-10-03): "user experience, user engagement, and learning outcomes — not just the game. Our users are players who want to learn and grow."

## Plan
- [x] Worktree + branch `feat/learning-outcomes` from origin/main; node_modules symlinked (never npm install); AGENTS.md read
- [x] Phase 1 — design doc `docs/learning-outcomes.md`: metrics, mastery rule, per-place learning record model, player-facing growth concept. Judgment calls marked for Veeresh. (2026-10-03)
- [ ] Phase 2 — prototype behind `learningOutcomes` feature flag: instrument answer events, client-side-only (localStorage) per-place records, mastery computation, minimal growth surface, kid-friendly copy.
- [ ] Gates: unit → typecheck → build → tech-arch review → tone/docs/a11y review → E2E → PR → merge → live verify.

## Constraints
- Zero cost, zero new deps, no backend, no analytics vendor.
- Learning record is observational: must not disturb dealing (no-repeat), scoring, session logic, or the card pipeline.
- Ships dark behind the flag; flag defaults to current behavior. Follow `docs/feature-flags.md` adoption pattern exactly.
- Kid tone on every player-facing word.

## Log
- 2026-10-03: branch opened, pushed.
