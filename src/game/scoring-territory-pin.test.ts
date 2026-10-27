/**
 * The scoring money invariant, EXECUTED (#211 item 3).
 *
 * `scorePlace` reads territory synchronously through `territoryAt`
 * and must stay a pure sync function — the preload gate lives at its
 * callers (openRun / boot restore / replay, source-pinned in
 * territory-lazy-boundary.test.ts). This file pins what that wiring
 * buys, with real calls in a fresh process:
 *
 * - BEFORE any preload, an in-country globe pin scores regionBonus 0
 *   (fail-closed: an unloaded atlas can cost the +15, never invent it).
 * - AFTER `await preloadTerritory()`, the same call scores the real
 *   +15 country bonus.
 *
 * If a future change makes scoring trigger (or skip) the load itself,
 * the first assertion is the one that turns red.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { scorePlace } from "./scoring.ts";
import { preloadTerritory } from "./territory.ts";

const PARIS: [number, number] = [2.3522, 48.8566];
const NEAR_ORLEANS: [number, number] = [2.3522, 47.7766]; // ~120 km south, still France

function scoreParisGuess() {
  return scorePlace({
    distanceKm: 120,
    ring: "world",
    difficulty: 4,
    streakBefore: 0,
    edition: "globe",
    regionId: "globe",
    pin: NEAR_ORLEANS,
    target: PARIS,
  });
}

test("region bonus is 0 before the territory preload and +15 after it", async () => {
  assert.equal(
    scoreParisGuess().regionBonus,
    0,
    "unloaded atlas: the country bonus fails closed at 0",
  );
  await preloadTerritory();
  assert.equal(
    scoreParisGuess().regionBonus,
    15,
    "loaded atlas: the same in-country pin earns the real +15",
  );
});
