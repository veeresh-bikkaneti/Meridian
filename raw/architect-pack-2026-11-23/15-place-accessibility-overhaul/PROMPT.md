# 15 — Place accessibility overhaul (Cold Trail sighting anchors)

## Intent (one line)
Make Cold Trail's sighting anchors usable by kids: a real ring-placement mode, a famous-anchor gazetteer, and age-banded place pools across editions.

## Why (origin)
The owner's phone play-test found Cold Trail sighting anchors unusable for kids, and the Place ring button auto-revealing answers instead of letting the player place the ring. A Scrum-panel spec was written covering placement mode, gazetteer, and age-banded pools.

## Scope IN
- Real placement mode (the player places the ring; the game judges the placement).
- Famous-anchor gazetteer as the sighting vocabulary.
- Age-banded place pools across editions.

## Scope OUT
- Chitti building it: **the owner's separate AI builds this; Chitti reviews against the acceptance criteria.** The final gate is the owner's own play-test — "a kid could do this".

## Locked decisions
- Ownership split as above (owner's assignment; a relayed failure or offer does not reassign it).
- Honesty rule from the map quiz applies: a raw pin is never a named place — nearest-match is qualified ("near …").

## Acceptance criteria
- The owner's kid-standard play-test passes on his phone.
- Chitti's acceptance review against the panel spec is clean.

## Assets & related work (in this folder)
- `GOAL.md` — the goal record with the spec summary and ownership split.

## Open questions for the architect
1. Is the spec's placement-mode interaction (place-then-judge) right for the youngest band, or does placing need a snap/assist that doesn't auto-reveal?
2. Gazetteer governance: who adds anchors, and what keeps them famous-only?

## Status & evidence
- Spec done (2026-10-09 era); build sits with the owner's other AI; no build has arrived for review. Record unchanged since 2026-10-11.
