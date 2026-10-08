/**
 * Scout Map outline style (PBI-3) — labels-free, tile-free MapLibre style.
 *
 * Built from the shared geometry sources in atlas-data.ts (the same
 * countries-50m / states data the globe mesh in globe-mesh.ts consumes) —
 * NO geometry fork. The style contains only:
 *   - a background (ocean) layer,
 *   - a land fill from the countries FeatureCollection,
 *   - coast + country-border line layers from the prebuilt meshes.
 *
 * There are NO symbol layers and NO raster/vector tile sources, so zero
 * satellite tiles load in scout mode and zero labels can ever render
 * (labels would leak answers — repo rule).
 *
 * Pure and DOM-free: safe to import in node tests.
 */

import type { StyleSpecification } from "maplibre-gl";
import type { FeatureCollection, MultiLineString } from "geojson";
import { countries, coast, countryBorders } from "./atlas-data.ts";

export const SCOUT_SOURCE_LAND = "scout-land";
export const SCOUT_SOURCE_COAST = "scout-coast";
export const SCOUT_SOURCE_BORDERS = "scout-borders";

/** Deep-space ocean — matches the full-mode starfield backdrop tone. */
export const SCOUT_OCEAN = "#070b14";
/** Muted land fill — readable against the ocean, calm under the gold pin. */
export const SCOUT_LAND = "#1d2c47";
export const SCOUT_COAST = "#8fb0e0";
export const SCOUT_BORDER = "#54698f";

/**
 * Build the scout outline style for the given projection. The land source
 * reuses the shared countries collection; coast/borders reuse the shared
 * prebuilt meshes — no duplicated geometry anywhere.
 */
export function buildScoutStyle(projection: "globe" | "mercator"): StyleSpecification {
  return {
    version: 8,
    projection: { type: projection },
    sources: {
      [SCOUT_SOURCE_LAND]: {
        type: "geojson",
        data: countries as unknown as FeatureCollection,
      },
      [SCOUT_SOURCE_COAST]: {
        type: "geojson",
        data: coast as unknown as MultiLineString,
      },
      [SCOUT_SOURCE_BORDERS]: {
        type: "geojson",
        data: countryBorders as unknown as MultiLineString,
      },
    },
    layers: [
      {
        id: "scout-background",
        type: "background",
        paint: { "background-color": SCOUT_OCEAN },
      },
      {
        id: SCOUT_SOURCE_LAND,
        type: "fill",
        source: SCOUT_SOURCE_LAND,
        paint: { "fill-color": SCOUT_LAND },
      },
      {
        id: SCOUT_SOURCE_BORDERS,
        type: "line",
        source: SCOUT_SOURCE_BORDERS,
        paint: { "line-color": SCOUT_BORDER, "line-width": 0.75 },
      },
      {
        id: SCOUT_SOURCE_COAST,
        type: "line",
        source: SCOUT_SOURCE_COAST,
        paint: { "line-color": SCOUT_COAST, "line-width": 1 },
      },
    ],
  };
}
