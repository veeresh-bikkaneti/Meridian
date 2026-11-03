# Branch status: swarm/pack-shelf

Story packs, swarm slice 4 of 4: the pack shelf UX. Base: main 193b57c.
No PR from this branch. The Stacker integrates the four swarm slices.

## Task capsule

TASK / requested outcome: Shelf chips inside both edition entry screens
(GeoDetective LoopScreen, Cold Trail TrailScreen). Chips list the decks
(the core deck and the Capitals pack), show cases closed per deck, and
start the next run from the tapped deck when a finished case is on
screen. Built against DESIGN.md (meridian-story-packs, sections 5 to 7).

Interpretations considered and selected reading: DESIGN section 7 draws
the shelf on the home cards. The swarm brief assigns the edition entry
flows and forbids the game-app.tsx card region (Track A owns it, PR
322). Selected reading: the shelf mounts inside LoopScreen and
TrailScreen. The home card subtitle update from section 7 stays an
integration note for the Stacker.

Tier and rationale: Tier 2 (new feature, several files). Process is the
swarm slice contract: build, unit tests, E2E, gates, report to Stacker.

Done condition: chips render in both screens with real button semantics,
44px targets, honest per-deck progress; a chip tap stores the selection;
a chip tap on a finished case starts the next case; zero layout shift
when the pack chip arrives late; typecheck, unit suites, lint-cards,
build, and the new E2E spec green.

Files in scope: src/components/pack-shelf.tsx (new),
src/components/pack-shelf-data.ts (new),
src/components/pack-shelf-data.test.ts (new),
src/components/pack-shelf.test.ts (new),
src/game/loop/LoopScreen.tsx (shelf mount only),
src/game/coldtrail/TrailScreen.tsx (shelf mount only),
tests/e2e/pack-shelf.desktop.spec.ts (new), this file.
Out of scope: game-app.tsx (all of it), card-film.test.ts,
card-media.ts, store and engine internals (slice 1), content files
(slice 2), the Cold Trail pack case file (slice 3), LockedLoop.

Assumptions, risks, unknowns: Slice 1's per-deck store API is not final.
Selection and progress reads sit behind pack-shelf-data.ts, one adapter
module, and every assumed interface is listed in the slice report.
Until slice 1 lands, dealing still comes from the core deck; the shelf
stores the selection the deal path will read.

## Status

- [x] Design and repo grounding (DESIGN sections 5 to 7, both screens,
  both stores, test patterns)
- [x] Shelf data module and component
- [x] Unit tests (logic plus source pins)
- [x] Screen mounts (LoopScreen, TrailScreen)
- [x] E2E spec (both entry flows, late-manifest layout shift)
- [ ] Gates: typecheck, npm test, lint-cards, build:pages, E2E
