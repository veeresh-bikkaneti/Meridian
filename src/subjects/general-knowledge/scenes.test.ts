/**
 * General knowledge clue scenes — the data-side contract (the
 * math scenes.test.ts pattern, expansion waves 3 and 10).
 * Coverage is exactly the ten items the adapter deals across
 * the three bands (5 / 3 / 2); a scene description carries only
 * the givens from the item's own question, so the setup film
 * cannot give the answer away, and the solved beat's arithmetic
 * lands exactly on the item's answer. Each description also
 * carries its act-3 summary (clip, script, beat map) in the
 * solved-phase data path only.
 *
 * The opera item is pinned with a fixed clock: its description
 * is built from the shared years mechanism, its script holds the
 * method only (no year count anywhere — in digits or in the
 * counting steps' source), and its film's step count is the
 * pinned year's gap counted off in decade hops.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GENERAL_KNOWLEDGE_CLUE_SCENES,
  clueSceneFor,
  operaSceneForYear,
  summaryStepCount,
  summaryStepLine,
  summaryStepStart,
} from "./scenes.ts";
import { GENERAL_KNOWLEDGE_ANSWERS, OPERA_OPENED_YEAR, operaYearsEntry } from "./answers.ts";
import { itemsForGroup } from "./items.ts";
import { yearsSince } from "../shared/years.ts";
import type { ClueSceneDescription } from "../shared/clue-scene-types.ts";

const IDS_710 = itemsForGroup("7-10").map((item) => item.id);
const IDS_1018 = itemsForGroup("10-18").map((item) => item.id);
const IDS_18 = itemsForGroup("18+").map((item) => item.id);
const ALL_IDS = [...IDS_710, ...IDS_1018, ...IDS_18];
const OPERA_ID = "general-knowledge:mixed:opera-years-ago";

/** The description a test should pin: the opera description is
 * built for a pinned year; every other item's is static. */
function pinnedFor(id: string, year = 2026): ClueSceneDescription {
  if (id === OPERA_ID) return operaSceneForYear(year);
  return clueSceneFor(id)!;
}

/** The numeric givens a description carries, per kind. */
function givensOf(d: ClueSceneDescription): number[] {
  switch (d.kind) {
    case "tower-measure":
      return [d.oldHeight, d.newHeight];
    case "timeline-line":
      return [d.startYear, d.endYear];
    case "scale-line":
      return [d.kilometres, d.metresPerKm];
    case "bus-boarding":
      return [d.total, d.seats];
    case "stack-drops":
      return [d.dropHeight, d.peakHeight];
    case "journey-line":
      return [d.totalKm, d.hours ?? -1, d.targetKm ?? -1, d.aheadKm ?? -1].filter((n) => n >= 0);
    case "angle-sight":
      return [d.distanceFt, d.angleDeg];
    case "great-circle":
      return [];
    case "flow-counter":
      return [d.perMinute, d.minutesPerDay];
    default:
      return [];
  }
}

/** How many animation steps a kind's solved beat performs — the
 * count a summary's beat map must pace exactly. */
function stepCountOf(d: ClueSceneDescription): number {
  switch (d.kind) {
    case "tower-measure":
      return 3; // the bracket, the new-part fill, the final tick
    case "timeline-line":
      return d.countGap ? Math.ceil((d.endYear - d.startYear) / 10) : 3;
    case "scale-line":
      return 2; // the kilometre marks, then the final tick
    case "bus-boarding":
      return Math.ceil(d.total / d.seats);
    case "stack-drops":
      return 8; // eight stacking bands, the last carrying the final tick
    case "journey-line":
      return d.hours !== undefined && d.targetKm !== undefined
        ? Math.round(d.targetKm / (d.totalKm / d.hours))
        : 2;
    case "angle-sight":
      return 3; // the full sight line, the height bracket, the final tick
    case "great-circle":
      return 3; // the globe arc, the flat-map curve, the final tick
    case "flow-counter":
      return 3; // the minute row, the day field, the power bars + tick
    default:
      return -1;
  }
}

const CLOSING: Record<string, string> = {
  "general-knowledge:mixed:eiffel-antennas": "59",
  "general-knowledge:mixed:older-landmark": "Eiffel Tower is the older landmark",
  "general-knowledge:mixed:falls-in-km": "narrower than 2 km",
  "general-knowledge:mixed:trip-buses": "5 minibuses",
  "general-knowledge:mixed:everest-vs-falls": "About 80",
  "general-knowledge:mixed:paris-sydney-flight": "About 20 hours",
  "general-knowledge:mixed:tower-angle": "About 1,072 feet",
  "general-knowledge:mixed:great-circle": "8,000 to 8,500 km",
  "general-knowledge:mixed:falls-flow": "7.2 × 10^11 litres",
};

describe("general knowledge clue scene descriptions — waves 3 and 10 (all bands)", () => {
  it("covers exactly the general-knowledge items for ages 7-10", () => {
    assert.equal(IDS_710.length, 5);
    for (const id of IDS_710) {
      assert.ok(clueSceneFor(id), `${id} has a scene`);
    }
  });

  it("covers exactly the general-knowledge items for ages 10-18", () => {
    assert.equal(IDS_1018.length, 3);
    assert.deepEqual(
      [...IDS_1018].sort(),
      [
        "general-knowledge:mixed:everest-vs-falls",
        "general-knowledge:mixed:paris-sydney-flight",
        "general-knowledge:mixed:tower-angle",
      ].sort(),
    );
    for (const id of IDS_1018) {
      assert.ok(clueSceneFor(id), `${id} has a scene`);
    }
  });

  it("covers exactly the general-knowledge items for ages 18+", () => {
    assert.equal(IDS_18.length, 2);
    assert.deepEqual(
      [...IDS_18].sort(),
      ["general-knowledge:mixed:great-circle", "general-knowledge:mixed:falls-flow"].sort(),
    );
    for (const id of IDS_18) {
      assert.ok(clueSceneFor(id), `${id} has a scene`);
    }
  });

  it("the whole scene map is exactly the ten dealt items", () => {
    assert.deepEqual(
      [...Object.keys(GENERAL_KNOWLEDGE_CLUE_SCENES), OPERA_ID].sort(),
      [...ALL_IDS].sort(),
    );
  });

  it("never carries the answer before the pick", () => {
    for (const id of ALL_IDS) {
      const description = pinnedFor(id);
      const answer = id === OPERA_ID ? operaYearsEntry(2026) : GENERAL_KNOWLEDGE_ANSWERS[id]!;
      assert.ok(!/\d/.test(description.labelSetup), `${id}: setup label has no digits`);
      assert.ok(!/\d/.test(description.labelSolved), `${id}: solved label has no digits`);
      for (const choice of answer.choices) {
        assert.ok(
          !description.labelSetup.includes(choice),
          `${id}: setup label must not contain the choice ${choice}`,
        );
      }
      if (answer.value !== undefined) {
        assert.ok(
          !givensOf(description).includes(answer.value),
          `${id}: answer value is not a scene given`,
        );
      }
    }
  });

  it("the solved beat's arithmetic lands on the item's answer", () => {
    const eiffel = pinnedFor("general-knowledge:mixed:eiffel-antennas");
    assert.equal(eiffel.kind, "tower-measure");
    if (eiffel.kind === "tower-measure") {
      assert.equal(
        eiffel.newHeight - eiffel.oldHeight,
        GENERAL_KNOWLEDGE_ANSWERS["general-knowledge:mixed:eiffel-antennas"]!.value,
      );
    }
    const older = pinnedFor("general-knowledge:mixed:older-landmark");
    assert.equal(older.kind, "timeline-line");
    if (older.kind === "timeline-line") {
      assert.ok(older.startYear < older.endYear, "the earlier year opens the line");
      assert.equal(
        GENERAL_KNOWLEDGE_ANSWERS["general-knowledge:mixed:older-landmark"]!.correct,
        "The Eiffel Tower",
      );
    }
    const falls = pinnedFor("general-knowledge:mixed:falls-in-km");
    assert.equal(falls.kind, "scale-line");
    if (falls.kind === "scale-line") {
      assert.equal(falls.kilometres * falls.metresPerKm, 2000);
      assert.ok(1708 < falls.kilometres * falls.metresPerKm, "the falls is the narrower");
      assert.equal(
        GENERAL_KNOWLEDGE_ANSWERS["general-knowledge:mixed:falls-in-km"]!.correct,
        "Narrower than 2 km",
      );
    }
    const buses = pinnedFor("general-knowledge:mixed:trip-buses");
    assert.equal(buses.kind, "bus-boarding");
    if (buses.kind === "bus-boarding") {
      assert.equal(
        Math.ceil(buses.total / buses.seats),
        GENERAL_KNOWLEDGE_ANSWERS["general-knowledge:mixed:trip-buses"]!.value,
      );
    }
    const everest = pinnedFor("general-knowledge:mixed:everest-vs-falls");
    assert.equal(everest.kind, "stack-drops");
    if (everest.kind === "stack-drops") {
      const drops = everest.peakHeight / everest.dropHeight;
      assert.ok(drops > 75 && drops < 85, `the stack count is about eighty (got ${drops})`);
      assert.equal(
        GENERAL_KNOWLEDGE_ANSWERS["general-knowledge:mixed:everest-vs-falls"]!.correct,
        "About 80",
      );
    }
    const flight = pinnedFor("general-knowledge:mixed:paris-sydney-flight");
    assert.equal(flight.kind, "journey-line");
    if (flight.kind === "journey-line") {
      assert.equal(
        flight.targetKm! / (flight.totalKm / flight.hours!),
        GENERAL_KNOWLEDGE_ANSWERS["general-knowledge:mixed:paris-sydney-flight"]!.value,
      );
    }
    const tower = pinnedFor("general-knowledge:mixed:tower-angle");
    assert.equal(tower.kind, "angle-sight");
    if (tower.kind === "angle-sight") {
      const height = tower.distanceFt * Math.tan((tower.angleDeg * Math.PI) / 180);
      assert.ok(height > 1060 && height < 1085, `the tangent height is about 1,072 ft (got ${height})`);
      assert.equal(
        GENERAL_KNOWLEDGE_ANSWERS["general-knowledge:mixed:tower-angle"]!.correct,
        "About 1,072 feet",
      );
    }
    const circle = pinnedFor("general-knowledge:mixed:great-circle");
    assert.equal(circle.kind, "great-circle");
    assert.equal(
      GENERAL_KNOWLEDGE_ANSWERS["general-knowledge:mixed:great-circle"]!.correct,
      "8,000 to 8,500 km",
    );
    const flow = pinnedFor("general-knowledge:mixed:falls-flow");
    assert.equal(flow.kind, "flow-counter");
    if (flow.kind === "flow-counter") {
      assert.equal(flow.perMinute * flow.minutesPerDay, 7.2e11);
      assert.equal(
        GENERAL_KNOWLEDGE_ANSWERS["general-knowledge:mixed:falls-flow"]!.correct,
        "7.2 × 10^11 litres",
      );
    }
  });

  it("every item carries a well-formed narrated summary, pinned to the manifest and the clip file", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const audioDir = join(here, "..", "..", "..", "public", "audio", "subjects");
    const manifest = JSON.parse(readFileSync(join(audioDir, "manifest.json"), "utf8")) as {
      clips: Record<string, { file: string; duration: number; lines: number; item: string }>;
    };
    for (const id of ALL_IDS) {
      const description = pinnedFor(id);
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
      if (id !== OPERA_ID) {
        const closing = summary.lines[summary.lines.length - 1]!.text;
        assert.ok(closing.includes(CLOSING[id]!), `${id}: closing line states the answer`);
      }
      let previousLine = -1;
      for (let step = 0; step < summaryStepCount(summary); step++) {
        const { line } = summaryStepLine(summary, step);
        assert.ok(line >= previousLine, `${id}: step ${step} never jumps backwards a line`);
        previousLine = line;
        const start = summaryStepStart(summary, step, 0.5);
        assert.ok(start >= (summary.lines[line]?.at ?? 0), `${id}: step ${step} starts inside its line`);
        assert.ok(start < summary.duration, `${id}: step ${step} starts before the clip ends`);
      }
      // The manifest carries the same duration and line count.
      const entry = manifest.clips[summary.clip.replace(/\.mp3$/, "")];
      assert.ok(entry, `${id}: manifest entry for ${summary.clip}`);
      assert.equal(entry.file, summary.clip, `${id}: manifest file matches`);
      assert.equal(entry.item, id, `${id}: manifest item matches`);
      assert.equal(entry.duration, summary.duration, `${id}: manifest duration matches the description`);
      assert.equal(entry.lines, summary.lines.length, `${id}: manifest line count matches`);
      const bytes = statSync(join(audioDir, summary.clip)).size;
      const expected = summary.duration * 8000;
      assert.ok(
        Math.abs(bytes - expected) < expected * 0.15,
        `${id}: clip file size ${bytes} B agrees with duration ${summary.duration} s`,
      );
    }
  });
});

describe("opera-years-ago — the method-only, runtime-year description", () => {
  it("derives its years from the shared years mechanism, pinned by the clock", () => {
    const d = operaSceneForYear(2026);
    assert.equal(d.kind, "timeline-line");
    if (d.kind === "timeline-line") {
      assert.equal(d.startYear, OPERA_OPENED_YEAR);
      assert.equal(d.endYear, 2026);
      assert.equal(d.countGap, true);
    }
    assert.equal(yearsSince(OPERA_OPENED_YEAR, 2026), operaYearsEntry(2026).value);
    // A second pinned year moves the line's end and nothing else.
    const d2000 = operaSceneForYear(2000);
    if (d2000.kind === "timeline-line") assert.equal(d2000.endYear, 2000);
  });

  it("the stored script holds the method only — no year count anywhere", () => {
    const d = operaSceneForYear(2026);
    const summary = d.summary!;
    const gap = yearsSince(OPERA_OPENED_YEAR, 2026);
    for (const line of summary.lines) {
      assert.ok(!/\d/.test(line.text), `no digits in the script: "${line.text}"`);
      assert.ok(!line.text.includes(String(gap)), "no baked-in year count");
    }
    // The closing line states the method, not a number of years —
    // the documented exemption to the closing-states-the-answer
    // pin (the answer is a runtime year gap; the result card
    // states it from answers.ts, computed the same way).
    const closing = summary.lines[summary.lines.length - 1]!.text;
    assert.ok(closing.includes("how many years ago"), "the closing states the method");
  });

  it("the film's step count matches the pinned year's gap, counted in decades", () => {
    for (const [year, hops] of [[2026, 6], [2000, 3], [1983, 1]] as const) {
      const d = operaSceneForYear(year);
      assert.equal(stepCountOf(d), hops, `${year}: decade hops for gap ${year - OPERA_OPENED_YEAR}`);
      assert.equal(summaryStepCount(d.summary!), hops, `${year}: beat map paces the hops`);
    }
  });
});
