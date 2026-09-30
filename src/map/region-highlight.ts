import type { GeoJSONSource, Map } from "maplibre-gl";
import type { RegionGeometryDTO } from "./region-index.ts";

/**
 * Region highlight painter — Z3/Z4 zoom-space (design §3).
 *
 * Owns the three highlight layers painted over the active region's vendored
 * TopoJSON geometry: a gold fill, a dark casing line that keeps the gold
 * readable over bright desert/snow imagery, and a bold gold outline. Reads on
 * flat satellite AND from space — at zoom 0–2 the fill tints the whole
 * state/country gold-washed against the planet; fill/line layers drape onto
 * the globe via subdivision automatically, no custom math. On reveal (place
 * load) the highlight lands as a brief gold flash with a swelling boundary
 * that settles to its resting strength — static and immediate under
 * prefers-reduced-motion.
 *
 * SOLID split (design §3, Appendix): the pure geometry resolution lives in
 * the sibling crew's `src/map/region-index.ts` (`buildRegionIndex()`); this
 * module never touches TopoJSON — it receives the resolved
 * `RegionGeometryDTO`, imported from that module (one definition, no
 * structural duplicate), so the adapter can pass that DTO straight in.
 *
 * Lifecycle (owned by the satellite-map intent adapter, design §1/§4):
 * painted at narrow completion via the `paint-highlight` intent (the reveal
 * flash still lands as the camera settles), persists through SPACE (regional
 * context is never lost — it becomes "the gold-outlined region on the
 * globe"), cleared on leave/replay/edition change. Globe edition: the
 * adapter never paints (no region).
 */

const SOURCE_ID = "region-highlight";
const FILL_LAYER_ID = "region-fill";
const CASING_LAYER_ID = "region-casing";
const OUTLINE_LAYER_ID = "region-outline";

/** Game gold — already the variation-line color (satellite-map.tsx). */
const GOLD = "#f2c14e";
/** Dark casing: the 0.6 alpha is baked into the color (design §3). */
const CASING_COLOR = "rgba(6,8,10,0.6)";

/**
 * Resting highlight strength (Track 2, 2026-09-30 — real-device feedback:
 * the old 2.5 px / 0.08–0.14 highlight was too subtle to read at a glance).
 * The outline is nearly doubled, the casing stays a touch wider than the
 * outline, and the fill is strong enough to tint the region against both
 * bright desert/snow imagery and the dark starfield.
 */
const OUTLINE_WIDTH_PX = 4.5;
const OUTLINE_OPACITY = 1;
/** Casing line width = outline + this (was +4 px at 2.5 px outline). */
const CASING_EXTRA_PX = 5;

/** Fill reads stronger from space, subtler when aiming (design §3). */
const FILL_OPACITY_SPACE = 0.3; // zoom ≤ 3 (was 0.14)
const FILL_OPACITY_REGION = 0.18; // zoom > 3 (was 0.08)
const FILL_OPACITY_ZOOM_STOP = 3;

/**
 * Reveal emphasis (non-instant path only): the highlight lands as a brief
 * gold flash-wash with a swelling boundary, then settles back to the resting
 * values — the "something just loaded here" beat that reads at a glance on
 * device. The reduced-motion path (`instant: true`) skips this entirely and
 * paints the resting values synchronously: a static strong highlight, no
 * animation.
 */
const REVEAL_FLASH_OPACITY = 0.55;
const REVEAL_SWELL_PX = 8; // added to the resting outline width at peak
const REVEAL_MS = 650; // phase-A transition (flash in)
const SETTLE_MS = 800; // phase-B transition (settle to resting)
const SETTLE_DELAY_MS = 700; // phase A runs before the settle is scheduled

/**
 * Normalizes the tagged-struct coordinates to MultiPolygon. A Polygon's ring
 * array wrapped once is a valid single-polygon MultiPolygon, so the painter
 * never needs to know which shape the atlas produced (us-atlas states and
 * world-atlas countries are MultiPolygons in practice; the normalization
 * keeps the contract honest either way). Raw (untagged) coordinate arrays
 * are still tolerated at runtime via the depth probe below — belt-and-braces
 * for callers outside the typed contract.
 */
function asMultiPolygon(coords: RegionGeometryDTO["polygonCoords"]): number[][][][] {
  // Tagged struct (sibling region-index.ts): trust the tag.
  if (!Array.isArray(coords)) {
    return coords.type === "Polygon"
      ? [coords.coordinates as number[][][]]
      : (coords.coordinates as number[][][][]);
  }
  if (coords.length === 0) return [];
  // Raw coordinates: depth probe. Polygon: coords[0][0][0] is a number (a
  // position's first ordinate). MultiPolygon: coords[0][0][0] is a position
  // (an array).
  const probe: unknown = (coords as unknown[][][])[0]?.[0]?.[0];
  return typeof probe === "number"
    ? [coords as number[][][]]
    : (coords as number[][][][]);
}

function highlightFeature(dto: RegionGeometryDTO) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "MultiPolygon" as const,
      coordinates: asMultiPolygon(dto.polygonCoords),
    },
  };
}

/**
 * Pending reveal-settle timers per map. A reveal is two-phase (flash, then
 * settle); the second phase must be cancellable when the highlight is
 * cleared, re-painted, or the map is torn down mid-reveal.
 */
const revealTimers = new WeakMap<Map, number[]>();

function cancelReveal(map: Map): void {
  const timers = revealTimers.get(map);
  if (timers) {
    for (const id of timers) window.clearTimeout(id);
    revealTimers.delete(map);
  }
}

function scheduleSettle(map: Map, settle: () => void): void {
  const id = window.setTimeout(settle, SETTLE_DELAY_MS);
  const timers = revealTimers.get(map) ?? [];
  timers.push(id);
  revealTimers.set(map, timers);
}

/** Resting paint values — the highlight's steady state after any reveal. */
function applyRestingValues(map: Map): void {
  map.setPaintProperty(FILL_LAYER_ID, "fill-opacity", [
    "step",
    ["zoom"],
    FILL_OPACITY_SPACE,
    FILL_OPACITY_ZOOM_STOP,
    FILL_OPACITY_REGION,
  ]);
  map.setPaintProperty(CASING_LAYER_ID, "line-width", OUTLINE_WIDTH_PX + CASING_EXTRA_PX);
  map.setPaintProperty(CASING_LAYER_ID, "line-opacity", 1);
  map.setPaintProperty(OUTLINE_LAYER_ID, "line-width", OUTLINE_WIDTH_PX);
  map.setPaintProperty(OUTLINE_LAYER_ID, "line-opacity", OUTLINE_OPACITY);
}

/**
 * Paints the region highlight. Creates the source + three layers on first
 * call. On the animated path the highlight lands as a two-phase reveal: a
 * 650 ms gold flash-wash with a swelling boundary (fill 0→0.55, outline
 * swelling +8 px), then an 800 ms settle back to the resting strength. The
 * flash is what reads at a glance when a place loads on device.
 *
 * `instant: true` is the prefers-reduced-motion path (design §4): no
 * transitions are registered, so the resting values land synchronously —
 * a static strong highlight, no fade, no pulse, no settle timer.
 *
 * Idempotent across regions: if the layers already exist the geometry is
 * swapped via `setData` and the resting values are re-asserted (a reveal
 * in flight is cancelled — no re-flash, no stale timer landing flash
 * values on the new geometry).
 *
 * Dateline note (design §3/§9.5): Alaska/Hawaii geometry crosses the
 * antimeridian; MapLibre handles dateline-crossing polygons in both
 * projections [UNVERIFIED — verify visually in E2E]. If it streaks, the
 * fallback is clipping the feature to the region bounds box here.
 */
export function paintRegionHighlight(
  map: Map,
  dto: RegionGeometryDTO,
  options?: { instant?: boolean },
): void {
  // NOTE on the style-load gate: addSource/addLayer throw "Style is not done
  // loading" if the style isn't parsed yet. The map style is inline, so it
  // parses synchronously in `new Map()` in practice — but the reduced-motion
  // path paints synchronously in the same tick, and MapLibre may not have
  // flipped the loaded flag yet. We therefore attempt the paint and let the
  // caller retry on failure, rather than gating on the tile-dependent
  // isStyleLoaded() (which lost paints: diagnosed 2026-09-30).
  const instant = options?.instant ?? false;
  cancelReveal(map);

  // Idempotency is keyed on the layers, not the source: if a previous paint
  // was interrupted between addSource and addLayer (style not ready), the
  // source exists without layers — remove it and rebuild from scratch.
  if (map.getLayer(FILL_LAYER_ID)) {
    const existing = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (existing) existing.setData(highlightFeature(dto));
    // Re-assert the resting values synchronously: a reveal that was
    // mid-flight for the previous region must not land flash values here.
    applyRestingValues(map);
    return;
  }
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  map.addSource(SOURCE_ID, { type: "geojson", data: highlightFeature(dto) });

  // No transition key when instant: the setPaintProperty calls below then
  // apply synchronously (reduced-motion path).
  const transition = instant ? undefined : { duration: REVEAL_MS, delay: 0 };

  map.addLayer({
    id: FILL_LAYER_ID,
    type: "fill",
    source: SOURCE_ID,
    paint: {
      "fill-color": GOLD,
      "fill-opacity": 0,
      "fill-opacity-transition": transition,
    },
  });
  map.addLayer({
    id: CASING_LAYER_ID,
    type: "line",
    source: SOURCE_ID,
    paint: {
      "line-color": CASING_COLOR,
      "line-width": 0,
      "line-width-transition": transition,
      "line-opacity": 0,
      "line-opacity-transition": transition,
    },
  });
  map.addLayer({
    id: OUTLINE_LAYER_ID,
    type: "line",
    source: SOURCE_ID,
    paint: {
      "line-color": GOLD,
      "line-width": 0,
      "line-width-transition": transition,
      "line-opacity": 0,
      "line-opacity-transition": transition,
    },
  });

  if (instant) {
    // Reduced-motion path: static strong highlight, no animation at all.
    applyRestingValues(map);
    return;
  }

  // Phase A — the reveal flash: gold wash + swelling boundary.
  const swell = OUTLINE_WIDTH_PX + REVEAL_SWELL_PX;
  map.setPaintProperty(FILL_LAYER_ID, "fill-opacity", REVEAL_FLASH_OPACITY);
  map.setPaintProperty(CASING_LAYER_ID, "line-width", swell + CASING_EXTRA_PX);
  map.setPaintProperty(CASING_LAYER_ID, "line-opacity", 1);
  map.setPaintProperty(OUTLINE_LAYER_ID, "line-width", swell);
  map.setPaintProperty(OUTLINE_LAYER_ID, "line-opacity", OUTLINE_OPACITY);

  // Phase B — settle back to the resting strength. Guarded: the layers may
  // be gone (clearRegionHighlight cancels this timer, but a full map
  // teardown between phases must not throw either).
  scheduleSettle(map, () => {
    try {
      if (!map.getLayer(FILL_LAYER_ID)) return;
      const settleTransition = { duration: SETTLE_MS, delay: 0 };
      map.setPaintProperty(FILL_LAYER_ID, "fill-opacity-transition", settleTransition);
      map.setPaintProperty(CASING_LAYER_ID, "line-width-transition", settleTransition);
      map.setPaintProperty(CASING_LAYER_ID, "line-opacity-transition", settleTransition);
      map.setPaintProperty(OUTLINE_LAYER_ID, "line-width-transition", settleTransition);
      map.setPaintProperty(OUTLINE_LAYER_ID, "line-opacity-transition", settleTransition);
      applyRestingValues(map);
    } catch {
      // Map torn down mid-reveal — nothing left to settle.
    }
  });
}

/**
 * Clears the region highlight — removes the three layers and the source.
 * Called on leave/replay/edition change (design §3). Safe to call when
 * nothing is painted; safe after style teardown.
 */
export function clearRegionHighlight(map: Map): void {
  cancelReveal(map);
  if (!map.getStyle()) return;
  for (const layerId of [FILL_LAYER_ID, CASING_LAYER_ID, OUTLINE_LAYER_ID]) {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
  }
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}
