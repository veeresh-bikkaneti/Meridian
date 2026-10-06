/**
 * Misses-review deck — spaced repetition over the player's misses.
 *
 * Why: the reveal's growth line ("Good try — you'll get this one") opens a
 * learning loop; the deck closes it by dealing missed places back as a
 * flashcard-style review round. Game-review improvement #1 (approved by
 * Veeresh 2026-10-05).
 *
 * Relationship to `learning.ts`: this module does NOT duplicate the
 * per-place learning records — attempts and mastery stay the single source
 * of truth there. The deck only adds what learning records can't carry:
 * (1) a snapshot of each missed place's original question context (coords,
 * story, edition/region, hit radius, map mode, region bounds), so a review
 * card replays the exact question the player missed, and (2) Leitner-lite
 * scheduling (intervals, due dates). Eligibility and deck exit derive from
 * the learning records: a fresh miss joins the deck; a newly mastered place
 * leaves it.
 *
 * Design constraints (non-negotiable):
 * - Client-side only: localStorage, zero fetch/XHR/beacon. Share/export
 *   paths never see the deck.
 * - Never blocks play: the deck is an invitation, never a gate. An empty
 *   or malformed deck reads as "nothing due".
 * - Fail closed everywhere: malformed entries are dropped; a malformed
 *   store-level payload reads as null (fresh start).
 * - The deck only populates while the `learningOutcomes` flag is on — the
 *   miss hook lives beside the learning-record hook in `onConfirm`.
 *
 * Everything here is pure and unit-testable: the mutating helpers take a
 * store and return a new store; persistence is a thin try/catch wrapper.
 */

import type { Starter } from "./starters.ts";
import type { Difficulty } from "./scoring.ts";

export const REVIEW_DECK_STORE_KEY = "meridian:review-deck:v1";
export const REVIEW_DECK_SCHEMA_VERSION = 1;
/**
 * Synthetic region id for review runs. A review session is a `Run` with
 * this regionId (typed edition "globe") so the PlayLoaded game loop is
 * reused; every review-specific branch keys off this id. Review runs never
 * touch the no-repeat dealing history of real regions (their own namespace
 * is simply never consulted) and never bank into the session.
 */
export const REVIEW_DECK_REGION_ID = "review-deck";
export const REVIEW_DECK_REGION_NAME = "Review deck";
/** Max cards in the deck; overflow evicts the least-urgent (furthest-due) cards. */
export const MAX_DECK_ENTRIES = 60;
/**
 * Leitner-lite review intervals in days, indexed by consecutive successful
 * (hit) reviews. Index 0 = a fresh miss or a miss after success: due
 * immediately, so the player can retry right away.
 */
export const REVIEW_INTERVALS_DAYS = [0, 1, 3, 7, 14, 30] as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const EDITIONS = ["state", "country", "globe"] as const;

/**
 * Everything a review card needs to replay the original question, snapshotted
 * at miss time (in `onConfirm`, where the full `Starter` and run are in
 * scope). Self-contained so review sessions never fetch region chunks.
 */
export type DeckPlaceSnapshot = {
  id: string;
  name: string;
  lon: number;
  lat: number;
  story: string;
  history?: string;
  fact?: string | null;
  curated?: boolean;
  difficulty: Difficulty;
  /** The edition the place was missed in — drives the review question label. */
  edition: "state" | "country" | "globe";
  /** The region the place was missed in (original ids, for labels + metrics). */
  regionId: string;
  regionName: string;
  subdivision?: string;
  iso2?: string;
  originRegionId?: string;
  sourceLabel: string;
  sourceHref: string;
  /** Map projection the original question used. */
  mapMode: "flat" | "globe";
  /** Framing bounds [west, south, east, north] of the original question (flat only). */
  regionBounds?: [number, number, number, number];
  /** The hit radius (km) the miss was judged against — review uses the same bar. */
  radiusKm: number;
};

export type DeckEntry = {
  /** Schema version of this entry payload. */
  v: 1;
  place: DeckPlaceSnapshot;
  /** Consecutive successful (hit) reviews; reset to 0 on any miss. */
  streak: number;
  /** Epoch ms when the card becomes due again. */
  nextDueAt: number;
  /** Epoch ms of the last review attempt (0 = never reviewed). */
  lastReviewedAt: number;
  /** Total review attempts on this card. */
  reviews: number;
};

export type ReviewDeckStore = {
  /** Schema version of the store document. */
  v: 1;
  /** Keyed by placeId. Capped at MAX_DECK_ENTRIES (least-urgent evicted). */
  entries: Record<string, DeckEntry>;
};

/** Kid-friendly copy bank. Reading age ~10; never shaming. */
export const REVIEW_DECK_COPY = {
  /** Picker banner title. */
  pickerTitle: "Review my misses",
  /** Picker banner when cards are due. */
  pickerDueLine: "Turn today's misses into tomorrow's mastery.",
  /** Picker banner when the deck has cards but none are due yet. */
  pickerCaughtUp: "All caught up! New misses will show up here.",
  /** Picker banner when the deck is empty. */
  pickerEmpty: "Miss a place and it'll land here for review.",
  /** Start-review button. */
  startReview: "Start review",
  /** End-game summary button. */
  summaryCta: "Review my misses",
  /** Review session progress. */
  progressOf: "Review",
  /** Review complete headline. */
  completeTitle: "Review complete!",
  /** Back to the edition picker. */
  backToEditions: "Back to editions",
  /** Exit-review button (replaces "End game" during review). */
  exitReview: "Exit review",
} as const;

/** Fresh, empty deck. */
export function emptyReviewDeck(): ReviewDeckStore {
  return { v: REVIEW_DECK_SCHEMA_VERSION, entries: {} };
}

/**
 * Cards due for review now, oldest-due first (ties broken by place id for
 * determinism). This order IS the review session queue.
 */
export function dueEntries(
  store: ReviewDeckStore,
  nowMs: number = Date.now(),
): DeckEntry[] {
  return Object.values(store.entries)
    .filter((e) => e.nextDueAt <= nowMs)
    .sort((a, b) =>
      a.nextDueAt === b.nextDueAt
        ? a.place.id < b.place.id
          ? -1
          : 1
        : a.nextDueAt - b.nextDueAt,
    );
}

/** Deck size + due count for entry-point badges. */
export function deckCounts(
  store: ReviewDeckStore,
  nowMs: number = Date.now(),
): { total: number; due: number } {
  return {
    total: Object.keys(store.entries).length,
    due: dueEntries(store, nowMs).length,
  };
}

/**
 * A miss joins (or rejoins) the deck: due immediately, success streak reset.
 * Refreshes the snapshot so a re-miss replays the latest question context.
 * Pure — returns a new store.
 */
export function upsertMiss(
  store: ReviewDeckStore,
  snapshot: DeckPlaceSnapshot,
  nowMs: number = Date.now(),
): ReviewDeckStore {
  const existing = store.entries[snapshot.id];
  const entries: Record<string, DeckEntry> = {
    ...store.entries,
    [snapshot.id]: {
      v: REVIEW_DECK_SCHEMA_VERSION,
      place: snapshot,
      streak: 0,
      nextDueAt: nowMs,
      lastReviewedAt: existing?.lastReviewedAt ?? 0,
      reviews: existing?.reviews ?? 0,
    },
  };
  // Cap: evict the least-urgent entries (furthest nextDueAt) — never the
  // card that was just added.
  const ids = Object.keys(entries);
  if (ids.length > MAX_DECK_ENTRIES) {
    const victims = ids
      .filter((id) => id !== snapshot.id)
      .map((id) => ({ id, due: entries[id].nextDueAt }))
      .sort((a, b) => (a.due === b.due ? (a.id < b.id ? -1 : 1) : b.due - a.due));
    const over = ids.length - MAX_DECK_ENTRIES;
    for (let i = 0; i < over && i < victims.length; i++) {
      delete entries[victims[i].id];
    }
  }
  return { v: REVIEW_DECK_SCHEMA_VERSION, entries };
}

/**
 * Record one review answer. A hit grows the streak and pushes the next
 * review out along REVIEW_INTERVALS_DAYS; a miss resets the streak and
 * makes the card due again immediately. Unknown placeId → store unchanged.
 * Pure — returns a new store.
 */
export function recordReview(
  store: ReviewDeckStore,
  placeId: string,
  hit: boolean,
  nowMs: number = Date.now(),
): ReviewDeckStore {
  const entry = store.entries[placeId];
  if (!entry) return store;
  const streak = hit ? entry.streak + 1 : 0;
  const intervalDays =
    REVIEW_INTERVALS_DAYS[
      Math.min(streak, REVIEW_INTERVALS_DAYS.length - 1)
    ];
  const next: DeckEntry = {
    ...entry,
    streak,
    nextDueAt: nowMs + intervalDays * DAY_MS,
    lastReviewedAt: nowMs,
    reviews: entry.reviews + 1,
  };
  return {
    v: REVIEW_DECK_SCHEMA_VERSION,
    entries: { ...store.entries, [placeId]: next },
  };
}

/**
 * Drop a card from the deck (a place whose learning record just crossed the
 * mastery bar). Unknown placeId → store unchanged. Pure.
 */
export function removeDeckEntry(
  store: ReviewDeckStore,
  placeId: string,
): ReviewDeckStore {
  if (!store.entries[placeId]) return store;
  const entries = { ...store.entries };
  delete entries[placeId];
  return { v: REVIEW_DECK_SCHEMA_VERSION, entries };
}

/**
 * Rebuild a `Starter` from a deck snapshot for the game loop. Only the
 * fields the loop reads are restored; scheduling fields stay on the entry.
 */
export function deckStarter(entry: DeckEntry): Starter {
  const p = entry.place;
  return {
    id: p.id,
    edition: p.edition,
    regionId: p.regionId,
    name: p.name,
    lon: p.lon,
    lat: p.lat,
    story: p.story,
    sourceLabel: p.sourceLabel,
    sourceHref: p.sourceHref,
    difficulty: p.difficulty,
    history: p.history,
    fact: p.fact,
    curated: p.curated,
    originRegionId: p.originRegionId,
    iso2: p.iso2,
    subdivision: p.subdivision,
  };
}

// ---------------------------------------------------------------------------
// Persistence (localStorage only; fail closed, like learning.ts)
// ---------------------------------------------------------------------------

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function resolveStorage(explicit?: StorageLike): StorageLike | undefined {
  if (explicit) return explicit;
  try {
    return typeof localStorage !== "undefined" ? localStorage : undefined;
  } catch {
    return undefined;
  }
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function isDifficulty(v: unknown): v is Difficulty {
  return v === 1 || v === 2 || v === 3 || v === 4 || v === 5;
}

function isBounds(v: unknown): v is [number, number, number, number] {
  return (
    Array.isArray(v) &&
    v.length === 4 &&
    v.every((n) => isFiniteNumber(n))
  );
}

function isSnapshot(v: unknown): v is DeckPlaceSnapshot {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  if (
    !isNonEmptyString(p.id) ||
    !isNonEmptyString(p.name) ||
    !isFiniteNumber(p.lon) ||
    p.lon < -180 ||
    p.lon > 180 ||
    !isFiniteNumber(p.lat) ||
    p.lat < -90 ||
    p.lat > 90 ||
    typeof p.story !== "string" ||
    !isDifficulty(p.difficulty) ||
    typeof p.edition !== "string" ||
    !(EDITIONS as readonly string[]).includes(p.edition) ||
    !isNonEmptyString(p.regionId) ||
    !isNonEmptyString(p.regionName) ||
    typeof p.sourceLabel !== "string" ||
    typeof p.sourceHref !== "string" ||
    (p.mapMode !== "flat" && p.mapMode !== "globe") ||
    !isFiniteNumber(p.radiusKm) ||
    p.radiusKm <= 0
  ) {
    return false;
  }
  if (p.regionBounds !== undefined && !isBounds(p.regionBounds)) return false;
  for (const k of ["history", "subdivision", "iso2", "originRegionId"] as const) {
    if (p[k] !== undefined && typeof p[k] !== "string") return false;
  }
  if (
    p.fact !== undefined &&
    p.fact !== null &&
    typeof p.fact !== "string"
  ) {
    return false;
  }
  if (p.curated !== undefined && typeof p.curated !== "boolean") return false;
  return true;
}

function isEntry(v: unknown): v is DeckEntry {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  return (
    e.v === REVIEW_DECK_SCHEMA_VERSION &&
    isSnapshot(e.place) &&
    typeof (e as { place: DeckPlaceSnapshot }).place.id === "string" &&
    Number.isInteger(e.streak) &&
    (e.streak as number) >= 0 &&
    isFiniteNumber(e.nextDueAt) &&
    (e.nextDueAt as number) >= 0 &&
    isFiniteNumber(e.lastReviewedAt) &&
    (e.lastReviewedAt as number) >= 0 &&
    Number.isInteger(e.reviews) &&
    (e.reviews as number) >= 0
  );
}

/**
 * Validate a decoded payload. Fail closed: any malformed store-level payload
 * reads as null (fresh start); individual malformed entries are dropped so
 * one bad card can't nuke the whole deck. Unknown schema versions read as
 * null — new keys are issued on version bumps, never in-place format changes.
 */
export function parseReviewDeck(raw: unknown): ReviewDeckStore | null {
  try {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    if (r.v !== REVIEW_DECK_SCHEMA_VERSION) return null;
    const rawEntries = r.entries;
    if (!rawEntries || typeof rawEntries !== "object" || Array.isArray(rawEntries)) {
      return null;
    }
    const entries: Record<string, DeckEntry> = {};
    for (const [id, entry] of Object.entries(rawEntries)) {
      if (
        typeof id === "string" &&
        isEntry(entry) &&
        entry.place.id === id &&
        Object.keys(entries).length < MAX_DECK_ENTRIES
      ) {
        entries[id] = {
          v: REVIEW_DECK_SCHEMA_VERSION,
          place: entry.place,
          streak: entry.streak,
          nextDueAt: entry.nextDueAt,
          lastReviewedAt: entry.lastReviewedAt,
          reviews: entry.reviews,
        };
      }
    }
    return { v: REVIEW_DECK_SCHEMA_VERSION, entries };
  } catch {
    return null;
  }
}

/**
 * Read the deck from localStorage. Fail closed: any malformed payload reads
 * as null — the caller starts from an empty deck and the app never breaks
 * on bad deck data.
 */
export function readReviewDeck(storage?: StorageLike): ReviewDeckStore | null {
  try {
    const s = resolveStorage(storage);
    if (!s) return null;
    const raw = s.getItem(REVIEW_DECK_STORE_KEY);
    if (!raw) return null;
    return parseReviewDeck(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Write the deck to localStorage. Fail closed: storage errors are
 *  swallowed — the game must never break on deck data. */
export function writeReviewDeck(store: ReviewDeckStore, storage?: StorageLike): void {
  try {
    const s = resolveStorage(storage);
    if (!s) return;
    s.setItem(REVIEW_DECK_STORE_KEY, JSON.stringify(store));
  } catch {
    // Storage blocked or full; the game must never break on deck data.
  }
}
