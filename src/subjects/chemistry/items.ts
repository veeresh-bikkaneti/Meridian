/**
 * Chemistry items adapter (contract I2) — first live slice.
 *
 * Reads the curated rows from docs/scaling/chemistry/items.json. That
 * data file is NEVER edited by this module; the adapter only selects
 * and re-shapes rows.
 *
 * The slice keeps up to 3 items per age band, picked where the row's
 * why / objective yields one unambiguous multiple-choice answer with
 * the shared AnswerCard (see answers.ts for each derivation, listed
 * in the PR for educator review). Question wording respects
 * docs/scaling/chemistry/fact-notes.md: road salt is claimed only as
 * lowering water's freezing point (never a melt speed, never a
 * temperature), and rust is iron exposed to oxygen and water. No
 * biology appears in any question or "use elsewhere" line.
 */
import type { AgeGroup, UnitItem } from "../registry.ts";
import rows from "../../../docs/scaling/chemistry/items.json" with { type: "json" };

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

/** Every curated chemistry row, in file order. */
export function allChemistryRows(): UnitItem[] {
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

/** The live slice: up to 3 items per band, in deal order. */
export const CHEMISTRY_ITEM_IDS: readonly string[] = [
  // 7-10
  "chemistry:states:solid-liquid",
  "chemistry:states:melt-freeze",
  "chemistry:materials:sort",
  // 10-18
  "chemistry:states:road-salt",
  "chemistry:mixtures:dissolve",
  "chemistry:reactions:weight",
  // 18+
  "chemistry:reactions:rate",
  "chemistry:reactions:mass",
  "chemistry:reactions:explain",
];

/** The live units for the subject module (contract I1 `units`). */
export function chemistryUnits(): UnitItem[] {
  const byId = new Map(allChemistryRows().map((row) => [row.id, row]));
  const units: UnitItem[] = [];
  for (const id of CHEMISTRY_ITEM_IDS) {
    const row = byId.get(id);
    if (row) units.push(row);
  }
  return units;
}

/** Live items for one age band, in deal order. */
export function itemsForGroup(group: AgeGroup): UnitItem[] {
  return chemistryUnits().filter((item) => item.group === group);
}
