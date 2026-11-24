/**
 * One TopoJSON→GeoJSON conversion for the vendored country and state
 * atlases.
 *
 * Three boot callers used to walk the same arcs separately and each
 * retain a full polygon copy: the territory preload
 * (`src/game/territory.ts`), the region index
 * (`src/map/region-index.ts`), and the map's prebuilt collections
 * (`src/map/atlas-data.ts`). Whichever caller arrives first pays for
 * `feature()`; the others receive that same FeatureCollection.
 *
 * This module does not load JSON and does not convert at import time.
 * Callers pass a topology they already hold, so the territory preload
 * stays deferred until something asks for the countries, and a page
 * that never opens the map never converts the states.
 */
import { feature } from "topojson-client";

export type AtlasFeature = {
  id?: string | number;
  properties?: { name?: string } | null;
  type?: string;
  geometry?: { type?: unknown; coordinates?: unknown } | null;
};

export type AtlasCollection = {
  type: "FeatureCollection";
  features: AtlasFeature[];
};

/** TopoJSON the bundler and tsc both see: named objects, not a fixed key. */
type AtlasTopo = { objects: Record<string, unknown> };

let countriesCollection: AtlasCollection | null = null;
let statesCollection: AtlasCollection | null = null;
let countryRuns = 0;
let stateRuns = 0;

function asCollection(value: unknown): AtlasCollection {
  return value as AtlasCollection;
}

/** Countries-50m polygons. One retained collection per page. */
export function convertCountries(topo: AtlasTopo): AtlasCollection {
  if (countriesCollection) return countriesCollection;
  countryRuns += 1;
  countriesCollection = asCollection(
    feature(topo as never, topo.objects.countries as never),
  );
  return countriesCollection;
}

/** States-10m polygons. One retained collection per page. */
export function convertStates(topo: AtlasTopo): AtlasCollection {
  if (statesCollection) return statesCollection;
  stateRuns += 1;
  statesCollection = asCollection(
    feature(topo as never, topo.objects.states as never),
  );
  return statesCollection;
}

export function cachedCountriesAtlas(): AtlasCollection | null {
  return countriesCollection;
}

/** How many times `feature()` has run for the countries atlas. */
export function atlasCountryConversionRuns(): number {
  return countryRuns;
}

/** How many times `feature()` has run for the states atlas. */
export function atlasStateConversionRuns(): number {
  return stateRuns;
}

/**
 * Drop the retained collections so a later load can convert again.
 * Run counters stay cumulative.
 */
export function clearAtlasGeometryCache(): void {
  countriesCollection = null;
  statesCollection = null;
}
