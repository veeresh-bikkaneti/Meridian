const SIDE_FRACTION = 0.12;
const GLOBE_RADIUS_KM = 750;

const RADIUS_LIMITS = {
  state: { minKm: 25, maxKm: 160 },
  country: { minKm: 40, maxKm: 450 },
} as const;

/** 12% of the region's greater side, clamped by edition. Globe is always 750 km. */
export function radiusKm(edition: "state" | "country" | "globe", greaterSideKm: number): number {
  if (edition === "globe") return GLOBE_RADIUS_KM;
  const { minKm, maxKm } = RADIUS_LIMITS[edition];
  const rawKm = greaterSideKm * SIDE_FRACTION;
  return Math.min(maxKm, Math.max(minKm, rawKm));
}

/** A distance equal to the radius continues the run. Anything greater ends it. */
export function isHit(distanceKm: number, radiusKm: number): boolean {
  return distanceKm <= radiusKm;
}

import { findRegion, greaterSideKm as regionGreaterSideKm } from "./regions.ts";

/**
 * The whole-kilometre challenge radius for one named region (manifest
 * 2026-10-28): the same 12%-of-greater-side rule as radiusKm, pinned to
 * an integer so a radius can travel inside a challenge link and print on
 * the welcome card. Returns null for an unknown region — callers treat
 * that as "this build cannot host that challenge" and fail closed.
 */
export function regionRadiusKm(
  edition: "state" | "country" | "globe",
  regionId: string,
): number | null {
  const region = findRegion(edition, regionId);
  if (!region) return null;
  if (edition === "globe") return GLOBE_RADIUS_KM;
  return Math.round(radiusKm(edition, regionGreaterSideKm(region.bounds)));
}
