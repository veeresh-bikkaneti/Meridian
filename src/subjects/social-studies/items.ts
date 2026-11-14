/**
 * Social studies items adapter (contract I2) — first live slice, plus
 * the v2 wave (feat/v2-social-studies-more-items).
 *
 * Reads the curated rows from docs/scaling/social-studies/items.json.
 * That data file is NEVER edited by this module; the adapter only
 * selects and re-shapes rows.
 *
 * The slice keeps up to 3 items per age band, picked where the row's
 * why / objective yields one unambiguous multiple-choice answer with
 * the shared AnswerCard. Every item was re-screened against
 * docs/scaling/humanities/screened-topics.md: the shipped items are
 * map and route geography only (directions H04, routes H03, landform
 * geography H18 — KEEP / KEEP-LIMITS), with settled facts only. No
 * religion, no contested politics, no biology. Items that need a map
 * in front of the player (pin drops, sorting pictured places,
 * comparing by eye) are held for a later wave; see the PR body.
 *
 * The v2 wave re-screened every unplayed row against the same list
 * and added the rows whose why yields one unambiguous verbal answer:
 * compass-clue (7-10, directions H04 — asked in words here; the
 * pin-drop form stays with the map mode), fastest-or-shortest and
 * time-zones (10-18, routes H03 — both deferred in v1 only because
 * travel-time had not shipped yet; time zones follow from longitude).
 * Per-band counts are now 4 (7-10), 5 (10-18), 3 (18+). Still held:
 * grid-reference, landform-sort, farther-or-nearer, latlon-pin and
 * compass-bearing; see the PR body.
 */
import type { AgeGroup, UnitItem } from "../registry.ts";
import rows from "../../../docs/scaling/social-studies/items.json" with { type: "json" };

type RawRow = {
  id: string;
  group: AgeGroup;
  objective: string;
  standard: { code: string; source: string } | "UNVERIFIED";
  why: string;
  buildsOn: string[];
  useElsewhere: string[];
};

function isRawRow(value: unknown): value is RawRow {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    (row.group === "7-10" || row.group === "10-18" || row.group === "18+") &&
    typeof row.objective === "string" &&
    typeof row.why === "string" &&
    Array.isArray(row.buildsOn) &&
    Array.isArray(row.useElsewhere)
  );
}

/** Every curated social-studies row, in file order. */
export function allSocialStudiesRows(): UnitItem[] {
  const out: UnitItem[] = [];
  for (const raw of rows) {
    if (!isRawRow(raw)) continue;
    out.push({
      id: raw.id,
      group: raw.group,
      objective: raw.objective,
      standard: raw.standard,
      why: raw.why,
      buildsOn: [...raw.buildsOn],
      useElsewhere: [...raw.useElsewhere],
    });
  }
  return out;
}

/** The live items, in deal order (v1 slice, then the v2 wave). */
export const SOCIAL_STUDIES_ITEM_IDS: readonly string[] = [
  // 7-10
  "social-studies:region:area-by-squares",
  "social-studies:route:count-the-steps",
  "social-studies:route:trip-clock",
  "social-studies:place:compass-clue",
  // 10-18
  "social-studies:region:density",
  "social-studies:route:scale-ratio",
  "social-studies:route:travel-time",
  "social-studies:route:fastest-or-shortest",
  "social-studies:compare:time-zones",
  // 18+
  "social-studies:region:flat-map-area",
  "social-studies:route:great-circle",
  "social-studies:compare:trip-cost",
];

/** The live units for the subject module (contract I1 `units`). */
export function socialStudiesUnits(): UnitItem[] {
  const byId = new Map(allSocialStudiesRows().map((row) => [row.id, row]));
  const units: UnitItem[] = [];
  for (const id of SOCIAL_STUDIES_ITEM_IDS) {
    const row = byId.get(id);
    if (row) units.push(row);
  }
  return units;
}

/** Live items for one age band, in deal order. */
export function itemsForGroup(group: AgeGroup): UnitItem[] {
  return socialStudiesUnits().filter((item) => item.group === group);
}
