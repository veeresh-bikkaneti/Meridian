import { distanceKm } from "../geo.ts";
import type { ColdTrailSighting } from "./types.ts";

/**
 * Cold Trail pure game logic. No storage, no React — everything here is a
 * pure function over the case data, so the slice's rules are unit-testable
 * in isolation.
 */

/** The paid informant tightens one ring to half its radius, for 1 star. */
export const INFORMANT_COST = 1;
/** Stars earned for closing a case (any score). */
export const SOLVE_REWARD = 1;
/** Stars the slice seeds a fresh wallet with. */
export const STARTING_STARS = 2;

/** Ring radius the map draws: halved while the informant is on it. */
export function effectiveRadius(sighting: ColdTrailSighting, informantOn: boolean): number {
  return informantOn ? sighting.radiusKm / 2 : sighting.radiusKm;
}

/** Score: km from the interception tap to the true hideout, rounded. */
export function scoreIntercept(
  guessLon: number,
  guessLat: number,
  hideoutLon: number,
  hideoutLat: number,
): number {
  return Math.round(distanceKm([guessLon, guessLat], [hideoutLon, hideoutLat]));
}

export interface ColdTrailVerdict {
  /** Short verdict line for the reveal card. */
  title: string;
  /** One-line color commentary. */
  line: string;
  /** True for a genuinely good interception (drives the win sound). */
  caught: boolean;
}

/** Score band for a score in km: the guess "catches" in bands 0–1 (≤300 km).
 * Cut points are verbatim from the old verdictFor; the per-theme verdict
 * strings live in themes.ts (verdictForTheme). */
export function scoreBand(scoreKm: number): 0 | 1 | 2 | 3 {
  if (scoreKm <= 100) return 0;
  if (scoreKm <= 300) return 1;
  if (scoreKm <= 800) return 2;
  return 3;
}
