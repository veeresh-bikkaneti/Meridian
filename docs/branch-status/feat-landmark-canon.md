# Branch status — feat/landmark-canon

**Job:** port the owner-approved landmark globe mockup (37 landmarks,
oblique tap-to-dive, progressive reveal) from the staging branch
`mockup/famous-landmarks` @ `062093ca` to a real branch + DRAFT PR.
**Merge freeze in force** — this branch never merges on this lane;
the PR is a draft and merge waits for the owner's word + freeze lift
+ panel.

## Base + landing

- Base: origin/main `b740197d` (#544, docs-only over the mockup's
  base `dfb15d5b`).
- Landing: net patch of the four globe source files applied as
  `ee80cc1a`; verified byte-identical to staging tip `062093ca` for
  home-globe.tsx, globe-contract.ts, landmark-models.ts,
  globe-controls.ts. (Cherry-pick of the wave commits conflicted on
  an intermediate capture commit, so the brief's net-patch route was
  used.)

## Port list — all items landed, evidence per item

- [x] (a) Tap -> dive proven with a REAL tap — `4c518c1d`; the
      pointer->NDC cause fixed in production code; e2e
      `home-globe.desktop.spec.ts` "a real tap on a landmark dives
      to it and parks; a real drag lets go" (real mouse tap on
      Liberty's projected point, label parks, drag un-parks).
- [x] (b) __globeMock removed from production code — `903626b5`;
      grep-verified ZERO occurrences in `src/` (parent + close-out).
      Captures/tests now use real taps + test-side WebGL
      instrumentation (no app seam).
- [x] (c) Spin-resume quirk — `903626b5`: zoom input parks the slow
      turn the way the dive does ("park the slow turn on zoom");
      dive-park hold asserted in the real-tap e2e (label still
      parked 3 s past the 1.5 s flight).
- [x] (d) Weak models reworked — `f9283308` (all eight: grandcanyon
      gorge incised, rushmore heads in the cliff face, niagara
      horseshoe + curtain + gorge, victoriafalls curtain + mist,
      chichen at full scale, brandenburg colonnade face + spin,
      forbidden massing, petra facade relief + spin) + `889b0603`
      (Victoria Falls curtain/mist polish). Dive captures below —
      read first-hand at close-out; verdicts are mixed and stated
      plainly there.
- [x] (e) Unit pins moved + coverage — `4c518c1d` (LANDMARKS 37,
      zoom.min 1.95, diveDist 2.05, tiers + focus bands pinned in
      globe-contract.test.ts; controls state machine in
      globe-controls.test.ts). Gates re-run at close-out, below.
- [x] (f) Negative tests (never-happen list) — in
      `home-globe.desktop.spec.ts`: a drag across a landmark does
      NOT dive; a tap on empty ocean does NOT dive; the expedition
      card over the canvas swallows the tap (no dive); globe view
      draws the skin tier only (no B/C crowd, frame budget holds);
      e2e readings fixed in `153804d2`.
- [x] Captures generated locally (12 of 13 — see the Rushmore gap) + DRAFT
      PR opened at close-out.

## Captures (docs/motion-verify/) — close-out verdicts, read first-hand

Captures are generated locally and are not stored in git (TD-13.1);
regenerate with `node scripts/record-motion-verify.mjs`. Filenames
below are the historical capture names.

- home-full-1280 / 768 / 390 / 320: PASS — page populated end to
  end at all four widths; Tier-A-only globe skin; footer complete.
  (The fixed tour card overlays part of the stitched full-page
  frames — a capture artefact of the overlay, present in all
  first-visit captures.)
- dive-liberty: PASS — Liberty in profile + CN Tower; the
  trans-Atlantic horizon band is sunk (reference dive, not a
  rework).
- dive-chichen: PASS — stepped pyramid, central staircase, top
  temple: reads unmistakably as El Castillo at full scale.
- dive-brandenburg: PASS — colonnade + entablature + quadriga mass
  face the camera (spin solved); reads as the Gate. Big Ben crowds
  the left edge of the frame.
- dive-petra: PASS with occlusion — the Treasury facade relief
  (reddish-brown, columned) is carved into the cliff face and
  presented to camera; the Pyramids/Sphinx models crowd the lower
  foreground.
- dive-forbidden: PARTIAL — tiered palace roof + red walls +
  corner towers with the Great Wall behind reads as the Forbidden
  City's massing; still roof-dominant.
- dive-grandcanyon: PARTIAL — terraced strata read as canyon rims
  and the frame is cured of crowding (Canyon + Golden Gate +
  Rushmore only), but the incised gorge slot is not visible from
  the finish angle, and the Golden Gate (a true neighbour) looms.
- dive-victoriafalls: PARTIAL — the pale curtain sheet is visible
  in the gorge slot between strata bands; reads weakly as a falls,
  mostly as stacked slabs.
- dive-niagara: WEAK — the falls do not read: the frame centres
  Liberty + CN Tower with Niagara's pale stepped drum at centre;
  the horseshoe/curtain relationship is not legible.
- dive-rushmore: **MISSING.** The zz capture driver's tap could
  not land on Rushmore in two separate hermetic runs (its own
  re-pose retry included, both times "tap did not dive"). The
  driver is deleted with the other scaffolding; no cure was
  started in the close-out leg. Partial evidence only: Rushmore's
  four heads are visible in-frame behind the Canyon in
  dive-grandcanyon.png — that is not a dive close-up proof.

## Gates — close-out confirmation run on tip `889b0603`

Hermetic recipe (docs/e2e-hermetic.md): complete `npm ci` in this
checkout, `VITE_KOFI_URL` in build + runner envs, pinned Chromium,
flock, --workers=1.

- `npm run build:pages` — PASS
- `npx tsc --noEmit` — PASS
- `npm run lint:nav` — PASS
- `npm run check:provenance` (origin/main..HEAD) — PASSED
- Globe unit tests (globe-contract.test.ts + globe-controls.test.ts)
  — 19/19 PASS
- `tests/e2e/home-globe.desktop.spec.ts` — PASS (exit 0, no failure
  artifacts)

## Budgets

- Enforced in-spec on this branch (both green in the gate run):
  globe frame <= 60 draw calls and < 45,000 tris (Tier-A skin,
  ~46 calls per the spec's settled-frame sampler); dive frame
  <= 60 draw calls.
- Staging-measured reference (mockup tip, pre-port model reworks):
  globe 18,712 tris / 46 calls; Grand Canyon dive 13,496 tris /
  13 calls; 37 landmark models 20,582 tris total.

## Checkpoint accounting (close-out leg)

- Close-out cap 30,000 tokens; the ~18,000 (60%) checkpoint fell
  inside the gate-confirmation runs. State written here per the
  checkpoint rule; the leg finished the bounded close-out under
  the cap (estimate, ±30%).
- The original port lane (cap 100,000) ended without a report;
  its commits `ee80cc1a`..`889b0603` are its evidence.

## Next step / open questions / ruled out

- Next: owner's eye on the draft PR + panel, on his word. Merge
  waits for the freeze lift + his per-PR word.
- Open: dive-rushmore.png capture (driver tap miss — needs a pose
  fix or a different capture route); niagara's read is still weak
  and grandcanyon/victoriafalls/forbidden are partial — model
  follow-ups for a later lane, not this close-out.
- Ruled out: shipping the zz capture/diag specs (deleted —
  scaffolding and diagnostics never ship on a real branch);
  re-running the full e2e suite locally (narrow gates only, CI
  carries the bulk).

## Graph

- Node: branch `feat/landmark-canon` (landmark canon port).
- Edge: `feat/landmark-canon` —documents→
  `src/components/home-globe/globe-contract.ts` (the 37-landmark
  canon of record).
