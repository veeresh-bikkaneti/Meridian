# Branch status: feat/capitals-pack

Story packs (issue #319), integration branch. The Stacker integrates the
four swarm slices into one PR. Base: main `193b57c` (PR #321 merged).
PR #322 (Track A, card copy) is still open at head `f7ccd6c`, so this
branch bases on `193b57c`. If #322 merges first, this branch rebases
onto the new main before the merge; the PR body records that debt.

## Task capsule

TASK / requested outcome: integrate swarm slices 1 to 4 (runtime core,
capitals content, Cold Trail adapter, pack shelf) into one branch,
resolve the six named seams, and run the full review pipeline to READY.
No merge. The owner's per-PR word gates merging.

Slices and tips: swarm/runtime-core `093ec58`, swarm/capitals-content
`c5ba2b8`, swarm/coldtrail-adapter `762cb0d`, swarm/pack-shelf `3f06576`.

Seams to resolve:
1. One selection store. Slice 1's loop store owns dealing; the shelf
   reads and writes selection through it instead of meridian.pack-shelf.v1.
2. Cold Trail pack progress key and shape match Slice 3's store.
3. Pack manifest carries coldtrailFile; composer re-run so loopIndexes
   and loopTiers cover all 72 cases.
4. Slice 1's schema and composer accept Slice 2's three record additions
   (schema field, directions array plus direction, target.aliases). Both
   validators green over all 72 on the integrated tree.
5. Deck-correct dealing proven end to end in E2E for both editions.
6. Screens pass the open case's real deck id as activeDeckId.

Out of scope, recorded in the PR body: the Direction B2 loss-reveal
credit, the home card subtitle from DESIGN section 7 (Track A region),
alias widening for the five repair-2 cases.

Frozen: PRs #297, #299, #302, #305, #307, #308, #309, #311, #312, #322.
This branch does not edit, comment on, or rebase any of them.

## Status

- [x] Integration clone created; branch cut at `193b57c`
- [ ] Slice 1 merged (runtime core)
- [ ] Slice 2 merged (capitals content)
- [ ] Slice 3 merged (Cold Trail adapter)
- [ ] Slice 4 merged (pack shelf)
- [ ] Seams 1 to 6 resolved
- [ ] Gates green on the integrated tree (tsc, npm test, test:worker,
  lint-cards, build:pages, E2E under flock)
- [ ] Silo QA pass on the final tip
- [ ] Panel verdict on the final tip
- [ ] DevEx and benchmark recorded
- [ ] PR open at READY
