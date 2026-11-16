# feat/clue-scenes-chemistry-states — status

## Done

- Wave 7 of the visual-explanation expansion (plan:
  `visual-expansion-inventory`): ten Chemistry items — all
  five ages 7-10 items and the five ages 10-18 states,
  mixtures and materials items — now carry a clue scene.
  Eight new kinds (melt-freeze, bend-test, magnet-sort,
  rebuild-pieces, salt-melt, dissolve, particle-states,
  water-cycle); two reuses — melt-freeze in its freeze
  direction (`freeze` data) for the puddle item, and dissolve
  as a three-blocks variant (`threeBlocks` data) for the
  identify item. Each variant is a documented data branch
  inside the existing renderer; the earlier waves' paths are
  byte-identical when the variant data is absent.
- The descriptions live in the new
  `src/subjects/chemistry/scenes.ts`; ChemistryCase gains the
  scene and resultExtra hooks, gated to ages 7-10 and 10-18
  (descriptions exist only for this wave's ten items; the
  reactions items and all ages 18+ items return null and stay
  text-only until wave 8).
- Setup care, per the inventory: the ice pop stands whole
  with no drips and no warmth marked; the puddle is open with
  no ice skin; both spoons rest unpressed (which bends is
  spent only in the solved beat); the magnet-sort pile is one
  seeded mixed scatter, never sorted by material in any
  visible way, with the magnet held clear; the short bridge
  stands as the given; the salt specks rest on unbroken ice
  with the air cold and no melt; the crystals sit whole in
  the glass; the three state panels show the question's own
  pictures with no warmth progression marked; the water-cycle
  setup is puddle and sky only, no cloud.
- Act 3 inherited from the pilot amendment, not reinvented:
  each description carries its narrated summary (clip, script,
  beat map) in the solved-phase data path; the performance
  re-paces the solved beat to the narration through the shared
  voice channel, captions step under the film, and the full
  script stands as text in the result section. The ten new
  clips were rendered locally in the pilot clips' voice
  (am_michael) at the same loudness targets; scenes data,
  manifest and clip files agree (unit-pinned). Clip stems are
  new and unique across the manifest.
- Tests: the subjects suite passes (199/199), including the
  new data contracts (chemistry coverage = exactly the 5
  dealt 7-10 items and exactly the 5 dealt states/mixtures/
  materials 10-18 items; reactions and 18+ items pinned
  description-free; labels digit-free and choice-free; givens
  never the answer; beat maps pacing exactly the solved
  beat's steps; closings stating the answer; clip durations
  agreeing across data, manifest and file); tsc clean;
  nav/content/subjects lints pass; build green (the postbuild
  fingerprint step fails environmentally, as on untouched
  bases). Browser verification ran locally in headless Chrome
  against the built artifact (the disclosed Playwright
  substitute): 400/400 checks over all 10 new cases at desktop
  (1280×800) and 390 px plus a reduced-motion walk over both
  bands, and the three reactions cases walked plain — all
  passed, no page errors, and all ten new narration clips
  requested over the network.
- Added JS: +4,749 B gzip against the Wave 6 build (5,825,244
  → 5,829,993 B, per-file gzip over dist/client/assets) — at
  the ≈+5 KB estimate and under the 60 KB wave cap.

## Next step

- Coordinator publishes and convenes the educator/accessibility
  seats. Later waves follow the inventory's wave plan (Wave 8 =
  Chemistry reactions + 18+); the owner confirmed the full
  expansion on 2026-11-14, so the waves proceed in order.

## Open questions

- Stacked on PR #491 (`feat/clue-scenes-physics-upper`,
  head `82a50557`), itself on PR #490, PR #489, PR #488,
  PR #487 and main after the 2026-11-14 merge train. This
  branch is a single commit on #491's head; its diff is
  exactly this wave's files.
- The inventory flags one of this wave's ten items as BELOW
  band (chemistry:states:particles — report-only). Content
  unchanged — the flag is the owner's decision, recorded in
  the PR body.

## Ruled out

- A new kind for the freeze-direction and identify items:
  each is a data variant of its wave-7 kind (melt-freeze
  `freeze`, dissolve `threeBlocks`), keeping the shared paths
  single.
- Scenes for the reactions items (weight, new-look, rust)
  and the ages 18+ items in this wave: they are wave 8's
  scope and stay description-free here.
- A scene for `math-applied:measure:survey-check`: held by
  the inventory as scene-resistant (a judgment rule, not a
  method); the owner's word only. Noted in the PR body for
  completeness.
- New CSS classes for the wave-7 kinds: the renderers reuse
  the pilot palette and classes only.

## Graph

- Adds: branch node `feat/clue-scenes-chemistry-states`
  (depends-on PR #491 / `feat/clue-scenes-physics-upper`).
