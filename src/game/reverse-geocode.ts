/**
 * reverse-geocode.ts — names the places behind the reveal pins.
 *
 * On a wrong-answer reveal, the card names BOTH locations ("Your pin:
 * Nebraska · True spot: District of Columbia") so the player learns
 * where their guess actually landed, not just how far off it was.
 *
 * Data sources:
 * - Country: the vendored `territoryAt()` lookup (world-atlas 50m).
 * - Admin-1, United States: `us-atlas/states-10m.json` (TopoJSON, 56
 *   geometries incl. DC and the territories; display name at
 *   `geometry.properties.name`).
 * - Admin-1, AU/BR/CA/CN/IN: `src/map/data/ne-50m-admin-1.json`
 *   (GeoJSON, 116 features; display name at `properties.name`).
 *
 * The admin-1 JSONs are large enough to matter at boot, so they load ONLY
 * via dynamic `import()` inside `preloadAdmin1Boundaries()` — never at
 * module top level (the Safari jetsam lesson from territory.ts applies
 * here too). `resolvePin` never triggers loading: if the caches aren't
 * populated it returns a country-only result, and it never throws.
 */
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";
import { territoryAt } from "./territory.ts";
import { countryNameForIso2, countryNameForRegionId } from "./question-label.ts";
import type { LonLat } from "./types.ts";

export type ResolvedPin = { admin1: string | null; country: string | null };

type Admin1Feature = {
  properties?: { name?: string };
  type: "Feature";
  geometry: unknown;
};

// --- Lazy admin-1 caches ----------------------------------------------
//
// Populated ONLY by preloadAdmin1Boundaries(). resolvePin reads them
// synchronously and treats "not loaded" as "admin1 unknown" — it never
// starts a load itself.

let usStatesCache: Admin1Feature[] | null = null;
let neAdmin1Cache: Admin1Feature[] | null = null;
let usStatesPromise: Promise<Admin1Feature[]> | null = null;
let neAdmin1Promise: Promise<Admin1Feature[]> | null = null;
let preloadPromise: Promise<void> | null = null;

/** Test seam (see territoryConversionRunsForTests precedent): how many times
 * the admin-1 loads have started. Must stay 1 per source no matter how many
 * times preloadAdmin1Boundaries() is called. */
let usLoadRuns = 0;
let neLoadRuns = 0;
export function admin1LoadRunsForTests(): { us: number; ne: number } {
  return { us: usLoadRuns, ne: neLoadRuns };
}

function getUsStates(): Promise<Admin1Feature[]> {
  if (!usStatesPromise) {
    usLoadRuns += 1;
    usStatesPromise = import("us-atlas/states-10m.json", { with: { type: "json" } }).then(
      (mod) => {
        const topo = mod.default as unknown as { objects: { states: unknown } };
        return (
          feature(topo, topo.objects.states) as unknown as {
            features: Admin1Feature[];
          }
        ).features;
      },
    );
  }
  return usStatesPromise;
}

function getNeAdmin1(): Promise<Admin1Feature[]> {
  if (!neAdmin1Promise) {
    neLoadRuns += 1;
    neAdmin1Promise = import("../map/data/ne-50m-admin-1.json", {
      with: { type: "json" },
    }).then((mod) => (mod.default as unknown as { features: Admin1Feature[] }).features);
  }
  return neAdmin1Promise;
}

/**
 * Idempotent: starts the admin-1 loads on the first call and reuses the
 * settled promise afterwards (no double parse). The app fire-and-forgets
 * this once per session; tests await it before calling resolvePin.
 *
 * A failed load never rejects: resolvePin degrades gracefully to
 * country-only results, and the next preload call retries.
 */
export function preloadAdmin1Boundaries(): Promise<void> {
  if (!preloadPromise) {
    preloadPromise = Promise.all([getUsStates(), getNeAdmin1()])
      .then(([usStates, neAdmin1]) => {
        usStatesCache = usStates;
        neAdmin1Cache = neAdmin1;
      })
      .catch(() => {
        // Degrade to country-only; reset so a later call retries.
        preloadPromise = null;
        usStatesPromise = null;
        neAdmin1Promise = null;
      });
  }
  return preloadPromise;
}

function admin1At(point: LonLat): string | null {
  for (const list of [usStatesCache, neAdmin1Cache]) {
    if (!list) continue;
    for (const item of list) {
      if (geoContains(item as never, point)) {
        return item.properties?.name ?? null;
      }
    }
  }
  return null;
}

/**
 * Resolve a pin to its admin-1 region and country. Synchronous and NEVER
 * throws: returns null for ocean/unresolvable points (the reveal card then
 * renders exactly as it does today — fail closed), and returns a
 * country-only result while the admin-1 boundaries are still loading.
 */
export function resolvePin(lat: number, lon: number): ResolvedPin | null {
  try {
    const point: LonLat = [lon, lat];
    const territory = territoryAt(point);
    if (!territory) return null;
    return { admin1: admin1At(point), country: territory.name };
  } catch {
    return null;
  }
}

/**
 * The one line the reveal card shows on a miss, or null when either side
 * is unresolvable (card renders as today — fail closed).
 *
 * Copy is fixed by design: kid-friendly, no shaming.
 * - same state/province, same country → "Right state, wrong town!"
 * - same country, different admin-1 → "Right country, wrong town!"
 * - different countries → "Your pin: {X} · True spot: {Y}"
 *   (admin-1 preferred, country fallback for places with no admin-1 data)
 */
export function pinCompareLine(
  player: ResolvedPin | null,
  truth: ResolvedPin | null,
): string | null {
  if (!player || !truth) return null;
  if (!player.country || !truth.country) return null;
  if (player.admin1 && truth.admin1 && player.country === truth.country) {
    if (player.admin1 === truth.admin1) return "Right state, wrong town!";
    return `Your pin: ${player.admin1} · True spot: ${truth.admin1}`;
  }
  if (player.country === truth.country) return "Right country, wrong town!";
  return `Your pin: ${player.admin1 ?? player.country} · True spot: ${truth.admin1 ?? truth.country}`;
}

// --- Nearest-place "Your pin" detail (fallback for admin-1 coverage gaps) ---
//
// Context (Veeresh's live-play diagnostic, 2026-10-04): admin1At() only
// covers the US (us-atlas) and AU/BR/CA/CN/IN (ne-50m-admin-1.json) — Italy
// and France have ZERO admin-1 features. In country editions without
// vendored admin-1 data, both sides of pinCompareLine resolve admin1: null
// and the classic path degrades to the bare "Right country, wrong town!" —
// the "Your pin" line silently drops. (India is the working reference: its
// 36 vendored features let the classic path name both Indian states.)
//
// This section is the graceful fallback: name the player's raw pin from the
// already-loaded region pool (whose records carry build-time subdivision
// display names at 99.7% coverage), honestly qualified as "near <city>",
// gated on same-territory and a 100 km budget. The classic pinCompareLine
// path is untouched and stays the fallback — and the regression lock — for
// state edition, ocean pins, and any gate failure.

/** Honesty budget: farthest a pin may be from its named nearest place. */
export const NEAREST_PLACE_MAX_KM = 100;

/** Structural subset of Starter — the only fields the matcher reads. */
export type PoolPlace = {
  lon: number;
  lat: number;
  name: string;
  subdivision?: string;
};

export type NearestPoolPlace = {
  name: string;
  subdivision: string | null;
  distanceKm: number;
};

export type PlayerPinDetail = {
  /** world-atlas numeric key, e.g. "380" — exact-match, never name-compared. */
  territoryKey: string;
  /** world-atlas display name, e.g. "Italy". */
  territoryName: string;
  nearest: NearestPoolPlace;
};

/** Mean earth radius, km. */
const EARTH_RADIUS_KM = 6371;

/**
 * Haversine distance. Antimeridian-safe: sin²(Δlon/2) is periodic in Δlon,
 * so a raw Δlon needs no ±180° wrapping.
 */
function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, a)));
}

/** Non-empty-string subdivision pass-through (the question-label convention). */
function cleanSubdivision(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Names the player's raw pin from the already-loaded region pool.
 * Returns null when: the pin is ocean/unresolvable (territoryAt null);
 * no pool place shares the pin's territory (country not covered by the
 * pool — e.g. the 13 country-chunk nations in globe edition); or the
 * nearest same-territory place is farther than NEAREST_PLACE_MAX_KM.
 * Synchronous, never throws. Needs NO admin-1 preload — the subdivision
 * comes from the chunk pipeline, so this works even in the first 10 s of
 * a run before preloadAdmin1Boundaries() resolves (an improvement over
 * the classic path, which degrades to country-only meanwhile).
 */
export function nearestPoolPlace(
  lat: number,
  lon: number,
  pool: ReadonlyArray<PoolPlace>,
): PlayerPinDetail | null {
  try {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const pinTerritory = territoryAt([lon, lat]);
    if (!pinTerritory) return null;
    let best: PoolPlace | null = null;
    let bestKm = Infinity;
    for (const candidate of pool) {
      if (!candidate) continue;
      if (!Number.isFinite(candidate.lat) || !Number.isFinite(candidate.lon)) {
        continue;
      }
      const distanceKm = haversineKm(lat, lon, candidate.lat, candidate.lon);
      if (distanceKm < bestKm) {
        bestKm = distanceKm;
        best = candidate;
      }
    }
    if (!best || bestKm > NEAREST_PLACE_MAX_KM) return null;
    // Territory gate: numeric keys, never name-compared ("United States of
    // America" vs "United States" must never be string-matched).
    const candidateTerritory = territoryAt([best.lon, best.lat]);
    if (!candidateTerritory || candidateTerritory.key !== pinTerritory.key) {
      return null;
    }
    return {
      territoryKey: pinTerritory.key,
      territoryName: pinTerritory.name,
      nearest: {
        name: best.name,
        subdivision: cleanSubdivision(best.subdivision),
        distanceKm: bestKm,
      },
    };
  } catch {
    return null;
  }
}

export type RevealPinLineInput = {
  edition: "state" | "country" | "globe";
  playerLat: number;
  playerLon: number;
  truth: {
    name: string;
    lat: number;
    lon: number;
    subdivision?: string;
    iso2?: string;
    regionId: string;
    originRegionId?: string;
  };
  pool: ReadonlyArray<PoolPlace>;
};

/**
 * Truth-side country for the globe suffix — the same funnel the question
 * bubble uses (countryNameForIso2 → regionId → originRegionId), so the
 * reveal matches what was asked. Fail-closed: null when unresolvable.
 */
function truthCountryName(truth: RevealPinLineInput["truth"]): string | null {
  return (
    countryNameForIso2(truth.iso2) ??
    countryNameForRegionId(truth.regionId) ??
    countryNameForRegionId(truth.originRegionId)
  );
}

/** "city" + optional ", state" segment. */
function cityStateSegment(name: string, subdivision: string | null): string {
  return subdivision ? `${name}, ${subdivision}` : name;
}

/**
 * The pin-compare line for a MISS reveal. Layered, fail-closed:
 *  1. state edition → classic pinCompareLine (byte-identical; regression lock).
 *  2. country/globe → the detail line when nearestPoolPlace is honest.
 *  3. otherwise → classic pinCompareLine (today's copy; ocean → null).
 * Miss-only: the hit card never calls this.
 *
 * The "near" qualifier is unconditional — the pin is a raw lat/lon, never
 * presented as an exact pick, even at distance ≈ 0.
 */
export function revealPinLine(input: RevealPinLineInput): string | null {
  let classic: string | null = null;
  try {
    classic = pinCompareLine(
      resolvePin(input.playerLat, input.playerLon),
      resolvePin(input.truth.lat, input.truth.lon),
    );
    if (input.edition === "state") return classic;
    const detail = nearestPoolPlace(
      input.playerLat,
      input.playerLon,
      input.pool,
    );
    if (!detail) return classic;
    const truth = input.truth;
    const pinSide = cityStateSegment(
      detail.nearest.name,
      detail.nearest.subdivision,
    );
    const truthSide = cityStateSegment(truth.name, cleanSubdivision(truth.subdivision));
    // Same-country check: numeric territory keys. A null truth territory
    // counts as different-country (the suffix direction is the more
    // informative one).
    const sameCountry =
      territoryAt([truth.lon, truth.lat])?.key === detail.territoryKey;
    if (input.edition === "country") {
      return sameCountry
        ? `Your pin: near ${pinSide} · True spot: ${truthSide}`
        : `Your pin: near ${pinSide}, ${detail.territoryName} · True spot: ${truthSide}`;
    }
    // globe: both sides always carry the country suffix. Unresolvable truth
    // country → classic (never a malformed line).
    const truthCountry = truthCountryName(truth);
    if (!truthCountry) return classic;
    return `Your pin: near ${pinSide}, ${detail.territoryName} · True spot: ${truthSide}, ${truthCountry}`;
  } catch {
    return classic;
  }
}
