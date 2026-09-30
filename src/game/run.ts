import { isHit } from "./radius.ts";
import { mintSeed } from "./trail.ts";

export type Edition = "state" | "country" | "globe";
export type RunPhase = "aim" | "story" | "done" | "summary";

/** Per-place result accumulated for the endless-run summary. */
export type PlaceResult = {
  distanceKm: number;
  hit: boolean;
  /** Points earned for this place (0 on a miss). */
  score: number;
};

/** Final tally produced by endRun. */
export type RunSummary = {
  placesPlayed: number;
  hits: number;
  totalScore: number;
  averageDistanceKm: number;
  /** Shortest distance across all places, null when no places were played. */
  bestDistanceKm: number | null;
};

export type Run = {
  edition: Edition;
  regionId: string;
  regionName: string;
  dateKey: string;
  index: number;
  hits: number;
  phase: RunPhase;
  /** Every scored place, in order. Grows unbounded in endless mode. */
  results: PlaceResult[];
  /**
   * Per-session dealing seed, minted by startRun. A fresh run always deals a
   * fresh order, so restarts never repeat the same first question. Persisted
   * so a reload keeps dealing the same session's order.
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
 * Pins outside aim do nothing.
 */
export function dropPin(run: Run, distanceKm: number, radiusKm: number, score: number): Run {
  if (run.phase !== "aim") return run;
  const hit = isHit(distanceKm, radiusKm);
  const results = [...run.results, { distanceKm, hit, score: hit ? score : 0 }];
  if (!hit) return { ...run, results, phase: "done" };
  return { ...run, hits: run.hits + 1, results, phase: "story" };
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
  const bestDistanceKm = placesPlayed > 0 ? Math.min(...distances) : null;
  return { placesPlayed, hits: run.hits, totalScore, averageDistanceKm, bestDistanceKm };
}

/**
 * Whether a saved run resumes into today's session: same edition, region,
 * and day, and not parked on the summary screen (a summary must be dismissed
 * before reset, and must not auto-restore on page load).
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
    saved.dateKey === today.dateKey
  );
}

export function resumeRun(
  saved: Run | null,
  today: { edition: Edition; regionId: string; regionName: string; dateKey: string },
  poolIds: string[],
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
      seed: typeof saved.seed === "number" ? saved.seed : mintSeed(),
      poolIds: Array.isArray(saved.poolIds)
        ? saved.poolIds.filter((id): id is string => typeof id === "string")
        : [...poolIds],
    };
  }
  return startRun(today, poolIds);
}
