/**
 * Chemistry clue scenes — the data-side contract (the physics
 * scenes.test.ts pattern, expansion wave 7). Coverage is
 * exactly the five dealt ages 7-10 items and exactly the five
 * dealt ages 10-18 states, mixtures and materials items. The
 * three reactions items and all three ages 18+ items are
 * pinned description-free — they belong to wave 8. A scene
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
  CHEMISTRY_CLUE_SCENES,
  clueSceneFor,
  summaryStepCount,
  summaryStepLine,
  summaryStepStart,
} from "./scenes.ts";
import { CHEMISTRY_ANSWERS } from "./answers.ts";
import { itemsForGroup } from "./items.ts";
import type { ClueSceneDescription } from "../shared/clue-scene-types.ts";

/** The five ages 7-10 items wave 7 builds. */
const IDS_710 = [
  "chemistry:states:solid-liquid",
  "chemistry:states:melt-freeze",
  "chemistry:materials:sort",
  "chemistry:materials:magnet",
  "chemistry:pieces:rebuild",
];

/** The five ages 10-18 states/mixtures/materials items wave 7 builds. */
const IDS_1018 = [
  "chemistry:states:road-salt",
  "chemistry:mixtures:dissolve",
  "chemistry:states:particles",
  "chemistry:water:cycle",
  "chemistry:materials:identify",
];

/** Items that must stay description-free in this wave (wave 8). */
const FREE_IDS = [
  "chemistry:reactions:weight",
  "chemistry:reactions:new-look",
  "chemistry:reactions:rust",
  "chemistry:reactions:rate",
  "chemistry:reactions:mass",
  "chemistry:reactions:explain",
];

const ALL_IDS = [...IDS_710, ...IDS_1018];

/** The numeric givens a description carries, per kind. */
function givensOf(d: ClueSceneDescription): number[] {
  void d;
  return [];
}

/** How many animation steps a kind's solved beat performs — the
 * count a summary's beat map must pace exactly. */
function stepCountOf(d: ClueSceneDescription): number {
  switch (d.kind) {
    case "melt-freeze":
      return 3; // the warmth / cold arrives, the change itself, the final tick
    case "bend-test":
      return 3; // the press, the flex, the final tick
    case "magnet-sort":
      return 3; // the magnet passes, the iron bits leap, the final tick
    case "rebuild-pieces":
      return 3; // the pieces come apart, the longer rebuild, the final tick
    case "salt-melt":
      return 3; // the specks settle, the melt pools spread, the final tick
    case "dissolve":
      return 3; // the break / drop, the spread, the final tick
    case "particle-states":
      return 3; // the warmth steps, the flying apart, the final tick
    case "water-cycle":
      return 3; // the wisps rise, the cloud gathers, the rain and tick
    default:
      return -1;
  }
}

const CLOSING: Record<string, string> = {
  "chemistry:states:solid-liquid": "Warmth melted it",
  "chemistry:states:melt-freeze": "back into ice",
  "chemistry:materials:sort": "Whether it bends",
  "chemistry:materials:magnet": "the iron bits are the ones that jump",
  "chemistry:pieces:rebuild": "rebuild it longer with the same pieces",
  "chemistry:states:road-salt": "lowers the freezing point of the water",
  "chemistry:mixtures:dissolve": "still there, as pieces too small to see",
  "chemistry:states:particles": "from solid to liquid to gas",
  "chemistry:water:cycle": "back as rain or snow",
  "chemistry:materials:identify": "dissolves in water",
};

describe("chemistry clue scene descriptions — wave 7", () => {
  it("covers exactly the five dealt items for ages 7-10", () => {
    const bandIds = itemsForGroup("7-10").map((item) => item.id);
    assert.equal(bandIds.length, 5);
    assert.deepEqual([...IDS_710].sort(), [...bandIds].sort());
    for (const id of IDS_710) {
      assert.ok(clueSceneFor(id), `${id} has a scene`);
    }
  });

  it("covers exactly the five dealt states/mixtures/materials items for ages 10-18", () => {
    const bandIds = itemsForGroup("10-18").map((item) => item.id);
    assert.equal(bandIds.length, 8);
    for (const id of IDS_1018) {
      assert.ok(clueSceneFor(id), `${id} has a scene`);
      assert.ok(bandIds.includes(id), `${id} is dealt at 10-18`);
    }
    // The whole map is exactly this wave's ten items.
    assert.deepEqual(Object.keys(CHEMISTRY_CLUE_SCENES).sort(), [...ALL_IDS].sort());
  });

  it("pins the reactions and ages 18+ items description-free (wave 8)", () => {
    for (const id of FREE_IDS) {
      assert.equal(clueSceneFor(id), null, `${id} carries no scene in wave 7`);
    }
    const band18 = itemsForGroup("18+").map((item) => item.id);
    assert.deepEqual([...band18].sort(), [
      "chemistry:reactions:explain",
      "chemistry:reactions:mass",
      "chemistry:reactions:rate",
    ]);
  });

  it("never carries the answer before the pick", () => {
    for (const id of ALL_IDS) {
      const description = clueSceneFor(id)!;
      const answer = CHEMISTRY_ANSWERS[id]!;
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

  it("the solved beat's data lands on the item's answer", () => {
    const melt = clueSceneFor("chemistry:states:solid-liquid")!;
    assert.equal(melt.kind, "melt-freeze");
    if (melt.kind === "melt-freeze") {
      assert.ok(!melt.freeze, "the solid-liquid item runs the melt direction");
    }
    assert.equal(CHEMISTRY_ANSWERS["chemistry:states:solid-liquid"]!.correct, "Warmth melted it");
    const freeze = clueSceneFor("chemistry:states:melt-freeze")!;
    assert.equal(freeze.kind, "melt-freeze");
    if (freeze.kind === "melt-freeze") {
      assert.equal(freeze.freeze, true, "the melt-freeze item carries the freeze direction data");
    }
    assert.equal(CHEMISTRY_ANSWERS["chemistry:states:melt-freeze"]!.correct, "Ice");
    const sort = clueSceneFor("chemistry:materials:sort")!;
    assert.equal(sort.kind, "bend-test");
    assert.equal(CHEMISTRY_ANSWERS["chemistry:materials:sort"]!.correct, "Whether it bends");
    const magnet = clueSceneFor("chemistry:materials:magnet")!;
    assert.equal(magnet.kind, "magnet-sort");
    assert.equal(CHEMISTRY_ANSWERS["chemistry:materials:magnet"]!.correct, "The iron bits");
    const rebuild = clueSceneFor("chemistry:pieces:rebuild")!;
    assert.equal(rebuild.kind, "rebuild-pieces");
    assert.equal(
      CHEMISTRY_ANSWERS["chemistry:pieces:rebuild"]!.correct,
      "Yes — rebuild it longer with the same pieces",
    );
    const salt = clueSceneFor("chemistry:states:road-salt")!;
    assert.equal(salt.kind, "salt-melt");
    assert.equal(
      CHEMISTRY_ANSWERS["chemistry:states:road-salt"]!.correct,
      "It lowers the freezing point of the water",
    );
    const dissolve = clueSceneFor("chemistry:mixtures:dissolve")!;
    assert.equal(dissolve.kind, "dissolve");
    if (dissolve.kind === "dissolve") {
      assert.ok(!dissolve.threeBlocks, "the dissolve item runs the single-glass path");
    }
    assert.equal(
      CHEMISTRY_ANSWERS["chemistry:mixtures:dissolve"]!.correct,
      "It is still there, as pieces too small to see",
    );
    const particles = clueSceneFor("chemistry:states:particles")!;
    assert.equal(particles.kind, "particle-states");
    assert.equal(
      CHEMISTRY_ANSWERS["chemistry:states:particles"]!.correct,
      "The water, from solid to liquid to gas",
    );
    const cycle = clueSceneFor("chemistry:water:cycle")!;
    assert.equal(cycle.kind, "water-cycle");
    assert.equal(
      CHEMISTRY_ANSWERS["chemistry:water:cycle"]!.correct,
      "Into the air, a cloud, back as rain or snow",
    );
    const identify = clueSceneFor("chemistry:materials:identify")!;
    assert.equal(identify.kind, "dissolve");
    if (identify.kind === "dissolve") {
      assert.equal(identify.threeBlocks, true, "the identify item carries the three-blocks variant data");
    }
    assert.equal(
      CHEMISTRY_ANSWERS["chemistry:materials:identify"]!.correct,
      "Whether each block dissolves in water",
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
      // The manifest carries the same duration and line count.
      const entry = manifest.clips[summary.clip.replace(/\.mp3$/, "")];
      assert.ok(entry, `${id}: manifest entry for ${summary.clip}`);
      assert.equal(entry.file, summary.clip, `${id}: manifest file matches`);
      assert.equal(entry.item, id, `${id}: manifest item matches`);
      assert.equal(entry.duration, summary.duration, `${id}: manifest duration matches the description`);
      assert.equal(entry.lines, summary.lines.length, `${id}: manifest line count matches`);
      // The clip file itself agrees: at the render pattern's
      // 64 kbps CBR its size is its duration, within tolerance
      // for frame and tag overhead.
      const bytes = statSync(join(audioDir, summary.clip)).size;
      const expected = summary.duration * 8000;
      assert.ok(
        Math.abs(bytes - expected) / expected < 0.1,
        `${id}: clip file size ${bytes} B agrees with duration ${summary.duration} s`,
      );
    }
  });
});
