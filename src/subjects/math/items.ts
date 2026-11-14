/**
 * Math items adapter (contract I2) — wave 1 slice plus the wave-2
 * "more items" additions.
 *
 * Reads the curated rows from docs/scaling/math/number/items.json and
 * docs/scaling/math/applied/items.json. Those data files are NEVER edited
 * by this module; the adapter only selects and re-shapes rows.
 *
 * Wave 1 kept up to 3 items per age band, picked where the row's why /
 * objective yields one unambiguous multiple-choice answer (see answers.ts
 * for each derivation, listed in the PR for educator sign-off). Wave 2
 * appends up to 10 more per band under the same rule, preferring rows
 * whose useElsewhere links to another subject; the wave-1 items stay
 * first in deal order so the dealt first case per band is unchanged.
 * The 18+ band has only 3 rows across both files and all were already
 * played in wave 1, so wave 2 adds none there.
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
 * Every playable item, in deal order: the wave-1 slice first (up to 3
 * items per band), then the wave-2 additions appended per band. 18+ has
 * only 3 rows across both files, and all three are used in wave 1.
 * (The export keeps its wave-1 name: it is the list other code and the
 * unit tests already import.)
 */
export const WAVE1_ITEM_IDS: readonly string[] = [
  // 7-10 (wave 1)
  "math-number:groups:skip-count",
  "math-number:groups:equal-groups",
  "math-number:tables:buses",
  // 10-18 (wave 1)
  "math-number:tables:multi-digit",
  "math-applied:measure:convert-metric",
  "math-number:fractions:percent",
  // 18+ (wave 1 — the band's only rows)
  "math-number:tables:mental-strategies",
  "math-number:fractions:combine-shares",
  "math-applied:measure:survey-check",
  // 7-10 (wave 2)
  "math-number:place:hundreds-tens-ones",
  "math-number:place:compare",
  "math-number:place:round",
  "math-number:place:ten-times",
  "math-number:tables:facts",
  "math-number:tables:big-products",
  "math-number:division:fair-share",
  "math-number:division:unknown-factor",
  "math-number:division:remainders",
  "math-number:division:big-quotients",
  // 10-18 (wave 2)
  "math-applied:geometry:scale-drawing",
  "math-number:division:standard-algorithm",
  "math-number:fractions:multiply",
  "math-number:fractions:divide",
  "math-applied:measure:accuracy",
  "math-applied:rates:unit-rate",
  "math-applied:rates:constant-speed",
  "math-applied:rates:one-step",
  "math-applied:rates:two-step",
  "math-applied:trig:bearings",
];

/** The playable units for the subject module (contract I1 `units`). */
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
