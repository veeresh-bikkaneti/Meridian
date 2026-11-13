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

- Step 2 — search + "Blocked only" filter on /board:
  - Pure helpers in `board-data.ts`: `blockedIndexes(stories)` extracted
    as the single source of truth for "blocked" (not done AND a
    dependency prerequisite is not done); `headerMetrics` now uses it.
    `storyMatchesQuery(story, query)` — case-insensitive substring on
    title/lane/owner (null-safe); numeric queries ("430", "PR 430",
    "#430") also match `story.prs`. `filterStories(stories, {query,
    blockedOnly})` preserves order; blocked is computed against the
    full story list, not the filtered subset.
  - UI in `board.tsx`: one controls row above the Scrum board section —
    labelled `<input type="search">` + real `<button aria-pressed>`
    "Blocked only", both ≥44px (board.css `.board-controls`). One
    `visibleStories` memo feeds scrum columns, the lane list, and the
    FeatureMap `stories` prop. Header metrics stay GLOBAL; when a
    filter is active a "Showing X of Y stories" line appears. Column
    and lane counts derive from the filtered set.
  - Tests: `node --test src/board/board-data.test.ts` — 34 pass, 0 fail
    (4 new filter tests). `npx tsc --noEmit` — clean.

- Step 3 — story inspector:
  - Selection by existing key `${lane}:${title}` (no ids — those arrive
    in step 4). `StoryCard` title is now a real `<button type="button">`
    (board.css `.board-card-title-button`, ≥44px hit area, focus-visible
    outline); both render sites (columns + lanes) pass `onSelect`.
  - New `src/board/story-inspector.tsx`: `<aside aria-label="Story
    inspector">` with title, lane, status pill, status WHY, owner (or
    "Unassigned"), waitsOn text + clickable prerequisite stories,
    clickable stories waiting on it, linked PRs with live title + live
    state (no live data → number + "state not loaded", never a guess),
    and "Dependency chain depth" from `dependencyDepths`. Labelled
    Close button; Escape closes while open; on open focus moves to the
    panel heading (`tabIndex={-1}`); on close focus returns to the card
    button that opened it (opener element kept in a ref in board.tsx).
    Read-only: no status-changing controls. All dynamic strings are
    React text children.
  - `statusWhy(story)` pure helper in `board-data.ts`, built from the
    same live PR facts as `deriveStatus`: all merged / any open /
    closed-unmerged / no PRs / partial ("PR n has no live data yet").
  - Done path: stories are NOT donePath items. New `donePathMatch`
    helper shows a "Done path" line ONLY on an exact substring match
    (case-insensitive) between the story title and a gate title/
    description (or a gate title inside the story title); otherwise the
    field is omitted entirely — no fabricated position.
  - Layout: `.board-scrum-layout` — inspector stacks below the scrum
    board on narrow screens, sits beside it (320px, sticky) at
    ≥1180px. Step 5 will formalize breakpoints.
  - Tests: `node --test src/board/board-data.test.ts` — 40 pass, 0 fail
    (6 new statusWhy/donePathMatch tests; inspector added to the
    no-raw-HTML source check). `npx tsc --noEmit` — clean.

## Next step
- Step 4 — coordinator to specify.

## Open questions
- None for steps 1–3.

## Ruled out
- No fallback/invented open-PR count when live data is absent (honest 0
  from the data actually shown).
- No new dependencies, components, or palette; existing `.board-tiles` /
  `.board-tile` styles reused (5-across at ≥900px).

## Graph
- No graph nodes/edges added by this step.
