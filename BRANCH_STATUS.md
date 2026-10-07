# BRANCH_STATUS.md — feat/grandpa-coffee-run

## Active work
- [x] Grandpa's Coffee Run animated donation scene (Veeresh 2026-10-07 vision, overriding PR #91's static sign)
- [x] 4-beat timeline: entrance → walk (dotted trail unrolls) → cheers at 45% (fourth-wall ask) → arrival (parks by Comet, idles)
- [x] Inline SVG grandpa (side + front poses), thought cloud (coffee refill), dotted map trail
- [x] Reused SupportGateDialog (moved OUTSIDE pointer-events:none scene — dialog was unclickable inside)
- [x] PR #91 sign deleted (tsx + css + 2 spec files) — no duplication
- [x] Hard rules: VITE_KOFI_URL fail-closed, offline hidden, zero sfx/analytics, reduced-motion fully static
- [x] tsc clean, unit green, lint-cards GATE PASSED, build:pages green
- [x] E2E: 8/8 desktop + 2/2 reduced + 360px CTA check + fail-closed check, all green
- [ ] Open PR (Veeresh merges)

## Context
Veeresh 2026-10-07 explicit vision: grandpa walks from left following map
directions, cheers the viewer halfway with the mug, thought cloud follows
him to Comet and stays. Walk ~5s, one loop, then quiet idle. The cheers beat
is the single attention moment — everything else ambient.

## Bug found & fixed during E2E
The gate dialog was initially rendered inside `.grandpa-scene`
(pointer-events:none) — visible but unclickable ("<html> intercepts pointer
events"). Moved SupportGateDialog outside the scene as a sibling.
