import type { LoopNameEntry } from "./types.ts";

/**
 * Wire format of the GeoDetective guess index (public/loop/names.v2.json).
 *
 * The old file was an array of 119k `{n,id,lon,lat,r,p}` objects: every row
 * repeated six keys, the "geonames:" id prefix, and one of only ~285 region
 * strings. This is the same data as parallel columns — region strings
 * interned, ids as bare numbers, coordinates as 1e-4-degree integers — so the
 * file is roughly half the raw size, ~35-47% smaller on the wire, and parses
 * several times faster on a low-end phone.
 *
 * It is lossless by construction: `unpackNameIndex` rebuilds the exact
 * LoopNameEntry rows the typeahead and tap resolver always consumed, so
 * ranking, place-resolve and the engine are untouched. A prefix-sharded index
 * was rejected (docs/ops/specs/ws-6-names-json.md): suggestions match any
 * word or substring ("york" finds "New York") and tap resolution needs every
 * coordinate, so shards would change which results appear.
 */
export const PACKED_NAMES_VERSION = 2;

/** The geonames id prefix every indexed entry carries; stored as a bare number. */
const ID_PREFIX = "geonames:";
/** Coordinates in the index have at most four decimals (see build-loop.mjs). */
const COORD_SCALE = 1e4;

export interface PackedNameIndex {
  v: typeof PACKED_NAMES_VERSION;
  /** Distinct region display strings, referenced by index from `r`. */
  regions: string[];
  n: string[];
  /** GeoNames numeric ids (the part after "geonames:"). */
  id: number[];
  /** Longitude in 1e-4 degrees. */
  lon: number[];
  /** Latitude in 1e-4 degrees. */
  lat: number[];
  /** Index into `regions`. */
  r: number[];
  p: number[];
}

/**
 * Build-time encoder (scripts/build-loop.mjs). Throws rather than rounding:
 * an entry that does not survive the round trip means the index would silently
 * differ from what the pipeline produced.
 */
export function packNameIndex(entries: readonly LoopNameEntry[]): PackedNameIndex {
  const regionIndex = new Map<string, number>();
  const packed: PackedNameIndex = { v: PACKED_NAMES_VERSION, regions: [], n: [], id: [], lon: [], lat: [], r: [], p: [] };
  for (const e of entries) {
    const numericId = e.id.startsWith(ID_PREFIX) ? Number(e.id.slice(ID_PREFIX.length)) : NaN;
    if (!Number.isSafeInteger(numericId) || `${ID_PREFIX}${numericId}` !== e.id) {
      throw new Error(`names pack: id is not geonames:<integer>: ${e.id}`);
    }
    const lon = Math.round(e.lon * COORD_SCALE);
    const lat = Math.round(e.lat * COORD_SCALE);
    if (lon / COORD_SCALE !== e.lon || lat / COORD_SCALE !== e.lat) {
      throw new Error(`names pack: ${e.id} has more than 4 coordinate decimals`);
    }
    if (!Number.isSafeInteger(e.p)) throw new Error(`names pack: ${e.id} population is not an integer`);
    let r = regionIndex.get(e.r);
    if (r === undefined) {
      r = packed.regions.length;
      regionIndex.set(e.r, r);
      packed.regions.push(e.r);
    }
    packed.n.push(e.n);
    packed.id.push(numericId);
    packed.lon.push(lon);
    packed.lat.push(lat);
    packed.r.push(r);
    packed.p.push(e.p);
  }
  return packed;
}

function isIntArray(value: unknown, length: number): value is number[] {
  if (!Array.isArray(value) || value.length !== length) return false;
  for (let i = 0; i < length; i++) if (!Number.isInteger(value[i])) return false;
  return true;
}

/**
 * Runtime decoder. Validates the shape (a truncated or wrong-version file
 * must fail closed, not deal a half index) and rebuilds LoopNameEntry rows.
 */
export function unpackNameIndex(data: unknown): LoopNameEntry[] {
  const fail = (): never => {
    throw new Error("loop names index: unexpected shape");
  };
  if (typeof data !== "object" || data === null) return fail();
  const d = data as Partial<Record<keyof PackedNameIndex, unknown>>;
  if (d.v !== PACKED_NAMES_VERSION) return fail();
  const { regions, n } = d;
  if (!Array.isArray(regions) || !regions.every((r) => typeof r === "string")) return fail();
  if (!Array.isArray(n)) return fail();
  const count = n.length;
  if (!n.every((s) => typeof s === "string")) return fail();
  if (!isIntArray(d.id, count) || !isIntArray(d.lon, count) || !isIntArray(d.lat, count)) return fail();
  if (!isIntArray(d.r, count) || !isIntArray(d.p, count)) return fail();
  const { id, lon, lat, r, p } = d as { id: number[]; lon: number[]; lat: number[]; r: number[]; p: number[] };
  const out: LoopNameEntry[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const region = regions[r[i]];
    if (region === undefined) return fail();
    out[i] = {
      n: n[i] as string,
      id: `${ID_PREFIX}${id[i]}`,
      lon: lon[i] / COORD_SCALE,
      lat: lat[i] / COORD_SCALE,
      r: region as string,
      p: p[i],
    };
  }
  return out;
}
