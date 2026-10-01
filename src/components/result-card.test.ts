import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { splitLede } from "./story-lede.ts";

describe("splitLede — miss-card subscript contract", () => {
  it("splits the first sentence as the lede", () => {
    const [lede, rest] = splitLede(
      "Paris is the capital of France. It is known for the Eiffel Tower. Millions visit yearly.",
    );
    assert.equal(lede, "Paris is the capital of France.");
    assert.equal(
      rest,
      "It is known for the Eiffel Tower. Millions visit yearly.",
    );
  });

  it("the lede never appears in the rest (no duplication on the card)", () => {
    const story =
      "The Great Wall stretches over 13,000 miles. Built across dynasties, it defended China's northern border.";
    const [lede, rest] = splitLede(story);
    assert.ok(!rest.includes(lede), "lede must not repeat in the body");
    assert.equal(lede + " " + rest, story);
  });

  it("handles ? and ! as sentence terminators", () => {
    const [lede, rest] = splitLede("Is this the lede? Yes, the rest follows.");
    assert.equal(lede, "Is this the lede?");
    assert.equal(rest, "Yes, the rest follows.");
    const [lede2, rest2] = splitLede("Wow! Amazing place. Come visit.");
    assert.equal(lede2, "Wow!");
    assert.equal(rest2, "Amazing place. Come visit.");
  });

  it("a single-sentence story yields an empty rest", () => {
    const [lede, rest] = splitLede("Only one sentence here.");
    assert.equal(lede, "Only one sentence here.");
    assert.equal(rest, "");
  });

  it("text with no sentence terminator returns the whole text as lede", () => {
    const [lede, rest] = splitLede("No terminator at all");
    assert.equal(lede, "No terminator at all");
    assert.equal(rest, "");
  });

  it("trims whitespace around the split", () => {
    const [lede, rest] = splitLede("First.   Second with  spaces. ");
    assert.equal(lede, "First.");
    assert.equal(rest, "Second with  spaces.");
  });

  it("empty story yields empty lede and rest", () => {
    const [lede, rest] = splitLede("");
    assert.equal(lede, "");
    assert.equal(rest, "");
  });

  it("does not split on abbreviations like St.", () => {
    const [lede, rest] = splitLede("St. Petersburg was founded in 1703. It is beautiful.");
    assert.equal(lede, "St. Petersburg was founded in 1703.");
    assert.equal(rest, "It is beautiful.");
  });

  it("does not split on decimals like 3.5", () => {
    const [lede, rest] = splitLede("It is 3.5 km away. Nice view.");
    assert.equal(lede, "It is 3.5 km away.");
    assert.equal(rest, "Nice view.");
  });

  it("does not split on single-capital initials", () => {
    const [lede, rest] = splitLede("Founded by J. Smith in 1900. It grew fast.");
    assert.equal(lede, "Founded by J. Smith in 1900.");
    assert.equal(rest, "It grew fast.");
  });
});
