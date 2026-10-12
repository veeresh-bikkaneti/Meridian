# BRANCH_STATUS — fix/geodetective-unlabeled-tap-guess (2026-10-12)

**PUSH OK, DO NOT MERGE** — owner merges.

## What this fixes (plain language)

The owner tapped map locations in a GeoDetective challenge and nothing
happened — no guess registered. His directive: "User selection can be wrong
but it doesn't mean that you restrict from them selecting a location."

Root cause: `LoopMap.tsx` resolved every tap through the labeled-place
index. A tap landing on no labeled place (ocean, remote wilderness) was
REJECTED with "That spot isn't a labeled place" — the guess was never
registered. The gate was original Detective's Atlas design (2026-10-06),
not a Place Accessibility overhaul regression.

## The fix

Every map tap now selects — a tap on no labeled place opens the SAME confirm
bottom sheet with a region-named synthetic guess ("Open Water", "Canada",
"Yukon, Canada" — the same language the reveal pins already use). Confirming
burns the guess with distance+direction from the tap coordinates. The
confirm step is kept, so a mis-tap still never costs one of the five.

- `src/game/loop/evaluate.ts`: new `unlabeledSpotEntry(lon, lat)`.
- `src/game/loop/LoopMap.tsx`: no-hit branch → `onSelectPlace(synthetic)`.
- `src/game/loop/LoopScreen.tsx`: dead rejection hint removed.
- `tests/e2e/geodetective-unlabeled-tap.spec.ts` + project entry (new).
- `src/game/loop/evaluate.test.ts`: 4 new unit tests.

## Done

- [x] Implement
- [x] Unit tests: 1223/1223 green (incl. 4 new)
- [x] tsc clean, lint-cards GATE PASSED
- [x] New E2E: 2/2 green
- [ ] Existing geodetective E2E suite (running — regression check)
- [ ] Scrum panel review
- [ ] Screen recording
- [ ] Rebase to zero conflicts + full suite re-run
- [ ] PR opened (never merged)

## Plain-language spec checklist

1. Tap unlabeled ocean → confirm sheet opens ("Guess Open Water?"). ✓ E2E
2. Confirm → guess burns: "Guess 2 of 5", guess list +1, direction arrow
   drawn, next clue unlocks. ✓ E2E
3. Same unlabeled spot twice → "You already guessed…" warning, no second
   guess burned. ✓ E2E
4. Labeled-place taps behave exactly as before. ⏳ existing suite running
5. "That spot isn't a labeled place" rejection is gone. ✓ E2E (asserted absent)
6. An unlabeled tap can never accidentally win (synthetic id ≠ GeoNames id). ✓ unit
7. Map aria-label describes the any-tap model. ✓ code

## Non-blocking observation

For extreme misses (~15,000 km) the gold ring polygon wraps the globe and
renders degenerate — pre-existing for ANY far guess, not introduced here.
Direction arrow draws correctly. Follow-up candidate, not this PR.

## Ready to merge? NO

## What is pending?

Scrum review → screen recording → owner's video green-light →
Chitti/panel independent review → owner's merge decision.
