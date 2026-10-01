/**
 * generated-places.ts — the GeoNames 100k+ place dataset, loaded lazily
 * per region.
 *
 * Provenance: `src/game/data/geonames/chunks/<regionId>.json` are the
 * pipeline build output (124,690 GeoNames populated places, CC-BY 4.0),
 * built by `scripts/build-geonames-dataset.mjs`; `manifest.json` is the
 * small per-region index. The build-time gate
 * (`scripts/check-generated-places.mjs`, wired as `prebuild`) re-validates
 * 100% of shipped chunk places on every build — the Hyderabad rule holds
 * for generated content exactly as it does for curated.
 *
 * Loading design: chunks are NEVER imported statically. The chunk for the
 * player's chosen region is fetched with a dynamic `import()` the first
 * time it is needed (region selection), then cached in memory for the
 * session. The bundler emits one lazy asset per chunk; nothing is fetched
 * before region selection. Picker counts come from the small
 * statically-imported manifest — chunks are never loaded just to count.
 *
 * Dealing contract (approach C, curated-first hybrid): the hand-curated
 * starters are the foundation of every pool — they are never displaced by
 * generated content. Generated places fill depth behind them. The F4 dealer
 * (`trail.ts`) shuffles the pool uniformly, so "curated first" is inclusion
 * priority, not deal order; no dealing mechanics change here.
 *
 * F8 integration: the merged pool is routed through F8's fail-closed
 * `buildRegionPool` (`src/game/pool.ts`) — a place that claims the requested
 * region with the wrong edition throws instead of dealing out-of-region
 * questions. The build-time gate is the primary defense; this is depth.
 * Chunk loading itself is fail-closed too: an unknown region, a missing
 * chunk, or a single malformed record rejects the whole load — the caller
 * (game-app) must never start a run with a partial or missing pool.
 */
import type { Edition } from "./run.ts";
import { STARTERS, type Starter } from "./starters.ts";
import { buildRegionPool } from "./pool.ts";
import type { Difficulty } from "./scoring.ts";
// Import attribute: required by Node's module loader (unit tests run under
// node --experimental-strip-types); bundlers accept it as well. The manifest
// is ~7 KB — the only generated-data file in the initial bundle.
import manifestJson from "./data/geonames/manifest.json" with { type: "json" };

export const GENERATED_SOURCE_LABEL = "GeoNames";
export const GENERATED_SOURCE_HREF = "https://www.geonames.org/";

interface ManifestRegion {
  edition: Edition;
  count: number;
  bytes: number;
}

const manifest = manifestJson as unknown as {
  meta: { total: number };
  regions: Record<string, ManifestRegion>;
};

/** One raw place record as shipped in a chunk. `edition`/`regionId` are validated, not trusted. */
interface ChunkPlaceRecord {
  id: unknown;
  name: unknown;
  lon: unknown;
  lat: unknown;
  blurb: unknown;
  /** Optional en.wikipedia.org article slug when the blurb carries a curated notable note. */
  wiki?: unknown;
  iso2: unknown;
  edition: unknown;
  regionId: unknown;
}

/** Starter-shaped view of one validated generated place. The blurb is the factual one-liner. */
function toStarter(
  place: { id: string; name: string; lon: number; lat: number; blurb: string; wiki?: string },
  edition: Edition,
  regionId: string,
): Starter {
  // The dataset carries no difficulty signal; generated places default to
  // medium (3) so the v3 multiplier stays neutral for them.
  const difficulty: Difficulty = 3;
  // Notable notes are curated from Wikipedia; the slug travels in the chunk
  // so the card can attribute it (GeoNames stays credited app-wide).
  const hasWiki = typeof place.wiki === "string" && place.wiki.length > 0;
  return {
    id: place.id,
    edition,
    regionId,
    name: place.name,
    lon: place.lon,
    lat: place.lat,
    story: place.blurb,
    sourceLabel: hasWiki ? "GeoNames · Wikipedia" : GENERATED_SOURCE_LABEL,
    sourceHref: hasWiki ? `https://en.wikipedia.org/wiki/${place.wiki}` : GENERATED_SOURCE_HREF,
    difficulty,
  };
}

/**
 * Fail-closed narrowing: chunks are data, not types — a hand-edited record
 * with a bad id/coords/edition/regionId must throw loudly here, never sail
 * through a cast into the dealing pool. (The prebuild gate + unit tests
 * validate the checked-in data, so reaching this throw means the gate itself
 * was bypassed.)
 */
function assertValidRecord(
  record: ChunkPlaceRecord,
  regionId: string,
  edition: Edition,
): asserts record is {
  id: string;
  name: string;
  lon: number;
  lat: number;
  blurb: string;
  wiki?: string;
  iso2: string;
  edition: Edition;
  regionId: string;
} {
  const where = `GeoNames chunk "${regionId}" record ${JSON.stringify(record.id)}`;
  if (typeof record.id !== "string" || record.id.length === 0) {
    throw new Error(`${where}: invalid id`);
  }
  if (typeof record.name !== "string" || record.name.length === 0) {
    throw new Error(`${where}: invalid name`);
  }
  if (!Number.isFinite(record.lon) || !Number.isFinite(record.lat)) {
    throw new Error(`${where}: invalid coordinates`);
  }
  if (typeof record.blurb !== "string" || record.blurb.length === 0) {
    throw new Error(`${where}: invalid blurb`);
  }
  if (record.wiki !== undefined && (typeof record.wiki !== "string" || record.wiki.length === 0)) {
    throw new Error(`${where}: invalid wiki slug`);
  }
  if (typeof record.iso2 !== "string" || record.iso2.length === 0) {
    throw new Error(`${where}: invalid iso2`);
  }
  if (record.edition !== edition) {
    throw new Error(
      `${where}: edition ${JSON.stringify(record.edition)} does not match chunk edition "${edition}"`,
    );
  }
  if (record.regionId !== regionId) {
    throw new Error(
      `${where}: regionId ${JSON.stringify(record.regionId)} does not match chunk "${regionId}"`,
    );
  }
}

/**
 * Fail-closed region check: only manifest-listed regions may be loaded.
 * This doubles as path-traversal protection for the dynamic import below —
 * a regionId that is not a real chunk name can never become a file path.
 */
function manifestRegionFor(regionId: string): ManifestRegion {
  const region = Object.hasOwn(manifest.regions, regionId) ? manifest.regions[regionId] : undefined;
  if (!region) {
    throw new Error(`unknown GeoNames region "${regionId}" — refusing to load a chunk`);
  }
  return region;
}

/**
 * Validate a loaded chunk wholesale and convert it to Starters.
 * A single bad record rejects the ENTIRE chunk — partial pools never deal.
 * Exported for unit tests (fail-closed record validation).
 */
export function startersFromChunk(regionId: string, chunk: unknown): Starter[] {
  const { edition } = manifestRegionFor(regionId);
  const rec = chunk as { meta?: { regionId?: unknown; edition?: unknown; count?: unknown }; places?: unknown };
  if (rec?.meta?.regionId !== regionId) {
    throw new Error(`GeoNames chunk "${regionId}": meta.regionId mismatch`);
  }
  if (rec?.meta?.edition !== edition) {
    throw new Error(`GeoNames chunk "${regionId}": meta.edition mismatch`);
  }
  if (!Array.isArray(rec?.places)) {
    throw new Error(`GeoNames chunk "${regionId}": places is not an array`);
  }
  if (rec.meta?.count !== rec.places.length) {
    throw new Error(
      `GeoNames chunk "${regionId}": meta.count ${JSON.stringify(rec.meta?.count)} !== places.length ${rec.places.length} — refusing a truncated chunk`,
    );
  }
  const out: Starter[] = [];
  for (const record of rec.places as ChunkPlaceRecord[]) {
    assertValidRecord(record, regionId, edition);
    out.push(toStarter(record, record.edition, record.regionId));
  }
  return out;
}

/**
 * Per-region chunk cache: regionId → in-flight or resolved load.
 * A failed load is evicted so a later retry re-attempts the fetch instead
 * of serving a cached rejection.
 */
const chunkCache = new Map<string, Promise<Starter[]>>();

/**
 * Load the generated starters for one region, fetching its chunk on first
 * use. Rejects fail-closed on unknown region, missing chunk, or malformed
 * data — callers must NOT start a run when this rejects.
 */
export async function loadRegionChunk(regionId: string): Promise<Starter[]> {
  // Fail fast on unknown regions: no network/file fetch is attempted.
  manifestRegionFor(regionId);
  let pending = chunkCache.get(regionId);
  if (!pending) {
    pending = import(`./data/geonames/chunks/${regionId}.json`, { with: { type: "json" } })
      .then((mod) => startersFromChunk(regionId, (mod as { default: unknown }).default))
      .catch((err: unknown) => {
        chunkCache.delete(regionId);
        throw new Error(`failed to load GeoNames chunk "${regionId}": ${(err as Error).message}`, {
          cause: err,
        });
      });
    chunkCache.set(regionId, pending);
  }
  return pending;
}

/** Test hook: drop cached chunks so tests can observe fresh loads. */
export function clearChunkCacheForTests(): void {
  chunkCache.clear();
}

/**
 * Generated starters for one edition+region, in chunk order.
 * The chunk is homogeneous by construction; the filter is defense in depth
 * (a record that survived validation but mismatches is dropped, never dealt).
 */
export async function generatedStartersFor(edition: Edition, regionId: string): Promise<Starter[]> {
  const starters = await loadRegionChunk(regionId);
  return starters.filter((s) => s.edition === edition && s.regionId === regionId);
}

/**
 * The session's dealing pool for one edition+region, via F8's fail-closed
 * `buildRegionPool`: curated starters first, generated starters behind them,
 * and a mis-assigned place throws instead of dealing out-of-region
 * questions. This is what `createDealer` draws from — unchanged F4
 * shuffle/history semantics over a deeper pool.
 */
export async function placesFor(edition: Edition, regionId: string): Promise<Starter[]> {
  const generated = await generatedStartersFor(edition, regionId);
  return buildRegionPool([...STARTERS, ...generated], edition, regionId);
}

/**
 * Lenient picker count for one edition+region: curated starters plus the
 * manifest's generated count. The manifest is the static index — this never
 * loads a chunk. The build-time gate + unit tests lock manifest counts to
 * real chunk contents, so this equals the true pool size.
 */
export function poolSizeFor(edition: Edition, regionId: string): number {
  let count = 0;
  for (const s of STARTERS) {
    if (s.edition === edition && s.regionId === regionId) count++;
  }
  const region = Object.hasOwn(manifest.regions, regionId) ? manifest.regions[regionId] : undefined;
  if (region && region.edition === edition) count += region.count;
  return count;
}

/** Total generated places across all shipped chunks (manifest sum — no chunk loads). */
export function generatedPlaceCount(): number {
  let total = 0;
  for (const region of Object.values(manifest.regions)) total += region.count;
  return total;
}
