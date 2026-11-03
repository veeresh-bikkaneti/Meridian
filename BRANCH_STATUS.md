# BRANCH_STATUS — swarm/runtime-core

- **Branch:** `swarm/runtime-core`
- **Base:** `main` @ `193b57c` (#321 home card films)

## Task capsule

TASK / requested outcome: Slice 1 of the capitals pack swarm. Build the
GeoDetective pack runtime core from the owner-approved design
(`~/workspace/meridian-story-packs/DESIGN.md`, §12 questions settled as
recommended): pack format types for `meridian.pack.case.v1`, a build-time
composer that writes pack cases as ordinary clue files at global indexes
387 and up, the lazy pack-metadata sidecar (briefings and pairing reveals),
per-deck state in the loop store with migration, and tier-banded pack deck
construction (pack tiers 1 to 3, famous first). The Paris case runs end to
end as the pilot: record, composer, dealt in a test, reveal reads the
sidecar.

Interpretations considered and selected reading: the design prices the
separate-deck model in §6 (new subset deal function, per-deck state,
validator, migration, deck-aware resume, peek, and reset). This slice pays
that price. The core deck's 387 cases and every existing caller keep their
current behavior; core functions stay in place and pack support is added
beside them.

Tier and rationale: Tier 2 work (new module, storage schema change) under
the swarm assignment. The owner approved the design checkpoint on
2026-11-03; DESIGN.md is the design of record for this slice.

Done condition / evidence: unit tests pass for the tier-banded deck
builder, the deck-aware store paths (deal, complete, clamp, peek,
migration of a pre-pack save), the pack validators, and the pack schema
and composer. The Paris pilot validates against its Wikipedia extracts,
composes to `public/loop/clues/387.json` plus
`public/packs/capitals/manifest.json` and `loop-meta.json`, deals from a
pack deck in a test, and the loop screen reads its briefing and blurb from
the sidecar. Typecheck clean, `npm test` green, production build green.

Files and interfaces in scope: `src/game/loop/types.ts`,
`src/game/loop/store.ts`, new `src/game/loop/packs.ts`,
`src/game/loop/LoopScreen.tsx` (deal and sidecar wiring only),
`scripts/packs/` (schema, composer, Paris record, tests), the three pilot
artifacts under `public/`, and new test files. Out of scope: the home-card
copy region of `game-app.tsx`, `card-film.test.ts`, `card-media.ts`
(Track A), Cold Trail generation (Slice 3), shelf chips (Slice 4), and the
Direction B2 loss-reveal credit (the engine has no guess analysis for it;
priced as a follow-up for the Stacker in the slice report).

Verification contract: `node --experimental-strip-types --test` on the
loop tests, `node --test` on the scripts tests, `npx tsc --noEmit`,
`npm test`, `npm run build:pages`.

## Status

- [x] Workspace inventoried; predecessor state verified (branch, deps, design read).
- [ ] Deck machinery in types.ts and store.ts, with tests.
- [ ] packs.ts manifest and sidecar types with validators, with tests.
- [ ] Pack schema and composer under scripts/packs/, with tests.
- [ ] Paris pilot record validated; pilot artifacts generated.
- [ ] LoopScreen wiring: active-deck deal, pack manifest fetch, sidecar read.
- [ ] Full gates green.
