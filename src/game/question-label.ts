import { ADMIN1_BY_COUNTRY, COUNTRIES } from "./regions.ts";
import type { Edition } from "./run.ts";

/**
 * Question disambiguation labels (Veeresh's spec).
 *
 * Globe mode used to ask "GLOBE / Manhattan" — the player couldn't tell
 * Manhattan, New York from Manhattan, Nebraska (5,326 same-name/same-country
 * groups exist in the chunks). Labels now qualify the name:
 *
 * - globe:   "{place}, {country}"                        → "Toronto, Canada"
 * - globe, same-name collision in the dealt pool: "{place}, {state}, {country}"
 *                                                      → "Manhattan, Nebraska, United States"
 * - country: "{place}, {state}"                         → "Manhattan, Nebraska"
 * - state:   "{place}" (unchanged)
 *
 * Fail-closed: when a parent name can't be resolved the label falls back to
 * the bare place name — never a raw id, "undefined", or an empty qualifier.
 * The one honest exception: a globe collision whose state can't be resolved
 * keeps the 2-part "{place}, {country}" label (the collision is still
 * visible), because the country IS known there.
 *
 * Pure module, no React — unit-testable. Applied to the question bubble AND
 * the result/reveal card title. Deliberately kept OUT of share text
 * (spoiler-free by design) and GeoDetective (name-hidden by design).
 */

/** The place fields the label builder needs — a Starter subset. */
export type LabelPlace = {
  name: string;
  /** ISO-3166-1 alpha-2 country code (generated places, curated globe starters). */
  iso2?: string | null;
  regionId?: string | null;
  /**
   * Display-only origin for places folded into a whole-country pool
   * (e.g. a Texas place dealt in a "whole United States" run keeps
   * originRegionId "texas" while regionId becomes "united-states").
   */
  originRegionId?: string | null;
};

/**
 * CLDR region names via Intl.DisplayNames. `fallback: "none"` makes `.of()`
 * return undefined for codes with no CLDR entry instead of echoing the code
 * — the fail-closed primitive this module builds on. This replaces a
 * hand-maintained 235-entry iso2 table: it covers every iso2 present across
 * all 64 chunks today and any code the dataset grows tomorrow.
 */
const displayNames = new Intl.DisplayNames(["en"], {
  type: "region",
  fallback: "none",
});

/**
 * Fail-closed ISO-3166-1 alpha-2 → English country name. Returns null for
 * anything unresolvable: missing/malformed codes, codes with no CLDR entry,
 * or a missing Intl region table. Never throws, never echoes the raw code.
 */
export function countryNameForIso2(iso2: string | null | undefined): string | null {
  if (typeof iso2 !== "string") return null;
  const code = iso2.trim().toUpperCase();
  // Structural check first: DisplayNames.of throws RangeError on a
  // malformed region subtag ("12", "USA"), so this doubles as the
  // throw-guard.
  if (!/^[A-Z]{2}$/.test(code)) return null;
  let name: string | undefined;
  try {
    name = displayNames.of(code);
  } catch {
    return null;
  }
  // fallback:"none" yields undefined for codes with no CLDR entry; the
  // raw-code echo and CLDR's explicit "Unknown Region" (ZZ) are rejected
  // too — an unknown code must never render as a place's country.
  if (!name || name === code || /^unknown\b/i.test(name)) return null;
  return name;
}

/**
 * Country display name for a curated place (no iso2): COUNTRIES id lookup
 * first (covers country starters like regionId "canada"), else a reverse
 * lookup of the regionId in ADMIN1_BY_COUNTRY to find the parent country
 * (covers state starters like regionId "nebraska" → "United States").
 * Null when unresolvable.
 */
export function countryNameForRegionId(
  regionId: string | null | undefined,
): string | null {
  if (typeof regionId !== "string" || regionId.length === 0) return null;
  const direct = COUNTRIES.find((c) => c.id === regionId);
  if (direct) return direct.name;
  for (const [countryId, subdivisions] of Object.entries(ADMIN1_BY_COUNTRY)) {
    if (subdivisions.some((s) => s.id === regionId)) {
      return COUNTRIES.find((c) => c.id === countryId)?.name ?? null;
    }
  }
  return null;
}

/**
 * The country key used for collision grouping: the place's resolved country
 * name, lowercased. iso2-backed places resolve via CLDR, curated places via
 * the regions table — both funnels produce the same key for the same
 * country, so a mixed pool can never miss a real collision (or merge two
 * different countries). Null when no country can be determined — such
 * places are skipped by the collision map rather than grouped by name
 * alone (a bare-name group would false-positive across countries).
 */
export function countryKeyForPlace(place: LabelPlace): string | null {
  const countryName =
    countryNameForIso2(place.iso2) ??
    countryNameForRegionId(place.regionId) ??
    countryNameForRegionId(place.originRegionId);
  return countryName ? countryName.toLowerCase() : null;
}

/** Collision-map key: case-insensitive, whitespace-trimmed name + country key. */
function collisionKeyFor(place: LabelPlace): string | null {
  const countryKey = countryKeyForPlace(place);
  if (!countryKey) return null;
  const nameKey = place.name.toLowerCase().trim();
  if (nameKey.length === 0) return null;
  return `${nameKey}|${countryKey}`;
}

/**
 * Name-count map over one dealt pool, built once per pool (O(n)). Key =
 * `name.toLowerCase().trim() + "|" + countryKey`, so "Manhattan" only
 * collides with another "Manhattan" in the SAME country — "Manhattan,
 * United States" vs "Manhattan, Canada" never merge.
 */
export function buildCollisionCounts(pool: LabelPlace[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const place of pool) {
    const key = collisionKeyFor(place);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** True when another place in the dealt pool shares this place's name in the same country. */
export function hasNameCollision(
  place: LabelPlace,
  counts: Map<string, number>,
): boolean {
  const key = collisionKeyFor(place);
  return key !== null && (counts.get(key) ?? 0) > 1;
}

/** A subdivision (state/province) hit: its display name plus its parent country id. */
type SubdivisionHit = { name: string; countryId: string };

/**
 * Find a subdivision by id. Scoped to one country's subdivisions when
 * `countryRegionId` is given (country edition runs); otherwise scans every
 * ADMIN1_BY_COUNTRY entry (globe edition). Null when unresolvable.
 */
function findSubdivision(
  subdivisionId: string | null | undefined,
  countryRegionId: string | null | undefined,
): SubdivisionHit | null {
  if (typeof subdivisionId !== "string" || subdivisionId.length === 0) return null;
  const entries: Array<[string, { id: string; name: string }[]]> = countryRegionId
    ? [[countryRegionId, ADMIN1_BY_COUNTRY[countryRegionId] ?? []]]
    : Object.entries(ADMIN1_BY_COUNTRY);
  for (const [cid, subdivisions] of entries) {
    const found = subdivisions.find((s) => s.id === subdivisionId);
    if (found) return { name: found.name, countryId: cid };
  }
  return null;
}

/**
 * Subdivision (state/province) display name for a place, or null when it
 * can't be resolved. Whole-country runs re-tag places to the country's
 * regionId but keep `originRegionId` (e.g. "texas") — the origin wins, so
 * "Austin" in a whole-United-States run labels "Austin, Texas".
 *
 * `countryRegionId` scopes the lookup (country edition); in globe mode the
 * scan is global, but the hit is only accepted when its parent country
 * resolves to the SAME country name as the place — never pair a place with
 * a subdivision from another country.
 */
export function stateNameForPlace(
  place: LabelPlace,
  countryRegionId: string | null | undefined,
  /** The place's already-resolved country name (globe 3-part gate only). */
  resolvedCountryName?: string | null,
): string | null {
  const hit = findSubdivision(
    place.originRegionId ?? place.regionId,
    countryRegionId,
  );
  if (!hit) return null;
  if (!countryRegionId && resolvedCountryName) {
    const hitCountryName = countryNameForRegionId(hit.countryId);
    if (hitCountryName !== resolvedCountryName) return null;
  }
  return hit.name;
}

/** Resolve the place's country name: iso2 first, curated regionId path second. */
function countryNameForPlace(place: LabelPlace): string | null {
  return (
    countryNameForIso2(place.iso2) ??
    countryNameForRegionId(place.regionId) ??
    countryNameForRegionId(place.originRegionId)
  );
}

export function buildQuestionLabel(input: {
  edition: Edition;
  place: LabelPlace;
  /**
   * The run's country region id (country edition only, e.g.
   * "united-states") — scopes the state lookup. Null/omitted for
   * globe and state editions.
   */
  countryRegionId?: string | null;
  /**
   * True when another place in the dealt pool shares this place's name in
   * the same country (globe edition only). Drives the 3-part label.
   */
  hasCollision?: boolean;
}): string {
  const { edition, place } = input;
  const name = place.name;
  // State edition: unchanged, just the place name.
  if (edition === "state") return name;

  const countryName = countryNameForPlace(place);
  // Fail closed: no resolvable country → today's bare name. Never a raw
  // id, "undefined", or an empty qualifier.
  if (!countryName) return name;

  if (edition === "country") {
    const stateName = stateNameForPlace(place, input.countryRegionId ?? null);
    return stateName ? `${name}, ${stateName}` : name;
  }

  // Globe edition.
  if (input.hasCollision) {
    const stateName = stateNameForPlace(place, null, countryName);
    if (stateName) return `${name}, ${stateName}, ${countryName}`;
    // State unresolvable but the country IS known: the honest 2-part
    // label still shows the collision ("Manhattan, United States").
    return `${name}, ${countryName}`;
  }
  return `${name}, ${countryName}`;
}
