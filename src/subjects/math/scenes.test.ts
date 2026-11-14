/**
 * Math clue scenes (pilot, feat/clue-scene-pilot) — the data-side
 * contract. The pilot covers exactly three items, ages 7-10; a
 * scene description carries only the givens from the item's own
 * question, so the setup film cannot give the answer away, and
 * the solved beat's arithmetic lands exactly on the item's answer.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MATH_CLUE_SCENES, clueSceneFor, countingTicks, dealOrder } from "./scenes.ts";
import { MATH_ANSWERS } from "./answers.ts";

const PILOT_IDS = [
  "math-number:groups:skip-count",
  "math-number:tables:facts",
  "math-number:division:fair-share",
] as const;

describe("clue scene descriptions", () => {
  it("covers exactly the three pilot items", () => {
    assert.deepEqual(Object.keys(MATH_CLUE_SCENES).sort(), [...PILOT_IDS].sort());
    for (const id of PILOT_IDS) {
      assert.ok(clueSceneFor(id), `${id} has a scene`);
    }
    // An item without a scene gets none — its clue card is unchanged.
    assert.equal(clueSceneFor("math-number:groups:equal-groups"), null);
    assert.equal(clueSceneFor("math-number:tables:buses"), null);
  });

  it("never carries the answer before the pick", () => {
    for (const id of PILOT_IDS) {
      const description = clueSceneFor(id)!;
      const answer = MATH_ANSWERS[id]!;
      // The setup label is the only text the setup phase shows, and
      // it carries no numbers at all (numbers live in the question).
      assert.ok(!/\d/.test(description.labelSetup), `${id}: setup label has no digits`);
      assert.ok(!/\d/.test(description.labelSolved), `${id}: solved label has no digits`);
      for (const choice of answer.choices) {
        assert.ok(
          !new RegExp(`\\b${choice.replace(".", "\\.")}\\b`).test(description.labelSetup),
          `${id}: setup label must not contain the choice ${choice}`,
        );
      }
      // The numeric givens are the question's own numbers; the
      // answer value is never one of them.
      const givens =
        description.kind === "coin-groups"
          ? [description.total, description.groupSize]
          : description.kind === "pencil-packs"
            ? [description.packs, description.perPack]
            : [description.total, description.friends];
      assert.ok(!givens.includes(answer.value!), `${id}: answer value is not a scene given`);
    }
  });

  it("the solved beat's arithmetic lands on the item's answer", () => {
    const coins = clueSceneFor("math-number:groups:skip-count")!;
    assert.equal(coins.kind, "coin-groups");
    if (coins.kind === "coin-groups") {
      assert.equal(coins.total / coins.groupSize, MATH_ANSWERS["math-number:groups:skip-count"]!.value);
    }
    const packs = clueSceneFor("math-number:tables:facts")!;
    assert.equal(packs.kind, "pencil-packs");
    if (packs.kind === "pencil-packs") {
      assert.equal(packs.packs * packs.perPack, MATH_ANSWERS["math-number:tables:facts"]!.value);
    }
    const share = clueSceneFor("math-number:division:fair-share")!;
    assert.equal(share.kind, "fair-share");
    if (share.kind === "fair-share") {
      assert.equal(share.total / share.friends, MATH_ANSWERS["math-number:division:fair-share"]!.value);
    }
  });

  it("a solved beat exists for each pilot item", () => {
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
  });
});
