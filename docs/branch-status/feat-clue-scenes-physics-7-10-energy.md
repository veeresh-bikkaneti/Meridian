# feat/clue-scenes-physics-7-10-energy — status

## Done

- Wave 5 of the visual-explanation expansion (plan:
  `visual-expansion-inventory`): the remaining five items for
  Physics ages 7-10 (energy, light, magnets) now carry a clue
  scene — four new kinds (magnet-pair, drop-fall, wind-up,
  light-path), with light-path shared by the shadow item and
  the mirror item: the blocking card is the kind's own data
  (`withCard`), not a second kind. Physics ages 7-10 is now
  complete: 12/12 items carry scenes.
- The descriptions join wave 4's in
  `src/subjects/physics/scenes.ts` (same file, same export);
  PhysicsCase needed no gate change (ages 7-10 were already
  served) beyond its doc comment's wave note.
- Setup care, per the inventory: the magnet pair sits snapped
  together holding the cabinet shut — no flip, no gap; the ball
  rests on the shelf lip with no fall; both toy cars rest, the
  wound one carrying its key (the question's given) with no
  motion; both light-path setups draw the objects only — no ray
  path at all before the pick, because the path is the answer's
  mechanism — and the shadow item's card waits at the side.
- Act 3 inherited from the pilot amendment, not reinvented:
  each description carries its narrated summary (clip, script,
  beat map) in the solved-phase data path; the performance
  re-paces the solved beat to the narration through the shared
  voice channel, captions step under the film, and the full
  script stands as text in the result section. The five new
  clips were rendered locally in the pilot clips' voice
  (am_michael) at the same loudness targets; scenes data,
  manifest and clip files agree (unit-pinned).
- Tests: the subjects suite passes (185/185), including the
  updated data contracts (physics 7-10 coverage = all twelve
  dealt items exactly; labels digit-free and choice-free;
  givens never the answer; beat maps pacing exactly the solved
  beat's steps; closings stating the answer; clip durations
  agreeing across data, manifest and file); tsc clean;
  nav/content/subjects lints pass; build green (the postbuild
  fingerprint step fails environmentally, as on untouched
  bases). Browser verification ran locally in headless Chrome
  against the built artifact (the disclosed Playwright
  substitute): 445/445 checks over all 12 dealt cases at
  desktop and 390 px plus a reduced-motion walk — all passed,
  no page errors, and all twelve narration clips (the seven
  wave-4 clips and the five new ones) requested over the
  network.
- Added JS: +1,861 B gzip against the Wave 4 build (5,818,651 →
  5,820,512 B, per-file gzip over dist/client/assets) — under
  the ≈+3 KB estimate and the 60 KB wave cap.

## Next step

- Coordinator publishes and convenes the educator/accessibility
  seats. Later waves follow the inventory's wave plan (Wave 6 =
  Physics 10-18/18+); the owner confirmed the full expansion on
  2026-11-14, so the waves proceed in order.

## Open questions

- Stacked on PR #489 (`feat/clue-scenes-physics-7-10-forces`,
  head `2bb3dff0`), itself on PR #488, PR #487 and main after
  the 2026-11-14 merge train. This branch is a single commit on
  #489's head; its diff is exactly this wave's files.
- The inventory flags none of this wave's five items for
  difficulty (all five physics flags sit in the 10-18/18+
  bands, Wave 6). Content unchanged — flags are the owner's
  decision, recorded in the PR body.

## Ruled out

- A second light kind for the mirror item: light-path serves
  both descriptions, with the card modelled in the kind's data.
- A scene for `math-applied:measure:survey-check`: held by the
  inventory as scene-resistant (a judgment rule, not a method);
  the owner's word only. Noted in the PR body for completeness.
- New CSS classes for the wave-5 kinds: the renderers reuse the
  pilot palette and classes only.

## Graph

- Adds: branch node `feat/clue-scenes-physics-7-10-energy`
  (depends-on PR #489 / `feat/clue-scenes-physics-7-10-forces`).
