import { hashString } from "./daily.ts";
import { asFameTier } from "./tier-filter.ts";

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

/**
 * Small deterministic PRNG (mulberry32), implemented locally so the
 * weighted dealer needs no external dependency. Pure: the same seed always
 * yields the same sequence.
 */
function deterministicRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic Fisher-Yates shuffle driven by an explicit seed. Pure. */
export function shufflePlaces<T>(places: T[], seed: number): T[] {
  const ordered = [...places];
  const random = deterministicRandom(seed >>> 0);
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
 * consecutive cycles normally deal different orders. Pure.
 */
export function cycleSeed(sessionSeed: number, cycle: number): number {
  return hashString(`${sessionSeed >>> 0}:${cycle}`);
}

/** Places carrying an optional fame difficulty tier (1 = most famous). */
export type DifficultyTiered = {
  readonly difficulty?: unknown;
};

/**
 * Fame weight for weighted dealing: w = 6 - tier, so tier 1 (most famous)
 * deals with weight 5 and tier 5 (most obscure) with weight 1. Places with
 * missing or invalid difficulty count as tier 3 (w = 3), keeping pre-tier
 * catalogs dealing uniformly. Pure.
 *
 * Takes a plain `object` so it can serve as a weight function over any
 * place list; read the tier through `DifficultyTiered`.
 */
export function difficultyWeight(place: object): number {
  const d = (place as DifficultyTiered).difficulty;
  return 6 - asFameTier(d);
}

/**
 * Weighted shuffle without replacement (Efraimidis–Spirakis): each place
 * draws key = U^(1/w) with U ~ Uniform(0,1) from the seeded PRNG, and the
 * places sort by descending key. Heavier places land earlier on average,
 * but every place appears exactly once per shuffle — no repeats within a
 * cycle, full coverage per cycle. Deterministic per seed; pure. Weights
 * must be positive; non-positive weights deterministically sink to the end.
 */
export function weightedShufflePlaces<T>(
  places: T[],
  seed: number,
  weightFn: (place: T) => number,
): T[] {
  const random = deterministicRandom(seed >>> 0);
  const keyed = places.map((place, index) => {
    const weight = weightFn(place);
    const key =
      weight > 0 ? Math.pow(random(), 1 / weight) : Number.NEGATIVE_INFINITY;
    return { place, key, index };
  });
  // Index tie-break keeps the sort total and deterministic even on the
  // (practically impossible) event of equal keys.
  keyed.sort((a, b) => b.key - a.key || a.index - b.index);
  return keyed.map((entry) => entry.place);
}

/** Persistence for the seen place IDs (the no-repeat history). */
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

const SEEN_KEY_PREFIX = "meridian:seen:v2:";
const LEGACY_SEEN_KEY_PREFIX = "meridian:seen:v1:";

function seenKey(edition: string, regionId: string): string {
  return `${SEEN_KEY_PREFIX}${edition}:${regionId}`;
}

/** Read a JSON string-array storage entry, tolerating missing or corrupt data. */
function readIdList(
  storage: Pick<Storage, "getItem">,
  key: string,
): string[] {
  try {
    const raw = storage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

/**
 * Fold one legacy v1 day-keyed entry (`meridian:seen:v1:<day>:<edition>:<region>`)
 * into its v2 counterpart, unioning the surviving history. Malformed keys or
 * entries are skipped (the key is still pruned by the caller).
 */
function migrateV1Entry(
  storage: Pick<Storage, "getItem" | "setItem">,
  v1key: string,
): void {
  const rest = v1key.slice(LEGACY_SEEN_KEY_PREFIX.length).split(":");
  if (rest.length < 3) return;
  const [day, edition, ...regionParts] = rest as [string, string, ...string[]];
  const regionId = regionParts.join(":");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !edition || !regionId) return;
  const legacyIds = readIdList(storage, v1key);
  if (legacyIds.length === 0) return;
  const v2key = seenKey(edition, regionId);
  const merged = new Set([...readIdList(storage, v2key), ...legacyIds]);
  try {
    storage.setItem(v2key, JSON.stringify([...merged]));
  } catch {
    // Quota or blocked storage: the v1 key is still pruned; the game
    // continues in memory.
  }
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
 * localStorage-backed seen store, scoped to one edition/region and persistent
 * across days, reloads, and restarts on this device. This is the no-repeat
 * history: a place is never dealt again until every other place in the
 * region's pool has been dealt (a full cycle), no matter how many days pass.
 * Writes migrate-then-prune legacy v1 day-keyed entries (one-time migration);
 * the history itself is only cleared when a cycle completes (see
 * poolForNewRun), so storage stays bounded by the region catalog's size.
 * Falls back to memory when storage is unavailable.
 */
export function seenStoreFor(edition: string, regionId: string): SeenStore {
  const storage = safeStorage();
  if (!storage) return memorySeenStore();
  const key = seenKey(edition, regionId);
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
        // One-time migration: fold any surviving legacy v1 day-keyed entries
        // (meridian:seen:v1:<day>:<edition>:<region>) into their v2
        // counterparts, so players keep their current no-repeat history
        // across the upgrade instead of re-seeing today's places. Then prune
        // the v1 keys. Idempotent: after the first pass no v1 keys remain.
        const doomed: string[] = [];
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i);
          if (k && k.startsWith(LEGACY_SEEN_KEY_PREFIX)) {
            doomed.push(k);
          }
        }
        for (const v1key of doomed) {
          migrateV1Entry(storage, v1key);
          storage.removeItem(v1key);
        }
      } catch {
        // Quota or blocked storage: the game continues in memory.
      }
    },
  };
}

export type NewRunPool = {
  /** Place IDs available to the new run, in catalog order. */
  poolIds: string[];
  /**
   * ID of the most recently dealt place in the previous cycle (null on a
   * brand-new history). Handed to the dealer so it can avoid dealing the
   * same place twice across the cycle boundary.
   */
  prevLastId: string | null;
};

/**
 * Build the dealing pool for a new run: the region catalog minus the
 * device's persistent no-repeat history for this edition/region. When every
 * place has been dealt (the history covers the catalog), the cycle is
 * complete: the history resets and the new run deals a freshly shuffled full
 * catalog. Never returns an empty pool for a non-empty catalog (fail-closed
 * dealing is the dealer's job: an empty pool deals nothing).
 *
 * The history outlives days, reloads, and restarts — "tomorrow" is just
 * another session over the same persistent history.
 */
export function poolForNewRun<T extends { id: string }>(
  catalog: T[],
  store: SeenStore = memorySeenStore(),
): NewRunPool {
  const seenOrder = store.read();
  const seen = new Set(seenOrder);
  let fresh = catalog.filter((place) => !seen.has(place.id));
  const prevLastId =
    seenOrder.length > 0 ? seenOrder[seenOrder.length - 1]! : null;
  if (fresh.length === 0 && catalog.length > 0) {
    // Full cycle complete: reset the persistent history so the next cycle
    // deals every place again, in a new order. prevLastId is kept — it is
    // the previous cycle's final deal, used for the boundary check.
    store.write([]);
    fresh = [...catalog];
  }
  return { poolIds: fresh.map((place) => place.id), prevLastId };
}

export type Dealer<T extends { id: string }> = {
  /**
   * Place at absolute 0-based position across cycles. Cycles are built
   * lazily: each new cycle shuffles the still-unseen pool (or the full pool
   * after exhaustion) with a per-cycle seed, so consecutive cycles differ.
   * Returns null when the pool is empty.
   *
   * The pool is fixed for the dealer's lifetime: it is computed once per
   * run (catalog minus the persistent no-repeat history) and persisted on
   * the run, so a reload rebuilds the identical pool and `at(position)` is
   * stable across reloads. The store is only written (never read for
   * filtering).
   */
  at: (position: number) => T | null;
  /**
   * Record positions `startPosition..position` as dealt and persist the
   * no-repeat history. Positions below startPosition belong to a previous
   * incarnation of this run (e.g. before a reload) and are already recorded.
   */
  markDealtThrough: (position: number) => void;
};

/**
 * Endless dealer: per-session shuffle, per-cycle reseed, persistent
 * no-repeat history. Seen places are skipped until the pool is exhausted,
 * at which point the history resets with a fresh shuffle.
 *
 * `pool` is the run's fixed place list (catalog minus the persistent
 * no-repeat history at run start, computed once by poolForNewRun and
 * persisted on the run). The dealer shuffles this pool deterministically
 * from the session seed, so every position maps to the same place for the
 * run's lifetime — including across reloads. The store receives dealt IDs
 * (for future runs' no-repeat) but is never read for pool filtering, which
 * keeps resume-after-reload exact.
 *
 * `prevLastId` is the previous cycle's final deal (null on a brand-new
 * history). The first cycle avoids opening with it, and every later cycle
 * avoids opening with the previous cycle's last deal, so a place never
 * repeats across a cycle boundary. Persist it on the run alongside the pool
 * and seed — a resumed run must make the identical boundary decision.
 *
 * `startPosition` is the run index the dealer is created at (0 for a fresh
 * run, the resumed index after a reload): earlier positions were dealt by a
 * previous incarnation and must not be re-marked, but their IDs are
 * restored into the turnover accounting so cycle resets stay correct.
 */
export function createDealer<T extends { id: string }>(
  pool: T[],
  sessionSeed: number,
  store: SeenStore = memorySeenStore(),
  startPosition = 0,
  prevLastId: string | null = null,
): Dealer<T> {
  const places = [...pool];
  const seen = new Set<string>();
  const cycles: T[][] = [];
  const cycleEnds: number[] = []; // cumulative exclusive end position per cycle
  // Most recent deal before the current cycle: prevLastId for the first
  // cycle, then each built cycle's last place. Used for the boundary check.
  let boundaryId: string | null = prevLastId;

  function buildCycle(): T[] {
    let cyclePool = places.filter((place) => !seen.has(place.id));
    if (cyclePool.length === 0 && places.length > 0) {
      // Pool exhausted: reset with a fresh shuffle.
      seen.clear();
      cyclePool = [...places];
    }
    const cycle = weightedShufflePlaces(
      cyclePool,
      cycleSeed(sessionSeed, cycles.length),
      (place) => difficultyWeight(place),
    );
    if (
      cycle.length > 1 &&
      boundaryId !== null &&
      cycle[0]!.id === boundaryId
    ) {
      // Avoid an immediate boundary repeat: swap the first place with the
      // last. Cycle IDs are unique, so the last slot cannot also hold
      // boundaryId — after the swap the cycle provably opens with a
      // different place.
      const last = cycle.length - 1;
      const first = cycle[0]!;
      cycle[0] = cycle[last]!;
      cycle[last] = first;
    }
    if (cycle.length > 0) boundaryId = cycle[cycle.length - 1]!.id;
    return cycle;
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

  // Restore turnover accounting for positions dealt before a reload: at()
  // is deterministic over the fixed pool+seed, so re-deriving their IDs is
  // exact. (markDealtThrough's startPosition guard already prevents
  // re-persisting them.)
  for (let i = 0; i < Math.max(0, startPosition); i++) {
    const place = at(i);
    if (place) seen.add(place.id);
  }

  function markDealtThrough(position: number): void {
    const newlyMarked: string[] = [];
    for (let i = Math.max(0, startPosition); i <= position; i++) {
      const place = at(i);
      if (place && !seen.has(place.id)) {
        seen.add(place.id);
        newlyMarked.push(place.id);
      }
    }
    if (newlyMarked.length > 0) {
      // Persist the union of the newly dealt IDs with any previous
      // sessions' history already in the store. Positions below
      // startPosition were dealt (and persisted) by a previous incarnation
      // and are never re-marked.
      const known = new Set(store.read());
      for (const id of newlyMarked) known.add(id);
      store.write([...known]);
    }
  }

  return { at, markDealtThrough };
}
