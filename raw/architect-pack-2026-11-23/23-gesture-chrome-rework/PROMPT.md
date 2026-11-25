# 23 — Gesture, chrome & zoom-space rework (P0-02/03, Z3, Z4)

## Intent (one line)
Make the map fully visible and touch gestures safe: a compact translucent collapsible bottom bar, restored pinch/double-tap zoom, and zoom ranges that can pull back beyond the region — out to a globe-in-starfield view.

## Why (origin)
The owner's own screenshot review: the map was crowded by chrome and gestures were unsafe (a double-tap could drop a pin). Crew-driven rework, all on local branches **handed over for the owner's own push** — nothing pushed or deployed by the crew.

## Scope IN
- **P0-03:** bottom bar becomes a compact translucent collapsible floating bubble; full-bleed map.
- **P0-02:** pinch + double-tap zoom restored, with an explicit Drop pin button (double-tap never places or drops a pin).
- **PBI-Z3:** zoom out beyond the region in State/Country mode.
- **PBI-Z4:** zoom-to-space — globe in a starfield, maptap.gg-style, zero new packages.

## Scope OUT
- Crew pushing or deploying: branches were handed to the owner; his push is the gate. Sequencing of Z3/Z4 is the crew architect's call, already delegated.

## Locked decisions
- Double-tap never places/drops — the Drop pin button is the only pin-drop gesture.
- Zero new packages for Z4.

## Acceptance criteria
- Owner's phone check of the de-crowded layout; owner pushes the handed-over branches; then the normal per-PR pipeline applies.

## Assets & related work (in this folder)
- `FEATURE_MAP.md` — the rework's feature map.
- `p0-02-p0-03-final-report.md` — the P0-02/03 build report.
- `GOAL.md` — the goal record (queue: Z3, Z4; handover terms).
- More in the goal workspace `files/`: scoring proposal, street-view options, UI/maps review (referenced, not copied).

## Open questions for the architect
1. Z4 (globe in starfield) vs the shipped home globe's own zoom model (item 14): do the two zoom languages collide, and should they be one system?
2. A collapsible floating bubble over a full-bleed map — what keeps it discoverable for a first-time kid?

## Status & evidence
- P0-02/03 built on local branches, handed over in October; record unchanged since 2026-10-14: "Waiting on your phone check of the de-crowded layout and your push of the handed-over rework branches." Z3/Z4 queued behind them.
