# BRANCH_STATUS — swarm/coldtrail-adapter

- **Branch:** `swarm/coldtrail-adapter`
- **Base:** `main` @ `193b57c` (PR #321 merged)

## Task capsule

TASK / requested outcome: PSTACK SWARM slice 3 of 4 (story packs,
issue #319). Build the Cold Trail adapter for the capitals pack: an
isolated generation pass that deals capitals cases in Cold Trail
form, plus the runtime loader for the pack deck. Design of record:
~/workspace/meridian-story-packs/DESIGN.md §1.4 and §2.2, and
CAPITALS-PACK.md (72 curated capitals: 44 countries + 28 US states).

Interpretations considered and selected reading: capitals are the
witness anchors, never the hideout (DESIGN §2.2). The "Capital
Hideout finale" was cut in design review and stays cut. Hideouts come
from the same mid-difficulty pool the core generator uses. The pack
generator reads capital ids from Slice 2's pack records
(scripts/packs/capitals/cases/*.json, target.placeId) when present;
until those land it uses the 72 ids listed in CAPITALS-PACK.md,
embedded in the generator with a provenance comment. Generation is
deterministic, so re-running it at integration against the records
gives byte-identical output when the id sets match.

Tier and rationale: Tier 2 (new generator path + new bundled data
file + deck access code under src/game/coldtrail/). Slice scope set
by the swarm brief; the Stacker integrates the four slices and runs
the full pipeline on the combined branch.

Done condition / evidence: the pack file
src/game/coldtrail/cases.capitals.generated.json exists and is
produced by scripts/build-coldtrail-capitals.mjs; tests prove a
sub-300,000-population capital can never anchor a case, the pack
cases hold the same invariants the core generator's tests check, the
pack loader serves only the pack file, and the core deck file is
byte-stable. Gates: npx tsc --noEmit, npm test, node
scripts/lint-cards.mjs, npm run build:pages.

Files in scope: scripts/build-coldtrail-capitals.mjs (new),
scripts/build-coldtrail-capitals.test.mjs (new),
src/game/coldtrail/cases.capitals.generated.json (new),
src/game/coldtrail/cases-pack.ts (new),
src/game/coldtrail/cases-pack.test.ts (new),
src/game/coldtrail/types.ts (additive optional packId field),
src/game/coldtrail/cases.ts (export the two shape guards so the pack
loader reuses the same validation), BRANCH_STATUS.md.

Protected / out of scope: src/game/coldtrail/cases.generated.json
and scripts/build-coldtrail.mjs behaviour (core deck, core seed),
the meridian.coldtrail.v2 store, the GeoDetective loop store
(Slice 1), pack content records (Slice 2), game-app.tsx home-card
region, card-film.test.ts, card-media.ts (Track A), TrailScreen.tsx,
all frozen PR branches. No PR, no merge: the Stacker integrates.

Ownership: swarm slice 3 coordinator, clone
~/workspace/meridian-swarm/coldtrail, branch swarm/coldtrail-adapter.

Assumptions, risks, unknowns: anchor counts in the design (55 of 72
qualify) are re-measured here from the names index, not copied; any
difference is reported with the measured numbers. Slice 2's records
do not exist in this branch yet; the records contract is the
integration point.

## Status

- [x] Workspace cloned, branch cut at 193b57c, ledger claim posted
- [x] Witness eligibility re-measured from the names index:
  55 of 72 qualify (population at least 300,000, difficulty 1 or 2).
  The 17 that cannot anchor are 16 state capitals plus Reykjavik
  (118,918). The design's counts match exactly on the population
  rule. One nuance the design did not measure: the core generator's
  blurb isCity test would also drop Washington (population 689,545)
  because its blurb names the District of Columbia. The pack pass
  does not apply that test to the curated list; the decision and the
  reasoning are in the generator header, and a test pins Washington
  as eligible.
- [x] Generator written; pack deck generated: 60 cases, 51 distinct
  capital anchors used, every case stamped packId "capitals"
- [x] Pack loader + packId type + guard exports
- [x] Tests: generator 4/4, loader 4/4 (core cases tests 4/4
  alongside), core deck byte-stability proven against buildDeck()
- [x] Gates on tip d1a42a9: npx tsc --noEmit clean; npm test scripts
  854 pass / 0 fail / 11 skipped, src 1900/1900 pass; lint-cards
  GATE PASSED; npm run build:pages exit 0 (buildId d1a42a9), and
  exactly 1 built chunk contains the pack data
- [x] Pushed; slice report to the swarm parent

## Commits

- 7d83174 branch status and task capsule
- 2518090 generator + generated pack deck
- 35b44ff pack loader, packId type, shared case guards
- d1a42a9 tests (plus the measureWitnessPool export they use)

## Integration notes for the Stacker

- Regenerate the pack deck after Slice 2 lands: run
  node --experimental-strip-types scripts/build-coldtrail-capitals.mjs.
  When scripts/packs/capitals/cases/*.json exists, the generator
  reads target.placeId from the records and ignores the embedded
  fallback list. Deterministic seed, so identical id sets give a
  byte-identical file.
- The pack store key meridian.coldtrail.pack.capitals.v1 is exported
  as COLDTRAIL_PACK_CAPITALS_STORAGE_KEY from
  src/game/coldtrail/cases-pack.ts. No screen reads the pack deck
  yet; shelf wiring (Slice 4) connects getCapitalsPackCase and
  capitalsPackCaseCount from the same module.
- The pack manifest (public/packs/capitals/manifest.json with its
  coldtrailFile field, DESIGN section 1.2) is not created here. It
  belongs with the GeoDetective-side manifest work.
- Sighting text uses the core generator's witness-report templates
  unchanged (DESIGN section 2.2: templates need no change). The
  stamp data the SightingCard needs (capital name plus country)
  already rides on each sighting as cityName and region.country.
