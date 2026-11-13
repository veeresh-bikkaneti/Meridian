/**
 * Subject registry (contract I1).
 *
 * Each subject lives at src/subjects/<id>/index.ts and is discovered
 * here, so adding one never edits a shared file. Only default exports
 * with released === true are listed. A subject sets released once a
 * playable slice exists (owner rule, Nov 13: release progressively);
 * educator review runs alongside, after release. load() is not
 * called: three.js stays inside the subject's own loader (learning
 * standard §5.1).
 *
 * The glob runs inside a function, the same way src/lib/flag-registry.ts
 * does, so plain Node can import selectReleased.
 */
import type { ComponentType } from "react";

export type AgeGroup = "7-10" | "10-18" | "18+";
export type MotionTier = "full" | "lite" | "flat";

export type UnitItem = {
  id: string;
  group: AgeGroup;
  objective: string;
  standard: { code: string; source: string } | "UNVERIFIED";
  why: string;
  buildsOn: string[];
  useElsewhere: string[];
};

export type SubjectProps = {
  group: AgeGroup;
  tier: MotionTier;
  onExit: () => void;
};

export type SubjectModule = {
  id: string;
  title: string;
  groups: AgeGroup[];
  released: boolean;
  units: UnitItem[];
  load: () => Promise<{ default: ComponentType<SubjectProps> }>;
};

const AGE_GROUPS = new Set<string>(["7-10", "10-18", "18+"]);
const FOLDER = /^\.\/([^/]+)\/index\.ts$/;

export type SubjectLoader = () => Promise<{ default?: unknown }>;

let cached: Record<string, SubjectLoader> | null = null;

function discoverSubjectLoaders(): Record<string, SubjectLoader> {
  if (!cached) {
    cached = import.meta.glob("./*/index.ts") as Record<string, SubjectLoader>;
  }
  return cached;
}

export function listReleasedSubjects(): Promise<SubjectModule[]> {
  return selectReleased(discoverSubjectLoaders());
}

export async function selectReleased(
  discovered: Record<string, SubjectLoader>,
): Promise<SubjectModule[]> {
  const found: SubjectModule[] = [];
  for (const [path, load] of Object.entries(discovered)) {
    const folder = folderName(path);
    if (!folder) continue;
    let mod: { default?: unknown };
    try {
      mod = await load();
    } catch {
      continue;
    }
    if (isReleased(mod?.default, folder)) found.push(mod.default);
  }
  found.sort((a, b) => a.id.localeCompare(b.id, "en"));
  return found;
}

function folderName(path: string): string | null {
  const match = FOLDER.exec(path);
  return match?.[1] ?? null;
}

function isReleased(value: unknown, folder: string): value is SubjectModule {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const row = value as Record<string, unknown>;
  if (row.released !== true) return false;
  if (typeof row.id !== "string" || row.id !== folder) return false;
  if (typeof row.title !== "string" || row.title.length === 0) return false;
  if (!isGroups(row.groups)) return false;
  if (!Array.isArray(row.units)) return false;
  if (typeof row.load !== "function") return false;
  return true;
}

function isGroups(value: unknown): value is AgeGroup[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every((group) => typeof group === "string" && AGE_GROUPS.has(group));
}
