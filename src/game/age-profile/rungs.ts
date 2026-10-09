/**
 * age-profile/rungs.ts — PURE rung-mapping function.
 *
 * Implements Phase 1 §2 (`mapStory`): pick the story-card text a child sees
 * given band + available rungs. Walks DOWN from the band's rung ceiling to
 * the hook, degrades to the Wikipedia-extract `history`, then to the
 * plain-spoken `blurb` (always shown, all bands).
 *
 * PURITY CONTRACT (enforced by design, no runtime check): this module has
 * NO fetch, NO localStorage, NO clock (no Date), NO random. It is a pure
 * function of (band, facts). Keep it that way — the card pipeline calls it
 * on the hot compose path.
 */

import type { AgeBandId, LadderRung, MappedStory, PlaceFacts, StoryRung } from "./types.ts";
import { AGE_BANDS, FULL_ACCESS_BAND } from "./bands.ts";

/** Ladder rungs in ascending difficulty (matches card-compose.mjs order). */
export const RUNG_ORDER: LadderRung[] = ["hook", "wikitext", "eb1911", "wikidata"];

/** Highest rung index each band may see (Phase 1 §2 CEILING_INDEX). */
const CEILING_INDEX: Record<AgeBandId, number> = {
  "5-7": 0,
  "8-10": 1,
  "11-13": 3,
};

/**
 * Minimum characters for a rung/history entry to count as a real story
 * (mirrors HOOK_MIN_CHARS in scripts/card-compose.mjs).
 */
export const HOOK_MIN_CHARS = 20;

function cleanText(text: string | undefined): string | null {
  if (typeof text !== "string") return null;
  const t = text.trim();
  return t.length >= HOOK_MIN_CHARS ? t : null;
}

/**
 * Pick the story text for a band. Never invents text: the worst case is
 * the plain geographic blurb (the existing "story coming soon" empty state
 * still applies upstream when even the blurb is empty).
 *
 * @param band The effective band, or null for an unset profile (full-access default).
 * @param facts The place's ladder rungs, optional history extract, and blurb.
 */
export function mapStory(band: AgeBandId | null, facts: PlaceFacts): MappedStory {
  const effective: AgeBandId = band ?? FULL_ACCESS_BAND;
  const autoplayAudio = effective === "5-7";
  const ceiling = CEILING_INDEX[effective];
  const blurb = (facts.blurb ?? "").trim();

  // Walk DOWN from the ceiling: never show text above the band's rung.
  for (let i = ceiling; i >= 0; i--) {
    const rung = RUNG_ORDER[i] as LadderRung;
    const entry = cleanText(facts.ladder[rung]?.text);
    if (entry) {
      return {
        text: blurb ? `${entry} ${blurb}` : entry,
        rung,
        autoplayAudio,
      };
    }
  }

  // Degrade: Wikipedia-extract history (existing behavior), then bare blurb.
  const history = cleanText(facts.history);
  if (history) {
    return {
      text: blurb ? `${history} ${blurb}` : history,
      rung: "history",
      autoplayAudio,
    };
  }
  return { text: blurb, rung: "blurb-only", autoplayAudio };
}

/** The ceiling rung for a band (useful for "gated content" telemetry). */
export function rungCeiling(band: AgeBandId): LadderRung {
  return AGE_BANDS[band].rungCeiling;
}

/** Resolves which rung index a ladder `kind` occupies, for ladder adaptors. */
export function rungIndex(rung: LadderRung): number {
  return RUNG_ORDER.indexOf(rung);
}

export type { StoryRung };
