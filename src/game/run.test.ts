import assert from "node:assert/strict";
import test from "node:test";
import { continueRun, dropPin, endRun, isResumable, resumeRun, startRun, summarizeRun } from "./run.ts";
import { SCORING_VERSION, type ScoredPlace } from "./scoring.ts";

function fakeScored(score: number, streak = 1): ScoredPlace {
  return {
    base: 80,
    difficulty: 3,
    diffMult: 1.5,
    streak,
    combo: 1 + 0.05 * streak,
    regionBonus: 0,
    regionBonusLabel: null,
    score,
  };
}

function v3Result(overrides: Partial<ScoredPlace> = {}) {
  return {
    distanceKm: 10,
    hit: true,
    score: 90,
    scoringVersion: SCORING_VERSION,
    breakdown: fakeScored(90),
    streakBefore: 0,
    ...overrides,
  };
}

const today = {
  edition: "state" as const,
  regionId: "nebraska",
  regionName: "Nebraska",
  dateKey: "2026-09-28",
};

test("endless mode: a run continues indefinitely until the player ends it", () => {
  let run = startRun(today, ["p1", "p2", "p3"]);
  assert.equal(run.index, 0);
  assert.equal(run.hits, 0);
  assert.equal(run.streak, 0);
  assert.equal(run.bestStreak, 0);
  assert.deepEqual(run.results, []);

  // Hit: story, then continue advances without end.
  run = dropPin(run, 25, 25, fakeScored(80));
  assert.equal(run.phase, "story");
  assert.equal(run.hits, 1);
  assert.equal(run.index, 0);
  assert.equal(run.results.length, 1);
  assert.equal(run.results[0]?.score, 80);
  assert.equal(run.results[0]?.scoringVersion, SCORING_VERSION);
  assert.equal(run.results[0]?.streakBefore, 0);

  run = continueRun(run);
  assert.equal(run.phase, "aim");
  assert.equal(run.index, 1);

  // Miss: done (place over), but the run continues.
  run = dropPin(run, 250, 25, null);
  assert.equal(run.phase, "done");
  assert.equal(run.hits, 1);
  assert.equal(run.results.length, 2);
  assert.equal(run.results[1]?.hit, false);
  assert.equal(run.results[1]?.score, 0);
  assert.equal(run.results[1]?.breakdown, null);

  run = continueRun(run);
  assert.equal(run.phase, "aim");
  assert.equal(run.index, 2);

  // Continue from a non-story/done phase does nothing.
  assert.equal(continueRun(run).index, 2);
  assert.equal(continueRun({ ...run, phase: "summary" }).index, 2);

  // Many places: never auto-terminates.
  for (let i = 0; i < 100; i++) {
    run = dropPin(run, 10, 25, fakeScored(90));
    assert.equal(run.phase, "story");
    run = continueRun(run);
    assert.equal(run.phase, "aim");
  }
  assert.equal(run.index, 102);
  assert.equal(run.results.length, 102);
});

test("streak extends on hits, resets on a miss, bestStreak is the longest", () => {
  let run = startRun(today, ["p1", "p2", "p3"]);
  run = dropPin(run, 10, 25, fakeScored(90, 1));
  assert.equal(run.streak, 1);
  assert.equal(run.bestStreak, 1);
  run = continueRun(run);
  run = dropPin(run, 10, 25, fakeScored(95, 2));
  assert.equal(run.streak, 2);
  assert.equal(run.bestStreak, 2);
  run = continueRun(run);
  // Miss: streak resets to 0, bestStreak survives.
  run = dropPin(run, 500, 25, null);
  assert.equal(run.streak, 0);
  assert.equal(run.bestStreak, 2);
  assert.equal(run.results[2]?.streakBefore, 2);
  run = continueRun(run);
  run = dropPin(run, 10, 25, fakeScored(88, 1));
  assert.equal(run.streak, 1);
  assert.equal(run.bestStreak, 2);
});

test("endRun produces the summary; summary phase is terminal", () => {
  let run = startRun(today, ["p1", "p2", "p3"]);
  run = dropPin(run, 10, 25, fakeScored(90)); // hit, 10km
  run = continueRun(run);
  run = dropPin(run, 20, 25, fakeScored(70)); // hit, 20km
  run = continueRun(run);
  run = dropPin(run, 500, 25, null); // miss, 500km

  const { run: ended, summary } = endRun(run);
  assert.equal(ended.phase, "summary");
  assert.equal(summary.placesPlayed, 3);
  assert.equal(summary.hits, 2);
  assert.equal(summary.totalScore, 160);
  assert.equal(summary.averagePerPlace, 53); // round(160/3)
  assert.equal(summary.bestStreak, 2);
  assert.equal(summary.averageDistanceKm, (10 + 20 + 500) / 3);
  assert.equal(summary.bestDistanceKm, 10);

  // summarizeRun is pure and matches.
  assert.deepEqual(summarizeRun(run), summary);

  // Empty run: sane zeros.
  const empty = summarizeRun(startRun(today, ["p1", "p2", "p3"]));
  assert.equal(empty.placesPlayed, 0);
  assert.equal(empty.totalScore, 0);
  assert.equal(empty.averagePerPlace, 0);
  assert.equal(empty.bestStreak, 0);
  assert.equal(empty.averageDistanceKm, 0);
  assert.equal(empty.bestDistanceKm, null);
});

test("isResumable gates reload-restore: resumable sessions restore, summary/fresh do not", () => {
  const mid = { ...startRun(today, ["p1", "p2", "p3"]), index: 4, phase: "aim" as const };
  assert.equal(isResumable(mid, today), true);

  // Summary must not auto-restore on page load.
  const { run: ended } = endRun(dropPin(mid, 15, 25, fakeScored(85)));
  assert.equal(ended.phase, "summary");
  assert.equal(isResumable(ended, today), false);

  // Results from an older scoring version retire the run — stored scores
  // are never recomputed, so a version bump starts fresh instead of mixing.
  const stale = {
    ...mid,
    results: [v3Result({ scoringVersion: 2 })],
  };
  assert.equal(isResumable(stale, today), false);
  const unscored = {
    ...mid,
    results: [{ distanceKm: 10, hit: true, score: 90 } as never],
  };
  assert.equal(isResumable(unscored, today), false);

  // A different day, edition, or region starts fresh.
  assert.equal(isResumable(mid, { ...today, dateKey: "2026-09-29" }), false);
  assert.equal(isResumable(mid, { ...today, edition: "globe" as const }), false);
  assert.equal(isResumable(mid, { ...today, regionId: "iowa" }), false);
  assert.equal(isResumable(null, today), false);
});

test("resumeRun restores endless runs; done (miss card) is resumable, summary is not", () => {
  // Mid-run with results restores intact.
  const mid = { ...startRun(today, ["p1", "p2", "p3"]), index: 4, hits: 3, phase: "aim" as const };
  const withResults = dropPin(mid, 15, 25, fakeScored(85));
  assert.equal(resumeRun(withResults, today, ["p1", "p2", "p3"]).results.length, 1);

  // A miss card ("done") resumes with accumulated results intact — a reload
  // there must not silently lose the session.
  const miss = dropPin(
    {
      ...startRun(today, ["p1", "p2", "p3"]),
      index: 2,
      hits: 1,
      streak: 1,
      bestStreak: 1,
      phase: "aim" as const,
      results: [v3Result()],
    },
    500,
    25,
    null,
  );
  assert.equal(miss.phase, "done");
  const resumed = resumeRun(miss, today, ["p1", "p2", "p3"]);
  assert.equal(resumed.phase, "done");
  assert.equal(resumed.index, 2);
  assert.equal(resumed.hits, 1);
  assert.equal(resumed.streak, 0);
  assert.equal(resumed.bestStreak, 1);
  assert.equal(resumed.results.length, 2); // prior hit + this miss, all intact

  // A run saved before endless mode (no results) backfills.
  const legacy = { ...startRun(today, ["p1", "p2", "p3"]), results: undefined as never };
  assert.deepEqual(resumeRun(legacy, today, ["p1", "p2", "p3"]).results, []);

  // A run saved before per-session shuffle (no seed) gets one minted; a run
  // with a seed keeps dealing the same session's order.
  const legacySeed = { ...startRun(today, ["p1", "p2", "p3"]), seed: undefined as never };
  const minted = resumeRun(legacySeed, today, ["p1", "p2", "p3"]);
  assert.equal(typeof minted.seed, "number");
  const seeded = { ...startRun(today, ["p1", "p2", "p3"]), seed: 4242 };
  assert.equal(resumeRun(seeded, today, ["p1", "p2", "p3"]).seed, 4242);

  // Fresh runs mint per-session seeds, so restarts never repeat the same
  // first question.
  assert.equal(typeof startRun(today, ["p1", "p2", "p3"]).seed, "number");

  // Summary phase starts fresh.
  const { run: ended } = endRun(withResults);
  assert.equal(resumeRun(ended, today, ["p1", "p2", "p3"]).index, 0);

  // Different dateKey starts fresh.
  assert.equal(
    resumeRun(withResults, { ...today, dateKey: "2026-09-29" }, ["p1", "p2", "p3"]).index,
    0,
  );
  assert.equal(resumeRun(null, today, ["p1", "p2", "p3"]).index, 0);
});

test("poolIds persist on the run; legacy saves backfill from the fresh pool", () => {
  const globeDay = {
    edition: "globe" as const,
    regionId: "globe",
    regionName: "Globe",
    dateKey: "2026-09-30",
  };
  const pool = ["a", "b", "c", "d"];
  const run = startRun(globeDay, pool);
  assert.deepEqual(run.poolIds, pool);
  // The stored array is a copy, not an alias.
  pool.push("e");
  assert.deepEqual(run.poolIds, ["a", "b", "c", "d"]);

  // A resumed run keeps its persisted pool, so reloads rebuild the same pool.
  const resumed = resumeRun({ ...run, index: 3 }, globeDay, ["x", "y"]);
  assert.deepEqual(resumed.poolIds, ["a", "b", "c", "d"]);

  // A run saved before pool persistence backfills from the fresh pool.
  const legacy = { ...run, poolIds: undefined as never };
  assert.deepEqual(resumeRun(legacy, globeDay, ["x", "y"]).poolIds, ["x", "y"]);

  // Non-string entries are filtered out.
  const messy = { ...run, poolIds: ["a", 42, null, "b"] as never };
  assert.deepEqual(resumeRun(messy, globeDay, ["x"]).poolIds, ["a", "b"]);
});
