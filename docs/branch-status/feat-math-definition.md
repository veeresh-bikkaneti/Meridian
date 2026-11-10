# BRANCH_STATUS — feat/math-definition

Workstream 2 of the Meridian scaling-plan push: Math definition (P1 + P3).
Docs/briefs only — NO code. Base: origin/main `f37dea50`.

**Status: PREPARED — AWAITING EDUCATOR SIGN-OFF**

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
