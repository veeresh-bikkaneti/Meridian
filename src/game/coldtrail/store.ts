import { STARTING_STARS } from "./engine.ts";
import type { ColdTrailProgress, ColdTrailStore } from "./types.ts";

/**
 * Cold Trail persistence: one JSON blob under `meridian.coldtrail.v1`.
 * Fail-open like the loop store — corrupt or unavailable storage degrades
 * to a fresh wallet, never a broken screen.
 */

export const COLDTRAIL_STORAGE_KEY = "meridian.coldtrail.v1";

export function freshProgress(): ColdTrailProgress {
  return {
    ringsPlaced: [false, false, false],
    informantOn: [false, false, false],
    guess: null,
    revealed: false,
    scoreKm: null,
  };
}

function freshStore(): ColdTrailStore {
  return { v: 1, caseIndex: 0, stars: STARTING_STARS, solved: 0, current: null };
}

function isProgress(value: unknown): value is ColdTrailProgress {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  const boolTriple = (v: unknown): v is [boolean, boolean, boolean] =>
    Array.isArray(v) && v.length === 3 && v.every((b) => typeof b === "boolean");
  const guess = p.guess as Record<string, unknown> | null;
  return (
    boolTriple(p.ringsPlaced) &&
    boolTriple(p.informantOn) &&
    (guess === null ||
      (typeof guess.lon === "number" && typeof guess.lat === "number")) &&
    typeof p.revealed === "boolean" &&
    (p.scoreKm === null || typeof p.scoreKm === "number")
  );
}

/** Read the store; fresh wallet when storage is missing or corrupt. */
export function loadColdtrail(): ColdTrailStore {
  try {
    if (typeof localStorage === "undefined") return freshStore();
    const raw = localStorage.getItem(COLDTRAIL_STORAGE_KEY);
    if (!raw) return freshStore();
    const parsed = JSON.parse(raw) as Partial<ColdTrailStore>;
    if (parsed.v !== 1) return freshStore();
    return {
      v: 1,
      caseIndex:
        Number.isInteger(parsed.caseIndex) && (parsed.caseIndex as number) >= 0
          ? (parsed.caseIndex as number)
          : 0,
      stars:
        Number.isInteger(parsed.stars) && (parsed.stars as number) >= 0
          ? (parsed.stars as number)
          : STARTING_STARS,
      solved:
        Number.isInteger(parsed.solved) && (parsed.solved as number) >= 0
          ? (parsed.solved as number)
          : 0,
      current:
        parsed.current === null || parsed.current === undefined
          ? null
          : isProgress(parsed.current)
            ? parsed.current
            : null,
    };
  } catch {
    return freshStore();
  }
}

/** Write the store; storage failures are swallowed (game continues in memory). */
export function saveColdtrail(store: ColdTrailStore): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(COLDTRAIL_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota or blocked storage: the game continues in memory.
  }
}
