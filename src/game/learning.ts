/**
 * Learning outcomes — observational per-place learning records.
 *
 * Why: Veeresh's standing product priority (2026-10-03) is "user experience,
 * user engagement, and learning outcomes — not just the game." This module
 * records one {@link LearningAttempt} per pin commit (see
 * docs/learning-outcomes.md §1) and derives retention, mastery, error-trend,
 * and engagement signals from it. It is a FEATURE, not a dashboard: the
 * growth surface itself motivates the player.
 *
 * Non-interference contract (merge-blocker, proved by tests):
 * - Never reads or writes `meridian:seen:v2:*` (the no-repeat dealing
 *   history); the dealer never consults learning records. Dealt order with
 *   the flag on is byte-identical to flag off.
 * - Never touches `dropPin` / `scorePlace` / `bankPlace`; recorded scores
 *   are analysis-only and never re-fed into scoring.
 * - The record hook runs *beside* `bankPlace` in `onConfirm`, inside its own
 *   try/catch — a storage failure can never throw into the pin-commit path.
 * - Records carry no `story`/`history`/`fact` fields and never alter card
 *   rendering or the card lint gate.
 * - Privacy: localStorage only. Zero fetch/XHR/beacon; share/export paths
 *   never see these records. Flag off = no reads, no writes, no traces.
 *
 * Everything here is pure and unit-testable: `recordAnswer` takes a store
 * and returns a new store plus an event; persistence is a thin
 * try/catch wrapper; mastery/trend/engagement are pure derivations.
 */

/** One pin commit, recorded at the answer-event hook. */
export type LearningAttempt = {
  /** Epoch ms of the commit. */
  at: number;
  /** Pin inside the hit radius? */
  hit: boolean;
  /** Player pin → true location, km. */
  distanceKm: number;
  /** Hit radius the attempt was judged against (edition-dependent). */
  radiusKm: number;
  edition: "globe" | "country" | "state";
  regionId: string;
  /** Points earned (0 on a miss); stored for analysis only, never re-scored. */
  score: number;
};

/** Per-place learning history, oldest-first attempts. */
export type LearningRecord = {
  /** Schema version of this record payload. */
  v: 1;
  placeId: string;
  /** Oldest-first, capped at MAX_ATTEMPTS_PER_PLACE. */
  attempts: LearningAttempt[];
};

/** Whole learning store: one JSON document, one localStorage key. */
export type LearningStore = {
  /** Schema version of the store document. */
  v: 1;
  /** Keyed by placeId. Capped at MAX_PLACE_RECORDS (LRU). */
  records: Record<string, LearningRecord>;
  /** Last-write-wins regionId → regionName for trend labels. */
  regionNames: Record<string, string>;
  /** YYYY-MM-DD keys, capped at the last 90 days. */
  daysPlayed: string[];
};

export const LEARNING_STORE_KEY = "meridian:learning:v1";
export const LEARNING_SCHEMA_VERSION = 1;
/** Max place records in the store (eviction: LRU by last attempt). */
export const MAX_PLACE_RECORDS = 1000;
/** Max attempts kept per record, oldest dropped first. */
export const MAX_ATTEMPTS_PER_PLACE = 8;
/** Max day keys kept in daysPlayed. */
export const MAX_DAYS_PLAYED = 90;
/** Retention window (M1) in days. */
export const RETENTION_WINDOW_DAYS = 28;
/** Re-encounter counts as "improved" when a miss is within this fraction
 *  of the first-attempt error (M1). */
export const RETENTION_IMPROVEMENT_RATIO = 0.75;
/** Error-trend windows (M3) in days: recent vs baseline. */
export const TREND_RECENT_DAYS = 7;
export const TREND_BASELINE_DAYS = 28;
/** Minimum attempts per window before a region's trend is reported (M3). */
export const TREND_MIN_ATTEMPTS = 5;
/** Mastery confidence bar: the latest hit must land within this fraction of
 *  its hit radius (§3). */
export const MASTERY_CONFIDENCE_RATIO = 0.5;

const EDITIONS = ["globe", "country", "state"] as const;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Fresh, empty store. */
export function emptyLearningStore(): LearningStore {
  return { v: LEARNING_SCHEMA_VERSION, records: {}, regionNames: {}, daysPlayed: [] };
}

/** YYYY-MM-DD (UTC) day key for an epoch-ms timestamp. */
export function learningDateKey(atMs: number = Date.now()): string {
  return new Date(atMs).toISOString().slice(0, 10);
}

/**
 * Mastery derivation (§3), computed on read — attempts are the single
 * source of truth, never the derived state.
 *
 * - "mastered": the two most recent attempts are both hits, and the latest
 *   is confident: `distanceKm <= 0.5 * radiusKm` (its own hit radius).
 * - "growing": ≥2 attempts, not mastered, latest error smaller than first.
 * - "explored": ≥1 attempt, neither of the above.
 * - "none": no attempts.
 */
export type PlaceMastery = "none" | "explored" | "growing" | "mastered";

export function placeMastery(attempts: readonly LearningAttempt[]): PlaceMastery {
  if (attempts.length === 0) return "none";
  const n = attempts.length;
  const latest = attempts[n - 1];
  if (n >= 2) {
    const prev = attempts[n - 2];
    if (
      latest.hit &&
      prev.hit &&
      latest.radiusKm > 0 &&
      latest.distanceKm <= MASTERY_CONFIDENCE_RATIO * latest.radiusKm
    ) {
      return "mastered";
    }
  }
  if (n >= 2 && latest.distanceKm < attempts[0].distanceKm) {
    return "growing";
  }
  return "explored";
}

/** Kid-friendly copy bank (§5.2). Tone is Veeresh's call; the bank is the bar. */
export const LEARNING_COPY = {
  /** First encounter, hit. */
  firstHit: "Great first try!",
  /** First encounter, miss. */
  firstMiss: "Good try — you'll get this one.",
  /** Re-encounter, improved (hit after miss, or closer than last time). */
  closer: "Closer than last time — you're learning!",
  /** Re-encounter, hit after a past miss. */
  remembered: "You remembered it! Nice work.",
  /** Newly mastered. */
  mastered: "Mastered! You really know this place.",
  /** Re-encounter, not improved (never shaming; the game moves on). */
  tricky: "Tricky one — let's try it again later.",
  /** Summary section header. */
  summaryHeader: "My growth",
  /** Summary rows. */
  placesExplored: "Places explored",
  placesMastered: "Places mastered",
  dayStreak: "Day streak",
  dayStreakNudge: "come back tomorrow to keep growing!",
} as const;

/**
 * The one-line growth note for the reveal card, derived from the place's
 * full attempt history *after* the new attempt was recorded. Pure — so a
 * reload recomputes the identical line from the persisted record.
 */
export function growthLineFor(attempts: readonly LearningAttempt[]): string | null {
  if (attempts.length === 0) return null;
  const n = attempts.length;
  const latest = attempts[n - 1];
  if (n === 1) {
    return latest.hit ? LEARNING_COPY.firstHit : LEARNING_COPY.firstMiss;
  }
  const prior = attempts.slice(0, n - 1);
  const prev = prior[prior.length - 1];
  if (
    placeMastery(attempts) === "mastered" &&
    placeMastery(prior) !== "mastered"
  ) {
    return LEARNING_COPY.mastered;
  }
  if (latest.hit && !prev.hit) {
    return LEARNING_COPY.remembered;
  }
  if (latest.distanceKm < prev.distanceKm) {
    return LEARNING_COPY.closer;
  }
  return LEARNING_COPY.tricky;
}

export type RecordLearningInput = {
  placeId: string;
  edition: "globe" | "country" | "state";
  regionId: string;
  regionName: string;
  distanceKm: number;
  radiusKm: number;
  hit: boolean;
  score: number;
  /** Epoch ms of the commit. */
  at: number;
};

export type RecordLearningEvent = {
  /** True when this attempt is the place's first recorded one. */
  isFirstEncounter: boolean;
  /** The attempt was a hit. */
  hit: boolean;
  /** Latest error shrank vs the previous attempt. */
  improved: boolean;
  /** This attempt crossed the mastery bar (wasn't mastered before). */
  newlyMastered: boolean;
  /** The reveal-card growth line for this attempt. */
  line: string | null;
};

/**
 * Record one answer event. Pure: takes the current store, returns a new
 * store plus an event describing what happened. Never mutates its input.
 *
 * Caps: attempts per record are oldest-first capped at
 * MAX_ATTEMPTS_PER_PLACE; records are LRU-capped at MAX_PLACE_RECORDS
 * (evicting the record whose last attempt is oldest — pure LRU, no
 * protected records); daysPlayed is capped at the last MAX_DAYS_PLAYED keys.
 */
export function recordAnswer(
  store: LearningStore,
  input: RecordLearningInput,
): { store: LearningStore; event: RecordLearningEvent } {
  const priorRecord = store.records[input.placeId];
  const priorAttempts = priorRecord?.attempts ?? [];
  const attempt: LearningAttempt = {
    at: input.at,
    hit: input.hit,
    distanceKm: input.distanceKm,
    radiusKm: input.radiusKm,
    edition: input.edition,
    regionId: input.regionId,
    score: input.score,
  };
  const attempts = [...priorAttempts, attempt].slice(-MAX_ATTEMPTS_PER_PLACE);
  const records: Record<string, LearningRecord> = {
    ...store.records,
    [input.placeId]: { v: LEARNING_SCHEMA_VERSION, placeId: input.placeId, attempts },
  };
  // LRU eviction: only when a *new* place pushes the count past the cap.
  const ids = Object.keys(records);
  if (!priorRecord && ids.length > MAX_PLACE_RECORDS) {
    const victim = ids
      .filter((id) => id !== input.placeId)
      .map((id) => {
        const a = records[id].attempts;
        return { id, lastAt: a.length > 0 ? a[a.length - 1].at : -Infinity };
      })
      .sort((x, y) =>
        x.lastAt === y.lastAt ? (x.id < y.id ? -1 : 1) : x.lastAt - y.lastAt,
      )[0];
    if (victim) delete records[victim.id];
  }
  const regionNames = { ...store.regionNames, [input.regionId]: input.regionName };
  const dayKey = learningDateKey(input.at);
  const daysPlayed = store.daysPlayed.includes(dayKey)
    ? [...store.daysPlayed]
    : [...store.daysPlayed, dayKey].sort().slice(-MAX_DAYS_PLAYED);

  const next: LearningStore = {
    v: LEARNING_SCHEMA_VERSION,
    records,
    regionNames,
    daysPlayed,
  };

  const prev = priorAttempts[priorAttempts.length - 1];
  const newlyMastered =
    placeMastery(attempts) === "mastered" &&
    placeMastery(priorAttempts) !== "mastered";
  const event: RecordLearningEvent = {
    isFirstEncounter: priorAttempts.length === 0,
    hit: input.hit,
    improved: prev !== undefined && input.distanceKm < prev.distanceKm,
    newlyMastered,
    line: growthLineFor(attempts),
  };
  return { store: next, event };
}

// ---------------------------------------------------------------------------
// Persistence (localStorage only; fail closed, like readSession/writeSession)
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

function isAttempt(v: unknown): v is LearningAttempt {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    isFiniteNumber(r.at) &&
    r.at >= 0 &&
    typeof r.hit === "boolean" &&
    isFiniteNumber(r.distanceKm) &&
    r.distanceKm >= 0 &&
    isFiniteNumber(r.radiusKm) &&
    r.radiusKm >= 0 &&
    typeof r.edition === "string" &&
    (EDITIONS as readonly string[]).includes(r.edition) &&
    typeof r.regionId === "string" &&
    isFiniteNumber(r.score) &&
    r.score >= 0
  );
}

function isRecord(v: unknown): v is LearningRecord {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (r.v !== LEARNING_SCHEMA_VERSION || typeof r.placeId !== "string") {
    return false;
  }
  const attempts = r.attempts;
  return (
    Array.isArray(attempts) &&
    attempts.length > 0 &&
    attempts.every(isAttempt) &&
    attempts.length <= MAX_ATTEMPTS_PER_PLACE
  );
}

/**
 * Validate (and, in future versions, migrate) a decoded payload.
 * Fail closed: any malformed store-level payload reads as null (fresh
 * start); individual malformed records are dropped so one bad record can't
 * nuke the whole store. Unknown schema versions read as null — new keys
 * are issued on version bumps, never in-place format changes.
 */
export function parseLearningStore(raw: unknown): LearningStore | null {
  try {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    if (r.v !== LEARNING_SCHEMA_VERSION) return null;
    const rawRecords = r.records;
    if (!rawRecords || typeof rawRecords !== "object" || Array.isArray(rawRecords)) {
      return null;
    }
    const rawRegionNames = r.regionNames;
    if (!rawRegionNames || typeof rawRegionNames !== "object" || Array.isArray(rawRegionNames)) {
      return null;
    }
    const rawDays = r.daysPlayed;
    if (!Array.isArray(rawDays) || !rawDays.every((d) => typeof d === "string" && DATE_KEY_RE.test(d))) {
      return null;
    }
    const records: Record<string, LearningRecord> = {};
    for (const [id, rec] of Object.entries(rawRecords)) {
      if (typeof id === "string" && isRecord(rec) && rec.placeId === id) {
        records[id] = { v: 1, placeId: id, attempts: rec.attempts };
      }
    }
    const regionNames: Record<string, string> = {};
    for (const [id, name] of Object.entries(rawRegionNames)) {
      if (typeof name === "string") regionNames[id] = name;
    }
    const daysPlayed = [...new Set(rawDays as string[])]
      .sort()
      .slice(-MAX_DAYS_PLAYED);
    return { v: LEARNING_SCHEMA_VERSION, records, regionNames, daysPlayed };
  } catch {
    return null;
  }
}

/**
 * Read the store from localStorage. Fail closed: any malformed payload
 * reads as null — the caller starts from an empty store and the app never
 * breaks on bad learning data.
 */
export function readLearningStore(storage?: StorageLike): LearningStore | null {
  try {
    const s = resolveStorage(storage);
    if (!s) return null;
    const raw = s.getItem(LEARNING_STORE_KEY);
    if (!raw) return null;
    return parseLearningStore(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Write the store to localStorage. Fail closed: storage errors are
 *  swallowed — the in-memory store still works for the session. */
export function writeLearningStore(store: LearningStore, storage?: StorageLike): void {
  try {
    const s = resolveStorage(storage);
    if (!s) return;
    s.setItem(LEARNING_STORE_KEY, JSON.stringify(store));
  } catch {
    // Storage blocked or full; the game must never break on learning data.
  }
}

/** Remove the store (player control = device control; nothing server-side). */
export function clearLearningStore(storage?: StorageLike): void {
  try {
    resolveStorage(storage)?.removeItem(LEARNING_STORE_KEY);
  } catch {
    // Already gone or storage blocked.
  }
}

// ---------------------------------------------------------------------------
// Metrics — pure derivations over the records
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** All attempts across records, oldest-first per record. */
function allAttempts(store: LearningStore): LearningAttempt[] {
  return Object.values(store.records).flatMap((r) => r.attempts);
}

/**
 * M1 — Retention rate: among places missed at first sight and seen again
 * within the trailing 28 days, the share where the latest re-encounter was
 * a hit, or a miss within 0.75× the first-attempt error. Learning as a
 * slope, not a binary. Null when no re-encounters exist yet.
 */
export function retentionRate(
  store: LearningStore,
  nowMs: number = Date.now(),
): { rate: number; reEncountered: number; improved: number } | null {
  const cutoff = nowMs - RETENTION_WINDOW_DAYS * DAY_MS;
  let reEncountered = 0;
  let improved = 0;
  for (const record of Object.values(store.records)) {
    const inWindow = record.attempts.filter((a) => a.at >= cutoff);
    if (inWindow.length < 2 || inWindow[0].hit) continue;
    reEncountered += 1;
    const first = inWindow[0];
    const latest = inWindow[inWindow.length - 1];
    if (
      latest.hit ||
      latest.distanceKm <= RETENTION_IMPROVEMENT_RATIO * first.distanceKm
    ) {
      improved += 1;
    }
  }
  if (reEncountered === 0) return null;
  return { rate: improved / reEncountered, reEncountered, improved };
}

/** M3 — per-region error trend: median distanceKm over the trailing 7 days
 *  vs the trailing 28 days. Positive trendPct = pins landing closer.
 *  Only reported for regions with ≥5 attempts in each window. */
export type RegionTrend = {
  regionId: string;
  regionName: string;
  /** (median28 − median7) / median28, as a fraction; positive = improving. */
  trend: number;
  attempts7: number;
  attempts28: number;
};

export function errorTrendByRegion(
  store: LearningStore,
  nowMs: number = Date.now(),
): RegionTrend[] {
  const recentCutoff = nowMs - TREND_RECENT_DAYS * DAY_MS;
  const baselineCutoff = nowMs - TREND_BASELINE_DAYS * DAY_MS;
  const byRegion = new Map<string, { recent: number[]; baseline: number[] }>();
  for (const attempt of allAttempts(store)) {
    if (attempt.at < baselineCutoff) continue;
    let bucket = byRegion.get(attempt.regionId);
    if (!bucket) {
      bucket = { recent: [], baseline: [] };
      byRegion.set(attempt.regionId, bucket);
    }
    bucket.baseline.push(attempt.distanceKm);
    if (attempt.at >= recentCutoff) bucket.recent.push(attempt.distanceKm);
  }
  const trends: RegionTrend[] = [];
  for (const [regionId, bucket] of byRegion) {
    if (bucket.recent.length < TREND_MIN_ATTEMPTS || bucket.baseline.length < TREND_MIN_ATTEMPTS) {
      continue;
    }
    const median7 = median(bucket.recent);
    const median28 = median(bucket.baseline);
    if (median28 <= 0) continue;
    trends.push({
      regionId,
      regionName: store.regionNames[regionId] ?? regionId,
      trend: (median28 - median7) / median28,
      attempts7: bucket.recent.length,
      attempts28: bucket.baseline.length,
    });
  }
  trends.sort((a, b) => (a.regionName < b.regionName ? -1 : 1));
  return trends;
}

/** M4 — Engagement: the player keeps coming back. `dayStreak` counts
 *  consecutive calendar days ending today *or* yesterday, so a player who
 *  hasn't played *yet* today never sees a broken streak at breakfast.
 *  Explicitly not the hit streak (that's a game mechanic). */
export type Engagement = {
  daysPlayed7: number;
  daysPlayed28: number;
  dayStreak: number;
  /** Answer events in the trailing 7 days. */
  places7: number;
};

export function engagement(
  store: LearningStore,
  nowMs: number = Date.now(),
): Engagement {
  const played = new Set(store.daysPlayed);
  const cutoff7 = learningDateKey(nowMs - 7 * DAY_MS);
  const cutoff28 = learningDateKey(nowMs - 28 * DAY_MS);
  let daysPlayed7 = 0;
  let daysPlayed28 = 0;
  for (const key of played) {
    if (key >= cutoff28) daysPlayed28 += 1;
    if (key >= cutoff7) daysPlayed7 += 1;
  }
  // Streak: start today, fall back to yesterday (not yet played today).
  let cursorMs = nowMs;
  if (!played.has(learningDateKey(cursorMs))) cursorMs -= DAY_MS;
  let dayStreak = 0;
  while (played.has(learningDateKey(cursorMs))) {
    dayStreak += 1;
    cursorMs -= DAY_MS;
  }
  const recentCutoff = nowMs - 7 * DAY_MS;
  const places7 = allAttempts(store).filter((a) => a.at >= recentCutoff).length;
  return { daysPlayed7, daysPlayed28, dayStreak, places7 };
}

/** What the end-of-game "My growth" section renders. */
export type GrowthSummary = {
  explored: number;
  mastered: number;
  dayStreak: number;
  places7: number;
  /** Regions whose pins are landing closer (M3 positive, enough data). */
  improvingRegions: { regionId: string; regionName: string; trendPct: number }[];
};

export function growthSummary(
  store: LearningStore,
  nowMs: number = Date.now(),
): GrowthSummary {
  const records = Object.values(store.records);
  const explored = records.filter((r) => r.attempts.length > 0).length;
  const mastered = records.filter(
    (r) => placeMastery(r.attempts) === "mastered",
  ).length;
  const { dayStreak, places7 } = engagement(store, nowMs);
  const improvingRegions = errorTrendByRegion(store, nowMs)
    .filter((t) => t.trend > 0)
    .sort((a, b) => b.trend - a.trend)
    .slice(0, 3)
    .map((t) => ({
      regionId: t.regionId,
      regionName: t.regionName,
      trendPct: Math.round(t.trend * 100),
    }));
  return { explored, mastered, dayStreak, places7, improvingRegions };
}
