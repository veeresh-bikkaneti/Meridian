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

Interpretations considered and selected reading: (a) one shared
selection blob for both editions — rejected, because each edition's
dealer reads only its own progress store, so a shared blob would be a
second source of truth one dealer never reads; (b) one selection
store per edition, each dealer reading the store its chips write —
selected (seam 1 below).

Tier and rationale: Tier 2. A new content system across many files,
with storage keys and a pack schema; the full review pipeline
(Silo QA, 12-role panel, DevEx, benchmark) applies.

Budget: Tier 2 default parent cap (400k tokens) covers this run and
all its delegates. No token meter exists for the run, so no count is
claimed here.

Approvals and checker: the owner approved the design and ordered the
build on 2026-11-03 ("Approve design — build the capitals pack",
"Pstack swarm"). Merge is NOT approved; it waits for the owner's
per-PR word on the final tip. Checkers are independent of the
builder: Silo QA (clean context) and the 12-role panel.

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
credit (it depends on reverse-direction B1/B2 play being built
first; no B2 case can be lost until B2 cases deal), the home card
subtitle from DESIGN section 7 (Track A region), alias widening for
the five repair-2 cases.

Frozen: PRs #297, #299, #302, #305, #307, #308, #309, #311, #312,
#322. This branch does not edit, comment on, or rebase any of them.

## Round-1 cure (2026-11-03, on tip f74b708's verdicts)

Round 1 returned 7 panel BLOCKs, a DevEx FAIL, and 2 Silo QA
defects. The cure is built on this branch in 12 commits
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

## Verdict (2026-11-03, on cured tip `9062a7f`)

Re-verification on the cured tip: Silo QA PASS (fresh clone, 10 of
10 cure items, 11 of 11 gates unpiped); panel re-vote 1 APPROVE /
11 APPROVE-WITH-NITS / 0 BLOCK; DevEx re-check PASS-WITH-NITS;
benchmark PASS (entry JS +0.36% raw / +0.30% gzip against main).
CI at verdict time on `9062a7f`: build (22.x) PASS, GitGuardian
PASS, e2e PASS; Workers Builds fails as on every tip and is not a
required check. The Boise and Addis Ababa hooks stand as ruled in
round 1; both texts are byte-identical on the cured tip.

This file's sync commit lands on top of the voted tip as a
records-only change; the panel vote, the QA ledger entry, and the
verdict all key to `9062a7f`. Remaining LOW nits from the re-vote
are follow-ups in the PR body and the verdict record, not cures.
The PR is at READY. Merge waits for the owner's per-PR word. If
PR #322 merges first, this branch rebases; the overlap is this
file only, and the panel re-votes only if that rebase touches code.

## Status

- [x] Integration clone created; branch cut at `193b57c`
- [x] Slice 1 merged (runtime core)
- [x] Slice 2 merged (capitals content)
- [x] Slice 3 merged (Cold Trail adapter)
- [x] Slice 4 merged (pack shelf)
- [x] Seams 1 to 6 resolved
- [x] Gates green on the integrated tree (validate-pack 72 of 72,
  composer deterministic apart from generatedAt, typecheck clean,
  worker tests 85 of 85, pack tests 85 of 85, lint-cards passed,
  build:pages exit 0, pack-shelf E2E 6 of 6 under the flock).
  Correction to this round-1 box: its "npm test exit 0" line was
  wrong — that reading came from a piped command whose exit code
  belonged to the pipe; the suite in fact failed on that tip (the
  two defects the cure then fixed). The corrected record is in the
  coordination ledger and the evidence folder.
- [x] Round-1 cure built (12 commits, gates above)
- [x] Silo QA pass on the final tip (`9062a7f`, re-check PASS)
- [x] Panel verdict on the final tip (re-vote: 0 BLOCK, READY)
- [x] DevEx recorded (re-check PASS-WITH-NITS)
- [x] Benchmark recorded (cured tip, PASS — see the verdict section)
- [x] PR open at READY (PR #323; merge waits for the owner's word)
