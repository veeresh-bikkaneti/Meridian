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
- [ ] Witness eligibility re-measured from the names index
- [ ] Generator written; pack deck generated
- [ ] Pack loader + packId type + guard exports
- [ ] Tests (generator, loader, core byte-stability)
- [ ] Gates: tsc, npm test, lint-cards, build:pages
- [ ] Pushed; slice report to the swarm parent
