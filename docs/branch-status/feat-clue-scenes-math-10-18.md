# feat/clue-scenes-math-10-18 — status

## Done

- Wave 2 of the visual-explanation expansion (plan:
  `visual-expansion-inventory`): every Math item for ages 10-18
  now carries a clue scene — ten new kinds (array-grid,
  scale-line, percent-bar, map-scale, fraction-bar,
  fraction-measure, rate-bars, journey-line, spend-then-group,
  bearing-diagram) plus two wave-1 kinds reused (chunk-share for
  standard-algorithm, rounding-line for accuracy) and journey-line
  shared by the two rates items — so all 13 items in the band
  have the three-act treatment.
- chunk-share gained a compact plate-grid rendering for many
  shares (28 people), used only when a description's shares
  exceed the shelf wall's eight; the 7-10 shelf rendering is
  unchanged.
- Act 3 inherited from the pilot amendment, not reinvented: each
  description carries its narrated summary (clip, script, beat
  map) in the solved-phase data path; the performance re-paces
  the solved beat to the narration through the shared voice
  channel, captions step under the film, and the full script
  stands as text in the result section. The thirteen new clips
  were rendered locally in the pilot clips' voice (am_michael)
  at the same loudness targets; scenes data, manifest and clip
  files agree to the tenth of a second.
- Tests: the subjects suite passes, including the extended data
  contract (coverage = the band's items on top of 7-10, labels
  digit-free, givens never the answer — one documented exemption
  below — beat maps pacing exactly the solved beat's steps,
  closings stating the answer); tsc clean; nav/content/subjects
  lints pass; build green. Browser verification ran locally in
  headless Chromium against the built artifact (the disclosed
  Playwright substitute): checks over all 13 cases at desktop
  and 390 px plus a reduced-motion walk — all passed, no page
  errors. The e2e specs walk the full 10-18 deal order for CI.
- Added JS: measured against the merged-main build — under the
  wave's 60 KB cap (figure in the PR body).

## Next step

- Owner review. Later waves follow the inventory's wave plan
  (Wave 3 = Math 18+ + GK 7-10); the owner confirmed the full
  expansion on 2026-11-14, so the waves proceed in order.

## Open questions

- Based on main after the 2026-11-14 merge train (the pilot,
  the case-navigation fix and wave 1 all merged): this branch is
  a single commit on main `5fe47c1c`. The one shared file the
  train also touched, MathCase.tsx, was three-way merged — the
  navigation props from the case-navigation fix and this wave's
  band-gate widening both stand.
- The accuracy item's rounding-line carries the answer among its
  givens by necessity (the zoomed hundredths ARE the question —
  the tape's precision); blindness rests on the scene never
  marking the nearer end before the pick. Educator seat ruled
  in the PR body, in the pilot's exemption wording.
- Five items in this band carry educator difficulty flags from
  the inventory (multi-digit, convert-metric, accuracy and
  one-step below band; bearings above band). Content unchanged —
  the flags are the owner's decision, recorded in the PR body.

## Ruled out

- A speech-synthesis narration for act 3: superseded by the
  pilot amendment's recorded-clip pattern — one voice, measured
  timings, captions that step with the clip. No per-item TTS at
  runtime.
- New scene kinds for items the existing kinds already fit
  (standard-algorithm rides chunk-share, accuracy rides
  rounding-line, one-step rides journey-line — new descriptions
  only, plus chunk-share's compact many-shares rendering).

## Graph

No graph.json edit (branch rule). Nodes this branch would add:
the ten wave-2 scene kinds as renderer concepts under the clue
scene system; edges: each kind → the Math 10-18 items it serves
(array-grid → tables:multi-digit; scale-line →
measure:convert-metric; percent-bar → fractions:percent;
map-scale → geometry:scale-drawing; fraction-bar →
fractions:multiply; fraction-measure → fractions:divide;
rate-bars → rates:unit-rate; journey-line →
rates:constant-speed, rates:one-step; spend-then-group →
rates:two-step; bearing-diagram → trig:bearings), plus reuse
edges chunk-share → division:standard-algorithm and
rounding-line → measure:accuracy.
