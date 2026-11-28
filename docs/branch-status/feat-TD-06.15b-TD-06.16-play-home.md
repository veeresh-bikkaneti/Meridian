# feat/TD-06.15b-TD-06.16-play-home

## Branch

`feat/TD-06.15b-TD-06.16-play-home`

## Base

`origin/main` at `1a3191ae` (includes #634, #635, #633).

## PR

Draft PR #636 — https://github.com/veeresh-bikkaneti/Meridian/pull/636 — head `c6f3ee1e`, base main `1a3191ae`. Review verdict FAIL at c6f3ee1e (gates all green, DOM changed); fix round below, then the owner-approved Home header add-on as 3 commits. Do not merge, do not mark ready. Merge only on Veeresh's word.

## Goal

Extract Play, PlayLoaded, ChallengeCompleteShell (TD-06.15b) and Home, Choose, heroes (TD-06.16) out of `src/components/game-app.tsx` under Veeresh's ruling (2026-11-27): the shared page shell owns the only `<main>`; screens render sections; the pageLocalMain allowlist is NOT grown; lint:nav no-page-local-main stays strict.

## Done (iteration 1)

- TD-06.15b: Play, PlayLoaded and ChallengeCompleteShell extracted to `src/components/play.tsx`, `play-loaded.tsx`, `challenge-complete-shell.tsx`; the lazy SatelliteMap lives in `src/map/satellite-map-host.tsx` and arrives as a `mapHost` slot. The extracted files render `<section>` carrying the branch classes; game-app.tsx wraps the `<Play>` call site in a plain `<main>`. The pageLocalMain allowlist is untouched. game-app.tsx 6,174 → 3,737 lines, ceiling lowered to 3,737. Map step 20 done.
- Test retargets: lazy-boundary #209 (satellite map now asserted in satellite-map-host.tsx), shared-shell 3.7 (challenge-done in play-loaded.tsx) and 3.8 (pool error in play.tsx), palette-preference in-game toggle host (play-loaded.tsx).
- G3 proven: the lazy guard test now also catches the `@/subjects/shared/SubjectPicker` alias spelling. Planted alias import fails the test; restore passes (20/20).
- Gates: tsc PASS, lint:arch PASS, lint:nav PASS (max-warnings 0), lazy-boundary + shared-shell + palette-preference 74/74, size check 3,737/3,737, build:pages PASS, entry 310,454 B vs 323,865.

## Done (iteration 2 — TD-06.16)

- TD-06.16: `Choose` extracted to `src/components/choose.tsx` (1,010 lines: lazy `StorytellerHomeHost` / `JournalPlayer` / `HomeGlobe` factories, territory prefetch, `DIFFICULTY_HINTS`, the full Choose screen); `HeroTrailOverlay`, `HeroTrekkerOverlay` and `AtlasBackdrop` extracted to `src/components/hero-overlays.tsx` (441 lines). Choose renders a `<section className="atlas-home home-v5 ...">` (was `<main>`); game-app.tsx wraps the `<Choose>` call site in a plain `<main>` (the iteration-1 Play pattern). The pageLocalMain allowlist is untouched. game-app.tsx 3,737 → 2,250 lines, ceiling lowered to 2,250. Map step 21 done. The picker block stays as-is (PR C removes it); `begin-exploring` and `tour-stop-difficulty` testids kept; Passport and `@/assets/**` stay as composer slots.
- Test retargets: home-journal-lazy-boundary (loader kick now asserted in choose.tsx), home-journal-heading (source read now choose.tsx), motionmaxxing navigation onClick rows + M7 RISE_DELAY/rise (choose.tsx), game-app-lazy-boundary prefetch buttons + #209 HomeGlobe + F4 JournalBoundary + F4 GlobeChunkFallback (choose.tsx). Shell-registry `home` row retargeted to choose.tsx.
- Import cleanup: game-app.tsx drops ~50 imports now used only by the extracted files (incl. the whole review-deck / challenge-verdict / learning imports); trims sfx, react, home-journal, age-profile, tier-filter to the names GameApp still uses. `peekLoopProgress` stays (used in GameApp too); `@/game/session` stays whole (all its names are used in GameApp).
- Media slots (layer rule): choose.tsx may not import `@/assets/**` or `./passport/*` directly, so game-app.tsx keeps those imports (baseline-covered) and passes them as props — `heroMountainUrl`, a `cardMedia` object (3 films + 3 band resolvers), and `earnedBadgeRow` (`<EarnedBadgeRow />`). `GlobeChunkFallback` moved to home-globe.tsx (which already imports the fallback URL and carries the baseline entry); choose.tsx imports the component. Consequence: the game-app.tsx baseline entry for `globe-fallback.webp` went stale and was removed from `eslint/layer-baseline.json` (shrink-only direction; home-globe.tsx keeps its own entry). Registry `pool-error` row retargeted to play.tsx (iteration-1 miss: `<ErrorScreen>` renders in Play, game-app.tsx only imported it) and the now-unused ErrorScreen import dropped from game-app.tsx.
- Gates: tsc PASS, lint:arch PASS, lint:nav PASS (max-warnings 0), check-game-app-size PASS (2,250/2,250), touched unit tests PASS (68 + 54 + 17 retargeted files, then full npm test 1,293 + 3,532 pass, 0 fail), build:pages PASS, entry 318,949 B vs 323,865 (4,916 B spare), provenance PASS (to confirm at commit).

## Still unmet

- G4 (CI) is not done — CI on c6f3ee1e is superseded by the fix + header commits; re-score on the final head.
- The Home header add-on (3 commits: cream-bar contrast, responsive nav + hamburger, auto-loop compass logo) runs after this fix round.

## Done (fix round — review FAIL at c6f3ee1e, B1/B2/B3/S1)

- B1: the composer's single `<main>` now carries the active screen's class + data attributes, so the DOM matches main. Home: `<main className={CHOOSE_MAIN_CLASSNAME}>` (`atlas-home home-v5 …`, exported from choose.tsx). Play: `use-play-main-props.ts` (new hook) derives the branch (loading / review-complete / verdict / map) from `run` + the pool, exactly as PlayLoaded does; Play reports its loaded places via `onPlacesChange` (loadKey-gated, so a run change reads as "loading" synchronously). The verdict settle flags are lifted to the hook, so `<main>` carries `data-verdict-settled` and the settle gesture handlers (`onClick`/`onKeyDown`) only when `challengeWinner != null`; the flags reset when the verdict branch deactivates, so a second challenge starts unsettled. `ChallengeCompleteShell` / `PlayLoaded` / `Play` render fragments now (no wrapper `<section>`). One deliberate deviation: main rendered NO `<main>` for the pool-error branch, but the shell owns exactly one, so the loading `<main>` stands in for it.
- B2: `SiteFooter` sits after `</main>` again, in the composer (game-app.tsx), inside the inert `<div>` — the same DOM nesting as main (Choose rendered `<main>` + `<SiteFooter>` as siblings inside the inert div). Choose no longer renders SiteFooter or takes `onTakeTour` / `footerLead`. The registry `home` row now carries `footerFile: "src/components/game-app.tsx"` (new `footerFile` field: the header lives in choose.tsx, the footer in the composer).
- B3: the 4 e2e specs pass, specs untouched — mobile-home-overlap, kofi-persistent-cloud.mobile, grandpa-tasting-tour, friend-challenge-mc3-verdict (30 passed, 2 skipped, 0 failed, 27.2 min, built artifact, `--workers=1`). Friend-challenge confirmed alone: 14 passed, 1 skipped, 0 failed (10.9 min).
- S1: the lazy guard now also fails on `export … from "./SubjectPicker"` and the aliased re-export (`export … from "@/subjects/shared/SubjectPicker"`). Planted-fail proofs (both reverted): each plant fails the new test `SubjectPicker is not re-exported, by either spelling` with "SubjectPicker must not be re-exported (a re-export statically pulls the subjects chunk in)".
- S3: entry gzip 319,477 B (Ko-fi build; 319,315 B without) vs 323,865 cap — 4,388 B spare (was 4,903 B). Header add-on must stay lean.
- Size ceiling: game-app.tsx 2,277 lines (was 2,250). The B1 derivation lives in `use-play-main-props.ts`, so the composer carries only the hook call, the Play props and the footer JSX — but that is still +27 lines the shrink-only ceiling cannot absorb. The ceiling was raised 2,250 → 2,277 in `scripts/check-game-app-size.mjs` + its test, set to the real count in this reviewed change (the script's own process: a raised ceiling is set to the real count, in its own reviewed change). Brief gate (≤ 6,174) still passes with large headroom.
- Gates (fix round): tsc PASS, lint:arch PASS, lint:nav PASS (max-warnings 0), check-game-app-size PASS (2,277/2,277), full npm test 3,533/3,533 0 fail, build:pages PASS, entry 319,477 B vs 323,865, check:provenance (to confirm at commit).

## DOM equivalence note (B1/B2)

- Home: `<main class="atlas-home home-v5 relative mx-auto flex min-h-dvh w-full max-w-(--page-wide) flex-col px-5 pt-8 md:px-9">` + `<SiteFooter>` after `</main>` inside the inert div — byte-equivalent to main. `grandpa-coffee-run.tsx:755,766` (`document.querySelector("main.home-v5")`) finds it again.
- Play: loading / review / verdict / map `<main>` classes + `data-verdict-settled` match main's per-branch `<main>`s exactly; the verdict `<main>` carries the settle gesture handlers. Pool-error branch: loading `<main>` stands in (see deviation above).
- Exactly one `<main>` in the shell; the pageLocalMain allowlist is untouched (game-app.tsx, SubjectCase.tsx, SubjectPicker.tsx).

## 1:1 layer-baseline key moves (vs main 1a3191ae)

- `src/components/game-app.tsx|@/assets/home-v5/globe-fallback.webp` removed — the fallback lives in home-globe.tsx now, which keeps its own entry (`src/components/home-globe.tsx|@/assets/home-v5/globe-fallback.webp`).
- `src/components/game-app.tsx|@/map/satellite-map` → `src/components/game-app.tsx|@/map/satellite-map-host` — the satellite map loads through its host.

## S4 — Workers Builds note

- Workers Builds did not run on the PR #636 head (c6f3ee1e). Note in the PR body when updating it; CI on the final head is the G4 re-score.

## Graph

- Node: `use-play-main-props` (hook, `src/components/use-play-main-props.ts`) — derives the Play branch `<main>` props for the composer. Edge: `use-play-main-props` `depends-on` `Play` (places via `onPlacesChange`), `depends-on` `PlayLoaded` (branch order mirror).
- Node: `home-footer-placement` (decision) — SiteFooter after `</main>` in the composer, inside the inert div (B2). Edge: `home-footer-placement` `decided-by` the #636 review (FAIL at c6f3ee1e).

## Ruled out / deferred

- Growing the pageLocalMain allowlist: forbidden by Veeresh's ruling. The section + shell-`<main>` pattern is the redesign.
- The sweep's stashed commit-7 work was reference only (it renders `<main>` in extracted files) and was NOT applied as-is; the extraction was rebuilt from main with sections.

## Open questions

- Owner rulings Q3–Q5 (parallel to this PR): Q3 delete SubjectPicker's allowlist entry when it moves? Q4 router renders shell + `<main>` once above lazy screens? Q5 downward imports only + lint:arch ban on game-app.tsx re-exports?
- Kanban cards FW-11, FW-11.1 and TD-05.4 still need an owner ruling.

## CI e2e fix iteration (head aec59b07 → fix commit; 5 failures, 22 passed locally)

- #1 layout-overflow (320x568 scrollWidth 345 vs 320) — REGRESSION, header commit 2: removing `exitInMenuOnSmallScreens` left the ~203px Join pill in the actions row beside the 44px Menu button (row 333px > 280px header). Fix: restored `exitInMenuOnSmallScreens` on Home's SiteHeader (choose.tsx). This corrects the header brief's item 4 ("Join stays in the bar at every width") — it is physically impossible at 320px and contradicts the spec, which expects Join in the panel below 640px. Verified by probe: scrollWidth 320.
- #2 grownups-privacy-contact (768x1024, Menu button timeout) — REGRESSION, header commit 2's More split: at 768px only EXPEDITIONS + CASES + More fit (nav 240px), so CONTACT (4th) fell behind More with no Menu button to reach it (Menu hidden ≥768px). Fix: moved the Menu/More handoff from 768px to 820px — Menu button owns the nav below 820px, More split at 820–1023px (at 820px three links + More fit, 296px vs ~306px nav). Changed `MORE_BAND` (site-header-nav.ts), the menu-button hide / nav hide / icon-form / compact-band / More-band media queries (styles.css), and a stale comment (shared-shell.test.ts). Nav order untouched (CONTACT stays right after ABOUT, per the spec comment). Verified by probe at 768px: Menu visible, CONTACT :visible count 1 after open (678×44), panel count 0 after close.
- #3/#4 endgame-share (both) — ENVIRONMENTAL, not a regression: the console gate caught 2× `ERR_TUNNEL_CONNECTION_FAILED` for pre-existing external requests (journal mp4s on `veeresh-bikkaneti.github.io/meridian-media`, crash-beacon POST to `meridian-crash-report.knowledgetest.workers.dev/ingest`). Both exist on main; PR B adds no external fetch. The sandbox proxy blocks external egress; CI runners have real egress. The share assertions themselves passed. No code fix; re-run to confirm.
- #5 round-loop-a11y 3D(a) — ENVIRONMENTAL/flaky, not a regression: all 8 attempts missed the 1200ms return beat (offsets 1789–3314ms, only 2–3 rAF frames) on this 1.5-CPU VM. The beat logic (`src/map/zoom-space.ts`, `satellite-map.tsx`) is untouched by PR B. No code fix; re-run to confirm.
- Gates (this iteration): tsc PASS, lint:arch PASS, lint:nav PASS (max-warnings 0), check-game-app-size PASS (2,277/2,277), site-header-nav unit 7/7, shared-shell + drawer 48/48, lazy-boundary pass, build:pages PASS, entry 320,430 B vs 323,865 (3,435 B spare), check:provenance (to confirm at commit).

## Next step

Orchestrator: push the CI e2e fix commit, re-run the 7 CI specs (endgame-share ×2 and round-loop-a11y 3D(a) to confirm environmental), update PR #636 body, wait for CI on the final head, score G4.
