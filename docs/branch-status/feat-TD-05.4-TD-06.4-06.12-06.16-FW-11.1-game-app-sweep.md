# feat/TD-05.4-TD-06.4-06.12-06.16-FW-11.1-game-app-sweep

## Branch

`feat/TD-05.4-TD-06.4-06.12-06.16-FW-11.1-game-app-sweep`

## Base

`origin/main` at `a6a58827f369ad78ce78ea0f906390dc4fa35c5b` (includes #629, the FW-11.1 primitive — commit 1 of the pack is skipped, already merged).

## PR

Draft, opened after commit 2. Title: `refactor(game-app): finish the split and move difficulty into editions (TD-05.4, TD-06.12–06.16, TD-06.4, FW-11.1)`.

## Goal

Finish the game-app split (extract ReviewComplete, RegionList, SubjectsHost, high-contrast slot, Play/PlayLoaded, Home/Choose/heroes) and move the Easy/Medium/Hard picker off the home hero into the MapTap editions, then move the thin composer to `src/routes/`. Nine commits (pack commits 2–10); commit 1 skipped — #629 already merged it.

## Done

- Commit 2 (TD-05.4): game-app takes EndOfFlowHome at its 4 sites; `homeButtonImport` cured (shell-ban 4 → 3); ceiling stays 6397 (no lines dropped).
- Commit 3 (TD-06.12): ReviewComplete extracted to `src/components/review-complete.tsx` (fragment; composer keeps the `<main>` wrapper, no new pageLocalMain row); game-app 6397 → 6324, ceiling lowered to 6324; map step 13 done.
- Commit 4 (TD-06.13): RegionList + StartingView extracted to `src/components/region-list.tsx` (fragments; composer keeps the `<main>` wrappers at all 4 call sites, no new pageLocalMain row); game-app 6324 → 6250, ceiling lowered to 6250; map steps 16–17 done.

## Ruled out / deferred

- Picker semantics for GeoDetective / Cold Trail / Subjects: later FW-11.x, owner design (commit 9 leaves them with no picker and no Easy/Medium/Hard semantics).
- kanban cards FW-11/FW-11.1 and TD-05.4: kanban.json is locked at 18 stories / 45 subtasks; needs an owner ruling (flagged in the PR body).
- Commit 1 (FW-11.1 primitive): skipped — merged in #629; commit 9 reuses its registry, storage, picker and hook as shipped on main.

## Open questions

- Commit 10 `pageLocalMain` path rename (if the moved router still renders a page-local `<main>`): owner ruling, flagged in the PR body.
- Any `pageLocalMain` row commit 5 could not cure (SubjectCase / SubjectPicker): report why if left.

## Next step

Commit 5 (TD-06.14): new `src/subjects/shared/SubjectsHost.tsx` owns the lazy SubjectPicker import.
