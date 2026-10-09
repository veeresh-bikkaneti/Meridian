import assert from "node:assert/strict";
import test from "node:test";

// --- Minimal localStorage shim (node has none), mirroring store.test.ts. ---
const backing = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
  setItem: (k: string, v: string) => {
    backing.set(k, v);
  },
  removeItem: (k: string) => {
    backing.delete(k);
  },
  clear: () => backing.clear(),
};

import {
  CLEAN_ROUND_BADGE_ID,
  PASSPORT_BADGES,
  awardCleanRoundBadge,
  awardPassportBadge,
  earnedPassportBadges,
  getPassportBadge,
  __resetPassportBadgeMemory,
} from "./badges.ts";

function clearStorage() {
  backing.clear();
  __resetPassportBadgeMemory();
}

// --- Clean Round: 11-13 no-hint WINS only, badge-only ---

test("Clean Round awarded on an 11-13 no-hint win", () => {
  clearStorage();
  const badge = awardCleanRoundBadge({ band: "11-13", hintsUsed: 0, loopId: "quiz", won: true });
  assert.ok(badge);
  assert.equal(badge.id, CLEAN_ROUND_BADGE_ID);
  assert.equal(badge.name, "Clean Round");
  assert.equal(earnedPassportBadges().some((b) => b.id === CLEAN_ROUND_BADGE_ID), true);
});

test("hints used → no badge (recognition is for genuinely hint-free wins)", () => {
  clearStorage();
  const badge = awardCleanRoundBadge({ band: "11-13", hintsUsed: 1, loopId: "quiz", won: true });
  assert.equal(badge, null);
  assert.equal(earnedPassportBadges().some((b) => b.id === CLEAN_ROUND_BADGE_ID), false);
});

test("5-7 and 8-10 wins never earn Clean Round (band-scoped recognition)", () => {
  clearStorage();
  assert.equal(awardCleanRoundBadge({ band: "5-7", hintsUsed: 0, loopId: "quiz", won: true }), null);
  assert.equal(awardCleanRoundBadge({ band: "8-10", hintsUsed: 0, loopId: "quiz", won: true }), null);
  assert.equal(earnedPassportBadges().some((b) => b.id === CLEAN_ROUND_BADGE_ID), false);
});

test("#113 BLOCK 2: losses never earn Clean Round, even hint-free on 11-13", () => {
  clearStorage();
  assert.equal(
    awardCleanRoundBadge({ band: "11-13", hintsUsed: 0, loopId: "quiz", won: false }),
    null,
  );
  assert.equal(earnedPassportBadges().some((b) => b.id === CLEAN_ROUND_BADGE_ID), false);
});

test("#113 BLOCK 1: award uses the deal-snapshot band — a mid-run band change cannot mis-award", () => {
  clearStorage();
  // Mystery dealt on 5-7 (snapshot band), grown-up flips to 11-13 mid-run:
  // the deal-time band governs, so no 11-13 badge is due.
  assert.equal(
    awardCleanRoundBadge({ band: "5-7", hintsUsed: 0, loopId: "quiz", won: true }),
    null,
  );
  // And the reverse: dealt on 11-13, flipped to 5-7 mid-run — the win still
  // earns, because the deal-time band was 11-13.
  assert.ok(
    awardCleanRoundBadge({ band: "11-13", hintsUsed: 0, loopId: "quiz", won: true }),
  );
  assert.equal(earnedPassportBadges().some((b) => b.id === CLEAN_ROUND_BADGE_ID), true);
});

test("#113 BLOCK 1: missing snapshot band fails closed (pre-snapshot puzzle)", () => {
  clearStorage();
  assert.equal(
    awardCleanRoundBadge({ band: undefined, hintsUsed: 0, loopId: "quiz", won: true }),
    null,
  );
  assert.equal(earnedPassportBadges().some((b) => b.id === CLEAN_ROUND_BADGE_ID), false);
});

test("badge copy is band-invisible: no age numbers, no easy/hard", () => {
  for (const badge of Object.values(PASSPORT_BADGES)) {
    const copy = `${badge.name} ${badge.blurb}`;
    assert.ok(!/\d/.test(copy), `badge copy contains a digit: ${copy}`);
    assert.ok(!/easy|hard/i.test(copy), `badge copy leaks difficulty: ${copy}`);
    assert.ok(!/11-13|8-10|5-7/.test(copy), `badge copy leaks a band: ${copy}`);
  }
});

// --- Cosmetic ONLY: never points, never scoring ---

test("earned badge records carry no points, no score, no band, no hint state", () => {
  clearStorage();
  awardCleanRoundBadge({ band: "11-13", hintsUsed: 0, loopId: "quiz", won: true });
  const earned = earnedPassportBadges();
  assert.equal(earned.length, 1);
  const serialized = JSON.stringify(earned);
  assert.ok(!/"points"/.test(serialized), "no points term in badge records");
  assert.ok(!/"score"/.test(serialized), "no score term in badge records");
  assert.ok(!/"band"/.test(serialized), "no band state in badge records");
  assert.ok(!/"hints?Used"/.test(serialized), "no hint state in badge records");
  assert.ok(earned[0].schemaVersion === 1 && typeof earned[0].earnedAt === "string");
});

test("awarding a badge never touches the score object", () => {
  clearStorage();
  const score = { points: 42, combo: 3, breakdown: { base: 10 } };
  const before = JSON.parse(JSON.stringify(score));
  awardCleanRoundBadge({ band: "11-13", hintsUsed: 0, loopId: "quiz", won: true });
  assert.deepEqual(score, before);
});

test("award is idempotent: re-awarding never duplicates", () => {
  clearStorage();
  awardCleanRoundBadge({ band: "11-13", hintsUsed: 0, loopId: "quiz", won: true });
  awardCleanRoundBadge({ band: "11-13", hintsUsed: 0, loopId: "quiz", won: true });
  assert.equal(earnedPassportBadges().length, 1);
});

// --- Registry ---

test("unknown badge id → null, nothing stored", () => {
  clearStorage();
  assert.equal(awardPassportBadge("nope"), null);
  assert.equal(getPassportBadge("nope"), null);
  assert.equal(earnedPassportBadges().length, 0);
});
