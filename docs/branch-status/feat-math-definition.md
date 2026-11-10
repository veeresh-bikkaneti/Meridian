# BRANCH_STATUS — feat/math-definition

Workstream 2 of the Meridian scaling-plan push: Math definition (P1 + P3).
Docs/briefs only — NO code. Base: origin/main `f37dea50`.

**Status: PREPARED — AWAITING EDUCATOR SIGN-OFF**

## Stage A pass, 2026-11-10 (number strand) — read this first

Task capsule (AGENTS.md):

```text
TASK: Stage A of the number strand (counting, place value, multiplication,
  division, fractions): standard's §9 block, items as contract I2 data,
  math's "confident" bar, educator evidence pack for Times Table Races.
  Stage B (build v1) only after the owner lifts the build gate.
Reading chosen: the earlier spec (sections 1-10) stays untouched; a new
  section 11 is appended. "Evidence pack" = the rubric's 7 items, prepared,
  not signed.
Tier: Tier 0 reading (docs and data, nothing under src/). Tests are not
  implementation code (council protocol §1).
Done condition: spec §11 + items.json + items.test.mjs green + evidence pack
  + this file, pushed, draft PR open.
Files in scope: docs/scaling/math-definition-spec.md (append),
  docs/scaling/math/number/**, this file. Out: src/subjects/** (Stage B).
Verification: node --test docs/scaling/math/number/items.test.mjs (10/10);
  node docs/scaling/math/number/readability.mjs. No AGENTS.md code gates ran.
Budget: Tier 0 cap 25k EXCEEDED (estimated, no meter).
Approvals needed: owner lifts the Stage B gate; a human educator signs.
```

Done in this pass:

- [x] Spec §11: strand shape, item table (generated from the data), confident
      bar and states, deck hookup, v1 plan, K-12 §9 block, open questions N1-N7.
- [x] `docs/scaling/math/number/items.json`: 30 items (19 / 8 / 3 across 7-10 /
      10-18 / 18+), contract I2 shape, counts PROPOSED. 28 CCSS codes fetched
      live 2026-11-10; 2 items UNVERIFIED with the reason stated.
- [x] Educator evidence pack: `times-table-races-evidence-pack.md`, draft
      lines, readability script. Rubric pack item 3 points at the earlier
      spec's §5.2 paper demonstration, which covers only the 10-18 item.

Open:

- [ ] Stage B (Times Table Races, `released: false`, Full / Lite / Flat, tests
      first, gates, screen recording): waiting for the build gate. Nothing
      written under `src/subjects/math-number/`.
- [ ] Human educator sign-off: none. Owner questions: spec §11.8 (N1-N7).
- [ ] Integrator: `learning.ts` / `review-deck.ts` need `correct`, `hintsUsed`,
      `triedAgain`, `setting`, `errorType` on attempts (spec §11.3).

Resume: `git fetch origin && git checkout feat/math-definition && git merge --no-edit origin/main`,
then `node --test docs/scaling/math/number/items.test.mjs`. Work in your own
worktree: this repo's main checkout is shared and another agent switched its
branch mid-session.

## Earlier pass (P1 + P3 definition)

## Done

- [x] `docs/scaling/math-definition-spec.md` — P1 curriculum + topic map
      (CCSS proposed as primary, 2010; topic map Grade 5 up with
      standard citations; corrections applied: 5th grade and up, no 5–7)
      and P3 Math v1 quiz-loop definition (exact answers, host wrap-up
      after every question, lazy-load guardrail).
- [x] Verification gate demonstrated on one complete mode
      ("Times Table Races", 5 problems, recomputation shown, one honest
      detector gap recorded).
- [x] Error taxonomy with machine-checkable detectors.
- [x] Equivalent-form rule recorded OPEN (Q3) with both candidates costed.
- [x] Olympiad placement draft recommendation (separate mode), decision
      open (Q10).
- [x] Open owner questions recorded: Q1, Q2, Q3, Q6, Q7, Q8, Q10, Q14,
      Q15, plus P8 v3/v4 gate question and constitution-first ordering.
- [x] Every factual claim carries a live web source (URL + 2026-11-10
      access date) or an explicit confidence level (spec §10).

## Pending / blocked

- [ ] **Educator sign-off — BLOCKED (UNSTAFFED).** No educator persona
      exists, no named human SME. All eight sign-off items in spec §8
      are unsigned. P3 stays GATED.
- [ ] Home mockup artifact + 5-second find test (10-year-old and
      16-year-old) — spec written (§6.1), artifact NOT produced
      (docs-only workstream), test NOT run.
- [ ] Stacking test — falsification rule pre-stated (§6.2), result
      UNRECORDED (needs the mockup).
- [ ] Executable verification gate wired into CI — P3 build work.
- [ ] Owner decisions: Q1, Q2, Q3, Q6, Q7, Q8, Q10, Q14, Q15.

## Hard stops (never broken)

- No merges, no PRs, no force-push. Merging stays the owner's word per
  PR per head.
- No game/feature code of any kind. No educator sign-off. No "approved".

## Commits

- `0954e81c` — add math definition spec
- `a77abd58` — fix section ordering and cross-references

---
