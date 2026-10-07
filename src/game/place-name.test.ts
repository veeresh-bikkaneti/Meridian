import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  anchorTail,
  nameTier,
  recognizedCountryCountForTests,
  refineDisplayString,
} from "./place-name.ts";

// Cartographer's Plate PR2 — the name-tier mechanism (spec §2) is the
// React→CSS bridge: thresholds on name.length, unit-tested at the
// 26/27 and 60/61 boundaries.
describe("place-name — nameTier boundaries", () => {
  it("short: ≤ 26 chars (boundary 26/27)", () => {
    assert.equal(nameTier("x".repeat(26)), "short");
    assert.equal(nameTier("x".repeat(25)), "short");
    assert.equal(nameTier("Lincoln"), "short"); // 7 chars — the shortest fixture
  });

  it("medium: 27–60 chars (boundaries 26/27 and 60/61)", () => {
    assert.equal(nameTier("x".repeat(27)), "medium");
    assert.equal(nameTier("x".repeat(60)), "medium");
    assert.equal(
      nameTier("Valle Huejúcar (Fraccionamiento Popular) [Fraccionamiento]"),
      "medium",
    ); // 58 chars
  });

  it("long: ≥ 61 chars (boundary 60/61)", () => {
    assert.equal(nameTier("x".repeat(61)), "long");
    assert.equal(
      nameTier(
        "United Townships Of Dysart Dudley Harcourt Guilford Harburn Bruton Havelock Eyre And Clyde, Canada",
      ),
      "long",
    ); // 98 chars — the worst case
  });

  it("tiers on the raw name length — display refinements are not counted", () => {
    // 23 raw chars with a slash gain a ZWSP in the display string, but the
    // tier must not shift: "Diamond Head / Kapahulu" is 23 chars → short.
    const raw = "Diamond Head / Kapahulu";
    assert.equal(raw.length, 23);
    assert.equal(nameTier(raw), "short");
    assert.ok(refineDisplayString(raw).length > raw.length);
  });
});

describe("place-name — refineDisplayString (spec §3)", () => {
  it("inserts a zero-width space after /, –, -", () => {
    assert.equal(
      refineDisplayString("Diamond Head / Kapahulu / Saint Louis Heights"),
      "Diamond Head /\u200B Kapahulu /\u200B Saint Louis Heights",
    );
    assert.equal(
      refineDisplayString("Rivière-des-Prairies–Pointe-aux-Trembles"),
      "Rivière-\u200Bdes-\u200BPrairies–\u200BPointe-\u200Baux-\u200BTrembles",
    );
    assert.equal(
      refineDisplayString("Borgoricco-San Michele delle Badesse-Sant'Eufemia"),
      "Borgoricco-\u200BSan Michele delle Badesse-\u200BSant'Eufemia",
    );
  });

  it("leaves names without break chars byte-identical (data is untouched)", () => {
    const name = "United Townships Of Dysart Dudley Harcourt Guilford Harburn Bruton Havelock Eyre And Clyde, Canada";
    assert.equal(refineDisplayString(name), name);
    assert.equal(refineDisplayString("Lincoln"), "Lincoln");
  });

  it("never touches apostrophes, quotes, parens, or diacritics", () => {
    assert.equal(
      refineDisplayString('Poselok Turisticheskogo pansionata "Klyazminskoe vodohranilische"'),
      'Poselok Turisticheskogo pansionata "Klyazminskoe vodohranilische"',
    );
    assert.equal(
      refineDisplayString("Masākin Shirkat Abū al Wafā lil Muqāwalāt wa al Istithmār al ‘Aqārī"),
      "Masākin Shirkat Abū al Wafā lil Muqāwalāt wa al Istithmār al ‘Aqārī",
    );
  });
});

describe("place-name — anchorTail (Veeresh's ratified decision 3, strict rule)", () => {
  it("yields a healthy country table from the CLDR region set", () => {
    // ~250 ISO regions; the loop names index alone has 235 country tails.
    assert.ok(recognizedCountryCountForTests() >= 200);
  });

  it("bolds the trailing ', Country' tail for recognized countries", () => {
    assert.deepEqual(anchorTail(
      "United Townships Of Dysart Dudley Harcourt Guilford Harburn Bruton Havelock Eyre And Clyde, Canada",
    ), {
      head: "United Townships Of Dysart Dudley Harcourt Guilford Harburn Bruton Havelock Eyre And Clyde",
      tail: ", Canada",
    });
    assert.deepEqual(anchorTail("Toronto, Canada"), {
      head: "Toronto",
      tail: ", Canada",
    });
    assert.deepEqual(
      anchorTail("Va Boston Healthcare System Brockton Campus, Massachusetts, United States"),
      {
        head: "Va Boston Healthcare System Brockton Campus, Massachusetts",
        tail: ", United States",
      },
    );
  });

  it("is case-insensitive on the country name", () => {
    assert.deepEqual(anchorTail("Toronto, canada"), {
      head: "Toronto",
      tail: ", canada",
    });
    assert.deepEqual(anchorTail("Toronto, CANADA"), {
      head: "Toronto",
      tail: ", CANADA",
    });
  });

  it("does NOT bold when the tail is not a country (strict rule)", () => {
    // Subdivision tails stay unbolded.
    assert.equal(anchorTail("Manhattan, Nebraska"), null);
    assert.equal(
      anchorTail("United Townships of Dysart, Dudley, Harcourt, Guilford, Harburn, Bruton, Havelock, Eyre and Clyde, Ontario"),
      null,
    );
    // No ", " separator at all.
    assert.equal(anchorTail("Rouffignac-Saint-Cernin-de-Reilhac"), null);
    assert.equal(anchorTail("Lincoln"), null);
    assert.equal(anchorTail("Diamond Head / Kapahulu / Saint Louis Heights"), null);
    // A country name NOT in tail position is not an anchor.
    assert.equal(anchorTail("Canada Town"), null);
  });

  it("matches only the LAST ', ' segment", () => {
    // "..., Massachusetts, United States" → tail is ", United States",
    // not ", Massachusetts, United States".
    const split = anchorTail("Springfield, Massachusetts, United States")!;
    assert.equal(split.tail, ", United States");
    assert.equal(split.head, "Springfield, Massachusetts");
  });
});
