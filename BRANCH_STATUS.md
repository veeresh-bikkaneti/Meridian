# BRANCH_STATUS.md — feat/grandpa-finale

Veeresh's finale rework of Grandpa's Coffee Run (2026-10-07).

## Done
- [x] Slower walk: 5.2s → 9.5s stroll, slower bob/cane-tap, more sips
- [x] NEW seated finale: wooden chair, facing viewer, mug raised with continuous steam
- [x] Pointer-tracking eyes + subtle head turn (mirrors Comet's 8-sector gaze math: 70px dead zone, hysteresis, rAF throttle, touch taps)
- [x] Thought cloud "opens up" into persistent donation bubble: "Help me buy coffee! ☕ / Grown-ups — donations keep Meridian free for kids"
- [x] Halfway cheers beat kept ("Support the Expedition / Grown-ups — help keep Meridian funded and free for kids")
- [x] Tap → "Ask a grown-up" gate → Ko-fi (unchanged, fail-closed)
- [x] Reduced-motion: seated statically, bubble shown, no tracking/animation
- [x] Inline SVG only, zero sfx/analytics, env-gated, offline-hidden
- [x] tsc clean
- [x] E2E specs updated (desktop 9 tests incl. eye-tracking test, reduced 2 tests)
- [x] Incorporates the funding-copy wording (folded in from fix/grandpa-funding-copy's uncommitted work — that separate PR is now redundant)

## Pending
- [x] Unit suite green (837/837)
- [x] lint-cards.mjs GATE PASSED
- [x] build:pages green (with + without VITE_KOFI_URL — fail-closed verified: 0 ko-fi URL hits in no-env build)
- [x] Playwright E2E: 9/9 desktop + 2/2 reduced + 3/3 mobile (390px CTA coverage) — 14/14 green
- [ ] Push branch, open PR (Veeresh merges)
