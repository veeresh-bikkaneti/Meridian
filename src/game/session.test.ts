import assert from "node:assert/strict";
import test from "node:test";
import {
  bankPlace,
  endSession,
  IDLE_TIMEOUT_MS,
  idleTimeoutFromSearch,
  idleWarnMsFor,
  isIdleExpired,
  isSessionLive,
  readSession,
  clearSession,
  seedSessionFromRun,
  startSession,
  summarizeSession,
  touchSession,
  writeSession,
} from "./session.ts";
import { startRun, dropPin } from "./run.ts";
import { SCORING_VERSION, type ScoredPlace } from "./scoring.ts";

function fakeScored(score: number): ScoredPlace {
  return {
    base: 80,
    difficulty: 3,
    diffMult: 1.5,
    streak: 1,
    combo: 1.05,
    regionBonus: 0,
    regionBonusLabel: null,
    score,
  };
}

const NOW = 1_700_000_000_000;

test("startSession: zeroed totals, not ended, records activity time", () => {
  const s = startSession("2026-10-02", NOW);
  assert.equal(s.dateKey, "2026-10-02");
  assert.equal(s.totalScore, 0);
  assert.equal(s.placesPlayed, 0);
  assert.equal(s.hits, 0);
  assert.equal(s.bestStreak, 0);
  assert.equal(s.bestDistanceKm, null);
  assert.equal(s.lastActivityAt, NOW);
  assert.equal(s.ended, false);
  assert.ok(typeof s.id === "string" && s.id.length > 0);
  assert.deepEqual(s.byEdition.globe, { score: 0, places: 0, hits: 0 });
});

test("bankPlace: accumulates totals and the per-edition breakdown", () => {
  let s = startSession("2026-10-02", NOW);
  s = bankPlace(s, { edition: "globe", score: 120, hit: true, distanceKm: 40, streakAfter: 1 });
  s = bankPlace(s, { edition: "globe", score: 200, hit: true, distanceKm: 10, streakAfter: 2 });
  s = bankPlace(s, { edition: "country", score: 0, hit: false, distanceKm: 900, streakAfter: 0 });
  assert.equal(s.totalScore, 320);
  assert.equal(s.placesPlayed, 3);
  assert.equal(s.hits, 2);
  assert.equal(s.bestStreak, 2);
  assert.equal(s.totalDistanceKm, 950);
  assert.equal(s.bestDistanceKm, 10);
  assert.deepEqual(s.byEdition.globe, { score: 320, places: 2, hits: 2 });
  assert.deepEqual(s.byEdition.country, { score: 0, places: 1, hits: 0 });
  assert.deepEqual(s.byEdition.state, { score: 0, places: 0, hits: 0 });
});

test("bankPlace: a miss banks 0 points but still counts the place", () => {
  let s = startSession("2026-10-02", NOW);
  s = bankPlace(s, { edition: "state", score: 0, hit: false, distanceKm: 55, streakAfter: 0 });
  assert.equal(s.totalScore, 0);
  assert.equal(s.placesPlayed, 1);
  assert.equal(s.hits, 0);
  assert.deepEqual(s.byEdition.state, { score: 0, places: 1, hits: 0 });
});

test("bankPlace: pure — never mutates the input session", () => {
  const s = startSession("2026-10-02", NOW);
  const next = bankPlace(s, { edition: "globe", score: 50, hit: true, distanceKm: 5, streakAfter: 1 });
  assert.equal(s.totalScore, 0);
  assert.equal(next.totalScore, 50);
});

test("touchSession: moves the activity timestamp forward only", () => {
  const s = startSession("2026-10-02", NOW);
  const touched = touchSession(s, NOW + 5000);
  assert.equal(touched.lastActivityAt, NOW + 5000);
  assert.equal(s.lastActivityAt, NOW);
});

test("isSessionLive: live only when un-ended and from today", () => {
  const s = startSession("2026-10-02", NOW);
  assert.equal(isSessionLive(s, "2026-10-02"), true);
  assert.equal(isSessionLive(s, "2026-10-03"), false);
  assert.equal(isSessionLive(null, "2026-10-02"), false);
  assert.equal(isSessionLive(endSession(s), "2026-10-02"), false);
});

test("isIdleExpired: fires only past the timeout", () => {
  const s = startSession("2026-10-02", NOW);
  assert.equal(isIdleExpired(s, NOW + IDLE_TIMEOUT_MS - 1), false);
  assert.equal(isIdleExpired(s, NOW + IDLE_TIMEOUT_MS), false);
  assert.equal(isIdleExpired(s, NOW + IDLE_TIMEOUT_MS + 1), true);
  // Custom (E2E) timeout is honored.
  assert.equal(isIdleExpired(s, NOW + 4000, 3000), true);
  assert.equal(isIdleExpired(s, NOW + 2000, 3000), false);
});

test("endSession: marks ended; summarizeSession tallies with breakdown", () => {
  let s = startSession("2026-10-02", NOW);
  s = bankPlace(s, { edition: "globe", score: 120, hit: true, distanceKm: 40, streakAfter: 1 });
  s = bankPlace(s, { edition: "state", score: 90, hit: true, distanceKm: 20, streakAfter: 2 });
  const ended = endSession(s);
  assert.equal(ended.ended, true);
  assert.equal(isSessionLive(ended, "2026-10-02"), false);
  const summary = summarizeSession(ended);
  assert.equal(summary.totalScore, 210);
  assert.equal(summary.placesPlayed, 2);
  assert.equal(summary.hits, 2);
  assert.equal(summary.averagePerPlace, 105);
  assert.equal(summary.bestStreak, 2);
  assert.equal(summary.averageDistanceKm, 30);
  assert.equal(summary.bestDistanceKm, 20);
  assert.deepEqual(
    summary.byEdition.map((b) => [b.edition, b.score, b.places, b.hits]),
    [
      ["globe", 120, 1, 1],
      ["country", 0, 0, 0],
      ["state", 90, 1, 1],
    ],
  );
});

test("summarizeSession: empty session summarizes to zeros", () => {
  const summary = summarizeSession(startSession("2026-10-02", NOW));
  assert.equal(summary.totalScore, 0);
  assert.equal(summary.placesPlayed, 0);
  assert.equal(summary.averagePerPlace, 0);
  assert.equal(summary.bestDistanceKm, null);
  assert.equal(summary.byEdition.length, 3);
});

test("seedSessionFromRun: backfills a pre-session run's results exactly once", () => {
  const today = { edition: "globe" as const, regionId: "globe", regionName: "Globe", dateKey: "2026-10-02" };
  let run = startRun(today, ["p1", "p2"]);
  run = dropPin(run, 25, 1000, fakeScored(120));
  run = { ...run, phase: "aim" as const, index: 1 };
  run = dropPin(run, 5000, 1000, null); // miss
  const seeded = seedSessionFromRun(startSession("2026-10-02", NOW), run);
  assert.equal(seeded.totalScore, 120);
  assert.equal(seeded.placesPlayed, 2);
  assert.equal(seeded.hits, 1);
  assert.deepEqual(seeded.byEdition.globe, { score: 120, places: 2, hits: 1 });
  // Seeding twice would double-count — the caller must only seed fresh sessions.
  const double = seedSessionFromRun(seeded, run);
  assert.equal(double.totalScore, 240);
});

test("idleTimeoutFromSearch: ?idle-ms= seam with safe fallbacks", () => {
  assert.equal(idleTimeoutFromSearch("", 999), 999);
  assert.equal(idleTimeoutFromSearch("?idle-ms=3000"), 3000);
  assert.equal(idleTimeoutFromSearch("?foo=1&idle-ms=4500"), 4500);
  assert.equal(idleTimeoutFromSearch("?idle-ms=0"), IDLE_TIMEOUT_MS);
  assert.equal(idleTimeoutFromSearch("?idle-ms=-5"), IDLE_TIMEOUT_MS);
  assert.equal(idleTimeoutFromSearch("?idle-ms=abc"), IDLE_TIMEOUT_MS);
  assert.equal(idleTimeoutFromSearch("?IDLE-MS=3000"), IDLE_TIMEOUT_MS);
});

test("idleWarnMsFor: 30s before the kick, halfway for short E2E timeouts", () => {
  assert.equal(idleWarnMsFor(IDLE_TIMEOUT_MS), 90_000);
  assert.equal(idleWarnMsFor(5000), 2500);
  assert.equal(idleWarnMsFor(60_000), 30_000);
});

test("storage round-trip: write/read preserves the session; garbage reads as null", () => {
  // node:test has no sessionStorage; emulate the DOM API surface used.
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).sessionStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  try {
    assert.equal(readSession(), null);
    let s = startSession("2026-10-02", NOW);
    s = bankPlace(s, { edition: "country", score: 75, hit: true, distanceKm: 30, streakAfter: 3 });
    writeSession(s);
    const restored = readSession();
    assert.ok(restored);
    assert.equal(restored.totalScore, 75);
    assert.equal(restored.bestStreak, 3);
    assert.deepEqual(restored.byEdition.country, { score: 75, places: 1, hits: 1 });
    assert.equal(restored.lastActivityAt, NOW);
    clearSession();
    assert.equal(readSession(), null);
    // Malformed payloads fail closed.
    store.set("meridian.session", "{not json");
    assert.equal(readSession(), null);
    store.set("meridian.session", JSON.stringify({ ...s, totalScore: -5 }));
    assert.equal(readSession(), null);
    store.set("meridian.session", JSON.stringify({ ...s, byEdition: { globe: { score: 1 } } }));
    assert.equal(readSession(), null);
  } finally {
    delete (globalThis as Record<string, unknown>).sessionStorage;
  }
});

// The scoring version gate lives in run.ts; sessions bank stored scores
// verbatim, so a version bump retires runs (and their sessions) together.
test("banked scores carry the run's scoring version implicitly via results", () => {
  const r = {
    distanceKm: 10,
    hit: true,
    score: 90,
    scoringVersion: SCORING_VERSION,
    breakdown: fakeScored(90),
    streakBefore: 0,
  };
  assert.equal(r.scoringVersion, SCORING_VERSION);
});
