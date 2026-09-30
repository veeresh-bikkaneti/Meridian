import type { BonusKind, RingId } from "./types.ts";

export const SCORING_VERSION = 2 as const;

/** MapTap's live distance curve. https://maptap.gg/faq */
export const DECAY = 3.5;
export const WORLD_SPAN_KM = 16250;
export const COUNTRY_FLOOR = 25;
export const CONTINENT_FLOOR = 10;
export const SCORE_CAP = 80;
export const ROUND_WEIGHTS = [1, 1, 2, 3, 3] as const;
export const MAX_TOTAL = 1000;

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

/** Country and continent lifts. A 12 in the right country becomes 34. Never lowers a score. */
export function applyBonus(raw: number, bonus: BonusKind): number {
  if (bonus === "none") return raw;
  const floor = bonus === "country" ? COUNTRY_FLOOR : CONTINENT_FLOOR;
  const boosted = floor + (raw / 100) * (100 - floor);
  return Math.round(Math.max(raw, Math.min(boosted, SCORE_CAP)));
}

export function gradeRound(
  distanceKm: number,
  ring: RingId,
  bonus: BonusKind,
  roundIndex: number,
): { distanceScore: number; score: number; weight: number; bonus: BonusKind } {
  const fromDistance = distanceScore(distanceKm, ring);
  const allowed = ring === "world" || ring === "usa" ? bonus : "none";
  const weight = ROUND_WEIGHTS[roundIndex] ?? 1;
  return {
    distanceScore: fromDistance,
    score: applyBonus(fromDistance, allowed),
    weight,
    bonus: allowed,
  };
}

export function weightedTotal(scores: readonly number[]): number {
  return scores.reduce((sum, score, index) => sum + score * (ROUND_WEIGHTS[index] ?? 0), 0);
}

export function totalFromGuesses(
  guesses: readonly ({ score: number; weight: number } | null)[],
): number {
  return guesses.reduce((sum, guess) => sum + (guess ? guess.score * guess.weight : 0), 0);
}
