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

## Reviews (2026-10-03 — conducted by the Phase 2 coordinator directly; review
subagents unavailable at this depth, so both reviews were done in-line with
findings recorded here)

### Technical-architect review — PASS
- `src/game/learning.ts`: pure module, zero imports from game/lib — no
  coupling to dealing/scoring/session. `recordAnswer` never mutates input
  (snapshot-tested); LRU eviction only for new places past the cap with a
  deterministic tiebreak; caps 1000/8/90 as specified (~1.5 MB worst case).
- Persistence is fail-closed: malformed → null, writes swallowed, no
  localStorage (node/SSR) → null. Migration validates; unknown versions → null.
- Mastery rule matches the doc exactly (two most-recent hits, latest ≤ 50%
  of its own hit radius; defensive `radiusKm > 0` guard — radii are > 0 in
  practice). Growth-line precedence: newly-mastered > remembered > closer >
  tricky; first encounter special-cased.
- M1 (28d / 0.75), M3 (7d-vs-28d medians, ≥5/window), M4 (day streak anchored
  today-or-yesterday) all match the doc's formulas.
- Wiring: flag effect awaits the shared `loadFlags()` and caches the
  boot-time value (adopter pattern for kill-switch-style tracks); store read
  once when on, never when off. Hook sits *beside* `bankPlace` inside the
  banked-guard with its own try/catch; the `setLearningStore` updater is pure
  and its write idempotent, so a React re-invoked updater is harmless.
  Growth line/summary derive from the persisted store at render — reload-safe.
- Deliberate deviation from the doc (§4.4): a malformed *store-level*
  payload fails closed to null, but one malformed *record* is dropped while
  the store survives (doc says "any malformed payload → null"). Reason:
  nuking 999 good records over one corrupt entry is worse fail-closed
  behavior; unit-tested and documented in `parseLearningStore`.
- Privacy: the module performs zero network I/O; share/export paths untouched.

### Tone/docs/a11y review — PASS
- All six growth lines ship verbatim from the doc's copy bank; a unit test
  asserts the banned-tone list ("crushed", "destroyed", "noob", "god-tier",
  "dominated") never appears in the bank.
- "My growth" header, "Places explored/mastered", "Day streak — come back
  tomorrow to keep growing!", "Your pins are landing closer in {region}!"
  all match the doc; no gamer bravado, no shaming, no player comparison.
- A11y: growth line is a plain paragraph in card reading order (after the
  blurb, never replacing it); the 🌱 emoji uses `role="img"` + label per the
  codebase's AiStoryBadge pattern; the growth section uses h3+dl consistent
  with the existing "Score by edition" section.
- Docs: design doc status line updated to reflect the Phase 2 prototype;
  flag catalog in `docs/feature-flags.md` updated.

## Log
- 2026-10-03: branch opened, pushed.
- 2026-10-03 (Phase 2): pure learning module + flag registration + React wiring + unit tests committed; `npx tsc --noEmit` clean, `node scripts/lint-cards.mjs` GATE PASSED. Decisions from the design doc treated as settled at its recommendations per coordinator directive (no re-deciding).
