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
