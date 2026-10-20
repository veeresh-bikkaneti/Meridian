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

/** A quarter of Earth's circumference (~10,007.5 km) — the largest ring
 *  radius that still traces a loop around its own centre. */
export const QUARTER_CIRCUMFERENCE_KM = (Math.PI / 2) * EARTH_KM;

/** Half of Earth's circumference (~20,015 km) — the longest possible
 *  distance between two points on the surface. */
export const HALF_CIRCUMFERENCE_KM = Math.PI * EARTH_KM;

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
 *
 * Rings wider than a quarter of the planet take the antipode reframe
 * below instead of tracing from (lon, lat) directly.
 */
export function ringPolygon(lon: number, lat: number, radiusKm: number, steps = 72): GeoJSON.Polygon {
  if (radiusKm > QUARTER_CIRCUMFERENCE_KM) {
    // Far-ring reframe (issue #166). A circle wider than a quarter of the
    // planet is the SAME set of points as a small circle around the
    // antipode — the spot exactly opposite on the globe — with radius
    // HALF − radiusKm. Tracing the big circle from the guess makes the
    // bearing walk loop around the antipode anyway, and its unwrapped
    // longitudes strand that loop in a repeated world copy, half a planet
    // from the tap. Tracing the small circle from the antipode draws the
    // identical ring in the world copy where the target actually lives.
    // (Distances arrive from geo.ts, which uses a hair larger Earth
    // radius, so a near-perfect antipodal miss can land a few metres
    // over HALF — clamp that residue to a 1 km loop, the honest picture
    // of "the answer is basically the opposite side of the Earth".)
    const antipodeLon = (((lon + 180) + 540) % 360) - 180;
    const reframedKm = Math.max(HALF_CIRCUMFERENCE_KM - radiusKm, 1);
    return ringPolygon(antipodeLon, -lat, reframedKm, steps);
  }
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
  // Head scales with the shaft and never below a visible minimum — but
  // stays proportionate (a 40 km floor on a 1.5 km shaft is just a V).
  const headLenKm = Math.max(lengthKm * 0.35, 0.5);
  const left = destination(tip[0], tip[1], bearingDeg + 155, headLenKm);
  const right = destination(tip[0], tip[1], bearingDeg - 155, headLenKm);
  return {
    shaft: { type: "LineString", coordinates: [[lon, lat], tip] },
    head: { type: "LineString", coordinates: [left, tip, right] },
  };
}
