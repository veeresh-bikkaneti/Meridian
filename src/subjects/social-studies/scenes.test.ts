/**
 * Social studies clue scenes — the data-side contract (the
 * chemistry scenes.test.ts pattern, expansion wave 9).
 * Coverage is exactly all twelve dealt items: the four ages
 * 7-10 items, all five ages 10-18 items and all three ages
 * 18+ items — Social studies is complete at 12/12. A scene
 * description carries only the givens from the item's own
 * question, so the setup film cannot give the answer away.
 * Each description also carries its act-3 summary (clip,
 * script, beat map) in the solved-phase data path only, its
 * duration pinned against the manifest and the clip file.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SOCIAL_STUDIES_CLUE_SCENES,
  clueSceneFor,
  summaryStepCount,
  summaryStepLine,
  summaryStepStart,
} from "./scenes.ts";
import { SOCIAL_STUDIES_ANSWERS } from "./answers.ts";
import { itemsForGroup } from "./items.ts";
import type { ClueSceneDescription } from "../shared/clue-scene-types.ts";

const IDS_710 = [
  "social-studies:region:area-by-squares",
  "social-studies:route:count-the-steps",
  "social-studies:route:trip-clock",
  "social-studies:place:compass-clue",
];

const IDS_1018 = [
  "social-studies:region:density",
  "social-studies:route:scale-ratio",
  "social-studies:route:travel-time",
  "social-studies:route:fastest-or-shortest",
  "social-studies:compare:time-zones",
];

const IDS_18 = [
  "social-studies:region:flat-map-area",
  "social-studies:route:great-circle",
  "social-studies:compare:trip-cost",
];

const ALL_IDS = [...IDS_710, ...IDS_1018, ...IDS_18];

/** The numeric givens a description carries, per kind. */
function givensOf(d: ClueSceneDescription): number[] {
  switch (d.kind) {
    case "array-grid":
      return [d.rows, d.perRow, d.splitHigh, d.splitLow, d.secondRows ?? -1].filter((n) => n >= 0);
    case "scale-line":
      return [d.kilometres, d.metresPerKm];
    case "journey-line":
      return [d.totalKm, d.hours ?? -1, d.targetKm ?? -1, d.aheadKm ?? -1].filter((n) => n >= 0);
    case "map-scale":
      return [d.mapCm, d.kmPerCm, d.segmentPx ?? -1].filter((n) => n >= 0);
    case "compass-walk":
      return [d.eastSteps, d.northSteps];
    case "density-towns":
      return [d.firstArea, d.secondArea];
    case "two-roads":
      return [d.passKm, d.passSpeed, d.valleyKm, d.valleySpeed];
    case "zone-clocks":
      return [d.hereHour, d.zonesAhead];
    case "globe-vs-map":
      return [];
    case "great-circle":
      return [];
    case "cost-compare":
      return [d.tollFuel, d.tollFee, d.freeFuel];
    default:
      return [];
  }
}

/** How many animation steps a kind's solved beat performs — the
 * count a summary's beat map must pace exactly. */
function stepCountOf(d: ClueSceneDescription): number {
  switch (d.kind) {
    case "array-grid":
      return d.secondRows !== undefined ? 3 : 4; // two-fields: both counts, the difference tick
    case "scale-line":
      return 2; // the bar-length marks, then the final tick
    case "journey-line":
      return d.hours !== undefined && d.targetKm !== undefined
        ? Math.round(d.targetKm / (d.totalKm / d.hours))
        : 2;
    case "map-scale":
      return d.mapCm; // one step per centimetre
    case "compass-walk":
      return 3; // the east steps, the north step and landing mark, the final tick
    case "density-towns":
      return 3; // the first town's cells, the second town's cells, the final tick
    case "two-roads":
      return 3; // both riders ride, the clocks fill, the final tick
    case "zone-clocks":
      return 3; // the far clock spins on, the day arc, the final tick
    case "globe-vs-map":
      return 3; // the stretch marks, the true land, the final tick
    case "great-circle":
      return 3; // the globe arc, the flat-map curve, the final tick
    case "cost-compare":
      return 3; // the toll stacks join, the free stack stands beside, the final tick
    default:
      return -1;
  }
}

const CLOSING: Record<string, string> = {
  "social-studies:region:area-by-squares": "The first field, by 4 squares",
  "social-studies:route:count-the-steps": "40 km",
  "social-studies:route:trip-clock": "3 hours",
  "social-studies:place:compass-clue": "North-east of the fountain",
  "social-studies:region:density": "Town A",
  "social-studies:route:scale-ratio": "3.5 km",
  "social-studies:route:travel-time": "6 hours",
  "social-studies:route:fastest-or-shortest": "The valley road",
  "social-studies:compare:time-zones": "2 am the next day",
  "social-studies:region:flat-map-area":
    "Africa is far bigger \u2014 the flat map stretches places near the poles",
  "social-studies:route:great-circle":
    "That curved-looking path is the shortest route on the round Earth",
  "social-studies:compare:trip-cost": "The free road, by $3",
};

describe("social studies clue scene descriptions — wave 9", () => {
  it("covers exactly the four dealt items for ages 7-10", () => {
    const bandIds = itemsForGroup("7-10").map((item) => item.id);
    assert.equal(bandIds.length, 4);
    assert.deepEqual([...IDS_710].sort(), [...bandIds].sort());
    for (const id of IDS_710) assert.ok(clueSceneFor(id), `${id} has a scene`);
  });

  it("covers all five scene-backed dealt items for ages 10-18", () => {
    const bandIds = itemsForGroup("10-18")
      .map((item) => item.id)
      .filter((id) => clueSceneFor(id) !== null);
    assert.equal(bandIds.length, 5);
    assert.deepEqual([...bandIds].sort(), [...IDS_1018].sort());
    for (const id of IDS_1018) assert.ok(clueSceneFor(id), `${id} has a scene`);
  });

  it("covers exactly all three dealt items for ages 18+, completing Social studies 12/12", () => {
    const bandIds = itemsForGroup("18+").map((item) => item.id);
    assert.equal(bandIds.length, 3);
    assert.deepEqual([...bandIds].sort(), [...IDS_18].sort());
    for (const id of IDS_18) assert.ok(clueSceneFor(id), `${id} has a scene`);
    assert.deepEqual(Object.keys(SOCIAL_STUDIES_CLUE_SCENES).sort(), [...ALL_IDS].sort());
    assert.equal(ALL_IDS.length, 12);
  });

  it("never carries the answer before the pick", () => {
    for (const id of ALL_IDS) {
      const description = clueSceneFor(id)!;
      const answer = SOCIAL_STUDIES_ANSWERS[id]!;
      assert.ok(!/\d/.test(description.labelSetup), `${id}: setup label has no digits`);
      assert.ok(!/\d/.test(description.labelSolved), `${id}: solved label has no digits`);
      for (const choice of answer.choices) {
        assert.ok(
          !description.labelSetup.includes(choice),
          `${id}: setup label must not contain the choice ${choice}`,
        );
      }
      // The numeric givens are the question's own numbers; the
      // answer value is never one of them — with one documented
      // exemption: area-by-squares, whose answer difference (4)
      // is also its row length, a given the question itself
      // states (the fields are 3 rows of 4 and 2 rows of 4; the
      // scene marks no winner and no difference before the pick).
      if (answer.value !== undefined && id !== "social-studies:region:area-by-squares") {
        assert.ok(
          !givensOf(description).includes(answer.value),
          `${id}: answer value is not a scene given`,
        );
      }
    }
  });

  it("the solved beat's data lands on the item's answer", () => {
    const area = clueSceneFor("social-studies:region:area-by-squares")!;
    assert.equal(area.kind, "array-grid");
    if (area.kind === "array-grid") {
      assert.equal(area.secondRows, 2, "the two-fields variant data");
      assert.equal(area.rows * area.perRow - (area.secondRows ?? 0) * area.perRow, 4);
    }
    assert.equal(
      SOCIAL_STUDIES_ANSWERS["social-studies:region:area-by-squares"]!.correct,
      "The first field, by 4 squares",
    );
    const steps = clueSceneFor("social-studies:route:count-the-steps")!;
    assert.equal(steps.kind, "scale-line");
    if (steps.kind === "scale-line") assert.equal(steps.kilometres * steps.metresPerKm, 40);
    const trip = clueSceneFor("social-studies:route:trip-clock")!;
    assert.equal(trip.kind, "journey-line");
    if (trip.kind === "journey-line") {
      assert.equal((trip.targetKm ?? 0) / ((trip.totalKm ?? 0) / (trip.hours ?? 1)), 3);
    }
    const compass = clueSceneFor("social-studies:place:compass-clue")!;
    assert.equal(compass.kind, "compass-walk");
    if (compass.kind === "compass-walk") {
      assert.ok(compass.eastSteps > 0 && compass.northSteps > 0, "east then north lands north-east");
    }
    assert.equal(
      SOCIAL_STUDIES_ANSWERS["social-studies:place:compass-clue"]!.correct,
      "North-east of the fountain",
    );
    const density = clueSceneFor("social-studies:region:density")!;
    assert.equal(density.kind, "density-towns");
    if (density.kind === "density-towns") {
      assert.ok(1000 / density.firstArea > 1000 / density.secondArea, "Town A packs tighter");
    }
    assert.equal(SOCIAL_STUDIES_ANSWERS["social-studies:region:density"]!.correct, "Town A");
    const ratio = clueSceneFor("social-studies:route:scale-ratio")!;
    assert.equal(ratio.kind, "map-scale");
    if (ratio.kind === "map-scale") assert.equal(ratio.mapCm * ratio.kmPerCm, 3.5);
    const travel = clueSceneFor("social-studies:route:travel-time")!;
    assert.equal(travel.kind, "journey-line");
    if (travel.kind === "journey-line") {
      assert.equal((travel.targetKm ?? 0) / ((travel.totalKm ?? 0) / (travel.hours ?? 1)), 6);
    }
    const roads = clueSceneFor("social-studies:route:fastest-or-shortest")!;
    assert.equal(roads.kind, "two-roads");
    if (roads.kind === "two-roads") {
      assert.equal(roads.passKm / roads.passSpeed, 3);
      assert.equal(roads.valleyKm / roads.valleySpeed, 1.5);
      assert.ok(roads.valleyKm / roads.valleySpeed < roads.passKm / roads.passSpeed);
    }
    assert.equal(
      SOCIAL_STUDIES_ANSWERS["social-studies:route:fastest-or-shortest"]!.correct,
      "The valley road",
    );
    const zones = clueSceneFor("social-studies:compare:time-zones")!;
    assert.equal(zones.kind, "zone-clocks");
    if (zones.kind === "zone-clocks") {
      assert.equal((zones.hereHour + zones.zonesAhead) % 12, 2, "2 am the next day");
    }
    const flat = clueSceneFor("social-studies:region:flat-map-area")!;
    assert.equal(flat.kind, "globe-vs-map");
    const circle = clueSceneFor("social-studies:route:great-circle")!;
    assert.equal(circle.kind, "great-circle");
    const cost = clueSceneFor("social-studies:compare:trip-cost")!;
    assert.equal(cost.kind, "cost-compare");
    if (cost.kind === "cost-compare") {
      assert.equal(cost.tollFuel + cost.tollFee, 16);
      assert.equal(cost.tollFuel + cost.tollFee - cost.freeFuel, 3);
    }
    assert.equal(
      SOCIAL_STUDIES_ANSWERS["social-studies:compare:trip-cost"]!.correct,
      "The free road, by $3",
    );
  });

  it("every item carries a well-formed narrated summary, pinned to the manifest and the clip file", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const audioDir = join(here, "..", "..", "..", "public", "audio", "subjects");
    const manifest = JSON.parse(readFileSync(join(audioDir, "manifest.json"), "utf8")) as {
      clips: Record<string, { file: string; duration: number; lines: number; item: string }>;
    };
    for (const id of ALL_IDS) {
      const description = clueSceneFor(id)!;
      const summary = description.summary;
      assert.ok(summary, `${id} has a summary`);
      assert.ok(summary.lines.length >= 4, `${id}: an opening, steps, and a closing line`);
      assert.equal(summary.beats.length, summary.lines.length, `${id}: beats parallel to lines`);
      assert.equal(summary.lines[0]!.at, 0, `${id}: first line at 0`);
      for (let i = 1; i < summary.lines.length; i++) {
        assert.ok(summary.lines[i]!.at > summary.lines[i - 1]!.at, `${id}: timings increase`);
      }
      assert.ok(summary.duration > summary.lines[summary.lines.length - 1]!.at, `${id}: clip outlasts last line`);
      assert.ok(!/\d/.test(summary.clip.replace(/\.mp3$/, "")), `${id}: clip name carries no digits`);
      assert.ok(!summary.clip.includes("/"), `${id}: clip is a plain file name`);
      assert.equal(
        summaryStepCount(summary),
        stepCountOf(description),
        `${id}: beat map covers the solved beat`,
      );
      const closing = summary.lines[summary.lines.length - 1]!.text;
      assert.ok(closing.includes(CLOSING[id]!), `${id}: closing line states the answer`);
      let previousLine = -1;
      for (let step = 0; step < summaryStepCount(summary); step++) {
        const { line } = summaryStepLine(summary, step);
        assert.ok(line >= previousLine, `${id}: step ${step} never jumps backwards a line`);
        previousLine = line;
        const start = summaryStepStart(summary, step, 0.5);
        assert.ok(start >= (summary.lines[line]?.at ?? 0), `${id}: step ${step} starts inside its line`);
        assert.ok(start < summary.duration, `${id}: step ${step} starts before the clip ends`);
      }
      const entry = manifest.clips[summary.clip.replace(/\.mp3$/, "")];
      assert.ok(entry, `${id}: manifest entry for ${summary.clip}`);
      assert.equal(entry.file, summary.clip, `${id}: manifest file matches`);
      assert.equal(entry.item, id, `${id}: manifest item matches`);
      assert.equal(entry.duration, summary.duration, `${id}: manifest duration matches the description`);
      assert.equal(entry.lines, summary.lines.length, `${id}: manifest line count matches`);
      const bytes = statSync(join(audioDir, summary.clip)).size;
      const expected = summary.duration * 8000;
      assert.ok(
        Math.abs(bytes - expected) / expected < 0.1,
        `${id}: clip file size ${bytes} B agrees with duration ${summary.duration} s`,
      );
    }
  });
});
