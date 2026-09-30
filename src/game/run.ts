import { isHit } from "./radius.ts";

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
};

export function startRun(input: {
  edition: Edition;
  regionId: string;
  regionName: string;
  dateKey: string;
}): Run {
  return {
    edition: input.edition,
    regionId: input.regionId,
    regionName: input.regionName,
    dateKey: input.dateKey,
    index: 0,
    hits: 0,
    phase: "aim",
    results: [],
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

export function resumeRun(
  saved: Run | null,
  today: { edition: Edition; regionId: string; regionName: string; dateKey: string },
): Run {
  if (
    saved &&
    saved.phase !== "summary" &&
    saved.edition === today.edition &&
    saved.regionId === today.regionId &&
    saved.dateKey === today.dateKey
  ) {
    // Backfill results for runs saved before endless mode.
    // "done" is resumable: it is now a transient per-place state (miss card
    // awaiting Next place), not an ended run — dropping it would silently
    // lose the whole session's accumulated results.
    return { ...saved, results: saved.results ?? [] };
  }
  return startRun(today);
}
