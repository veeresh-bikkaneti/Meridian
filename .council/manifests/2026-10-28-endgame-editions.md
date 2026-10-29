# COUNCIL CONSENSUS MANIFEST — End game in GeoDetective, Cold Trail, and other new editions

- Task: the "End game" button is not visible in GeoDetective, Cold Trail, or other new editions (owner's report, verbatim).
- Branch: `fix/endgame-editions` · Base: main `b09a5c36` · Tier: 2 (owner-set; also 3+ files).
- Seats: Chair (coordinator) · Councilor A (ATDD + inventory) · Councilor B (TDD contracts) · Councilor C (adversarial, separate agent).
- Status: APPROVED (Chair sign-off, 2026-10-28). Challenge rounds used: 2 of 2.
- Constitution lift: NONE. No refactor of working code; edits stay inside the targeted blocks (GameApp mode branches + one new handler + one new GameApp-level state; LoopScreen/TrailScreen header and error returns; one new optional prop on RunSummaryCard with default preserving classic behavior). Classic End game behavior is untouched.

## 1. ATDD acceptance scenarios

Shared meaning: "End game" is the new button inside the mode screen. "Session summary" is the same end-of-game score card a classic run shows (places found, score, best streak). "Resume" is the same case number, the same guesses or rings already placed, and the same clues already revealed. The player is a child aged 5–13: every scenario below is observable by a child.

### Happy paths

- S1 — GeoDetective, mid-case, all three acceptance properties. Given I am solving a GeoDetective case, have made 2 guesses, and 3 clues are showing. When I look at the screen without scrolling, I see an "End game" button. And I tap it. Then I see the session summary card. And I tap "Done". And I tap "GeoDetective" again. Then I see the same case number, my same 2 guesses, and my same 3 clues — nothing was lost or restarted.
- S2 — Cold Trail, mid-case, all three acceptance properties. Given I am on a Cold Trail case and have locked 2 of the 3 rings on the map. When I look at the screen without scrolling, I see an "End game" button. And I tap it. Then I see the session summary card. And I tap "Done". And I tap "Cold Trail" again. Then I see the same case, with my same 2 rings still locked in the same spots.
- S3 — Ending from a mode shows classic totals only, never mode progress. Given I scored points in a classic Globe game earlier today, then opened GeoDetective and solved part of a case. When I tap "End game" in GeoDetective. Then the summary shows my Globe score, and it does not count the mystery, the guesses, or any Cold Trail stars.
- S4 — End game is visible in every GeoDetective state, not just mid-case. Given I open GeoDetective while its mystery is still loading, and separately while its mystery failed to load, and separately on the answer-reveal screen. When I look at each of those screens without scrolling. Then the "End game" button is visible on every one, and on the reveal screen it does not cover or hide the "Next mystery" button — both buttons can be tapped.
- S5 — Same visibility rule for Cold Trail. Given I open Cold Trail mid-case, and separately on its case-result screen, and separately on its "case files didn't load" screen. When I look at each screen without scrolling. Then the "End game" button is visible on every one, and on the result screen it does not cover or hide the "Next case" button.

### Present surfaces (must not break)

- S6 — Classic run, finding a place: unchanged. Given I am finding a place in a classic Globe game. When I tap "End game". Then I see the session summary, and tapping "Done" takes me home.
- S7 — Classic run, answer shown: unchanged. Given I just placed a pin and the answer is showing. When I tap the "End game" pill on the question card. Then I see the session summary, and tapping "Play again" starts a fresh game.
- S8 — Review deck, playing: unchanged. Given I am playing review cards and a classic session from earlier today is still live. When I tap "End game". Then I see that classic session's summary (review cards add nothing to it).
- S9 — Friend challenge, playing: different result, unchanged. Given I am playing a friend's challenge route. When I tap "End game". Then I see the "Route complete" screen and no session summary.
- S10 — Tutorial practice round: unchanged. Given I am on the first-run tour's single practice place. When I tap "End game". Then I see the session summary, and the practice place added nothing to it.
- S11 — Summary screen itself: no second End game. Given the session summary card is open. When I look at it. Then there is no "End game" button on it — only "Done" and (when misses are due) "Review my misses", plus "Play again" on classic summaries only (see ruling R2).

### Failure / rejection paths

- F1 — Ending with no session and no classic play yet. Given it is a fresh day, I have played nothing classic, and I open GeoDetective first and solve part of a case. When I tap "End game". Then the summary honestly shows nothing played yet (0 places, 0 score) — it does not pretend the mystery counts as score. And tapping "Done" takes me home, and reopening GeoDetective still shows my same unfinished case.
- F2 — GeoDetective, ending while the answer is revealed but unacknowledged. Given I solved a GeoDetective case, the answer reveal is showing, and I have not tapped "Next mystery". When I tap "End game" and then "Done", and then I tap "GeoDetective" again (home shows "Solve a mystery" for a finished-but-unacknowledged case, NOT "Resume your case" — that label appears only while status is "playing"). Then I see the same answer reveal for the same case — not a new mystery, and not a blank case.
- F3 — Cold Trail, ending while the case result is revealed but unacknowledged. Given I finished a Cold Trail case, the case-result screen is showing, and I have not tapped "Next case". When I tap "End game" and then "Done", and then I tap "Cold Trail" again. Then I see the same case-result screen for the same case — not the next case.
- F4 — Ending twice is impossible; the summary never repeats. Given I tapped "End game" in GeoDetective and the summary is showing. When I tap "Done". Then I am home, no summary pops up again, and reopening GeoDetective shows my case, not a summary.

### Edge / boundary paths

- E1 — Keyboard-only player can reach and use it. Given I am playing GeoDetective (and separately Cold Trail) using only the Tab key and Enter. When I press Tab through the screen. Then the "End game" button receives focus in a sensible order, and pressing Enter ends the session and shows the summary.
- E2 — Finger-sized button on a small phone. Given I open GeoDetective and Cold Trail on a small phone screen (360px and 390px wide). When I measure the "End game" button. Then it is at least 44 pixels tall on both screens, and it does not overlap the "Editions" / "All games" / "Back" button, the case number, or the "Next mystery" / "Next case" button.
- E3 — "Editions" leave still works and does NOT end the session. Given I am mid-case in GeoDetective with a live classic score from earlier today. When I tap "Editions" (not "End game"). Then I see home and no summary appears. And tapping "GeoDetective" again resumes my same case, and my classic score is still there when I next play a classic run and end it.
- E4 — Same leave rule for Cold Trail. Given I am mid-case in Cold Trail. When I tap "All games". Then I see home and no summary appears, and reopening Cold Trail resumes my same case with my rings intact.
- E5 — After a chunk-error reload, the case and the button come back. Given GeoDetective showed the "Your game is safe" error card and I tapped "Try again" (the page reloaded). When the mode reopens. Then my unfinished case is back, and the "End game" button is visible without scrolling.
- E6 — Reload while a mode summary is open loses the summary (in-memory state only). This matches classic parity (summary-phase runs are not resumable). Stated, not a defect; the ended session stays ended and the case still resumes on return.

## 2. TDD test specification

Conventions: unit tests read source (same style as `src/components/game-app-lazy-boundary.test.ts`), run via `node --experimental-strip-types --test "src/**/*.test.ts"`. E2E runs against the built artifact via `serveBuiltArtifact` (`tests/e2e/helpers.ts`), fresh context per test, base `http://127.0.0.1:4123/Meridian/`, reusing only real helpers (`startGlobeRun`, `commitHit`, `dismissTileOverlayIfPresent`; `openLoop(page, "218")` + `guessViaMap` from `geodetective.spec.ts`, `?loop-puzzle=218` seam; `openColdTrail` + `placeAndLockRing` from `coldtrail.spec.ts`). Session reads via `page.evaluate` on `sessionStorage.getItem("meridian.session")` (pattern in `session-score.spec.ts:36-41`). `NO_IDLE` (`?idle-ms=3600000`) for globe seeding only.

### Unit tests — new `src/components/game-app-mode-endgame.test.ts`

| Test name | Asserts | Expected RED failure |
|---|---|---|
| `loop branch passes onEndGame to LoopScreen` | Segment `if (loopOpen)` → next branch contains `onEndGame` on `<LoopScreen` | `AssertionError: LoopScreen branch must pass onEndGame` |
| `cold trail branch passes onEndGame to TrailScreen` | Segment `if (coldTrailOpen)` → next branch contains `onEndGame` on `<TrailScreen` | `AssertionError: TrailScreen branch must pass onEndGame` |
| `LoopScreen renders an End game control invoking onEndGame` | Props type gains `onEndGame`; a button with accessible name `End game` has `onClick={onEndGame}` and `min-h-[44px]` | `AssertionError` (prop/button absent) |
| `TrailScreen renders an End game control invoking onEndGame` | Same pin, distinct from `← All games` / `← Back` | `AssertionError` (prop/button absent) |
| `TrailScreen error return renders an End game control` | The `!caseData` return contains an `End game` button invoking `onEndGame` | `AssertionError` (error return has only `← Back`) |
| `mode End game never calls endRun` | Loop + Cold Trail branch segments contain no `endRun` call | `AssertionError: mode End game must not call endRun` |
| `loop End game clears only the open flag` | Loop handler segment contains `writeLoopOpen(false)` and neither `clearLoopStore` nor any write/remove of `meridian.loop.v2` | `AssertionError` |
| `cold trail End game clears only the open flag` | Cold Trail handler segment contains `writeColdTrailOpen(false)` and neither `clearColdtrailStore` nor any write/remove of `meridian.coldtrail.v2` | `AssertionError` |
| `mode summary state lives in GameApp, branch outranks home` | A `modeSummary` state exists in GameApp scope (not PlayLoaded); a branch rendering `RunSummaryCard` on `modeSummary` sits after `if (run)` and before `if (loopOpen)` / home | `AssertionError: summary must render with run === null` |
| `mode summary Done clears the summary without clearing case stores` | Mode Done-handler segment contains `setModeSummary(null)` and `setStartError(null)`, and no `clearLoopStore` / `clearColdtrailStore` | `AssertionError` |
| `mode summary omits Play again, pins fallback props` | Mode-summary branch passes a `showPlayAgain={false}`-style prop (or equivalent), a noop `onPlayAgain` with a comment (required by type; unreachable because the button is hidden), `regionName` fallback expression (first `summary.regions` row else `"Meridian"`), `dateKey` from `trailDate()`, `challengeUrl={null}`, `growth={null}`, no `onReview`; card focus fallback tries Play again then Done (Done carries a `data-testid`) | `AssertionError` (branch/props absent) |

### Playwright E2E

Appended to `tests/e2e/geodetective.spec.ts` (project `geodetective`), `tests/e2e/coldtrail.spec.ts` (project `coldtrail`), `tests/e2e/endless-game.spec.ts` (project `endless-game`, GUARD only), and new `tests/e2e/mode-endgame.mobile.spec.ts` (project `mobile`, viewports 360×740 AND 390×844). No `playwright.config.ts` change is required (existing project `testMatch` patterns already cover these files). Rect-overlap assertions measure BOTH button rects in a SINGLE `page.evaluate()` call (two sequential `boundingBox()` calls are not atomic).

| Spec / test name | Asserts | RED? |
|---|---|---|
| geodetective `endgame: End game visible without scrolling, 44px, clear of Editions` | After `openLoop(page, "218")`: `getByRole("button", { name: "End game" })` visible, height ≥ 44, bottom ≤ viewport height, 0px² intersection with the header `Editions` button rect (single-evaluate rect math) | RED: 15s timeout `waiting for getByRole('button', { name: 'End game' })`, `locator resolved to 0 elements` (or `boundingBox()` null) |
| geodetective `endgame: activation ends session and shows session summary` | Seed: `startGlobeRun` → `commitHit` → record `sessionTotal > 0` → `Editions` → `openLoop(page, "218")` → `guessViaMap(page, "paris")` → `Guess 2 of 5` visible → assert mode play did NOT change `sessionTotal` → click `End game` → dialog `Game summary` visible with the banked globe total, session `ended: true`, `localStorage meridian.loop.open === null`, `meridian.loop.v2` blob unchanged (same `current.index` 218, 1 guess). The pre-End half is a GUARD (it passes before the fix); the RED part is the End game click onward. | RED (from the click onward) |
| geodetective `endgame: mode-only End game shows honest 0/0 summary` | `openLoop(page, "218")` → guess → click `End game` → dialog visible, session `ended: true`, dialog shows 0 places and 0 total as rendered, eyebrow text non-empty | RED: button timeout |
| geodetective `endgame: Done then return resumes the in-progress case` | From the activation setup: dialog `Done` → home → `GeoDetective: Resume your case` visible → click → `Clue 1: Geography` + `Guess 2 of 5` visible, `meridian.loop.v2` still index 218 with 1 guess | RED: button timeout; second-stage failure if the case store is cleared: Resume button missing / `Guess 2 of 5` timeout |
| geodetective `endgame: Done then return re-renders a finished-but-unacknowledged reveal` (F2) | Solve a case → reveal showing → `End game` → `Done` → home shows `GeoDetective: Solve a mystery` (NOT Resume) → click → SAME reveal for the SAME case, not a new mystery | RED: button timeout |
| geodetective `editions leave still works and does NOT end session` | Seeded session → `openLoop` → guess → header `Editions` → resume button visible, `sessionTotal` unchanged, `ended` false | GUARD (passes before the fix; must NOT be counted as RED) |
| coldtrail `endgame: End game visible without scrolling, 44px, clear of All games` | After `openColdTrail(page)`: same visibility / height / viewport / 0-overlap assertions against `← All games`; the button must be separate, not a relabel of `All games` | RED: button timeout |
| coldtrail `endgame: activation ends session and shows session summary` | Seed via globe hit → `openColdTrail(page)` → `placeAndLockRing` → capture `meridian.coldtrail.v2` JSON → assert `sessionTotal` unchanged by mode play → click `End game` → dialog visible with banked total, session `ended: true`, `meridian.coldtrail.open === null`, `meridian.coldtrail.v2` JSON byte-identical | RED (from the click onward) |
| coldtrail `endgame: mode-only End game shows honest 0/0 summary` | `openColdTrail(page)` → place + lock 1 ring → click `End game` → dialog visible, `ended: true`, 0 places / 0 total as rendered, eyebrow non-empty | RED: button timeout |
| coldtrail `endgame: Done then return resumes the in-progress case` | Dialog `Done` → home → re-enter → same case (`caseIndex` unchanged, ring 1 still locked); `meridian.coldtrail.v2` JSON identical to the pre–End game capture. No "Resume" label exists for Cold Trail — blob equality is the assertion, not a label. | RED: button timeout |
| coldtrail `endgame: error branch shows End game` | UNIT source-pin only (see unit table): the `!caseData` return contains an `End game` button invoking `onEndGame`. NO E2E for this branch: it is unseedable without scope creep — `cases.ts:71-74` wraps the index modulo deck length, `store.ts:169` `sanitizeInt` coerces non-integers/negatives to 0, and the bundled deck has 60 cases, so no `meridian.coldtrail.v2` seed reaches the `!caseData` return (a seeded 9999 lands on a valid wrapped case). `getColdtrailCase` returns null only for an empty deck, which the bundled deck never is. | Covered by the unit pin; no E2E row (C round-2 blocker fix) |
| coldtrail `all-games leave still works and does NOT end session` | Seeded session → `openColdTrail(page)` → `← All games` → home, session unchanged, `ended` false | GUARD (passes before the fix) |
| mobile `mobile: GeoDetective End game visible without scrolling at 360x740 and 390x844` | Same visibility / ≥44px / in-viewport / 0-overlap assertions at both viewports | RED: button timeout |
| mobile `mobile: Cold Trail End game visible without scrolling at 360x740 and 390x844` | Same, against `← All games`, at both viewports | RED: button timeout |
| endless-game `endgame regression: classic Globe End game still ends with summary and Done returns home` | Existing flow (`startGlobeRun` → 3 places → `End game` → phase `summary` → dialog → `Done` → home) | GUARD (passes before the fix) |

Mocks, fixtures, isolation: seed, don't mock — real `session.ts`, real mode stores, real clue/name files, real `LoopMap`. Never stub `endRun` to return a fake run — the contract is that it is never called with null. Seeding seams: `?loop-puzzle=218` (GeoDetective, deterministic); `?idle-ms=3600000` via `NO_IDLE` (globe seeding only); Cold Trail has no deal seam — use the deterministic first case. The Cold Trail `!caseData` error branch has NO seeding seam (see the unit-pin row above) and is covered by source pin only. Fresh Playwright context per test. Deliberately NOT asserted: a Cold Trail "Resume" label (none exists); any new `data-testid` for the mode button (role + name `End game` is the contract locator, matching classic).

## 3. Scope boundary

- Protected files (must not be touched): `src/game/data/**` (place data, card rule 5), `package-lock.json` (regenerate with npm, never hand-edit), `.scratch/`, any other branch's worktree, `src/game/loop/types.ts` key constants (read, don't rename), `src/game/session.ts` (read, don't change session math).
- Permitted diff footprint: max +900 / −200 lines, dominated by tests and docs. Implementation itself is small: one handler + one state in GameApp, one prop on LoopScreen, one prop on TrailScreen, header/error-return buttons in both mode screens, one optional prop on RunSummaryCard, one GameApp-level summary branch.
- In scope: the mode End game buttons + handler + GameApp-level mode-summary branch + the RunSummaryCard `showPlayAgain`-style optional prop + tests + docs (README + BRANCH_STATUS.md + this manifest).
- Out of scope (explicit): changing mode scoring/streaks/wallets; changing the classic flow's End game behavior (classic summary keeps Play again, Review, challenge URL, growth exactly as today); any redesign of the mode screens beyond the control's placement; case abandonment — ending the session is NOT abandoning a case, and no abandon path is added (separate owner strand, see ruling R6); disclosure copy on the summary (see ruling R3 + open question 2); any change to locked or owner-approved copy (donation copy, hint wordings, slogan, share-text format).

## 4. Surface inventory

Edition set closed at exactly two mode screens (lazy imports `game-app.tsx:234-247`); no third edition screen exists. Review, challenge, and tutorial are states inside the classic run screen, not separate branches. Passport badges are a row on the home card; Journal is a section of home. Contact, Privacy, Credits are separate grown-up pages, not game screens.

| Surface | Ruling | Reason (one line) |
|---|---|---|
| Classic run, finding a place (Globe / Country / State) | PRESENT | "End game" button in the bottom dock. |
| Classic run, answer shown (story / done) | PRESENT | "End game" pill on the question card. Note: this pill is shorter than 44px — the new mode buttons must NOT copy its size. |
| Session summary card (after End game) | NOT APPLICABLE | Game already ended; "Done" (+ "Play again" on classic summaries) are the exits; no second End game. |
| Review deck, playing cards | PRESENT | Same classic screen and same button; review answers never add to the score, but ending here still ends a live classic session and shows its summary. |
| Review complete ("You remembered X of Y") | NOT APPLICABLE | Deck finished; "Back to editions" is the exit. |
| Friend challenge, playing the route | PRESENT, different result | Button ends the route and shows "Route complete", with no session summary, because a challenge never touches the session score. |
| Friend challenge complete | NOT APPLICABLE | Route finished; "Back to editions" is the exit. |
| Tutorial practice round (first-run tour) | PRESENT | Same classic screen and same button; the practice place never adds to the score. |
| Tutorial coachmark overlay (beats over the map) | PRESENT, underneath | Overlay floats over the classic screen, so the classic End game button is still the control. |
| Tutorial invite banner on home | NOT APPLICABLE | A banner, not a game; nothing is playing to end. |
| GeoDetective, mid-case | ADDED | Today only "Editions" is here, which leaves without ending anything. |
| GeoDetective, mystery still loading | ADDED | Same main return under the same header, so the header control covers it. |
| GeoDetective, mystery failed to load | ADDED | Same main return under the same header; "Try again" stays for the mystery, End game stays for the session. |
| GeoDetective, answer revealed but "Next mystery" not yet tapped | ADDED | The finished case must survive ending (F2). |
| Cold Trail, mid-case | ADDED | Today only "All games" is here, which leaves without ending anything. |
| Cold Trail, case result shown but "Next case" not yet tapped | ADDED | The finished case must survive ending (F3). |
| Cold Trail, case files failed to load (no case) | ADDED | Separate `!caseData` return with only "← Back" today — it gets its own End game button beside "Back". |
| Home / edition picker | NOT APPLICABLE | No game is playing on this screen; picking an edition starts one. |
| Country list, State list, one country's state list | NOT APPLICABLE | Menus for choosing a game, not games; the session deliberately stays alive across these menus. |
| "Loading places" while a classic run starts | NOT APPLICABLE | No game exists yet to end; on failure the player lands back on home with an error note. |
| Classic run, places failed to load | NOT APPLICABLE | No place was played; "Back to editions" is the exit and the session stays alive for the next run. |
| Classic run, places still loading inside the run | NOT APPLICABLE | Brief loading state with no buttons. |
| Grown-ups settings overlay | NOT APPLICABLE | Settings, not a game; opens only from home, closes back to home. |
| Grown-up question gate (before the contact page) | NOT APPLICABLE | A gate question, not a game. |
| Contact page and form; Privacy page; Credits page | NOT APPLICABLE | Grown-up pages on their own routes; no game is playing there. |
| Journal section, badge row, storyteller banner on home | NOT APPLICABLE | Parts of the home page, not screens. |
| Boot splash (app still starting) | NOT APPLICABLE | Nothing is playing yet. |
| "Your game is safe" chunk-error card | NOT APPLICABLE | Recovery is "Try again" (reload); after reload the mode resumes and its End game button is back. |
| Brief loading screens ("Loading GeoDetective…", "Loading Cold Trail…", map loading) | NOT APPLICABLE | Momentary loading states with no buttons. |
| "Still there?" idle warning toast | NOT APPLICABLE | A toast over whatever screen is open, not a screen; tapping anything keeps the game alive. |
| "Your game ended after 2 minutes" notice on home | NOT APPLICABLE | The session already ended by itself; nothing left to end. |
| Map-mode notes on home; band-cleared celebration dialog; celebration overlay | NOT APPLICABLE | Notes/pop-ups over home or a run, not games; dismiss and the run's End game button is there. |

## 5. Semantics ruling (Chair)

Directed default ADOPTED, with pins: the mode End game is the SAME session-end action as classic (ends the session via the existing session-end request path; the session summary shows), with any in-progress case left intact and resumable on return.

- R1 — Seam (resolves C block 1). NEW GameApp-level state: `modeSummary: SessionSummary | null`. PlayLoaded's summary state is NOT touched (classic flow unrefactored). NEW GameApp mode End game handler (one handler, parameterized by mode, or one per mode): calls the existing session-end request path (`handleEndGame`), `clearDrop()` for parity, clears ONLY the mode open flag (`writeLoopOpen(false)` / `writeColdTrailOpen(false)` + state setter), sets `modeSummary`. It NEVER calls `endRun` and NEVER calls `onReplay`. Render branch order in GameApp: `if (run)` → `if (modeSummary)` → `if (loopOpen)` → `if (coldTrailOpen)` → home. The `modeSummary` branch renders the reused `RunSummaryCard` (no duplicated summary logic) — NOT an overlay inside the mode screen. Mode Done handler: `setModeSummary(null)`; `setStartError(null)`; `replaceSession(null)`; `setRun(null)`; `setMenu(null)`; `clearDrop()`; `setMapSwitchedNote(null)` — mirroring classic Done (`game-app.tsx:2432-2443`) minus run ops; it clears NO mode case store and NO open flag (already false). Lands on home. (No `modeSummaryOrigin` state: with Play again omitted, nothing reads it — dropped per C round-2 note 4.)
- R2 — Play again on mode summaries: OMITTED (resolves C block 2 by Chair ruling; C's dissent carried verbatim in §6). RunSummaryCard gains an optional prop (e.g. `showPlayAgain`, default `true`); classic summaries pass nothing and are byte-identical in behavior; the mode branch passes `false`. Because `onPlayAgain` stays a required prop, the mode branch passes a noop `onPlayAgain` with a comment (unreachable — the button is hidden by `showPlayAgain={false}`). Rationale: classic Play again means a fresh run on a fresh seed (`game-app.tsx:4917-4921`) plus a brand-new session (`game-app.tsx:2444`); no run exists to replay from a mode; returning to the same unsolved case is "resume", not "play again"; dealing a fresh case would destroy the case, contradicting R1. Focus safety: `focusPlayAgain` uses optional chaining, so it no-ops rather than throwing when the button is absent — and it is extended to fall back to the Done button (which gains a `data-testid`) so narration-dismiss focus still lands somewhere sensible inside the dialog, per the WCAG 2.4.3 rule the card already cites (C round-2 note 3). No test asserts a Play again destination from a mode summary. OPEN QUESTION 1 for the owner: relabel the action (e.g. "Back to case") vs omit vs other — the build is reversible on the owner's word.
- R3 — No new disclosure copy (resolves C block 3 by Chair ruling; C's dissent carried verbatim in §6). The 0/0 card is PRE-EXISTING behavior: a classic aim-phase End game before any scored place shows the same "Game over" card with 0 places / 0 score and all three edition rows at 0. The mode path opens an existing state through a new door; it does not create a new misleading state. Totals definition (session = classic-run play; mode play tracked in mode stores, not the session) is stated here and asserted by S3/F1. No locked or owner-approved copy is changed. OPEN QUESTION 2 for the owner: order disclosure copy on mode summaries, or accept the 0/0 framing as-is.
- R4 — Run-null card props (resolves C block 4). Mode branch passes: `regionName` = first `summary.regions` row's `regionName` when regions are non-empty, else `"Meridian"` (the app name — NOT a mode name, so it misattributes the score to no mode); `dateKey` = `trailDate()` at End game time; `challengeUrl = null` (derivation needs `run.pool` / `run.seed` / `run.edition`, which do not exist here); `growth = null` (PlayLoaded-local); `onReview` omitted. Share text then never dangles (regionName always non-empty). The build verifies which share function the card uses (`sessionShareText`) and that the fallback flows into it; the mode-only E2E test asserts the dialog eyebrow is non-empty and totals read exactly 0/0.
- R5 — Placement (resolves C block 5). End game sits in the header row next to the leave control in every mode-screen return that renders a header (LoopScreen header ~`LoopScreen.tsx:627-632`; TrailScreen main header ~`TrailScreen.tsx:424-428`): same shared `Button` component as the screen's leave control, label "End game", `min-h-[44px]`, keyboard-reachable in header order, no overlap with the leave control / case number / Next buttons (single-`evaluate()` rect assertions). Cold Trail's `!caseData` return (~`TrailScreen.tsx:138-147`) gets its own End game button beside "← Back" (same label, size, handler). LoopScreen loading/error states render inside the main return under the same header (build verifies; source-pin tests enforce per-return coverage).
- R6 — Abandonment is out of scope. Ending the session is NOT abandoning a case; no abandon path is added; case abandonment is a separate owner strand. No builder improvisation into Play again.
- R7 — Test hardening (accepts C note 8). Single-`evaluate()` rect measurement; viewports 360×740 AND 390×844; mode-only tests assert exact 0/0 totals as rendered; activation pre-End halves + leave + classic specs labeled GUARDS, not RED; edition set closed at exactly two mode screens.
- R8 — Reload parity (accepts C finding 2). Reload while a mode summary is open loses the summary (in-memory state only), matching classic parity. Stated, not a defect.

## 6. Councilor C round-1 challenge — disposition

C ended round 1 with `CHALLENGE` (5 blocks + 3 notes). Disposition by the Chair:

1. BLOCK (state owner / branch order / Done unpinned) — RESOLVED by R1 + R5 + §2 unit pins. GameApp-level state, branch order, and Done's exact clears are now pinned; classic PlayLoaded state untouched.
2. BLOCK (R3 Play again → same case does not stand; must go to the owner) — OVERRULED with dissent carried. Chair ruling R2 (omit Play again on mode summaries) + OPEN QUESTION 1 for the owner. C's dissent, verbatim: "R3 (Play again → same case) does not stand and must go to the owner, not be asserted. Classic Play again means a fresh run on a fresh seed (game-app.tsx:4917-4921) plus a brand-new session (game-app.tsx:2444), and the card always renders 'Play again' (run-summary.tsx). Returning to the same unsolved case is 'resume', not 'play again'. Least-bad options, all needing an owner or card-change decision: (a) resume under a relabeled action (card change), (b) deal a fresh case (destroys the case, contradicting R1), (c) omit Play again on mode summaries (card change). Interim manifest: Done only, Play again TBD, no test asserting R3."
3. BLOCK (R4 "no copy claiming mode totals" is not disclosure) — OVERRULED with dissent carried. Chair ruling R3 (no new copy; 0/0 card is pre-existing behavior) + OPEN QUESTION 2 for the owner. C's dissent, verbatim: "R4's 'no copy claiming mode totals' is not disclosure. A mode-only child sees 'Game over' with 0 places/0 score and no line saying mystery/case play is excluded (run-summary.tsx; share.ts:49-50). Either add owner-approved disclosure copy or record the owner's explicit acceptance of Game-over 0/0 framing; S3/F1 as drafted paper over it."
4. BLOCK (regionName/dateKey gap unpinned) — RESOLVED by R4 + §2 pins (fallback, `trailDate()`, nulls, omitted `onReview`, eyebrow + 0/0 assertions).
5. BLOCK (placement unspecified; Cold Trail error branch trap) — RESOLVED by R5 + §2 error-branch unit + E2E tests.
6. NOTE (F2 return step wrong: "Resume your case" only when status is "playing") — ACCEPTED; F2 corrected to "Solve a mystery" for the finished-but-unacknowledged case.
7. NOTE (abandonment out of scope, must be stated) — ACCEPTED; R6 states the exclusion.
8. NOTE (test hardening: single evaluate, 360px, exact 0/0, guards labeled, two screens) — ACCEPTED; R7 + §2.

## 7. Epistemic baseline

- Sources: repository reads only (no external facts needed; place data untouched, so card content rule 5 is not engaged). All line cites above were verified against base `b09a5c36` in `~/workspace/meridian-endgame-clone`.
- Confidence: HIGH on wiring, persistence, session math, and render precedence (all read directly). MEDIUM on visual no-overlap at 360px/390px until the E2E bbox specs run — that run is exactly the missing fact that raises it to HIGH, and it is a gate, not an assumption.

## 8. Arbiter approval

- Status: APPROVED (Chair sign-off, 2026-10-28). Challenge rounds used: 2 of 2. Round-2's single blocker (Cold Trail error-branch E2E seed unseedable) was FIXED BY AMENDMENT (§2: E2E row replaced by the unit source-pin; not overruled). Round-2 notes 2–4 fixed by amendment (noop `onPlayAgain` + focus-to-Done fallback in R2; `setStartError(null)` in R1 Done; `modeSummaryOrigin` dropped as unread).
- Unresolved objections carried: C round-1 blocks 2 and 3, verbatim in §6 (Play again semantics; 0/0 disclosure copy) — both also listed as owner open questions 1 and 2.
- Execution token: `AUTH_RUN_TDD_IMPLEMENTATION` (effective now).
