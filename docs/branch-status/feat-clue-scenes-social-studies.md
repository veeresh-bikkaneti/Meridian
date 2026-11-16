# feat/clue-scenes-social-studies — status

## Done

- Wave 9 of the visual-explanation expansion (plan:
  `visual-expansion-inventory`): all twelve Social Studies
  items — the four ages 7-10 items, all five ages 10-18 items
  and all three ages 18+ items — now carry a clue scene,
  completing Social studies at 12/12. Seven new kinds
  (compass-walk and density-towns in kinds-a, two-roads and
  zone-clocks in kinds-b, globe-vs-map, great-circle and
  cost-compare in kinds-c), bringing the programme total to
  60 kinds. Five items reuse Math kinds: array-grid (with a
  documented two-fields variant branch), scale-line,
  journey-line (twice, in its known-stretch parameterisation),
  and map-scale (with a documented narrow-segment variant
  branch). Both variant branches leave the Math path
  byte-identical when their variant data is absent.
- The descriptions live in the new
  `src/subjects/social-studies/scenes.ts`; SocialStudiesCase
  gains scene and resultExtra hooks gated to all three bands,
  mirroring ChemistryCase, so every band gets scenes and
  summary text.
- Setup care, per the inventory: the compass scene draws the
  fountain and grid only — the dotted path and landing mark
  are the solved beat; the density scene draws both towns'
  dot layouts as the question's givens (the ruled
  place-compare pattern), with no winner marked; the
  two-roads scene draws both roads with their lengths as
  spatial data and no clocks filled before the pick; the
  zone-clocks scene shows the given evening hour here and
  leaves the far clock handless — its spin is solved-only;
  the globe/map scene draws both as givens, with the
  truth-telling comparison as the solved beat; the
  great-circle scene draws two pins on each surface and no
  path before the pick; the cost scene keeps the toll road's
  two coin stacks apart, never added before the pick.
- Act 3 inherited from the pilot amendment, not reinvented:
  each description carries its narrated summary (clip, script,
  beat map) in the solved-phase data path; the performance
  re-paces the solved beat to the narration through the shared
  voice channel, captions step under the film, and the full
  script stands as text in the result section. The twelve new
  clips were rendered locally in the pilot clips' voice
  (am_michael) at the same loudness targets; scenes data,
  manifest and clip files agree (unit-pinned). Clip stems are
  new and unique across the manifest.
- Tests: the subjects suite passes (212/212), including the
  new data contracts (social-studies coverage = exactly the 4
  dealt 7-10 items, exactly all 5 dealt 10-18 items and
  exactly all 3 dealt 18+ items — the whole map is exactly
  the twelve dealt items; labels digit-free and choice-free;
  givens never the answer, with the one documented
  area-by-squares exemption; beat maps pacing exactly the
  solved beat's steps; closings stating the answer; clip
  durations agreeing across data, manifest and file). The
  full `npm test` run: the src batch passes in full
  (2,749/2,749) and the scripts batch's only failure is the
  known pre-existing environmental
  `scripts/ssr-build-shape.test.mjs` (the emitted config path
  points at an ancestor build tree; it fails identically on
  the untouched Wave 8 tree). The e2e telemetry guard passes
  6/6 — every new spec imports and calls
  `serveBuiltArtifact`. tsc clean; nav/content/subjects
  lints pass; build green (the postbuild fingerprint step
  fails environmentally, as on untouched bases). Browser
  verification ran locally in headless Chrome against the
  built artifact (the disclosed Playwright substitute):
  448/448 checks passed over all 12 Social Studies cases at
  desktop (1280×800) and 390 px plus a reduced-motion walk
  over all three bands, and a Physics spot check confirming
  no other subject changed — all passed, no page errors, and
  all twelve new narration clips requested over the network.
- Added JS: +4,988 B gzip against the Wave 8 build
  (5,833,168 → 5,838,156 B, per-file gzip over
  dist/client/assets) — at the ≈+4.5 KB estimate and under
  the 60 KB wave cap.

## Next step

- Coordinator publishes and convenes the educator/accessibility
  seats. Social studies is complete; the final wave (general
  knowledge 10-18 + 18+) follows the inventory's wave plan,
  reusing this wave's great-circle kind; the owner confirmed
  the full expansion on 2026-11-14, so the waves proceed in
  order.

## Open questions

- Stacked on PR #493 (`feat/clue-scenes-chemistry-reactions`,
  head `111c5a29`), itself on PR #492, PR #491, PR #490,
  PR #489, PR #488, PR #487 and main after the 2026-11-14
  merge train. This branch is a single commit on #493's head;
  its diff is exactly this wave's files.
- One difficulty flag in this wave, report-only:
  `social-studies:compare:trip-cost` (18+) is BELOW band —
  "$10 + $6 vs $13, difference $3, is primary money addition
  and subtraction." Content unchanged.

## Ruled out

- Marking the treasure spot or drawing the compass path
  before the pick: the path is the method, so it is the
  solved beat only.
- Showing the far clock's time, the roads' filled clocks, or
  the toll road's combined coin stack before the pick: each
  states its item's result, so each is solved-only.
- New CSS classes for the wave-9 kinds: the renderers reuse
  the pilot palette and classes only.
- A scene for `math-applied:measure:survey-check`: held by
  the inventory as scene-resistant (a judgment rule, not a
  method); the owner's word only. Noted in the PR body for
  completeness.

## Graph

- Adds: branch node `feat/clue-scenes-social-studies`
  (depends-on PR #493 / `feat/clue-scenes-chemistry-reactions`).
