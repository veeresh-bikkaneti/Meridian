# BRANCH STATUS — test/td-14.4-seed-seen-except-guard

**Branch:** `test/td-14.4-seed-seen-except-guard` · **Base:** `origin/main` `7dbf62eb` (post-#582; fetched and verified before branching — main had not moved)
**Task:** TD-14.4 — `seedSeenExcept` dealing-pool coverage guard, follow-up under story TD-14 (issue #314). Tier 1, solo, no council needed; builder is not the checker — the Reviewer seat takes it next.

## What shipped

- `scripts/check-seed-seen-except.mjs` — the guard. Statically re-derives every
  `seedSeenExcept` call site's (edition, region, band, keep id) from the live
  `tests/e2e/*.spec.ts` tree (all three call shapes: shared full-arg, key-first
  local, page-only local) and asserts each forced id is a member of that band's
  ACTUAL dealing pool — the same math the game runs (`tier-filter.ts`
  TIER_BANDS + `easy-curation.ts` rungs over curated starters + chunk places,
  with the US country pool aggregating its 50 state chunks per
  `generated-places.ts` aggregateChunkIds). Membership in the raw pool alone is
  NOT the check: the seen-store covers the raw pool, so a keep id outside the
  BAND pool leaves `poolForNewRun` an empty fresh set and the dealer resets the
  cycle — exactly the silent rot #314 names.
- `scripts/check-seed-seen-except.test.mjs` — 9 unit tests riding `npm test`
  (no `package.json` edit; this lane does not own it). Proves: (a) PASS on the
  current tree with the measured census pinned (29 call sites / 12 specs / 19
  distinct forced ids); (b) FAIL by id when a planted forced id is absent
  (both shared-shape and page-only-shape plants); (c) FAIL when a listed
  exception vanishes (KNOWN_MISSING gone stale, KNOWN_DYNAMIC_SITES gone
  stale, unlisted dynamic site appeared).

## Deliberate exceptions (both failure-proofed)

- `KNOWN_DYNAMIC_SITES` — `cleared-mode.spec.ts` and `difficulty-picker.spec.ts`
  compute keep ids from the live pool at runtime; cannot fail membership by
  construction. An unlisted dynamic-shaped site is a FAILURE, and a listed
  entry whose call site vanished is a FAILURE.
- `KNOWN_MISSING` — the measured findings, named, not silently dropped:

## Measured finding (issue #314 is already live on main)

`admin1-narrow.desktop.spec.ts` forces **Osaka `gn-1853909`** (line 106) and
**Tokyo `gn-1850147`** (line 114) on `country/japan/easy`. The easy storied
rung engages (29 places ≥ EASY_MIN_POOL 25) and includes neither: both are
tier-1 with **no `history` enrichment**, so `curateEasy` drops them. At
runtime the seed marks every raw-pool id seen — the storied rung comes back
fully seen — `poolForNewRun` resets the cycle and deals an arbitrary storied
place, so the spec's `expect(readQuestion).toBe("Find Osaka, Osaka.")` runs
against a ~1-in-29 chance. The spec sits outside the routine CI e2e list
(`node.js.yml` runs a short fixed set; `detective-e2e.yml` runs `detective*`),
which is why it rotted silently. **This lane does not own that spec and did
not edit it, and did not drop the seeds** — the two sites are recorded in
`KNOWN_MISSING`, printed on every run, and the guard FAILS "stale
KNOWN_MISSING" the moment a regen restores their history or the seed is
retargeted, so the entry cannot linger either.

## `seedDeterministicDeal` audit (recorded, no product change)

`tests/e2e/reveal-pin-compare.desktop.spec.ts` — the spec's own header
documents that the frozen RNG streams do NOT pin the first globe deal on
current main (first deals observed varying between sessions — #298 Spain /
Hong Kong / Uganda) and mandates that no test here may depend on WHICH place
is dealt first. Verified against the test bodies: `readQuestion` derives the
truth's country from the served question (line ~178), the miss pins are fixed
viewport coordinates probed end-to-end, and the hit/ocean tests are
deal-independent. **Conclusion: no assertion transitively depends on deal
ORDER under `seedDeterministicDeal`; the comment at lines 91–93 is accurate.
No spec edit needed.**

## Gates (see PR body for the full table)

Unit suite fully green including the new tests; remaining gates run at PR time.
Provenance clean (no AI/model/vendor names anywhere). Draft PR only —
merge is Veeresh's word, never this lane's.
