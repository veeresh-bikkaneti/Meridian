/**
 * Journals items adapter (contract I2) — Stream D, PR D1.
 *
 * Reads the curated clip rows from docs/scaling/journals/<journal>/clips.json.
 * Those data files are NEVER edited here; the adapter only selects and
 * re-shapes rows. Some files are a plain array, others an object with a
 * `clips` array; both are read.
 *
 * Each row is one playable case. A row that carries a 10-18 `stretch`
 * becomes its own item in that band (the stretch question and answer).
 * Rows whose clips are not rendered yet show their captions instead of
 * a movie (see JournalsCase.tsx).
 */
import type { AgeGroup, UnitItem } from "../registry.ts";
import greatLeaders from "../../../docs/scaling/journals/great-leaders/clips.json" with { type: "json" };
import technology from "../../../docs/scaling/journals/technology/clips.json" with { type: "json" };
import modernWorld from "../../../docs/scaling/journals/modern-world/clips.json" with { type: "json" };
import peoplePlaces from "../../../docs/scaling/journals/people-places/clips.json" with { type: "json" };

/** The D1 slice, in deal order per band (the case flow walks this order). */
export const JOURNAL_ITEM_IDS: readonly string[] = [
  // 7-10 (grades 2-5)
  "great-leaders:lincoln-memorial",
  "technology:first-phone",
  "technology:eniac",
  "modern-world:greenwich-zero",
  "modern-world:liverpool-manchester",
  "modern-world:hearts-content-cable",
  "people-places:pont-du-gard",
  "people-places:akashi-span",
  // 10-18 (grades 5-12): base rows and their stretch items
  "technology:mobile-phone",
  "great-leaders:lincoln-memorial:stretch",
  "modern-world:greenwich-zero:stretch",
  "modern-world:liverpool-manchester:stretch",
  "modern-world:hearts-content-cable:stretch",
  "people-places:eratosthenes-earth",
  "people-places:andean-roads",
  // 18+ (adults)
  "people-places:aconcagua-height",
];

/** One line per item: the "You just used this in…" link. Written from
 * the objective, no measurements. */
const USED_IN: Record<string, string> = {
  "great-leaders:lincoln-memorial": "Comparing how long big projects take, from start year to finish year.",
  "great-leaders:lincoln-memorial:stretch": "Solving for a missing part, like how much taller one column is than another.",
  "technology:first-phone": "Working out how long ago something happened.",
  "technology:mobile-phone": "Finding the gap between two dates.",
  "technology:eniac": "Finding the floor space of a room: length times width.",
  "modern-world:greenwich-zero": "Reading a map and finding a line on it.",
  "modern-world:greenwich-zero:stretch": "Finding how much of a full turn each part is.",
  "modern-world:liverpool-manchester": "Working out how long ago an event happened.",
  "modern-world:liverpool-manchester:stretch": "Doubling a rate for a longer trip.",
  "modern-world:hearts-content-cable": "Finding a place on a map from its clues.",
  "modern-world:hearts-content-cable:stretch": "Finding a rate per day and choosing the closest answer.",
  "people-places:pont-du-gard": "Counting equal groups, like rows of bricks or tiles.",
  "people-places:akashi-span": "Comparing two lengths and adding them together.",
  "people-places:eratosthenes-earth": "Scaling one measured part up to the whole.",
  "people-places:andean-roads": "Working out how many days a long trip takes.",
  "people-places:aconcagua-height": "Finding a height from a distance and an angle, like a ramp.",
};

/** Where an item's caption file lives, relative to docs/scaling/journals. */
export type CaptionRef = { journal: string; file: string };

type Row = {
  id: string;
  group: AgeGroup;
  objective: string;
  why: string;
  standard: UnitItem["standard"];
  captions: string | null;
  stretch: { group: AgeGroup; question: string } | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isGroup(value: unknown): value is AgeGroup {
  return value === "7-10" || value === "10-18" || value === "18+";
}

function standardOf(raw: Record<string, unknown>): UnitItem["standard"] {
  const std = raw.standard;
  if (typeof std === "string" && std !== "UNVERIFIED" && typeof raw.standardSource === "string") {
    return { code: std, source: raw.standardSource };
  }
  const obj = asRecord(std);
  if (obj && typeof obj.code === "string" && typeof obj.source === "string") {
    return { code: obj.code, source: obj.source };
  }
  return "UNVERIFIED";
}

function rowOf(value: unknown): Row | null {
  const raw = asRecord(value);
  if (!raw || typeof raw.id !== "string" || !isGroup(raw.group)) return null;
  if (typeof raw.objective !== "string" || typeof raw.why !== "string") return null;
  const stretchRaw = asRecord(raw.stretch);
  const stretch =
    stretchRaw && isGroup(stretchRaw.group) && typeof stretchRaw.question === "string"
      ? { group: stretchRaw.group, question: stretchRaw.question }
      : null;
  return {
    id: raw.id,
    group: raw.group,
    objective: raw.objective,
    why: raw.why,
    standard: standardOf(raw),
    captions: typeof raw.captions === "string" ? raw.captions : null,
    stretch,
  };
}

/** Every curated journal row, across the four journals that have rows
 * in D1 scope. Files read as either a plain array or `{ clips: [...] }`. */
function allRows(): Row[] {
  const sources: unknown[] = [
    ...(Array.isArray(greatLeaders) ? greatLeaders : []),
    ...(Array.isArray(technology) ? technology : []),
    ...(Array.isArray(modernWorld.clips) ? modernWorld.clips : []),
    ...(Array.isArray(peoplePlaces.clips) ? peoplePlaces.clips : []),
  ];
  const rows: Row[] = [];
  for (const source of sources) {
    const row = rowOf(source);
    if (row) rows.push(row);
  }
  return rows;
}

function journalOf(id: string): string {
  return id.split(":")[0] ?? "";
}

/** The clip row behind a unit id (a base id or a `:stretch` id). */
function rowFor(unitId: string): Row | null {
  const baseId = unitId.endsWith(":stretch") ? unitId.slice(0, -":stretch".length) : unitId;
  return allRows().find((row) => row.id === baseId) ?? null;
}

/** The units of the D1 slice, in deal order. */
export function journalUnits(): UnitItem[] {
  const units: UnitItem[] = [];
  for (const unitId of JOURNAL_ITEM_IDS) {
    const row = rowFor(unitId);
    if (!row) continue;
    const isStretch = unitId.endsWith(":stretch");
    const group = isStretch ? row.stretch?.group : row.group;
    const why = isStretch ? row.stretch?.question : row.why;
    if (!group || !why) continue;
    units.push({
      id: unitId,
      group,
      objective: row.objective,
      standard: row.standard,
      why,
      buildsOn: [],
      useElsewhere: [USED_IN[unitId] ?? "Everyday reasoning about places and time."],
    });
  }
  return units;
}

export function itemsForGroup(group: AgeGroup): UnitItem[] {
  return journalUnits().filter((unit) => unit.group === group);
}

/** Where the caption file for a base item lives, or null (stretch items
 * and rows without captions show only their question). */
export function captionRefFor(unitId: string): CaptionRef | null {
  if (unitId.endsWith(":stretch")) return null;
  const row = rowFor(unitId);
  if (!row || !row.captions) return null;
  return { journal: journalOf(row.id), file: row.captions };
}
