/**
 * Physics clue scenes — the data-side contract (the math and
 * general-knowledge scenes.test.ts pattern, expansion waves
 * 4-5). Coverage is exactly the twelve items dealt for ages
 * 7-10 — wave 4's seven forces-and-motion items plus wave 5's
 * five energy, light and magnet items. A scene description
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

/** All twelve ages 7-10 items, wave 4 then wave 5. */
const DEALT_IDS = [...WAVE4_IDS, ...WAVE5_IDS];

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
};

describe("physics clue scene descriptions — waves 4-5 (ages 7-10, complete)", () => {
  it("covers exactly all twelve dealt items for ages 7-10", () => {
    const bandIds = itemsForGroup("7-10").map((item) => item.id);
    assert.equal(bandIds.length, 12);
    assert.deepEqual([...DEALT_IDS].sort(), [...bandIds].sort());
    for (const id of DEALT_IDS) {
      assert.ok(clueSceneFor(id), `${id} has a scene`);
    }
    assert.deepEqual(Object.keys(PHYSICS_CLUE_SCENES).sort(), [...DEALT_IDS].sort());
    // No other band carries a description.
    for (const band of ["10-18", "18+"] as const) {
      for (const item of itemsForGroup(band)) {
        assert.equal(clueSceneFor(item.id), null, `${item.id} (${band}) has no scene`);
      }
    }
  });

  it("never carries the answer before the pick", () => {
    for (const id of DEALT_IDS) {
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
  });

  it("every item carries a well-formed narrated summary, pinned to the manifest and the clip file", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const audioDir = join(here, "..", "..", "..", "public", "audio", "subjects");
    const manifest = JSON.parse(readFileSync(join(audioDir, "manifest.json"), "utf8")) as {
      clips: Record<string, { file: string; duration: number; lines: number; item: string }>;
    };
    for (const id of DEALT_IDS) {
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
