// Phase 0 shell split — pure helpers extracted VERBATIM from
// src/components/game-app.tsx (origin/main f37dea50, 8,609 lines).
// Behaviour-preserving only: same code, new home. The shell imports them
// back; nothing here calls React, touches state, or changes a value.
// Slice 1: run predicates, type guards, totals, bounds, dates, notices.
import { ADMIN1_BY_COUNTRY, COUNTRIES, type RegionBounds } from "@/game/regions";
import { REVIEW_DECK_REGION_ID } from "@/game/review-deck";
import { CHALLENGE_REGION_ID } from "@/game/challenge";
import type { Edition, PlaceResult, Run, RunPhase } from "@/game/run";
import type { ScoredPlace } from "@/game/scoring";

export type Drop = {
  lon: number;
  lat: number;
  distanceKm: number;
  placeId: string;
  /** The v3 breakdown for the reveal; null on a miss. */
  breakdown: ScoredPlace | null;
  /** Consecutive hits before this place (for the miss "streak reset" note). */
  streakBefore: number;
};

/**
 * A review-deck session is a Run with this regionId (typed edition "globe")
 * so the PlayLoaded game loop is reused instead of forked. Every
 * review-specific branch keys off this predicate. Review runs never consult
 * the no-repeat history of real regions and never bank into the session —
 * review is practice, not scoring.
 */
export function isReviewRun(run: Run): boolean {
  return run.regionId === REVIEW_DECK_REGION_ID;
}

/**
 * A friend-challenge run is identified by its region id alone — the run
 * carries no other marker. Every isolation guard in this file keys off
 * this one check, so there is exactly one place to get it right:
 * challenge runs never bank into the session, never write learning
 * records or review-deck cards, and never touch the persistent
 * no-repeat history (see the dealer, the flag effect, and onConfirm).
 * Why isolate them? The places were chosen by a FRIEND, not dealt to
 * this player — letting them into the player's own history, deck, or
 * score would teach the game the wrong lessons about what this player
 * has seen and how well they are doing.
 */
export function isChallengeRun(run: Run): boolean {
  return run.regionId === CHALLENGE_REGION_ID;
}

export function trailDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Wave 1 P0 Item 1: what the shared discarded-run notice shows. Totals
 * are always whole-session totals (summarizeSession) or the discarded
 * run's own results — never recomputed, never invented. A 0-place
 * discard carries no numbers at all: the honest "nothing scored yet".
 */
export type DiscardedNotice = {
  reason: "inactivity" | "new-day" | "scoring" | "challenges";
  totalScore: number;
  placesPlayed: number;
};

export function discardedNoticeText(notice: DiscardedNotice): string {
  const reason =
    notice.reason === "inactivity"
      ? "Your game ended after 2 minutes of inactivity."
      : notice.reason === "new-day"
        ? "A new day started, so your saved game could not be resumed."
        : notice.reason === "scoring"
          ? "The scoring changed, so your saved game could not be resumed."
          : "Friend challenges are switched off, so your saved game could not be resumed.";
  const summary =
    notice.placesPlayed === 0
      ? "You had not scored anything yet."
      : `You played ${notice.placesPlayed} ${notice.placesPlayed === 1 ? "place" : "places"} and scored ${notice.totalScore.toLocaleString("en-US")} points.`;
  return `${reason} ${summary}`;
}

/** Sum a run's own results — the fallback when no session survives. */
export function runResultsTotals(run: Run | null): { totalScore: number; placesPlayed: number } {
  const results = run?.results ?? [];
  return {
    totalScore: results.reduce((sum, r) => sum + r.score, 0),
    placesPlayed: results.length,
  };
}

export function boundsFor(run: Run): RegionBounds {
  if (run.regionId === CHALLENGE_REGION_ID) {
    // A challenge run's sentinel regionId names no real place; its
    // bounds are the REAL region's (the route's own region), so the
    // map frames and the territory resolves for the place the route is
    // actually about. Legacy mc1 saves carry no region: the globe.
    const regionId = run.challengeRegionId ?? "globe";
    if (run.edition === "state") {
      const regions = Object.values(ADMIN1_BY_COUNTRY).flat();
      return regions.find((region) => region.id === regionId)?.bounds ?? [0, 0, 0, 0];
    }
    if (run.edition === "country") {
      return COUNTRIES.find((region) => region.id === regionId)?.bounds ?? [0, 0, 0, 0];
    }
    return [0, 0, 0, 0];
  }
  if (run.edition === "state") {
    // States can drill from any country that maps subdivisions; look across all of them.
    const regions = Object.values(ADMIN1_BY_COUNTRY).flat();
    return regions.find((region) => region.id === run.regionId)?.bounds ?? [0, 0, 0, 0];
  }
  return COUNTRIES.find((region) => region.id === run.regionId)?.bounds ?? [0, 0, 0, 0];
}

export function isEdition(value: unknown): value is Edition {
  return value === "state" || value === "country" || value === "globe";
}

export function isPhase(value: unknown): value is RunPhase {
  return value === "aim" || value === "story" || value === "done" || value === "summary";
}

export function isPlaceResult(value: unknown): value is PlaceResult {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.distanceKm === "number" &&
    typeof r.hit === "boolean" &&
    typeof r.score === "number"
  );
}

/** Loose ScoredPlace shape check: enough to render the reveal card. */
export function isScoredPlace(value: unknown): value is ScoredPlace {
  if (!value || typeof value !== "object") return false;
  const b = value as Record<string, unknown>;
  return (
    typeof b.base === "number" &&
    typeof b.diffMult === "number" &&
    typeof b.combo === "number" &&
    typeof b.streak === "number" &&
    typeof b.score === "number"
  );
}

export function isDrop(value: unknown): value is Drop {
  if (!value || typeof value !== "object") return false;
  const d = value as Record<string, unknown>;
  return (
    typeof d.lon === "number" &&
    Number.isFinite(d.lon) &&
    typeof d.lat === "number" &&
    Number.isFinite(d.lat) &&
    typeof d.distanceKm === "number" &&
    Number.isFinite(d.distanceKm) &&
    d.distanceKm >= 0 &&
    typeof d.placeId === "string" &&
    d.placeId.length > 0 &&
    typeof d.streakBefore === "number" &&
    Number.isInteger(d.streakBefore) &&
    d.streakBefore >= 0 &&
    (d.breakdown === null || isScoredPlace(d.breakdown))
  );
}
