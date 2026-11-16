# feat/fair-share-lose-path — branch status

**Task:** L1 "Same film, same voice" on ONE item (Radhae's pick, 2026-11-15): a wrong pick on `math-number:division:fair-share` (Math, ages 7-10; live on main via #482/#486) now reveals the item's existing act-3 narrated solved summary, preceded by one answer-first line. Prove it on this item only; the all-90 gate flip is a separate, not-yet-authorised step and is NOT in this branch. Draft PR only — the owner (Veeresh) merges. Built on current main `4387fd8927a8` ("Ask for age first (#498)").

**What changed:**

- `src/subjects/shared/SubjectCase.tsx` — the flow gains an optional `loseReveal` hook and a `loseRevealed` state. A wrong pick (or wrong typed number) on the entry question sets the pick as feedback as today and, when the subject's hook names the item, also sets the reveal. The scene hook then receives the solved phase (`scenePhase = solved || loseRevealed`), so the item's act-3 performance starts exactly as it does on a win — same scene component, same clip, same captions, through the one-voice channel, read-aloud preference and reduced-motion behaviour untouched (ClueScene.tsx is not modified). In place of the answer card, a reveal section (testid `<prefix>-lose-reveal`) shows the answer-first line — "The answer is **3** — here's how." for fair-share, built from the item's own `answer.correct` in the win path's shape — then the summary's full script as standing text via the existing `resultExtra` hook, the "You just used this in…" line, and Next case / Home. The reveal is not a solve: the phase never reaches "done", no celebration fires, the detective host still sees a wrong pick (`wrongPick` unchanged), and further picks are inert until Next case resets the reveal with the case.
- `src/subjects/math/scenes.ts` — the gate, as data-side policy next to the descriptions: `LOSE_SUMMARY_ITEM_ID = "math-number:division:fair-share"` and `showsSummaryOnWrong(itemId, band)` (true only for that item at 7-10). No description, clip, or summary changes; no new scene kinds, no new authoring.
- `src/subjects/math/MathCase.tsx` — passes `loseReveal={(item, band) => showsSummaryOnWrong(item.id, band)}`. Nothing else in the wrapper changes.
- Tests: new `src/subjects/shared/fair-share-lose-path.test.ts` (13 tests: the gate's truth table incl. sibling pilot items skip-count / facts and the next-dealt unknown-factor; the reveal wiring; the win path's exact copy and the two sections' mutual exclusion; answer-blindness before the pick). Two pins in `src/subjects/shared/clue-scene.test.ts` updated for the wiring they pin (the scene-phase expression; `resultExtra`'s second sanctioned use, inside the reveal section) — both strengthened to assert the new positions, none deleted. New Playwright spec `tests/e2e/math-fair-share-lose-path.desktop.spec.ts` (lose path end to end + the unknown-factor control + the unchanged win path) for CI. The desktop/mobile clue-scene walks (`tests/e2e/math-clue-scene.desktop.spec.ts`, `.mobile.spec.ts`) are amended in one place each: their per-case wrong pick is skipped for fair-share only, because that pick now reveals by design (the new spec walks it); the other 12 cases' wrong picks and all win paths are untouched. The reduced-motion clue spec only ever picks correctly and is untouched.
- No data file under `docs/scaling/**` is touched. No new clips, kinds, routes, or look.

**Leak check (settled from code):** today, a wrong pick on fair-share reveals nothing. The answer card shows only "Not quite — have another go. The story above holds the clue." (`AnswerCard.tsx`); the scene stays in its setup phase — setup label "A plate of snacks sits on a table, with friends waiting around it.", the pile and the empty plates, no counts stated; the clue card's text is the item's own why ("Twelve snacks and four friends: is it fair, and how many does each get?" — the givens only); the summary's script (whose closing line names 3) is read by ClueScene only in the solved phase and its standing text renders only inside the solved result section. The correct value "3" appears before the pick only as one of the three unmarked choices (2 / 3 / 4), as in any of the band's questions. After this change, the answer is named only after a pick, in the reveal — which is the teaching content of the lose path, as the re-brainstorm recorded.

**Status:** Built and verified locally on main `4387fd8927a8`; targeted tests per the owner's lean strategy, CI carries the full Playwright suite.

- Unit: new lose-path suite 13/13; amended clue-scene suite and math scenes suite pass; all `src/subjects/**` suites 183/183. Full `npm test`: src suite 2,720/2,720 pass; scripts suite 1,187 pass + 11 skipped, 0 fail. `npm run test:worker` 235/235.
- `npx tsc --noEmit` clean; `npm run lint:nav` clean; `npm run lint:subjects` GATE PASSED; `npm run lint:content` GATE PASSED (6 baselined, 0 new); `node scripts/lint-cards.mjs` GATE PASSED.
- `check:provenance`: the script needs a git range and this working tree is a fetched copy without `.git`, so it cannot run here (CI runs it on the PR). Emulated locally over the branch's added lines with the checker's own blocklist and bare-word rule: 0 hits in the added lines and in the commit message; the publish flow authors the commit as the owner, as with prior branches.
- Plain `vite build` green (prerender OK). `build:pages`' postbuild fingerprint step double-stamps in this sandbox on pristine main too — pre-existing, not this change; CI runs it green.
- Behaviour proven against the built artifact with the repo's E2E substitute harness (headless Chrome over CDP, the disclosed pattern; Playwright cannot launch in this environment): **48/48 checks, zero page errors** — at desktop (1280×800) and phone (390×844): (a) fair-share wrong pick → the exact answer line, the scene in its solved phase, the performance playing with captions stepping, the full script standing, and the `fair-share.mp3` clip loading and playing on the Hear tap (the automatic start claims the voice channel only when free, by design; where another voice held it in the harness the run proceeded on captions and the tap run carried the voice — the same behaviour as the win path); (b) the next case (unknown-factor) wrong pick → "Not quite", scene still in setup, no reveal, no summary; (c) fair-share right pick → the win path exactly as today ("You got it!", "The answer is 3." + derivation, no lose line). Plus a desktop reduced-motion pass: wrong pick → line + standing text, still frame (`data-still`), summary idle until the Hear tap, which runs voice + captions against the still. Screenshots + results JSON in the author's run notes (`fairshare-proof/`).

**Not tested:**

- The Playwright specs do not run in this environment (browser launch blocked); CI carries them, including the new lose-path spec and the two amended clue-scene walks.
- Audible speech itself: headless Chrome has no audible output. Playback is verified as the clip loading/playing with the performance state advancing and captions stepping in sync (the same standard as every prior wave); a human listen on a real device is the remaining check.
- The lose path for a typed-number entry is wired through the same `onWrong` path but fair-share is a choice item, so no live item exercises it; it is pinned in source only.

**Clash analysis (open PRs, file lists read from the API):**

- PR #500 (landscape picker): touches the picker, hero, styles, age-profile store, reset history and their specs — **zero file overlap** with this branch. Either merge order works with no adjustments.
- PR #487 (clue-scene wave 2, the wave chain's base): touches `MathCase.tsx`, `scenes.ts` and `clue-scene.test.ts`, which this branch also touches. Either order works with a small rebase, never a rewrite:
  - `scenes.ts`: #487 adds the 10-18 descriptions inside `MATH_CLUE_SCENES`; this branch appends the gate below `clueSceneFor` — disjoint regions, expected to merge textually.
  - `MathCase.tsx`: #487 widens the scene/resultExtra band gates; this branch adds the `loseReveal` prop line and its import — if #487 lands first, re-applying this branch is that one prop line on their wrapper (the gate stays 7-10-only by design); if this lands first, #487's widening is re-applied around the extra prop the same way.
  - `clue-scene.test.ts`: both amend pins in the wiring describes — small, localised conflicts at most; the later branch re-pins to the merged source.
  - The rest of the wave chain (#488–#494, #496) stacks on #487 and inherits the same three files' resolution.

**Still open:**

- The all-90 gate flip is NOT in this PR (separate step, not yet authorised).
- Owner merges. Nothing else is owed.

## Graph

- Add node: the L1 lose-path gate (`showsSummaryOnWrong` + `LOSE_SUMMARY_ITEM_ID`, `src/subjects/math/scenes.ts`) — names the one item whose wrong pick reveals its solved summary; `depends-on` the fair-share scene description and its act-3 summary.
- Add edge: `SubjectCase` `depends-on` the `loseReveal` hook contract for the reveal section and the scene's solved phase on a wrong pick.
- Add edge: `MathCase` `depends-on` `showsSummaryOnWrong` (its `loseReveal` prop).
- No existing nodes or edges changed.
