/**
 * age-profile/run-config.ts — the per-run band config snapshot.
 *
 * Implements follow-up Item A (B1: run-config injection). Each loop's run
 * constructor calls `getBandConfig(resolveBand())` ONCE at run start and
 * snapshots the result into run state. The snapshot is immutable — a
 * mid-run band change structurally cannot warp a live run (no rug-pull).
 *
 * PURITY CONTRACT: pure functions of the band (or run-state counters).
 * No fetch, no storage, no clock. Values come from the band table in
 * bands.ts — retune there, never here (same contract as difficulty.ts).
 */

import type { AgeBandId } from "./types.ts";
import { AGE_BANDS, AGE_BAND_IDS, FULL_ACCESS_BAND } from "./bands.ts";

/**
 * Hint policy per band (follow-up Item A §hintPolicy).
 * - "free": hint button always free (5-7).
 * - "one-per-round": 1 hint/round, button disables after use (8-10).
 * - "none": no hint button at all (11-13).
 */
export type HintPolicy = "free" | "one-per-round" | "none";

/** The hint policy for each band. */
const HINT_POLICIES: Record<AgeBandId, HintPolicy> = {
  "5-7": "free",
  "8-10": "one-per-round",
  "11-13": "none",
};

/**
 * The immutable per-run config snapshot. `band = null` (unset profile)
 * resolves to the "11-13" band: today's production numbers, byte-for-byte
 * (regression-gated per loop in run-config.test.ts).
 */
export interface BandRunConfig {
  /**
   * The effective band this snapshot was computed for (null input resolves
   * to FULL_ACCESS_BAND). This is the DEAL-TIME band: badge award and any
   * other band-scoped recognition MUST use this field, never the live
   * `resolveBand()` — a mid-run band change must not mis-award (#113 BLOCK 1).
   */
  band: AgeBandId;
  /** Quiz questions per round (design target; the endless run does not cap). */
  quizQs: number;
  /** Terrain Detective images per round. */
  terrainImages: number;
  /** Capital Quest questions per round; null when the loop is locked. */
  capitalQs: number | null;
  /** Duel seconds per turn; null when the loop is locked / no timers. */
  duelSeconds: number | null;
  /** Hint policy for this band. */
  hintPolicy: HintPolicy;
  /**
   * Pin-hit radius multiplier (×1.5 / ×1.25 / ×1.0). The km tolerance is
   * computed from this in difficulty.ts (pinToleranceKm — clamps apply
   * AFTER scaling).
   */
  pinTolerance: number;
  /** GeoDetective deal: starting clues; null when the loop is locked. */
  startingClues: number | null;
  /** GeoDetective guess cap; null when the loop is locked. */
  guessCap: number | null;
}

/**
 * The run config for a band (follow-up Item A).
 * `null` (unset profile) → the "11-13" full-access values = today's
 * production numbers.
 */
export function getBandConfig(band: AgeBandId | null): BandRunConfig {
  const effective: AgeBandId = band ?? FULL_ACCESS_BAND;
  const d = AGE_BANDS[effective].difficulty;
  return {
    band: effective,
    quizQs: d.quizQuestions,
    terrainImages: d.terrainImages,
    capitalQs: d.capitalQuestions,
    duelSeconds: d.duelSecondsPerTurn,
    hintPolicy: HINT_POLICIES[effective],
    pinTolerance: d.toleranceMultiplier,
    startingClues: d.startingClues,
    guessCap: d.guessCap,
  };
}

/** Runtime guard for persisted config snapshots (resume backfill). */
export function isBandRunConfig(value: unknown): value is BandRunConfig {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    (typeof c.band === "string" &&
      (AGE_BAND_IDS as readonly string[]).includes(c.band)) &&
    Number.isInteger(c.quizQs) &&
    Number.isInteger(c.terrainImages) &&
    (c.capitalQs === null || Number.isInteger(c.capitalQs)) &&
    (c.duelSeconds === null || Number.isInteger(c.duelSeconds)) &&
    (c.hintPolicy === "free" || c.hintPolicy === "one-per-round" || c.hintPolicy === "none") &&
    typeof c.pinTolerance === "number" &&
    Number.isFinite(c.pinTolerance) &&
    (c.startingClues === null || Number.isInteger(c.startingClues)) &&
    (c.guessCap === null || Number.isInteger(c.guessCap))
  );
}

// --- hint wiring (economy-safe) --------------------------------------------
// Run state carries `hintsUsed` + the policy enum from its config snapshot.
// Hints NEVER touch points (scoring is identical across bands — see
// difficulty.ts bandScoreMultiplier).

/** Hint button visibility/interactivity for a policy and usage count. */
export type HintButtonState = "enabled" | "disabled-used" | "hidden";

/**
 * The hint button's state: 5-7 always free; 8-10 disables after the one
 * hint is used; 11-13 hides the button entirely.
 */
export function hintButtonState(policy: HintPolicy, hintsUsed: number): HintButtonState {
  switch (policy) {
    case "free":
      return "enabled";
    case "one-per-round":
      return hintsUsed > 0 ? "disabled-used" : "enabled";
    case "none":
      return "hidden";
  }
}

/** True while the run still allows another hint tap. */
export function canUseHint(policy: HintPolicy, hintsUsed: number): boolean {
  return hintButtonState(policy, hintsUsed) === "enabled";
}

/**
 * Mascot auto-offer rule (5-7 only): after 2 misses in the run's OWN miss
 * counter the mascot may OFFER a hint. The offer is an opt-in tap — never
 * an auto-interrupt. Offer dismissal/nag state stays in the UI, not here.
 */
export function mascotOffersHint(policy: HintPolicy, missCount: number): boolean {
  return policy === "free" && missCount >= 2;
}

/**
 * 11-13 no-hint recognition: a cosmetic "Clean Round" Passport badge,
 * NEVER points (protects identical scoring; kills the perverse incentive
 * where struggling kids avoid hints they need). Eligible when a round
 * finished with zero hints used under the no-hint policy.
 */
export function cleanRoundEligible(policy: HintPolicy, hintsUsed: number): boolean {
  return policy === "none" && hintsUsed === 0;
}
