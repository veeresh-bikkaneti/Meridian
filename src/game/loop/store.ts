import {
  LOOP_CORE_DECK_ID,
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
import { getBandConfig, isBandRunConfig } from "../age-profile/run-config.ts";
import { loadProfile } from "../age-profile/store.ts";

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

/** A deck id is a non-empty string ("core" or a pack id like "capitals"). */
function isDeckId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
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
    // Deck id: absent on core mysteries (every pre-pack store), a pack id
    // on pack mysteries.
    (s.deckId === undefined || isDeckId(s.deckId)) &&
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
    (s.dealMaxGuesses === undefined || isPositiveInt(s.dealMaxGuesses)) &&
    // Band-config snapshot + hint usage (follow-up Item A): optional,
    // absent on pre-snapshot stores.
    (s.dealBandConfig === undefined || isBandRunConfig(s.dealBandConfig)) &&
    (s.hintsUsed === undefined || isNonNegativeInt(s.hintsUsed))
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
    // Pack decks: absent on pre-pack stores. When present, every key is a
    // deck id and every value a valid deck state. Shape only: a pack id
    // with no matching pack installed still validates, because the deck
    // is inert data until the pack is dealt from again.
    (s.packDecks === undefined ||
      (typeof s.packDecks === "object" &&
        s.packDecks !== null &&
        !Array.isArray(s.packDecks) &&
        Object.entries(s.packDecks as Record<string, unknown>).every(
          ([id, deck]) => isDeckId(id) && isLoopDeckState(deck),
        ))) &&
    (s.activeDeckId === undefined || isDeckId(s.activeDeckId)) &&
    (s.current === null || isLoopPuzzleState(s.current)) &&
    isNonNegativeInt(s.streak) &&
    // bestStreak is strict here: old blobs missing the field are backfilled
    // to 0 on the load path (readLoopStoreV2) BEFORE this validator runs, so
    // a valid pre-field blob keeps its streak/totals instead of
    // fail-closing to a fresh store (which would wipe the user's streak).
    // Anything else malformed (negative, non-int) still fails closed.
    isNonNegativeInt(s.bestStreak) &&
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
    bestStreak: 0,
    totals: { solved: 0, lost: 0 },
  };
}

/** One pack case as the deck builder needs it: clue-file index + pack tier. */
export interface PackDeckCase {
  index: number;
  /** Fame inside the pack, 1 (most famous) to 3. Design §6. */
  packTier: number;
}

function cryptoRandInt(bound: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! % bound;
}

/** Fisher–Yates over arbitrary values, same RNG contract as shuffleIndexDeck. */
function shuffleValues<T>(
  values: readonly T[],
  randInt: (bound: number) => number = cryptoRandInt,
): T[] {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/**
 * Build a pack deck's deal order: tier bands in order (tier 1 first, then
 * 2, then 3), shuffled inside each band. Famous-first is a property of
 * how the deck is built, not of the deal (design §6, Systems Act-On 3):
 * the deal itself stays a plain head pop for every deck.
 */
export function buildTierBandedDeck(
  cases: readonly PackDeckCase[],
  randInt: (bound: number) => number = cryptoRandInt,
): number[] {
  if (cases.length === 0) {
    throw new Error("buildTierBandedDeck: cases must be a non-empty list");
  }
  const seen = new Set<number>();
  for (const c of cases) {
    if (!isNonNegativeInt(c.index)) {
      throw new Error(`buildTierBandedDeck: bad clue index ${String(c.index)}`);
    }
    if (!Number.isInteger(c.packTier) || c.packTier < 1 || c.packTier > 3) {
      throw new Error(`buildTierBandedDeck: packTier must be 1, 2, or 3, got ${String(c.packTier)}`);
    }
    if (seen.has(c.index)) {
      throw new Error(`buildTierBandedDeck: duplicate clue index ${c.index}`);
    }
    seen.add(c.index);
  }
  const order: number[] = [];
  for (const tier of [1, 2, 3]) {
    order.push(
      ...shuffleValues(
        cases.filter((c) => c.packTier === tier).map((c) => c.index),
        randInt,
      ),
    );
  }
  return order;
}

/** A fresh pack deck state: tier-banded order, cycle 1, nothing completed. */
export function freshPackDeckState(
  cases: readonly PackDeckCase[],
  randInt: (bound: number) => number = cryptoRandInt,
): LoopDeckState {
  return { deck: buildTierBandedDeck(cases, randInt), cycle: 1, cycleCompleted: 0 };
}

/** The deck a puzzle was dealt from: its own deckId, core when absent. */
export function deckIdOfPuzzle(puzzle: LoopPuzzleState): string {
  return puzzle.deckId ?? LOOP_CORE_DECK_ID;
}

/** The deck the next deal comes from: the store's active deck, core when unset. */
export function activeDeckIdOf(store: LoopUnlimitedStore): string {
  return store.activeDeckId ?? LOOP_CORE_DECK_ID;
}

/** Read one deck's state. Returns null for a pack deck that was never built. */
export function getDeckState(store: LoopUnlimitedStore, deckId: string): LoopDeckState | null {
  if (deckId === LOOP_CORE_DECK_ID) return store.deck;
  return store.packDecks?.[deckId] ?? null;
}

/** Write one deck's state back, leaving every other deck untouched. */
export function setDeckState(
  store: LoopUnlimitedStore,
  deckId: string,
  deck: LoopDeckState,
): LoopUnlimitedStore {
  if (deckId === LOOP_CORE_DECK_ID) return { ...store, deck };
  return { ...store, packDecks: { ...store.packDecks, [deckId]: deck } };
}

/**
 * Build a pack deck the first time the pack is dealt from. A deck that
 * already exists is never rebuilt: rebuilding would reshuffle a pack
 * the player has partly played and break exactly-once dealing.
 *
 * Grown packs top up instead (Capitals & Flags design §7): when the
 * manifest now lists MORE cases than the deck was built from, the new
 * cases — tier-banded and shuffled among themselves — are appended to
 * the undealt remainder. Dealt history is untouched: within a cycle,
 * every dealt case is either completed (cycleCompleted), the open
 * mystery, or still in the deck, so the built-from size is exactly
 * deck.length + cycleCompleted + (open mystery from this deck ? 1 : 0).
 * The cases list is the manifest's append-only order (loopIndexes), so
 * the new cases are precisely the tail past that size. Topping up an
 * exhausted deck (cycle complete, nothing open) still works: the new
 * cases deal first, cycleCompleted keeps counting toward the grown
 * pack's celebration, and the next reshuffle rebuilds from the full
 * manifest anyway.
 */
export function ensurePackDeck(
  store: LoopUnlimitedStore,
  packId: string,
  cases: readonly PackDeckCase[],
  randInt: (bound: number) => number = cryptoRandInt,
): LoopUnlimitedStore {
  if (packId === LOOP_CORE_DECK_ID) return store;
  const existing = store.packDecks?.[packId];
  if (!existing) {
    return setDeckState(store, packId, freshPackDeckState(cases, randInt));
  }
  // Only a still-playing mystery counts as open. A finished one (won or
  // lost) stays in `current` until the player deals on, but completePuzzle
  // already counted it in cycleCompleted — counting it here too would
  // skip the first appended case when the pack grows.
  const openFromThisDeck =
    store.current &&
    store.current.status === "playing" &&
    deckIdOfPuzzle(store.current) === packId
      ? 1
      : 0;
  const builtFromSize =
    existing.deck.length + existing.cycleCompleted + openFromThisDeck;
  if (cases.length <= builtFromSize) return store;
  const freshCases = cases.slice(builtFromSize);
  const addition = buildTierBandedDeck(freshCases, randInt);
  return setDeckState(store, packId, {
    ...existing,
    deck: [...existing.deck, ...addition],
  });
}

/**
 * Point the next deal at another deck. The open mystery is not touched:
 * it resumes and completes against the deck it was dealt from.
 */
export function setActiveDeck(
  store: LoopUnlimitedStore,
  deckId: string | undefined,
): LoopUnlimitedStore {
  if (deckId === undefined || deckId === LOOP_CORE_DECK_ID) {
    if (store.activeDeckId === undefined) return store;
    const next = { ...store };
    delete next.activeDeckId;
    return next;
  }
  return { ...store, activeDeckId: deckId };
}

/**
 * Deal one index from a named deck. When the deck runs out, `rebuildOrder`
 * supplies the next cycle's full deal order (core: a fresh shuffle of the
 * pool; pack: a fresh tier-banded build) and the cycle increments. The
 * caller builds the deck first (ensurePackDeck for packs): dealing from a
 * deck that does not exist is a programming error, not a playable state.
 */
export function dealFromDeck(
  store: LoopUnlimitedStore,
  deckId: string,
  rebuildOrder: () => number[],
): { store: LoopUnlimitedStore; index: number; reshuffled: boolean } {
  const deck = getDeckState(store, deckId);
  if (!deck) throw new Error(`dealFromDeck: no deck named "${deckId}"`);
  if (deck.deck.length === 0) {
    const order = rebuildOrder();
    if (order.length === 0) {
      throw new Error(`dealFromDeck: rebuild for deck "${deckId}" is empty`);
    }
    const [index, ...rest] = order;
    const nextDeck: LoopDeckState = { deck: rest, cycle: deck.cycle + 1, cycleCompleted: 0 };
    return { store: setDeckState(store, deckId, nextDeck), index: index!, reshuffled: true };
  }
  const [index, ...rest] = deck.deck;
  return {
    store: setDeckState(store, deckId, { ...deck, deck: rest }),
    index: index!,
    reshuffled: false,
  };
}

/**
 * §7e rollback, deck-aware: a failed deal puts the popped index back on
 * the head of the deck it came from. (returnIndexToDeckHead below stays
 * for the core deck's existing callers.)
 */
export function returnPuzzleIndexToDeck(
  store: LoopUnlimitedStore,
  deckId: string,
  index: number,
): LoopUnlimitedStore {
  const deck = getDeckState(store, deckId);
  if (!deck) return store;
  return setDeckState(store, deckId, returnIndexToDeckHead(deck, index));
}

/**
 * A mystery that was just dealt: the band's starting clues visible, no
 * guesses. `startClues`/`maxGuesses` are the deal-time config — persisted
 * on the puzzle (P0-2) so resume honors the deal band, not the live band.
 * Defaults preserve the shipped tuning.
 *
 * Follow-up Item A: the deal ALSO snapshots the full band run config
 * (getBandConfig(loadProfile().band) — the profile's RAW band, null
 * when unset, so the no-profile hint default rides in the snapshot —
 * called ONCE here) plus a zeroed hintsUsed counter. A mid-mystery
 * band change structurally cannot warp this mystery.
 */
export function freshLoopPuzzleState(
  index: number,
  cycle: number,
  startClues: number = 1,
  maxGuesses: number = LOOP_MAX_GUESSES,
  deckId?: string,
): LoopPuzzleState {
  const dealtClues = Math.min(LOOP_MAX_GUESSES, Math.max(1, startClues));
  return {
    index,
    // Core deals omit the field so core stores keep their pre-pack shape.
    ...(deckId !== undefined && deckId !== LOOP_CORE_DECK_ID ? { deckId } : {}),
    cycle,
    guesses: [],
    status: "playing",
    cluesRevealed: dealtClues,
    completedAt: null,
    streakEndedAt: null,
    completedCycle: false,
    dealStartClues: dealtClues,
    dealMaxGuesses: maxGuesses,
    dealBandConfig: getBandConfig(loadProfile().band),
    hintsUsed: 0,
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
  // Deck-aware: a pack mystery's index lives above the core pool by
  // design (pack cases start at the old pool size), so the core clamp
  // must not discard it. Pack mysteries are clamped against their own
  // pack's index list instead (clampPackDeckToIndexes).
  const current =
    store.current &&
    (deckIdOfPuzzle(store.current) !== LOOP_CORE_DECK_ID || store.current.index < poolSize)
      ? store.current
      : null;
  if (deck.length === store.deck.deck.length && current === store.current) return store;
  return { ...store, deck: { ...store.deck, deck }, current };
}

/**
 * The pack twin of clampDeckToPoolSize, run when a pack manifest loads:
 * drop that pack deck's indexes the manifest no longer lists (a pack
 * shrank between deploys), and discard the open mystery if it is that
 * pack's and its case is gone. Other decks are untouched.
 */
export function clampPackDeckToIndexes(
  store: LoopUnlimitedStore,
  packId: string,
  validIndexes: ReadonlySet<number>,
): LoopUnlimitedStore {
  const deck = getDeckState(store, packId);
  if (!deck) return store;
  const kept = deck.deck.filter((i) => validIndexes.has(i));
  const current =
    store.current &&
    deckIdOfPuzzle(store.current) === packId &&
    !validIndexes.has(store.current.index)
      ? null
      : store.current;
  if (kept.length === deck.deck.length && current === store.current) return store;
  const withDeck = setDeckState(store, packId, { ...deck, deck: kept });
  return { ...withDeck, current };
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
  // The completion lands on the deck the mystery was dealt from, which is
  // not necessarily the active deck (the player may have switched shelves
  // mid-mystery). Streak and totals stay global: a pack miss breaks the
  // streak like any miss (design §6).
  const deckId = deckIdOfPuzzle(finished);
  const deck = getDeckState(store, deckId);
  // The deck shrinks as indexes are dealt, so an empty deck here means this
  // was the last undealt case of that deck's cycle — the reveal celebrates
  // exactly once per cycle per deck. (Seam-pinned plays never pop the deck,
  // so they can't trip this. A missing deck cannot be produced by the deal
  // path; it reads as not-cycle-complete and its counter is left alone.)
  const completedCycle = deck !== null && deck.deck.length === 0;
  const withDeck =
    deck !== null
      ? setDeckState(store, deckId, { ...deck, cycleCompleted: deck.cycleCompleted + 1 })
      : store;
  return {
    ...withDeck,
    streak: won ? store.streak + 1 : 0,
    // bestStreak sees the NEW streak on a win (store.streak + 1) and the
    // ended streak on a loss (store.streak) — a record streak that ends in
    // a loss is still a record. Monotone: it only ever ratchets up.
    bestStreak: Math.max(store.bestStreak, won ? store.streak + 1 : store.streak),
    totals: {
      solved: store.totals.solved + (won ? 1 : 0),
      lost: store.totals.lost + (won ? 0 : 1),
    },
    current: {
      ...finished,
      completedAt,
      streakEndedAt: won ? null : store.streak,
      completedCycle,
    },
  };
}

/** How a session ends (owner ruling, 2026-11-07). */
export type LoopEndFate = "outright" | "pause";

/** One deck's progress, as the session summary reports it. */
export interface LoopDeckProgress {
  deckId: string;
  cycle: number;
  cycleCompleted: number;
  remaining: number;
  openCase: boolean;
}

/** The session summary: closed cases only, plus per-deck progress. */
export interface LoopSessionSummary {
  casesClosed: number;
  solved: number;
  lost: number;
  streak: number;
  bestStreak: number;
  openCaseDeckId: string | null;
  decks: LoopDeckProgress[];
}

/**
 * End a GeoDetective session (owner ruling, 2026-11-07, amended within
 * the minute to offer BOTH capabilities — the player picks, neither is
 * a stray-tap default).
 *
 * "pause": the store is returned unchanged. The in-flight case is
 * preserved exactly — same clue/guess state — because ending the
 * session this way is a screen state, not a store change; Home offers
 * resume from the still-playing `current`, and the case counts once,
 * when it later closes through completePuzzle.
 *
 * "outright": a still-playing `current`'s PROGRESS is discarded — the
 * case is NOT counted as solved or lost, streak/totals/cycle counters
 * are untouched (discarding is not a loss), and it cannot be resumed:
 * its guesses/clue state are destroyed with `current`. The case
 * itself returns to the TAIL (bottom) of its own deck, so the deck
 * accounting identity (closed + open + in-deck = cycle size) stays
 * exact: ensurePackDeck never manufactures a duplicate from a phantom
 * shortfall, and a cycle completes only when every case has truly
 * been closed — the "all / every" celebration copy stays honest. It
 * may be dealt again later in the cycle as a fresh case. (The tail,
 * not the head: the just-ended case must not be the next one dealt —
 * returnPuzzleIndexToDeck's head return is the failed-deal rollback,
 * a different path.) A finished (won/lost) current is left exactly
 * as it is: it already counted when it closed.
 */
export function endSession(store: LoopUnlimitedStore, fate: LoopEndFate): LoopUnlimitedStore {
  if (fate === "pause") return store;
  if (store.current && store.current.status === "playing") {
    const current = store.current;
    const deckId = deckIdOfPuzzle(current);
    const deck = getDeckState(store, deckId);
    const withReturned =
      deck && !deck.deck.includes(current.index)
        ? setDeckState(store, deckId, { ...deck, deck: [...deck.deck, current.index] })
        : store;
    return { ...withReturned, current: null };
  }
  return store;
}

/**
 * Derive the session summary from the store (owner ruling, 2026-11-07).
 * Only closed cases count: casesClosed is totals.solved + totals.lost,
 * copied from the standing totals completePuzzle maintains — there is
 * no session-start snapshot and none is invented. Decks are reported
 * core first, then pack decks in key order, each with its cycle
 * progress and whether the still-playing case (if any) is that deck's.
 */
export function loopSessionSummary(store: LoopUnlimitedStore): LoopSessionSummary {
  const openCaseDeckId =
    store.current && store.current.status === "playing"
      ? deckIdOfPuzzle(store.current)
      : null;
  const deckIds = [LOOP_CORE_DECK_ID, ...Object.keys(store.packDecks ?? {})];
  const decks: LoopDeckProgress[] = [];
  for (const deckId of deckIds) {
    const deck = getDeckState(store, deckId);
    if (!deck) continue;
    decks.push({
      deckId,
      cycle: deck.cycle,
      cycleCompleted: deck.cycleCompleted,
      remaining: deck.deck.length,
      openCase: openCaseDeckId === deckId,
    });
  }
  return {
    casesClosed: store.totals.solved + store.totals.lost,
    solved: store.totals.solved,
    lost: store.totals.lost,
    streak: store.streak,
    bestStreak: store.bestStreak,
    openCaseDeckId,
    decks,
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
    // Load-path backfill: v2 blobs persisted before bestStreak existed lack
    // the field. Default it to 0 BEFORE the validator runs, so a valid old
    // blob keeps its streak/totals — fail-closing it to a fresh store would
    // wipe the user's streak (a REGRESSION). No storage version bump: the
    // fail-closed validator plus this backfill keeps v2 blobs valid.
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      if (obj.bestStreak === undefined) obj.bestStreak = 0;
    }
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
export function peekLoopProgress(): {
  streak: number;
  bestStreak: number;
  inProgress: boolean;
  /** Deck the next deal comes from ("core" when no pack is selected). */
  activeDeckId: string;
} {
  const stored = readLoopStoreV2();
  if (!stored) return { streak: 0, bestStreak: 0, inProgress: false, activeDeckId: LOOP_CORE_DECK_ID };
  return {
    streak: stored.streak,
    // The load path backfills old blobs to 0, so bestStreak is always
    // present here — but the ?? keeps this robust if the contract ever
    // loosens (bestStreak drives no UI yet; the share display convention is
    // the owner's open decision).
    bestStreak: stored.bestStreak ?? 0,
    inProgress: stored.current !== null && stored.current.status === "playing",
    activeDeckId: activeDeckIdOf(stored),
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

/**
 * Remove the unlimited store and the open flag (the "Start over" reset,
 * manifest 2026-10-28 §2). The v1 archive is NEVER touched — it is a
 * deliberately inert namespace, not play history this reset owns.
 * Follows resetProfile()'s precedent: where removal fails, overwrite
 * with the empty value (a zeroed store whose empty deck reshuffles
 * fresh on the next deal; "0" for the flag, which readLoopOpen reads as
 * closed). Returns true only when a re-read proves the store is gone
 * or empty — the reset reports the store as failed otherwise.
 */
export function clearLoopStore(
  target?: Pick<Storage, "getItem" | "setItem" | "removeItem">,
): boolean {
  const s = target ?? storage();
  if (!s) return true; // No storage = nothing was ever persisted.
  try {
    s.removeItem(LOOP_STORAGE_KEY_V2);
  } catch {
    try {
      s.setItem(
        LOOP_STORAGE_KEY_V2,
        JSON.stringify({
          deck: { deck: [], cycle: 1, cycleCompleted: 0 },
          current: null,
          streak: 0,
          bestStreak: 0,
          totals: { solved: 0, lost: 0 },
        }),
      );
    } catch {
      // Both paths blocked; the verification below reports it.
    }
  }
  try {
    s.removeItem(LOOP_OPEN_KEY);
  } catch {
    try {
      s.setItem(LOOP_OPEN_KEY, "0");
    } catch {
      // The verification below reports it.
    }
  }
  try {
    const raw = s.getItem(LOOP_STORAGE_KEY_V2);
    const storeGone =
      raw === null ||
      (() => {
        try {
          const parsed: unknown = JSON.parse(raw);
          return (
            isLoopUnlimitedStore(parsed) &&
            parsed.current === null &&
            parsed.streak === 0 &&
            parsed.totals.solved === 0 &&
            parsed.totals.lost === 0
          );
        } catch {
          return false;
        }
      })();
    return storeGone && s.getItem(LOOP_OPEN_KEY) !== "1";
  } catch {
    return false;
  }
}
