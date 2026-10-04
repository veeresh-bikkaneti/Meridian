# BRANCH_STATUS.md — feat/cleared-mode-promotion

## Directive (Veeresh, 2026-10-04)
"When playing Nebraska in easy mode I only get asked 10 questions repeatedly.
If there are no new questions you say: player cleared easy mode, now he needs
to try medium or hard."

Today `poolForNewRun` silently resets the no-repeat history at band exhaustion
and the dealer repeats with no acknowledgment. This branch makes the reset a
celebrated, player-visible promotion moment instead.

## Design (coordinator)
- `poolForNewRun` returns `cycleCompleted: boolean` (true when the persistent
  history covered the band catalog and was reset).
- Cleared-mark per band: `meridian:cleared:v1:<edition>:<region>:<choice>`
  (was/mark/clear helpers in trail.ts). Mark = "celebration shown for the
  most recently completed cycle".
- Primary trigger: in `onContinue` ("Next place"), after the last fresh place
  is answered — check `(store IDs ∪ just-answered ID) ⊇ band catalog IDs`;
  if cleared and mark not set → celebrate + set mark (win moment, never
  mid-question).
- Backstop: at run start, if `cycleCompleted` and mark not set → celebrate
  immediately (covers pre-feature clears + crash-before-celebration); if mark
  set → clear mark silently (new cycle begins).
- Celebration: Easy→[Try Medium][Try Hard]; Medium→[Try Hard]; Hard→next
  edition (neighbor state / country / Globe). Quiet replay option always;
  one celebration per clear; dismissible; invitation-not-exile.
- Band-scoped seen keys from PR #49 untouched in behavior.

## Active
- [x] Logic crew: trail.ts API + unit tests — DONE 2026-10-03 (npx tsc --noEmit clean, npm test green)
- [x] UI crew: game-app integration + copy + neighbor data — DONE 2026-10-04 (npx tsc --noEmit clean, npm test 535/535 green)
- [x] E2E: cleared-moment spec — spec written (`tests/e2e/cleared-mode.spec.ts`,
  new `cleared-mode` Playwright project); 7/7 GREEN at 6dc4fb3 (fix crew's
  two bugs verified fixed; see "Final E2E regression sweep" below for the
  full existing-suite re-verification)
- [x] Fix crew (2026-10-04): both E2E-found bugs fixed — see "Fix crew" below
- [ ] Technical-architect review
- [ ] Tone/docs review (all player-visible strings)
- [ ] PR → merge → live verification

## Fix crew (2026-10-04)

Both E2E-blocker bugs fixed in `src/components/game-app.tsx` (+ 1 unit test
in `src/game/run.test.ts`); `npx tsc --noEmit` clean, `npm test` 536/536
green, `node scripts/lint-cards.mjs` GATE PASSED, `npm run build:pages` green.

1. **Replay resumes instead of restarting — FIXED.** `openRun` gained an
   opt-in `opts?: { fresh?: boolean }` param: when set it calls `startRun`
   instead of `resumeRun`. The celebration's `onPlayBand` handler (replay
   AND promotions) now passes `{ fresh: true }`. Picker paths keep resume
   semantics; `isResumable` untouched (a new unit test pins that a
   phase-"done" run IS resumable and that `startRun` is the restart path).
   E2E "Replay → fresh Easy run, no second celebration": GREEN.
2. **Escape falls through the celebration modal — FIXED.** `celebrationOpen`
   (`cleared !== null`) is threaded GameApp → Play → PlayLoaded; the M5
   capture-phase Escape handler early-returns while the dialog is open, so
   the dialog's own bubble-phase handler dismisses only the dialog and the
   player stays on the answered reveal. M5 behavior with the dialog closed
   is unchanged. E2E "Escape dismiss → back on reveal, Next advances
   normally": GREEN.
3. **Consistency (coordinator-approved):** the celebration's
   `onPlayBand` now also calls `setDifficultyChoice(choice)`, so a
   promotion ("Try Medium"/"Try Hard") updates the persisted
   `meridian.difficulty` choice and the picker's highlighted button follows
   the player's explicit choice.

REGRESSION SWEEP: full `cleared-mode` Playwright project 7/7 GREEN
(2026-10-04, incl. the 2 formerly-blocked tests); existing-suite
re-verification left for the review crew.

## Final E2E regression sweep (E2E runner, 2026-10-04)

Full existing suite against a fresh `npm run build:pages` from 4e5f0bb:
**75 passed, 24 failed** in the parallel run. Re-verification (serial,
`--workers=1`, `TMPDIR=~/workspace/.tmp-e2e` — see environmental note)
resolved 21 of the 24 as environmental; the cleared-mode project was
additionally re-run 7/7 GREEN at 6dc4fb3 after the tone/copy commits landed.

Per-spec re-verification (all green unless noted):
- cleared-mode: 7/7 (also 7/7 at 6dc4fb3) · gap-view-reveal.desktop: 3/3 ·
  hit-story.desktop: 1/1 · learning-outcomes.desktop: 6/6 ·
  reload-reveal.desktop: 3/3 · result-card-dismiss.desktop: 1/1 ·
  state-story.desktop: 2/2 · question-randomization: 3/3 ·
  desktop-gestures: 2/2 · session-score: 5/5 · endgame-share: 2/2 ·
  subdivision-labels: 2/2 · question-labels globe: 1/1
- history-first-cards.desktop: West Englewood + Barry Farms pass; Miami +
  Nashville fail with the SAME pre-existing signature as pristine main
  (heading never appears — dealing-side, per the 2026-10-04 main
  verification). Unchanged: not fixed, not worsened.
- question-labels country + state: FAIL — **spec bug, not an app bug**:
  `seedSeenExcept` hardcodes the `:medium` seen key (from f1c8d07, PR #49)
  but both tests pick the Easy band; the app correctly reads the
  band-scoped `:easy` key (`trail.ts` `seenKey`), so the seeding never
  takes effect and the first deal is random. Proved with a throwaway
  probe: seeding the `:easy` key deals "Austin, Texas" first
  ("Find Austin, Texas."). Needs a spec fix (parameterize the band like
  `difficulty-picker.spec.ts:77`) before the suite can go fully green.
  Pre-existing relative to this feature (introduced by the PR #49 merge;
  not on main; not caused by cleared-mode or the 4e5f0bb fix).

ENVIRONMENTAL ROOT CAUSE (resolved, no code changes): /tmp is a 512MB
tmpfs and was 87–89% full (other crews' files — not touched). Playwright
launches Chromium with `--disable-dev-shm-usage`, so the browser falls
back to /tmp for shared memory; renderers died mid-test ("Target crashed",
"browser closed", swiftshader shader-compile failures, GPU ReadPixels
stalls) across 9 unrelated specs. Running with
`TMPDIR=~/workspace/.tmp-e2e` (disk-backed, 89GB free) fixed every one of
them — tests also ran ~2x faster. **Future E2E runs on this VM must export
TMPDIR until /tmp pressure is relieved.** (Also: `pkill -x chrome` before
each run to reap leaked renderers.)

VERDICT: **no app regressions** from the cleared-mode feature or the
4e5f0bb fix. The suite's only red is (a) the 2 known pre-existing
Miami/Nashville failures and (b) the 2 question-labels spec-bug failures —
both pre-existing, neither caused by this branch's feature work. The
question-labels spec fix is recommended before PR so the suite reads
fully green.

---

## E2E findings (E2E crew, 2026-10-04)
Spec: `tests/e2e/cleared-mode.spec.ts` (7 tests, Vermont for Easy/Medium,
Rhode Island for Hard; band ids/tiers read from the shipped chunk JSON +
starters.ts, cross-checked against the run's poolIds). Project `cleared-mode`
added to playwright.config.ts. tsc clean; unit suite 535/535 green (re-verified).

GREEN (5/7):
- seed-to-exhaustion Easy celebration (heading "cleared Easy mode", Try
  Medium / Try Hard / Replay Easy buttons, mark set)
- Easy → Try Medium: fresh Medium run (run.difficultyChoice=medium, index 0),
  dealt place tier 2–4
- Medium → Try Hard: fresh Hard run, dealt place tier 4–5
- Backstop: full pre-feature clear + no mark → celebration at run start,
  mark set, dismiss leaves a playable run
- Hard-cleared Rhode Island → "True Rhode Island explorer!", "Try
  Connecticut" button → fresh Hard run in Connecticut

BLOCKED — two real app bugs (bug reports, not harness issues):
1. **Replay resumes instead of restarting.** Clicking "Replay Easy" closes
   the dialog but the run never restarts: phase stays "done" on the old
   reveal. Root cause: the celebration's replay goes through `openRun` →
   `resumeRun(readRun(), same edition/region/day/choice)`; the just-finished
   run (phase "done") IS resumable (`isResumable` only excludes "summary"),
   so `resumeRun` returns the old run. Promotion buttons never hit this
   (band/region differ); the play-again path only runs from "summary".
   Fix shape: the celebration replay must force a fresh `startRun`
   (e.g. a forceFresh flag on openRun), never resume.
2. **Escape falls through the modal.** Pressing Escape on the celebration
   dismisses the dialog AND the result card beneath it (M5's window-level
   capture-phase Escape listener runs before the dialog's bubble-phase
   handler; phase "done" ≠ "aim" → `setCardDismissed(true)`), so the
   player is NOT left on the answered reveal as the dialog's own comment
   promises. Fix shape: M5 ignores Escape while the celebration is open,
   or the dialog handles Escape in capture phase + stopPropagation.

REGRESSION SWEEP (existing suite, clean-VM re-runs):
- difficulty-picker: 6/6 green; endless-game: 2/2 green — no regressions.
- session-score: 4/5 green; the 1 failure is environmental (map data-zoom
  never stabilized during a tile outage in startGlobeRun — before any game
  logic).
- history-first-cards: West Englewood green; Miami + Nashville fail exactly
  as on pristine main (pre-existing, per 2026-10-04 main verification —
  not regressions).
- history-first-cards SPEC FIX (this branch): `commitTargetHit`'s miss-retry
  path assumed "Next place" always advances (the old silent-repeat world).
  With cleared-mode, answering the isolated 1-place target clears its band,
  so the celebration intercepts. The retry now dismisses via the × button
  (Escape would also dismiss the result card — bug #2 above) and taps Next
  again; the set mark makes it advance normally. Intentional-UX alignment,
  not a bug mask.

ENVIRONMENTAL (not app bugs): Chromium renderer "Target crashed" flakes
under this VM's memory pressure hit every spec until 11 leaked chrome
processes were reaped (each Playwright run was leaving renderers behind);
after cleanup, difficulty-picker went 3/6 → 6/6 and endless-game 0/2 → 2/2
with zero code changes.
Observation (not asserted): after "Try Medium", `meridian.difficulty`
localStorage keeps the picker's old value ("easy") — the promoted band is
carried on `run.difficultyChoice` only. Product call whether the picker
choice should follow the promotion.

## Done
- [x] Branch cut from origin/main (79c6e5a, post-PR #49)
- [x] UI crew: `poolForRunStart` threads `cycleCompleted`; backstop in
  `openRun` and the replay path (mark set → clear silently, new cycle
  begins; unmarked → celebrate once immediately — covers pre-feature
  clears and crash-before-celebration). Primary trigger in `onContinue`:
  if the just-answered place + persistent history covers the band catalog
  and the mark is unset → mark + celebrate INSTEAD of advancing (player
  stays on the answered reveal; the next "Next place" tap advances
  normally). Celebration is never mid-question.
  New: `src/components/cleared-celebration.tsx` (role=dialog, aria-modal,
  heading focus, Escape + × dismiss; all strings in `CLEARED_COPY` for
  tone review) — Easy → Try Medium/Hard; Medium → Try Hard; Hard →
  neighbor states / parent country / Globe; quiet "Replay <band>" on all;
  Globe Hard offers "More editions" (picker, session kept alive).
  New: `src/game/state-neighbors.ts` (50-state adjacency, ≤2 neighbors,
  symmetric pairs, every key/value a real regionId) + 8 unit tests.
- [x] Logic crew: `NewRunPool.cycleCompleted` (true exactly on the reset branch), cleared-mark helpers (`clearedMarkKey`/`wasClearedCelebrated`/`markClearedCelebrated`/`clearClearedMark`, fail-open, band-scoped `meridian:cleared:v1:` keys, never touched by poolForNewRun), pure `isBandCleared`; trail.test.ts extended with cycleCompleted assertions on existing cycle tests + 8 new tests (dedicated reset-branch test, key shape/disjointness, per-band round-trip, fail-open on throwing/unavailable storage, isBandCleared cover/partial/empty); tsc clean, npm test green
