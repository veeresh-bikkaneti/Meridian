# feat/TD-06.15b-TD-06.16-play-home

## Branch

`feat/TD-06.15b-TD-06.16-play-home`

## Base

`origin/main` at `1a3191ae` (includes #634, #635, #633).

## PR

Draft, to be opened after this iteration's commit (PR B). Title: `refactor(game-app): extract Play and Home under the shell-only-main ruling (TD-06.15b, TD-06.16)`.

## Goal

Extract Play, PlayLoaded, ChallengeCompleteShell (TD-06.15b) and Home, Choose, heroes (TD-06.16) out of `src/components/game-app.tsx` under Veeresh's ruling (2026-11-27): the shared page shell owns the only `<main>`; screens render sections; the pageLocalMain allowlist is NOT grown; lint:nav no-page-local-main stays strict.

## Done (iteration 1)

- TD-06.15b: Play, PlayLoaded and ChallengeCompleteShell extracted to `src/components/play.tsx`, `play-loaded.tsx`, `challenge-complete-shell.tsx`; the lazy SatelliteMap lives in `src/map/satellite-map-host.tsx` and arrives as a `mapHost` slot. The extracted files render `<section>` carrying the branch classes; game-app.tsx wraps the `<Play>` call site in a plain `<main>`. The pageLocalMain allowlist is untouched. game-app.tsx 6,174 → 3,737 lines, ceiling lowered to 3,737. Map step 20 done.
- Test retargets: lazy-boundary #209 (satellite map now asserted in satellite-map-host.tsx), shared-shell 3.7 (challenge-done in play-loaded.tsx) and 3.8 (pool error in play.tsx), palette-preference in-game toggle host (play-loaded.tsx).
- G3 proven: the lazy guard test now also catches the `@/subjects/shared/SubjectPicker` alias spelling. Planted alias import fails the test; restore passes (20/20).
- Gates: tsc PASS, lint:arch PASS, lint:nav PASS (max-warnings 0), lazy-boundary + shared-shell + palette-preference 74/74, size check 3,737/3,737, build:pages PASS, entry 310,454 B vs 323,865.

## Still unmet

- TD-06.16 (Home, Choose, heroes): NOT extracted in this iteration. Choose (2832-3690 on the pre-extraction base) plus HeroTrailOverlay, HeroTrekkerOverlay and AtlasBackdrop still live in game-app.tsx, and Choose still renders its own `<main className="atlas-home home-v5 ...">` at the shell. The extraction needs: move DIFFICULTY_HINTS, HomeGlobe, JournalPlayer, StorytellerHomeHost, prefetchTerritoryData/onFocus into choose.tsx; move heroStaticGateAtMount and TREKKER_CLIMB_PATH into the heroes file; replace Choose's `<main>` with a `<section>` and wrap the `<Choose>` call site in a `<main>` in the shell; retarget the source-assertion tests that read game-app.tsx for Choose strings.
- G5 (draft PR) is not done — no PR opened in this iteration, by design (the orchestrator opens it).

## Ruled out / deferred

- Growing the pageLocalMain allowlist: forbidden by Veeresh's ruling. The section + shell-`<main>` pattern is the redesign.
- The sweep's stashed commit-7 work was reference only (it renders `<main>` in extracted files) and was NOT applied as-is; the extraction was rebuilt from main with sections.

## Open questions

- Owner rulings Q3–Q5 (parallel to this PR): Q3 delete SubjectPicker's allowlist entry when it moves? Q4 router renders shell + `<main>` once above lazy screens? Q5 downward imports only + lint:arch ban on game-app.tsx re-exports?
- Kanban cards FW-11, FW-11.1 and TD-05.4 still need an owner ruling.

## Next step

Orchestrator: open the draft PR for this commit, then narrow iteration 2 to TD-06.16 (Choose/Home/heroes).
