/**
 * hint-logic.ts — pure hint mechanics (follow-up Item A).
 *
 * The hint itself is a mechanical directional nudge computed from the
 * place's coordinates vs the region bounds — no curated data, no
 * fabrication, and coarse enough to never pinpoint the answer.
 * Hints NEVER touch points (scoring is identical across bands).
 */

/**
 * Which quadrant of the region the place sits in, relative to the region
 * bounds center. Picks the stronger axis so the nudge is decisive.
 */
export function directionalHint(
  lon: number,
  lat: number,
  bounds: [number, number, number, number],
): string {
  const [west, south, east, north] = bounds;
  const centerLon = (west + east) / 2;
  const centerLat = (south + north) / 2;
  const lonSpan = Math.max(east - west, 0.001);
  const latSpan = Math.max(north - south, 0.001);
  // Normalized offset: pick the stronger axis so the nudge is decisive.
  const lonOff = (lon - centerLon) / lonSpan;
  const latOff = (lat - centerLat) / latSpan;
  if (Math.abs(latOff) >= Math.abs(lonOff)) {
    return latOff >= 0
      ? "Look toward the northern part of the map!"
      : "Look toward the southern part of the map!";
  }
  return lonOff >= 0
    ? "Look toward the eastern part of the map!"
    : "Look toward the western part of the map!";
}
