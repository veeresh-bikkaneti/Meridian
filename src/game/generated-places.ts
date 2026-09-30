/**
 * generated-places.ts — F6b: the approved Natural Earth place dataset, wired
 * into question dealing.
 *
 * Provenance: `src/game/data/generated-places.json` is the F6a build output
 * (3,468 generated places + 327 curated refs), enriched with `edition` /
 * `regionId` by the one-time landing script `scripts/assign-place-editions.mjs`.
 * The F7 import gate (`scripts/check-generated-places.mjs`, wired as
 * `prebuild`) re-validates every generated place against its reference
 * country box (`src/game/data/country-boxes.json`) on every build — the
 * Hyderabad rule holds for generated content exactly as it does for curated.
 *
 * Dealing contract (approach C, curated-first hybrid): the hand-curated
 * starters are the foundation of every pool — they are never displaced by
 * generated content. Generated places fill depth behind them. The F4 dealer
 * (`trail.ts`) shuffles the pool uniformly, so "curated first" is inclusion
 * priority, not deal order; no dealing mechanics change here.
 *
 * F8 integration: the merged catalog is routed through F8's fail-closed
 * `buildRegionPool` (`src/game/pool.ts`) — a place that claims the requested
 * region with the wrong edition throws instead of dealing out-of-region
 * questions. The build-time gate is the primary defense; this is depth.
 */
import type { Edition } from "./run.ts";
import { STARTERS, type Starter } from "./starters.ts";
import { buildRegionPool } from "./pool.ts";
import type { Difficulty } from "./scoring.ts";
// Import attribute: required by Node's module loader (unit tests run under
// node --experimental-strip-types); bundlers accept it as well.
import datasetJson from "./data/generated-places.json" with { type: "json" };

export const GENERATED_SOURCE_LABEL = "Natural Earth";
export const GENERATED_SOURCE_HREF = "https://www.naturalearthdata.com";

interface GeneratedPlaceRecord {
  id: string;
  name: string;
  lon: number;
  lat: number;
  blurb: string;
  curated?: boolean;
  edition?: "state" | "country" | "globe";
  regionId?: string;
}

const dataset = datasetJson as unknown as { places: GeneratedPlaceRecord[] };

/** Starter-shaped view of one generated place. The blurb is the factual one-liner. */
function toStarter(place: GeneratedPlaceRecord & { edition: Edition; regionId: string }): Starter {
  // The dataset carries no difficulty signal; generated places default to
  // medium (3) so the v3 multiplier stays neutral for them.
  const difficulty: Difficulty = 3;
  return {
    id: place.id,
    edition: place.edition,
    regionId: place.regionId,
    name: place.name,
    lon: place.lon,
    lat: place.lat,
    story: place.blurb,
    sourceLabel: GENERATED_SOURCE_LABEL,
    sourceHref: GENERATED_SOURCE_HREF,
    difficulty,
  };
}

/**
 * Generated starters for one edition+region, in dataset order.
 * Curated refs (`curated: true`) are skipped — `starters.ts` is the source of
 * truth for curated places, so they can never double-count.
 */
export function generatedStartersFor(edition: Edition, regionId: string): Starter[] {
  const out: Starter[] = [];
  for (const place of dataset.places) {
    if (place.curated) continue;
    if (place.edition !== edition || place.regionId !== regionId) continue;
    out.push(toStarter(place as GeneratedPlaceRecord & { edition: Edition; regionId: string }));
  }
  return out;
}

/**
 * Every generated (non-curated) record as a Starter, unfiltered.
 * Curated refs (`curated: true`) are skipped — `starters.ts` is the source of
 * truth for curated places, so they can never double-count.
 */
export function allGeneratedStarters(): Starter[] {
  const out: Starter[] = [];
  for (const place of dataset.places) {
    if (place.curated) continue;
    out.push(toStarter(place as GeneratedPlaceRecord & { edition: Edition; regionId: string }));
  }
  return out;
}

/**
 * The full playable catalog: curated starters first, every generated place
 * behind them. Deal sites route this through `buildRegionPool` (fail-closed);
 * the lenient picker count iterates it directly.
 */
export function fullCatalog(): Starter[] {
  return [...STARTERS, ...allGeneratedStarters()];
}

/**
 * The session's dealing pool for one edition+region, via F8's fail-closed
 * `buildRegionPool`: curated starters first, generated starters behind them,
 * and a mis-assigned place throws instead of dealing out-of-region
 * questions. This is what `createDealer` draws from — unchanged F4
 * shuffle/history semantics over a deeper pool.
 */
export function placesFor(edition: Edition, regionId: string): Starter[] {
  return buildRegionPool(fullCatalog(), edition, regionId);
}

/** Total generated (non-curated) places in the checked-in dataset. */
export function generatedPlaceCount(): number {
  let n = 0;
  for (const place of dataset.places) if (!place.curated) n++;
  return n;
}
