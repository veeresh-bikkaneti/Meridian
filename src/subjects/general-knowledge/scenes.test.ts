/**
 * General knowledge clue scenes — the data-side contract (the
 * math scenes.test.ts pattern, expansion wave 3). Coverage is
 * exactly the five items the adapter deals for ages 7-10; a scene
 * description carries only the givens from the item's own
 * question, so the setup film cannot give the answer away, and
 * the solved beat's arithmetic lands exactly on the item's
 * answer. Each description also carries its act-3 summary (clip,
 * script, beat map) in the solved-phase data path only.
 *
 * The opera item is pinned with a fixed clock: its description
 * is built from the shared years mechanism, its script holds the
 * method only (no year count anywhere — in digits or in the
 * counting steps' source), and its film's step count is the
 * pinned year's gap counted off in decade hops.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

const BAND_IDS = itemsForGroup("7-10").map((item) => item.id);
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
    default:
      return -1;
  }
}

const CLOSING: Record<string, string> = {
  "general-knowledge:mixed:eiffel-antennas": "59",
  "general-knowledge:mixed:older-landmark": "Eiffel Tower is the older landmark",
  "general-knowledge:mixed:falls-in-km": "narrower than 2 km",
  "general-knowledge:mixed:trip-buses": "5 minibuses",
};

describe("general knowledge clue scene descriptions — wave 3 (ages 7-10)", () => {
  it("covers exactly the general-knowledge items for ages 7-10", () => {
    assert.equal(BAND_IDS.length, 5);
    for (const id of BAND_IDS) {
      assert.ok(clueSceneFor(id), `${id} has a scene`);
    }
    assert.deepEqual(
      [...Object.keys(GENERAL_KNOWLEDGE_CLUE_SCENES), OPERA_ID].sort(),
      [...BAND_IDS].sort(),
    );
    // No other band carries a description.
    for (const band of ["10-18", "18+"] as const) {
      for (const item of itemsForGroup(band)) {
        assert.equal(clueSceneFor(item.id), null, `${item.id} (${band}) has no scene`);
      }
    }
  });

  it("never carries the answer before the pick", () => {
    for (const id of BAND_IDS) {
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
      // The sign's length in metres, against the falls' own width
      // from the question: 1,708 m stops short of it.
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
  });

  it("every item carries a well-formed narrated summary, pinned to the manifest", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const manifest = JSON.parse(
      readFileSync(join(here, "..", "..", "..", "public", "audio", "subjects", "manifest.json"), "utf8"),
    ) as { clips: Record<string, { file: string; duration: number; lines: number }> };
    for (const id of BAND_IDS) {
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
      assert.equal(entry.duration, summary.duration, `${id}: manifest duration matches the description`);
      assert.equal(entry.lines, summary.lines.length, `${id}: manifest line count matches`);
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
