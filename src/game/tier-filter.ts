import type { Difficulty } from "./scoring.ts";

/**
 * The learning path the player picks on the edition screen — which fame
 * tiers deal into their run. Framed as scaffolding, not gamer difficulty:
 * Easy is the curriculum core (famous places every kid should know), Hard
 * is obscure corners for explorers. What's distinct here is the 3-choice
 * `PickerDifficulty` UX: one kid-friendly pick maps to an INCLUSIVE band of
 * the shared 1–5 fame tier. The bands overlap on purpose so no pool ever
 * starves.
 *
 * Shared-semantic warning: the 1–5 fame tier is ONE field — the per-place
 * `difficulty` in scoring.ts — driving scoring multipliers, these picker
 * bands, and the dealing weights in trail.ts. A future scoring retune does
 * not only touch scores; it silently moves these bands too. Retune (or
 * re-verify) all three together. Use asFameTier() for the shared
 * "integer 1–5 else 3" guard so the semantic stays in one place.
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

/**
 * Shared fame-tier guard: a valid integer 1–5 tier, else medium (3).
 * One field drives scoring multipliers, picker bands, and dealing
 * weights — so one guard. Missing, hand-edited, or corrupt values read as
 * tier 3 (back-compat: pre-tier catalogs and legacy chunks stay neutral).
 */
export function asFameTier(value: unknown): Difficulty {
  return value === 1 ||
    value === 2 ||
    value === 3 ||
    value === 4 ||
    value === 5
    ? value
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
  return places.filter((place) => inBand(asFameTier(place.difficulty), band));
}
