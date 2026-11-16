# feat/clue-scenes-physics-7-10-forces — status

## Done

- Wave 4 of the visual-explanation expansion (plan:
  `visual-expansion-inventory`): the seven forces-and-motion
  items for Physics ages 7-10 now carry a clue scene — five new
  kinds (push-duel, tile-steps, slide-stop, cup-shove,
  seesaw-lift), with tile-steps shared by the counting item and
  the two-cart racing item and push-duel shared by the
  unequal-push item and the matched-push gate item.
- Physics is wired for scenes: `src/subjects/physics/scenes.ts`
  (descriptions next to the answers, the math pattern) and
  scene + resultExtra hooks in PhysicsCase.tsx mirroring the
  general-knowledge case, gated to ages 7-10. The other five
  ages 7-10 items (magnet, drop, energy, shadow, mirror) belong
  to wave 5 and carry no descriptions yet — pinned by unit test.
- Setup care, per the inventory: the push-duel setup draws both
  arrows at the lengths the question itself states and the
  block does not move; the cup-shove setup shows no slide at
  all (each hit's slide distance is solved-phase layout only);
  the seesaw setup rests level; the tug item's solved beat
  still has three steps (arrows press, gate strains, final tick
  on the gate) even though nothing moves.
- Act 3 inherited from the pilot amendment, not reinvented:
  each description carries its narrated summary (clip, script,
  beat map) in the solved-phase data path; the performance
  re-paces the solved beat to the narration through the shared
  voice channel, captions step under the film, and the full
  script stands as text in the result section. The seven new
  clips were rendered locally in the pilot clips' voice
  (am_michael) at the same loudness targets; scenes data,
  manifest and clip files agree (unit-pinned).
- Tests: the subjects suite passes (182/182), including the new
  data contracts (physics 7-10 coverage = the seven dealt
  forces-and-motion items exactly, the five wave-5 items
  description-free; labels digit-free and choice-free; givens
  never the answer; beat maps pacing exactly the solved beat's
  steps; closings stating the answer; clip durations agreeing
  across data, manifest and file); tsc clean; nav/content/
  subjects lints pass; build green (the postbuild fingerprint
  step fails environmentally, as on untouched bases).
  Browser verification ran locally in headless Chrome against
  the built artifact (the disclosed Playwright substitute):
  305/305 checks over all 12 dealt cases at desktop and 390 px
  plus a reduced-motion walk — all passed, no page errors.
  Caveat: after the first solved case, the one-time
  first-discovery celebration overlay covers part of the proof
  screenshots (its close control is not text-matched by the
  harness's dismiss helper); every check is DOM-level and
  unaffected.
- Added JS: +3,261 B gzip against the Wave 3 build (5,815,390 →
  5,818,651 B, per-file gzip over dist/client/assets) — under
  the ≈+3.5 KB estimate and the 60 KB wave cap.

## Next step

- Coordinator publishes and convenes the educator/accessibility
  seats. Later waves follow the inventory's wave plan (Wave 5 =
  the remaining Physics 7-10 items); the owner confirmed the
  full expansion on 2026-11-14, so the waves proceed in order.

## Open questions

- Stacked on PR #488 (`feat/clue-scenes-math-18plus-gk-7-10`,
  head `2cd8ff7c`), itself on PR #487 and main after the
  2026-11-14 merge train. This branch is a single commit on
  #488's head; its diff is exactly this wave's files.
- The inventory flags none of this wave's seven items for
  difficulty (all five physics flags sit in the 10-18/18+
  bands, Wave 6). Content unchanged — flags are the owner's
  decision, recorded in the PR body.

## Ruled out

- Scenes for the other five Physics 7-10 items: they are Wave
  5's scope (magnet, drop, energy, shadow, mirror), not held —
  they carry no descriptions in this wave, pinned by test.
- A scene for `math-applied:measure:survey-check`: held by the
  inventory as scene-resistant (a judgment rule, not a method);
  the owner's word only. Noted in the PR body for completeness.
- New CSS classes for the wave-4 kinds: the renderers reuse the
  pilot palette and classes only (hop ghosts ride the
  counter-step fade keyframes; the seesaw tilt is drawn as
  geometry so the still frame rests on the final frame).
