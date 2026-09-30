import type { Edition } from "./run.ts";
import type { Starter } from "./starters.ts";

/**
 * Build the dealing pool for one edition + region — the "questions come from
 * the selected subset" policy, enforced fail-closed.
 *
 * - The returned pool contains ONLY places whose `edition` and `regionId`
 *   both match the requested run.
 * - A place in the catalog that claims the requested `regionId` with a
 *   DIFFERENT `edition` is data corruption (a place must not deal questions
 *   for the wrong subset); the pool build THROWS naming the offending place
 *   instead of silently widening or narrowing the pool. Build-time tests are
 *   the primary gate for this; the throw is defense in depth.
 * - Places belonging to other regions are ignored — they are not evidence
 *   of corruption, they are the rest of the catalog.
 * - An empty pool is returned as-is (not widened to another region); the
 *   caller keeps its existing empty-state handling. The picker never lists
 *   regions without a playable pool, so this should not happen in practice.
 *
 * F6b contract (generated-place import): every generated place MUST carry a
 * correct `edition` + `regionId` and pass the build-time coordinate-in-region
 * check before it enters the playable catalog; the F6b wiring MUST route the
 * merged catalog through this function so a mis-assigned place fails loudly
 * instead of dealing out-of-region questions.
 */
export function buildRegionPool(catalog: Starter[], edition: Edition, regionId: string): Starter[] {
  const pool: Starter[] = [];
  const seenIds = new Set<string>();
  for (const place of catalog) {
    if (place.regionId !== regionId) continue;
    if (place.edition !== edition) {
      throw new Error(
        `buildRegionPool: place "${place.id}" claims region "${regionId}" with edition "${place.edition}" ` +
          `(expected "${edition}"). The catalog is mis-assigned; refusing to deal.`,
      );
    }
    if (seenIds.has(place.id)) {
      throw new Error(
        `buildRegionPool: duplicate place id "${place.id}" in region "${regionId}". ` +
          `Duplicate ids break the no-repeat dealing guarantee; refusing to deal.`,
      );
    }
    seenIds.add(place.id);
    pool.push(place);
  }
  return pool;
}
