import {
  LOOP_MAX_GUESSES,
  LOOP_STORAGE_KEY,
  type LoopDayState,
  type LoopGuess,
  type LoopStatus,
  type LoopStore,
  type Octant,
} from "./types.ts";
import { loopDateKey } from "./day.ts";

/**
 * localStorage persistence for the Daily Loop, namespaced under
 * `meridian.loop.v1`. The Loop NEVER reads or writes `meridian.run` /
 * `meridian.drop` (the endless-run reload-restore keys) — separate
 * namespace only.
 */

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

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
    (g.warmer === null || typeof g.warmer === "boolean")
  );
}

export function isLoopDayState(value: unknown): value is LoopDayState {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return (
    Array.isArray(s.guesses) &&
    s.guesses.length <= LOOP_MAX_GUESSES &&
    s.guesses.every(isLoopGuess) &&
    isLoopStatus(s.status) &&
    Number.isInteger(s.cluesRevealed) &&
    (s.cluesRevealed as number) >= 1 &&
    (s.cluesRevealed as number) <= LOOP_MAX_GUESSES
  );
}

/** A day with no stored state yet: first clue visible, no guesses. */
export function freshLoopDayState(): LoopDayState {
  return { guesses: [], status: "playing", cluesRevealed: 1 };
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Read the whole archive. Fails closed to {} on missing/blocked storage or malformed JSON. */
export function readLoopStore(): LoopStore {
  const store = storage();
  if (!store) return {};
  let parsed: unknown;
  try {
    const raw = store.getItem(LOOP_STORAGE_KEY);
    if (!raw) return {};
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const out: LoopStore = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (DATE_KEY_RE.test(key) && isLoopDayState(value)) out[key] = value;
  }
  return out;
}

/**
 * Keep only the last 30 days of archived day states (plus anything dated
 * today or later, so clock skew never prunes the day being written).
 */
function pruneStore(store: LoopStore, now = new Date()): LoopStore {
  const cutoff = loopDateKey(new Date(now.getTime() - 30 * 86400000));
  const keys = Object.keys(store)
    .filter((key) => key >= cutoff)
    .sort();
  const kept = keys.slice(-30);
  const out: LoopStore = {};
  for (const key of kept) out[key] = store[key]!;
  return out;
}

/** Write the whole archive, pruning to the last 30 days. */
export function writeLoopStore(store: LoopStore, now = new Date()): void {
  const target = storage();
  if (!target) return;
  try {
    target.setItem(LOOP_STORAGE_KEY, JSON.stringify(pruneStore(store, now)));
  } catch {
    // Blocked storage (private window, quota): the day still lives in memory.
  }
}

/**
 * The state for a UTC date key. Day rollover is implicit: the store is
 * keyed by date, so when the stored key differs from today the old day
 * stays archived in the record and a fresh state is returned.
 */
export function getDayState(dateKey: string): LoopDayState {
  if (!DATE_KEY_RE.test(dateKey)) return freshLoopDayState();
  return readLoopStore()[dateKey] ?? freshLoopDayState();
}

/** Persist one day's state (invalid states are dropped, never written). */
export function saveDayState(dateKey: string, state: LoopDayState, now = new Date()): void {
  if (!DATE_KEY_RE.test(dateKey) || !isLoopDayState(state)) return;
  const store = readLoopStore();
  store[dateKey] = state;
  writeLoopStore(store, now);
}
