import {
  LOOP_MAX_GUESSES,
  LOOP_OPEN_KEY,
  LOOP_STORAGE_KEY_V2,
  type LoopDeckState,
  type LoopGuess,
  type LoopPuzzleState,
  type LoopStatus,
  type LoopUnlimitedStore,
  type Octant,
} from "./types.ts";
import { maxGuessCap } from "../age-profile/difficulty.ts";

/**
 * localStorage persistence for the GeoDetective's unlimited mode,
 * namespaced under `meridian.loop.v2` — one JSON blob for the whole store:
 * the shuffled deck, the open mystery, the streak, and lifetime totals.
 *
 * The Loop NEVER reads or writes `meridian.run` / `meridian.drop` (the
 * endless-run reload-restore keys), and it never touches the daily-era
 * `meridian.loop.v1` archive — separate namespace only.
 */

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A real UTC calendar date in "YYYY-MM-DD" form (rejects rollovers like 2026-02-30). */
function isUtcDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_KEY_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m! < 1 || m! > 12 || d! < 1 || d! > 31) return false;
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d;
}

function isOctant(value: unknown): value is Octant {
  return (
    value === "north" ||
    value === "north-east" ||
    value === "east" ||
    value === "south-east" ||
    value === "south" ||
    value === "south-west" ||
    value === "west" ||
    value === "north-west"
  );
}

function isLoopStatus(value: unknown): value is LoopStatus {
  return value === "playing" || value === "won" || value === "lost";
}

function isNonNegativeInt(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isPositiveInt(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1;
}

function isLoopGuess(value: unknown): value is LoopGuess {
  if (!value || typeof value !== "object") return false;
  const g = value as Record<string, unknown>;
  return (
    typeof g.name === "string" &&
    g.name.length > 0 &&
    typeof g.placeId === "string" &&
    g.placeId.length > 0 &&
    typeof g.distKm === "number" &&
    Number.isFinite(g.distKm) &&
    g.distKm >= 0 &&
    isOctant(g.octant) &&
    (g.warmer === null || typeof g.warmer === "boolean") &&
    // Map-era coordinates: optional for pre-map days, finite when present.
    (g.lon === undefined ||
      (typeof g.lon === "number" && Number.isFinite(g.lon) && g.lon >= -180 && g.lon <= 180)) &&
    (g.lat === undefined ||
      (typeof g.lat === "number" && Number.isFinite(g.lat) && g.lat >= -90 && g.lat <= 90))
  );
}

function isLoopDeckState(value: unknown): value is LoopDeckState {
  if (!value || typeof value !== "object") return false;
  const d = value as Record<string, unknown>;
  return (
    Array.isArray(d.deck) &&
    (d.deck as unknown[]).every(isNonNegativeInt) &&
    Number.isInteger(d.cycle) &&
    (d.cycle as number) >= 1 &&
    isNonNegativeInt(d.cycleCompleted)
  );
}

export function isLoopPuzzleState(value: unknown): value is LoopPuzzleState {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return (
    isNonNegativeInt(s.index) &&
    Number.isInteger(s.cycle) &&
    (s.cycle as number) >= 1 &&
    Array.isArray(s.guesses) &&
    // P0-1: bound by the largest cap any band's deal can legally produce
    // (the 8-10 deal plays 6 guesses), NOT the shipped LOOP_MAX_GUESSES
    // default — a 6-guess 8-10 mystery is legal and must persist.
    s.guesses.length <= MAX_DEAL_GUESS_CAP &&
    (s.guesses as unknown[]).every(isLoopGuess) &&
    isLoopStatus(s.status) &&
    Number.isInteger(s.cluesRevealed) &&
    (s.cluesRevealed as number) >= 1 &&
    (s.cluesRevealed as number) <= LOOP_MAX_GUESSES &&
    (s.completedAt === null || isUtcDateKey(s.completedAt)) &&
    (s.streakEndedAt === null || isNonNegativeInt(s.streakEndedAt)) &&
    // completedCycle is new: absent on pre-celebration stores, boolean after.
    (s.completedCycle === undefined || typeof s.completedCycle === "boolean") &&
    // Deal-time config snapshot (P0-2): optional, absent on pre-snapshot
    // stores — resume falls back to the live band then.
    (s.dealStartClues === undefined || isPositiveInt(s.dealStartClues)) &&
    (s.dealMaxGuesses === undefined || isPositiveInt(s.dealMaxGuesses))
  );
}

/**
 * Largest guess count any band's deal can legally produce — the
 * validator's bound for `guesses.length`, derived from the band table via
 * maxGuessCap(). The band table is static, so this is computed once.
 */
const MAX_DEAL_GUESS_CAP = maxGuessCap();

export function isLoopUnlimitedStore(value: unknown): value is LoopUnlimitedStore {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  const totals = s.totals as Record<string, unknown> | undefined;
  return (
    isLoopDeckState(s.deck) &&
    (s.current === null || isLoopPuzzleState(s.current)) &&
    isNonNegativeInt(s.streak) &&
    !!totals &&
    isNonNegativeInt(totals.solved) &&
    isNonNegativeInt(totals.lost)
  );
}

/**
 * Fisher–Yates shuffle of [0..poolSize), dealt head-first. RNG is Web
 * Crypto (`crypto.getRandomValues`) — unguessable, no seed management.
 * `randInt` is injectable for unit tests only; production always uses
 * crypto (never Math.random, never seeded).
 */
export function shuffleIndexDeck(
  poolSize: number,
  randInt: (bound: number) => number = (bound) => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0]! % bound;
  },
): number[] {
  if (!Number.isInteger(poolSize) || poolSize <= 0) {
    throw new Error("shuffleIndexDeck: poolSize must be a positive integer");
  }
  const deck = Array.from({ length: poolSize }, (_, i) => i);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    const tmp = deck[i]!;
    deck[i] = deck[j]!;
    deck[j] = tmp;
  }
  return deck;
}

/** A fresh store: new shuffled deck, no open mystery, zeroed stats. */
export function freshLoopUnlimitedStore(poolSize: number): LoopUnlimitedStore {
  return {
    deck: { deck: shuffleIndexDeck(poolSize), cycle: 1, cycleCompleted: 0 },
    current: null,
    streak: 0,
    totals: { solved: 0, lost: 0 },
  };
}

/**
 * A mystery that was just dealt: the band's starting clues visible, no
 * guesses. `startClues`/`maxGuesses` are the deal-time config — persisted
 * on the puzzle (P0-2) so resume honors the deal band, not the live band.
 * Defaults preserve the shipped tuning.
 */
export function freshLoopPuzzleState(
  index: number,
  cycle: number,
  startClues: number = 1,
  maxGuesses: number = LOOP_MAX_GUESSES,
): LoopPuzzleState {
  const dealtClues = Math.min(LOOP_MAX_GUESSES, Math.max(1, startClues));
  return {
    index,
    cycle,
    guesses: [],
    status: "playing",
    cluesRevealed: dealtClues,
    completedAt: null,
    streakEndedAt: null,
    completedCycle: false,
    dealStartClues: dealtClues,
    dealMaxGuesses: maxGuesses,
  };
}

/**
 * Deal one puzzle index from the deck (head = next to deal). When the
 * deck is empty the pool is exhausted: a fresh shuffled deck starts
 * silently and `cycle` increments. Every index is dealt exactly once per
 * cycle.
 */
export function dealPuzzleIndex(
  deck: LoopDeckState,
  poolSize: number,
): { deck: LoopDeckState; index: number; reshuffled: boolean } {
  if (deck.deck.length === 0) {
    const next: LoopDeckState = {
      deck: shuffleIndexDeck(poolSize),
      cycle: deck.cycle + 1,
      cycleCompleted: 0,
    };
    const [index, ...rest] = next.deck;
    return { deck: { ...next, deck: rest }, index: index!, reshuffled: true };
  }
  const [index, ...rest] = deck.deck;
  return { deck: { ...deck, deck: rest }, index: index!, reshuffled: false };
}

/**
 * §7e rollback: a clue-file 404 fails the deal, so the popped index goes
 * back on the deck head — the deck stays exactly-once.
 */
export function returnIndexToDeckHead(deck: LoopDeckState, index: number): LoopDeckState {
  return { ...deck, deck: [index, ...deck.deck] };
}

/**
 * §7h: the manifest's pool size changed between deploys. Drop deck
 * indexes that no longer exist (pool shrank); discard an open mystery
 * whose index is out of range (treat as abandoned — deal fresh).
 * A grown pool needs no merge: new indexes appear at the next reshuffle.
 */
export function clampDeckToPoolSize(
  store: LoopUnlimitedStore,
  poolSize: number,
): LoopUnlimitedStore {
  const deck = store.deck.deck.filter((i) => i < poolSize);
  const current =
    store.current && store.current.index < poolSize ? store.current : null;
  if (deck.length === store.deck.deck.length && current === store.current) return store;
  return { ...store, deck: { ...store.deck, deck }, current };
}

/**
 * Record a finished mystery. The puzzle is consumed (it left the deck at
 * deal time); the streak moves (+1 on win, reset on loss — nothing else
 * touches it); totals and the cycle counter advance; the completion date
 * is stamped for the share text. A loss also records the streak value it
 * ended so the reveal can name it after a reload.
 */
export function completePuzzle(
  store: LoopUnlimitedStore,
  finished: LoopPuzzleState,
  completedAt: string,
): LoopUnlimitedStore {
  const won = finished.status === "won";
  // The deck shrinks as indexes are dealt, so an empty deck here means this
  // was the last undealt case of the cycle — the reveal celebrates exactly
  // once per cycle. (Seam-pinned plays never pop the deck, so they can't
  // trip this.)
  const completedCycle = store.deck.deck.length === 0;
  return {
    ...store,
    streak: won ? store.streak + 1 : 0,
    totals: {
      solved: store.totals.solved + (won ? 1 : 0),
      lost: store.totals.lost + (won ? 0 : 1),
    },
    deck: { ...store.deck, cycleCompleted: store.deck.cycleCompleted + 1 },
    current: {
      ...finished,
      completedAt,
      streakEndedAt: won ? null : store.streak,
      completedCycle,
    },
  };
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Raw read of the v2 blob. Returns null on missing/blocked storage or
 * malformed JSON — the caller fail-closes (see loadLoopStore). Never
 * throws; never touches the v1 archive.
 */
export function readLoopStoreV2(): LoopUnlimitedStore | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(LOOP_STORAGE_KEY_V2);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isLoopUnlimitedStore(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Load the store for play: read, validate, clamp to the manifest's pool
 * size. Any shape failure fail-closes to a fresh store — a malformed blob
 * never blocks play.
 */
export function loadLoopStore(poolSize: number): LoopUnlimitedStore {
  const stored = readLoopStoreV2();
  if (!stored) return freshLoopUnlimitedStore(poolSize);
  return clampDeckToPoolSize(stored, poolSize);
}

/** Persist the v2 blob (invalid shapes are dropped, never written).
 * Fail-silent when storage is blocked — the session continues in memory.
 * Known limitation: no cross-tab lock — two tabs playing concurrently are
 * last-writer-wins and could double-deal an index. Out of scope: the
 * product is a single-tab phone game. */
export function writeLoopStoreV2(store: LoopUnlimitedStore): void {
  if (!isLoopUnlimitedStore(store)) return;
  const target = storage();
  if (!target) return;
  try {
    target.setItem(LOOP_STORAGE_KEY_V2, JSON.stringify(store));
  } catch {
    // Blocked storage (private window, quota): the session still lives in memory.
  }
}

/**
 * Lightweight progress peek for the edition menu: streak + whether a
 * mystery is mid-play (resume variant). Never builds a deck, never
 * writes — safe to call on the menu without a manifest.
 */
export function peekLoopProgress(): { streak: number; inProgress: boolean } {
  const stored = readLoopStoreV2();
  if (!stored) return { streak: 0, inProgress: false };
  return {
    streak: stored.streak,
    inProgress: stored.current !== null && stored.current.status === "playing",
  };
}

function storageAvailable(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

/**
 * Whether the loop screen was open when the tab last closed/reloaded.
 * Unchanged in the unlimited era: a mid-game reload reopens the screen
 * and the screen itself resumes-or-deals instead of day-keying.
 */
export function readLoopOpen(): boolean {
  if (!storageAvailable()) return false;
  try {
    return localStorage.getItem(LOOP_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

/** Record the loop screen's open state (fail-silent when storage is blocked). */
export function writeLoopOpen(open: boolean): void {
  if (!storageAvailable()) return;
  try {
    if (open) localStorage.setItem(LOOP_OPEN_KEY, "1");
    else localStorage.removeItem(LOOP_OPEN_KEY);
  } catch {
    /* private-mode storage: the loop screen still works for the session */
  }
}
