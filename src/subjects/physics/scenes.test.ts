/**
 * Physics clue scenes — the data-side contract (the math and
 * general-knowledge scenes.test.ts pattern, expansion waves
 * 4-6). Coverage is exactly all 24 dealt items — wave 4's seven
 * ages 7-10 forces-and-motion items, wave 5's five ages 7-10
 * energy, light and magnet items, and wave 6's nine ages 10-18
 * items plus three ages 18+ items. A scene description
 * carries only the givens from the item's own question, so the
 * setup film cannot give the answer away, and the solved beat's
 * arithmetic lands exactly on the item's answer. Each
 * description also carries its act-3 summary (clip, script,
 * beat map) in the solved-phase data path only, its duration
 * pinned against the manifest and the clip file itself.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PHYSICS_CLUE_SCENES,
  clueSceneFor,
  summaryStepCount,
  summaryStepLine,
  summaryStepStart,
} from "./scenes.ts";
import { PHYSICS_ANSWERS } from "./answers.ts";
import { itemsForGroup } from "./items.ts";
import type { ClueSceneDescription } from "../shared/clue-scene-types.ts";

/** The seven forces-and-motion items wave 4 built. */
const WAVE4_IDS = [
  "physics:push:which-way",
  "physics:push:equal-pushes",
  "physics:friction:measure-slide",
  "physics:ramp:faster-hits-harder",
  "physics:arrive:equal-steps",
  "physics:lever:seesaw",
  "physics:balance:tug",
];

/** The five energy, light and magnet items wave 5 builds. */
const WAVE5_IDS = [
  "physics:magnet:flip",
  "physics:drop:down",
  "physics:energy:wound-moves",
  "physics:shadow:blocks",
  "physics:mirror:sends-back",
];

/** The nine ages 10-18 items wave 6 builds. */
const WAVE6_IDS_1018 = [
  "physics:arrive:unit-rate",
  "physics:ramp:slope-ratio",
  "physics:magnet:closer",
  "physics:push:mass",
  "physics:push:table",
  "physics:ramp:higher-stored",
  "physics:energy:transfer",
  "physics:sound:medium",
  "physics:mirror:three-ways",
];

/** The three ages 18+ items wave 6 builds. */
const WAVE6_IDS_18PLUS = [
  "physics:ramp:adult-ratio",
  "physics:arrive:adult-time",
  "physics:energy:missing",
];

/** All twelve ages 7-10 items, wave 4 then wave 5. */
const DEALT_IDS = [...WAVE4_IDS, ...WAVE5_IDS];

/** Every dealt item in every band, waves 4-6 (24). */
const ALL_IDS = [...DEALT_IDS, ...WAVE6_IDS_1018, ...WAVE6_IDS_18PLUS];

/** The numeric givens a description carries, per kind. */
function givensOf(d: ClueSceneDescription): number[] {
  switch (d.kind) {
    case "push-duel":
      return [d.leftPower, d.rightPower];
    case "tile-steps":
      return d.rivalTilesPerStep === undefined
        ? [d.tilesPerStep, d.hops]
        : [d.tilesPerStep, d.hops, d.rivalTilesPerStep];
    case "slide-stop":
      return [d.slideTiles];
    case "cup-shove":
      return [d.slowSlide, d.fastSlide];
    case "seesaw-lift":
      return [];
    case "magnet-pair":
      return [];
    case "drop-fall":
      return [];
    case "wind-up":
      return [];
    case "light-path":
      return [];
    case "rate-race":
      return [d.firstMetres, d.firstSeconds, d.secondMetres, d.secondSeconds];
    case "slope-pair":
      return [d.firstRise, d.firstRun, d.secondRise, d.secondRun];
    case "same-push":
      return [d.leftBoxes, d.rightBoxes, d.leftForce, d.rightForce];
    case "hill-carts":
      return [d.lowStep, d.highStep];
    case "sound-path":
      return [];
    case "energy-ledger":
      return [d.change, d.out];
    case "journey-line":
      return [d.totalKm, d.hours ?? -1, d.targetKm ?? -1, d.aheadKm ?? -1].filter((n) => n >= 0);
    default:
      return [];
  }
}

/** How many animation steps a kind's solved beat performs — the
 * count a summary's beat map must pace exactly. */
function stepCountOf(d: ClueSceneDescription): number {
  switch (d.kind) {
    case "push-duel":
      return 3; // the arrows press, the block answers, the final tick
    case "tile-steps":
      return d.hops; // one step per hop
    case "slide-stop":
      return 3; // the slide, the ghost repeat, the final tick
    case "cup-shove":
      return 3; // the slower hit, the faster hit, the final tick
    case "seesaw-lift":
      return 3; // the press, the tip and lift, the final tick
    case "magnet-pair":
      return 3; // the flip, the spring apart, the final tick
    case "drop-fall":
      return 3; // the drop, the catch, the final tick
    case "wind-up":
      return 3; // the key turns, the roll, the final tick
    case "light-path":
      return 3; // the ray to the book, the ray onward (or the card), the final tick
    case "rate-race": {
      const winnerSeconds =
        d.firstMetres / d.firstSeconds >= d.secondMetres / d.secondSeconds
          ? d.firstSeconds
          : d.secondSeconds;
      return winnerSeconds + 1; // one hop per second of the winner's run, then the final tick
    }
    case "slope-pair":
      return 3; // the first slope line, the second slope line, the final tick
    case "same-push":
      return 3; // the arrows press, both carts roll, the final tick
    case "hill-carts":
      return 3; // the height marks, the store stacks, the final tick
    case "sound-path":
      return 3; // the waves cross the air, the waves fade at the gap, the final tick
    case "energy-ledger":
      return 3; // the out bar, the stacked change bar, the in bar and tick
    case "journey-line":
      return d.hours !== undefined && d.targetKm !== undefined
        ? Math.round(d.targetKm / (d.totalKm / d.hours))
        : 2;
    default:
      return -1;
  }
}

const CLOSING: Record<string, string> = {
  "physics:push:which-way": "to the right",
  "physics:push:equal-pushes": "8 tiles",
  "physics:friction:measure-slide": "same mark",
  "physics:ramp:faster-hits-harder": "after the faster ball",
  "physics:arrive:equal-steps": "reaches the line first",
  "physics:lever:seesaw": "lifts the box",
  "physics:balance:tug": "stays still",
  "physics:magnet:flip": "pushes apart",
  "physics:drop:down": "down into the bucket",
  "physics:energy:wound-moves": "The wound-up car",
  "physics:shadow:blocks": "cardboard blocks",
  "physics:mirror:sends-back": "into your eye",
  "physics:arrive:unit-rate": "arrives first",
  "physics:ramp:slope-ratio": "Ramp B is steeper",
  "physics:magnet:closer": "the closer pair pulls harder",
  "physics:push:mass": "the lighter cart",
  "physics:push:table": "larger net force",
  "physics:ramp:higher-stored": "the higher cart",
  "physics:energy:transfer": "moved into the cup",
  "physics:sound:medium": "the air path carries the sound",
  "physics:mirror:three-ways": "the mirror is the one that reflects",
  "physics:ramp:adult-ratio": "Boom B is steeper",
  "physics:arrive:adult-time": "3 hours",
  "physics:energy:missing": "5 units",
};

describe("physics clue scene descriptions — waves 4-6 (all bands, complete)", () => {
  it("covers exactly all twelve dealt items for ages 7-10", () => {
    const bandIds = itemsForGroup("7-10").map((item) => item.id);
    assert.equal(bandIds.length, 12);
    assert.deepEqual([...DEALT_IDS].sort(), [...bandIds].sort());
    for (const id of DEALT_IDS) {
      assert.ok(clueSceneFor(id), `${id} has a scene`);
    }
  });

  it("covers the nine scene-backed dealt items for ages 10-18 and the three for 18+", () => {
    const band1018 = itemsForGroup("10-18").map((item) => item.id);
    const sceneBacked1018 = band1018.filter((id) => clueSceneFor(id) !== null);
    assert.equal(sceneBacked1018.length, 9);
    assert.deepEqual([...WAVE6_IDS_1018].sort(), [...sceneBacked1018].sort());
    const band18 = itemsForGroup("18+").map((item) => item.id);
    assert.equal(band18.length, 3);
    assert.deepEqual([...WAVE6_IDS_18PLUS].sort(), [...band18].sort());
    for (const id of [...WAVE6_IDS_1018, ...WAVE6_IDS_18PLUS]) {
      assert.ok(clueSceneFor(id), `${id} has a scene`);
    }
    // The scene map covers all 24 waves 4-6 items.
    assert.deepEqual(Object.keys(PHYSICS_CLUE_SCENES).sort(), [...ALL_IDS].sort());
  });

  it("never carries the answer before the pick", () => {
    for (const id of ALL_IDS) {
      const description = clueSceneFor(id)!;
      const answer = PHYSICS_ANSWERS[id]!;
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
    const whichWay = clueSceneFor("physics:push:which-way")!;
    assert.equal(whichWay.kind, "push-duel");
    if (whichWay.kind === "push-duel") {
      assert.ok(whichWay.leftPower > whichWay.rightPower, "Ana's (left) push is the stronger");
      assert.equal(PHYSICS_ANSWERS["physics:push:which-way"]!.correct, "To the right");
    }
    const equalPushes = clueSceneFor("physics:push:equal-pushes")!;
    assert.equal(equalPushes.kind, "tile-steps");
    if (equalPushes.kind === "tile-steps") {
      assert.equal(
        equalPushes.tilesPerStep * equalPushes.hops,
        PHYSICS_ANSWERS["physics:push:equal-pushes"]!.value,
      );
    }
    const slide = clueSceneFor("physics:friction:measure-slide")!;
    assert.equal(slide.kind, "slide-stop");
    assert.equal(PHYSICS_ANSWERS["physics:friction:measure-slide"]!.correct, "At the same mark");
    const shove = clueSceneFor("physics:ramp:faster-hits-harder")!;
    assert.equal(shove.kind, "cup-shove");
    if (shove.kind === "cup-shove") {
      assert.ok(shove.fastSlide > shove.slowSlide, "the faster ball's slide is the longer");
      assert.equal(PHYSICS_ANSWERS["physics:ramp:faster-hits-harder"]!.correct, "After the faster ball");
    }
    const steps = clueSceneFor("physics:arrive:equal-steps")!;
    assert.equal(steps.kind, "tile-steps");
    if (steps.kind === "tile-steps") {
      assert.ok(
        steps.tilesPerStep > (steps.rivalTilesPerStep ?? 0),
        "the lead cart's step is the bigger",
      );
      assert.equal(
        PHYSICS_ANSWERS["physics:arrive:equal-steps"]!.correct,
        "The 3-tiles-each-step cart",
      );
    }
    const seesaw = clueSceneFor("physics:lever:seesaw")!;
    assert.equal(seesaw.kind, "seesaw-lift");
    assert.equal(PHYSICS_ANSWERS["physics:lever:seesaw"]!.correct, "It goes up and lifts the box");
    const tug = clueSceneFor("physics:balance:tug")!;
    assert.equal(tug.kind, "push-duel");
    if (tug.kind === "push-duel") {
      assert.equal(tug.leftPower, tug.rightPower, "the gate's pushes match exactly");
      assert.equal(PHYSICS_ANSWERS["physics:balance:tug"]!.correct, "No, it stays still");
    }
    const magnet = clueSceneFor("physics:magnet:flip")!;
    assert.equal(magnet.kind, "magnet-pair");
    assert.equal(PHYSICS_ANSWERS["physics:magnet:flip"]!.correct, "They now push apart");
    const drop = clueSceneFor("physics:drop:down")!;
    assert.equal(drop.kind, "drop-fall");
    assert.equal(PHYSICS_ANSWERS["physics:drop:down"]!.correct, "Down into the bucket");
    const wound = clueSceneFor("physics:energy:wound-moves")!;
    assert.equal(wound.kind, "wind-up");
    assert.equal(PHYSICS_ANSWERS["physics:energy:wound-moves"]!.correct, "The wound-up car");
    const shadow = clueSceneFor("physics:shadow:blocks")!;
    assert.equal(shadow.kind, "light-path");
    if (shadow.kind === "light-path") {
      assert.equal(shadow.withCard, true, "the blocking item carries the card in its data");
    }
    assert.equal(
      PHYSICS_ANSWERS["physics:shadow:blocks"]!.correct,
      "No, the cardboard blocks the light",
    );
    const mirror = clueSceneFor("physics:mirror:sends-back")!;
    assert.equal(mirror.kind, "light-path");
    if (mirror.kind === "light-path") {
      assert.equal(mirror.withCard, false, "the mirror item reuses light-path with no card");
    }
    assert.equal(
      PHYSICS_ANSWERS["physics:mirror:sends-back"]!.correct,
      "Light bounces off the book into your eye",
    );
    // ── Wave 6 (ages 10-18 and 18+) ──
    const race = clueSceneFor("physics:arrive:unit-rate")!;
    assert.equal(race.kind, "rate-race");
    if (race.kind === "rate-race") {
      assert.ok(
        race.firstMetres / race.firstSeconds > race.secondMetres / race.secondSeconds,
        "the 8-in-2 cart is the faster (4 beats 3 each second)",
      );
      assert.equal(PHYSICS_ANSWERS["physics:arrive:unit-rate"]!.correct, "The 8 metres in 2 seconds cart");
    }
    const slope = clueSceneFor("physics:ramp:slope-ratio")!;
    assert.equal(slope.kind, "slope-pair");
    if (slope.kind === "slope-pair") {
      assert.ok(slope.secondRise / slope.secondRun > slope.firstRise / slope.firstRun, "B is steeper");
      assert.equal(PHYSICS_ANSWERS["physics:ramp:slope-ratio"]!.correct, "Ramp B");
    }
    const closer = clueSceneFor("physics:magnet:closer")!;
    assert.equal(closer.kind, "magnet-pair");
    if (closer.kind === "magnet-pair") {
      assert.equal(closer.twoPairs, true, "the closer item carries the two-pair variant data");
    }
    assert.equal(PHYSICS_ANSWERS["physics:magnet:closer"]!.correct, "The closer pair");
    const mass = clueSceneFor("physics:push:mass")!;
    assert.equal(mass.kind, "same-push");
    if (mass.kind === "same-push") {
      assert.equal(mass.leftForce, mass.rightForce, "the push is the same");
      assert.ok(mass.leftBoxes < mass.rightBoxes, "the left cart is the lighter");
      assert.equal(PHYSICS_ANSWERS["physics:push:mass"]!.correct, "The lighter cart");
    }
    const table = clueSceneFor("physics:push:table")!;
    assert.equal(table.kind, "same-push");
    if (table.kind === "same-push") {
      assert.equal(table.leftBoxes, table.rightBoxes, "the mass matches");
      assert.ok(table.rightForce > table.leftForce, "the right trial's force is the larger");
      assert.equal(
        PHYSICS_ANSWERS["physics:push:table"]!.correct,
        "The trial with the larger net force",
      );
    }
    const higher = clueSceneFor("physics:ramp:higher-stored")!;
    assert.equal(higher.kind, "hill-carts");
    if (higher.kind === "hill-carts") {
      assert.ok(higher.highStep > higher.lowStep, "one cart sits higher");
      assert.equal(PHYSICS_ANSWERS["physics:ramp:higher-stored"]!.correct, "The higher cart");
    }
    const transfer = clueSceneFor("physics:energy:transfer")!;
    assert.equal(transfer.kind, "cup-shove");
    if (transfer.kind === "cup-shove") {
      assert.equal(transfer.stopsDead, true, "the transfer item carries the stops-dead variant data");
      assert.ok(transfer.slowSlide > 0, "the cup slides");
    }
    assert.equal(PHYSICS_ANSWERS["physics:energy:transfer"]!.correct, "It moved into the cup");
    const medium = clueSceneFor("physics:sound:medium")!;
    assert.equal(medium.kind, "sound-path");
    assert.equal(PHYSICS_ANSWERS["physics:sound:medium"]!.correct, "The air path");
    const threeWays = clueSceneFor("physics:mirror:three-ways")!;
    assert.equal(threeWays.kind, "light-path");
    if (threeWays.kind === "light-path") {
      assert.equal(threeWays.threeMaterials, true, "the three-ways item carries the three-materials data");
      assert.equal(threeWays.withCard, false);
    }
    assert.equal(PHYSICS_ANSWERS["physics:mirror:three-ways"]!.correct, "The mirror");
    const adultRatio = clueSceneFor("physics:ramp:adult-ratio")!;
    assert.equal(adultRatio.kind, "slope-pair");
    if (adultRatio.kind === "slope-pair") {
      assert.equal(adultRatio.firstRun, adultRatio.secondRun, "the runs match");
      assert.ok(
        adultRatio.secondRise / adultRatio.secondRun > adultRatio.firstRise / adultRatio.firstRun,
        "boom B is steeper",
      );
      assert.equal(PHYSICS_ANSWERS["physics:ramp:adult-ratio"]!.correct, "Boom B");
    }
    const adultTime = clueSceneFor("physics:arrive:adult-time")!;
    assert.equal(adultTime.kind, "journey-line");
    if (adultTime.kind === "journey-line") {
      assert.equal(
        adultTime.targetKm! / (adultTime.totalKm / adultTime.hours!),
        PHYSICS_ANSWERS["physics:arrive:adult-time"]!.value,
      );
    }
    const missing = clueSceneFor("physics:energy:missing")!;
    assert.equal(missing.kind, "energy-ledger");
    if (missing.kind === "energy-ledger") {
      assert.equal(
        missing.change + missing.out,
        PHYSICS_ANSWERS["physics:energy:missing"]!.value,
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
