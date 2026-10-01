/**
 * Unit tests for scripts/enrich-wikipedia.mjs — the deterministic
 * history-hook extractor and its no-fabrication gate. No network: every test
 * feeds canned Wikipedia-style extracts.
 *
 * Run: node --test scripts/enrich-wikipedia.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeTitle,
  titlesMatch,
  splitSentences,
  stripParens,
  extractHookSentence,
  validateHistory,
  pickArticle,
  haversineKm,
  buildHistoryForCacheRec,
} from "./enrich-wikipedia.mjs";

describe("normalizeTitle", () => {
  it("drops parenthetical disambiguators and case", () => {
    assert.equal(normalizeTitle("Lancaster, Pennsylvania"), "lancaster, pennsylvania");
    assert.equal(normalizeTitle("Springfield (Illinois)"), "springfield");
    assert.equal(normalizeTitle("Fort_Worth"), "fort worth");
  });
});

describe("titlesMatch", () => {
  it("matches either direction after normalization", () => {
    assert.ok(titlesMatch("Edna, Texas", "Edna"));
    assert.ok(titlesMatch("Edna", "Edna"));
    assert.ok(titlesMatch("Auburn (Nebraska)", "Auburn"));
  });
  it("rejects outright different names", () => {
    // NOTE: "Lancaster, Pennsylvania" vs "Lancaster" matches by containment —
    // the 10 km geosearch radius is the real disambiguator; the title check
    // only rejects outright different names.
    assert.ok(titlesMatch("Lancaster, Pennsylvania", "Lancaster"));
    assert.ok(!titlesMatch("Springfield", "Riverside"));
    assert.ok(!titlesMatch("", "Edna"));
  });
});

describe("splitSentences", () => {
  it("splits on terminal punctuation", () => {
    const parts = splitSentences("Founded in 1854. It grew fast! Did it last? Yes.");
    assert.deepEqual(parts, ["Founded in 1854.", "It grew fast!", "Did it last?", "Yes."]);
  });
  it("does not split on abbreviations", () => {
    const parts = splitSentences(
      "It is most famous for the Mercedes-Benz U.S. International plant. It opened in 1997.",
    );
    assert.deepEqual(parts, [
      "It is most famous for the Mercedes-Benz U.S. International plant.",
      "It opened in 1997.",
    ]);
    assert.deepEqual(splitSentences("It was a stop on the St. Louis Railway. It grew."), [
      "It was a stop on the St. Louis Railway.",
      "It grew.",
    ]);
  });
});

describe("stripParens", () => {
  it("removes parenthesized spans", () => {
    assert.equal(stripParens("Edna (founded 1882) grew as a railroad town."), "Edna grew as a railroad town.");
  });
});

const EXTRACT_FOUNDED =
  "Edna is a city in Jackson County, Texas. It was founded in 1882 when the railroad arrived. " +
  "The town is named after a railroad official's daughter.";

describe("extractHookSentence", () => {
  it("prefers the strongest hook when several match", () => {
    // "named after a railroad official's daughter" (a person — rule 3)
    // outranks the plainer founding-date sentence.
    const r = extractHookSentence(EXTRACT_FOUNDED);
    assert.equal(r.sentence, "The town is named after a railroad official's daughter.");
  });
  it("finds naming hooks", () => {
    const r = extractHookSentence(
      "Auburn is a city in Nebraska. The town was named after Auburn, New York by early settlers.",
    );
    assert.equal(r.sentence, "The town was named after Auburn, New York by early settlers.");
  });
  it("finds birthplace/event hooks", () => {
    const r = extractHookSentence(
      "Greenfield is a town in Iowa. It is the birthplace of aviation pioneer Clyde Cessna.",
    );
    assert.ok(r.sentence.includes("birthplace"));
  });
  it("rejects bare date-only sentences with no story", () => {
    const r = extractHookSentence(
      "Odenville is a town in Alabama. It incorporated in 1914. It has a mayor.",
    );
    assert.equal(r.rejected, "no-hook-pattern");
  });
  it("accepts a date anchor that comes with a story", () => {
    const r = extractHookSentence(
      "Edna is a city in Texas. It was founded in 1882 when the railroad arrived.",
    );
    assert.equal(r.sentence, "It was founded in 1882 when the railroad arrived.");
  });
  it("accepts a date anchor with a proper noun", () => {
    const r = extractHookSentence(
      "Frisco is a city in Texas. It was founded in 1902 as a stop on the St. Louis–San Francisco Railway.",
    );
    assert.ok(r.sentence.includes("1902"));
  });
  it("no longer treats metro-stats as a hook", () => {
    const r = extractHookSentence(
      "Oxford is a city in Alabama. It is the largest city in Calhoun County by population.",
    );
    assert.equal(r.rejected, "no-hook-pattern");
  });
  it("rejects empty extracts", () => {
    assert.equal(extractHookSentence("").rejected, "empty-extract");
    assert.equal(extractHookSentence("   ").rejected, "empty-extract");
  });
  it("uses the definitional sentence only as a last resort", () => {
    const r = extractHookSentence("Montgomery is the capital of Alabama, founded in 1819.");
    assert.ok(r.sentence.includes("founded in 1819"));
  });
  it("strips parentheticals from the chosen sentence", () => {
    const r = extractHookSentence(
      "Edna is a city in Texas. It was founded in 1882 (as Macon Station) when the railroad arrived.",
    );
    assert.equal(r.sentence, "It was founded in 1882 when the railroad arrived.");
  });
});

describe("validateHistory", () => {
  const blurb = "Edna is a county seat in southeastern Texas, the United States.";
  it("accepts a clean hook sentence", () => {
    const v = validateHistory(
      "It was founded in 1882 when the railroad arrived.",
      EXTRACT_FOUNDED,
      blurb,
    );
    assert.deepEqual(v, []);
  });
  it("rejects fabricated words", () => {
    const v = validateHistory(
      "It was founded in 1882 by fearless astronauts.",
      EXTRACT_FOUNDED,
      blurb,
    );
    assert.ok(v.some((m) => m.startsWith("fabricated words")));
  });
  it("rejects coordinate/elevation filler", () => {
    assert.ok(
      validateHistory("It sits at 35° north of the plains.", EXTRACT_FOUNDED + " It sits at 35° north of the plains.", blurb).length > 0,
    );
    assert.ok(
      validateHistory(
        "It was founded in 1882 at an elevation of 500 meters above sea level.",
        EXTRACT_FOUNDED + " It was founded in 1882 at an elevation of 500 meters above sea level.",
        blurb,
      ).length > 0,
    );
  });
  it("rejects sentences that restate the geography blurb", () => {
    const v = validateHistory(
      "Edna is a county seat in southeastern Texas.",
      EXTRACT_FOUNDED + " Edna is a county seat in southeastern Texas.",
      blurb,
    );
    assert.ok(v.includes("restates-geography-blurb"));
  });
  it("rejects overlong sentences", () => {
    const long = "It was founded in 1882. ".repeat(20).trim();
    const v = validateHistory(long, EXTRACT_FOUNDED + " " + long, blurb);
    assert.ok(v.includes("too-long"));
  });
});

describe("pickArticle", () => {
  it("picks the title-matching page", () => {
    const pages = [{ title: "Jackson County, Texas" }, { title: "Edna, Texas" }];
    assert.equal(pickArticle(pages, "Edna").title, "Edna, Texas");
  });
  it("prefers the exact base-name match over a containment match", () => {
    const pages = [{ title: "Tuscumbia Historic District" }, { title: "Tuscumbia, Alabama" }];
    assert.equal(pickArticle(pages, "Tuscumbia").title, "Tuscumbia, Alabama");
  });
  it("returns null when nothing matches", () => {
    assert.equal(pickArticle([{ title: "Somewhere Else" }], "Edna"), null);
    assert.equal(pickArticle([], "Edna"), null);
  });
});

describe("haversineKm", () => {
  it("measures a known distance", () => {
    // Austin TX to San Antonio TX ≈ 120 km.
    const km = haversineKm(30.2672, -97.7431, 29.4241, -98.4936);
    assert.ok(km > 100 && km < 140, `got ${km}`);
  });
});

describe("buildHistoryForCacheRec", () => {
  it("builds a wiki slug with underscores", () => {
    const place = { blurb: "Edna is a county seat in southeastern Texas, the United States." };
    const built = buildHistoryForCacheRec(
      { status: "matched", title: "Edna, Texas", extract: EXTRACT_FOUNDED },
      place,
    );
    assert.equal(built.wiki, "Edna,_Texas");
    assert.ok(built.history.includes("named after a railroad official's daughter"));
  });
  it("skips non-matched records with the reason", () => {
    const built = buildHistoryForCacheRec({ status: "no-article" }, { blurb: "x" });
    assert.equal(built.skipped, "no-article");
  });
});
