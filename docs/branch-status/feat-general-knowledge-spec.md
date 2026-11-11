# Branch status — feat/general-knowledge-spec

Stream 17: general knowledge. Spec; build gated. Docs and data only, nothing under `src/`.

**Status: STAGE A DONE — GATED (educator sign-off; Stage B build gate)**

## Task capsule

```text
TASK: Stage A. Reframe general knowledge as a mixed review round that
  interleaves items met in other subjects; add the standard's §9 block; write
  every item as contract I2 data with objective, standard code (live source or
  UNVERIFIED), why-first problem, group, Builds on, use-it-elsewhere.
Files in scope: docs/scaling/general-knowledge-spec.md,
  docs/scaling/general-knowledge/**, this file. src/subjects/general-knowledge/**
  untouched (Stage B).
Verification: node --test docs/scaling/general-knowledge/items.test.mjs (14/14);
  all JSON parsed. No AGENTS.md code gates ran (docs only).
Approvals needed: owner lifts the Stage B gate; a named human educator signs.
```

## Done

- [x] Spec rewritten around the mixed-review reframe; §9 block filled; CUT
      log; earlier P10/P11/P12 scope recorded; vendor and voice names removed.
- [x] `general-knowledge/items.json`: 11 mixed-review items (6 / 3 / 2 across
      7-10 / 10-18 / 18+), PROPOSED. 9 cite a code read live 2026-11-10
      (CCSS via the CCSSO PDF, NGSS 5-ESS1-2); 2 are 18+ UNVERIFIED with a Fit note.
- [x] Fixtures: 6 geography places from the live globe deck (C3 D2.Geo.3.3-5),
      including Angkor Wat and Uluru restored as place-only entries (owner,
      2026-11-10, PRs 399 and 416). Math and physics link to the real
      `docs/scaling/math/number/items.json` and `docs/scaling/physics/items.json`
      on main.
- [x] `rounds.json`: 5 example rounds, PROPOSED.
- [x] `items.test.mjs` validator; mutation-checked (4 planted faults caught).
- [x] `sources.md` (every fact and worked answer), `council.md` (3 seats, 8 calls).

## Integrator fix, 2026-11-10 (PR #409)

- [x] `noon-shadow` buildsOn `physics:light:shadow-noon` (not in the physics
      items) replaced by `physics:shadow:blocks`, confirmed present in
      `docs/scaling/physics/items.json` on origin/main (PR 398 merged). The
      physics fixture file is deleted.
- [x] `items.test.mjs` reads physics ids from `docs/scaling/physics/items.json`;
      the physics check is skipped when that file is absent (checked: 13 pass,
      1 skipped with the file moved away locally, then restored).
- [x] Owner ruling: year-gap answers are `currentYear − X` at play time.
      `opera-years-ago` now says so; no other item has a year gap. New test
      fails on a literal answer (checked with a planted "entering 53").

## Owner fix, 2026-11-10 (t335u, PR #409)

- [x] **G2 ANSWERED (2026-11-10):** P11 current affairs is out of scope under
      §7a and is dropped. The `{p11}` placeholder is removed from the spec.
      P10 and P12 are unchanged. Council and this file say the same; G2 is
      off the open list.
- [x] Angkor Wat and Uluru restored as place-only geography fixtures (owner
      kept them in PRs 399 and 416). Wording is architecture/geography only,
      taken from PR 399 (Uluru story is the first sentence only); no
      distance, height or depth in any story line. Sources cited from the
      PR 399 reword table (not re-fetched on this branch).

## Open

1. Stage B build: gated until the owner lifts the build gate for this branch.
2. Educator sign-off: no named educator (rubric not attached).
3. Owner questions G1, G4 and G5 in the spec (educator, counts, world-view curriculum), all with the educator. Answered 2026-11-11: G3 (a mode inside "Review my misses"), G6 (keep source units), G7 (cite the official standards documents).
4. Geography fixtures are swapped for real geography items when that subject publishes I2 data.
5. Host-line readability: not measured (no host lines written in Stage A).
