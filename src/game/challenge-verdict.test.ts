import assert from "node:assert/strict";
import test from "node:test";
import {
  NEAR_MISS_MAX_SHORTFALL,
  VERDICT_HEADLINES,
  VERDICT_ICONS,
  classifyVerdict,
  exactRouteTargetShareText,
  hitMaskFromResults,
  maxAttainableRemaining,
  mintWinnerBlock,
  passAlongReceipt,
  placeScoreBound,
  routeTierCeiling,
  stopScoreBound,
  trailingStreak,
  verdictAriaSentence,
  verdictAttemptsFacts,
  verdictDuelLine,
  verdictMarginSentence,
  verdictSubLine,
} from "./challenge-verdict.ts";
import type { ChallengeWinner } from "./challenge.ts";

/**
 * Verdict tests (governing council manifest 2026-10-31, §Q3 + §Q4):
 * taxonomy boundaries at the exact formulas, byte-exact copy, the
 * minting rules (ratchet, farming guard, zero-target), and the chip's
 * attainability bound.
 */

test("verdict taxonomy: WIN / HOLD / NEAR-MISS / LOSS at the exact boundaries", () => {
  assert.equal(NEAR_MISS_MAX_SHORTFALL, 207);
  // WIN: strictly above the target. An exact tie is HOLD, never a win.
  assert.equal(classifyVerdict(1001, 1000), "win");
  assert.equal(classifyVerdict(1000, 1000), "hold");
  // HOLD band = max(5% of T, 25). T=1000 → 50.
  assert.equal(classifyVerdict(950, 1000), "hold");
  assert.equal(classifyVerdict(949, 1000), "near-miss");
  // T=100 → the 25 floor binds (5% would be 5).
  assert.equal(classifyVerdict(75, 100), "hold");
  assert.equal(classifyVerdict(74, 100), "near-miss");
  // T=955 → 5% floors to 47 (integer shortfalls make floor ≡ raw).
  assert.equal(classifyVerdict(955 - 47, 955), "hold");
  assert.equal(classifyVerdict(955 - 48, 955), "near-miss");
  // NEAR-MISS edge: shortfall 207 vs 208, clear of the HOLD band.
  assert.equal(classifyVerdict(2000 - 207, 2000), "near-miss");
  assert.equal(classifyVerdict(2000 - 208, 2000), "loss");
  assert.equal(classifyVerdict(0, 955), "loss");
});

test("verdict copy: headlines, icons, sub-line, margin sentences are byte-exact", () => {
  assert.equal(VERDICT_HEADLINES.win, "You beat it! 🏆");
  assert.equal(VERDICT_HEADLINES.hold, "Dead heat! You share the crown! 🤝");
  assert.equal(VERDICT_HEADLINES["near-miss"], "So close! 🎯");
  assert.equal(VERDICT_HEADLINES.loss, "Better luck next time! 🍀");
  assert.deepEqual(VERDICT_ICONS, { win: "★", hold: "=", "near-miss": "◐", loss: "✕" });
  assert.equal(verdictSubLine(955, 3340), "You scored 955 of 3340 possible on this route.");
  assert.equal(verdictMarginSentence("win", 1000, 955), "You won by 45.");
  assert.equal(verdictMarginSentence("hold", 950, 955), "You were just 5 away from the best of 955.");
  assert.equal(verdictMarginSentence("near-miss", 900, 955), "You were 55 away from the best of 955.");
  assert.equal(verdictMarginSentence("loss", 100, 955), "The best to beat is 955.");
});

test("verdict duel line: only when sender < best; ahead/behind/level forms", () => {
  const crown: ChallengeWinner = { senderMask: 0, senderScore: 955, bestScore: 955, senderAttempts: 1 };
  assert.equal(verdictDuelLine(1200, crown), null, "sender set the mark — the verdict is the duel");
  const duel: ChallengeWinner = { senderMask: 0, senderScore: 700, bestScore: 955, senderAttempts: 2 };
  assert.equal(verdictDuelLine(800, duel), "You also outscored the friend who sent you this link.");
  assert.equal(verdictDuelLine(600, duel), "You didn't quite catch the friend who sent you this link (700).");
  assert.equal(verdictDuelLine(700, duel), "You matched the friend who sent you this link (700).");
});

test("verdict attempts facts: sender's tries as story, own count, guard line only when bound", () => {
  const crown: ChallengeWinner = { senderMask: 0, senderScore: 955, bestScore: 955, senderAttempts: 1 };
  assert.deepEqual(
    verdictAttemptsFacts({ winner: crown, ownCompletions: 1, farmingGuardBound: false }),
    ["The mark was set in one go.", "You've finished this route 1 times."],
  );
  const crown3: ChallengeWinner = { ...crown, senderAttempts: 3 };
  assert.deepEqual(
    verdictAttemptsFacts({ winner: crown3, ownCompletions: 0, farmingGuardBound: false }),
    ["The mark was set in 3 tries."],
  );
  const duel: ChallengeWinner = { senderMask: 0, senderScore: 700, bestScore: 955, senderAttempts: 2 };
  assert.deepEqual(
    verdictAttemptsFacts({ winner: duel, ownCompletions: 2, farmingGuardBound: true }),
    [
      "Your friend's score took them 2 tries.",
      "You've finished this route 2 times.",
      "The target only rises on a player's first two tries at a route.",
    ],
  );
});

test("verdict aria sentence: the manifest's exact composition", () => {
  assert.equal(
    verdictAriaSentence({ cls: "win", mine: 1000, best: 955, myHits: 4, placeCount: 5, ceiling: 1514 }),
    "You beat it! 🏆 You scored 1000. The best was 955. You won by 45. " +
      "You landed 4 of 5 stops, out of 1514 possible on this route.",
  );
});

test("receipts: the five byte-exact forms; a loss carries no margin number", () => {
  assert.equal(
    passAlongReceipt({ cls: "win", mine: 1000, newBest: 1000, regionName: "Nebraska" }),
    "I BEAT IT 🎯 — 1000 on your Nebraska route. Best is now 1000 — beat that!",
  );
  assert.equal(
    passAlongReceipt({ cls: "hold", mine: 950, newBest: 955, regionName: "Nebraska" }),
    "DEAD HEAT 🤝 — 950 on your Nebraska route. Target stays 955 — come and take it.",
  );
  assert.equal(
    passAlongReceipt({ cls: "near-miss", mine: 900, newBest: 955, regionName: "Nebraska" }),
    "SO CLOSE 🎯 — 900 on your Nebraska route. The target's still out there — passing it on!",
  );
  const loss = passAlongReceipt({ cls: "loss", mine: 100, newBest: 955, regionName: "Nebraska" });
  assert.equal(loss, "IT GOT ME 🎯 — 100 on your Nebraska route. Better luck to the next player — passing it on!");
  assert.ok(!loss.includes("955"), "no best/margin number leaks into a loss receipt");
  assert.equal(
    passAlongReceipt({ cls: "chain-start", mine: 800, newBest: 800, regionName: "Nebraska" }),
    "🎯 I scored 800 on this Nebraska route — beat that!",
  );
  assert.equal(
    exactRouteTargetShareText({ senderScore: 955, placeCount: 10, regionName: "Nebraska", radiusKm: 87, url: "https://x/#c=mc3.AA" }),
    "🎯 I scored 955 on this Nebraska route — 10 places, 87 km circle. Beat that! " +
      "Same places, same circle for everyone.\n(Link opens in the Meridian app — newest version.)\nhttps://x/#c=mc3.AA",
  );
});

test("minting: ratchet, sender update, farming guard, zero-target, saturation (§Q2-B2/B4)", () => {
  // Fresh chain: best is my score.
  assert.deepEqual(
    mintWinnerBlock({ myScore: 500, myMask: 0xf800, myAttempts: 1, incomingBest: null }),
    { winner: { senderMask: 0xf800, senderScore: 500, bestScore: 500, senderAttempts: 1 }, farmingGuardBound: false },
  );
  // Ratchet holds: a lower score updates the sender, never the best.
  assert.deepEqual(
    mintWinnerBlock({ myScore: 500, myMask: 0xf800, myAttempts: 1, incomingBest: 900 }).winner,
    { senderMask: 0xf800, senderScore: 500, bestScore: 900, senderAttempts: 1 },
  );
  // Overtake on a first or second try raises the best.
  assert.equal(
    mintWinnerBlock({ myScore: 950, myMask: 0xf800, myAttempts: 2, incomingBest: 900 }).winner?.bestScore,
    950,
  );
  // Farming guard: 3rd+ completion cannot raise the best — but the
  // sender's own mark still updates, and the binding is reported.
  const guarded = mintWinnerBlock({ myScore: 950, myMask: 0xf800, myAttempts: 3, incomingBest: 900 });
  assert.equal(guarded.winner?.bestScore, 900);
  assert.equal(guarded.winner?.senderScore, 950);
  assert.equal(guarded.farmingGuardBound, true);
  // The guard does not "bind" when the score wouldn't have risen anyway.
  assert.equal(
    mintWinnerBlock({ myScore: 500, myMask: 0xf800, myAttempts: 5, incomingBest: 900 }).farmingGuardBound,
    false,
  );
  // Zero target: an all-miss first completion mints NO block.
  assert.deepEqual(
    mintWinnerBlock({ myScore: 0, myMask: 0, myAttempts: 1, incomingBest: null }),
    { winner: null, farmingGuardBound: false },
  );
  // Attempts saturate at the wire field's ceiling.
  assert.equal(
    mintWinnerBlock({ myScore: 500, myMask: 0xf800, myAttempts: 300, incomingBest: null }).winner?.senderAttempts,
    255,
  );
});

test("hit mask + chip attainability: wire bits, streak math, bounds", () => {
  assert.equal(hitMaskFromResults([{ hit: true }, { hit: false }, { hit: true }]), 0xa000);
  assert.equal(hitMaskFromResults([]), 0);
  assert.equal(trailingStreak([{ hit: true }, { hit: false }, { hit: true }, { hit: true }]), 2);
  assert.equal(trailingStreak([{ hit: false }]), 0);
  // Per-stop bounds are the B1 family: streak 1 → 278, streak 4 → 315.
  assert.equal(stopScoreBound(1), 278);
  assert.equal(stopScoreBound(4), 315);
  assert.equal(maxAttainableRemaining([], 0), 0);
  assert.equal(maxAttainableRemaining([5, 5], 0), 278 + 290);
  assert.equal(maxAttainableRemaining([5], 3), 315);
  // The chip's switch condition, worked end-to-end: after 2 misses of
  // 5 (running 0, streak 0), 3 tier-5 stops remain worth at most 871 < 955.
  assert.ok(0 + maxAttainableRemaining([5, 5, 5], 0) < 955);
});

test("tier-aware ceilings (owner D2 amendment, 2026-11-01): surfaces quote the route's real max", () => {
  // Per-place bounds carry the place's own tier multiplier.
  assert.equal(placeScoreBound(1, 5), 278); // tier 5, streak 1 — the B1 stop-1 cap
  assert.equal(placeScoreBound(1, 1), 120); // tier 1: round(100 × 1.0 × 1.05) + 15
  assert.equal(placeScoreBound(3, 2), 159); // tier 2: round(100 × 1.25 × 1.15) + 15
  // The D2 measurement table (pipeline record, from scoring.ts): an
  // all-Famous route of 5 tops out at 650 — the tier-blind surface
  // quoted 1,514, a "possible" no perfect run could reach.
  assert.equal(routeTierCeiling([1, 1, 1, 1, 1]), 650);
  assert.equal(routeTierCeiling([2, 2, 2, 2, 2]), 794);
  assert.equal(routeTierCeiling([3, 3, 3, 3, 3]), 939);
  assert.equal(routeTierCeiling([4, 4, 4, 4, 4]), 1225);
  // All tier 5 == the codec's tier-blind ceiling (the gate's number —
  // the surfaces and the gate agree exactly when the route IS hardest).
  assert.equal(routeTierCeiling([5, 5, 5, 5, 5]), 1514);
  assert.equal(routeTierCeiling([5, 5, 5, 5, 5, 5, 5, 5, 5, 5]), 3340);
  // Mixed tiers sum per place, in play order (the verdict E2E route:
  // Lincoln 1, Omaha 1, Bellevue 2, Fremont 2, Grand Island 2).
  assert.equal(routeTierCeiling([1, 1, 2, 2, 2]), 120 + 125 + 159 + 165 + 171);
  assert.equal(routeTierCeiling([1, 1, 2, 2, 2]), 740);
  // Chip attainability at the remaining places' own tiers: on the
  // E2E route a 500 target survives one miss (597 left) and leaves
  // reach after two (458 left) — the tier-blind form (871) fired late.
  assert.equal(maxAttainableRemaining([1, 2, 2, 2], 0), 597);
  assert.equal(maxAttainableRemaining([2, 2, 2], 0), 458);
  assert.ok(0 + maxAttainableRemaining([1, 2, 2, 2], 0) >= 500);
  assert.ok(0 + maxAttainableRemaining([2, 2, 2], 0) < 500);
});
