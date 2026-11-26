/**
 * The storage key registry — every saved value's key string,
 * schema and fallback, written once, here.
 *
 * Stores import their key's entry from this registry instead of
 * repeating the string, so two stores can never drift onto
 * different keys for the same data. The strings match the ones
 * the domain stores already own (storage-keys.test.ts pins them
 * equal), because the saved data on players' devices sits under
 * those strings today.
 */

import { z } from "zod";

import type { ReadAloudPrefOrUnset } from "../../game/age-profile/read-aloud-pref.ts";
import type { StorageKeyDef } from "./storage.ts";

/** Per-subject progress: which cases each subject has finished. */
const subjectProgress: StorageKeyDef<Record<string, string[]>> = {
  key: "meridian.subject-progress.v1",
  schema: z.record(z.string(), z.array(z.string())),
  fallback: {},
};

/**
 * The kid's read-aloud answer. This entry pins the key string
 * and describes the parsed answer value — exactly the values
 * the preference store accepts, with that store's own default
 * ("unset", the answer not yet given) as the fallback. The
 * stored record's shape and validation stay with the domain
 * reader in read-aloud-pref.ts: on disk the answer sits inside
 * a versioned record, so this def is not used to read the
 * stored record.
 */
const readAloudPref: StorageKeyDef<ReadAloudPrefOrUnset> = {
  key: "meridian.readAloudPref.v1",
  schema: z.enum(["always", "sometimes", "never"]),
  fallback: "unset",
};

/**
 * The age profile blob. This entry pins the key string for future
 * consumers only: the blob's real validation and legacy migration
 * stay with validateProfile in the domain store, so the schema
 * here checks nothing and the fallback is null.
 */
const ageProfile: StorageKeyDef<unknown> = {
  key: "meridian.ageProfile.v1",
  schema: z.unknown(),
  fallback: null,
};

/**
 * Grown-up gate cooldown: the epoch millis the gate unlocks at.
 * Decimal-number bytes, read with Number() today, so the schema
 * is numeric and the fallback (0) reads as expired — the same
 * as no stored value.
 */
const grownupCooldown: StorageKeyDef<number> = {
  key: "meridian.grownupCooldown.v1",
  schema: z.number(),
  fallback: 0,
};

/** Grown-up gate strike record. Validation stays in the domain reader. */
const grownupStrikes: StorageKeyDef<unknown> = {
  key: "meridian.grownupStrikes.v1",
  schema: z.unknown(),
  fallback: null,
};

/** Cold Trail run state. Validation stays in the domain reader. */
const coldtrailStore: StorageKeyDef<unknown> = {
  key: "meridian.coldtrail.v2",
  schema: z.unknown(),
  fallback: null,
};

/** Cold Trail pack progress (capitals pack). Validation stays in the domain reader. */
const coldtrailPack: StorageKeyDef<unknown> = {
  key: "meridian.coldtrail.pack.capitals.v1",
  schema: z.unknown(),
  fallback: null,
};

/** Pack shelf selection. Validation stays in the domain reader. */
const packShelfSelection: StorageKeyDef<unknown> = {
  key: "meridian.pack-shelf.v1",
  schema: z.unknown(),
  fallback: null,
};

/** Legacy Cold Trail run state (v1), migrated on read. Validation stays in the domain reader. */
const coldtrailLegacy: StorageKeyDef<unknown> = {
  key: "meridian.coldtrail.v1",
  schema: z.unknown(),
  fallback: null,
};

/** Cold Trail open flag: the bare "1" bytes predate the port. */
const coldtrailOpen: StorageKeyDef<string> = {
  key: "meridian.coldtrail.open",
  schema: z.string(),
  fallback: "",
  encoding: "raw",
};

/** The current play session. Validation stays in the domain reader. */
const session: StorageKeyDef<unknown> = {
  key: "meridian.session",
  schema: z.unknown(),
  fallback: null,
};

/** Discarded-game notice shadow. Validation stays in the domain reader. */
const discardedNotice: StorageKeyDef<unknown> = {
  key: "meridian.discarded-notice",
  schema: z.unknown(),
  fallback: null,
};

/** GeoDetective run state. Validation stays in the domain reader. */
const loopStore: StorageKeyDef<unknown> = {
  key: "meridian.loop.v2",
  schema: z.unknown(),
  fallback: null,
};

/** GeoDetective open flag: the bare "1" bytes predate the port. */
const loopOpen: StorageKeyDef<string> = {
  key: "meridian.loop.open",
  schema: z.string(),
  fallback: "",
  encoding: "raw",
};

/** Passport badges. Validation stays in the domain reader. */
const passportBadges: StorageKeyDef<unknown> = {
  key: "meridian.passport.badges.v1",
  schema: z.unknown(),
  fallback: null,
};

/**
 * Chunk-reload guard stamp: the epoch millis of the last
 * chunk-failure reload. Decimal-number bytes, read with
 * Number() today — a bare-epoch stamp must never read as
 * fallback, or the guard would allow an unbounded reload loop.
 */
const chunkReloadAt: StorageKeyDef<number> = {
  key: "meridian.chunkReloadAt",
  schema: z.number(),
  fallback: 0,
};

/** Chunk-recovery episode record. Validation stays in the domain reader. */
const chunkRecovery: StorageKeyDef<unknown> = {
  key: "meridian.chunkRecovery",
  schema: z.unknown(),
  fallback: null,
};

/** Chunk-reload surface: a bare surface name, predating the port. */
const chunkReloadSurface: StorageKeyDef<string> = {
  key: "meridian.chunkReloadSurface",
  schema: z.string(),
  fallback: "unknown",
  encoding: "raw",
};

/** Chunk-reload notice stamp: epoch millis, read with Number(). */
const chunkReloadNotice: StorageKeyDef<number> = {
  key: "meridian.chunkReloadNotice",
  schema: z.number(),
  fallback: 0,
};

/** Retry-screen marker: a bare surface name, predating the port. */
const retryScreen: StorageKeyDef<string> = {
  key: "meridian.retry-screen",
  schema: z.string(),
  fallback: "",
  encoding: "raw",
};

/** Learning store. Validation stays in the domain reader. */
const learningStore: StorageKeyDef<unknown> = {
  key: "meridian:learning:v1",
  schema: z.unknown(),
  fallback: null,
};

/** Challenge attempts. Validation stays in the domain reader. */
const challengeAttempts: StorageKeyDef<unknown> = {
  key: "meridian.challenge.attempts.v1",
  schema: z.unknown(),
  fallback: null,
};

/** Review deck. Validation stays in the domain reader. */
const reviewDeck: StorageKeyDef<unknown> = {
  key: "meridian:review-deck:v1",
  schema: z.unknown(),
  fallback: null,
};

/** Tutorial seen flag: the bare "1" bytes predate the port. */
const tutorialSeen: StorageKeyDef<string> = {
  key: "meridian.tutorialSeen",
  schema: z.string(),
  fallback: "",
  encoding: "raw",
};

/** Clean-exit flag: the bare "1"/"0" bytes predate the port. */
const cleanExit: StorageKeyDef<string> = {
  key: "meridian.cleanExit",
  schema: z.string(),
  fallback: "1",
  encoding: "raw",
};

/** Paused GeoDetective run. Validation stays in the domain reader. */
const pausedRun: StorageKeyDef<unknown> = {
  key: "meridian.run",
  schema: z.unknown(),
  fallback: null,
};

/** Paused second-run slot. Validation stays in the domain reader. */
const pausedRunMc2: StorageKeyDef<unknown> = {
  key: "meridian.run.mc2",
  schema: z.unknown(),
  fallback: null,
};

/** Paused third-run slot. Validation stays in the domain reader. */
const pausedRunMc3: StorageKeyDef<unknown> = {
  key: "meridian.run.mc3",
  schema: z.unknown(),
  fallback: null,
};

/** Paused-run current-place drop. Validation stays in the domain reader. */
const pausedDrop: StorageKeyDef<unknown> = {
  key: "meridian.drop",
  schema: z.unknown(),
  fallback: null,
};

/** Sound preference: the bare "on"/"off" bytes predate the port. */
const sound: StorageKeyDef<string> = {
  key: "meridian.sound",
  schema: z.string(),
  fallback: "on",
  encoding: "raw",
};

/** Stale-refresh stamp: epoch millis, read with Number(). */
const staleRefresh: StorageKeyDef<number> = {
  key: "meridian.staleRefresh",
  schema: z.number(),
  fallback: 0,
};

/** First-win celebration flag: the bare "1" bytes predate the port. */
const firstWinCelebrated: StorageKeyDef<string> = {
  key: "meridian.firstWinCelebrated",
  schema: z.string(),
  fallback: "",
  encoding: "raw",
};

/**
 * Storyteller session auto-narration flag: the bare "1" bytes
 * predate the port. Session side; the null fallback keeps the
 * reader's missing-means-unset shape.
 */
const storytellerSessionAutoNarration: StorageKeyDef<string | null> = {
  key: "meridian.storyteller.sessionAutoNarration.v1",
  schema: z.string().nullable(),
  fallback: null,
  encoding: "raw",
};

/**
 * Storyteller tour-return flag: a bare day key, predating the port.
 * Session side; read-and-cleared exactly once per arming.
 */
const storytellerTourReturn: StorageKeyDef<string | null> = {
  key: "meridian.storyteller.tourReturn.v1",
  schema: z.string().nullable(),
  fallback: null,
  encoding: "raw",
};

/**
 * Storyteller greeting day key: a bare "YYYY-MM-DD", predating the
 * port. Local side; the null fallback keeps the reader's
 * missing-means-memory shape.
 */
const storytellerGreetDay: StorageKeyDef<string | null> = {
  key: "meridian.storyteller.greetDay.v1",
  schema: z.string().nullable(),
  fallback: null,
  encoding: "raw",
};

/** The grandpa tasting-tour last-date key string, owned here so callers and tests import it instead of repeating it. */
export const TOUR_LAST_DATE_KEY = "meridian.grandpaTour.lastDate";

/** Grandpa tasting-tour last-date: a bare "YYYY-MM-DD", predating the port. */
const grandpaTourLastDate: StorageKeyDef<string> = {
  key: "meridian.grandpaTour.lastDate",
  schema: z.string(),
  fallback: "",
  encoding: "raw",
};

/**
 * The grandpa walked-session key string, owned here so callers and
 * tests import it instead of repeating it. Once per session (owner,
 * 2026-11-19): the footer scene mounts on every page, so without
 * this flag each route change remounts the scene and replays the
 * walk + trail lines. Set when a walk begins; any later mount in
 * the same session starts seated. A new session walks again.
 */
export const WALKED_SESSION_KEY = "meridian.grandpa.walkedSession";

/**
 * Grandpa once-per-session walk flag: decimal-number bytes ("1"),
 * JSON-native, so the schema is numeric like the grown-up cooldown
 * — the port writes the same bare `1` bytes the component wrote.
 */
const grandpaWalkedSession: StorageKeyDef<number> = {
  key: "meridian.grandpa.walkedSession",
  schema: z.number(),
  fallback: 0,
};

/** Stored map-mode assignment. Validation stays in the domain reader. */
const mapMode: StorageKeyDef<unknown> = {
  key: "meridian:map-mode",
  schema: z.unknown(),
  fallback: null,
};

/** Durable map-crash marker. Validation stays in the domain reader. */
const mapCrashMarker: StorageKeyDef<unknown> = {
  key: "meridian:map-crash",
  schema: z.unknown(),
  fallback: null,
};

/** High-contrast palette token: the bare "high-contrast"/"standard" bytes predate the port. Fail-closed validation stays in the domain reader. */
const palettePreference: StorageKeyDef<string> = {
  key: "meridian.palette",
  schema: z.string(),
  fallback: "standard",
  encoding: "raw",
};

/**
 * Picker difficulty choice: the bare "easy"/"medium"/"hard" bytes
 * predate the port. Validation stays in the domain reader
 * (isPickerDifficulty); the fallback is that reader's
 * missing-or-invalid default.
 */
const difficulty: StorageKeyDef<string> = {
  key: "meridian.difficulty",
  schema: z.string(),
  fallback: "medium",
  encoding: "raw",
};

/**
 * Per-module picker difficulty choices (FW-11.1): a JSON map of
 * module id → "easy"/"medium"/"hard". Seeded on first read from the
 * legacy `meridian.difficulty` value (see use-difficulty-choice.ts);
 * the legacy key is left in place and new writes go to this map
 * only. Validation stays in the domain reader (isPickerDifficulty
 * per value); the schema only requires string values.
 */
const difficultyByModule: StorageKeyDef<Record<string, string>> = {
  key: "meridian.difficulty.byModule",
  schema: z.record(z.string(), z.string()),
  fallback: {},
};

/** Board calm toggle: the bare "1"/"0" bytes predate the port. */
const boardCalm: StorageKeyDef<string> = {
  key: "meridian-board-v3-calm",
  schema: z.string(),
  fallback: "",
  encoding: "raw",
};

/** Board theme choice: the bare "light"/"dark" bytes predate the port. */
const boardTheme: StorageKeyDef<string> = {
  key: "meridian-board-v3-theme",
  schema: z.string(),
  fallback: "",
  encoding: "raw",
};

/**
 * Board seen-closed set: the page stores a JSON array string and
 * parses it itself. Raw so a legacy array text still reads back
 * as that text; a port write of the same string round-trips.
 */
const boardSeenClosed: StorageKeyDef<string | null> = {
  key: "meridian-board-v3-seen-closed",
  schema: z.string().nullable(),
  fallback: null,
  encoding: "raw",
};

/** Every registered storage key, by the name stores know it by. */
export const STORAGE_KEYS = {
  subjectProgress,
  readAloudPref,
  ageProfile,
  grownupCooldown,
  grownupStrikes,
  coldtrailStore,
  coldtrailPack,
  packShelfSelection,
  coldtrailLegacy,
  coldtrailOpen,
  session,
  discardedNotice,
  loopStore,
  loopOpen,
  passportBadges,
  chunkReloadAt,
  chunkRecovery,
  chunkReloadSurface,
  chunkReloadNotice,
  retryScreen,
  learningStore,
  challengeAttempts,
  reviewDeck,
  tutorialSeen,
  cleanExit,
  pausedRun,
  pausedRunMc2,
  pausedRunMc3,
  pausedDrop,
  sound,
  staleRefresh,
  firstWinCelebrated,
  storytellerSessionAutoNarration,
  storytellerTourReturn,
  storytellerGreetDay,
  grandpaTourLastDate,
  grandpaWalkedSession,
  mapMode,
  mapCrashMarker,
  palettePreference,
  difficulty,
  difficultyByModule,
  boardCalm,
  boardTheme,
  boardSeenClosed,
};

/**
 * Dynamic keys are factory defs: the key string is built from
 * the same parts the domain builder takes, and the pin tests
 * assert the factory's key equals the builder's for fixture
 * ids, so the two can never drift. (The legacy v1 day-keyed
 * seen keys have no factory: nothing constructs them — they
 * are matched by prefix and folded into v2 on read. Their
 * bytes are JSON string arrays, the same shape as the v2
 * seen def.)
 */

/** No-repeat history for one edition/region/difficulty band. */
export function trailSeenKeyDef(
  edition: string,
  regionId: string,
  choice: string,
): StorageKeyDef<string[]> {
  return {
    key: `meridian:seen:v2:${edition}:${regionId}:${choice}`,
    schema: z.array(z.string()),
    fallback: [],
  };
}

/** Pre-band no-repeat history for one edition/region. */
export function trailUnscopedSeenKeyDef(
  edition: string,
  regionId: string,
): StorageKeyDef<string[]> {
  return {
    key: `meridian:seen:v2:${edition}:${regionId}`,
    schema: z.array(z.string()),
    fallback: [],
  };
}

/** Cleared-celebration mark for one edition/region/difficulty band: bare "1" bytes. */
export function trailClearedMarkKeyDef(
  edition: string,
  regionId: string,
  choice: string,
): StorageKeyDef<string> {
  return {
    key: `meridian:cleared:v1:${edition}:${regionId}:${choice}`,
    schema: z.string(),
    fallback: "",
    encoding: "raw",
  };
}

/** Cached sports-AI answer for one place. Validation stays in the domain reader. */
export function sportsAiCacheKeyDef(
  geonameId: string,
): StorageKeyDef<unknown> {
  return {
    key: `meridian:sports-ai:v1:${geonameId}`,
    schema: z.unknown(),
    fallback: null,
  };
}

/** Cached story-AI answer for one place. Validation stays in the domain reader. */
export function storyCacheKeyDef(placeId: string): StorageKeyDef<unknown> {
  return {
    key: `meridian.ai-story.v1.${placeId}`,
    schema: z.unknown(),
    fallback: null,
  };
}

/**
 * First-visit seen ids for one queue key: a JSON string array. The
 * queue's reader always dropped non-string members, so the schema
 * filters them instead of rejecting the whole read.
 */
export function firstVisitSeenKeyDef(seenKey: string): StorageKeyDef<string[]> {
  return {
    key: seenKey,
    schema: z
      .array(z.unknown())
      .transform((ids) => ids.filter((id): id is string => typeof id === "string")),
    fallback: [],
  };
}

/**
 * The first-visit queue's seen key — the one queue key game-app
 * passes to FirstVisitQueue. Owned here so the call site imports
 * it instead of repeating the string; firstVisitSeenKeyDef above
 * builds the def for it.
 */
export const FIRST_VISIT_QUEUE_KEY = "meridian.firstVisitQueue.v1";

/**
 * Cached story text for one place: the bare story bytes predate
 * the port. The null fallback keeps the reader's
 * missing-means-build shape.
 */
export function storyKeyDef(placeId: string): StorageKeyDef<string | null> {
  return {
    key: `meridian.story.${placeId}`,
    schema: z.string().nullable(),
    fallback: null,
    encoding: "raw",
  };
}

/** Challenge recorded marker for one seed: the bare route-tuple bytes predate the port. Session side. */
export function challengeRecordedKeyDef(seed: number): StorageKeyDef<string> {
  return {
    key: `meridian.challenge.recorded.${seed}`,
    schema: z.string(),
    fallback: "",
    encoding: "raw",
  };
}

/** Challenge recorded-summary marker for one seed: the bare "1" bytes predate the port. Session side. */
export function challengeRecordedSummaryKeyDef(seed: number): StorageKeyDef<string> {
  return {
    key: `meridian.challenge.recorded.summary.${seed}`,
    schema: z.string(),
    fallback: "",
    encoding: "raw",
  };
}
