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
- Commit 5 (TD-06.14): SubjectsHost created at `src/subjects/shared/SubjectsHost.tsx` (owns the lazy SubjectPicker; composer keeps Suspense + MapErrorBoundary); layer-baseline key swaps count-neutrally SubjectPicker → SubjectsHost (104 stays 104); game-app 6250 → 6238, ceiling lowered to 6238; map step 18 done. SubjectCase / SubjectPicker keep their pageLocalMain rows — their `<main>` carries screen-specific classes (`mode-screen`, `why-learn-screen`, `subject-*-screen`) and data attributes PageShell cannot express; curing them would be a visual change.
- Commit 6 (TD-06.15a): HighContrastToggle extracted to `src/components/high-contrast-toggle.tsx` (slot component, rendered directly by Play and Home); game-app 6238 → 6174, ceiling lowered to 6174; map step 20 preamble done.

## Blocked — commit 7 (TD-06.15b, Play + PlayLoaded)

- **Status:** BLOCKED, work stashed (not pushed, not in the PR). Stash: `stash@{0}` on this branch — "commit 7 WIP: Play/PlayLoaded extraction, blocked on pageLocalMain (lint:nav)".
- **What was built (and verified before the block):** Play (309 lines) + ChallengeCompleteShell (74) + PlayLoaded (1,935) extracted to `src/components/play.tsx`, `challenge-complete-shell.tsx`, `play-loaded.tsx`; lazy SatelliteMap moved to a `src/map/satellite-map-host.tsx` host (stays lazy, PlayLoaded gets it as a `mapHost` slot prop); `clearDrop` / `poolForRunStart` / `globeTierSplitFor` / `revealStory` / Grandpa verdict URLs threaded as props from the composer; `useMapMode` reduced to a `typeof import()` type query; `LegacySnapshotBand` type + PlayLoaded-only helpers moved with PlayLoaded. tsc clean, lint:arch clean (baseline swap `game-app.tsx|@/map/satellite-map` → `.../satellite-map-host`, count stays 104).
- **Blocker:** `lint:nav` (`shell/no-page-local-main`) fails — 4 errors. The rule bans a `<main>` JSX element in ANY file not listed in `eslint/shell-ban-baseline.json` `pageLocalMain` (game-app.tsx, SubjectCase.tsx, SubjectPicker.tsx only); the shell-registry does NOT exempt a file from this rule. Play renders a `<main>` (Loading places), PlayLoaded renders two (`<main>` for the review-complete branch and `<main className="relative h-dvh bg-bg">` for the map), ChallengeCompleteShell renders one. The pack forbids new baseline rows, and the branches carry different `<main>` classes so a single composer wrapper cannot cover them (the fragment pattern from commits 3–4 does not transfer — the branch is only known inside PlayLoaded). The pack's CCS note ("if it would add a row, keep it in the composer") confirms the constraint; the pack does not resolve it for Play/PlayLoaded.
- **Systemic:** commit 8 is blocked the same way — Choose renders `<main>` twice in its body. Commit 9 depends on 8 (it edits the extracted Choose); commit 10 depends on 3–9. The sweep cannot proceed past commit 6 without an owner/architect ruling.
- **Options for the owner:** (a) allow new `pageLocalMain` baseline rows for the extracted play/home files (3 rows: play.tsx, play-loaded.tsx, challenge-complete-shell.tsx; Choose would add a 4th); (b) redesign the `<main>` placement (e.g. a single composer-owned `<main>` whose class is driven by run state); (c) stop the split here and leave Play/Home in the composer.

## Next step

Owner ruling on the pageLocalMain blocker (see above). If (a) is granted, revive the stash (`git stash pop`), add the baseline rows, re-run gates, push commit 7, then continue to 8–10.

## Ruled out / deferred

- Picker semantics for GeoDetective / Cold Trail / Subjects: later FW-11.x, owner design (commit 9 leaves them with no picker and no Easy/Medium/Hard semantics).
- kanban cards FW-11/FW-11.1 and TD-05.4: kanban.json is locked at 18 stories / 45 subtasks; needs an owner ruling (flagged in the PR body).
- Commit 1 (FW-11.1 primitive): skipped — merged in #629; commit 9 reuses its registry, storage, picker and hook as shipped on main.

## Open questions

- Commit 10 `pageLocalMain` path rename (if the moved router still renders a page-local `<main>`): owner ruling, flagged in the PR body.
- Any `pageLocalMain` row commit 5 could not cure (SubjectCase / SubjectPicker): report why if left.

## Next step

Owner ruling on the pageLocalMain blocker (see Blocked — commit 7 above). If new baseline rows are granted, revive the stash, add the rows, re-run gates, push commit 7, then continue to 8–10.
