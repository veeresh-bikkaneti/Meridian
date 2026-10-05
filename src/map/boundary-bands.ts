/**
 * Progressive boundary reveal — admin boundaries in zoom bands.
 *
 * As the user zooms, context boundaries switch by band:
 *   z < 3          → continent outlines (Natural Earth land-110m)
 *   3 ≤ z < 6      → country boundaries (Natural Earth countries-50m)
 *   z ≥ 6          → state/province boundaries (one merged `boundary-admin1`
 *                    layer: US states-10m + NE 50m AU/BR/CA/CN/IN + the 7
 *                    narrow-scope chunks EG/FR/DE/IT/JP/MX/GB) PLUS country
 *                    boundaries (so regions without admin-1 data still show
 *                    context)
 *
 * Design constraints (Veeresh, 2026-09-30):
 * - NO text labels at any zoom/mode — naming things is the game.
 * - Boundaries are subtle context only; the quiz region highlight stays
 *   dominant (gold, 4.5px). Boundary lines are thin gray, rendered beneath
 *   the highlight layers.
 * - Zero-cost data: all bundled (world-atlas, us-atlas, vendored NE).
 * - Reduced-motion: bands render statically, no animated transitions.
 *
 * The module is pure except for the MapLibre paint calls and the memoized
 * TopoJSON conversions (module-level caches, invisible to callers). The
 * paint functions are idempotent — calling paintBoundaryBand with the same
 * band twice is a no-op, and switching bands removes the old layers.
 *
 * Data provenance (all public domain, Natural Earth):
 * - ne-50m-admin-1.json: nvkelso/natural-earth-vector,
 *   geojson/ne_50m_admin_1_states_provinces.geojson, filtered to
 *   AU/BR/CA/CN/IN (116 features), property-stripped to {name, iso_a2}.
 * - admin1/<iso2>.json (eg/fr/de/it/jp/mx/gb): built by
 *   scripts/build-admin1.mjs from ne_10m_admin_1_states_provinces.geojson
 *   (the 50m file covers only 9 countries — Step-0 verified 2026-10-05),
 *   simplified to 50m-equivalent density, TopoJSON.
 */

import type { Map } from "maplibre-gl";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";

// All data is loaded via dynamic import (lazy). No static JSON imports —
// this keeps the 1.2MB NE admin-1 (and the other datasets) out of the
// initial bundle, and lets the module run under Node's test runner
// (which requires import attributes for static JSON).

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
const ADMIN1_LAYER_ID = "boundary-admin1";

const CONTINENTS_SOURCE_ID = "boundary-src-continents";
const COUNTRIES_SOURCE_ID = "boundary-src-countries";
const ADMIN1_SOURCE_ID = "boundary-src-admin1";

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
 *
 * Boundary layers are inserted beneath the quiz highlight layers (if present)
 * so the gold highlight stays dominant regardless of paint order.
 */
export function paintBoundaryBand(map: Map, band: BoundaryBand): void {
  // Kick off the async paint; the module handles idempotency internally.
  void paintBoundaryBandAsync(map, band);
}

async function paintBoundaryBandAsync(map: Map, band: BoundaryBand): Promise<void> {
  const want = new Set<string>();
  try {
    if (band === "continents") {
      want.add(CONTINENTS_LAYER_ID);
      ensureLineLayer(map, CONTINENTS_SOURCE_ID, CONTINENTS_LAYER_ID, await getLand110m());
    } else if (band === "countries") {
      want.add(COUNTRIES_LAYER_ID);
      ensureLineLayer(map, COUNTRIES_SOURCE_ID, COUNTRIES_LAYER_ID, await getCountries50m());
    } else {
      // Admin1 band: one merged boundary-admin1 layer (US states + NE 50m
      // 5-country + the 7 narrow-scope chunks) PLUS country boundaries so
      // regions without admin-1 data still show context. The country layer
      // is cached from the countries band, so this is cheap.
      want.add(COUNTRIES_LAYER_ID);
      want.add(ADMIN1_LAYER_ID);
      ensureLineLayer(map, COUNTRIES_SOURCE_ID, COUNTRIES_LAYER_ID, await getCountries50m());
      ensureLineLayer(map, ADMIN1_SOURCE_ID, ADMIN1_LAYER_ID, await getAdmin1Merged());
    }

    // Remove layers for bands we're not showing.
    for (const id of [CONTINENTS_LAYER_ID, COUNTRIES_LAYER_ID, ADMIN1_LAYER_ID]) {
      if (!want.has(id) && map.getLayer(id)) {
        map.removeLayer(id);
      }
    }
    // Remove orphaned sources (no layer references them).
    for (const [sourceId, layerId] of [
      [CONTINENTS_SOURCE_ID, CONTINENTS_LAYER_ID],
      [COUNTRIES_SOURCE_ID, COUNTRIES_LAYER_ID],
      [ADMIN1_SOURCE_ID, ADMIN1_LAYER_ID],
    ] as const) {
      if (!want.has(layerId) && map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    }
  } catch {
    // Non-fatal: the band simply doesn't paint. The next zoomend retries.
    // (Callers log in dev if needed.)
  }
}

/**
 * Removes all boundary layers and sources. Called on map teardown.
 */
export function clearBoundaryBands(map: Map): void {
  for (const id of [CONTINENTS_LAYER_ID, COUNTRIES_LAYER_ID, ADMIN1_LAYER_ID]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  for (const id of [CONTINENTS_SOURCE_ID, COUNTRIES_SOURCE_ID, ADMIN1_SOURCE_ID]) {
    if (map.getSource(id)) map.removeSource(id);
  }
}

function ensureLineLayer(
  map: Map,
  sourceId: string,
  layerId: string,
  data: FeatureCollection<Geometry> | Feature<Geometry>,
): void {
  if (map.getLayer(layerId)) return; // Already painted — idempotent.
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, { type: "geojson", data: data as any });
  }
  // Insert beneath the quiz highlight layers (if present) so the gold
  // highlight stays dominant regardless of paint order.
  const beforeId = getHighlightLayerId(map);
  const layerSpec: any = {
    id: layerId,
    type: "line",
    source: sourceId,
    paint: {
      "line-color": BOUNDARY_COLOR,
      "line-opacity": BOUNDARY_OPACITY,
      "line-width": BOUNDARY_WIDTH,
    },
  };
  if (beforeId) {
    map.addLayer(layerSpec, beforeId);
  } else {
    map.addLayer(layerSpec);
  }
}

/**
 * Returns the ID of the first highlight layer, if present. Boundary layers
 * are inserted before it to keep the quiz highlight on top.
 */
function getHighlightLayerId(map: Map): string | undefined {
  // From region-highlight.ts — the three highlight layer IDs.
  for (const id of ["region-highlight-fill", "region-highlight-casing", "region-highlight-outline"]) {
    if (map.getLayer(id)) return id;
  }
  return undefined;
}

// --- Data accessors (lazy via dynamic import) ---

let land110mPromise: Promise<FeatureCollection<Geometry> | Feature<Geometry>> | null = null;
function getLand110m(): Promise<FeatureCollection<Geometry> | Feature<Geometry>> {
  if (!land110mPromise) {
    land110mPromise = import("world-atlas/land-110m.json", { with: { type: "json" } }).then((mod) => {
      const topo = mod.default as unknown as { objects: { land: unknown } };
      return feature(topo, topo.objects.land) as unknown as Feature<Geometry>;
    });
  }
  return land110mPromise;
}

let countries50mPromise: Promise<FeatureCollection<Geometry> | Feature<Geometry>> | null = null;
function getCountries50m(): Promise<FeatureCollection<Geometry> | Feature<Geometry>> {
  if (!countries50mPromise) {
    countries50mPromise = import("world-atlas/countries-50m.json", { with: { type: "json" } }).then((mod) => {
      const topo = mod.default as unknown as { objects: { countries: unknown } };
      return feature(topo, topo.objects.countries) as unknown as Feature<Geometry>;
    });
  }
  return countries50mPromise;
}

let usStates10mPromise: Promise<FeatureCollection<Geometry> | Feature<Geometry>> | null = null;
function getUsStates10m(): Promise<FeatureCollection<Geometry> | Feature<Geometry>> {
  if (!usStates10mPromise) {
    usStates10mPromise = import("us-atlas/states-10m.json", { with: { type: "json" } }).then((mod) => {
      const topo = mod.default as unknown as { objects: { states: unknown } };
      return feature(topo, topo.objects.states) as unknown as Feature<Geometry>;
    });
  }
  return usStates10mPromise;
}

let neAdmin1Promise: Promise<FeatureCollection<Geometry>> | null = null;
function getNeAdmin1(): Promise<FeatureCollection<Geometry>> {
  if (!neAdmin1Promise) {
    neAdmin1Promise = import("./data/ne-50m-admin-1.json", { with: { type: "json" } }).then(
      (mod) => mod.default as unknown as FeatureCollection<Geometry>
    );
  }
  return neAdmin1Promise;
}

/** ISO2 codes with a vendored admin1 chunk (lowercase, matches filenames). */
const ADMIN1_CHUNK_ISO2 = ["eg", "fr", "de", "it", "jp", "mx", "gb"] as const;

function getAdmin1Chunk(iso2: string): Promise<FeatureCollection<Geometry>> {
  return import(`./data/admin1/${iso2}.json`, { with: { type: "json" } }).then((mod) => {
    const topo = mod.default as unknown as { objects: { admin1: unknown } };
    return feature(topo, topo.objects.admin1) as unknown as FeatureCollection<Geometry>;
  });
}

function toFeatures(
  data: FeatureCollection<Geometry> | Feature<Geometry>,
): Feature<Geometry>[] {
  const asCollection = data as FeatureCollection<Geometry>;
  return Array.isArray(asCollection.features) ? asCollection.features : [data as Feature<Geometry>];
}

// --- Merged admin-1 source -------------------------------------------
//
// One `boundary-admin1` layer for the whole admin-1 band: US states +
// the NE 50m 5-country file + the 7 narrow-scope chunks, merged into a
// single GeoJSON source. Chunks load in parallel; a failed part is left
// out of this paint but the merged cache is evicted so the next zoomend
// retries it (the country-context layer paints regardless — fail closed).

let admin1MergedPromise: Promise<FeatureCollection<Geometry>> | null = null;

function getAdmin1Merged(): Promise<FeatureCollection<Geometry>> {
  if (!admin1MergedPromise) {
    admin1MergedPromise = buildAdmin1Merged().catch((err) => {
      // Total failure: evict so the next zoomend retries; the band's
      // outer catch no-ops this paint (country lines still show).
      admin1MergedPromise = null;
      throw err;
    });
  }
  return admin1MergedPromise;
}

async function buildAdmin1Merged(): Promise<FeatureCollection<Geometry>> {
  const settled = await Promise.allSettled([
    // us-atlas features carry no iso_a2 — tag them so the merged source
    // has a uniform schema (shallow copies; the cached originals stay
    // untouched for any other consumer).
    getUsStates10m().then((data) =>
      toFeatures(data).map((f) => ({
        ...f,
        properties: { ...(f.properties as object), iso_a2: "US" },
      })),
    ),
    getNeAdmin1().then(toFeatures),
    ...ADMIN1_CHUNK_ISO2.map((iso) => getAdmin1Chunk(iso).then(toFeatures)),
  ]);
  const features: Feature<Geometry>[] = [];
  let ok = 0;
  for (const s of settled) {
    if (s.status === "fulfilled") {
      ok += 1;
      features.push(...s.value);
    }
  }
  if (ok === 0) throw new Error("admin1: every source failed");
  if (ok < settled.length) {
    // Partial merge: paint what loaded now, but evict the cache so the
    // next zoomend retries the failed parts (see the assignment dance in
    // getAdmin1Merged — this runs before the outer promise settles).
    admin1MergedPromise = null;
  }
  return { type: "FeatureCollection", features };
}
