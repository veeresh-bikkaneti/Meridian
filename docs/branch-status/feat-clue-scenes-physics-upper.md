# feat/clue-scenes-physics-upper — status

## Done

- Wave 6 of the visual-explanation expansion (plan:
  `visual-expansion-inventory`): the twelve remaining Physics
  items — nine for ages 10-18 and three for ages 18+ — now
  carry a clue scene. Physics is complete: 24/24 items carry
  scenes. Six new kinds (rate-race, slope-pair, same-push,
  hill-carts, sound-path, energy-ledger); four reuses —
  magnet-pair as a two-pair variant (`twoPairs` data),
  cup-shove as a ball-stops-dead variant (`stopsDead` data),
  light-path with three-materials data (`threeMaterials`), and
  math's journey-line for the adult time item (its known
  stretch is the speed itself: 4 kilometres in 1 hour, marked
  along the 12-kilometre road). Each variant is a documented
  data branch inside the existing renderer; the earlier waves'
  paths are byte-identical when the variant data is absent.
- The descriptions join waves 4-5's in
  `src/subjects/physics/scenes.ts` (same file, same export);
  PhysicsCase's band gates widen to serve ages 7-10, 10-18 and
  18+ in both the scene and resultExtra hooks.
- Setup care, per the inventory: the rate-race carts wait at
  the start with no per-second ticks; both slope grids stand
  at equal weight with no slope line drawn and no winner
  marked; the magnet pairs rest at their given gaps with no
  snap; the same-push carts show their loads and arrows (the
  question's givens) with no roll; the hill carts show their
  heights — the question's givens — with NO stored-energy
  difference (the store stacks appear only in the solved
  beat); the transfer ball waits beside the cup with no roll;
  the sound paths show air dots and an empty gap with no wave
  travelling either; the three materials stand with no ray
  drawn at all before the pick.
- Act 3 inherited from the pilot amendment, not reinvented:
  each description carries its narrated summary (clip, script,
  beat map) in the solved-phase data path; the performance
  re-paces the solved beat to the narration through the shared
  voice channel, captions step under the film, and the full
  script stands as text in the result section. The twelve new
  clips were rendered locally in the pilot clips' voice
  (am_michael) at the same loudness targets; scenes data,
  manifest and clip files agree (unit-pinned). Clip stems are
  new and unique across the manifest (math already owns
  "unit-rate", so the physics race clip is "cart-race").
- Tests: the subjects suite passes (189/189), including the
  extended data contracts (physics coverage = exactly the 9
  dealt 10-18 items and exactly the 3 dealt 18+ items, on top
  of 7-10's 12; labels digit-free and choice-free; givens
  never the answer; beat maps pacing exactly the solved
  beat's steps; closings stating the answer; clip durations
  agreeing across data, manifest and file); tsc clean;
  nav/content/subjects lints pass; build green (the postbuild
  fingerprint step fails environmentally, as on untouched
  bases). Browser verification ran locally in headless Chrome
  against the built artifact (the disclosed Playwright
  substitute): 484/484 checks over all 12 new cases at desktop
  (1280×800) and 390 px plus a reduced-motion walk over both
  new bands, and three 7-10 cases spot-re-verified — all
  passed, no page errors, and all twelve new narration clips
  requested over the network.
- Added JS: +4,732 B gzip against the Wave 5 build (5,820,512
  → 5,825,244 B, per-file gzip over dist/client/assets) — at
  the ≈+4 KB estimate and under the 60 KB wave cap.

## Next step

- Coordinator publishes and convenes the educator/accessibility
  seats. Later waves follow the inventory's wave plan (Wave 7 =
  Chemistry 7-10 + states/mixtures 10-18); the owner confirmed
  the full expansion on 2026-11-14, so the waves proceed in
  order.

## Open questions

- Stacked on PR #490 (`feat/clue-scenes-physics-7-10-energy`,
  head `9fd75514`), itself on PR #489, PR #488, PR #487 and
  main after the 2026-11-14 merge train. This branch is a
  single commit on #490's head; its diff is exactly this
  wave's files.
- The inventory flags five of this wave's twelve items as
  BELOW band (magnet:closer, mirror:three-ways,
  ramp:adult-ratio, arrive:adult-time, energy:missing —
  report-only). Content unchanged — flags are the owner's
  decision, recorded in the PR body.

## Ruled out

- A new kind for the closer, transfer and three-ways items:
  each is a data variant of its wave-4/5 kind, keeping the
  earlier paths byte-identical.
- A scene for `math-applied:measure:survey-check`: held by the
  inventory as scene-resistant (a judgment rule, not a method);
  the owner's word only. Noted in the PR body for completeness.
- New CSS classes for the wave-6 kinds: the renderers reuse
  the pilot palette and classes only.

## Graph

- Adds: branch node `feat/clue-scenes-physics-upper`
  (depends-on PR #490 / `feat/clue-scenes-physics-7-10-energy`).
