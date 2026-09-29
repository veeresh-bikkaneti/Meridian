import assert from "node:assert/strict";
import test from "node:test";
import { rewriteStory } from "./rewrite.ts";

const authored = "The river meets the bluff. Barges still pass.";

test("rewrite only when Nano is already available and nothing is cached", async () => {
  const missed = await rewriteStory({
    placeId: "omaha",
    authored,
    cached: null,
    availability: "unavailable",
    ask: async () => {
      throw new Error("should not ask");
    },
  });
  assert.equal(missed.text, authored);
  assert.equal(missed.store, null);

  const kept = await rewriteStory({
    placeId: "omaha",
    authored,
    cached: "A shorter telling.",
    availability: "available",
    ask: async () => {
      throw new Error("should not ask");
    },
  });
  assert.equal(kept.text, "A shorter telling.");
  assert.equal(kept.store, null);

  const fresh = await rewriteStory({
    placeId: "omaha",
    authored,
    cached: null,
    availability: "available",
    ask: async () => "The river meets the bluff, and barges still pass.",
  });
  assert.equal(fresh.text, fresh.store);
  assert.equal(fresh.text, "The river meets the bluff, and barges still pass.");

  const junk = await rewriteStory({
    placeId: "omaha",
    authored,
    cached: null,
    availability: "available",
    ask: async () => "",
  });
  assert.equal(junk.text, authored);
  assert.equal(junk.store, null);

  const tooLong = await rewriteStory({
    placeId: "omaha",
    authored,
    cached: null,
    availability: "available",
    ask: async () => "One. Two. Three.",
  });
  assert.equal(tooLong.text, authored);
  assert.equal(tooLong.store, null);
});
