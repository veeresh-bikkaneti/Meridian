import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { numberWord } from "./number-words.ts";

describe("numberWord (bug 10 residue: guess copy derives from the cap)", () => {
  it("spells every cap the deal config can produce", () => {
    // The band table deals guess caps of 5 and 6 today; a resumed
    // case can carry its dealing band's cap. None may fall back to
    // digits or a hardcoded word.
    assert.equal(numberWord(5), "Five");
    assert.equal(numberWord(6), "Six");
  });

  it("spells the full small-count table", () => {
    const words = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
    words.forEach((word, n) => assert.equal(numberWord(n), word));
  });

  it("falls back to digits outside the table, never a wrong word", () => {
    assert.equal(numberWord(13), "13");
    assert.equal(numberWord(-1), "-1");
  });
});
