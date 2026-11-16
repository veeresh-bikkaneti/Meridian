# feat/clue-scenes-waves-2-10

Replaces the stacked clue-scene PRs #487 to #496 (#495 is unrelated and already merged) with one branch cut from main at 0d47ad5.

## Done
- Picked #487 (4 commits), then #488, #489, #490, #491, #492, #493, #494 and #496, in order. Every pick applied cleanly; typecheck and lint:subjects passed after each.
- New test `src/subjects/shared/clue-scene-setup-render.test.ts` renders every item's scene in its setup phase. It failed on two-step, equal-pushes, globe-vs-map and the journey-line flags before the fixes, and passes after.
- Setup films no longer draw answer-derived parts: two-step, equal-pushes, globe-vs-map, journey-line, rate-race.
- Caption capitals fixed once in `captionText` (clue-scene-types.ts).
- Dissolve narration line now says stirring speeds up dissolving.
- Educator seat must-fix: the Everest to Victoria Falls arc runs south-west instead of over the pole.

## Next step
- Re-render `public/audio/subjects/dissolve.mp3` so the voice matches the new caption for line 3. Local TTS isn't installed on the build box, and installing it needs the install audit gate.

## Open questions
- Educator seat OWNER items are listed in the PR body.
- Three setup films on main show every given object, so a child can count the answer (pencil packs x2, sandbox border). They are listed in the test's KNOWN_ON_MAIN set.

## Ruled out
- Hiding the journey-line known flag in setup: the brief asks for a neutral marker, so the flag stays and moves to scale only when solved.

## Graph
- none
