/**
 * Math items adapter (contract I2) — wave 1 slice.
 *
 * Reads the curated rows from docs/scaling/math/number/items.json and
 * docs/scaling/math/applied/items.json. Those data files are NEVER edited
 * by this module; the adapter only selects and re-shapes rows.
 *
 * Wave 1 keeps up to 3 items per age band, picked where the row's why /
 * objective yields one unambiguous multiple-choice answer (see answers.ts
 * for each derivation, listed in the PR for educator sign-off).
 */
import type { AgeGroup, UnitItem } from "../registry.ts";
import numberRows from "../../../docs/scaling/math/number/items.json" with { type: "json" };
import appliedRows from "../../../docs/scaling/math/applied/items.json" with { type: "json" };

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

/** Every curated math row from both data files, in file order. */
export function allMathRows(): UnitItem[] {
  const rows: UnitItem[] = [];
  for (const raw of [...numberRows, ...appliedRows]) {
    if (!isRawRow(raw)) continue;
    rows.push({
      id: raw.id,
      group: raw.group,
      objective: raw.objective,
      standard: raw.standard,
      why: raw.why,
      buildsOn: [...raw.buildsOn],
      useElsewhere: [...raw.useElsewhere],
    });
  }
  return rows;
}

/**
 * The wave-1 slice: up to 3 items per band, in deal order. 18+ has only
 * 3 rows across both files, and all three are used.
 */
export const WAVE1_ITEM_IDS: readonly string[] = [
  // 7-10
  "math-number:groups:skip-count",
  "math-number:groups:equal-groups",
  "math-number:tables:buses",
  // 10-18
  "math-number:tables:multi-digit",
  "math-applied:measure:convert-metric",
  "math-number:fractions:percent",
  // 18+
  "math-number:tables:mental-strategies",
  "math-number:fractions:combine-shares",
  "math-applied:measure:survey-check",
];

/** The wave-1 units for the subject module (contract I1 `units`). */
export function mathUnits(): UnitItem[] {
  const byId = new Map(allMathRows().map((row) => [row.id, row]));
  const units: UnitItem[] = [];
  for (const id of WAVE1_ITEM_IDS) {
    const row = byId.get(id);
    if (row) units.push(row);
  }
  return units;
}

/** Wave-1 items for one age band, in deal order. */
export function itemsForGroup(group: AgeGroup): UnitItem[] {
  return mathUnits().filter((item) => item.group === group);
}
