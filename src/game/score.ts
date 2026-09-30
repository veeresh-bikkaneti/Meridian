import type { RingId } from "./types.ts";

/** MapTap's live distance curve. https://maptap.gg/faq */
export const DECAY = 3.5;
export const WORLD_SPAN_KM = 16250;

export const RINGS: Record<RingId, { spanKm: number; label: string }> = {
  lincoln: { spanKm: 80, label: "Lincoln" },
  region: { spanKm: 250, label: "Around Lincoln" },
  nebraska: { spanKm: 900, label: "Nebraska" },
  usa: { spanKm: 4500, label: "United States" },
  world: { spanKm: WORLD_SPAN_KM, label: "World" },
};

export function distancePoints(distanceKm: number, spanKm: number): number {
  if (!(spanKm > 0) || distanceKm >= spanKm) return 0;
  if (distanceKm <= 0) return 100;
  return 100 * Math.exp(-(distanceKm / spanKm) * DECAY);
}

export function distanceScore(distanceKm: number, ring: RingId): number {
  return Math.round(distancePoints(distanceKm, RINGS[ring].spanKm));
}

/**
 * Which ring calibrates the distance curve for an edition's summary total.
 * State trails score against the Nebraska span, country against the USA span,
 * globe against the world span.
 */
export function scoreRingForEdition(edition: "state" | "country" | "globe"): RingId {
  return edition === "state" ? "nebraska" : edition === "country" ? "usa" : "world";
}
