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
import {
  groupTicks,
  chunkPlan,
  placeColumns,
  elapsedMinutes,
  fittingUnit,
} from "../shared/clue-scene-types.ts";
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
    case "array-grid":
      return [d.rows, d.perRow, d.splitHigh, d.splitLow];
    case "scale-line":
      return [d.kilometres, d.metresPerKm];
    case "percent-bar":
      return [d.total, d.percentOff];
    case "map-scale":
      return [d.mapCm, d.kmPerCm];
    case "fraction-bar":
      return [d.numerator, d.denominator];
    case "fraction-measure":
      return [d.total, d.pieceNumerator, d.pieceDenominator];
    case "rate-bars":
      return [d.firstMetres, d.firstCoins, d.secondMetres, d.secondCoins];
    case "journey-line":
      return [d.totalKm, d.hours ?? -1, d.targetKm ?? -1, d.aheadKm ?? -1].filter((n) => n >= 0);
    case "spend-then-group":
      return [d.total, d.fixedCost, d.perGroup];
    case "bearing-diagram":
      return [d.eastKm, d.northKm];
    case "tile-grid":
      return [d.cols, d.rows];
    case "measure-trace":
      return [d.length, d.width];
    case "fraction-slice":
      return d.parts2
        ? [d.parts, d.taken, d.parts2, d.taken2 ?? 0]
        : [d.parts, d.taken];
    case "fraction-fill":
      return [d.numerator, d.denominator, d.otherNumerator, d.otherDenominator];
    case "clock-arc":
      return [d.startHour, d.startMinute, d.endHour, d.endMinute];
    case "unit-fit":
      return [d.pathLength];
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
    case "array-grid":
      return 4; // split overlays, wide tick, narrow tick, final tick
    case "scale-line":
      return 2; // the kilometre marks, then the final tick
    case "percent-bar":
      return 3; // the split, the saved tick, the final tick
    case "map-scale":
      return d.mapCm;
    case "fraction-bar":
      return 2; // the shading, then the halved part
    case "fraction-measure":
      return Math.round(d.total / (d.pieceNumerator / d.pieceDenominator));
    case "rate-bars":
      return 3; // first bar priced, second bar priced, cheaper ringed
    case "journey-line":
      return d.hours !== undefined && d.targetKm !== undefined
        ? Math.round(d.targetKm / (d.totalKm / d.hours))
        : 2; // the walked fill, then the final tick
    case "spend-then-group":
      return 1 + Math.round((d.total - d.fixedCost) / d.perGroup);
    case "bearing-diagram":
      return 3; // east leg, north leg, the angle arc
    case "tile-grid":
      return d.rows; // one beat per row laid
    case "measure-trace":
      return d.mode === "loop" ? 4 : 3; // loop: four sides; bars: trace, trace, gap
    case "fraction-slice":
      return d.parts + (d.parts2 ?? 0); // one beat per slice, across both wholes
    case "fraction-fill":
      return 3; // fill, fill, the shared grid
    case "clock-arc":
      return elapsedMinutes(d) / 5; // the arc sweeps in five-minute chunks
    case "unit-fit":
      return 3; // ant-step, finger-step, stride
  }
}

describe("clue scene descriptions", () => {
  it("covers exactly the Math items for ages 7-10", () => {
    // (The scene map's full key set — 7-10 plus the wave-2 band —
    // is pinned exactly by the wave-2 block below.)
    for (const id of ALL_IDS) {
      assert.ok(clueSceneFor(id), `${id} has a scene`);
    }
    // The 18+ band carries no descriptions yet — its clue cards
    // are unchanged. (10-18 coverage is pinned by the wave-2 block
    // below.)
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
    // §7.2(1) structural variant: three items have phrase answers
    // with no numeric value for arithmetic to land on. Their
    // solved end-state's structure is asserted instead — equal
    // strength, different shape; exact coverage is untouched.
    const PHRASE_IDS = new Set([
      "math-number:fractions:equivalent",
      "math-number:fractions:compare-unlike",
      "math-applied:measure:choose-unit",
    ]);
    for (const id of ALL_IDS) {
      const d = clueSceneFor(id)!;
      if (PHRASE_IDS.has(id)) {
        const correct = MATH_ANSWERS[id]!.correct;
        if (d.kind === "fraction-slice") {
          // The taken parts of the two wholes are the same amount.
          assert.ok(d.parts2 && d.taken2 !== undefined, `${id}: two wholes`);
          assert.equal(d.taken / d.parts, d.taken2! / d.parts2!, `${id}: equal edges align`);
          assert.equal(correct, "They have the same amount", id);
        } else if (d.kind === "fraction-fill") {
          // The fuller bottle is the first one, and it is the answer.
          assert.ok(
            d.numerator / d.denominator > d.otherNumerator / d.otherDenominator,
            `${id}: the first bottle is fuller`,
          );
          assert.ok(
            correct.includes(`${d.numerator}/${d.denominator}`),
            `${id}: the answer names the fuller bottle`,
          );
        } else if (d.kind === "unit-fit") {
          // The stride glyph is the one that fits (see fittingUnit).
          assert.equal(fittingUnit(d), "m", `${id}: the stride fits the path`);
          assert.equal(correct, "Metres", id);
        } else {
          assert.fail(`${id}: phrase item has unexpected kind ${d.kind}`);
        }
        continue;
      }
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
        case "tile-grid":
          assert.equal(d.cols * d.rows, value, id);
          break;
        case "measure-trace":
          assert.equal(
            d.mode === "loop" ? 2 * (d.length + d.width) : d.width - d.length,
            value,
            id,
          );
          break;
        case "fraction-slice":
          assert.equal(d.taken / d.parts, value, id);
          break;
        case "fraction-fill":
        case "unit-fit":
          // Phrase-answer kinds: asserted structurally above.
          assert.fail(`${id}: ${d.kind} item should be a phrase item`);
          break;
        case "clock-arc":
          assert.equal(elapsedMinutes(d), value, id);
          break;
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
      // The answer as the item states it: the numeric value, or —
      // for the §7.2(1) phrase-answer items, which have no value —
      // the correct choice's own words. (Demanding String(value)
      // for those would demand the literal string "undefined".)
      const answer = MATH_ANSWERS[id]!;
      const stated =
        answer.value !== undefined ? [String(answer.value), answer.correct] : [answer.correct];
      assert.ok(
        stated.some((s) => closing.includes(s)),
        `${id}: closing line states ${stated.join(" / ")}`,
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

/* ── Wave 2: Math ages 10-18 ───────────────────────────────────
   The same contract as the 7-10 block above, for the band's 13
   items: coverage exact, setup blind, arithmetic landing on the
   answer, summaries well-formed and paced to their solved beat.
   The one documented exemption is the accuracy item's
   rounding-line: the zoomed line's two hundredths ARE the
   question's own givens (the tape's precision), drawn spatially
   without marking the nearer end before the pick — the same
   pattern the pilot ruled for place-compare / rounding-line. */

const BAND2_IDS = itemsForGroup("10-18").map((item) => item.id);

const BAND2_CLOSING: Record<string, string> = {
  "math-number:tables:multi-digit": "1081",
  "math-applied:measure:convert-metric": "2400",
  "math-number:fractions:percent": "56",
  "math-applied:geometry:scale-drawing": "8 kilometres",
  "math-number:division:standard-algorithm": "156",
  "math-number:fractions:multiply": "1/3",
  "math-number:fractions:divide": "8 ribbons",
  "math-applied:measure:accuracy": "2.48",
  "math-applied:rates:unit-rate": "1.6",
  "math-applied:rates:constant-speed": "5 hours",
  "math-applied:rates:one-step": "7 kilometres",
  "math-applied:rates:two-step": "5 cups",
  "math-applied:trig:bearings": "37 degrees",
};

describe("clue scene descriptions — wave 2 (ages 10-18)", () => {
  it("covers exactly the Math items for ages 10-18, on top of 7-10", () => {
    assert.equal(BAND2_IDS.length, 13);
    for (const id of BAND2_IDS) {
      assert.ok(clueSceneFor(id), `${id} has a scene`);
    }
    assert.deepEqual(
      Object.keys(MATH_CLUE_SCENES).sort(),
      [...ALL_IDS, ...BAND2_IDS].sort(),
    );
    // The held 18+ item stays description-free.
    assert.equal(clueSceneFor("math-applied:measure:survey-check"), null);
  });

  it("never carries the answer before the pick", () => {
    for (const id of BAND2_IDS) {
      const description = clueSceneFor(id)!;
      const answer = MATH_ANSWERS[id]!;
      assert.ok(!/\d/.test(description.labelSetup), `${id}: setup label has no digits`);
      assert.ok(!/\d/.test(description.labelSolved), `${id}: solved label has no digits`);
      for (const choice of answer.choices) {
        assert.ok(
          !new RegExp(`\\b${choice.replace(".", "\\.")}\\b`).test(description.labelSetup),
          `${id}: setup label must not contain the choice ${choice}`,
        );
      }
      // Givens are the question's own numbers; the answer value is
      // never one of them — except the accuracy item's
      // rounding-line, whose low hundredth is the rounded value by
      // construction (documented above; the scene marks no nearer
      // end before the pick).
      if (description.kind !== "rounding-line" && answer.value !== undefined) {
        assert.ok(
          !givensOf(description).includes(answer.value),
          `${id}: answer value is not a scene given`,
        );
      }
    }
  });

  it("the solved beat's arithmetic lands on the item's answer", () => {
    for (const id of BAND2_IDS) {
      const d = clueSceneFor(id)!;
      const value = MATH_ANSWERS[id]!.value;
      switch (d.kind) {
        case "array-grid":
          assert.equal(d.rows * d.perRow, value, id);
          assert.equal(d.splitHigh + d.splitLow, d.perRow, id);
          break;
        case "scale-line":
          assert.equal(d.kilometres * d.metresPerKm, value, id);
          break;
        case "percent-bar":
          assert.equal(d.total - (d.total * d.percentOff) / 100, value, id);
          break;
        case "map-scale":
          assert.equal(d.mapCm * d.kmPerCm, value, id);
          break;
        case "chunk-share": {
          const plan = chunkPlan(d);
          assert.deepEqual(plan, [100, 50, 6], id);
          assert.equal(plan.reduce((a, b) => a + b, 0), d.total / d.shares, id);
          assert.equal(d.total / d.shares, value, id);
          break;
        }
        case "fraction-bar":
          assert.equal(d.numerator / d.denominator / 2, value, id);
          break;
        case "fraction-measure":
          assert.equal(d.total / (d.pieceNumerator / d.pieceDenominator), value, id);
          break;
        case "rounding-line":
          assert.equal(d.value - d.low < d.high - d.value ? d.low : d.high, value, id);
          break;
        case "rate-bars":
          assert.equal(
            Math.min(d.firstCoins / d.firstMetres, d.secondCoins / d.secondMetres),
            value,
            id,
          );
          break;
        case "journey-line":
          if (d.hours !== undefined && d.targetKm !== undefined) {
            assert.equal(d.targetKm / (d.totalKm / d.hours), value, id);
          } else {
            assert.equal(d.totalKm - (d.aheadKm ?? 0), value, id);
          }
          break;
        case "spend-then-group":
          assert.equal((d.total - d.fixedCost) / d.perGroup, value, id);
          break;
        case "bearing-diagram":
          assert.equal(
            Math.round((Math.atan2(d.eastKm, d.northKm) * 180) / Math.PI),
            37,
            id,
          );
          assert.equal(MATH_ANSWERS[id]!.correct, "37°", id);
          break;
        default:
          assert.fail(`${id}: unexpected kind ${d.kind}`);
      }
    }
  });

  it("every wave-2 item carries a well-formed narrated summary", () => {
    for (const id of BAND2_IDS) {
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
      assert.ok(
        closing.includes(BAND2_CLOSING[id]!),
        `${id}: closing line states ${BAND2_CLOSING[id]}`,
      );
      let previousLine = -1;
      for (let step = 0; step < summaryStepCount(summary); step++) {
        const { line } = summaryStepLine(summary, step);
        assert.ok(line >= previousLine, `${id}: step ${step} never jumps backwards a line`);
        previousLine = line;
        const start = summaryStepStart(summary, step, 0.5);
        assert.ok(start >= (summary.lines[line]?.at ?? 0), `${id}: step ${step} starts inside its line`);
        assert.ok(start < summary.duration, `${id}: step ${step} starts before the clip ends`);
      }
    }
  });
});
