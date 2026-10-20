# BRANCH_STATUS.md — fix/geodetective-far-ring-166

## What
Issue #166: a GeoDetective miss wider than a quarter of the planet
(> 10,007.5 km) drew its distance ring from geometry emitted in a
repeated world copy. Fix = Option A — owner, 2026-10-20: "Build ring
option A (antipode reframe)" — after a 10-role verification panel
confirmed it 10/10: `ringPolygon` traces
the identical circle as a small ring around the guess's antipode —
same points, same exact distances, target still on the ring.

## The bug, plainly
- The ring math was always exact. The problem is WHICH copy of the
  world the traced loop lands in: for Point Nemo → Ankara (17,895 km)
  the old code emitted raw longitudes of −333…−274, i.e. the loop
  around the antipode addressed in the world copy west of the map.
- On today's MapLibre, the tile worker happens to wrap a single
  coherent loop back into the primary copy, so the ring usually still
  draws. The GeoJSON the app emits is nevertheless wrong, and any
  consumer that does not wrap it (another renderer, a future MapLibre,
  geometry math, a fill) gets a loop half a planet off. This fix makes
  the emitted geometry correct instead of rescued.

## Done (2026-10-20)
- `src/game/loop/rings.ts`: when `radiusKm` exceeds a quarter
  circumference, recurse once from the antipode with radius
  HALF − r. Constants derived from the file's own `EARTH_KM`
  (`QUARTER = π/2 × EARTH_KM`, `HALF = π × EARTH_KM`), not hardcoded —
  geo.ts uses R = 6371.0088, so a near-antipodal distance can arrive
  ~0.03 km above rings' HALF; the reframed radius is clamped at 1 km
  so it never goes negative. Plain-language WHY comment in the code.
- Sub-threshold output verified byte-identical to main's function
  (r = 500 / 8,764.06 / 9,000 / 10,006 / exactly QUARTER / a
  pole-enclosing ring). All three consumers (guess rings, Cold-Trail
  witness rings, F11 lens) share this one function, so all inherit it.
- Unit tests (+5): far-ring exactness (every vertex at true radius
  from the guess AND at HALF − r from the antipode, all longitudes in
  [−180, 180]); threshold boundary 10,006 vs 10,009 km asserting frame
  containment + antipode distances (no signed-area assertion — the
  panel found its sign convention-dependent); near-antipodal
  r = 19,500 plus the over-HALF residue; the ring-label invariant
  (destination(guess, 0, distKm) lies on the reframed ring).
- Witness safety pinned in `src/game/coldtrail/cases.test.ts` — and
  stated honestly: there is NO code clamp on witness radii anywhere.
  The test walks the shipped deck (60 cases, 180 sightings, max
  4,000 km < 10,007.5 km) and fails loudly if a future deck crosses
  the threshold. Data-verified, not code-enforced. (`effectiveRadius`
  only ever shrinks a witness radius, ÷2 with the informant on.)
- E2E (`geodetective-unlabeled-tap.spec.ts`): the old excuse NOTE
  ("the ring wraps the globe, degenerate render — not asserted") is
  replaced with a real assertion: after the Point Nemo confirm, the
  camera frames the antipode (56.6°E, 48.9°N) and the ring must be
  present in the loaded tiles, with its source centroid within 10° of
  the antipode — not the tap.
- Screenshots for the owner's eyeball:
  `~/workspace/your_files/issue-166-shots/` — before/after pairs for
  (a) Point Nemo → Ankara, (b) an 11,000 km South Atlantic tap,
  (c) a 19,496 km near-antipodal tap (world framing + a zoom on the
  tiny loop, label sitting on the ring). Honest note: in the E2E
  harness (stub tiles) the worker wrap makes before/after render
  alike at these framings; the pairs document the contract (loop
  around the antipode region, target on it, reads as a line).

## Mutation evidence
- Unit (the discriminating proof): with the reframe block surgically
  removed from the fixed rings.ts, exactly the new far-ring test
  fails — 8 pass / 1 fail. Full suite green with the fix in place.
- Raw ranges measured on the real files in node:
  pre-fix `ringPolygon(Nemo, 17,895)` longitudes [−333.18, −273.62];
  post-fix [26.84, 86.38] (pipeline-measured; an earlier draft of this
  file said [26.79, 86.41] — the panel's measurement stands).
- E2E (reported straight): the updated spec was also run against a
  build with main's rings.ts swapped in, and it PASSES there.
  MapLibre canonicalizes both source reads and tiles (getData on the
  pre-fix build returned the folded [26.8, 86.4] band — verified with
  a probe, including a steps-marker rebuild to prove the build was
  honest), so no browser-level coordinate assertion can discriminate
  in this harness. Per the panel's fallback clause the E2E pins the
  render contract; the discrimination lives at the unit level above.
  An earlier draft asserted the raw range via getData, passed on the
  pre-fix build, and was rewritten — recorded so nobody re-adds it
  believing it is mutation-proof.

## Gates (2026-10-20, this branch)
- `npx tsc --noEmit` — clean.
- `npm test` — scripts suite 790 pass / 9 skipped / 0 fail (799);
  src suite 1363 pass / 0 fail (main: 1358; +5 new tests).
- `node scripts/lint-cards.mjs` — GATE PASSED.
- `npm run build:pages` — green.
- E2E touched spec — 2 passed on the fixed build (and 2 passed on
  the pre-fix build; see mutation note). One dialog-wait pacing
  flake seen once on each build family during the session — the
  failure snapshot showed "Still loading place names", the known
  tap-after-load race on this VM, unrelated to rings; re-runs green.

## Pending
- Full-pipeline review: READY (2026-10-20, zero BLOCKs, 12/12
  approve-side + DevEx PASS).
- Branch rebased onto origin/main `cc20d89` at merge time (PR #177
  landed first, per the owner's merge order). Neither intervening PR
  touches rings.ts / LoopMap.tsx, so no CODE conflict arose;
  BRANCH_STATUS.md conflicted, as expected, and was resolved by
  keeping this branch's record.

## Ready to merge? YES — owner's merge word given 2026-10-20
("Merge PR #178 (rebase + cure + retest first)"), conditional on
#177 merging first — done. Merging after rebase + retest.
