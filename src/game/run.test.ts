import assert from "node:assert/strict";
import test from "node:test";
import { continueRun, dropPin, resumeRun, startRun } from "./run.ts";

test("a run continues until a miss or the authored list ends", () => {
  const today = {
    edition: "state" as const,
    regionId: "nebraska",
    regionName: "Nebraska",
    dateKey: "2026-09-28",
  };
  let run = startRun(today);
  assert.equal(run.index, 0);
  assert.equal(run.hits, 0);
  run = dropPin(run, 25, 25);
  assert.equal(run.phase, "story");
  assert.equal(run.hits, 1);
  assert.equal(run.index, 0);
  run = continueRun(run, 5);
  assert.equal(run.phase, "aim");
  assert.equal(run.index, 1);
  run = dropPin(run, 25.1, 25);
  assert.equal(run.phase, "done");
  assert.equal(run.hits, 1);
  assert.equal(continueRun(run, 5).phase, "done");
  const last = continueRun(dropPin(startRun(today), 10, 25), 1);
  assert.equal(last.phase, "done");
  assert.equal(last.hits, 1);
  assert.equal(resumeRun(null, today).index, 0);
  assert.equal(resumeRun({ ...startRun(today), index: 4, hits: 4, phase: "aim" }, today).index, 4);
  assert.equal(
    resumeRun(
      { ...startRun(today), index: 4, hits: 4, phase: "aim" },
      { ...today, dateKey: "2026-09-29" },
    ).index,
    0,
  );
});
