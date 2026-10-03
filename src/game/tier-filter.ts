import type { Difficulty } from "./scoring.ts";

/**
 * The learning path the player picks on the edition screen — which fame
 * tiers deal into their run. Framed as scaffolding, not gamer difficulty:
 * Easy is the curriculum core (famous places every kid should know), Hard
 * is obscure corners for explorers. Deliberately distinct from the
 * per-place 1–5 `Difficulty` in scoring.ts: one kid-friendly pick maps to
 * an INCLUSIVE band of tiers. The bands overlap on purpose so no pool ever
 * starves.
 */
export type PickerDifficulty = "easy" | "medium" | "hard";

/** All picker choices, in display order. */
export const PICKER_DIFFICULTIES: readonly PickerDifficulty[] = ["easy", "medium", "hard"];

export function isPickerDifficulty(value: unknown): value is PickerDifficulty {
  return value === "easy" || value === "medium" || value === "hard";
}

/** Inclusive tier bands per picker choice: easy 1–2, medium 2–4, hard 4–5. */
export const TIER_BANDS: Record<PickerDifficulty, [number, number][]> = {
  easy: [[1, 2]],
  medium: [[2, 4]],
  hard: [[4, 5]],
};

/** Missing or invalid `difficulty` reads as tier 3 (back-compat). */
function tierOf(difficulty: unknown): Difficulty {
  return difficulty === 1 ||
    difficulty === 2 ||
    difficulty === 3 ||
    difficulty === 4 ||
    difficulty === 5
    ? difficulty
    : 3;
}

function inBand(tier: number, band: [number, number][]): boolean {
  return band.some(([lo, hi]) => tier >= lo && tier <= hi);
}

/**
 * Keep only the places whose difficulty tier falls in the picker's band.
 * Fail-closed: an empty input — or a band that matches nothing — returns an
 * empty pool. The pool is never silently widened back to the full catalog.
 */
export function filterByTier<T extends { difficulty?: unknown }>(
  places: T[],
  choice: PickerDifficulty,
): T[] {
  const band = TIER_BANDS[choice] ?? TIER_BANDS.medium;
  return places.filter((place) => inBand(tierOf(place.difficulty), band));
}
