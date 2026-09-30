import assert from "node:assert/strict";
import test from "node:test";
import { continueRun, dropPin, endRun, resumeRun, startRun, summarizeRun } from "./run.ts";

test("endless mode: a run continues indefinitely until the player ends it", () => {
  const today = {
    edition: "state" as const,
    regionId: "nebraska",
    regionName: "Nebraska",
    dateKey: "2026-09-28",
  };
  let run = startRun(today);
  assert.equal(run.index, 0);
  assert.equal(run.hits, 0);
  assert.deepEqual(run.results, []);

  // Hit: story, then continue advances without end.
  run = dropPin(run, 25, 25, 80);
  assert.equal(run.phase, "story");
  assert.equal(run.hits, 1);
  assert.equal(run.index, 0);
  assert.equal(run.results.length, 1);
  assert.equal(run.results[0]?.score, 80);

  run = continueRun(run);
  assert.equal(run.phase, "aim");
  assert.equal(run.index, 1);

  // Miss: done (place over), but the run continues.
  run = dropPin(run, 250, 25, 0);
  assert.equal(run.phase, "done");
  assert.equal(run.hits, 1);
  assert.equal(run.results.length, 2);
  assert.equal(run.results[1]?.hit, false);
  assert.equal(run.results[1]?.score, 0);

  run = continueRun(run);
  assert.equal(run.phase, "aim");
  assert.equal(run.index, 2);

  // Continue from a non-story/done phase does nothing.
  assert.equal(continueRun(run).index, 2);
  assert.equal(continueRun({ ...run, phase: "summary" }).index, 2);

  // Many places: never auto-terminates.
  for (let i = 0; i < 100; i++) {
    run = dropPin(run, 10, 25, 90);
    assert.equal(run.phase, "story");
    run = continueRun(run);
    assert.equal(run.phase, "aim");
  }
  assert.equal(run.index, 102);
  assert.equal(run.results.length, 102);
});

test("endRun produces the summary; summary phase is terminal", () => {
  const today = {
    edition: "state" as const,
    regionId: "nebraska",
    regionName: "Nebraska",
    dateKey: "2026-09-28",
  };
  let run = startRun(today);
  run = dropPin(run, 10, 25, 90); // hit, 10km
  run = continueRun(run);
  run = dropPin(run, 20, 25, 70); // hit, 20km
  run = continueRun(run);
  run = dropPin(run, 500, 25, 0); // miss, 500km

  const { run: ended, summary } = endRun(run);
  assert.equal(ended.phase, "summary");
  assert.equal(summary.placesPlayed, 3);
  assert.equal(summary.hits, 2);
  assert.equal(summary.totalScore, 160);
  assert.equal(summary.averageDistanceKm, (10 + 20 + 500) / 3);
  assert.equal(summary.bestDistanceKm, 10);

  // summarizeRun is pure and matches.
  assert.deepEqual(summarizeRun(run), summary);

  // Empty run: sane zeros.
  const empty = summarizeRun(startRun(today));
  assert.equal(empty.placesPlayed, 0);
  assert.equal(empty.totalScore, 0);
  assert.equal(empty.averageDistanceKm, 0);
  assert.equal(empty.bestDistanceKm, null);
});

test("resumeRun restores endless runs; summary/done are not resumable", () => {
  const today = {
    edition: "state" as const,
    regionId: "nebraska",
    regionName: "Nebraska",
    dateKey: "2026-09-28",
  };
  // Mid-run with results restores intact.
  const mid = { ...startRun(today), index: 4, hits: 3, phase: "aim" as const };
  const withResults = dropPin(mid, 15, 25, 85);
  assert.equal(resumeRun(withResults, today).results.length, 1);

  // A run saved before endless mode (no results) backfills.
  const legacy = { ...startRun(today), results: undefined as never };
  assert.deepEqual(resumeRun(legacy, today).results, []);

  // Summary phase starts fresh.
  const { run: ended } = endRun(withResults);
  assert.equal(resumeRun(ended, today).index, 0);

  // Different dateKey starts fresh.
  assert.equal(
    resumeRun(withResults, { ...today, dateKey: "2026-09-29" }).index,
    0,
  );
  assert.equal(resumeRun(null, today).index, 0);
});
