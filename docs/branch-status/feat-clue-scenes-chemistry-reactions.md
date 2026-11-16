# feat/clue-scenes-chemistry-reactions — status

## Done

- Wave 8 of the visual-explanation expansion (plan:
  `visual-expansion-inventory`): the six remaining Chemistry
  items — the three ages 10-18 reactions items and all three
  ages 18+ items — now carry a clue scene, completing
  Chemistry at 16/16. Six new kinds (scale-balance and
  bubble-reaction in kinds-a, rust-change and glow-rate in
  kinds-b, atom-tally and column-cousins in kinds-c),
  bringing the programme total to 53 kinds. No kind is
  reused this wave; each item's scene is its own.
- The descriptions live in `src/subjects/chemistry/scenes.ts`
  alongside the wave-7 ten; ChemistryCase's scene and
  resultExtra hooks are widened from ages 7-10 and 10-18 to
  include 18+, so all three bands get scenes and summary text.
- Setup care, per the inventory: the scale's dial face is
  blank in setup (no needle, no reading — the beam is never
  shown level as a result); the mixing glass stands empty
  and still, with no bubbles; the bike is plain metal under
  the rain the prompt itself gives, with no rust shown; both
  glow sticks glow alike, neither faded; the atom clusters
  stand uncounted with no pairing or matching mark; the
  column's two tiles are plain and unmarked, with no shared
  highlight.
- Act 3 inherited from the pilot amendment, not reinvented:
  each description carries its narrated summary (clip, script,
  beat map) in the solved-phase data path; the performance
  re-paces the solved beat to the narration through the shared
  voice channel, captions step under the film, and the full
  script stands as text in the result section. The six new
  clips were rendered locally in the pilot clips' voice
  (am_michael) at the same loudness targets; scenes data,
  manifest and clip files agree (unit-pinned). Clip stems are
  new and unique across the manifest.
- Tests: the subjects suite passes (202/202), including the
  new data contracts (chemistry coverage = exactly the 5
  dealt 7-10 items, exactly all 8 dealt 10-18 items and
  exactly all 3 dealt 18+ items — the whole map is exactly
  the sixteen dealt items; labels digit-free and choice-free;
  givens never the answer; beat maps pacing exactly the solved
  beat's steps; closings stating the answer; clip durations
  agreeing across data, manifest and file); tsc clean;
  nav/content/subjects lints pass; build green (the postbuild
  fingerprint step fails environmentally, as on untouched
  bases). Browser verification ran locally in headless Chrome
  against the built artifact (the disclosed Playwright
  substitute): 596/596 checks passed over all 16 Chemistry
  cases at desktop (1280×800) and 390 px plus a reduced-motion
  walk over all three bands, and a Physics spot check
  confirming no other subject changed — all passed, no page
  errors, and all six new narration clips requested over the
  network.
- Added JS: +3,175 B gzip against the Wave 7 build (5,829,993
  → 5,833,168 B, per-file gzip over dist/client/assets) — at
  the ≈+4 KB estimate and under the 60 KB wave cap.

## Next step

- Coordinator publishes and convenes the educator/accessibility
  seats. Chemistry is complete; later waves follow the
  inventory's wave plan (the remaining subjects); the owner
  confirmed the full expansion on 2026-11-14, so the waves
  proceed in order.

## Open questions

- Stacked on PR #492 (`feat/clue-scenes-chemistry-states`,
  head `cdf41f2d`), itself on PR #491, PR #490, PR #489,
  PR #488, PR #487 and main after the 2026-11-14 merge train.
  This branch is a single commit on #492's head; its diff is
  exactly this wave's files.
- The inventory flags no item in this wave (no difficulty
  flags — report-only section in the PR body says so).
  Content unchanged.

## Ruled out

- A balance-beam setup for scale-balance: a beam shown level
  before the pick would state the result, so the scene uses a
  top-pan scale whose dial stays blank until the solved beat.
- Showing the glow bowls' temperatures as text or digits in
  the scene: the bowls are told apart by the warmth waves and
  ice cubes the question itself names; labels stay digit-free.
- A scene for `math-applied:measure:survey-check`: held by
  the inventory as scene-resistant (a judgment rule, not a
  method); the owner's word only. Noted in the PR body for
  completeness.
- New CSS classes for the wave-8 kinds: the renderers reuse
  the pilot palette and classes only.

## Graph

- Adds: branch node `feat/clue-scenes-chemistry-reactions`
  (depends-on PR #492 / `feat/clue-scenes-chemistry-states`).
