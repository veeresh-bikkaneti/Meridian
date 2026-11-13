/**
 * Subject picker rows — the pure merge behind the picker screen.
 *
 * The picker shows the whole map: every planned subject in plan order.
 * A subject is "ready" for the player's age band when its released
 * module carries at least one playable item for that band; anything
 * else — not released yet, or released with nothing for this band —
 * shows as a disabled "Coming soon" row (owner rule, Nov 13: release
 * progressively; bands with nothing playable show "Coming soon").
 */
import type { AgeGroup, SubjectModule } from "../registry";

export type PlannedSubject = { id: string; title: string };

/** The subjects on the map, in the order kids meet them. Journals stay
 * planned-only in this run: their clips are not in the repo yet. */
export const PLANNED_SUBJECTS: readonly PlannedSubject[] = [
  { id: "math", title: "Math" },
  { id: "physics", title: "Physics" },
  { id: "chemistry", title: "Chemistry" },
  { id: "general-knowledge", title: "General knowledge" },
  { id: "social-studies", title: "Social studies" },
  { id: "journals", title: "Journals" },
];

export type PickerRow = {
  id: string;
  title: string;
  state: "ready" | "coming-soon";
  /** Playable cases for the player's band (0 when coming soon). */
  caseCount: number;
  /** The released module, when the row is ready to open. */
  module?: SubjectModule;
};

export function pickerRows(released: SubjectModule[], group: AgeGroup): PickerRow[] {
  const byId = new Map(released.map((mod) => [mod.id, mod]));
  const rows: PickerRow[] = [];
  const push = (id: string, plannedTitle: string) => {
    const mod = byId.get(id);
    const caseCount = mod ? mod.units.filter((unit) => unit.group === group).length : 0;
    rows.push({
      id,
      title: mod?.title ?? plannedTitle,
      state: caseCount > 0 ? "ready" : "coming-soon",
      caseCount,
      ...(caseCount > 0 && mod ? { module: mod } : {}),
    });
    byId.delete(id);
  };
  for (const planned of PLANNED_SUBJECTS) push(planned.id, planned.title);
  // A released subject that is not on the plan yet still shows.
  for (const mod of byId.values()) push(mod.id, mod.title);
  return rows;
}
