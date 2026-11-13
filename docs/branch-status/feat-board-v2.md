# feat/board-v2 — branch status

Base: origin/main `44d921d7377c8f907fd7211ebff1a9131ba4a603`

## Done
- Step 1 — computed header metrics on /board: header now shows five tiles
  (Not started, In progress, Done, Open PRs, Blocked), all computed by the
  pure `headerMetrics(stories)` helper in `src/board/board-data.ts` from the
  stories as shown (snapshot + live overlay). No hardcoded numbers.
  - `LiveStory` gained `prStates: Record<number, "open" | "merged" | "closed">`,
    populated by `applyLiveData` (open → "open"; closed+merged → "merged";
    closed unmerged → "closed"). Open PRs = distinct PR numbers with live
    state "open" across all stories; snapshot-only stories carry no states,
    so they contribute 0.
  - Blocked = story is not done AND, via `buildDependencyEdges`
    (edge.from = prerequisite, edge.to = waiter), waits on a story that is
    not done.
  - Tests: `node --test src/board/board-data.test.ts` — 30 pass, 0 fail
    (3 new headerMetrics/prStates tests). `npx tsc --noEmit` — clean.

## Next step
- Step 2 (not started — coordinator to specify).

## Open questions
- None for step 1.

## Ruled out
- No fallback/invented open-PR count when live data is absent (honest 0
  from the data actually shown).
- No new dependencies, components, or palette; existing `.board-tiles` /
  `.board-tile` styles reused (5-across at ≥900px).

## Graph
- No graph nodes/edges added by this step.
