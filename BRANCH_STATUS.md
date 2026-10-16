# BRANCH_STATUS — fix/geodetective-unlabeled-tap-guess (2026-10-12)

**PUSH OK, DO NOT MERGE** — owner merges.

**2026-10-16 (post-merge re-gate):** merged `origin/main` (WS-4 phase 1 #148, #155, #158, #163, #164 and others) with one conflict, in this file; kept this branch's version. `LoopMap.tsx` and `LoopScreen.tsx` auto-merged with main's map-hidden changes. Re-gated on the merged head: `npm ci` OK; tsc clean; `npm test` scripts 778 (769 pass, 9 skipped, 0 fail) and src 1,319 pass; lint-cards GATE PASSED; `build:pages`, `build`, `test:worker` 18/18 and `typecheck:worker` clean; E2E `--workers=1` on a fresh Pages build: `geodetective` 18/18, `geodetective-unlabeled-tap` 2/2, `ws4-geodetective-map-hidden` 3/3. Still pending (unchanged): owner's video green-light, independent panel review, owner's merge decision. The full Playwright suite was not run.

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
- [x] New E2E: 2/2 green (+ reduced-motion pass 1/1)
- [x] Existing geodetective E2E: 18/18 green (1 stale test updated to the
      new directive behavior)
- [x] Scrum panel review: APPROVE-WITH-NITS, 0 BLOCKs (6 nits; 1-3 fixed,
      4 out of scope, 5 noted, 6 covered by reduced-motion recording)
- [x] Screen recordings (3)
- [x] Rebase: 0 commits behind main, full suite re-run green post-commit
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
