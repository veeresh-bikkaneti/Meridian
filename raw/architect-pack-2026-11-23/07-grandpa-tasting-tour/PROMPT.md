# 07 — Grandpa tasting-tour: the full home-page journey

## Intent (one line)
Grandpa walks a trail across the Home page — past each option card, coffee in hand — ending at the bench beside the mascot, where the grown-ups' coffee ask appears.

## Why (origin)
The owner's own design (goal record): Grandpa walks from the top-left by the Meridian banner, weaving around (never behind or on) the option cards; he stops at each option to look and sip coffee, then gets a kettle top-up at the park bench beside the mascot before the parent-directed "Grown-ups — buy me a coffee?" ask appears. Real animated Grandpa, measured-box routing, once-per-day replay.

## Scope IN
- The full trail walk with per-card stops, sips, bench top-up, and the closing ask, on the shipped Home page.
- Motion law: the loop plays in full unless a real tap, keypress, or pause stops it — never a timer cut-off.

## Scope OUT
- Changing the shared footer's Grandpa (defined once in the shared footer component) beyond what the journey needs.

## Locked decisions
- **Shipped beat (PR #539, merged 2026-11-19):** Grandpa says his looping line — "these hills did not ask my permission" — **once per session**, then parks; seated and silent on route changes. Owner-verified behaviour: hard-reload Home → he walks, says the line once, parks.
- Settled state is the product truth: judge the journey at its settled state, not mid-transient.

## Acceptance criteria
- The full journey plays on the live Home at phone + desktop widths, never covering the mascot (Grandpa passes in front of the hero storyteller, never over him).
- Owner's hard-reload check passes: walk → stops → bench → ask, once per day.

## Assets & related work (in this folder)
- `GOAL.md` — the owner's journey design as recorded.
- Related capture on file (not copied): `grandpa-tour-beats-390px.mp4` in the landmark worktrees' `docs/motion-verify/`.

## Open questions for the architect
1. Is the full journey worth its build weight against the shipped once-per-session beat — what does the long version buy a first-time parent?
2. Routing around cards whose layout shifts per viewport: measured-box routing vs a fixed path per breakpoint?

## Status & evidence
- PR #539 merged to main `e01874fc` (2026-11-19), live-verified. The FULL journey remains an open goal; the owner's hard-reload check of the shipped beat is still pending.
