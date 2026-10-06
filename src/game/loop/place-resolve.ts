import { distanceKm } from "../geo.ts";
import type { LoopNameEntry } from "./types.ts";

/**
 * Tap → labeled-place resolution for the GeoDetective map.
 *
 * The Esri reference tiles are raster: the map cannot tell us which label
 * the player tapped. Instead we resolve the tap against our own guess
 * index (public/loop/names.json, 119k entries) with a grid spatial index:
 * the nearest indexed place within the tap tolerance wins. The bottom
 * sheet always shows the resolved place's real name, so a near-miss
 * resolution is honest, never a silent wrong pick — and taps far from any
 * place (ocean) resolve to nothing, per the fail-closed rule.
 */

export interface PlaceGrid {
  /** Cell size in degrees. */
  cell: number;
  /** "x,y" cell key → indices into the entries array. */
  cells: Map<string, number[]>;
}

function cellKey(lon: number, lat: number, cell: number): string {
  // Wrap longitude so the antimeridian doesn't split the index.
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;
  const x = Math.floor((wrapped + 180) / cell);
  const y = Math.floor((lat + 90) / cell);
  return `${x},${y}`;
}

/** Build the grid once per index load; queries are O(nearby cells). */
export function buildPlaceGrid(entries: LoopNameEntry[], cell = 2): PlaceGrid {
  const cells = new Map<string, number[]>();
  entries.forEach((entry, i) => {
    const key = cellKey(entry.lon, entry.lat, cell);
    const bucket = cells.get(key);
    if (bucket) bucket.push(i);
    else cells.set(key, [i]);
  });
  return { cell, cells };
}

/**
 * Nearest indexed place to (lon, lat) within maxDistKm, or null.
 * Rectangular cell search: correct (never misses a closer place) and
 * bounded by maxDistKm. Longitude cells shrink with cos(lat), so the
 * x-radius is widened at high latitudes (above ~70° the equatorial bound
 * would miss places inside the tap tolerance).
 * Ties (equidistant) prefer the higher-population entry.
 */
export function nearestPlace(
  grid: PlaceGrid,
  entries: LoopNameEntry[],
  lon: number,
  lat: number,
  maxDistKm: number,
): LoopNameEntry | null {
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || maxDistKm <= 0) return null;
  const { cell, cells } = grid;
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;
  const cx = Math.floor((wrapped + 180) / cell);
  const cy = Math.floor((lat + 90) / cell);
  // 1° of latitude ≈ 111.32 km; longitude degrees shrink with cos(lat).
  const cosLat = Math.max(Math.cos((lat * Math.PI) / 180), 0.1);
  const ringsY = Math.ceil(maxDistKm / (cell * 111.32)) + 1;
  const ringsX = Math.ceil(maxDistKm / (cell * 111.32 * cosLat)) + 1;
  const xCells = Math.ceil(360 / cell);

  let best: LoopNameEntry | null = null;
  let bestDist = maxDistKm;
  for (let dx = -ringsX; dx <= ringsX; dx++) {
    for (let dy = -ringsY; dy <= ringsY; dy++) {
      const x = (((cx + dx) % xCells) + xCells) % xCells;
      const bucket = cells.get(`${x},${cy + dy}`);
      if (!bucket) continue;
      for (const i of bucket) {
        const entry = entries[i]!;
        const d = distanceKm([lon, lat], [entry.lon, entry.lat]);
        if (d < bestDist || (d === bestDist && best !== null && entry.p > best.p)) {
          bestDist = d;
          best = entry;
        }
      }
    }
  }
  return best;
}
