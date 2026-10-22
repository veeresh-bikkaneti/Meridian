import type { PickerDifficulty } from "./tier-filter.ts";
import { asFameTier, filterByTier } from "./tier-filter.ts";

/**
 * Easy-path curation — "famous places first".
 *
 * WHY: the Easy band is fame tiers 1–2 (tier-filter.ts). Tiers come from
 * GeoNames population bands, so on large regions — the Globe above all —
 * tier 2 (and some of tier 1) is dominated by big-but-unknown suburbs
 * ("Qarchak", "Shahre Jadide Andisheh"). A child picking Easy, or
 * pressing "Begin exploring", should meet places a grown-up would
 * recognise. Review finding P1-6 (2026-10-21).
 *
 * THE RULE (first rung with at least EASY_MIN_POOL places wins):
 *   1. "storied" — hand-curated starters in the band, plus tier-1 places
 *      that carry a verified history hook (`history`, from the Wikipedia
 *      enrichment pipeline — a notability signal that never involves an
 *      LLM, per AGENTS.md rule 5);
 *   2. "tier-1"  — curated starters in the band plus ALL tier-1 places
 *      (drops tier 2's long tail);
 *   3. "band"    — the full Easy band (tiers 1–2), unchanged from before.
 * Medium and Hard are untouched: they return filterByTier() as-is.
 *
 * Rung 3 exists so small pools never starve: e.g. Vermont/Wyoming have
 * no tier-1 places with a hook, and must still deal an Easy run. The
 * pool is never widened beyond the Easy band — fail-closed semantics of
 * filterByTier hold (an empty band stays empty).
 *
 * Every pool decision (run start, Play again, cleared-band check) must go
 * through dealingPoolFor() so they agree on what "the Easy band" is.
 */

/** Smallest curated pool we accept before falling back a rung. */
export const EASY_MIN_POOL = 25;

export type EasyRung = "storied" | "tier-1" | "band";

interface Curatable {
  difficulty?: unknown;
  curated?: boolean;
  history?: string;
}

function isStoried(place: Curatable): boolean {
  return (
    place.curated === true ||
    (asFameTier(place.difficulty) === 1 && typeof place.history === "string" && place.history.trim().length > 0)
  );
}

/** Easy curation over an already-banded (tiers 1–2) pool. Exported for tests. */
export function curateEasy<T extends Curatable>(banded: T[]): { pool: T[]; rung: EasyRung } {
  const storied = banded.filter(isStoried);
  if (storied.length >= EASY_MIN_POOL) return { pool: storied, rung: "storied" };
  const tier1 = banded.filter((p) => p.curated === true || asFameTier(p.difficulty) === 1);
  if (tier1.length >= EASY_MIN_POOL) return { pool: tier1, rung: "tier-1" };
  return { pool: banded, rung: "band" };
}

/**
 * The dealing pool for a learning path: the fame-tier band, plus the Easy
 * curation above. Order is preserved (the dealer's seeded shuffle depends
 * on input order — see mergeByGeonameId in generated-places.ts).
 */
export function dealingPoolFor<T extends Curatable>(places: T[], choice: PickerDifficulty): T[] {
  const banded = filterByTier(places, choice);
  return choice === "easy" ? curateEasy(banded).pool : banded;
}
