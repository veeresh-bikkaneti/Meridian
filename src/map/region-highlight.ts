import type { GeoJSONSource, Map } from "maplibre-gl";
import type { RegionGeometryDTO } from "./region-index.ts";

/**
 * Region highlight painter — Z3/Z4 zoom-space (design §3).
 *
 * Owns the three highlight layers painted over the active region's vendored
 * TopoJSON geometry: a gold fill, a dark casing line that keeps the gold
 * readable over bright desert/snow imagery, and a gold outline. Reads on
 * flat satellite AND from space — at zoom 0–2 the fill tints the whole
 * state/country gold-washed against the planet; fill/line layers drape onto
 * the globe via subdivision automatically, no custom math.
 *
 * SOLID split (design §3, Appendix): the pure geometry resolution lives in
 * the sibling crew's `src/map/region-index.ts` (`buildRegionIndex()`); this
 * module never touches TopoJSON — it receives the resolved
 * `RegionGeometryDTO`, imported from that module (one definition, no
 * structural duplicate), so the adapter can pass that DTO straight in.
 *
 * Lifecycle (owned by the satellite-map intent adapter, design §1/§4):
 * painted at narrow completion via the `paint-highlight` intent (the 700 ms
 * fade still lands as the camera settles), persists through SPACE (regional
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
/** Paint fade duration (design §3/§4). */
const FADE_MS = 700;

/** Fill reads stronger from space, subtler when aiming (design §3). */
const FILL_OPACITY_SPACE = 0.14; // zoom ≤ 3
const FILL_OPACITY_REGION = 0.08; // zoom > 3
const FILL_OPACITY_ZOOM_STOP = 3;

/** Outline width (design §3); the casing is outline + 4 px. */
const OUTLINE_WIDTH_PX = 2.5;
const OUTLINE_OPACITY = 0.95;

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
 * Paints the region highlight. Creates the source + three layers on first
 * call, then drives 0→1 over 700 ms via the paint transitions registered at
 * layer creation (design §3: `fill-opacity-transition` /
 * `line-opacity-transition` set at creation, then `setPaintProperty`).
 * `instant: true` is the prefers-reduced-motion path (design §4): no
 * transitions are registered, so the same `setPaintProperty` calls land the
 * target opacities immediately — no fade, no single-frame artifact.
 *
 * Idempotent across regions: if the layers already exist the geometry is
 * swapped via `setData` (opacities already at target — no re-fade).
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
  // Belt-and-braces: addSource/addLayer throw before style load. The adapter
  // only paints post-load (narrow-in beat), so this is unreachable in
  // practice — it guards a torn-down style mid-beat, not a logic error.
  if (!map.isStyleLoaded()) return;
  const instant = options?.instant ?? false;

  const existing = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
  if (existing) {
    existing.setData(highlightFeature(dto));
    return;
  }
  map.addSource(SOURCE_ID, { type: "geojson", data: highlightFeature(dto) });

  // No transition key when instant: the setPaintProperty calls below then
  // apply synchronously (reduced-motion path).
  const transition = instant ? undefined : { duration: FADE_MS, delay: 0 };

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
      "line-width": OUTLINE_WIDTH_PX + 4,
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
      "line-width": OUTLINE_WIDTH_PX,
      "line-opacity": 0,
      "line-opacity-transition": transition,
    },
  });

  // With transitions registered this fades 0→target over 700 ms; without
  // (instant) it lands the targets synchronously. The fill expression keeps
  // the beacon stronger from space (design §3).
  map.setPaintProperty(FILL_LAYER_ID, "fill-opacity", [
    "step",
    ["zoom"],
    FILL_OPACITY_SPACE,
    FILL_OPACITY_ZOOM_STOP,
    FILL_OPACITY_REGION,
  ]);
  map.setPaintProperty(CASING_LAYER_ID, "line-opacity", 1);
  map.setPaintProperty(OUTLINE_LAYER_ID, "line-opacity", OUTLINE_OPACITY);
}

/**
 * Clears the region highlight — removes the three layers and the source.
 * Called on leave/replay/edition change (design §3). Safe to call when
 * nothing is painted; safe after style teardown.
 */
export function clearRegionHighlight(map: Map): void {
  if (!map.getStyle()) return;
  for (const layerId of [FILL_LAYER_ID, CASING_LAYER_ID, OUTLINE_LAYER_ID]) {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
  }
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}
