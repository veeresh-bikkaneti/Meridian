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
- [~] E2E: cleared-moment spec — spec written (`tests/e2e/cleared-mode.spec.ts`,
  new `cleared-mode` Playwright project); 5/7 green; 2 BLOCKED on real app
  bugs found by the spec (see "E2E findings" below) — not committable as
  green until the app crew fixes them
- [ ] Technical-architect review
- [ ] Tone/docs review (all player-visible strings)
- [ ] PR → merge → live verification

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
