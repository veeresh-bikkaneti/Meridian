# feat/clue-scenes-gk-remainder — status

## Done

- Wave 10 of the visual-explanation expansion (plan:
  `visual-expansion-inventory`): the final five General
  Knowledge items — all three ages 10-18 items and both ages
  18+ items — now carry a clue scene, completing General
  Knowledge at 10/10 and the whole expansion programme at 90
  of 91 questions (the one held item is Math's
  `math-applied:measure:survey-check`, untouched). Three new
  kinds (stack-drops, angle-sight and flow-counter, all in
  kinds-c), bringing the programme total to 63 kinds. Two
  items reuse shared kinds outright: journey-line (Math) for
  the Paris–Sydney flight, in its known-stretch
  parameterisation (850 km per hour toward 17,000 km, 20
  hops), and great-circle (Social Studies, wave 9) for
  Everest to Victoria Falls — the shared kind wave 9
  parameterised for exactly this reuse, not forked.
- The descriptions live in
  `src/subjects/general-knowledge/scenes.ts` beside the wave-3
  ones; GeneralKnowledgeCase's scene and resultExtra hooks
  widen from ages 7-10 only to all three bands, mirroring the
  other completed subjects, so every band gets scenes and
  summary text.
- Setup care, per the inventory: the stack-drops scene draws
  the peak and the falls' single drop as givens only — no
  stack, no counter before the pick; the angle-sight scene
  draws the observer, the tower and a short dashed sight ray
  that stops in mid-air, so the height cannot be measured off
  the picture — the full sight line and the height bracket
  are solved-only; the flow-counter scene draws the falls and
  its pool only — the per-minute droplet row, the day field
  and the power-of-ten bars are all solved-only, and no digit
  appears in any setup frame (the day total lives in the
  narration and the result card, as in the earlier counter
  kinds); the great-circle scene draws two pins on the globe
  and no path before the pick, as in wave 9.
- Act 3 inherited from the pilot amendment, not reinvented:
  each description carries its narrated summary (clip, script,
  beat map) in the solved-phase data path; the performance
  re-paces the solved beat to the narration through the shared
  voice channel, captions step under the film, and the full
  script stands as text in the result section. The
  great-circle script presents its distance honestly: it
  teaches the method (the shortest surface route is a great
  circle) and states the known 8,000 to 8,500 km range as the
  answer, rather than pretending the film derives it. The
  five new clips were rendered locally in the pilot clips'
  voice (am_michael) at the same loudness targets; scenes
  data, manifest and clip files agree (unit-pinned). Clip
  stems are new and unique across the manifest (90 clips in
  all).
- Tests: the subjects suite passes (218/218), including the
  widened data contracts (general-knowledge coverage = exactly
  the 10 dealt items, 5 / 3 / 2 across the bands; labels
  digit-free and choice-free; givens never the answer; beat
  maps pacing exactly the solved beat's steps; closings
  stating the answer; clip durations agreeing across data,
  manifest and file). The shared kinds test gains its wave-10
  block, and the math scenes test's kind switches learn the
  three new kinds (the exhaustiveness the shared type union
  requires). The full `npm test` run: the src batch passes in
  full (2,755/2,755) and the scripts batch's only failure is
  the known pre-existing environmental
  `scripts/ssr-build-shape.test.mjs` (the emitted config path
  points at an ancestor build tree; it fails identically on
  the untouched Wave 9 tree). The e2e telemetry guard passes
  6/6 — every new spec imports and calls
  `serveBuiltArtifact`. tsc clean; nav/content/subjects
  lints pass; build green (the postbuild fingerprint step
  fails environmentally, as on untouched bases). Browser
  verification ran locally in headless Chrome against the
  built artifact (the disclosed Playwright substitute):
  374/374 checks passed over all 10 General Knowledge cases at
  desktop (1280×800) and 390 px plus a reduced-motion walk
  over all three bands, and a Physics spot check confirming
  no other subject changed.
- Added JS: +1,847 B gzip against the Wave 9 build
  (5,838,156 → 5,840,003 B, per-file gzip over
  dist/client/assets) — under the ≈+2.5 KB estimate.

## Next step

- Coordinator publishes and convenes the educator/accessibility
  seats. General Knowledge is complete at 10/10; with this wave
  the visual-expansion programme is complete (90 of 91
  questions; the one held item below remains held).

## Open questions

- Stacked on PR #494 (`feat/clue-scenes-social-studies`,
  head `4eac9686`), itself on PR #493, PR #492, PR #491,
  PR #490, PR #489, PR #488, PR #487 and main after the
  2026-11-14 merge train. This branch is a single commit on
  #494's head; its diff is exactly this wave's files.
- Two difficulty flags in this wave, report-only:
  `general-knowledge:mixed:tower-angle` (10-18) is ABOVE band
  — "Height from 1,000 ft at 47° requires tangent
  trigonometry, an upper-secondary spike above the band's
  core"; `general-knowledge:mixed:great-circle` (18+) is
  ABOVE band — "The 8,000–8,500 km surface distance cannot be
  derived from any data in the prompt; it demands specialist
  geographic estimation." Content unchanged.

## Ruled out

- Drawing the drop stack, the completed sight line, the
  height bracket, or any counter or total before the pick:
  each states its item's result, so each is solved-only.
- Forking the great-circle kind for General Knowledge: wave 9
  built it as a shared kind for this reuse, so the GK item
  parameterises the same kind.
- Digits in the flow scene's setup or solved frames: the
  counters follow the established digit-free tick patterns;
  the arithmetic lives in the narration and result card.
- A scene for `math-applied:measure:survey-check`: held by
  the inventory as scene-resistant (a judgment rule, not a
  method); the owner's word only. Noted in the PR body for
  completeness.

## Graph

- Adds: branch node `feat/clue-scenes-gk-remainder`
  (depends-on PR #494 / `feat/clue-scenes-social-studies`).
