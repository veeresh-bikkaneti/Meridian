import {
  PLACE_SCORE_CAP,
  REGION_BONUS,
  comboForStreak,
  difficultyTier,
  type Difficulty,
} from "./scoring.ts";
import type { ChallengeWinner } from "./challenge.ts";

/**
 * Winner declaration — the verdict mathematics and copy (governing
 * council manifest 2026-10-31, §Q3 receipts + §Q4 verdict screen).
 * Pure functions only: the screens in game-app.tsx render what this
 * module decides, so the taxonomy boundaries and the byte-exact words
 * are testable without a browser.
 *
 * Actors (§Q2-B2): `senderScore`/`senderMask`/`senderAttempts` attest
 * the player who MINTED the link you received; `bestScore` attests the
 * chain. The verdict's bar is always bestScore; the sender is the
 * duel, never the bar; no surface declares a win against the sender.
 */

export type VerdictClass = "win" | "hold" | "near-miss" | "loss";

/** Half a place cap — "within one good stop", constant for all n. */
export const NEAR_MISS_MAX_SHORTFALL = Math.floor(
  (PLACE_SCORE_CAP + REGION_BONUS) / 2,
); // 207

/**
 * The taxonomy. T = bestScore (the target), shortfall = T − mine.
 * WIN: mine > T. HOLD: shortfall ≤ max(⌊5% of T⌋, 25) — a dead heat,
 * never a loss, never moves the ratchet. The 5% is FLOORED before the
 * max (owner D2 amendment, 2026-11-01: the floor is the law — at
 * T = 955 the band is 47, not 48; the manifest §Q4 text pins this so
 * the boundary cannot drift by interpretation). NEAR-MISS:
 * shortfall ≤ 207. LOSS: everything else.
 */
export function classifyVerdict(mine: number, best: number): VerdictClass {
  if (mine > best) return "win";
  const shortfall = best - mine;
  if (shortfall <= Math.max(Math.floor(best * 0.05), 25)) return "hold";
  if (shortfall <= NEAR_MISS_MAX_SHORTFALL) return "near-miss";
  return "loss";
}

export const VERDICT_HEADLINES: Record<VerdictClass, string> = {
  win: "You beat it! 🏆",
  hold: "Dead heat! You share the crown! 🤝",
  "near-miss": "So close! 🎯",
  loss: "Better luck next time! 🍀",
};

/** Shape icons — the outcome never rides on colour alone (§Q4). */
export const VERDICT_ICONS: Record<VerdictClass, string> = {
  win: "★",
  hold: "=",
  "near-miss": "◐",
  loss: "✕",
};

export function verdictSubLine(mine: number, ceiling: number): string {
  return `You scored ${mine} of ${ceiling} possible on this route.`;
}

export function verdictMarginSentence(
  cls: VerdictClass,
  mine: number,
  best: number,
): string {
  switch (cls) {
    case "win":
      return `You won by ${mine - best}.`;
    case "hold":
      return `You were just ${best - mine} away from the best of ${best}.`;
    case "near-miss":
      return `You were ${best - mine} away from the best of ${best}.`;
    case "loss":
      return `The best to beat is ${best}.`;
  }
}

/**
 * The duel line — only when sender < best (when the sender set the
 * mark, the verdict already IS the duel; stating it twice teaches two
 * bars). Null when it must not render.
 */
export function verdictDuelLine(
  mine: number,
  winner: ChallengeWinner,
): string | null {
  if (winner.senderScore >= winner.bestScore) return null;
  if (mine > winner.senderScore) {
    return "You also outscored the friend who sent you this link.";
  }
  if (mine < winner.senderScore) {
    return `You didn't quite catch the friend who sent you this link (${winner.senderScore}).`;
  }
  return `You matched the friend who sent you this link (${winner.senderScore}).`;
}

/**
 * Attempts facts (tertiary, post-completion only — attempts is never
 * shown pre-play, never in receipts, never comparatively). The
 * sender's tries are attributed to the SENDER's mark only; the
 * crown-holder's tries are unknown when sender < best, and no surface
 * states a number for them.
 */
export function verdictAttemptsFacts(input: {
  winner: ChallengeWinner;
  /** The receiver's own completions of this route, incl. this one. */
  ownCompletions: number;
  /** True when the farming guard stopped this mint raising the best. */
  farmingGuardBound: boolean;
}): string[] {
  const facts: string[] = [];
  const { winner } = input;
  const k = winner.senderAttempts;
  if (winner.senderScore === winner.bestScore) {
    facts.push(
      k === 1 ? "The mark was set in one go." : `The mark was set in ${k} tries.`,
    );
  } else {
    facts.push(
      k === 1
        ? "Your friend's score took them one go."
        : `Your friend's score took them ${k} tries.`,
    );
  }
  if (input.ownCompletions > 0) {
    // The deck's template is literal — it gives singular forms for
    // the "one go" lines but not for this one, so "{j} times" stands
    // as written for every j (Narrative owns the words; flagged in
    // the PR body for the Package B panel).
    facts.push(`You've finished this route ${input.ownCompletions} times.`);
  }
  if (input.farmingGuardBound) {
    facts.push("The target only rises on a player's first two tries at a route.");
  }
  return facts;
}

/** The one aria-live sentence, fired at the verdict-word point. */
export function verdictAriaSentence(input: {
  cls: VerdictClass;
  mine: number;
  best: number;
  myHits: number;
  placeCount: number;
  ceiling: number;
}): string {
  const headline = VERDICT_HEADLINES[input.cls];
  const margin = verdictMarginSentence(input.cls, input.mine, input.best);
  return (
    `${headline} You scored ${input.mine}. The best was ${input.best}. ` +
    `${margin} You landed ${input.myHits} of ${input.placeCount} stops, ` +
    `out of ${input.ceiling} possible on this route.`
  );
}

/**
 * Pass-along receipts (§Q3 — no version line, no tries clause, no
 * margin number in a loss). `newBest` is the best AFTER this play
 * (best′). For a chain-start (no incoming winner block) the receipt
 * is its own form.
 */
export function passAlongReceipt(input: {
  cls: VerdictClass | "chain-start";
  mine: number;
  newBest: number;
  regionName: string;
}): string {
  const { mine, newBest, regionName } = input;
  switch (input.cls) {
    case "win":
      return `I BEAT IT 🎯 — ${mine} on your ${regionName} route. Best is now ${newBest} — beat that!`;
    case "hold":
      return `DEAD HEAT 🤝 — ${mine} on your ${regionName} route. Target stays ${newBest} — come and take it.`;
    case "near-miss":
      return `SO CLOSE 🎯 — ${mine} on your ${regionName} route. The target's still out there — passing it on!`;
    case "loss":
      return `IT GOT ME 🎯 — ${mine} on your ${regionName} route. Better luck to the next player — passing it on!`;
    case "chain-start":
      return `🎯 I scored ${mine} on this ${regionName} route — beat that!`;
  }
}

/** The exact-match summary share text when a winner block is minted. */
export function exactRouteTargetShareText(input: {
  senderScore: number;
  placeCount: number;
  regionName: string;
  radiusKm: number;
  url: string;
}): string {
  return (
    `🎯 I scored ${input.senderScore} on this ${input.regionName} route — ` +
    `${input.placeCount} places, ${input.radiusKm} km circle. Beat that! ` +
    `Same places, same circle for everyone.\n` +
    `(Link opens in the Meridian app — newest version.)\n${input.url}`
  );
}

export interface MintedWinner {
  winner: ChallengeWinner | null;
  /** True when the farming guard stopped best′ rising (§Q2-B4). */
  farmingGuardBound: boolean;
}

/**
 * Mint the winner block for a completed route (§Q2-B2/B4).
 *
 * - The minter's own mark: myScore, myMask, myAttempts (their
 *   completions of this route INCLUDING this one, saturated at 255 —
 *   the wire field's range).
 * - best′ = max(incoming best, myScore) — except the FARMING GUARD:
 *   on my 3rd-or-later completion of this same route, best′ cannot
 *   rise ABOVE THE CHAIN'S BEST (my mark still updates — §Q2-B4's
 *   own parenthetical). With no incoming best there is no ratchet to
 *   raise: the completion chain-starts at my score as usual.
 * - best′ = 0 mints NO block: a zero target is never a chain state —
 *   the route chain-starts open instead.
 */
export function mintWinnerBlock(input: {
  myScore: number;
  myMask: number;
  myAttempts: number;
  incomingBest: number | null;
}): MintedWinner {
  const attempts = Math.min(Math.max(input.myAttempts, 1), 255);
  const incoming = input.incomingBest ?? 0;
  const farmingGuardBound =
    input.incomingBest !== null && input.myAttempts >= 3 && input.myScore > incoming;
  const newBest = farmingGuardBound ? incoming : Math.max(incoming, input.myScore);
  if (newBest < 1) return { winner: null, farmingGuardBound: false };
  return {
    winner: {
      senderMask: input.myMask,
      senderScore: input.myScore,
      bestScore: newBest,
      senderAttempts: attempts,
    },
    farmingGuardBound,
  };
}

/** Hit-mask in wire form: stop i (0-based, play order) is bit 15−i. */
export function hitMaskFromResults(results: readonly { hit: boolean }[]): number {
  let mask = 0;
  results.forEach((r, i) => {
    if (r.hit && i < 16) mask |= 1 << (15 - i);
  });
  return mask;
}

/**
 * The per-stop score bound at a given streak for a place of the
 * given difficulty — §Q2-B1's formula with the place's OWN tier
 * multiplier (tier 5 = 2.5, tier 1 = 1.0), every constant derived
 * from scoring.ts. A perfect-distance hit at that tier scores
 * min(PLACE_SCORE_CAP, round(100 × mult × combo)) plus the bonus.
 */
export function placeScoreBound(streak: number, difficulty: Difficulty): number {
  return (
    Math.min(
      PLACE_SCORE_CAP,
      Math.round(100 * difficultyTier(difficulty).multiplier * comboForStreak(streak)),
    ) + REGION_BONUS
  );
}

/** The per-stop score bound at a given streak — §Q2-B1's formula in
 * its tier-5 (hardest) form, the codec family's bound. */
export function stopScoreBound(streak: number): number {
  return placeScoreBound(streak, 5);
}

/**
 * The route's REAL ceiling (owner D2 amendment, 2026-11-01): the
 * sequential bound summed over the route's own places in play order,
 * each stop at its own tier — an all-tier-1 route of 5 tops out at
 * 650, not the tier-blind 1,514. This is what the verdict sub-line,
 * the target bar, and the aria sentence quote (§Q4 surfaces only).
 * It is NOT the codec gate: challenge.ts `routeCeiling` stays
 * tier-blind, because a link's plausibility gate must accept the
 * hardest legal route.
 */
export function routeTierCeiling(difficulties: readonly Difficulty[]): number {
  let total = 0;
  difficulties.forEach((difficulty, i) => {
    total += placeScoreBound(i + 1, difficulty);
  });
  return total;
}

/**
 * The most a player can still add from the stops remaining, given
 * the streak they carry into the next stop (consecutive hits so
 * far) and the remaining places' OWN tiers (D2 amendment: the
 * tier-blind form fired late or never on easy routes, so a deficit
 * counter rode runs that could no longer be won). The in-run chip
 * switches to its landed-count form once
 * `runningScore + maxAttainableRemaining(...) < best` (§Q4).
 */
export function maxAttainableRemaining(
  remainingDifficulties: readonly Difficulty[],
  streakCarriedIn: number,
): number {
  let total = 0;
  remainingDifficulties.forEach((difficulty, j) => {
    total += placeScoreBound(streakCarriedIn + j + 1, difficulty);
  });
  return total;
}

/** Consecutive hits at the END of a results list (the carried streak). */
export function trailingStreak(results: readonly { hit: boolean }[]): number {
  let streak = 0;
  for (let i = results.length - 1; i >= 0; i--) {
    if (!results[i]!.hit) break;
    streak++;
  }
  return streak;
}
