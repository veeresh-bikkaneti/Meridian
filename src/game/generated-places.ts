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
 * session. Whole-country runs ("Play the whole United States") additionally
 * fetch every subdivision chunk in parallel — see aggregateChunkIds. The
 * bundler emits one lazy asset per chunk; nothing is fetched
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
import { asFameTier } from "./tier-filter.ts";
import { ADMIN1_BY_COUNTRY } from "./regions.ts";
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
  /**
   * Optional history-first hook sentence (Veeresh's card rule 1+3), sourced
   * from the Wikipedia article intro by scripts/enrich-wikipedia.mjs. It is
   * a verbatim extract sentence minus parentheticals — never rewritten —
   * and the merge-time no-fabrication gate proves every content word came
   * from the source article.
   */
  history?: unknown;
  /**
   * Optional fact-ladder hook (scripts/facts-ladder.mjs): { text, kind,
   * source, qid?, href? }. Takes precedence over `history` in the card
   * composition (see toStarter); the AI fallback treats it like history.
   * Per-kind attribution (Wikidata / EB1911 links) via factAttribution().
   */
  fact?: unknown;
  /**
   * True when the pipeline produced no hook for this record (neither fact
   * nor history, and no curated notable note). The linter flags it; the
   * on-device Nano fallback covers the runtime gap.
   */
  hookMissing?: unknown;
  /** Optional en.wikipedia.org article slug when the blurb carries a curated notable note. */
  wiki?: unknown;
  /**
   * Optional build-time difficulty tier (1–5) stamped by
   * scripts/build-geonames-dataset.mjs. Validated by the prebuild gate;
   * toStarter backfills 3 for missing/hand-edited/bad values.
   */
  difficulty?: unknown;
  /**
   * Optional resolved subdivision display name (state/province), e.g.
   * "Nebraska" or "Madhya Pradesh", stamped by
   * scripts/build-geonames-dataset.mjs from the row's admin1 code.
   * toStarter passes it through only when a non-empty string; the label
   * builder (question-label.ts) fails closed to the bare name otherwise.
   */
  subdivision?: unknown;
  iso2: unknown;
  edition: unknown;
  regionId: unknown;
}

/**
 * Extract the hook sentence from the fact ladder's `fact` field. Mirrors
 * factText() in scripts/card-compose.mjs — the object contract is
 * { text, kind, source, qid?, href? }; a plain string is tolerated.
 */
function factText(fact: unknown): string | null {
  if (typeof fact === "string") {
    const t = fact.trim();
    return t.length >= 20 ? t : null;  }
  if (fact && typeof fact === "object" && "text" in fact && typeof (fact as { text: unknown }).text === "string") {
    const t = ((fact as { text: string }).text).trim();
    return t.length >= 20 ? t : null;
  }
  return null;
}

/**
 * Per-kind source attribution for a fact-ladder fact. Tolerant by design:
 * returns null unless the fact is a well-formed wikidata/eb1911 object, in
 * which case the caller links the actual source (Wikidata entity /
 * Wikisource page). wikitext/hook kinds and anything unrecognized fall
 * through to the caller's default Wikipedia attribution. Never throws —
 * the build-time gate (scripts/check-generated-places.mjs) is the strict
 * layer; the runtime stays fail-closed.
 */
function factAttribution(
  fact: unknown,
  wiki: string | undefined,
): { sourceLabel: string; sourceHref: string } | null {
  if (!fact || typeof fact !== "object") return null;
  const f = fact as { kind?: unknown; qid?: unknown; href?: unknown };
  if (
    f.kind === "wikidata" &&
    typeof f.qid === "string" &&
    /^Q\d+$/.test(f.qid)
  ) {
    return {
      sourceLabel: "Wikidata",
      sourceHref: `https://www.wikidata.org/wiki/${f.qid}`,
    };
  }
  if (
    f.kind === "eb1911" &&
    typeof f.href === "string" &&
    f.href.startsWith("https://en.wikisource.org/")
  ) {
    return { sourceLabel: "EB1911", sourceHref: f.href };
  }
  // Wikipedia-sourced facts (wikitext/hook) may carry their own article href
  // when the chunk has no wiki slug — use it so the CC BY-SA attribution
  // still links the source article. Only en.wikipedia.org URLs accepted.
  if (
    (f.kind === "wikitext" || f.kind === "hook") &&
    typeof f.href === "string" &&
    /^https:\/\/en\.wikipedia\.org\/wiki\//.test(f.href)
  ) {
    return { sourceLabel: "GeoNames · Wikipedia", sourceHref: f.href };
  }
  return null;
}

/** Starter-shaped view of one validated generated place. The blurb is the factual one-liner. */
function toStarter(
  place: {
    id: string;
    name: string;
    lon: number;
    lat: number;
    blurb: string;
    history?: string;
    wiki?: string;
    fact?: unknown;
    /** ISO-3166-1 alpha-2 country code — validated non-empty by assertValidRecord; threaded onto the Starter for question disambiguation labels. */
    iso2: string;
    /**
     * Optional build-time difficulty tier (1–5) stamped by
     * scripts/build-geonames-dataset.mjs. Preferred when valid; toStarter
     * backfills 3 for missing/hand-edited/bad values.
     */
    difficulty?: unknown;
    /**
     * Optional resolved subdivision display name (state/province) stamped
     * by scripts/build-geonames-dataset.mjs. Passed through only when a
     * non-empty string — the label builder fails closed otherwise.
     */
    subdivision?: unknown;
  },  edition: Edition,
  regionId: string,
): Starter {
  // Difficulty: prefer the pipeline-stamped tier when it is a valid integer
  // 1–5. Anything else — missing on legacy chunks, hand-edited, or corrupt
  // — falls back to medium (3) so the v3 multiplier stays neutral. The
  // guard lives in tier-filter.ts (asFameTier): one field, one semantic.
  const difficulty: Difficulty = asFameTier(place.difficulty);
  // Subdivision: the pipeline stamps the resolved display name ("Nebraska",
  // "Madhya Pradesh") for the PR #38 label rules. Pass it through only when
  // it is a non-empty string; missing/blank/hand-edited values are dropped
  // so question-label.ts fails closed to the bare place name.
  const subdivision =
    typeof place.subdivision === "string" && place.subdivision.trim().length > 0
      ? place.subdivision
      : undefined;
  // Notable notes are curated from Wikipedia; the slug travels in the chunk
  // so the card can attribute it (GeoNames stays credited app-wide).
  const hasWiki = typeof place.wiki === "string" && place.wiki.length > 0;
  // Card rule 1: history first, modern identity second. The hook sentence
  // leads; the plain-geography blurb anchors it. Precedence: fact-ladder
  // fact > Wikipedia history hook > bare geographic blurb (same order as
  // composeCardStory() in scripts/card-compose.mjs).
  const hook = factText(place.fact) ?? (typeof place.history === "string" && place.history.length > 0 ? place.history : null);  const hasHistory = typeof place.history === "string" && place.history.length > 0;
  return {
    id: place.id,
    edition,
    regionId,
    name: place.name,
    lon: place.lon,
    lat: place.lat,
    story: hook ? `${hook} ${place.blurb}` : place.blurb,
    // The history hook travels separately so the AI story fallback can tell
    // enriched cards (skip) from blurb-only cards (fire).
    history: hasHistory ? place.history : undefined,
    // The fact text travels too — the AI fallback treats a non-empty fact
    // the same as history (skip). Null when absent, never the raw object.
    fact: factText(place.fact),
    // Per-kind attribution: a well-formed wikidata/eb1911 fact links its
    // actual source; everything else keeps the existing Wikipedia behavior.
    ...(factAttribution(place.fact, place.wiki) ?? {
      sourceLabel: hasWiki ? "GeoNames · Wikipedia" : GENERATED_SOURCE_LABEL,
      sourceHref: hasWiki
        ? `https://en.wikipedia.org/wiki/${place.wiki}`
        : GENERATED_SOURCE_HREF,
    }),    difficulty,
    // The subdivision display name travels only when the pipeline stamped a
    // real one — absent means unknown, and the label builder fails closed.
    ...(subdivision !== undefined ? { subdivision } : {}),
    iso2: place.iso2,
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
  history?: string;
  fact?: unknown;
  hookMissing?: boolean;  wiki?: string;
  /**
   * Optional build-time difficulty tier (1–5). Validated shape-wise by the
   * prebuild gate (scripts/check-generated-places.mjs); toStarter falls
   * back to 3 for any non-integer/out-of-range value, so this is
   * grandfathered, never a hard error here.
   */
  difficulty?: unknown;
  /**
   * Optional resolved subdivision display name. Shape-checked by the
   * prebuild gate; toStarter drops anything that isn't a non-empty string,
   * so this is grandfathered, never a hard error here.
   */
  subdivision?: unknown;
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
  // History hook sentences are shape-checked here. Wikipedia-extract
  // histories were proved verbatim by the merge-time gate
  // (scripts/enrich-wikipedia.mjs validateHistory); curated notable notes
  // (src/game/data/notable-notes.json) are Veeresh-approved instead. Both
  // travel in `history`, so the length bound fits the longest curated note
  // (512 chars) rather than a single extract sentence: it guards against
  // hand-edited corruption (bounds, terminal punctuation, no filler), not
  // brevity — brevity is the curator's and the linter's job. A history
  // sentence must always travel with its wiki slug — unattributed CC BY-SA
  // text would otherwise render under the plain "GeoNames" label.
  if (record.history !== undefined) {
    const h = record.history;
    const okShape =
      typeof h === "string" && h.length >= 20 && h.length <= 600 && /[.!?]$/.test(h.trim());
    const hasFiller =
      typeof h === "string" &&
      (/°/.test(h) || /\belevation\b/i.test(h) || /\bpopulation\b/i.test(h) || /\bcensus\b/i.test(h));
    const hasWiki =
      typeof record.wiki === "string" && record.wiki.length > 0;
    if (!okShape || hasFiller || !hasWiki) {
      throw new Error(`${where}: invalid history hook sentence`);
    }
  }
  // Merged facts (scripts/facts-ladder.mjs): the merge-time no-fabrication
  // gate proved each one; the runtime below guards against hand-edited
  // corruption tolerantly (never throws on a bad fact).
  if (record.wiki !== undefined && (typeof record.wiki !== "string" || record.wiki.length === 0)) {
    throw new Error(`${where}: invalid wiki slug`);
  }
  // The fact-ladder field is { text, kind, source, qid?, href? } (or a plain
  // string, tolerated). Guard against hand-edited corruption; the ladder's
  // own validator proved the text before merge.
  if (record.fact !== undefined && record.fact !== null) {
    const f = record.fact;
    const text = typeof f === "string" ? f : typeof f === "object" && f !== null && "text" in f ? (f as { text: unknown }).text : undefined;
    if (typeof text !== "string" || text.trim().length < 20) {
      throw new Error(`${where}: invalid fact hook`);
    }
  }
  // hookMissing is a pipeline marker (scripts/card-compose.mjs): boolean
  // true only. Its absence on legacy records is grandfathered, never an
  // error.
  if (record.hookMissing !== undefined && record.hookMissing !== true) {
    throw new Error(`${where}: invalid hookMissing marker`);
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
 * Whole-country aggregation: which chunk files make up one edition+region's
 * generated pool.
 *
 * "Play the whole <country>" deals from the country's own chunk PLUS every
 * subdivision dataset — never the country chunk alone. The united-states
 * country chunk holds 55 generated places, 54 of them District of Columbia
 * neighborhoods; a whole-US run drawn from it alone is overwhelmingly
 * DC-centric. Folding in the 50 state chunks (14,201 places) makes the
 * national run actually national. The subdivision list is the picker's own
 * drill-down source of truth (ADMIN1_BY_COUNTRY), so the pool and the menu
 * can never disagree about what "the whole country" contains.
 *
 * Fail-closed: every listed chunk id must exist in the manifest — a missing
 * subdivision chunk rejects the whole pool (via loadRegionChunk) instead of
 * dealing a silently partial country. A unit test locks this wiring.
 */
export function aggregateChunkIds(edition: Edition, regionId: string): string[] {
  if (edition !== "country") return [regionId];
  const subdivisions = ADMIN1_BY_COUNTRY[regionId] ?? [];
  if (subdivisions.length === 0) return [regionId];
  return [regionId, ...subdivisions.map((s) => s.id)];
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
 *
 * Note: this is the single-chunk accessor (used by tests and tooling).
 * Whole-country runs must go through `placesFor`, which aggregates
 * subdivision chunks — this function knows nothing about aggregation.
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
 *
 * Whole-country runs aggregate subdivision chunks (see aggregateChunkIds):
 * subdivision places are re-tagged to the country's edition/regionId so the
 * fail-closed pool build accepts them. Identity (id, coordinates, blurb,
 * source) is untouched; chunk ids are globally unique (build-time gate +
 * unit tests), so re-tagging cannot collide, duplicate, or misplace a
 * question. The Hyderabad rule holds: coordinates still match the claimed
 * location because re-tagging only widens the region to the true parent.
 */
export async function placesFor(edition: Edition, regionId: string): Promise<Starter[]> {
  const chunkIds = aggregateChunkIds(edition, regionId);
  // All chunks load in parallel; one missing/malformed chunk rejects the
  // whole pool — never a partial country.
  const chunks = await Promise.all(chunkIds.map((id) => loadRegionChunk(id)));
  const generated: Starter[] = [];
  for (let i = 0; i < chunkIds.length; i++) {
    const chunkId = chunkIds[i];
    for (const starter of chunks[i]) {
      if (chunkId === regionId) {
        // The country's own chunk: keep the defense-in-depth filter.
        if (starter.edition === edition && starter.regionId === regionId) generated.push(starter);
      } else {
        // Folded-in subdivision place: keep the native region as a
        // display-only origin so UI labels (sports-AI city query) retain
        // state-level disambiguation after the dealing re-tag.
        generated.push({ ...starter, edition, regionId, originRegionId: starter.regionId });
      }
    }
  }
  return buildRegionPool([...STARTERS, ...generated], edition, regionId);
}

/**
 * Lenient picker count for one edition+region: curated starters plus the
 * manifest's generated count — summed over every aggregated chunk for
 * whole-country runs. The manifest is the static index — this never
 * loads a chunk. The build-time gate + unit tests lock manifest counts to
 * real chunk contents, so this equals the true pool size.
 */
export function poolSizeFor(edition: Edition, regionId: string): number {
  let count = 0;
  for (const s of STARTERS) {
    if (s.edition === edition && s.regionId === regionId) count++;
  }
  const regions = manifest.regions;
  for (const chunkId of aggregateChunkIds(edition, regionId)) {
    const region = Object.hasOwn(regions, chunkId) ? regions[chunkId] : undefined;
    // The primary chunk counts only when its edition matches the request;
    // subdivision chunks are always folded into the whole-country pool.
    // Invariant: every aggregated chunk id exists in the manifest (locked by
    // unit test). If a future country lists a subdivision whose chunk is
    // missing, placesFor fails closed at run start while this count would
    // skip it — so keep the wiring test green before plugging a new
    // country into ADMIN1_BY_COUNTRY.
    if (region && (chunkId !== regionId || region.edition === edition)) count += region.count;
  }
  return count;
}

/** Total generated places across all shipped chunks (manifest sum — no chunk loads). */
export function generatedPlaceCount(): number {
  let total = 0;
  for (const region of Object.values(manifest.regions)) total += region.count;
  return total;
}
