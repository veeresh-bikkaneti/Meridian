import type { PackDeckCase } from "./store.ts";

/**
 * Runtime types for story packs in the GeoDetective (design:
 * docs/story-packs.md §1.2). A pack adds cases to the edition
 * without touching the core deck: its clue files are ordinary clue files
 * at new global indexes, and everything the published clue file cannot
 * carry (which country or state the case is about, the direction, the
 * reveal blurb) lives in a per-pack sidecar the loop screen loads only
 * when a pack case is on the desk. Core cases never fetch a sidecar.
 */

/** How a pack case is framed (design §2.1). */
export type PackDirection = "A" | "B1" | "B2";

/** What a capital belongs to. */
export interface LoopPackSubject {
  kind: "country" | "state";
  name: string;
}

/** What the briefing is allowed to state (design §1.1). */
export interface LoopPackPrompt {
  givenName: string;
  givenKind: "country" | "state" | "capital";
}

/** One pack case's sidecar entry, keyed by clue-file index in LoopPackMeta. */
export interface LoopPackMetaEntry {
  subject: LoopPackSubject;
  direction: PackDirection;
  prompt: LoopPackPrompt;
  /** Reveal text. Ends by stating the pairing plainly (design §4 rule 7). */
  blurb: string;
  /**
   * Capitals & Flags: the subject land's flag identity ("fr", "us-ne"),
   * derived at build time and present ONLY when the land has a
   * licence-verified flag in src/assets/flags (design §2). Absent =
   * flagless land = screens render no flag. Never a hunt target: it
   * only ever sits beside the land's name, which is already on screen.
   */
  flagKey?: string;
}

/** Shape of public/packs/<packId>/loop-meta.json. Keys are clue-file indexes. */
export type LoopPackMeta = Record<string, LoopPackMetaEntry>;

/** Shape of public/packs/<packId>/manifest.json. */
export interface LoopPackManifest {
  v: 1;
  packId: string;
  category: string;
  /** Number of pack cases. Always loopIndexes.length. */
  size: number;
  generatedAt: string;
  /** Global clue-file indexes of this pack's GeoDetective cases. */
  loopIndexes: number[];
  /**
   * Pack tier per loopIndexes entry (same order), used to rebuild the
   * pack deck in tier bands when a cycle reshuffles. Optional: a manifest
   * without tiers rebuilds its deck as a plain shuffle of loopIndexes.
   */
  loopTiers?: number[];
  /** Cold Trail pack file name, or null until that adapter ships one. */
  coldtrailFile: string | null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isPackDirection(value: unknown): value is PackDirection {
  return value === "A" || value === "B1" || value === "B2";
}

export function isLoopPackManifest(value: unknown): value is LoopPackManifest {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  if (
    m.v !== 1 ||
    !isNonEmptyString(m.packId) ||
    !isNonEmptyString(m.category) ||
    !isNonEmptyString(m.generatedAt) ||
    !Array.isArray(m.loopIndexes) ||
    m.size !== (m.loopIndexes as unknown[]).length ||
    (m.size as number) < 1
  ) {
    return false;
  }
  const indexes = m.loopIndexes as unknown[];
  if (
    !indexes.every((i) => Number.isInteger(i) && (i as number) >= 0) ||
    new Set(indexes).size !== indexes.length
  ) {
    return false;
  }
  if (m.loopTiers !== undefined) {
    if (
      !Array.isArray(m.loopTiers) ||
      m.loopTiers.length !== indexes.length ||
      !(m.loopTiers as unknown[]).every(
        (t) => Number.isInteger(t) && (t as number) >= 1 && (t as number) <= 3,
      )
    ) {
      return false;
    }
  }
  return m.coldtrailFile === null || isNonEmptyString(m.coldtrailFile);
}

export function isLoopPackMetaEntry(value: unknown): value is LoopPackMetaEntry {
  if (!value || typeof value !== "object") return false;
  const e = value as Record<string, unknown>;
  const subject = e.subject as Record<string, unknown> | undefined;
  const prompt = e.prompt as Record<string, unknown> | undefined;
  return (
    !!subject &&
    (subject.kind === "country" || subject.kind === "state") &&
    isNonEmptyString(subject.name) &&
    isPackDirection(e.direction) &&
    !!prompt &&
    typeof prompt.givenName === "string" &&
    (prompt.givenKind === "country" ||
      prompt.givenKind === "state" ||
      prompt.givenKind === "capital") &&
    isNonEmptyString(e.blurb) &&
    (e.flagKey === undefined ||
      (typeof e.flagKey === "string" && /^[a-z]{2}(-[a-z]{2})?$/.test(e.flagKey)))
  );
}

export function isLoopPackMeta(value: unknown): value is LoopPackMeta {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value as Record<string, unknown>).every(
    ([key, entry]) => /^\d+$/.test(key) && isLoopPackMetaEntry(entry),
  );
}

/** The sidecar entry for one dealt case, or null when the case is not a pack case. */
export function loopMetaEntryFor(
  meta: LoopPackMeta | null,
  index: number,
): LoopPackMetaEntry | null {
  if (!meta) return null;
  return meta[String(index)] ?? null;
}

/**
 * The deck-builder input for a pack manifest: index + tier pairs. A
 * manifest without tiers deals its cases as one band (all tier 2), which
 * keeps the order a plain shuffle.
 */
export function packManifestCases(manifest: LoopPackManifest): PackDeckCase[] {
  return manifest.loopIndexes.map((index, i) => ({
    index,
    packTier: manifest.loopTiers?.[i] ?? 2,
  }));
}

/**
 * The one-line briefing shown above the clues for a pack case. The text
 * states only what the direction gives (design §2.1): Direction A names
 * the subject, B1 names the capital (a locate drill, labelled a drill),
 * B2 names nothing. A case with no given name and no direction framing
 * returns null and the screen shows no briefing.
 */
export function packBriefingText(entry: LoopPackMetaEntry): string | null {
  const given = entry.prompt.givenName.trim();
  switch (entry.direction) {
    case "A":
      return given ? `Your case: find the capital of ${given}.` : null;
    case "B1":
      return given ? `Your drill: find ${given} on the map.` : null;
    case "B2":
      return "Your case: a capital city is hiding. Work out its country first, then find the city.";
  }
}
