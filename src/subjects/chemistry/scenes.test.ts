/**
 * Chemistry clue scenes — the data-side contract (the physics
 * scenes.test.ts pattern, expansion waves 7-8). Coverage is
 * exactly all sixteen dealt items: the five ages 7-10 items,
 * all eight ages 10-18 items and all three ages 18+ items —
 * Chemistry is complete at 16/16. A scene description carries
 * only the givens from the item's own question, so the setup
 * film cannot give the answer away. Each description also
 * carries its act-3 summary (clip, script, beat map) in the
 * solved-phase data path only, its duration pinned against
 * the manifest and the clip file.
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
const IDS_1018_W7 = [
  "chemistry:states:road-salt",
  "chemistry:mixtures:dissolve",
  "chemistry:states:particles",
  "chemistry:water:cycle",
  "chemistry:materials:identify",
];

/** The three ages 10-18 reactions items wave 8 builds. */
const IDS_1018_W8 = [
  "chemistry:reactions:weight",
  "chemistry:reactions:new-look",
  "chemistry:reactions:rust",
];

/** The three ages 18+ items wave 8 builds — the whole band. */
const IDS_18 = [
  "chemistry:reactions:rate",
  "chemistry:reactions:mass",
  "chemistry:reactions:explain",
];

const IDS_1018 = [...IDS_1018_W7, ...IDS_1018_W8];
const ALL_IDS = [...IDS_710, ...IDS_1018, ...IDS_18];

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
    case "scale-balance":
      return 3; // the pour, the mixed look, the needle and final tick
    case "bubble-reaction":
      return 3; // the pours, the bubbles rise, the final tick
    case "rust-change":
      return 3; // rain and air meet the frame, the rust blooms, the final tick
    case "glow-rate":
      return 3; // the warm glow brightens, the warm stick fades, the final tick
    case "atom-tally":
      return 3; // the dots rearrange, the pairing rings, the final tick
    case "column-cousins":
      return 3; // the known tile sparks, the cousin sparks the same, the final tick
    case "compass-walk":
      return 3;
    case "density-towns":
      return 3;
    case "two-roads":
      return 3;
    case "zone-clocks":
      return 3;
    case "globe-vs-map":
      return 3;
    case "great-circle":
      return 3;
    case "cost-compare":
      return 3;
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
  "chemistry:reactions:weight": "It stays the same",
  "chemistry:reactions:new-look": "It might be a new substance",
  "chemistry:reactions:rust": "iron exposed to oxygen and water turns to rust",
  "chemistry:reactions:rate": "The one in warm water",
  "chemistry:reactions:mass": "The same count on both sides \u2014 no atom vanished",
  "chemistry:reactions:explain": "It reacts in a similar way",
};

describe("chemistry clue scene descriptions — waves 7-8", () => {
  it("covers exactly the five dealt items for ages 7-10", () => {
    const bandIds = itemsForGroup("7-10").map((item) => item.id);
    assert.equal(bandIds.length, 5);
    assert.deepEqual([...IDS_710].sort(), [...bandIds].sort());
    for (const id of IDS_710) {
      assert.ok(clueSceneFor(id), `${id} has a scene`);
    }
  });

  it("covers exactly all eight dealt items for ages 10-18", () => {
    const bandIds = itemsForGroup("10-18").map((item) => item.id);
    assert.equal(bandIds.length, 8);
    assert.deepEqual([...bandIds].sort(), [...IDS_1018].sort());
    for (const id of IDS_1018) {
      assert.ok(clueSceneFor(id), `${id} has a scene`);
    }
  });

  it("covers exactly all three dealt items for ages 18+, completing Chemistry 16/16", () => {
    const bandIds = itemsForGroup("18+").map((item) => item.id);
    assert.equal(bandIds.length, 3);
    assert.deepEqual([...bandIds].sort(), [...IDS_18].sort());
    for (const id of IDS_18) {
      assert.ok(clueSceneFor(id), `${id} has a scene`);
    }
    // The whole map is exactly the sixteen dealt Chemistry items.
    assert.deepEqual(Object.keys(CHEMISTRY_CLUE_SCENES).sort(), [...ALL_IDS].sort());
    assert.equal(ALL_IDS.length, 16);
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

  it("the wave-8 solved beats land on their items' answers", () => {
    const weight = clueSceneFor("chemistry:reactions:weight")!;
    assert.equal(weight.kind, "scale-balance");
    assert.equal(CHEMISTRY_ANSWERS["chemistry:reactions:weight"]!.correct, "It stays the same");
    const newLook = clueSceneFor("chemistry:reactions:new-look")!;
    assert.equal(newLook.kind, "bubble-reaction");
    assert.equal(CHEMISTRY_ANSWERS["chemistry:reactions:new-look"]!.correct, "It might be a new substance");
    const rust = clueSceneFor("chemistry:reactions:rust")!;
    assert.equal(rust.kind, "rust-change");
    assert.equal(
      CHEMISTRY_ANSWERS["chemistry:reactions:rust"]!.correct,
      "Yes \u2014 iron exposed to oxygen and water turns to rust",
    );
    const rate = clueSceneFor("chemistry:reactions:rate")!;
    assert.equal(rate.kind, "glow-rate");
    assert.equal(CHEMISTRY_ANSWERS["chemistry:reactions:rate"]!.correct, "The one in warm water");
    const mass = clueSceneFor("chemistry:reactions:mass")!;
    assert.equal(mass.kind, "atom-tally");
    assert.equal(
      CHEMISTRY_ANSWERS["chemistry:reactions:mass"]!.correct,
      "The same count on both sides \u2014 no atom vanished",
    );
    const explain = clueSceneFor("chemistry:reactions:explain")!;
    assert.equal(explain.kind, "column-cousins");
    assert.equal(CHEMISTRY_ANSWERS["chemistry:reactions:explain"]!.correct, "It reacts in a similar way");
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
