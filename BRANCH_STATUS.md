# BRANCH_STATUS.md — fix/comet-greeting-every-visit

## Active work
- [x] Remove once-per-day gate — greeting plays on every home visit
- [x] Update E2E tests for new behavior
- [ ] Verify tsc + tests
- [ ] Open PR

## Context
Veeresh 2026-10-06: "Would like to play each time user ends up on home page."
"Player can choose to mute." The mute is via the existing global sound toggle
(isSoundEnabled) — no date gate needed.
