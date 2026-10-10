import { clampLat, normalizeLon, STORE_LAT_LIMIT } from "../geo.ts";
import { STARTING_STARS } from "./engine.ts";
import type {
  ColdTrailProgress,
  ColdTrailRingCenter,
  ColdTrailStore,
} from "./types.ts";

/**
 * Cold Trail persistence: one JSON blob under `meridian.coldtrail.v2`.
 * Fail-open like the loop store — corrupt or unavailable storage degrades
 * to a fresh wallet, never a broken screen.
 *
 * v2 (2026-10-09, WS1 "Every Place Findable"): locked ring centers are
 * player-chosen coordinates (`ringCenters`), committed atomically with
 * `ringsPlaced`. v1 saves are migrated once on load: wallet fields
 * (caseIndex/stars/solved) are kept, but the in-progress case is reset to
 * unplaced — v1 rings were auto-placed at the TRUE anchors (the P0 bug),
 * so they are meaningless under placement mode. The migration raises a
 * one-shot notice ("Rings work differently now — place yours!") via
 * takeLegacyMigrationNotice().
 */

export const COLDTRAIL_STORAGE_KEY = "meridian.coldtrail.v2";
/** Previous-generation key: read once for migration, then deleted. */
const LEGACY_STORAGE_KEY = "meridian.coldtrail.v1";

let legacyMigrated = false;

/**
 * One-shot flag: true when the most recent loadColdtrail() migrated a v1
 * save. Consuming (clears the flag) so the notice shows exactly once.
 */
export function takeLegacyMigrationNotice(): boolean {
  const v = legacyMigrated;
  legacyMigrated = false;
  return v;
}

export function freshProgress(): ColdTrailProgress {
  return {
    ringsPlaced: [false, false, false],
    informantOn: [false, false, false],
    ringCenters: [null, null, null],
    guess: null,
    revealed: false,
    scoreKm: null,
  };
}

function freshStore(): ColdTrailStore {
  return { v: 2, caseIndex: 0, stars: STARTING_STARS, solved: 0, current: null };
}

function isCoordPair(v: unknown): v is ColdTrailRingCenter {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.lon === "number" &&
    Number.isFinite(c.lon) &&
    typeof c.lat === "number" &&
    Number.isFinite(c.lat)
  );
}

function isProgress(value: unknown): value is ColdTrailProgress {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  const boolTriple = (v: unknown): v is [boolean, boolean, boolean] =>
    Array.isArray(v) && v.length === 3 && v.every((b) => typeof b === "boolean");
  const centers = p.ringCenters;
  const centersOk =
    Array.isArray(centers) &&
    centers.length === 3 &&
    centers.every((c) => c === null || isCoordPair(c));
  const guess = p.guess as Record<string, unknown> | null;
  if (
    !(
      boolTriple(p.ringsPlaced) &&
      boolTriple(p.informantOn) &&
      centersOk &&
      (guess === null ||
        (typeof guess.lon === "number" && typeof guess.lat === "number")) &&
      typeof p.revealed === "boolean" &&
      (p.scoreKm === null || typeof p.scoreKm === "number")
    )
  ) {
    return false;
  }
  // A locked ring must carry its player-chosen center: the only writer
  // commits both atomically (onLockRing), so a mismatch means corruption.
  const ringsPlaced = p.ringsPlaced as [boolean, boolean, boolean];
  const ringCenters = centers as [ColdTrailRingCenter | null, ColdTrailRingCenter | null, ColdTrailRingCenter | null];
  return !ringsPlaced.some((placed, i) => placed && ringCenters[i] === null);
}

function sanitizeInt(v: unknown, fallback: number): number {
  return Number.isInteger(v) && (v as number) >= 0 ? (v as number) : fallback;
}

/** Normalize stored centers: wrap lon to [-180, 180], clamp lat to ±90. */
function sanitizeProgress(p: ColdTrailProgress): ColdTrailProgress {
  return {
    ...p,
    ringsPlaced: [...p.ringsPlaced] as ColdTrailProgress["ringsPlaced"],
    informantOn: [...p.informantOn] as ColdTrailProgress["informantOn"],
    ringCenters: p.ringCenters.map((c) =>
      c === null ? null : { lon: normalizeLon(c.lon), lat: clampLat(c.lat, -STORE_LAT_LIMIT, STORE_LAT_LIMIT) },
    ) as ColdTrailProgress["ringCenters"],
  };
}

/** Migrate a v1 blob: keep the wallet, reset the case to unplaced rings. */
function migrateV1(legacy: Record<string, unknown>): ColdTrailStore {
  return {
    v: 2,
    caseIndex: sanitizeInt(legacy.caseIndex, 0),
    stars: sanitizeInt(legacy.stars, STARTING_STARS),
    solved: sanitizeInt(legacy.solved, 0),
    // v1 auto-placed rings at the true anchors — meaningless (and a leak)
    // under placement mode. The player re-places them this case.
    current: null,
  };
}

/** Read the store; fresh wallet when storage is missing or corrupt. */
export function loadColdtrail(): ColdTrailStore {
  try {
    if (typeof localStorage === "undefined") return freshStore();
    const raw = localStorage.getItem(COLDTRAIL_STORAGE_KEY);
    if (raw) {
      let parsed: Partial<ColdTrailStore>;
      try {
        parsed = JSON.parse(raw) as Partial<ColdTrailStore>;
      } catch {
        return freshStore();
      }
      // Fail closed on any version mismatch under the v2 key.
      if (parsed.v !== 2) return freshStore();
      return {
        v: 2,
        caseIndex: sanitizeInt(parsed.caseIndex, 0),
        stars: sanitizeInt(parsed.stars, STARTING_STARS),
        solved: sanitizeInt(parsed.solved, 0),
        current:
          parsed.current === null || parsed.current === undefined
            ? null
            : isProgress(parsed.current)
              ? sanitizeProgress(parsed.current)
              : null,
      };
    }
    // No v2 save: one-time migration from the v1 key.
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      try {
        const legacy = JSON.parse(legacyRaw) as Record<string, unknown>;
        if (legacy.v === 1) {
          const migrated = migrateV1(legacy);
          saveColdtrail(migrated);
          try {
            localStorage.removeItem(LEGACY_STORAGE_KEY);
          } catch {
            // Best-effort cleanup; a leftover legacy key is harmless (it is
            // only consulted when the v2 key is absent).
          }
          legacyMigrated = true;
          return migrated;
        }
      } catch {
        // Corrupt legacy blob: fall through to a fresh store.
      }
    }
    return freshStore();
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
