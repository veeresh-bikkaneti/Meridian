/**
 * Pure name→geometry index over the vendored TopoJSON boundary data.
 *
 * Source: `world-atlas` countries-50m (countries) and `us-atlas` states-10m
 * (states), converted with the already-installed `topojson-client` `feature()`.
 * No new data, no new packages, no MapLibre, no DOM — node-testable.
 *
 * The index is keyed by normalized name (lowercase, collapsed whitespace) and
 * carries a small alias table for known game↔atlas mismatches. It produces
 * the `RegionGeometryDTO` that the zoom-space controller (`zoom-space.ts`)
 * receives: the pure core never imports `regions.ts` or topojson itself, so
 * the game→map dependency direction stays clean.
 *
 * Collision policy: countries are indexed first, states second — on a name
 * collision the US state/territory wins, because it carries the
 * higher-resolution us-atlas geometry. The four collisions are "Georgia"
 * (US state over the country), "American Samoa", "Guam", and "Puerto Rico"
 * (us-atlas territories over their world-atlas entries); none of them is in
 * the game country list, so the policy is safe for every configured edition.
 *
 * Antimeridian: raw `bounds` are the naive coordinate scan, so a
 * dateline-crossing geometry (Alaska) yields a dateline-spanning box
 * ([-179.14, …, 179.77, …]) — documented, not "fixed", because the highlight
 * painter owns dateline rendering (design §3: verify visually, clip fallback).
 * `center`, however, is antimeridian-aware (Alaska ≈ [-158.8, 61.3], not
 * [0.3, …]) so camera math on the DTO never aims at the wrong hemisphere.
 *
 * The JSON imports carry `with { type: "json" }` (unlike the plain imports in
 * `atlas-data.ts`) because the node `--experimental-strip-types` test runner
 * requires the import attribute; it typechecks under tsc and bundles under
 * vite identically.
 */

import { feature } from "topojson-client";
import countriesTopo from "world-atlas/countries-50m.json" with {
  type: "json",
};
import statesTopo from "us-atlas/states-10m.json" with { type: "json" };

export type LngLat = [number, number];

/** [west, south, east, north] in degrees. */
export type RegionBounds = [number, number, number, number];

export type PolygonCoordinates = number[][][] | number[][][][];

export interface RegionGeometryDTO {
  /** Atlas feature id when present, else the normalized name. */
  id: string;
  /** Atlas-resolved display name (after alias resolution). */
  name: string;
  bounds: RegionBounds;
  /** [lon, lat] — antimeridian-aware (see module doc). */
  center: LngLat;
  /** Full geometry for the highlight painter. */
  polygonCoords: {
    type: "Polygon" | "MultiPolygon";
    coordinates: PolygonCoordinates;
  };
}

/** Lowercase, trimmed, interior whitespace collapsed. */
export function normalizeRegionName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Normalized game name → normalized atlas name, for the known mismatches.
 * Everything else in `src/game/regions.ts` matches the atlas verbatim
 * (guarded by `region-index.test.ts` — atlas naming drift is the top risk).
 */
export const REGION_NAME_ALIASES: Readonly<Record<string, string>> = {
  "united states": "united states of america",
};

interface AtlasFeature {
  id?: string | number | null;
  properties?: { name?: unknown } | null;
  geometry?: { type?: unknown; coordinates?: unknown } | null;
}

function asFeatures(collection: unknown): AtlasFeature[] {
  if (typeof collection !== "object" || collection === null) return [];
  const features = (collection as { features?: unknown }).features;
  return Array.isArray(features) ? (features as AtlasFeature[]) : [];
}

function eachPosition(
  coords: unknown,
  visit: (lon: number, lat: number) => void,
): void {
  if (!Array.isArray(coords)) return;
  if (typeof coords[0] === "number") {
    const lon = coords[0];
    const lat = typeof coords[1] === "number" ? coords[1] : 0;
    if (Number.isFinite(lon) && Number.isFinite(lat)) visit(lon, lat);
    return;
  }
  for (const part of coords) eachPosition(part, visit);
}

function toDTO(
  key: string,
  name: string,
  feat: AtlasFeature,
): RegionGeometryDTO | null {
  const geometry = feat.geometry;
  const type = geometry?.type;
  if (type !== "Polygon" && type !== "MultiPolygon") return null;
  const coordinates = geometry?.coordinates;
  if (!Array.isArray(coordinates)) return null;

  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  // Antimeridian-shifted longitude span (negatives moved +360), for the
  // center computation on dateline-crossing geometries.
  let shiftedMinLon = Infinity;
  let shiftedMaxLon = -Infinity;
  let count = 0;
  eachPosition(coordinates, (lon, lat) => {
    count += 1;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    const shifted = lon < 0 ? lon + 360 : lon;
    if (shifted < shiftedMinLon) shiftedMinLon = shifted;
    if (shifted > shiftedMaxLon) shiftedMaxLon = shifted;
  });
  if (count === 0) return null;

  let centerLon: number;
  if (maxLon - minLon > 180) {
    centerLon = (shiftedMinLon + shiftedMaxLon) / 2;
    if (centerLon > 180) centerLon -= 360;
  } else {
    centerLon = (minLon + maxLon) / 2;
  }

  return {
    id: feat.id === null || feat.id === undefined ? key : String(feat.id),
    name,
    bounds: [minLon, minLat, maxLon, maxLat],
    center: [centerLon, (minLat + maxLat) / 2],
    polygonCoords: { type, coordinates: coordinates as PolygonCoordinates },
  };
}

function indexFeatures(
  index: Map<string, RegionGeometryDTO>,
  features: AtlasFeature[],
  overwrite: boolean,
): void {
  for (const feat of features) {
    const rawName = feat.properties?.name;
    if (typeof rawName !== "string" || rawName.trim() === "") continue;
    const key = normalizeRegionName(rawName);
    if (!overwrite && index.has(key)) continue;
    const dto = toDTO(key, rawName, feat);
    if (dto !== null) index.set(key, dto);
  }
}

/**
 * Build the `{ normalizedName → RegionGeometryDTO }` index over both
 * vendored atlases. Pure; call once and reuse (or per test).
 */
export function buildRegionIndex(): Map<string, RegionGeometryDTO> {
  const index = new Map<string, RegionGeometryDTO>();
  indexFeatures(
    index,
    asFeatures(feature(countriesTopo, countriesTopo.objects.countries)),
    false,
  );
  indexFeatures(
    index,
    asFeatures(feature(statesTopo, statesTopo.objects.states)),
    true,
  );
  return index;
}

/**
 * Resolve a game region name (e.g. from `src/game/regions.ts`) to its
 * geometry DTO, applying the alias table. Returns `null` when the atlas has
 * no such feature — the naming-drift guard test fails loudly on that.
 */
export function lookupRegion(
  index: ReadonlyMap<string, RegionGeometryDTO>,
  name: string,
): RegionGeometryDTO | null {
  const normalized = normalizeRegionName(name);
  const aliased = REGION_NAME_ALIASES[normalized] ?? normalized;
  return index.get(aliased) ?? null;
}
