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
/**
 * Capitals pack progress key (DESIGN section 1.4). The spelling is
 * owned by COLDTRAIL_PACK_CAPITALS_STORAGE_KEY in cases-pack.ts and
 * restated here so this module takes no import edge into the pack
 * data module; pack-shelf-data.test.ts pins the literals against
 * each other. The pack store holds the same ColdTrailStore shape.
 */
const COLDTRAIL_PACK_STORAGE_KEY = "meridian.coldtrail.pack.capitals.v1";
/**
 * Pack shelf selection key (owner: PACK_SHELF_SELECTION_KEY in
 * src/components/pack-shelf-data.ts), restated for the same reason as
 * the pack store key above. The blob's Cold Trail entry is this
 * edition's deck pick; a reset that leaves it behind would resurrect
 * the pack selection after "Start over", unlike the GeoDetective
 * reset, whose selection dies with its loop store.
 */
const PACK_SHELF_SELECTION_KEY = "meridian.pack-shelf.v1";
/** Previous-generation key: read once for migration, then deleted. */
const LEGACY_STORAGE_KEY = "meridian.coldtrail.v1";
/**
 * Legacy key: older versions saved whether the Cold Trail screen was
 * open when the tab closed, and reopened the screen on the next visit
 * (PR #203, parity with the loop's old open flag). Since the
 * 2026-11-08 entry rule (a bare visit always lands on Home) nothing
 * reads or writes this key any more; the constant stays only so the
 * "Start over" reset can delete a stale value an older version left
 * behind.
 */
export const COLDTRAIL_OPEN_KEY = "meridian.coldtrail.open";

/**
 * Lightweight progress peek for the Home card: is a Cold Trail case
 * mid-play in either deck's store (core or the capitals pack)? A case
 * counts as mid-play when a current case exists and has not been
 * revealed yet — the same test TrailScreen's deck picker uses.
 * Mirrors the loop's peekLoopProgress: it only reads, never writes —
 * in particular it never runs loadColdtrail's legacy migration, so
 * calling it on Home cannot change anyone's saved game.
 */
export function peekColdTrailProgress(): { inProgress: boolean } {
  const hasOpenCase = (key: string): boolean => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as {
        v?: unknown;
        current?: { revealed?: unknown } | null;
      };
      return parsed.v === 2 && parsed.current != null && parsed.current.revealed === false;
    } catch {
      return false;
    }
  };
  try {
    return {
      inProgress:
        hasOpenCase(COLDTRAIL_STORAGE_KEY) || hasOpenCase(COLDTRAIL_PACK_STORAGE_KEY),
    };
  } catch {
    return { inProgress: false };
  }
}

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

/**
 * Read the store at a key; fresh wallet when storage is missing or
 * corrupt. The default key is the core store. The pack key reads the
 * same shape under its own key and never runs the legacy migration:
 * a v1 core save belongs to the core store, not to a pack.
 */
export function loadColdtrail(key: string = COLDTRAIL_STORAGE_KEY): ColdTrailStore {
  try {
    if (typeof localStorage === "undefined") return freshStore();
    const raw = localStorage.getItem(key);
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
    // No save at this key: the core key runs the one-time migration
    // from the v1 key. Other keys (the pack store) just start fresh.
    if (key !== COLDTRAIL_STORAGE_KEY) return freshStore();
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

/** Write the store at a key; storage failures are swallowed (game continues in memory). */
export function saveColdtrail(store: ColdTrailStore, key: string = COLDTRAIL_STORAGE_KEY): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, JSON.stringify(store));
  } catch {
    // Quota or blocked storage: the game continues in memory.
  }
}

/**
 * Remove the whole Cold Trail history (the "Start over" reset, manifest
 * 2026-10-28 §2): the legacy v1 key FIRST, then the v2 store, then the
 * capitals pack store, then the open flag. The order is the contract — loadColdtrail() migrates a
 * surviving v1 blob into v2 whenever v2 is absent, so removing v2 first
 * would leave a window where the whole store resurrects on next load.
 * Follows resetProfile()'s precedent: where removal fails, overwrite
 * with the empty value (an inert v1 blob the migration ignores, the
 * fresh v2 wallet, "0" for the flag). Returns true only when a re-read
 * proves each key is gone or holds its empty value — the reset reports
 * the store as failed otherwise.
 */
export function clearColdtrailStore(
  target?: Pick<Storage, "getItem" | "setItem" | "removeItem">,
): boolean {
  let s = target;
  if (!s) {
    try {
      s = typeof localStorage === "undefined" ? undefined : localStorage;
    } catch {
      s = undefined;
    }
  }
  if (!s) return true; // No storage = nothing was ever persisted.
  try {
    s.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    try {
      s.setItem(LEGACY_STORAGE_KEY, '{"v":0}');
    } catch {
      // The verification below reports it.
    }
  }
  try {
    s.removeItem(COLDTRAIL_STORAGE_KEY);
  } catch {
    try {
      s.setItem(COLDTRAIL_STORAGE_KEY, JSON.stringify(freshStore()));
    } catch {
      // The verification below reports it.
    }
  }
  try {
    s.removeItem(COLDTRAIL_PACK_STORAGE_KEY);
  } catch {
    try {
      s.setItem(COLDTRAIL_PACK_STORAGE_KEY, JSON.stringify(freshStore()));
    } catch {
      // The verification below reports it.
    }
  }
  try {
    s.removeItem(PACK_SHELF_SELECTION_KEY);
  } catch {
    try {
      s.setItem(PACK_SHELF_SELECTION_KEY, JSON.stringify({ v: 1, decks: {} }));
    } catch {
      // The verification below reports it.
    }
  }
  try {
    s.removeItem(COLDTRAIL_OPEN_KEY);
  } catch {
    try {
      s.setItem(COLDTRAIL_OPEN_KEY, "0");
    } catch {
      // The verification below reports it.
    }
  }
  try {
    const legacyRaw = s.getItem(LEGACY_STORAGE_KEY);
    const legacyGone =
      legacyRaw === null ||
      (() => {
        try {
          const parsed = JSON.parse(legacyRaw) as { v?: unknown };
          return parsed.v !== 1;
        } catch {
          return true; // Corrupt legacy blob: the migration ignores it too.
        }
      })();
    const raw = s.getItem(COLDTRAIL_STORAGE_KEY);
    const storeGone =
      raw === null ||
      (() => {
        try {
          const parsed = JSON.parse(raw) as Partial<ColdTrailStore>;
          return (
            parsed.v === 2 &&
            (parsed.caseIndex ?? 0) === 0 &&
            (parsed.stars ?? STARTING_STARS) === STARTING_STARS &&
            (parsed.solved ?? 0) === 0 &&
            (parsed.current ?? null) === null
          );
        } catch {
          return false;
        }
      })();
    const packRaw = s.getItem(COLDTRAIL_PACK_STORAGE_KEY);
    const packGone =
      packRaw === null ||
      (() => {
        try {
          const parsed = JSON.parse(packRaw) as Partial<ColdTrailStore>;
          return (
            parsed.v === 2 &&
            (parsed.caseIndex ?? 0) === 0 &&
            (parsed.stars ?? STARTING_STARS) === STARTING_STARS &&
            (parsed.solved ?? 0) === 0 &&
            (parsed.current ?? null) === null
          );
        } catch {
          return false;
        }
      })();
    const shelfRaw = s.getItem(PACK_SHELF_SELECTION_KEY);
    const shelfGone =
      shelfRaw === null ||
      (() => {
        try {
          const parsed = JSON.parse(shelfRaw) as { decks?: Record<string, unknown> };
          return parsed.decks?.coldtrail === undefined;
        } catch {
          return true; // Corrupt blob: readSelectedDeck fails closed to core too.
        }
      })();
    return legacyGone && storeGone && packGone && shelfGone && s.getItem(COLDTRAIL_OPEN_KEY) !== "1";
  } catch {
    return false;
  }
}
