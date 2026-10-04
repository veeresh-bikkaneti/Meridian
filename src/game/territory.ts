import { geoContains } from "d3-geo";
import { feature } from "topojson-client";
import world from "world-atlas/countries-50m.json" with { type: "json" };
import { CONTINENT_BY_KEY, type Continent } from "./continents.ts";
import type { LonLat } from "./types.ts";

type CountryFeature = {
  id?: string | number;
  properties?: { name?: string };
  type: "Feature";
  geometry: unknown;
};

type Collection = { type: "FeatureCollection"; features: CountryFeature[] };

/**
 * The TopoJSON→GeoJSON conversion, LAZY and memoized. The world-atlas
 * payload is ~750 KB of quantized arcs; `feature()` walks every arc and
 * materializes full country polygons — the single most expensive import-time
 * allocation in the boot path (P0 Safari jetsam suspect #1). The static JSON
 * import above still parses at module evaluation (needed synchronously by
 * scorePlace), but the conversion now runs at most once, on the first
 * territory lookup — i.e. the first pin drop, long after first paint — and
 * never during menu boot.
 */
let cachedCountries: CountryFeature[] | null = null;
let conversionRuns = 0;

function countryFeatures(): CountryFeature[] {
  if (cachedCountries === null) {
    cachedCountries = (feature(world, world.objects.countries) as Collection).features;
    conversionRuns += 1;
  }
  return cachedCountries;
}

/** Test seam (see clearChunkCacheForTests precedent): how many times the
 * lazy conversion has run. Must stay 1 no matter how many lookups happen. */
export function territoryConversionRunsForTests(): number {
  return conversionRuns;
}

function countryKey(item: CountryFeature): string {
  if (item.id !== undefined && item.id !== null && String(item.id) !== "") {
    return String(item.id).padStart(3, "0");
  }
  return item.properties?.name ?? "";
}

export type Territory = {
  key: string;
  name: string;
  continent: Continent | null;
};

export function territoryAt(point: LonLat): Territory | null {
  for (const item of countryFeatures()) {
    if (!geoContains(item, point)) continue;
    const key = countryKey(item);
    return {
      key,
      name: item.properties?.name ?? key,
      continent: CONTINENT_BY_KEY[key] ?? null,
    };
  }
  return null;
}

export function missingContinents(): string[] {
  const missing: string[] = [];
  for (const item of countryFeatures()) {
    const key = countryKey(item);
    if (!CONTINENT_BY_KEY[key]) missing.push(item.properties?.name ?? key);
  }
  return missing;
}
