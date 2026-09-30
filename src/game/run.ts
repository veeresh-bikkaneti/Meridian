import { isHit } from "./radius.ts";
import { SCORING_VERSION, type ScoredPlace } from "./scoring.ts";
import { mintSeed } from "./trail.ts";

export type Edition = "state" | "country" | "globe";
export type RunPhase = "aim" | "story" | "done" | "summary";

/** Per-place result accumulated for the endless-run summary. */
export type PlaceResult = {
  distanceKm: number;
  hit: boolean;
  /** Points earned for this place (0 on a miss). */
  score: number;
  /** Locks the result to the scoring version that produced it. */
  scoringVersion: number;
  /** The transparent v3 breakdown; null on a miss. */
  breakdown: ScoredPlace | null;
  /** Consecutive hits before this place (the streak the combo built on). */
  streakBefore: number;
};

/** Final tally produced by endRun. */
export type RunSummary = {
  placesPlayed: number;
  hits: number;
  totalScore: number;
  averageDistanceKm: number;
  /** Rounded average v3 score per place, 0 when no places were played. */
  averagePerPlace: number;
  /** Shortest distance across all places, null when no places were played. */
  bestDistanceKm: number | null;
  /** Longest streak this run. */
  bestStreak: number;
};

export type Run = {
  edition: Edition;
  regionId: string;
  regionName: string;
  dateKey: string;
  index: number;
  hits: number;
  phase: RunPhase;
  /** Consecutive hits including the latest (0 after a miss). */
  streak: number;
  /** Longest streak this run. */
  bestStreak: number;
  /** Every scored place, in order. Grows unbounded in endless mode. */
  results: PlaceResult[];
  /**
   * Per-session dealing seed, minted by startRun. A fresh run deals a
   * freshly shuffled order, so restarts no longer deterministically repeat
   * the same first question. Persisted so a reload keeps dealing the same
   * session's order.
   */
  seed: number;
  /**
   * Place IDs available to this session, in catalog order. Computed once at
   * session start (catalog minus the day's seen history) and persisted so a
   * reload rebuilds the identical pool — the resumed run keeps dealing the
   * same session's order, not a reshuffled smaller pool.
   */
  poolIds: string[];
};

export function startRun(
  input: {
    edition: Edition;
    regionId: string;
    regionName: string;
    dateKey: string;
  },
  poolIds: string[],
): Run {
  return {
    edition: input.edition,
    regionId: input.regionId,
    regionName: input.regionName,
    dateKey: input.dateKey,
    index: 0,
    hits: 0,
    phase: "aim",
    streak: 0,
    bestStreak: 0,
    results: [],
    seed: mintSeed(),
    poolIds: [...poolIds],
  };
}

/**
 * A hit pauses on the story. A miss ends the place (phase "done") — but never
 * the run itself. Endless mode: the player continues place after place until
 * they explicitly end the game via endRun.
 *
 * Pins outside aim do nothing. A miss scores 0 and resets the streak;
 * a hit extends it. Stored scores are never recomputed.
 */
export function dropPin(
  run: Run,
  distanceKm: number,
  radiusKm: number,
  scored: ScoredPlace | null,
): Run {
  if (run.phase !== "aim") return run;
  const hit = isHit(distanceKm, radiusKm);
  const streak = hit ? run.streak + 1 : 0;
  const results = [
    ...run.results,
    {
      distanceKm,
      hit,
      score: hit && scored ? scored.score : 0,
      scoringVersion: SCORING_VERSION,
      breakdown: hit ? scored : null,
      streakBefore: run.streak,
    },
  ];
  if (!hit) return { ...run, results, streak, phase: "done" };
  return {
    ...run,
    hits: run.hits + 1,
    streak,
    bestStreak: Math.max(run.bestStreak, streak),
    results,
    phase: "story",
  };
}

/**
 * Advance to the next place after a story or a done place. Endless: never
 * auto-terminates — the run continues indefinitely until endRun.
 */
export function continueRun(run: Run): Run {
  if (run.phase !== "story" && run.phase !== "done") return run;
  return { ...run, index: run.index + 1, phase: "aim" };
}

/**
 * Player-chosen end. Computes the final summary and moves to the "summary"
 * phase. The summary screen must be shown (and dismissed) before the game
 * fully closes/resets.
 */
export function endRun(run: Run): { run: Run; summary: RunSummary } {
  const summary = summarizeRun(run);
  return { run: { ...run, phase: "summary" }, summary };
}

/** Tally the accumulated per-place results into the final summary. */
export function summarizeRun(run: Run): RunSummary {
  const placesPlayed = run.results.length;
  const totalScore = run.results.reduce((sum, r) => sum + r.score, 0);
  const distances = run.results.map((r) => r.distanceKm);
  const averageDistanceKm =
    placesPlayed > 0 ? distances.reduce((sum, d) => sum + d, 0) / placesPlayed : 0;
  const averagePerPlace = placesPlayed > 0 ? Math.round(totalScore / placesPlayed) : 0;
  const bestDistanceKm = placesPlayed > 0 ? Math.min(...distances) : null;
  return {
    placesPlayed,
    hits: run.hits,
    totalScore,
    averageDistanceKm,
    averagePerPlace,
    bestDistanceKm,
    bestStreak: run.bestStreak,
  };
}

/**
 * Whether a saved run resumes into today's session: same edition, region,
 * and day, not parked on the summary screen (a summary must be dismissed
 * before reset, and must not auto-restore on page load), and scored with the
 * current scoring version — stored scores are never recomputed, so a version
 * bump retires old runs instead of mixing scoring systems.
 */
export function isResumable(
  saved: Run | null,
  today: { edition: Edition; regionId: string; dateKey: string },
): saved is Run {
  return (
    !!saved &&
    saved.phase !== "summary" &&
    saved.edition === today.edition &&
    saved.regionId === today.regionId &&
    saved.dateKey === today.dateKey &&
    Array.isArray(saved.results) &&
    saved.results.every((r) => r.scoringVersion === SCORING_VERSION)
  );
}

export function resumeRun(
  saved: Run | null,
  today: { edition: Edition; regionId: string; regionName: string; dateKey: string },
  poolIds: string[] = [],
): Run {
  if (isResumable(saved, today)) {
    // Backfill results for runs saved before endless mode, the dealing
    // seed for runs saved before per-session shuffle, and the pool for runs
    // saved before pool persistence (best effort: the current computed pool).
    // "done" is resumable: it is now a transient per-place state (miss card
    // awaiting Next place), not an ended run — dropping it would silently
    // lose the whole session's accumulated results.
    return {
      ...saved,
      results: saved.results ?? [],
      streak: typeof saved.streak === "number" ? saved.streak : 0,
      bestStreak: typeof saved.bestStreak === "number" ? saved.bestStreak : 0,
      seed: typeof saved.seed === "number" ? saved.seed : mintSeed(),
      poolIds: Array.isArray(saved.poolIds)
        ? saved.poolIds.filter((id): id is string => typeof id === "string")
        : [...poolIds],
    };
  }
  return startRun(today, poolIds);
}
