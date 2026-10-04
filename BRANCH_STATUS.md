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
- [ ] UI crew: game-app integration + copy + neighbor data
- [ ] E2E: cleared-moment spec
- [ ] Technical-architect review
- [ ] Tone/docs review (all player-visible strings)
- [ ] PR → merge → live verification

## Done
- [x] Branch cut from origin/main (79c6e5a, post-PR #49)
- [x] Logic crew: `NewRunPool.cycleCompleted` (true exactly on the reset branch), cleared-mark helpers (`clearedMarkKey`/`wasClearedCelebrated`/`markClearedCelebrated`/`clearClearedMark`, fail-open, band-scoped `meridian:cleared:v1:` keys, never touched by poolForNewRun), pure `isBandCleared`; trail.test.ts extended with cycleCompleted assertions on existing cycle tests + 8 new tests (dedicated reset-branch test, key shape/disjointness, per-band round-trip, fail-open on throwing/unavailable storage, isBandCleared cover/partial/empty); tsc clean, npm test green
