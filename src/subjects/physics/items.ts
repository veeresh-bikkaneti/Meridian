/**
 * Physics items adapter (contract I2) — first live slice.
 *
 * Reads the curated rows from docs/scaling/physics/items.json. That
 * data file is NEVER edited by this module; the adapter only selects
 * and re-shapes rows.
 *
 * The slice keeps every row that maps onto the shared AnswerCard as
 * one multiple-choice question (v2: all 24 curated rows). Rows whose
 * objective says "shown by tapping X" render as "pick X" choices —
 * the same mapping the first slice already used for
 * physics:push:which-way (tap a direction → pick a direction) and
 * physics:arrive:unit-rate (tap a cart → pick a cart). Two prompts
 * are reframed, not the rows: physics:lever:seesaw asks about the
 * far end (the row's literal question gives its answer away), and
 * physics:shadow:blocks asks the row's own "when is the book seen?"
 * question. No row needs a scene this wave; none has a number answer
 * that choices would give away, so nothing is held for typed-number
 * (Stream B's kind field is not on main yet).
 */
import type { AgeGroup, UnitItem } from "../registry.ts";
import rows from "../../../docs/scaling/physics/items.json" with { type: "json" };

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

/** Every curated physics row, in file order. */
export function allPhysicsRows(): UnitItem[] {
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

/** The live slice: every curated row, in deal order per band (v2: 12 / 9 / 3). */
export const PHYSICS_ITEM_IDS: readonly string[] = [
  // 7-10
  "physics:push:which-way",
  "physics:push:equal-pushes",
  "physics:magnet:flip",
  "physics:drop:down",
  "physics:friction:measure-slide",
  "physics:ramp:faster-hits-harder",
  "physics:arrive:equal-steps",
  "physics:lever:seesaw",
  "physics:balance:tug",
  "physics:energy:wound-moves",
  "physics:shadow:blocks",
  "physics:mirror:sends-back",
  // 10-18
  "physics:arrive:unit-rate",
  "physics:ramp:slope-ratio",
  "physics:magnet:closer",
  "physics:push:mass",
  "physics:push:table",
  "physics:ramp:higher-stored",
  "physics:energy:transfer",
  "physics:sound:medium",
  "physics:mirror:three-ways",
  // 18+
  "physics:ramp:adult-ratio",
  "physics:arrive:adult-time",
  "physics:energy:missing",
];

/** The live units for the subject module (contract I1 `units`). */
export function physicsUnits(): UnitItem[] {
  const byId = new Map(allPhysicsRows().map((row) => [row.id, row]));
  const units: UnitItem[] = [];
  for (const id of PHYSICS_ITEM_IDS) {
    const row = byId.get(id);
    if (row) units.push(row);
  }
  return units;
}

/** Live items for one age band, in deal order. */
export function itemsForGroup(group: AgeGroup): UnitItem[] {
  return physicsUnits().filter((item) => item.group === group);
}
