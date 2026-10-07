# BRANCH_STATUS.md — feat/comet-touch-and-react

## Active work
- [x] Feature 1: Touch tracking on mobile (tap → mascot looks at tap)
- [x] Feature 2: Mascot reacts to edition selection (look + boop + bubble)
- [x] tsc clean, 792/792 unit tests pass
- [x] E2E: 17/17 comet tests pass (10 desktop + 4 mobile + 3 reduced)
- [ ] Open PR

## Implementation
**Touch tracking** (comet-mascot.tsx):
- `tracking` now `!reducedMotion` (was `finePointer && !reducedMotion`).
- Added `pointerdown` listener filtered to `pointerType === "touch"`.
- Taps feed the existing 8-sector head-turn logic; head stays on last tap.
- Mouse `pointermove` behavior unchanged. Reduced-motion still disables.

**Edition reaction** (comet-mascot.tsx + game-app.tsx):
- `withCardTap` dispatches `comet:edition-select` CustomEvent with tap
  coordinates + edition name ("State"/"Country"/"Globe"/"mystery").
- CometMascot listens: looks at the card (sector math), triggers happy
  boop, shows "To the {edition}!" bubble for 2.2s.
- Respects reduced-motion (bubble static, boop WAAPI no-ops).

## E2E notes
- New: mobile "tap turns head toward tap"; desktop "edition reaction".
- Fixed: mobile layout test was broken by unfiltered pointerdown
  (automation pointer events retargeted gaze); filtered to touch-only.
