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
