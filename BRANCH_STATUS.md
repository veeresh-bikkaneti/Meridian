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
- [x] Gates: typecheck, npm test, lint-cards, build:pages, E2E

## Results (2026-11-03)

Commits: c1497c8 shelf component and data adapter, 611435a data
tests, ee05921 screen mounts and pin tests, d2738d7 E2E spec.

Gates, all on the final tree: npx tsc --noEmit clean. npm test green
(scripts 850 pass / 0 fail; src suite green, 26 of them the shelf's).
node scripts/lint-cards.mjs GATE PASSED. npm run build:pages green
(buildId d2738d7). Playwright, flock, workers=1, bundled
chromium-1243: pack-shelf spec 6 passed; control tests (existing
Cold Trail region-context and GeoDetective seam tests) 2 passed.

E2E failure history, dispositioned: the first run used the default
/opt/meta-chromium, which refuses to launch on this VM (WebGL domain
policy, exit 13). The second run hit a first build whose process had
been cut before it wrote the HTML shell, so every page 404ed; the
control spec failed the same way on that artifact. A full rebuild
fixed the artifact, and both the shelf spec and the controls pass on
it. No product defect in either failure.

Workspace note: the clone moved mid-run from
~/workspace/meridian-swarm/shelf to ~/workspace/meridian-swarm-shelf
after the swarm parent warned that the managed meridian-swarm
directory had removed slice 1's workspaces. No files lost; the branch
tip was already pushed. Ledger carries the move.

Assumed slice 1 interfaces (for the Stacker): see the header comment
in src/components/pack-shelf-data.ts. In short: selection lives under
meridian.pack-shelf.v1 and the deal path reads it through
readSelectedDeck(); both screens pass activeDeckId "all" until
dealing is deck-aware; GeoDetective pack progress waits on slice 1's
per-deck store; the home card subtitle line from DESIGN section 7 is
untouched (Track A region) and stays an integration follow-up.
