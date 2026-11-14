# feat/v2-journals-subject (Stream D, PR D1)

## Done

- `src/subjects/journals/`: module (`id: "journals"`, released), items adapter
  over the four journals' clip rows, answers, caption loader, case flow.
- 16 playable items in D1: 8 in 7-10 (base rows), 7 in 10-18 (3 base rows
  plus 4 stretch items), 1 in 18+ (base row).
- Shared `SubjectCase` gets one optional prop, `lead(item, reduced)`. Default
  unchanged; math is untouched by it.
- Unit tests `src/subjects/journals/journals.test.ts`: 12 pass.
- E2E `tests/e2e/journals-subject.spec.ts` (new `journals-subject` project in
  `playwright.config.ts`): 2 pass locally, `--workers=1`.
- Two existing picker assertions changed from "Coming soon" to playable:
  `math-subject.spec.ts` and `subjects-picker.desktop.spec.ts`.

## Next step

- D2 (`feat/v2-journals-history`) after D1 merges: world-wars, ww2-monuments,
  freedom-fighters, Jhansi Fort, Netaji Bhawan. Re-screen each against
  `docs/scaling/humanities/screened-topics.md` first.

## Open questions

- Narration: `src/game/audio/voice-channel.ts` is not on main (PR #430), so
  there is no Listen button. Text only.
- Retrieval checks: `AnswerEntry` has no `followUp` field yet (stream B).
  Retrieval questions are not shipped.
- Judgment calls for educator review: Andean roads (a stated 100 km/day
  practice rate), Aconcagua (a practice triangle), Pont du Gard (5 × 7 is a
  practice grouping of the sourced count 35).
- Not in D1: the ENIAC 18+ stretch (300,000 additions a minute). Only the
  10-18 stretches are in scope.

## Ruled out

- Editing `docs/scaling/**`: not done; the adapter reads rows only.
- Full Playwright run: not done (budget rule); targeted specs only.

## Graph

- Adds: `subject:journals` (module node). Integrator folds in at merge.
