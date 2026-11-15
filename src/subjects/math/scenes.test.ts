/**
 * Math clue scenes — the data-side contract. Wave 1 covers every
 * Math item for ages 7-10 (the pilot's three kinds plus eight
 * more); a scene description carries only the givens from the
 * item's own question, so the setup film cannot give the answer
 * away, and the solved beat's arithmetic lands exactly on the
 * item's answer. Each description also carries its act-3 summary
 * (clip, script, beat map) in the solved-phase data path only.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MATH_CLUE_SCENES,
  clueSceneFor,
  countingTicks,
  dealOrder,
  summaryStepCount,
  summaryStepLine,
  summaryStepStart,
} from "./scenes.ts";
import { groupTicks, chunkPlan, placeColumns } from "../shared/clue-scene-types.ts";
import { MATH_ANSWERS } from "./answers.ts";
import { itemsForGroup } from "./items.ts";
import type { ClueSceneDescription } from "../shared/clue-scene-types.ts";

const ALL_IDS = itemsForGroup("7-10").map((item) => item.id);

/** The numeric givens a description carries, per kind. */
function givensOf(d: ClueSceneDescription): number[] {
  switch (d.kind) {
    case "coin-groups":
      return [d.total, d.groupSize];
    case "pencil-packs":
      return [d.packs, d.perPack];
    case "fair-share":
      return [d.total, d.friends];
    case "bus-boarding":
      return [d.total, d.seats];
    case "pack-boxes":
      return [d.total, d.perBox];
    case "place-value":
      return [d.hundreds, d.tens, d.ones];
    case "place-compare":
      return [d.left, d.right];
    case "rounding-line":
      return [d.value, d.low, d.high];
    case "digit-shift":
      return [d.value, d.factor];
    case "split-product":
      return [d.rows, d.perRow, d.splitHigh, d.splitLow];
    case "chunk-share":
      return [d.total, d.shares];
  }
}

/** How many animation steps a kind's solved beat performs — the
 * count a summary's beat map must pace exactly. */
function stepCountOf(d: ClueSceneDescription): number {
  switch (d.kind) {
    case "coin-groups":
      return d.total / d.groupSize;
    case "pencil-packs":
      return d.packs;
    case "fair-share":
      return d.total;
    case "bus-boarding":
      return Math.ceil(d.total / d.seats);
    case "pack-boxes":
      return Math.ceil(d.total / d.perBox);
    case "place-value":
      return [d.hundreds, d.tens, d.ones].filter((n) => n > 0).length;
    case "place-compare": {
      const l = placeColumns(d.left);
      const r = placeColumns(d.right);
      const deciding = l.findIndex((v, i) => v !== r[i]);
      return deciding + 2; // the swept columns, then the final tick
    }
    case "rounding-line":
      return 2; // the midpoint reveal, then the marker's slide
    case "digit-shift":
      return d.value / 10; // one stone per ten in the starting number
    case "split-product":
      return 4; // split overlays, round-part tick, leftover tick, final tick
    case "chunk-share":
      return chunkPlan(d).length;
  }
}

describe("clue scene descriptions", () => {
  it("covers exactly the Math items for ages 7-10", () => {
    assert.deepEqual(Object.keys(MATH_CLUE_SCENES).sort(), [...ALL_IDS].sort());
    for (const id of ALL_IDS) {
      assert.ok(clueSceneFor(id), `${id} has a scene`);
    }
    // Other bands carry no descriptions yet — their clue cards
    // are unchanged.
    assert.equal(clueSceneFor(itemsForGroup("10-18")[0]!.id), null);
    assert.equal(clueSceneFor(itemsForGroup("18+")[0]!.id), null);
  });

  it("never carries the answer before the pick", () => {
    for (const id of ALL_IDS) {
      const description = clueSceneFor(id)!;
      const answer = MATH_ANSWERS[id]!;
      // The labels are the only text the setup phase shows, and
      // they carry no numbers at all (numbers live in the question).
      assert.ok(!/\d/.test(description.labelSetup), `${id}: setup label has no digits`);
      assert.ok(!/\d/.test(description.labelSolved), `${id}: solved label has no digits`);
      for (const choice of answer.choices) {
        assert.ok(
          !new RegExp(`\\b${choice.replace(".", "\\.")}\\b`).test(description.labelSetup),
          `${id}: setup label must not contain the choice ${choice}`,
        );
      }
      // The numeric givens are the question's own numbers; the
      // answer value is never one of them — with two documented
      // exemptions where the question IS its numbers: place-compare
      // (both candidates are givens; the scene marks no winner
      // before the pick) and rounding-line (the number and its two
      // hundreds are givens; the scene never marks the nearer end).
      if (description.kind !== "place-compare" && description.kind !== "rounding-line") {
        assert.ok(
          !givensOf(description).includes(answer.value!),
          `${id}: answer value is not a scene given`,
        );
      }
    }
  });

  it("the solved beat's arithmetic lands on the item's answer", () => {
    for (const id of ALL_IDS) {
      const d = clueSceneFor(id)!;
      const value = MATH_ANSWERS[id]!.value!;
      switch (d.kind) {
        case "coin-groups":
          assert.equal(d.total / d.groupSize, value, id);
          break;
        case "pencil-packs":
          assert.equal(d.packs * d.perPack, value, id);
          break;
        case "fair-share":
          assert.equal(d.total / d.friends, value, id);
          break;
        case "bus-boarding":
          assert.equal(Math.ceil(d.total / d.seats), value, id);
          break;
        case "pack-boxes":
          assert.equal(d.total / d.perBox, value, id);
          break;
        case "place-value":
          assert.equal(d.hundreds * 100 + d.tens * 10 + d.ones, value, id);
          break;
        case "place-compare":
          assert.equal(Math.max(d.left, d.right), value, id);
          break;
        case "rounding-line":
          assert.equal(
            d.value - d.low < d.high - d.value ? d.low : d.high,
            value,
            id,
          );
          break;
        case "digit-shift":
          assert.equal(d.value * d.factor, value, id);
          break;
        case "split-product":
          assert.equal(d.rows * d.perRow, value, id);
          assert.equal(d.splitHigh + d.splitLow, d.perRow, id);
          break;
        case "chunk-share": {
          const plan = chunkPlan(d);
          assert.equal(
            plan.reduce((a, b) => a + b, 0),
            d.total / d.shares,
            id,
          );
          assert.equal(d.total / d.shares, value, id);
          break;
        }
      }
    }
  });

  it("a solved beat exists for each item", () => {
    // Coins: the counter ticks up in 5s to the full pile.
    assert.deepEqual(countingTicks(clueSceneFor("math-number:groups:skip-count")!), [
      5, 10, 15, 20, 25, 30, 35, 40,
    ]);
    // Pencils: the counter ticks in 4s to the last pack.
    assert.deepEqual(countingTicks(clueSceneFor("math-number:tables:facts")!), [4, 8, 12, 16, 20, 24, 28]);
    // Snacks: dealt one by one, round and round, fair to the end.
    const order = dealOrder(clueSceneFor("math-number:division:fair-share")!);
    assert.deepEqual(order, [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3]);
    const perFriend = [0, 0, 0, 0];
    for (const f of order) perFriend[f]!++;
    assert.deepEqual(perFriend, [3, 3, 3, 3]);
    // Buses: full-bus ticks, and the remainder item's last tick is
    // the total itself (its final bus is part-full).
    assert.deepEqual(groupTicks(24, 6), [6, 12, 18, 24]);
    assert.deepEqual(groupTicks(26, 6), [6, 12, 18, 24]);
    // Chunks: 1,248 over 8 shelves is 156 each, dealt 100/50/6.
    const share = clueSceneFor("math-number:division:big-quotients")!;
    assert.deepEqual(chunkPlan(share), [100, 50, 6]);
    // Places: the two routes decompose digit by digit.
    assert.deepEqual(placeColumns(358), [3, 5, 8]);
    assert.deepEqual(placeColumns(385), [3, 8, 5]);
  });
});

describe("clue scene summaries (act 3)", () => {
  it("every covered item carries a narrated summary", () => {
    for (const id of ALL_IDS) {
      const description = clueSceneFor(id)!;
      const summary = description.summary;
      assert.ok(summary, `${id} has a summary`);
      assert.ok(summary.lines.length >= 4, `${id}: an opening, steps, and a closing line`);
      assert.equal(summary.beats.length, summary.lines.length, `${id}: beats parallel to lines`);
      for (const line of summary.lines) {
        assert.ok(line.text.trim().length > 0, `${id}: no empty lines`);
      }
      // Timings: the first line starts the clip, starts strictly
      // increase, and the clip outlasts its last line.
      assert.equal(summary.lines[0]!.at, 0, `${id}: first line at 0`);
      for (let i = 1; i < summary.lines.length; i++) {
        assert.ok(
          summary.lines[i]!.at > summary.lines[i - 1]!.at,
          `${id}: line ${i} starts after line ${i - 1}`,
        );
      }
      assert.ok(
        summary.duration > summary.lines[summary.lines.length - 1]!.at,
        `${id}: clip outlasts its last line`,
      );
      // The clip name can never leak an answer before the pick:
      // a plain file name, and no digits in its stem (the ".mp3"
      // extension itself is not part of the name).
      assert.ok(!/\d/.test(summary.clip.replace(/\.mp3$/, "")), `${id}: clip name carries no digits`);
      assert.ok(!summary.clip.includes("/"), `${id}: clip is a plain file name`);
    }
  });

  it("the beat map paces exactly the solved beat's steps", () => {
    for (const id of ALL_IDS) {
      const description = clueSceneFor(id)!;
      assert.equal(
        summaryStepCount(description.summary!),
        stepCountOf(description),
        `${id}: beat map covers the solved beat`,
      );
    }
  });

  it("the closing line states the item's answer, the method's payoff", () => {
    for (const id of ALL_IDS) {
      const summary = clueSceneFor(id)!.summary!;
      const closing = summary.lines[summary.lines.length - 1]!.text;
      assert.ok(
        closing.includes(String(MATH_ANSWERS[id]!.value)),
        `${id}: closing line states ${MATH_ANSWERS[id]!.value}`,
      );
    }
  });

  it("step timing follows the lines: steps land inside their line, in order", () => {
    for (const id of ALL_IDS) {
      const summary = clueSceneFor(id)!.summary!;
      let previousLine = -1;
      for (let step = 0; step < summaryStepCount(summary); step++) {
        const { line } = summaryStepLine(summary, step);
        assert.ok(line >= previousLine, `${id}: step ${step} never jumps backwards a line`);
        previousLine = line;
        const start = summaryStepStart(summary, step, 0.5);
        assert.ok(
          start >= (summary.lines[line]?.at ?? 0),
          `${id}: step ${step} starts inside its line`,
        );
        assert.ok(start < summary.duration, `${id}: step ${step} starts before the clip ends`);
      }
    }
  });
});
