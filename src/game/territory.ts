import { geoContains } from "d3-geo";
import { feature } from "topojson-client";
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
 * The world-atlas countries-50m TopoJSON (~750 KB raw / ~206 KB brotli),
 * LAZY and memoized — loaded ONLY via the dynamic `import()` inside
 * `loadCountryFeatures()`, started by `preloadTerritory()`.
 *
 * Why not a static import: while this module statically imported the
 * JSON, Rolldown factored it into its own PRELOADED chunk and every home
 * visit paid for it, even though the data's earliest true need is inside
 * gameplay — `scorePlace`'s region bonus at the first pin drop,
 * `resolvePin`/`revealPinCompare` on the reveal card, and
 * `unitForLoopTarget` on the GeoDetective / Cold Trail screens. Nothing
 * on the home screen reads it. (F2b, perf/performance-tuning.)
 *
 * The `feature()` conversion is the other half of the old cost: it walks
 * every arc and materializes full country polygons — the single most
 * expensive import-time allocation in the boot path (P0 Safari jetsam
 * suspect #1). It runs at most once, when the load lands.
 *
 * Sync readers fail closed while the data is not loaded — the exact
 * contract `reverse-geocode.ts` already uses for its admin-1 caches:
 * `resolvePin` never triggers an admin-1 load and degrades to
 * country-only; here `territoryAt` never triggers the territory load
 * and returns null (country unknown). Callers that need the real answer
 * await `preloadTerritory()` first: `game-app`'s `openRun` awaits it
 * alongside the places load before any run commits, the home edition /
 * case cards prefetch it on intent, and the Loop / Trail / ResultCard
 * surfaces start it on mount and re-render when it lands.
 */
let cachedCountries: CountryFeature[] | null = null;
let loadPromise: Promise<CountryFeature[]> | null = null;
let conversionRuns = 0;
let loadRuns = 0;

/** The atlas import, behind a named binding so tests can substitute a
 * failing importer (see territoryImporterForTests below). */
function importAtlas(): Promise<{ default: unknown }> {
  return import("world-atlas/countries-50m.json", {
    with: { type: "json" },
  }) as Promise<{ default: unknown }>;
}

let atlasImporter: () => Promise<{ default: unknown }> = importAtlas;

/**
 * #209: a HUNG import is worse than a failed one. Failures already
 * retry-evict below, but a hung import never settles at all — and
 * every awaiter of this load (`openRun`, the boot restore) then waits
 * forever behind its loading fallback. The load is therefore raced
 * against this bound: on timeout the attempt is evicted exactly like
 * a failure, readers stay fail-closed, and the next preload retries.
 * 10 s is the order of the build-staleness probe bound (8 s) and well
 * under the crash watchdog's ~28 s boot budget, so the recoverable
 * path always wins the race. If the import lands after the bound its
 * data still populates the cache — late is fine; only the wait was
 * bounded. (When a load is already in flight, the FIRST caller's
 * bound governs; later callers share its promise.)
 */
export const TERRITORY_LOAD_TIMEOUT_MS = 10_000;

function loadCountryFeatures(
  timeoutMs: number = TERRITORY_LOAD_TIMEOUT_MS,
): Promise<CountryFeature[]> {
  if (!loadPromise) {
    loadRuns += 1;
    const attempt = atlasImporter().then((mod) => {
      const topo = mod.default as unknown as {
        objects: { countries: unknown };
      };
      const features = (
        feature(topo, topo.objects.countries) as unknown as Collection
      ).features;
      conversionRuns += 1;
      cachedCountries = features;
      return features;
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timed = new Promise<CountryFeature[]>((resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`territory load timed out after ${timeoutMs} ms`));
      }, timeoutMs);
      attempt.then(
        (features) => {
          if (timer) clearTimeout(timer);
          resolve(features);
        },
        (err: unknown) => {
          if (timer) clearTimeout(timer);
          reject(err);
        },
      );
    });
    loadPromise = timed.catch((err: unknown) => {
      // Retry eviction (the admin-1 chunk precedent in
      // reverse-geocode.ts): a failed — or timed-out — load must not
      // poison the cache; the next preload call retries.
      loadPromise = null;
      throw err;
    });
  }
  return loadPromise;
}

/**
 * Idempotent: starts the countries-50m load on the first call and reuses
 * the in-flight / settled promise afterwards (no double fetch, no double
 * parse). Never rejects: a failed load degrades every sync reader to its
 * fail-closed result, and the next call retries. Never hangs either: a
 * load that has not settled within `timeoutMs` resolves the same way
 * (#209), so awaiters behind loading fallbacks always get an answer.
 */
export function preloadTerritory(
  timeoutMs: number = TERRITORY_LOAD_TIMEOUT_MS,
): Promise<void> {
  return loadCountryFeatures(timeoutMs).then(
    () => undefined,
    () => undefined,
  );
}

/** Test seam (see admin1LoadRunsForTests precedent): how many times the
 * dynamic load has started. Must stay 1 no matter how many preloads or
 * lookups happen. */
export function territoryLoadRunsForTests(): number {
  return loadRuns;
}

/** Test seam: substitute the atlas importer and reset the load cache, so
 * the failure contract (never-rejects preload, fail-closed readers,
 * retry eviction) is exercised end-to-end by territory-failure.test.ts.
 * Pass null to restore the real import. */
export function territoryImporterForTests(
  importer: (() => Promise<{ default: unknown }>) | null,
): void {
  atlasImporter = importer ?? importAtlas;
  loadPromise = null;
  cachedCountries = null;
}

/** Test seam: how many times the TopoJSON→GeoJSON conversion has run.
 * Must stay 1 no matter how many lookups happen. */
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

/**
 * Synchronous territory lookup. Returns null when the point is ocean /
 * unresolvable AND when the countries data has not loaded yet — the two
 * are indistinguishable to callers, and every caller already treats null
 * as fail-closed (no region bonus, no pin name, km unit). Never starts
 * the load itself; gameplay entry points preload (see module doc).
 */
export function territoryAt(point: LonLat): Territory | null {
  if (cachedCountries === null) return null;
  for (const item of cachedCountries) {
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

/**
 * Continent-coverage invariant (every atlas country must map to a
 * continent). Async because the data is: awaits the shared load, then
 * scans. Rejects if the load itself fails — an invariant check must
 * never silently pass on missing data.
 */
export async function missingContinents(): Promise<string[]> {
  const features = await loadCountryFeatures();
  const missing: string[] = [];
  for (const item of features) {
    const key = countryKey(item);
    if (!CONTINENT_BY_KEY[key]) missing.push(item.properties?.name ?? key);
  }
  return missing;
}
