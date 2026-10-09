import { isHit } from "./radius.ts";
import { SCORING_VERSION, type ScoredPlace } from "./scoring.ts";
import { isPickerDifficulty, type PickerDifficulty } from "./tier-filter.ts";
import { mintSeed } from "./trail.ts";
import {
  getBandConfig,
  isBandRunConfig,
  type BandRunConfig,
} from "./age-profile/run-config.ts";
import { resolveBand } from "./age-profile/store.ts";

export type Edition = "state" | "country" | "globe";
export type RunPhase = "aim" | "story" | "done" | "summary";

/**
 * Backfill for runs saved before the difficulty picker: an absent or
 * invalid stored choice reads as "medium" (the default band). Shared by
 * startRun, resumeRun, and the sessionStorage reader so every path agrees.
 */
export function backfillDifficultyChoice(value: unknown): PickerDifficulty {
  return isPickerDifficulty(value) ? value : "medium";
}

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
  /**
   * The difficulty band the player picked when this run started
   * ("easy" | "medium" | "hard" — the picker choice, not the 1–5 per-place
   * tier). Runs saved before the picker existed backfill to "medium".
   */
  difficultyChoice: PickerDifficulty;
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
   * session start (catalog minus the persistent no-repeat history) and
   * persisted so a reload rebuilds the identical pool — the resumed run
   * keeps dealing the same session's order, not a reshuffled smaller pool.
   */
  poolIds: string[];
  /**
   * The previous cycle's final deal at run start (null on a brand-new
   * history). The dealer avoids opening its first cycle with this place so
   * a location never repeats across the cycle boundary. Persisted so a
   * reload makes the identical boundary decision.
   */
  prevLastId: string | null;
  /**
   * Immutable age-band config snapshot, captured ONCE at run start via
   * getBandConfig(resolveBand()) (follow-up Item A). A mid-run band
   * change structurally cannot warp this run — the run keeps its
   * start-of-run lengths, hint policy, and tolerance.
   *
   * Optional only for backward compatibility: runs saved before the
   * snapshot (or built as manual literals) backfill via resumeRun. The
   * constructor always sets it.
   */
  bandConfig?: BandRunConfig;
  /**
   * Hints tapped this run. Hints NEVER touch points (scoring is identical
   * across bands); the hint policy enum rides in bandConfig.
   */
  hintsUsed?: number;
};

export function startRun(
  input: {
    edition: Edition;
    regionId: string;
    regionName: string;
    dateKey: string;
    difficultyChoice: PickerDifficulty;
  },
  poolIds: string[],
  prevLastId: string | null = null,
): Run {
  return {
    edition: input.edition,
    regionId: input.regionId,
    regionName: input.regionName,
    dateKey: input.dateKey,
    difficultyChoice: backfillDifficultyChoice(input.difficultyChoice),
    index: 0,
    hits: 0,
    phase: "aim",
    streak: 0,
    bestStreak: 0,
    results: [],
    seed: mintSeed(),
    poolIds: [...poolIds],
    prevLastId,
    // Follow-up Item A: snapshot the band config once at run start.
    bandConfig: getBandConfig(resolveBand()),
    hintsUsed: 0,
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
 * day, and difficulty choice; not parked on the summary screen (a summary
 * must be dismissed before reset, and must not auto-restore on page load);
 * and scored with the current scoring version — stored scores are never
 * recomputed, so a version bump retires old runs instead of mixing scoring
 * systems. A changed difficulty choice never resumes — switching bands
 * starts a FRESH run (fresh seed, fresh no-repeat accounting).
 */
export function isResumable(
  saved: Run | null,
  today: { edition: Edition; regionId: string; dateKey: string; difficultyChoice: PickerDifficulty },
): saved is Run {
  return (
    !!saved &&
    saved.phase !== "summary" &&
    saved.edition === today.edition &&
    saved.regionId === today.regionId &&
    saved.dateKey === today.dateKey &&
    saved.difficultyChoice === today.difficultyChoice &&
    Array.isArray(saved.results) &&
    saved.results.every((r) => r.scoringVersion === SCORING_VERSION)
  );
}

export function resumeRun(
  saved: Run | null,
  today: {
    edition: Edition;
    regionId: string;
    regionName: string;
    dateKey: string;
    difficultyChoice: PickerDifficulty;
  },
  poolIds: string[] = [],
  prevLastId: string | null = null,
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
      // poolIds backfill. NOTE: a run saved before the difficulty picker
      // existed (but after pool persistence) resumes once with its original
      // UNFILTERED poolIds under the backfilled "medium" choice — a one-run
      // upgrade artifact. It self-heals on replay, which re-filters from the
      // backfilled choice (see the replay path in game-app.tsx). Deliberately
      // not re-plumbed: the mismatch can only exist for exactly one resumed
      // run per player.
      poolIds: Array.isArray(saved.poolIds)
        ? saved.poolIds.filter((id): id is string => typeof id === "string")
        : [...poolIds],
      // Runs saved before the persistent no-repeat history get no boundary
      // id (null disables the swap), preserving their exact deal order.
      prevLastId:
        typeof saved.prevLastId === "string" ? saved.prevLastId : null,
      // Runs saved before the difficulty picker backfill to the default
      // band. A mismatched choice can never reach here: isResumable fails
      // first and startRun mints a fresh run instead.
      difficultyChoice: backfillDifficultyChoice(saved.difficultyChoice),
      // Runs saved before the band-config snapshot (follow-up Item A)
      // backfill from the live band; hints default to unused.
      bandConfig: isBandRunConfig(saved.bandConfig)
        ? saved.bandConfig
        : getBandConfig(resolveBand()),
      hintsUsed: typeof saved.hintsUsed === "number" ? saved.hintsUsed : 0,
    };
  }
  return startRun(today, poolIds, prevLastId);
}
