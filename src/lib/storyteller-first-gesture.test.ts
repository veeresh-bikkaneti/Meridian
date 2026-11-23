import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decideFirstGesture } from "./storyteller-first-gesture.ts";
import { decideFirstGesture as viaGuards } from "../components/storyteller-audio-guards.ts";

describe("storyteller-first-gesture (extracted to lib)", () => {
  it("the guards file re-exports the same function", () => {
    assert.equal(viaGuards, decideFirstGesture);
  });
  it("decision table is unchanged", () => {
    assert.equal(decideFirstGesture({ alreadyDone: true, dismissed: false, celebrationActive: false, soundOn: true }), "ignore");
    assert.equal(decideFirstGesture({ alreadyDone: false, dismissed: false, celebrationActive: true, soundOn: true }), "ignore");
    assert.equal(decideFirstGesture({ alreadyDone: false, dismissed: false, celebrationActive: false, soundOn: false }), "keep-armed");
    assert.equal(decideFirstGesture({ alreadyDone: false, dismissed: false, celebrationActive: false, soundOn: true }), "consume");
  });
});
