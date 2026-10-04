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
- [ ] E2E: cleared-moment spec
- [ ] Technical-architect review
- [ ] Tone/docs review (all player-visible strings)
- [ ] PR → merge → live verification

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
