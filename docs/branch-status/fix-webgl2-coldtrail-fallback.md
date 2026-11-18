# fix/webgl2-coldtrail-fallback — status

## Done
- Root cause pinned with reproduction on the crash build (b2ef88a7):
  Cold Trail's `TrailScreen` rendered `LoopMap` with no inner error
  boundary, so on a browser with no WebGL2 the map library's
  synchronous `GPUInitializationError` (thrown from its Map
  constructor) escaped to the app-level `MapErrorBoundary` — the only
  `map_error` emitter — which filed the crash report and replaced the
  whole screen with a reload card that can never succeed on such a
  device. GeoDetective never filed this report: `LoopScreen` wraps the
  same `LoopMap` in `LoopMapBoundary`.
- Original fix: `TrailScreen` wraps its `LoopMap` in the existing
  `LoopMapBoundary`; `satellite-map.tsx`'s construction catch drops to
  the static scout fallback in full mode too when the error is the
  permanent WebGL2 gap.
- REBASED onto current main `8ba3a947` (was `2ce6757a`): the branch is
  still a single commit, now parented on `8ba3a947`. The tree was
  rebuilt file-by-file from the main tree listing and every file's
  blob hash verified — the only differences from main are this
  branch's own files. The original pins were re-run on the rebased
  tree before any sharpening: 6/6 passed. (The original boot-reload
  vector is already dead on current main — the persisted open flags
  are no longer read at boot since #518; the in-app entry paths are
  the live ones and are what the walks exercise.)

## Arena corrections (adversarial review, 4 seats — this update)
- P1 pins sharpened in `webgl2-fallback.test.ts` (now 13 tests):
  quote/alias-tolerant import regex; props-tolerant wrap match with
  index-between assertion; pin 4 is now the conditional reporting
  assertion (below); pin 5 is behavioural unit tests of the predicate
  (name fixture, message fixture, unrelated errors, non-Error values);
  pin 6 is a whitespace-tolerant semantic regex over the construction
  catch (non-scout + not-WebGL2 → throw, then `setScoutFallback(true)`
  in the same catch).
- P2 narrow reporting: the predicate moved to the leaf module
  `src/lib/webgl2-unavailable.ts`, imported by both
  `satellite-map.tsx` and `loop-map-boundary.tsx` (the boundary does
  not import the map stack). `LoopMapBoundary.componentDidCatch`:
  console-log always; optional `onFailed` fires; `emitMapError` fires
  ONLY when the error is not the WebGL2 gap. Never rethrows. Shared
  boundary ⇒ GeoDetective gains the same reporting.
- P3 Cold Trail tile channel + map-off: `TrailScreen` passes
  `onTilesFailed` to `LoopMap` and holds `mapOff` (mirrors
  `LoopScreen`), set on tile failure and on boundary failure. While
  off: the off-line shows for tile failures too; Place ring / Move
  are disabled and no-op; the armed overlay + reticle are suppressed
  (`placingNow && !mapOff`); the stale tap hint is cleared. NEW COPY
  (disclosed in the PR body for the owner):
  `TILE_FALLBACK_COPY.coldTrailMapOff` — "Map pictures are off for
  now. This case needs the map, so ring placement is paused — the
  case and sightings are still here to read." GeoDetective's
  `loopMapOff` line is unchanged (pinned exactly).
- P4 satellite fallback playable: engaging the static fallback (the
  construction catch in any mode, or the scout-mode render-error
  path) now releases the intro gate, settles a still-loading tile
  status to its verdict, and hides ZoomControls while the fallback
  owns the surface. Proven in both modes (below).
- P5 LoopMap context loss: a `webglcontextlost` listener routes to
  the existing map-off channel (`onTilesFailed`), and a MapLibre
  error event carrying a GPU initialization failure takes the same
  channel instead of being swallowed by the tile-only filter.
- P6 record corrected: the atlas presenter is dead code
  (`atlas-map.tsx` has zero importers, tree-shaken from the build) —
  removed from the PR body's verified-surfaces claims; the module
  works standalone but is not a shipped surface. Board 3D, Home
  globe and pair-3D claims are reproduction-verified (arena).

## Gates (local, raw results; builder does not certify)
- Rebased-tree pre-sharpening pins: 6/6 pass. Sharpened pins: 13/13
  pass; copy suite 5/5 pass. Touched-area suites (coldtrail, loop,
  map, lib, map-error-boundary): 800/800 pass.
- `npm test`: src suite 2869/2869 pass; scripts suite 1203 pass /
  1 fail — `scripts/ssr-build-shape.test.mjs` ("configPath must point
  at the repo-root wrangler.jsonc", resolves to a sibling tree's
  path). Environmental: documented identically in this PR's first
  delivery on the old base. CI carries the authoritative run.
- `npx tsc --noEmit`: clean. `npm run test:worker`: 235/235 pass.
- `npm run lint:nav`: pass. `npm run lint:subjects`: GATE PASSED.
  `node scripts/lint-cards.mjs`: GATE PASSED.
- Build: `vite build` + prerender green. Full `build:pages` hits the
  known sandbox postbuild quirk in `fingerprint-sw` ("placeholder
  __BUILD_ID__ not found in dist/client/sw.js"), documented in the
  first delivery as reproducing on pristine main; CI runs it green.
- `check:provenance`: NOT RUN as a script locally — this working tree
  is an API snapshot, not a git checkout, so the script cannot read a
  range. Local substitute: a bare-word scan (the script's own name
  list) over every changed file, the PR body and the commit message
  found zero AI tool/vendor names. CI runs the real script on the PR;
  the publishing flow authors the commit under the owner's identity.
- Playwright E2E: NOT RUN locally (browser launch blocked in this
  sandbox, per standing environment notes). Behaviour proof below
  stands in for the affected surfaces; CI runs the suites.

## Behaviour proof (headless Chrome CDP)
Artefacts: `~/workspace/meridian-work/webglfix-proof/arena-proof/`
(harness `webglfix-arena-proof.mjs`; result JSON + screenshots per
scenario). Original before/after walks from the first delivery stand
(17/17 after, scout and full; control identical). Arena walks of the
rebased, corrected build — 48/48 checks passed:
- ct-blocked (12/12): Cold Trail opens with WebGL2 blocked; the new
  Cold Trail off-line shows; Place ring buttons disabled, clicking
  arms nothing (no overlay, no reticle, no tap hint); sightings
  readable; ZERO crash reports. GeoDetective: original off-line
  unchanged, zero reports.
- ct-tiles (4/4): tile requests failed → off-line appears via
  `onTilesFailed`, the blind map unmounts, sightings readable,
  Place ring disabled.
- main-full (10/10) and main-scout (10/10): WebGL2 blocked → static
  fallback renders NOT inert / not aria-hidden, tile status "ready",
  no spinner, no zoom buttons; a tap sets the aim mark (Drop pin
  enables) and Drop pin commits; zero crash reports.
- context-loss (8/8): `WEBGL_lose_context` on the LoopMap canvas in
  Cold Trail and in GeoDetective → the off-line replaces the canvas,
  each surface's own copy.
- control (4/4): WebGL available → real maps render, no off-lines,
  Place ring enabled. Known headless artefact (unchanged, both
  builds): the main game's headless worker failure can drop it to
  its pre-existing scout fallback in this environment.

## Next
- Independent reviewer judges the PR; owner merges. Do not merge from
  this branch's builder role.

## Open questions
- None blocking. Disclosed limits: Cold Trail ring placement needs
  the map, so on a WebGL2-less device the case can be read but not
  played — the new off-line copy says so on the surface itself.
- Follow-ons named in the PR body (arena evidence, not fixed here):
  non-tile MapLibre errors swallowed by LoopMap's error listener
  (needs a product call); transient GL failures treated as permanent
  by the construction catch (one degraded round, self-heals next
  mount); restored `<Play>` renders with no boundary around it in
  `game-app.tsx`; overlay repaint after a MapLibre context RESTORE
  in LoopMap untested.

## Graph
- No nodes or edges added. The fix reuses the existing
  `loop-map-boundary` component; the one new module
  (`src/lib/webgl2-unavailable.ts`) is a leaf predicate, not a graph
  entry.
