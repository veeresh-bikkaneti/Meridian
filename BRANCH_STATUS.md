# BRANCH_STATUS — feat/comet-banner-emblem

Rebased onto origin/main@f07dad3 (PR #107 sprint entry gates merged).
PR: https://github.com/veeresh-bikkaneti/Meridian/pull/103 (OPEN, not merged).

## Veeresh's locked decisions (2026-10-07)
1. Cursor-following: KEEP, dampened (smaller range, slower)
2. Finale: small STATIC Comet plush on the bench end
3. SoundToggle: eyebrow-left cluster (next to FIELD ATLAS)

## Done
- game-app.tsx: CometMascot moved into header banner row (DOM move), SoundToggle to eyebrow-left, tutorialInviteVisible prop plumbed
- comet-mascot.tsx: armillary ring SVG, dampened gaze, dead comet:boop listener removed; greeting + reaction bubbles portaled to document.body (fixed toast)
- comet-greeting.tsx: suppressAuto while tutorial invite visible
- comet-mascot.css: in-flow wrap, size ladder, bubble as fixed bottom-right toast (never covers tagline), dark backplate
- comet-greetings.ts: dead exported localDateKey removed
- grandpa-coffee-run.tsx: static Comet plush on bench
- grandpa-coffee-run.css: --comet-clearance removed
- E2E (verified 2026-10-08 on rebased branch): comet desktop 14/14, mobile 5/5, reduced-motion 4/4, mobile-home-overlap 24/24 (one transient walker-animation flake, green on re-run — pre-existing flake, also seen pre-rebase)
- Rebase 2026-10-08: onto origin/main@f07dad3; only BRANCH_STATUS.md conflicted (docs-only commits resolved keeping branch entries); no code conflicts
- Reported desktop 13/14 "emblem overhang" did NOT reproduce: 14/14 across multiple full runs on the correct tip; layout verified sound (greeting + reaction portaled, wrap = 80px emblem only). No CSS change made — no blind fix on green tests.
- tsc clean / lint-cards GATE PASSED / build:pages green

## Pending
- [ ] Owner review + merge of PR #103 (never merge from here — owner merges)
