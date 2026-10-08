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

/** Score bands: the smuggler is "caught" under 300 km. */
export function verdictFor(scoreKm: number): ColdTrailVerdict {
  if (scoreKm <= 100) {
    return {
      title: "Caught red-handed!",
      line: "The intercept team was waiting at the hideout door.",
      caught: true,
    };
  }
  if (scoreKm <= 300) {
    return {
      title: "Warm trail — so close!",
      line: "You had the right neighborhood. One more ring would have done it.",
      caught: true,
    };
  }
  if (scoreKm <= 800) {
    return {
      title: "The trail went cold.",
      line: "You closed in, but the smuggler slipped the net.",
      caught: false,
    };
  }
  return {
    title: "The smuggler vanished.",
    line: "Wrong part of the map entirely. Study the rings and try the next case.",
    caught: false,
  };
}
