/**
 * Progressive boundary reveal — admin boundaries in zoom bands.
 *
 * As the user zooms, context boundaries fade in by band:
 *   z < 3          → continent outlines (Natural Earth land-110m)
 *   3 ≤ z < 6      → country boundaries (Natural Earth countries-50m)
 *   z ≥ 6          → state/province boundaries (US states-10m + NE admin-1
 *                    for AU/BR/CA/CN/IN; other countries keep country lines)
 *
 * Design constraints (Veeresh, 2026-09-30):
 * - NO text labels at any zoom/mode — naming things is the game.
 * - Boundaries are subtle context only; the quiz region highlight stays
 *   dominant (gold, 4.5px). Boundary lines are thin gray.
 * - Zero-cost data: all bundled (world-atlas, us-atlas, vendored NE 50m).
 * - Reduced-motion: bands render statically, no animated transitions.
 *
 * The module is pure except for the MapLibre paint calls, which are
 * idempotent — calling paintBoundaryBand with the same band twice is a
 * no-op, and switching bands removes the old layers.
 */

import type { Map } from "maplibre-gl";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import land110m from "world-atlas/land-110m.json";
import countries50m from "world-atlas/countries-50m.json";
import states10m from "us-atlas/states-10m.json";
import neAdmin1 from "./data/ne-50m-admin-1.json";

/** Zoom band for boundary reveal. */
export type BoundaryBand = "continents" | "countries" | "admin1";

/**
 * Returns the boundary band for a zoom level.
 * Pure function — unit-tested.
 */
export function bandForZoom(zoom: number): BoundaryBand {
  if (zoom < 3) return "continents";
  if (zoom < 6) return "countries";
  return "admin1";
}

// Layer IDs (prefixed to avoid collisions with the region highlight).
const CONTINENTS_LAYER_ID = "boundary-continents";
const COUNTRIES_LAYER_ID = "boundary-countries";
const US_STATES_LAYER_ID = "boundary-us-states";
const NE_ADMIN1_LAYER_ID = "boundary-ne-admin1";

const CONTINENTS_SOURCE_ID = "boundary-src-continents";
const COUNTRIES_SOURCE_ID = "boundary-src-countries";
const US_STATES_SOURCE_ID = "boundary-src-us-states";
const NE_ADMIN1_SOURCE_ID = "boundary-src-ne-admin1";

// Subtle gray — visible against the starfield/satellite, but never
// competing with the gold quiz highlight.
const BOUNDARY_COLOR = "#8a8f98";
const BOUNDARY_OPACITY = 0.35;
const BOUNDARY_WIDTH = 1;

/**
 * Paints the boundary band for the given zoom. Idempotent: calling with the
 * same band twice does nothing; switching bands removes the old layers.
 *
 * No labels are ever added — boundaries are line layers only.
 */
export function paintBoundaryBand(map: Map, band: BoundaryBand): void {
  const want = new Set<string>();
  if (band === "continents") {
    want.add(CONTINENTS_LAYER_ID);
    ensureLineLayer(map, CONTINENTS_SOURCE_ID, CONTINENTS_LAYER_ID, getLand110m());
  } else if (band === "countries") {
    want.add(COUNTRIES_LAYER_ID);
    ensureLineLayer(map, COUNTRIES_SOURCE_ID, COUNTRIES_LAYER_ID, getCountries50m());
  } else {
    want.add(US_STATES_LAYER_ID);
    want.add(NE_ADMIN1_LAYER_ID);
    ensureLineLayer(map, US_STATES_SOURCE_ID, US_STATES_LAYER_ID, getUsStates10m());
    ensureLineLayer(map, NE_ADMIN1_SOURCE_ID, NE_ADMIN1_LAYER_ID, getNeAdmin1());
  }

  // Remove layers for bands we're not showing.
  for (const id of [CONTINENTS_LAYER_ID, COUNTRIES_LAYER_ID, US_STATES_LAYER_ID, NE_ADMIN1_LAYER_ID]) {
    if (!want.has(id) && map.getLayer(id)) {
      map.removeLayer(id);
    }
  }
  // Remove orphaned sources (no layer references them).
  for (const [sourceId, layerId] of [
    [CONTINENTS_SOURCE_ID, CONTINENTS_LAYER_ID],
    [COUNTRIES_SOURCE_ID, COUNTRIES_LAYER_ID],
    [US_STATES_SOURCE_ID, US_STATES_LAYER_ID],
    [NE_ADMIN1_SOURCE_ID, NE_ADMIN1_LAYER_ID],
  ] as const) {
    if (!want.has(layerId) && map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
  }
}

/**
 * Removes all boundary layers and sources. Called on map teardown.
 */
export function clearBoundaryBands(map: Map): void {
  for (const id of [CONTINENTS_LAYER_ID, COUNTRIES_LAYER_ID, US_STATES_LAYER_ID, NE_ADMIN1_LAYER_ID]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  for (const id of [CONTINENTS_SOURCE_ID, COUNTRIES_SOURCE_ID, US_STATES_SOURCE_ID, NE_ADMIN1_SOURCE_ID]) {
    if (map.getSource(id)) map.removeSource(id);
  }
}

function ensureLineLayer(
  map: Map,
  sourceId: string,
  layerId: string,
  data: FeatureCollection<Geometry>,
): void {
  if (map.getLayer(layerId)) return; // Already painted — idempotent.
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, { type: "geojson", data });
  }
  map.addLayer({
    id: layerId,
    type: "line",
    source: sourceId,
    paint: {
      "line-color": BOUNDARY_COLOR,
      "line-opacity": BOUNDARY_OPACITY,
      "line-width": BOUNDARY_WIDTH,
    },
  });
}

// --- Data accessors (TopoJSON → GeoJSON via topojson-client) ---

let land110mCache: FeatureCollection<Geometry> | null = null;
function getLand110m(): FeatureCollection<Geometry> {
  if (!land110mCache) {
    land110mCache = feature(land110m as any, (land110m as any).objects.land) as unknown as FeatureCollection<Geometry>;
  }
  return land110mCache;
}

let countries50mCache: FeatureCollection<Geometry> | null = null;
function getCountries50m(): FeatureCollection<Geometry> {
  if (!countries50mCache) {
    countries50mCache = feature(countries50m as any, (countries50m as any).objects.countries) as unknown as FeatureCollection<Geometry>;
  }
  return countries50mCache;
}

let usStates10mCache: FeatureCollection<Geometry> | null = null;
function getUsStates10m(): FeatureCollection<Geometry> {
  if (!usStates10mCache) {
    usStates10mCache = feature(states10m as any, (states10m as any).objects.states) as unknown as FeatureCollection<Geometry>;
  }
  return usStates10mCache;
}

function getNeAdmin1(): FeatureCollection<Geometry> {
  // Already GeoJSON (vendored from Natural Earth).
  return neAdmin1 as unknown as FeatureCollection<Geometry>;
}
