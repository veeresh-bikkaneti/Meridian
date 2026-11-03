# Branch status: feat/capitals-pack

Story packs (issue #319), integration branch. The Stacker integrated
the four swarm slices into one branch and runs the review pipeline to
READY. No merge. The owner's per-PR word gates merging.

Base: main `193b57c` (PR #321 merged). PR #322 (Track A, card copy)
is still open, now at cured head `cd6d47b`, so this branch stays based
on `193b57c`. If #322 merges first, this branch rebases onto the new
main before its own merge. The PR body records that debt.

## Task capsule

TASK / requested outcome: integrate swarm slices 1 to 4 (runtime core,
capitals content, Cold Trail adapter, pack shelf) into one branch,
resolve the six named seams, and run the full review pipeline to
READY. No merge.

Slices and tips: swarm/runtime-core `093ec58`, swarm/capitals-content
`c5ba2b8`, swarm/coldtrail-adapter `762cb0d`, swarm/pack-shelf
`3f06576`. Integration commits: `6c7fce1`, `a103243`, `881a2fa`,
`0b58447`, `902e65c`, `f776fd1`, then `0e24e96` (dealing-proof E2E).

Seams and how they closed:
1. One selection store per edition. The GeoDetective loop store owns
   its selection (`activeDeckId`); Cold Trail selection lives in the
   shelf selection blob under its own key. One store per edition
   because the two editions keep separate progress stores today, and
   the dealer for each edition reads exactly the store its chips
   write.
2. Cold Trail pack progress key and shape match Slice 3's store.
3. Pack manifest carries coldtrailFile; the composer covers all 72
   cases, loopIndexes 387 to 458.
4. Schema and composer accept Slice 2's three record additions
   (schema field, directions array plus direction, target.aliases).
   Both validators pass over all 72 on the integrated tree.
5. Deck-correct dealing proven end to end in E2E for both editions
   (pack-shelf spec, 6 of 6 under the flock).
6. Screens pass the open case's real deck id as activeDeckId.

Out of scope, recorded in the PR body: the Direction B2 loss-reveal
credit, the home card subtitle from DESIGN section 7 (Track A
region), alias widening for the five repair-2 cases.

Frozen: PRs #297, #299, #302, #305, #307, #308, #309, #311, #312,
#322. This branch does not edit, comment on, or rebase any of them.

## Round-1 cure (2026-11-03, on tip f74b708's verdicts)

Round 1 returned 7 panel BLOCKs, a DevEx FAIL, and 2 Silo QA
defects. The cure is built on this branch in 11 commits
(`414ddb6`..`aa0b7f4`); the full per-item record with evidence is
`~/workspace/meridian-capitals-evidence/cure/CURE.md`. In short:

- Code: edition-true Cold Trail pack total (60, not 72) end to end;
  TrailScreen mount resume (an unrevealed case in exactly one deck
  opens on that deck, ahead of the selection blob); deck-aware cycle
  celebration (Capitals copy denominated in 72, core copy
  byte-identical); 320px shelf second-row reserve; ride-alongs
  (role="status", reset clears the shelf blob, manifest-validator
  parity, missing-sidecar screen test).
- Content: duplicate targets cured by swap — Nairobi and Ankara
  (already core clues 74/218) replaced by Accra (Ghana) and Abu
  Dhabi (UAE) at tier 3, authored to the full standard; 459 unique
  targets restored, pack stays 72, Cold Trail deck stays 60 and now
  teaches 51 anchor capitals. Indianapolis hook carries no
  measurement string. Addis Ababa and Nashville giveaways rewritten
  as capital-only role facts (Addis hook rung untouched).
- Validators: all 72 records state Direction A only; the B2 subject
  rule is stated in the same words in schema.mjs and
  validate-pack.mjs, and validate-pack now calls schema's
  validatePackRecord for the shared checks (equivalence test pins
  both gates on a synthetic B2 record).
- Docs: design vendored at docs/story-packs.md with the v1 truth
  corrections; README passage; docs/geodetective.md updated (459
  clue files, pack-owned indexes 387-458); Handbook ch05 records
  the owner's 2026-11-02 packs-not-modes ruling; runbook at
  scripts/packs/README.md plus packs:* npm scripts; the Cold Trail
  generator's stale fallback header corrected.

Gates on the cured tip (all run unpiped, real exit codes):
validate-pack --all exit 0 (72/72); composer re-run drift limited
to generatedAt (restored); npm test exit 0 (scripts 953: 942 pass /
11 skipped / 0 fail; src 1964 pass / 0 fail); test:worker exit 0
(85/85); tsc --noEmit exit 0; lint-cards GATE PASSED; lint-content
exit 0 (6 baselined, 0 new); build:pages exit 0; perf:bundle entry
JS 982,696 raw / 306,177 gzip, CSS 130,790 raw / 26,137 gzip; E2E
under the flock: pack-shelf desktop + new 320px mobile spec, 8/8.

## Status

- [x] Integration clone created; branch cut at `193b57c`
- [x] Slice 1 merged (runtime core)
- [x] Slice 2 merged (capitals content)
- [x] Slice 3 merged (Cold Trail adapter)
- [x] Slice 4 merged (pack shelf)
- [x] Seams 1 to 6 resolved
- [x] Gates green on the integrated tree (validate-pack 72 of 72,
  composer deterministic apart from generatedAt, npm test exit 0,
  typecheck clean, worker tests 85 of 85, pack tests 85 of 85,
  lint-cards passed, build:pages exit 0, pack-shelf E2E 6 of 6
  under the flock)
- [x] Round-1 cure built (11 commits, gates above)
- [ ] Silo QA pass on the final tip
- [ ] Panel verdict on the final tip
- [ ] DevEx and benchmark recorded
- [ ] PR open at READY
