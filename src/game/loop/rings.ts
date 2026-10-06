/**
 * Deduction-surface geometry for the GeoDetective map (Option A).
 *
 * After each miss the map draws, around the guessed place:
 * - an exact-km distance ring (the target lies somewhere ON it),
 * - a direction arrow toward the target (exact bearing, not the 8-wind
 *   octant — the map deserves the precision the list view rounds),
 * - an ✕ marker + "searched" shading on the guessed place itself.
 *
 * Two rings triangulate: their intersection is the target's neighborhood.
 * Rings are exact, never fuzzy — fairness and the "I'm getting smarter"
 * feeling depend on it (brainstorm design lock).
 */

export type LngLat = [number, number];

const EARTH_KM = 6371;

/** Destination point: travel distKm from (lon, lat) on bearingDeg. */
export function destination(lon: number, lat: number, bearingDeg: number, distKm: number): LngLat {
  const d = distKm / EARTH_KM;
  const br = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const sinLat2 =
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(br);
  const lat2 = Math.asin(Math.max(-1, Math.min(1, sinLat2)));
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(br) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );
  const lonDeg = (((lon2 * 180) / Math.PI + 540) % 360) - 180;
  return [lonDeg, (lat2 * 180) / Math.PI];
}

/** Circle polygon centered on (lon, lat) with radiusKm radius.
 *
 * Longitudes are unwrapped (kept continuous, allowed outside ±180) so a
 * planet-scale ring doesn't tear at the antimeridian: `destination`
 * normalizes to [-180, 180], which turns a big circle into a polygon with
 * a 350°+ jump that the tile worker silently drops (observed: an 8,764 km
 * ring produced zero features). The renderer wraps out-of-range
 * longitudes correctly.
 */
export function ringPolygon(lon: number, lat: number, radiusKm: number, steps = 72): GeoJSON.Polygon {
  const ring: LngLat[] = [];
  let prevLon = lon;
  for (let i = 0; i <= steps; i++) {
    let [lo, la] = destination(lon, lat, (i * 360) / steps, radiusKm);
    while (lo - prevLon > 180) lo -= 360;
    while (lo - prevLon < -180) lo += 360;
    ring.push([lo, la]);
    prevLon = lo;
  }
  return { type: "Polygon", coordinates: [ring] };
}

export interface ArrowGeometry {
  /** Shaft: guessed place → toward the target. */
  shaft: GeoJSON.LineString;
  /** Head: two barbs at the tip. */
  head: GeoJSON.LineString;
}

/**
 * Direction arrow from the guessed place toward the target.
 * Length is a fraction of the miss distance so the arrow lives inside its
 * ring; the head scales with the shaft but never below a visible minimum.
 */
export function guessArrow(
  lon: number,
  lat: number,
  bearingDeg: number,
  distKm: number,
): ArrowGeometry {
  const lengthKm = Math.max(distKm * 0.3, 1);
  const tip = destination(lon, lat, bearingDeg, lengthKm);
  const headLenKm = Math.max(lengthKm * 0.18, 40);
  const left = destination(tip[0], tip[1], bearingDeg + 155, headLenKm);
  const right = destination(tip[0], tip[1], bearingDeg - 155, headLenKm);
  return {
    shaft: { type: "LineString", coordinates: [[lon, lat], tip] },
    head: { type: "LineString", coordinates: [left, tip, right] },
  };
}
