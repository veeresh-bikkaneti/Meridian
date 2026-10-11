# BRANCH_STATUS — fix/coldtrail-placement-followups

Branch: `fix/coldtrail-placement-followups` · Base: origin/main @ c416187 · Created: 2026-10-10.
**PUSH OK, DO NOT MERGE** — owner merges.

Standing rules: named-file staging only, never `git add -A`. Locked Ko-fi
copy must stay byte-identical:
`Grown-ups — buy me a coffee? ☕` · `Your support keeps Meridian free for kids` ·
`Grown-ups — buy me a coffee? Activate to learn how to support Meridian.`

## Done (2026-10-10) — two owner-requested follow-ups, all gates green

### 1. Crosshair cursor defeated by MapLibre CSS — FIXED
**Root cause:** `LoopMap.tsx` set a Tailwind `cursor-crosshair` class on the map
container div, but MapLibre's stylesheet gives `.maplibregl-canvas` its own
`cursor: grab` rule. The canvas is the element under the pointer, so its rule
wins and the crosshair never rendered.
**Fix:** Set the cursor directly on MapLibre's canvas via
`map.getCanvas().style.cursor = "crosshair"` in the existing `placementActive`
effect (alongside the keyboard disable/enable). Cleared on placement end.
Removed the defeated container-level class.
**Test:** New e2e asserts computed canvas cursor is `crosshair` during
placement and not-crosshair after Escape.

### 2. Disjoint-rings centroid marker suppressed — FIXED
**Root cause:** When the 3 locked rings shared no common area, the overlap
lens rendered a gold centroid dot. The centroid is geometrically meaningless
when rings are disjoint — the dot reads as a fake "answer" point.
**Fix (owner's call: suppress):** No centroid dot and no pulse when disjoint.
The rings stay visible so the player can adjust. Hint copy is now honest:
"All 3 rings are down, but they don't cross — use ↩ Move on a ring to shift
it closer." (was: "tap where they cross"). The `tripleOverlap` geometry
function is unchanged (centroid still computed as the pulse anchor when a
real polygon exists).
**Tests:** New e2e locks 3 far-apart rings → asserts no `overlap-centroid`
feature, no polygon, no pulse, and the honest hint copy. Unit test names
updated (centroid no longer a "fallback marker").

## Gates (final head)
- [x] `npx tsc --noEmit` — clean
- [x] `npm test` — 1082/1082 pass
- [x] `node scripts/lint-cards.mjs` — GATE PASSED
- [x] `npm run build:pages` — green (`dist/client/_shell.html` exists)
- [x] Playwright coldtrail: 8/9 pass (2 new tests green); mobile 4/4 pass
- [x] Locked copy: untouched (4 changed files contain no locked strings)
- [x] Zero console errors in passing runs

## Known pre-existing failure (NOT caused by this branch)
`coldtrail.spec.ts` » "full slice" fails on unmodified origin/main@9b0a8a1
(verified via `git stash`): the overlap source has 0 features after 3 locks.
Pre-dates this branch; unrelated to the crosshair/centroid changes.

## Rebase 2026-10-10 (d045128)
- Rebasing onto origin/main@ce88939 (#122 merged) — clean, zero conflicts (1 commit replayed).
- Gates on d045128: tsc clean · lint-cards GATE PASSED · build:pages green · npm test 1082/1082 · Playwright coldtrail 8/9 (1 pre-existing "full slice" failure, fails on unmodified main too) · locked copy byte-identical.

---

# BRANCH_STATUS — fix/country-zoom-smooth (investigation only)

Branch: `fix/country-zoom-smooth` · Base: origin/main @ ec456a9 · Created: 2026-10-10.
**READ-ONLY investigation — no code changes, no commits.**

## Investigation: Country-edition zoom-out hitch (Dinesh's report, 2026-10-10)

**Status:** root cause identified via static analysis + functional browser
reproduction. Frame-timing quantification was NOT trustworthy in this VM
(SwiftShader software rendering dominates; see caveats).

**Root cause:** `map.setProjection({type:"globe"})` at T_OUT (satellite-map.tsx:964,
fired from the zoomend handler at :1447 via zoom-space.ts `evaluateThresholds`
:707, Z_GLOBE_OUT=2.2) runs MapLibre 6.11.2 `Style#_setProjectionInternal`
(style.ts:1806), which UNCONDITIONALLY calls `tileManagers[key].reload()` for
every source → every in-view satellite raster tile re-fetches, re-decodes, and
re-uploads to GPU with mipmaps (tile_manager.ts:262, raster_tile_source.ts:205).
The swap is also an instantaneous flat→globe visual snap (no transition), fired
~200ms after the wheel gesture ends (scroll_zoom.ts _finishTimeout). Same burst
on T_IN (zoom back in past 3.2).

**Ruled out:** boundary-bands repaint (no-op at the 2.2 crossing — band stays
"continents"; only fires at z3/z6, async, modest); move-listener/controller
tracking (trivial); starfield (static 2D canvas, zero per-frame JS).

**Browser evidence (Playwright, built artifact, Chromium headless):**
- T_OUT functionally confirmed: wheel-zoom out through z2.2 → "Space view"
  announced, screenshot shows globe rendering with Brazil highlight (run2/run4).
- T_IN confirmed symmetrically ("<Region> view" announcement).
- Frame deltas unusable here (multi-second deltas on every gesture under
  SwiftShader; a 35s longtask with no app trigger) — did NOT attribute the
  hitch to frame data.
- 3/6 runs lost the WebGL context mid-zoom (satellite-map unmounts on
  webglcontextlost, satellite-map.tsx:818/836) — SwiftShader flakiness, not
  counted as app evidence.

**Recommended fix direction:** replace the discrete setProjection swaps with
MapLibre's built-in zoom-interpolated projection morph — set once at map init,
e.g. `['interpolate',['linear'],['zoom'],2.2,'vertical-perspective',3.2,'mercator']`
(supported path: projection_factory.ts Array.isArray branch → GlobeProjection +
GlobeTransform; same mechanism as MapLibre's own 11→12 globe morph). This
removes the snap AND the reload bursts (no more _setProjectionInternal calls);
T_OUT/T_IN keep their logic roles (maxBounds release, announcements, relock
beat) minus the set-projection intents. Must re-verify: permanent
GlobeTransform camera semantics (cameraForBounds/flyTo/easeTo/maxBounds/zoom
buttons), controller trackedProjection, adapter projectionRef/marker-occlusion.
Needs design sign-off (continuous morph vs deliberate snap).

Full report: see parent orchestrator's investigation debrief (scripts kept at
/tmp/zoom-measure/: measure.cjs, analyze.cjs).

---

# BRANCH_STATUS — fix/country-zoom-smooth (BUILD)

Branch: `fix/country-zoom-smooth` · Base: origin/main @ ec456a9 · Built: 2026-10-10/11.
**PUSH OK, DO NOT MERGE** — owner merges.

## Fix: discrete setProjection swaps → zoom-interpolated projection morph

**Root cause (confirmed):** `map.setProjection({type:"globe"})` at T_OUT ran
MapLibre 6.11.2 `Style#_setProjectionInternal`, which unconditionally reloads
every tile manager → all satellite raster tiles re-fetch/re-decode/re-upload.
Same burst on T_IN, plus an instantaneous flat↔globe visual snap.

**Fix:** the projection is now declared ONCE at map init as
`['interpolate',['linear'],['zoom'],2.2,'vertical-perspective',3.2,'mercator']`
(flat editions; globe edition keeps plain `"globe"`). Verified supported path:
`projection_factory.ts` `Array.isArray` branch → permanent GlobeProjection +
GlobeTransform (same mechanism as MapLibre's own globe morph); the v8 spec
allows the interpolated-on-zoom `projectionDefinition` expression. No
`setProjection` calls remain at runtime → no reload bursts, no snap — the
projection morphs continuously across the [2.2, 3.2] hysteresis band.

**Changed files (4):**
- `src/map/zoom-space.ts` — removed `set-projection` from the intent
  vocabulary + all 7 emit sites (T_OUT, T_IN zero-length, T_IN relock
  completion, narrow beat start, reduced-motion narrow, big-miss reveal,
  narrow-completion belt-and-braces). `trackedProjection` stays as the
  controller-owned discrete logical state; new `initialProjection`
  constructor option seeds it on the restore path.
- `src/map/satellite-map.tsx` — `PROJECTION_MORPH` declared once at init;
  dead `set-projection` executor case removed; `projectionRef` replaced by
  `logicalProjection()` (reads the controller) for snapshots, marker
  occlusion, webglcontextlost/retry capture, and reveal requests.
- `src/map/scout-style.ts` — `buildScoutStyle` takes the projection spec
  (morph for flat editions, `"globe"` for globe edition).
- `src/map/zoom-space.test.ts` — all set-projection assertions updated to
  the morph model (logical-state flips, no swap intents).

T_OUT/T_IN keep their logic roles (maxBounds release, announcements, relock
beat). No behavior changes except the smooth morph replacing the snap.

## Gates (final head)
- [x] `npx tsc --noEmit` — clean
- [x] `npm test` — 1089/1089 pass
- [x] `node scripts/lint-cards.mjs` — GATE PASSED
- [x] `npm run build:pages` — green (`dist/client/_shell.html` exists)
- [x] Locked copy — byte-identical (only in untouched
  `src/components/grandpa-coffee-run.tsx`)
- [x] Playwright morph verification (France country run, built artifact):
  intro narrow beat under permanent GlobeTransform ("France view"),
  T_OUT wheel-out through 2.2 → "Space view" announced, zoom buttons
  (+1/click verified), T_IN back past 3.2 → "France view" re-announced,
  zero console/page errors. Temp spec + diagnostic hook removed afterwards.

## Environment notes (SwiftShader VM flakiness, not app issues)
- Wheel-zoom rate varies run to run (0.1–0.46 levels/notch); zoom-button
  clicks landing mid-ease are swallowed — the verify spec drives one settled
  ease at a time.
- SwiftShader dropped the WebGL context mid-run twice → the app's PBI-5
  safety net correctly switched to Scout Map (maxZoom 3 by design), which
  makes T_IN unreachable. Verified via `data-map-mode`; the passing run
  used device spoofing + full-mode guards.

---

# BRANCH_STATUS — fix/country-zoom-smooth (SCRUM PANEL REVIEW)

Reviewed: 2026-10-11 · Head: 23fa8df · Base: origin/main @ ec456a9.
Coordinator ran all five squads directly (max agent depth — no subagents
available; same rigor, per-squad verdicts below). **No BLOCKs. MERGE-READY.**

## Root cause (recap)
`map.setProjection({type:"globe"})` at T_OUT ran MapLibre 6.11.2
`Style#_setProjectionInternal`, which unconditionally reloads every tile
manager → all satellite raster tiles re-fetch/re-decode/re-upload, plus an
instantaneous flat↔globe visual snap. Same burst on T_IN.

## Fix (recap)
Projection declared ONCE at map init as the zoom-interpolated expression
`['interpolate',['linear'],['zoom'],2.2,'vertical-perspective',3.2,'mercator']`
(flat editions; globe edition keeps plain `"globe"`). Verified in the
vendored MapLibre source: the Array.isArray branch of
`createProjectionFromName` → permanent GlobeProjection + GlobeTransform
(the same mechanism as MapLibre's own 11→12 globe morph). No
`setProjection` calls remain at runtime → no reload bursts, no snap.
T_OUT/T_IN keep maxBounds/announcement/relock roles; the controller owns the
discrete logical projection (globe ≤2.2, mercator ≥3.2).

## Per-squad verdicts
- **Design — APPROVE.** Continuous morph acceptable vs the old snap (the
  snap carried no information; "Space view"/"<Region> view" announcements
  do). Matches the platform-native globe aesthetic. Screenshots at
  360×740 and 390×844: no tearing, highlight tracks the morph, chrome
  stable, no layout shifts.
- **Eng — APPROVE.** Morph setup uses the supported array-projection path
  (verified in vendored 6.11.2). `set-projection` removed from the intent
  type + all 7 emit sites + the executor case; `projectionRef` replaced by
  controller-owned `logicalProjection()`; `initialProjection` seeds the
  restore path. Camera semantics preserved: GlobeTransform delegates to
  the mercator helper at the flat arm (cameraForBounds/flyTo/easeTo/
  maxBounds behave as before). Unit tests updated to the morph model.
- **Devex — APPROVE.** Zero new dependencies, zero config changes,
  `build:pages` green. Change is removal-dominated; no bundle growth.
- **QA — APPROVE.** All mandatory types performed (temp Playwright spec,
  removed after the run):
  - Visual black-box (360×740 + 390×844): country zoom OUT through z2.2
    and back in; morph-A/B/C/D screenshots reviewed — smooth, no glitches.
  - Workflow: full country round — out to space, back in, pin committed
    (score 173), next place advanced, phase back to aim.
  - Regression: state-edition zoom gestures unaffected; globe-edition zoom
    gestures unaffected; home banner intact; narration plays on first
    gesture (greeting_audio phase).
  - Unit: 1089/1089 pass · `tsc --noEmit` clean · `lint-cards` GATE PASSED
    · `build:pages` green · locked Ko-fi copy byte-identical.
  - Functional: "Space view" announced at T_OUT, "France view" at T_IN;
    zoom buttons work in all editions; zero console/page errors
    (React #418 filtered — pre-existing flaky hydration warning per
    established specs).
- **Security — APPROVE.** No new surfaces: static projection expression,
  no user-input interpolation, no new network/storage/message calls.

## Environment notes (harness only, not app issues)
- SwiftShader drops the WebGL context mid-run; the PBI-5 safety net
  correctly switches to Scout Map. Review spec used the established
  `spoofCapableDevice` + full-mode guards and retried on fallback.
- Tile stub for server.arcgisonline.com (documented in helpers.ts).

## Cross-check (AGENTS.md mandatory coverage)
Visual ✓ (QA) · Workflow ✓ (QA) · Regression ✓ (QA) · Unit+functional ✓
(QA/Eng) · Security ✓ (Security) · Squad cross-check ✓ (coordinator:
Design's morph-aesthetic concern checked against Eng's MapLibre-source
verification and QA's screenshots). Nothing skipped.

---

# BRANCH_STATUS — fix/distance-units-locale

Branch: `fix/distance-units-locale` · Base: origin/main @ 51ed7f5 · Created: 2026-10-11.
**PUSH OK, DO NOT MERGE** — owner merges.

## Work: owner ruling 2026-10-11 — one unit per result (USA → miles everywhere)

Bug: result headline read "256 mi east of your pin" while the map pill for the
SAME distance read "411 km". Root cause: `src/game/units.ts` already carried the
rule (`unitForEdition`, `unitForLoopTarget`, `formatLength`), and the result-card
headline used it — but six display sites still formatted with km-only
`formatDistance()`.

### Done (2026-10-11)

**Changed files (11):**
- `src/game/units.ts` — new `unitForSessionSummary(regions)`: miles only when
  EVERY played region maps to miles via `unitForEdition`; mixed/empty → km
  (fail closed).
- `src/map/variation.ts` — `variationLine()` takes `unit: LengthUnit`, labels
  with `formatLength(kilometers, unit)`.
- `src/map/satellite-map.tsx` — `MapVariation` gains `unit: LengthUnit`;
  `paintVariationLayers` passes it through.
- `src/components/game-app.tsx` — passes `unitForEdition(run.edition, run.regionId)`
  into the variation memo (site 1); the two sr-only aria-live "Pin dropped. …"
  announcements (site 6) and the tutorial overlay call site (site 5, `unit="km"`
  for the fixed Eiffel Tower script) use the same derivation.
- `src/game/loop/LoopMap.tsx` — new required `unit: LengthUnit` prop; guess-ring
  labels use `formatLength(g.distKm, unit)`; `ringAnnouncement(guess, unit)`
  speaks the unit too (an extra unlisted site the plan missed: it hardcoded "km").
- `src/game/loop/LoopScreen.tsx` — passes `unit={loopUnit}` (already computed via
  `unitForLoopTarget`); ring announcements pass `loopUnit`.
- `src/game/coldtrail/placement.ts` — ring labels (locked + draft) use
  `unitForLoopTarget([hideout.lon, hideout.lat])`; module doc notes the one
  sanctioned hideout read (unit derivation only — no coordinate rendered; the
  I1 anti-leak tests still pass unmodified). Build-time sighting clue text
  (cases.generated.json) untouched.
- `src/game/coldtrail/TrailScreen.tsx` — `hideoutUnit` const; passes `unit` to
  `LoopMap` and `SightingCard`; the "Your intercept missed by …" score line uses
  `formatLength(progress.scoreKm, hideoutUnit)` (extra unlisted site, same ruling).
- `src/game/coldtrail/SightingCard.tsx` — new `unit` prop; "Ring radius" line uses
  `formatLength` (extra unlisted site, same ruling).
- `src/components/run-summary.tsx` — average/best distance use
  `unitForSessionSummary(summary.regions)` (site 4).
- `src/components/tutorial-overlay.tsx` — beat 2 takes optional `unit` prop
  (defaults fail-closed to "km") instead of hardcoding `formatDistance` (site 5).

**Tests:**
- `src/game/units.test.ts` — new: KM_PER_MI exact; 411 km → "255 mi"; USA→mi
  (state edition, US country run, US GeoDetective target, US Cold Trail hideout);
  rest-of-world→km; session-summary rule (all-USA→mi, mixed→km, empty→km).
- `src/map/pin-tap.test.ts` — new: miss-line label renders "255 mi" for 411 km in
  USA mode (the reported bug's exact distance); existing km test updated for the
  new signature.

**No distance VALUE changed anywhere** — only unit labels; same km feed every
display. No new dependencies, no timers, no animation changes.

### Gates (final head)
- [x] `tsc --noEmit` — clean
- [x] `npm test` — 1098/1098 pass (9 new tests)
- [x] `node scripts/lint-cards.mjs` — GATE PASSED
- [x] `npm run build:pages` — green
- [ ] Playwright E2E — intentionally NOT run (coordinator handles verification)

### Deliverables
- [x] `SPEC_CHECKLIST.md` — appended the distance-units section (plain language)
- [x] Branch pushed (no PR, no merge — per standing policy)

---

## Verification (coordinator pass, 2026-10-11 ~18:55 UTC)

### Scrum review — APPROVE (zero BLOCKs)
Panel lenses (Code Reviewer, Test Automation Engineer, Frontend Developer,
Accessibility Auditor, UX Researcher) walked the full diff:
- Unit selection correct at all 9 sites; every site derives from the same
  helper as its sibling display (headline ↔ pill share
  `unitForEdition(run.edition, run.regionId)`; GeoDetective ↔ Cold Trail
  share `unitForLoopTarget` on the target/hideout).
- No distance VALUE changed anywhere — `formatLength(km, unit)` only
  re-labels the same km feed.
- `unitForSessionSummary`: miles iff every region maps to miles; mixed and
  empty sessions fail closed to km.
- Cold Trail hideout read is unit-derivation only (`unitForLoopTarget`
  collapses coords to mi/km); anti-leak tests pass unmodified; generated
  sighting clue text untouched.
- Non-blocking observations for the owner (not BLOCKs): (1) sighting clue
  TEXT (e.g. "400 km east of Denver") stays km while the ring-radius line
  for a USA hideout now reads miles — same value, mixed units on one card;
  per scope (generated data untouched). (2) US territories (Puerto Rico key
  630, Guam 316) read km under the territory-key-840 rule for GeoDetective /
  Cold Trail targets — pre-existing territory semantics, unchanged here.

### Rebase — onto origin/main @ 51ed7f5: already on top, zero conflicts.
tsc clean; `npm test` 1098/1098 → 1105/1105 after adding the red-team file.

### Black-box (Playwright, real browser, 390×844, built dist)
New spec `tests/e2e/mobile-distance-units.spec.ts` — 4/4 PASS:
- Journey A (Nebraska miss): headline "Result: 1,923 mi southeast of your
  pin" + gold pill "1,923 mi" — same value, both miles; no km on the card;
  aria-live speaks "…mi…".
- Journey B (France miss): headline "Result: 2,986 km north of your pin" +
  pill "2,986 km" — same value, both km; no mi on the card; aria-live
  speaks "…km…".
- Red-team mixed session (Nebraska + France → End game): summary "Average
  distance" and "Best pin" read km.
- Red-team all-USA session (Nebraska → End game): summary reads mi.

### Red-team unit edges (`src/game/units-redteam.test.ts`) — 7/7 PASS
Puerto Rico (630) → km; 1.0/2.0 mi formatting; 10,000 mi / 20,000 km
thousands separators; sub-unit 1640 ft / 500 m / 0 ft; mixed → km;
US-country+state → mi; NaN/Infinity → "—".

### Screen recordings (constitutional law)
- `~/workspace/your_files/meridian-distance-units/journey-a-usa-miles.webm`
- `~/workspace/your_files/meridian-distance-units/journey-b-france-km.webm`
Recording script: `scripts/record-distance-units.mjs` (Playwright video,
390×844, tap-point flash so the pin drop is visible).
