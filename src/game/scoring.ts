import type { Edition } from "./run.ts";
import { ADMIN1_BY_COUNTRY, type Region } from "./regions.ts";
import { distanceScore } from "./score.ts";
import { territoryAt } from "./territory.ts";
import type { LonLat, RingId } from "./types.ts";

/**
 * Meridian scoring v3 — the streak engine with a transparent breakdown.
 *
 * - `base` keeps the existing distance curve (MapTap's curve, untouched).
 * - `diffMult` finally scores the per-place difficulty 1–5, MapTap-style.
 * - `combo` rewards consecutive hits: the endless-mode engagement engine.
 * - `regionBonus` (+15, explicit and labeled) replaces the old hidden
 *   country/continent floor-lift — "right area, wrong spot" still pays, but
 *   as a visible line item instead of hidden math.
 * - Miss = 0, streak resets. Nothing ever subtracts; the reveal always plays.
 *
 * Pure module: no DOM, no storage, no network. All geography lookups are
 * synchronous data (region bounding boxes, bundled country polygons).
 */
export const SCORING_VERSION = 3 as const;

/** Flat kindness bonus for the right area, shown as an explicit line item. */
export const REGION_BONUS = 15 as const;
/** Hard cap on the distance × difficulty × combo product; the bonus adds on top. */
export const PLACE_SCORE_CAP = 400;
/** Streak length (including the current hit) at which the combo stops growing. */
export const MAX_COMBO_STREAK = 20;

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export const DIFFICULTY_TIERS: Record<Difficulty, { name: string; multiplier: number }> = {
  1: { name: "Easy", multiplier: 1 },
  2: { name: "Moderate", multiplier: 1.25 },
  3: { name: "Challenging", multiplier: 1.5 },
  4: { name: "Hard", multiplier: 2 },
  5: { name: "Extreme", multiplier: 2.5 },
};

export function difficultyTier(difficulty: Difficulty): { name: string; multiplier: number } {
  return DIFFICULTY_TIERS[difficulty];
}

/** MapTap-style question-card chip, e.g. "Hard · 2x". */
export function difficultyChip(difficulty: Difficulty): string {
  const tier = difficultyTier(difficulty);
  return `${tier.name} · ${formatFactor(tier.multiplier)}x`;
}

/**
 * Streak combo. `streak` counts consecutive hits INCLUDING the current one,
 * so the 6th straight hit shows 🔥6 at 1.3x — the worked example
 * (97 × 2.0 × 1.3 + 15 = 267) pins this definition.
 */
export function comboForStreak(streak: number): number {
  const capped = Math.min(Math.max(Math.floor(streak), 0), MAX_COMBO_STREAK);
  // Quoted to 2 decimals so the breakdown line and the score math agree
  // exactly (1 + 0.05 * 19 is 1.9500000000000002 in binary floating point).
  return Math.round((1 + 0.05 * capped) * 100) / 100;
}

/** Compact factor formatting for the breakdown line: 2 → "2.0", 1.25 → "1.25". */
export function formatFactor(value: number): string {
  const rounded = Number(value.toFixed(2));
  return Number.isInteger(rounded) ? rounded.toFixed(1) : String(rounded);
}

export type RegionBonusLabel = "country" | "state";

export type RegionBonus = {
  bonus: 0 | typeof REGION_BONUS;
  label: RegionBonusLabel | null;
};

function pointInBounds(point: LonLat, bounds: Region["bounds"]): boolean {
  const [west, south, east, north] = bounds;
  return point[0] >= west && point[0] <= east && point[1] >= south && point[1] <= north;
}

function admin1KeyAt(point: LonLat, regions: Region[]): string | null {
  for (const region of regions) {
    if (pointInBounds(point, region.bounds)) return region.id;
  }
  return null;
}

function countryMatch(pin: LonLat, target: LonLat): boolean {
  const pinCountry = territoryAt(pin)?.key;
  const targetCountry = territoryAt(target)?.key;
  return !!pinCountry && !!targetCountry && pinCountry === targetCountry;
}

/**
 * The +15 region bonus, computed the same way for both sides so border
 * ambiguity can't award it inconsistently:
 * - globe: pin and target in the same country (exact bundled polygons).
 * - country: pin and target in the same admin1 where admin1 data exists
 *   (currently the United States); otherwise the same-country fallback.
 * - state: the pin lands inside the played state's bounds.
 */
export function regionBonusFor(input: {
  edition: Edition;
  regionId: string;
  pin: LonLat;
  target: LonLat;
}): RegionBonus {
  if (input.edition === "globe") {
    return countryMatch(input.pin, input.target)
      ? { bonus: REGION_BONUS, label: "country" }
      : { bonus: 0, label: null };
  }
  if (input.edition === "country") {
    const admin1 = ADMIN1_BY_COUNTRY[input.regionId];
    if (admin1) {
      const pinKey = admin1KeyAt(input.pin, admin1);
      const targetKey = admin1KeyAt(input.target, admin1);
      return pinKey !== null && pinKey === targetKey
        ? { bonus: REGION_BONUS, label: "state" }
        : { bonus: 0, label: null };
    }
    // No admin1 data for this country: the country match keeps the
    // beginner kindness instead of silently dropping the bonus.
    return countryMatch(input.pin, input.target)
      ? { bonus: REGION_BONUS, label: "country" }
      : { bonus: 0, label: null };
  }
  const state = Object.values(ADMIN1_BY_COUNTRY)
    .flat()
    .find((region) => region.id === input.regionId);
  if (state && pointInBounds(input.pin, state.bounds)) {
    return { bonus: REGION_BONUS, label: "state" };
  }
  return { bonus: 0, label: null };
}

export type ScoredPlace = {
  /** Rounded distance curve, 0–100. */
  base: number;
  difficulty: Difficulty;
  diffMult: number;
  /** Consecutive hits including this one. */
  streak: number;
  combo: number;
  regionBonus: 0 | typeof REGION_BONUS;
  regionBonusLabel: RegionBonusLabel | null;
  /** min(400, round(base × diffMult × combo)) + regionBonus. Misses score 0 via dropPin. */
  score: number;
};

export function scorePlace(input: {
  distanceKm: number;
  ring: RingId;
  difficulty: Difficulty;
  /** Consecutive hits BEFORE this place. */
  streakBefore: number;
  edition: Edition;
  regionId: string;
  pin: LonLat;
  target: LonLat;
}): ScoredPlace {
  const base = distanceScore(input.distanceKm, input.ring);
  const streak = Math.max(0, Math.floor(input.streakBefore)) + 1;
  const combo = comboForStreak(streak);
  const diffMult = difficultyTier(input.difficulty).multiplier;
  const { bonus: regionBonus, label: regionBonusLabel } = regionBonusFor({
    edition: input.edition,
    regionId: input.regionId,
    pin: input.pin,
    target: input.target,
  });
  const score = Math.min(PLACE_SCORE_CAP, Math.round(base * diffMult * combo)) + regionBonus;
  return { base, difficulty: input.difficulty, diffMult, streak, combo, regionBonus, regionBonusLabel, score };
}

/** The transparent arithmetic shown on every reveal, e.g. "97 × 2.0 × 1.3 + 15 country = 267". */
export function formatBreakdown(scored: ScoredPlace): string {
  const factors = `${scored.base} × ${formatFactor(scored.diffMult)} × ${formatFactor(scored.combo)}`;
  const bonus =
    scored.regionBonus > 0 && scored.regionBonusLabel
      ? ` + ${scored.regionBonus} ${scored.regionBonusLabel}`
      : "";
  return `${factors}${bonus} = ${scored.score}`;
}
