/**
 * passport/badges.ts — the Passport badge system.
 *
 * A badge is COSMETIC ONLY: a name, a kid-friendly blurb, and an earned-at
 * timestamp. No points, no scoring term, no currency — and badge records
 * carry NO band or hint state (scoring stays identical across bands).
 *
 * Owns localStorage key `meridian.passport.badges.v1` (works fully offline).
 * Integration: Item A's hintPolicy wiring records `hintsUsed` in run state;
 * the round-end hook calls awardCleanRoundBadge() for 11-13 no-hint WINS,
 * passing the deal-time snapshot band (never the live band).
 */

import type { AgeBandId, LoopId } from "@/game/age-profile/types.ts";

export const PASSPORT_BADGES_KEY = "meridian.passport.badges.v1";
const BADGE_SCHEMA_VERSION = 1;

/** The "Clean Round" badge — 11-13 no-hint recognition, cosmetic only. */
export const CLEAN_ROUND_BADGE_ID = "clean-round";

/** A cosmetic badge definition. Band-invisible: no age numbers, no easy/hard. */
export interface PassportBadge {
  id: string;
  /** Kid-facing name, e.g. "Clean Round". */
  name: string;
  /** Kid-facing line, <=90 chars. */
  blurb: string;
}

/** The stored "earned" record: badge id + time. No points, no band, no hints. */
export interface EarnedBadge {
  id: string;
  earnedAt: string;
  schemaVersion: 1;
}

/** The registry. Today: one badge. Add badge-only entries here. */
export const PASSPORT_BADGES: Record<string, PassportBadge> = {
  [CLEAN_ROUND_BADGE_ID]: {
    id: CLEAN_ROUND_BADGE_ID,
    name: "Clean Round",
    blurb: "A whole round without a single hint — nice figuring it out yourself!",
  },
};

export function getPassportBadge(id: string): PassportBadge | null {
  return PASSPORT_BADGES[id] ?? null;
}

// --- Earned-badges storage (localStorage + memory fallback) ---

let memoryFallback: EarnedBadge[] | null = null;

function readStorage(): EarnedBadge[] {
  try {
    if (typeof localStorage === "undefined") throw new Error("no localStorage");
    const raw = localStorage.getItem(PASSPORT_BADGES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (b): b is EarnedBadge =>
        !!b &&
        typeof b === "object" &&
        (b as EarnedBadge).schemaVersion === BADGE_SCHEMA_VERSION &&
        typeof (b as EarnedBadge).id === "string",
    );
  } catch {
    return memoryFallback ?? [];
  }
}

function writeStorage(earned: EarnedBadge[]): void {
  try {
    if (typeof localStorage === "undefined") throw new Error("no localStorage");
    localStorage.setItem(PASSPORT_BADGES_KEY, JSON.stringify(earned));
    memoryFallback = null;
  } catch {
    memoryFallback = earned;
  }
}

/** All badges the kid has earned (read path for the passport surface). */
export function earnedPassportBadges(): EarnedBadge[] {
  return readStorage();
}

/**
 * Award a badge (idempotent: re-awarding never duplicates, never scores).
 * Returns the badge definition, or null for an unknown id.
 */
export function awardPassportBadge(id: string): PassportBadge | null {
  const badge = getPassportBadge(id);
  if (!badge) return null;
  const earned = readStorage();
  if (!earned.some((b) => b.id === id)) {
    earned.push({
      id,
      earnedAt: new Date().toISOString(),
      schemaVersion: BADGE_SCHEMA_VERSION,
    });
    writeStorage(earned);
  }
  return badge;
}

/** Summary the round-end hook passes in. Sourced from run state. */
export interface CleanRoundSummary {
  /**
   * Deal-time band from the immutable run-config snapshot
   * (`dealBandConfig.band`) — NEVER the live `resolveBand()`. A mid-run
   * band change must not mis-award (#113 BLOCK 1). Undefined (pre-snapshot
   * puzzle) fails closed: no award.
   */
  band: AgeBandId | undefined;
  /** Hints used during the run (Item A run state). */
  hintsUsed: number;
  /** The loop the round belonged to (for future per-loop badges). */
  loopId: LoopId;
  /**
   * Only completed WINS earn the badge — never losses or abandoned rounds
   * (#113 BLOCK 2: the award copy celebrates figuring it out, which
   * mismatches a failed round).
   */
  won: boolean;
}

/**
 * Clean Round: for 11-13 no-hint WINS only (11-13 has no hint button, so a
 * zero-hint win is recognisable). Cosmetic ONLY — never points, never
 * scoring. The badge copy is band-invisible: nothing tells the child which
 * band earned it.
 *
 * Returns the awarded badge, or null when no badge is due.
 */
export function awardCleanRoundBadge(summary: CleanRoundSummary): PassportBadge | null {
  if (!summary.won) return null;
  if (summary.band !== "11-13") return null;
  if (summary.hintsUsed > 0) return null;
  return awardPassportBadge(CLEAN_ROUND_BADGE_ID);
}

/** Test-only: drop the in-memory fallback so node tests start clean. */
export function __resetPassportBadgeMemory(): void {
  memoryFallback = null;
}
