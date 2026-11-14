/**
 * General knowledge items adapter (contract I2) — first live slice.
 *
 * Reads the curated rows from docs/scaling/general-knowledge/items.json.
 * That data file is NEVER edited by this module; the adapter only
 * selects and re-shapes rows. rounds.json is PROPOSED example rounds
 * only — it is not read here and no spaced-repetition dealing is
 * built; the deal order below simply follows the items file.
 *
 * The slice keeps every row whose why / objective yields one
 * unambiguous multiple-choice answer with the shared AnswerCard
 * (v2: the 7-10 band grows from 3 to 5 items; 10-18 keeps its 3 and
 * 18+ its 2, as every row in those bands already played). One 7-10
 * row stays out: noon-shadow's objective is comparing three pictures
 * of a shadow, which needs a scene the shared flow does not have.
 * Every item was re-screened against the content rules: landmarks
 * appear as architecture and places only, balanced across
 * traditions, with settled facts only.
 */
import type { AgeGroup, UnitItem } from "../registry.ts";
import rows from "../../../docs/scaling/general-knowledge/items.json" with { type: "json" };

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

/** Every curated general-knowledge row, in file order. */
export function allGeneralKnowledgeRows(): UnitItem[] {
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

/** The live slice: every multiple-choice-ready row, in deal order. */
export const GENERAL_KNOWLEDGE_ITEM_IDS: readonly string[] = [
  // 7-10
  "general-knowledge:mixed:opera-years-ago",
  "general-knowledge:mixed:eiffel-antennas",
  "general-knowledge:mixed:older-landmark",
  "general-knowledge:mixed:falls-in-km",
  "general-knowledge:mixed:trip-buses",
  // 10-18
  "general-knowledge:mixed:everest-vs-falls",
  "general-knowledge:mixed:paris-sydney-flight",
  "general-knowledge:mixed:tower-angle",
  // 18+ (only 2 rows exist)
  "general-knowledge:mixed:great-circle",
  "general-knowledge:mixed:falls-flow",
];

/** The live units for the subject module (contract I1 `units`). */
export function generalKnowledgeUnits(): UnitItem[] {
  const byId = new Map(allGeneralKnowledgeRows().map((row) => [row.id, row]));
  const units: UnitItem[] = [];
  for (const id of GENERAL_KNOWLEDGE_ITEM_IDS) {
    const row = byId.get(id);
    if (row) units.push(row);
  }
  return units;
}

/** Live items for one age band, in deal order. */
export function itemsForGroup(group: AgeGroup): UnitItem[] {
  return generalKnowledgeUnits().filter((item) => item.group === group);
}
