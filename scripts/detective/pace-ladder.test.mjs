import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  HOLMES_WPM_FLOOR,
  MAX_PACE_RETRIES,
  PACE_STEP,
  WATSON_CLUE_WPM_FLOOR,
  isInBand,
  paceFloorFor,
  selectBestTake,
  settlePace,
} from "./pace-ladder.mjs";
import { VOICES, casePlan, fixedLine, selectionNamePlan } from "./render-plan.mjs";

const ROOT = new URL("../..", import.meta.url).pathname;
const clue137 = JSON.parse(readFileSync(`${ROOT}public/loop/clues/137.json`, "utf8"));
const plan137 = casePlan(clue137, "Henderson, Nevada, United States", 137);

/* Watson family band is 78–127 Hz (see bandFor in render-audio.mjs). */
const WATSON_FAMILY = [78, 127];
const take = (speed, hz, wpm) => ({ speed, hz, wpm, durationSec: 10 });

test("pace floors: Watson clues 100, Holmes lines 90, names and Watson fragments ungated", () => {
  assert.equal(WATSON_CLUE_WPM_FLOOR, 100);
  assert.equal(HOLMES_WPM_FLOOR, 90);
  assert.equal(PACE_STEP, 6);
  assert.equal(MAX_PACE_RETRIES, 2);
  assert.equal(paceFloorFor(plan137.clues[0]), 100, "a Watson clue read is gated at 100 wpm");
  assert.equal(paceFloorFor(plan137.answer), 90, "the Holmes answer read is gated at 90 wpm");
  assert.equal(paceFloorFor(fixedLine("ack-1")), 90, "a Holmes fixed line is gated at 90 wpm");
  assert.equal(paceFloorFor(fixedLine("win-holmes")), 90);
  assert.equal(paceFloorFor(fixedLine("instructions-watson")), null, "Watson fixed lines are not clue reads");
  assert.equal(paceFloorFor(fixedLine("win-watson")), null, "Watson fixed lines carry no pace floor");
  const name = selectionNamePlan({ id: "geonames:5856195", n: "honolulu", r: "Hawaii, United States", p: 345064 });
  assert.equal(name.voice, VOICES.holmes);
  assert.equal(paceFloorFor(name), null, "a 1–3 word name read has no meaningful wpm");
});

test("isInBand: edges are inside, unmeasured is outside", () => {
  assert.equal(isInBand(78, WATSON_FAMILY), true);
  assert.equal(isInBand(127, WATSON_FAMILY), true);
  assert.equal(isInBand(77.9, WATSON_FAMILY), false);
  assert.equal(isInBand(null, WATSON_FAMILY), false);
});

test("selectBestTake: highest wpm inside the family wins", () => {
  const slow = take(97, 85.1, 29);
  const faster = take(103, 88.0, 61);
  const fastest = take(109, 91.2, 88);
  assert.equal(selectBestTake([slow, faster, fastest], WATSON_FAMILY), fastest);
  assert.equal(selectBestTake([slow, faster], WATSON_FAMILY), faster);
});

test("selectBestTake: a faster take outside the family never wins", () => {
  const slow = take(97, 85.1, 29);
  const wild = take(109, 140.0, 150); // quicker, but pitch left the family
  assert.equal(selectBestTake([slow, wild], WATSON_FAMILY), slow);
});

test("selectBestTake: no take in the family keeps the pitch-settled take; ties keep the earliest", () => {
  const settled = take(97, 60.0, 29);
  const other = take(103, 140.0, 90);
  assert.equal(selectBestTake([settled, other], WATSON_FAMILY), settled);
  const a = take(100, 90, 120);
  const b = take(106, 95, 120);
  assert.equal(selectBestTake([a, b], WATSON_FAMILY), a);
});

test("settlePace: the case-416 shape — still under the floor after both retries ships flagged, best take kept", () => {
  const takes = [take(97, 85.1, 29), take(103, 88.0, 34), take(109, 91.0, 41)];
  const { best, paceFlagged, status } = settlePace({
    takes, familyBand: WATSON_FAMILY, floor: 100, pitchInTarget: true,
  });
  assert.equal(best, takes[2], "the best (highest-wpm, in-family) take ships");
  assert.equal(paceFlagged, true);
  assert.equal(status, "flagged", "pitch-perfect but 41 wpm is a defect, not an ok");
});

test("settlePace: a pace retry that clears the floor ships ok", () => {
  const takes = [take(97, 85.1, 29), take(103, 89.0, 132)];
  const { best, paceFlagged, status } = settlePace({
    takes, familyBand: WATSON_FAMILY, floor: 100, pitchInTarget: true,
  });
  assert.equal(best, takes[1]);
  assert.equal(paceFlagged, false);
  assert.equal(status, "ok");
});

test("settlePace: pace never un-flags a pitch-flagged line", () => {
  const takes = [take(86, 113.5, 113), take(92, 110.0, 140)];
  const { paceFlagged, status } = settlePace({
    takes, familyBand: WATSON_FAMILY, floor: 100, pitchInTarget: false,
  });
  assert.equal(paceFlagged, false, "pace itself is fine");
  assert.equal(status, "flagged", "the pitch flag stands");
});

test("settlePace: Holmes floor is 90 — 87 wpm flags, 95 passes", () => {
  const slow = settlePace({ takes: [take(100, 130, 87)], familyBand: [110, 160], floor: 90, pitchInTarget: true });
  assert.equal(slow.status, "flagged");
  assert.equal(slow.paceFlagged, true);
  const fine = settlePace({ takes: [take(100, 130, 95)], familyBand: [110, 160], floor: 90, pitchInTarget: true });
  assert.equal(fine.status, "ok");
});

test("settlePace: no floor means pace cannot flag", () => {
  const { paceFlagged, status } = settlePace({
    takes: [take(100, 125, 49)], familyBand: [110, 160], floor: null, pitchInTarget: true,
  });
  assert.equal(paceFlagged, false);
  assert.equal(status, "ok");
});
