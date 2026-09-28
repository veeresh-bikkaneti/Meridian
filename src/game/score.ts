import type { RingId } from "./types.ts";

export const SCORING_VERSION = 1 as const;

export const RINGS: Record<
  RingId,
  { r0: number; s: number; label: string; halfKm: number }
> = {
  lincoln: { r0: 0.25, s: 1.5, label: "Lincoln", halfKm: 1.3 },
  region: { r0: 1, s: 8, label: "Around Lincoln", halfKm: 6.5 },
  nebraska: { r0: 3, s: 30, label: "Nebraska", halfKm: 24 },
  usa: { r0: 10, s: 150, label: "United States", halfKm: 114 },
  world: { r0: 25, s: 1200, label: "World", halfKm: 860 },
};

export function scoreDistance(distanceKm: number, ring: RingId): number {
  const { r0, s } = RINGS[ring];
  if (distanceKm <= r0) return 100;
  const raw = 100 * Math.exp(-(distanceKm - r0) / s);
  return Math.max(0, Math.min(100, Math.round(raw)));
}
