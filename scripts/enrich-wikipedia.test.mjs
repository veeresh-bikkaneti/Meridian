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
  splitSentences,
  stripParens,
  extractHookSentence,
  validateHistory,
  pickArticle,
  haversineKm,
  buildHistoryForCacheRec,
  isNetError,
  isDoneRecord,
  wikiSlug,
} from "./enrich-wikipedia.mjs";

describe("normalizeTitle", () => {
  it("drops parenthetical disambiguators and case", () => {
    assert.equal(normalizeTitle("Lancaster, Pennsylvania"), "lancaster, pennsylvania");
    assert.equal(normalizeTitle("Springfield (Illinois)"), "springfield");
    assert.equal(normalizeTitle("Fort_Worth"), "fort worth");
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
  it("prefers a historical hook over a modern-identity one", () => {
    const r = extractHookSentence(
      "Vance is a town in Alabama. It was founded in 1830 when settlers arrived. It is known for the Mercedes-Benz plant.",
    );
    assert.ok(r.sentence.includes("1830"), `picked: ${r.sentence ?? r.rejected}`);
  });
  it("still takes a modern hook when no history is present", () => {
    const r = extractHookSentence(
      "Vance is a town in Alabama. It is known for the Mercedes-Benz plant.",
    );
    assert.ok(r.sentence.includes("Mercedes-Benz"), `picked: ${r.sentence ?? r.rejected}`);
  });
  it("rejects violent hooks for a kids' game", () => {
    const r = extractHookSentence(
      "Tulsa is a city in Oklahoma. It was the site of the Tulsa race massacre in 1921. It was founded in 1836 by settlers.",
    );
    assert.ok(!r.sentence?.toLowerCase().includes("massacre"), `picked: ${r.sentence}`);
  });
  it("rejects pure-admin date anchors", () => {
    const r = extractHookSentence(
      "Springfield is a city in Illinois. It was incorporated in 1914 by the County Commission.",
    );
    assert.equal(r.rejected, "no-hook-pattern");
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
  it("rejects bare population stats", () => {
    const extract = EXTRACT_FOUNDED + " It is home to 50000 people.";
    assert.ok(
      validateHistory("It is home to 50000 people.", extract, blurb).length > 0,
      "bare headcount teaches nothing (rule 4)",
    );
    assert.ok(
      validateHistory("The population was 12,345 residents.", extract + " The population was 12,345 residents.", blurb).length > 0,
    );
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
  it("never borrows a county's history for a town", () => {
    assert.equal(pickArticle([{ title: "Jackson County, Texas" }], "Jackson"), null);
  });
  it("never borrows a university's history for its town", () => {
    assert.equal(pickArticle([{ title: "Auburn University" }], "Auburn"), null);
  });
  it("accepts parenthetical disambiguation", () => {
    assert.equal(
      pickArticle([{ title: "Auburn (Nebraska)" }], "Auburn").title,
      "Auburn (Nebraska)",
    );
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

describe("isNetError", () => {
  it("classifies undici fetch failures and aborts as network errors", () => {
    assert.equal(isNetError(new TypeError("fetch failed")), true);
    const abort = new Error("This operation was aborted");
    abort.name = "AbortError";
    assert.equal(isNetError(abort), true);
    assert.equal(isNetError(new Error("getaddrinfo EAI_AGAIN en.wikipedia.org")), true);
    assert.equal(isNetError(new Error("connect ECONNREFUSED 1.2.3.4:443")), true);
  });
  it("does not classify HTTP/application errors as network errors", () => {
    assert.equal(isNetError(new Error("wikipedia 429 for https://…")), false);
    assert.equal(isNetError(new Error("wikipedia 500 for https://…")), false);
    assert.equal(isNetError(new Error("no places file")), false);
  });
});

describe("runWorkerPool", () => {
  it("never exceeds the configured concurrency", async () => {
    const { runWorkerPool } = await import("./enrich-wikipedia.mjs");
    let live = 0;
    let maxLive = 0;
    const items = Array.from({ length: 50 }, (_, i) => i);
    await runWorkerPool(items, 3, async () => {
      live++;
      maxLive = Math.max(maxLive, live);
      await new Promise((r) => setTimeout(r, Math.random() * 10));
      live--;
    });
    assert.ok(maxLive <= 3, `max concurrency was ${maxLive}, want <= 3`);
    assert.ok(maxLive > 1, `expected some parallelism, got ${maxLive}`);
  });
  it("processes every item exactly once", async () => {
    const { runWorkerPool } = await import("./enrich-wikipedia.mjs");
    const seen = [];
    const items = Array.from({ length: 37 }, (_, i) => `p${i}`);
    await runWorkerPool(items, 4, async (item) => {
      await new Promise((r) => setTimeout(r, Math.random() * 5));
      seen.push(item);
    });
    assert.equal(seen.length, items.length);
    assert.deepEqual([...seen].sort(), [...items].sort());
  });
  it("a throwing task does not kill the pool or lose other items", async () => {
    const { runWorkerPool } = await import("./enrich-wikipedia.mjs");
    const seen = [];
    const items = [1, 2, 3, 4, 5];
    await assert.rejects(
      runWorkerPool(items, 2, async (item) => {
        if (item === 3) throw new Error("boom");
        seen.push(item);
      }),
      /boom/,
    );
    // The pool rejects on the first throw, like Promise.all — callers that
    // must not lose items catch per-item (cmdCrawl does).
    assert.ok(seen.length >= 1);
  });
});

describe("wikiSlug", () => {
  it("encodes titles into URL-safe Wikipedia slugs", () => {
    assert.equal(wikiSlug("Edna, Texas"), "Edna,_Texas");
    // Apostrophes stay raw, matching Wikipedia's own canonical URLs
    // (https://en.wikipedia.org/wiki/Coeur_d'Alene,_Idaho).
    assert.equal(wikiSlug("Coeur d'Alene, Idaho"), "Coeur_d'Alene,_Idaho");
    assert.equal(wikiSlug("Truth or Consequences, New Mexico"), "Truth_or_Consequences,_New_Mexico");
  });
});

describe("hook word boundaries (arch-M1)", () => {
  it("does not match 'named for' inside 'unnamed'", () => {
    const r = extractHookSentence("Oakdale is a town. The town was unnamed for decades after a dispute.");
    assert.equal(r.rejected, "no-hook-pattern");
  });
  it("does not match 'site of' inside 'website'", () => {
    const r = extractHookSentence("Oakdale is a town. The official website of the town lists annual events.");
    assert.equal(r.rejected, "no-hook-pattern");
  });
  it("does not match 'famous for' inside 'infamous'", () => {
    const r = extractHookSentence("Oakdale is a town. The town is infamous for its traffic jams.");
    assert.equal(r.rejected, "no-hook-pattern");
  });
  it("does not match 'settled' inside 'unsettled'", () => {
    const r = extractHookSentence("Oakdale is a town. The area was unsettled in the 1880s.");
    assert.equal(r.rejected, "no-hook-pattern");
  });
});

describe("date-anchor story guard (arch-M4)", () => {
  it("rejects a bare date plus state name", () => {
    const r = extractHookSentence(
      "Springfield is a city in Illinois. It was incorporated in 1914 in Alabama.",
      "Springfield",
    );
    assert.equal(r.rejected, "no-hook-pattern");
  });
  it("rejects a date anchored only by the place's own name", () => {
    const r = extractHookSentence(
      "Edna is a city in Texas. It was founded in 1882 in Edna.",
      "Edna",
    );
    assert.equal(r.rejected, "no-hook-pattern");
  });
  it("accepts a date anchored by a real person", () => {
    const r = extractHookSentence(
      "Oakdale is a town. It was founded in 1830 by John Smith.",
      "Oakdale",
    );
    assert.ok(r.sentence.includes("1830"), `picked: ${r.sentence ?? r.rejected}`);
  });
});

describe("isDoneRecord (arch-M5: the resume invariant)", () => {
  it("treats error records as not done", () => {
    assert.equal(isDoneRecord({ id: "gn-1", status: "error" }), false);
  });
  it("treats matched records as done", () => {
    assert.equal(isDoneRecord({ id: "gn-1", status: "matched" }), true);
  });
  it("treats terminal non-error statuses as done", () => {
    for (const s of ["no-article", "title-mismatch", "no-extract", "too-far"]) {
      assert.equal(isDoneRecord({ id: "gn-1", status: s }), true, s);
    }
  });
  it("rejects malformed records", () => {
    assert.equal(isDoneRecord(null), false);
    assert.equal(isDoneRecord({ status: "matched" }), false);
    assert.equal(isDoneRecord({ id: "gn-1" }), false);
  });
});

describe("stripParens (arch-m11)", () => {
  it("removes nested parens fully", () => {
    assert.equal(stripParens("X (a (b) c) grew."), "X grew.");
  });
});

describe("pickArticle disambiguation (arch-m13)", () => {
  it("accepts a geographic parenthetical disambiguation", () => {
    const pages = [{ title: "Auburn University" }, { title: "Auburn (Nebraska)" }];
    assert.equal(pickArticle(pages, "Auburn").title, "Auburn (Nebraska)");
  });
  it("rejects a non-geographic parenthetical", () => {
    const pages = [{ title: "Springfield (band)" }, { title: "Springfield (song)" }];
    assert.equal(pickArticle(pages, "Springfield"), null);
  });
  it("prefers the undisambiguated title over a parenthetical one", () => {
    const pages = [{ title: "Paris (France)" }, { title: "Paris, Texas" }];
    assert.equal(pickArticle(pages, "Paris").title, "Paris, Texas");
  });
  it("accepts a two-letter state code paren", () => {
    const pages = [{ title: "Jackson (MS)" }];
    assert.equal(pickArticle(pages, "Jackson").title, "Jackson (MS)");
  });
});

describe("validateHistory geography overlap (arch-M2)", () => {
  it("no longer rejects a founding story that shares the place name and state", () => {
    const v = validateHistory(
      "Edna was founded in 1882 in southeastern Texas.",
      "Edna was founded in 1882 in southeastern Texas. It is a city.",
      "Edna is a county seat in southeastern Texas, the United States.",
      "Edna",
    );
    assert.deepEqual(v, []);
  });
  it("still rejects a sentence that only restates geography", () => {
    const v = validateHistory(
      "Edna is in southeastern Texas.",
      "Edna is in southeastern Texas. It was founded in 1882.",
      "Edna is a county seat in southeastern Texas, the United States.",
      "Edna",
    );
    assert.ok(v.includes("restates-geography-blurb"), JSON.stringify(v));
  });
});
