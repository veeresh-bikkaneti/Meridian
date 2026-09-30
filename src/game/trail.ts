import { hashString, mulberry32 } from "./daily.ts";

/**
 * Mint a per-session random seed. Crypto-backed when available; Math.random
 * is an acceptable fallback (this seeds question shuffling, not security).
 */
export function mintSeed(): number {
  try {
    const g = globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => void } };
    if (g.crypto?.getRandomValues) {
      const buf = new Uint32Array(1);
      g.crypto.getRandomValues(buf);
      return buf[0]! >>> 0;
    }
  } catch {
    // Fall through to Math.random.
  }
  return Math.floor(Math.random() * 4294967296);
}

/** Deterministic Fisher-Yates shuffle driven by an explicit seed. Pure. */
export function shufflePlaces<T>(places: T[], seed: number): T[] {
  const ordered = [...places];
  const random = mulberry32(seed >>> 0);
  for (let index = ordered.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = ordered[index]!;
    ordered[index] = ordered[swapIndex]!;
    ordered[swapIndex] = current;
  }
  return ordered;
}

/**
 * Per-cycle seed: the cycle number is folded into the session seed so
 * consecutive cycles deal different orders. Pure.
 */
export function cycleSeed(sessionSeed: number, cycle: number): number {
  return hashString(`${sessionSeed >>> 0}:${cycle}`);
}

/** Persistence for the per-day seen place IDs (the no-repeat history). */
export type SeenStore = {
  read: () => string[];
  write: (ids: string[]) => void;
};

/** In-memory seen store. Used when persistent storage is unavailable and in tests. */
export function memorySeenStore(): SeenStore {
  let ids: string[] = [];
  return {
    read: () => [...ids],
    write: (next: string[]) => {
      ids = [...next];
    },
  };
}

const SEEN_KEY_PREFIX = "meridian:seen:v1:";

function seenKey(dayKey: string, edition: string, regionId: string): string {
  return `${SEEN_KEY_PREFIX}${dayKey}:${edition}:${regionId}`;
}

function safeStorage(): Pick<
  Storage,
  "getItem" | "setItem" | "removeItem" | "length" | "key"
> | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * localStorage-backed seen store, scoped to one day/edition/region. A new
 * dayKey naturally starts with an empty history. Writes prune other days'
 * entries so storage stays bounded. Falls back to memory when storage is
 * unavailable.
 */
export function seenStoreFor(dayKey: string, edition: string, regionId: string): SeenStore {
  const storage = safeStorage();
  if (!storage) return memorySeenStore();
  const key = seenKey(dayKey, edition, regionId);
  return {
    read: () => {
      try {
        const raw = storage.getItem(key);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed)
          ? parsed.filter((id): id is string => typeof id === "string")
          : [];
      } catch {
        return [];
      }
    },
    write: (ids: string[]) => {
      try {
        storage.setItem(key, JSON.stringify(ids));
        // Prune other days: only today's entries are relevant.
        const todayPrefix = `${SEEN_KEY_PREFIX}${dayKey}:`;
        const doomed: string[] = [];
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i);
          if (k && k.startsWith(SEEN_KEY_PREFIX) && !k.startsWith(todayPrefix)) {
            doomed.push(k);
          }
        }
        for (const k of doomed) storage.removeItem(k);
      } catch {
        // Quota or blocked storage: the game continues in memory.
      }
    },
  };
}

export type Dealer<T extends { id: string }> = {
  /**
   * Place at absolute 0-based position across cycles. Cycles are built
   * lazily: each new cycle shuffles the still-unseen pool (or the full pool
   * after exhaustion) with a per-cycle seed, so consecutive cycles differ.
   * Returns null when the pool is empty.
   */
  at: (position: number) => T | null;
  /**
   * Record positions `startPosition..position` as dealt and persist the
   * no-repeat history. Positions below startPosition belong to a previous
   * incarnation of this run (e.g. before a reload) and are already recorded.
   */
  markDealtThrough: (position: number) => void;
  /** Current seen IDs, for tests. */
  seenIds: () => string[];
};

/**
 * Endless dealer: per-session shuffle, per-cycle reseed, persistent
 * no-repeat history. Seen places are skipped until the pool is exhausted,
 * at which point the history resets with a fresh shuffle. The history
 * survives reloads and restarts via the store; a new dayKey starts fresh.
 *
 * `startPosition` is the run index the dealer is created at (0 for a fresh
 * run, the resumed index after a reload): earlier positions were dealt by a
 * previous incarnation and must not be re-marked.
 */
export function createDealer<T extends { id: string }>(
  places: T[],
  sessionSeed: number,
  store: SeenStore = memorySeenStore(),
  startPosition = 0,
): Dealer<T> {
  const seen = new Set<string>(store.read());
  const cycles: T[][] = [];
  const cycleEnds: number[] = []; // cumulative exclusive end position per cycle

  function buildCycle(): T[] {
    let pool = places.filter((place) => !seen.has(place.id));
    if (pool.length === 0 && places.length > 0) {
      // Pool exhausted: reset the day's history with a fresh shuffle.
      seen.clear();
      pool = [...places];
    }
    return shufflePlaces(pool, cycleSeed(sessionSeed, cycles.length));
  }

  function ensureThrough(position: number): void {
    while (
      places.length > 0 &&
      (cycleEnds.length === 0 || position >= cycleEnds[cycleEnds.length - 1]!)
    ) {
      const cycle = buildCycle();
      if (cycle.length === 0) break;
      cycles.push(cycle);
      cycleEnds.push((cycleEnds[cycleEnds.length - 1] ?? 0) + cycle.length);
    }
  }

  function at(position: number): T | null {
    if (!Number.isInteger(position) || position < 0 || places.length === 0) {
      return null;
    }
    ensureThrough(position);
    const ci = cycleEnds.findIndex((end) => position < end);
    if (ci === -1) return null;
    const start = ci === 0 ? 0 : cycleEnds[ci - 1]!;
    return cycles[ci]![position - start] ?? null;
  }

  function markDealtThrough(position: number): void {
    let changed = false;
    for (let i = Math.max(0, startPosition); i <= position; i++) {
      const place = at(i);
      if (place && !seen.has(place.id)) {
        seen.add(place.id);
        changed = true;
      }
    }
    if (changed) store.write([...seen]);
  }

  return { at, markDealtThrough, seenIds: () => [...seen] };
}
