# BRANCH_STATUS — feat/comet-banner-emblem

Stacks on `origin/feat/grandpa-tasting-tour` (unmerged PR #99).

## Veeresh's locked decisions (2026-10-07)
1. Cursor-following: KEEP, dampened (smaller range, slower)
2. Finale: small STATIC Comet plush on the bench end
3. SoundToggle: eyebrow-left cluster (next to FIELD ATLAS)

## Done
- [x] game-app.tsx: CometMascot moved into header banner row (DOM move), SoundToggle to eyebrow-left, tutorialInviteVisible prop plumbed
- [x] comet-mascot.tsx: armillary ring SVG, dampened gaze (dead zone 90px, offsets ×0.6), dead comet:boop listener removed
- [x] comet-greeting.tsx: suppressAuto while tutorial invite visible
- [x] comet-mascot.css: in-flow wrap, size ladder (80px desktop/64px mobile), bubble flips down/left, dark backplate
- [x] grandpa-coffee-run.tsx: static Comet plush on bench (data-testid="grandpa-comet-plush")
- [x] grandpa-coffee-run.css: --comet-clearance removed, --park-right dodge reduced
- [x] E2E: 67/67 green (comet desktop 14, mobile 5, reduced 4, tasting-tour 20, overlap 24)
- [x] tsc clean, unit 848/848, build:pages green

## Pending
- [x] Push + PR (stacks on #99) — PR #100
- [ ] Veeresh merges (after PR #99)
