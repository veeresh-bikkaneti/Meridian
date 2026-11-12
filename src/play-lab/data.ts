import type {
  AgeGroup,
  BridgeLink,
  JournalClip,
  SubjectId,
  SubjectMeta,
  UnitItem,
} from "./types.ts";

import mathNumberJson from "../../docs/scaling/math/number/items.json" with { type: "json" };
import mathAppliedJson from "../../docs/scaling/math/applied/items.json" with { type: "json" };
import physicsJson from "../../docs/scaling/physics/items.json" with { type: "json" };
import chemistryJson from "../../docs/scaling/chemistry/items.json" with { type: "json" };
import socialStudiesJson from "../../docs/scaling/social-studies/items.json" with { type: "json" };
import generalKnowledgeJson from "../../docs/scaling/general-knowledge/items.json" with { type: "json" };

import greatLeadersJson from "../../docs/scaling/journals/great-leaders/clips.json" with { type: "json" };
import technologyJson from "../../docs/scaling/journals/technology/clips.json" with { type: "json" };
import ww2MonumentsJson from "../../docs/scaling/journals/ww2-monuments/clips.json" with { type: "json" };
import freedomFightersJson from "../../docs/scaling/journals/freedom-fighters/clips.json" with { type: "json" };
import modernWorldJson from "../../docs/scaling/journals/modern-world/clips.json" with { type: "json" };
import peoplePlacesJson from "../../docs/scaling/journals/people-places/clips.json" with { type: "json" };
import worldWarsJson from "../../docs/scaling/journals/world-wars/clips.json" with { type: "json" };

export const SUBJECT_METAS: SubjectMeta[] = [
  {
    id: "math",
    title: "Mathematics",
    tagline: "Numbers, patterns, and measurement in the real world",
    icon: "📐",
    color: "#e8b64c",
  },
  {
    id: "physics",
    title: "Physics",
    tagline: "Pushes, pulls, motion, and how things work",
    icon: "⚡",
    color: "#5db7e8",
  },
  {
    id: "chemistry",
    title: "Chemistry",
    tagline: "States of matter, water, and changing materials",
    icon: "🧪",
    color: "#68d391",
  },
  {
    id: "social-studies",
    title: "Social Studies",
    tagline: "Maps, travel times, scale, and living together",
    icon: "🧭",
    color: "#f6ad55",
  },
  {
    id: "general-knowledge",
    title: "General Knowledge",
    tagline: "World landmarks, timelines, and discovery",
    icon: "🏛️",
    color: "#b794f4",
  },
];

function extractStandardCode(standard: unknown): string {
  if (!standard) return "";
  if (typeof standard === "string") return standard;
  if (typeof standard === "object" && "code" in standard && typeof standard.code === "string") {
    return standard.code;
  }
  return "";
}

function normalizeRawItem(raw: Record<string, unknown>, subjectId: SubjectId): UnitItem {
  const standard = (raw.standard as UnitItem["standard"]) ?? "UNVERIFIED";
  const standardCode = extractStandardCode(standard);
  const buildsOn = Array.isArray(raw.buildsOn)
    ? (raw.buildsOn as string[])
    : typeof raw.buildsOn === "string"
      ? [raw.buildsOn]
      : [];
  const useElsewhere = Array.isArray(raw.useElsewhere)
    ? (raw.useElsewhere as string[])
    : typeof raw.useElsewhere === "string"
      ? [raw.useElsewhere]
      : [];

  return {
    id: String(raw.id),
    subjectId,
    group: (raw.group as AgeGroup) ?? "7-10",
    objective: String(raw.objective ?? ""),
    standard,
    standardCode,
    why: String(raw.why ?? ""),
    buildsOn,
    useElsewhere,
  };
}

const ALL_ITEMS: UnitItem[] = [
  ...mathNumberJson.map((r) => normalizeRawItem(r as Record<string, unknown>, "math")),
  ...mathAppliedJson.map((r) => normalizeRawItem(r as Record<string, unknown>, "math")),
  ...physicsJson.map((r) => normalizeRawItem(r as Record<string, unknown>, "physics")),
  ...chemistryJson.map((r) => normalizeRawItem(r as Record<string, unknown>, "chemistry")),
  ...socialStudiesJson.map((r) => normalizeRawItem(r as Record<string, unknown>, "social-studies")),
  ...generalKnowledgeJson.map((r) =>
    normalizeRawItem(r as Record<string, unknown>, "general-knowledge"),
  ),
];

const ITEM_MAP = new Map<string, UnitItem>(ALL_ITEMS.map((item) => [item.id, item]));

function extractClips(raw: unknown, journalName: string): JournalClip[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === "object" && "clips" in raw && Array.isArray((raw as { clips: unknown[] }).clips)) {
    list = (raw as { clips: unknown[] }).clips;
  }

  return list.map((item) => {
    const r = item as Record<string, unknown>;
    const placeRaw = (r.place as Record<string, unknown>) || {};
    return {
      id: String(r.id),
      journal: journalName,
      group: (r.group as AgeGroup) ?? "7-10",
      objective: String(r.objective ?? ""),
      standard: (r.standard as JournalClip["standard"]) ?? "",
      standardCode: extractStandardCode(r.standard),
      why: String(r.why ?? ""),
      place: {
        lat: Number(placeRaw.lat ?? 0),
        lon: Number(placeRaw.lon ?? 0),
        name: String(placeRaw.name ?? "Landmark"),
      },
      file: String(r.file ?? ""),
      captions: typeof r.captions === "string" ? r.captions : undefined,
      retrieval:
        r.retrieval && typeof r.retrieval === "object"
          ? {
              question: String((r.retrieval as Record<string, unknown>).question ?? ""),
              answer: String((r.retrieval as Record<string, unknown>).answer ?? ""),
            }
          : undefined,
      stretch:
        r.stretch && typeof r.stretch === "object"
          ? {
              group: String((r.stretch as Record<string, unknown>).group ?? ""),
              question: String((r.stretch as Record<string, unknown>).question ?? ""),
              answer: String((r.stretch as Record<string, unknown>).answer ?? ""),
            }
          : undefined,
    };
  });
}

const ALL_JOURNAL_CLIPS: JournalClip[] = [
  ...extractClips(greatLeadersJson, "Great Leaders"),
  ...extractClips(technologyJson, "Technology"),
  ...extractClips(ww2MonumentsJson, "WWII Monuments"),
  ...extractClips(freedomFightersJson, "Freedom Fighters"),
  ...extractClips(modernWorldJson, "Modern World"),
  ...extractClips(peoplePlacesJson, "People & Places"),
  ...extractClips(worldWarsJson, "World Wars"),
];

const JOURNAL_CLIP_MAP = new Map<string, JournalClip>(
  ALL_JOURNAL_CLIPS.map((clip) => [clip.id, clip]),
);

export function getAllSubjects(): SubjectMeta[] {
  return SUBJECT_METAS;
}

export function getAllItems(): UnitItem[] {
  return ALL_ITEMS;
}

export function getItemById(id: string): UnitItem | undefined {
  return ITEM_MAP.get(id);
}

export function getItemsForSubject(subjectId: SubjectId, ageGroup?: AgeGroup): UnitItem[] {
  const filtered = ALL_ITEMS.filter((item) => item.subjectId === subjectId);
  if (!ageGroup) return filtered;
  return filterByAgeGroup(filtered, ageGroup);
}

export function filterByAgeGroup<T extends { group: AgeGroup }>(
  items: T[],
  ageGroup: AgeGroup,
): T[] {
  // If player is in 18+, they can access all age groups.
  if (ageGroup === "18+") return items;
  // If player is 10-18, they can access 7-10 and 10-18.
  if (ageGroup === "10-18") {
    return items.filter((item) => item.group === "7-10" || item.group === "10-18");
  }
  // 7-10 accesses 7-10.
  return items.filter((item) => item.group === "7-10");
}

export function getAllJournalClips(): JournalClip[] {
  return ALL_JOURNAL_CLIPS;
}

export function getJournalClipsForAgeGroup(ageGroup: AgeGroup): JournalClip[] {
  return filterByAgeGroup(ALL_JOURNAL_CLIPS, ageGroup);
}

export function getJournalClipById(id: string): JournalClip | undefined {
  return JOURNAL_CLIP_MAP.get(id);
}

export function parseBridgeLinks(item: UnitItem | JournalClip): BridgeLink[] {
  const fromSubject: SubjectId = "subjectId" in item ? item.subjectId : "social-studies";
  const links: BridgeLink[] = [];

  const sources: string[] = "useElsewhere" in item && Array.isArray(item.useElsewhere)
    ? item.useElsewhere
    : [];

  // If item is the Lincoln Memorial journal
  if (item.id === "great-leaders:lincoln-memorial") {
    links.push({
      fromSubject: "social-studies",
      toSubject: "Math",
      description: "Subtracting calendar years (1922 minus 1914 = 8 years)",
    });
    links.push({
      fromSubject: "social-studies",
      toSubject: "Everyday Life",
      description: "Observing historic statues and architectural columns",
    });
    return links;
  }

  for (const line of sources) {
    const colonIndex = line.indexOf(":");
    if (colonIndex !== -1) {
      const toSubject = line.slice(0, colonIndex).trim();
      const description = line.slice(colonIndex + 1).trim();
      links.push({
        fromSubject,
        toSubject: toSubject.charAt(0).toUpperCase() + toSubject.slice(1),
        description,
      });
    } else {
      links.push({
        fromSubject,
        toSubject: "Cross-Disciplinary Application",
        description: line.trim(),
      });
    }
  }

  return links;
}

