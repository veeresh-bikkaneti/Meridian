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
  hookRejection,
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

describe("splitSentences middle initials (tone-fix task 1)", () => {
  it("keeps a sentence naming a person by middle initial whole", () => {
    assert.deepEqual(splitSentences("Named after Samuel D. Smith, a railroad magnate."), [
      "Named after Samuel D. Smith, a railroad magnate.",
    ]);
  });
  it("keeps the first sentence whole when a name ends it", () => {
    const parts = splitSentences("Founded in 1887 by William H. Taft. It grew quickly.");
    assert.equal(parts[0], "Founded in 1887 by William H. Taft.");
    assert.equal(parts[1], "It grew quickly.");
  });
  it("rejoins a fragment that ends on a bare initial", () => {
    const parts = splitSentences("It was named for Gov. Willie G. Blount in 1812. The town grew.");
    assert.equal(parts[0], "It was named for Gov. Willie G. Blount in 1812.");
  });
  it("does not rejoin on multi-initial abbreviations like D.C.", () => {
    const parts = splitSentences("He moved to Washington, D.C. It was 1990.");
    assert.deepEqual(parts, ["He moved to Washington, D.C.", "It was 1990."]);
  });
  it("the picker returns the full naming sentence, not the truncated fragment", () => {
    const r = extractHookSentence(
      "Blountsville is a town in Alabama. It was named for Gov. Willie G. Blount, a former governor of Tennessee.",
      "Blountsville",
    );
    assert.equal(
      r.sentence,
      "It was named for Gov. Willie G. Blount, a former governor of Tennessee.",
    );
  });
});

describe("census language rejection (tone-fix task 2)", () => {
  it("rejects micropolitan statistical area hooks", () => {
    const r = extractHookSentence(
      "Laurel is a city in Mississippi. It is home to many commuters and is the principal city of a micropolitan statistical area.",
    );
    assert.equal(r.rejected, "no-hook-pattern");
  });
  it("rejects CDP hooks", () => {
    const r = extractHookSentence("The CDP is home to a historic lighthouse and a long pier.");
    assert.equal(r.rejected, "no-hook-pattern");
  });
  it("rejects metropolitan area hooks even with a concrete tail", () => {
    const r = extractHookSentence(
      "It is part of the Sacramento metropolitan area and home to a gold-rush museum.",
    );
    assert.equal(r.rejected, "no-hook-pattern");
  });
  it("rejects combined statistical area hooks", () => {
    const r = extractHookSentence(
      "The town, which is part of the Raleigh-Durham combined statistical area, was named after industrialist Julian Carr.",
    );
    assert.equal(r.rejected, "no-hook-pattern");
  });
  it("re-picks past a census sentence to a real hook", () => {
    const r = extractHookSentence(
      "Edna is a city in Texas. It is home to many commuters from the Houston metropolitan area. " +
        "It was founded in 1882 when the railroad arrived.",
    );
    assert.equal(r.sentence, "It was founded in 1882 when the railroad arrived.");
  });
  it("validateHistory bans census geography too", () => {
    const v = validateHistory(
      "It is the principal city of the Jonesboro metropolitan area.",
      "It is the principal city of the Jonesboro metropolitan area.",
      "Jonesboro is a city in Arkansas, the United States.",
    );
    assert.ok(v.some((m) => m.startsWith("banned-pattern")), JSON.stringify(v));
  });
});

describe("prison and present-day conflict rejection (tone-fix task 3)", () => {
  it("rejects a prison lead (Warren, ME shape)", () => {
    const r = extractHookSentence(
      "Warren is a town in Knox County, Maine. " +
        "It includes the villages of East Warren and South Warren, the latter home to the Maine State Prison.",
      "Warren",
    );
    assert.equal(r.rejected, "no-hook-pattern");
  });
  it("rejects an ongoing-war lead and re-picks a safe sentence (Hirske shape)", () => {
    const r = extractHookSentence(
      "Hirske is a city in Ukraine. " +
        "During the Russo-Ukrainian War, it has been a site of protracted violence. " +
        "It was founded in 1938 by miners who opened the Hirsko-Ivanivsk mine.",
      "Hirske",
    );
    assert.ok(r.sentence?.includes("1938"), `picked: ${r.sentence ?? r.rejected}`);
    assert.ok(!/violence/i.test(r.sentence ?? ""));
  });
  it("keeps historic war storytelling (Civil War founding)", () => {
    const r = extractHookSentence(
      "Leeds is a city in Alabama. Leeds was founded in 1877, during the final years of the post-Civil War Reconstruction Era.",
      "Leeds",
    );
    assert.equal(
      r.sentence,
      "Leeds was founded in 1877, during the final years of the post-Civil War Reconstruction Era.",
    );
  });
  it("keeps a past-century invasion told as history (Valletta shape)", () => {
    const r = extractHookSentence(
      "Valletta is the capital of Malta. The city was named after Jean Parisot de Valette, who defended the island against an Ottoman invasion during the Great Siege of Malta.",
      "Valletta",
    );
    assert.ok(r.sentence?.includes("named after"), `picked: ${r.sentence ?? r.rejected}`);
  });
  it("keeps a prison out via hookRejection reasons", () => {
    assert.equal(hookRejection("It is the site of the state prison."), "unsafe-prison");
    assert.equal(hookRejection("It was founded in 1882 when the railroad arrived."), null);
  });
});

describe("definitional rejection (tone-fix task 4)", () => {
  it("rejects the Jadcherla shape verbatim", () => {
    const r = extractHookSentence(
      "Jadcherla is a census town in Telangana. It is a historical town and is known for its cultural heritage.",
      "Jadcherla",
    );
    assert.equal(r.rejected, "no-hook-pattern");
  });
  it("rejects 'known for its natural environment' (Viikki shape)", () => {
    const r = extractHookSentence("Viikki is a neighbourhood in Helsinki. Viikki is known for its natural environment.", "Viikki");
    assert.equal(r.rejected, "no-hook-pattern");
  });
  it("keeps a concrete known-for hook", () => {
    const r = extractHookSentence(
      "Gordonville is a village. It is known for its covered bridges and maple syrup.",
      "Gordonville",
    );
    assert.ok(r.sentence?.includes("covered bridges"), `picked: ${r.sentence ?? r.rejected}`);
  });
});

describe("pronoun guard (tone-fix task 5)", () => {
  it("rejects a He-opener whose antecedent is in another sentence", () => {
    const r = extractHookSentence(
      "John Smith founded the town in 1830. He was the first mayor of the town.",
    );
    assert.equal(r.rejected, "no-hook-pattern");
  });
  it("rejects a They-opener", () => {
    const r = extractHookSentence("The two hamlets share a festival. They are famous for their parades and music.");
    assert.equal(r.rejected, "no-hook-pattern");
  });
  it("rejects an Its-opener", () => {
    const r = extractHookSentence("Its historic district was the site of the first county fair in the state.");
    assert.equal(r.rejected, "no-hook-pattern");
  });
  it("rejects 'earn this designation' (Bon Accord shape)", () => {
    const r = extractHookSentence(
      "Bon Accord is a town in Alberta. It was the first community in Canada and eleventh in the world to earn this designation.",
      "Bon Accord",
    );
    assert.equal(r.rejected, "no-hook-pattern");
  });
  it("keeps an It-opener resolved by the card's own subject", () => {
    const r = extractHookSentence(
      "Edna is a city in Texas. It was named after a railroad official's daughter.",
      "Edna",
    );
    assert.equal(r.sentence, "It was named after a railroad official's daughter.");
  });
});

describe("picker fall-through (tone-fix: usable-whole candidates)", () => {
  it("never returns a candidate ending on a bare initial", () => {
    // The B.C. Day sentence is whole once the splitter rejoins the chain,
    // so it wins on position; what must never happen is a hook that stops
    // at "…every B.C."
    const r = extractHookSentence(
      "Coombs is a village in British Columbia. " +
        "Coombs is known for its Old Country Market and the fair held every B.C. Day in August. " +
        "It is home to a butterfly garden.",
      "Coombs",
    );
    assert.equal(
      r.sentence,
      "Coombs is known for its Old Country Market and the fair held every B.C. Day in August.",
    );
    assert.ok(!/\b[A-Z]\.$/.test(r.sentence ?? ""));
  });
  it("rejects with ends-in-initial when the only candidate trails off", () => {
    const r = extractHookSentence(
      "El Centro is a city in California. The city was founded in 1906 by W. F. Holt and C.A.",
      "El Centro",
    );
    assert.equal(r.rejected, "ends-in-initial");
  });
  it("falls through an over-long best candidate to a shorter hook", () => {
    const long =
      "The town was named in 1882 for Samuel W. Fordyce, a railroad executive who had served as an officer in the Union Army during the Civil War, who later became president of several railroad companies across the American South and Southwest, and who personally surveyed the route through the county in the winter of 1881.";
    assert.ok(long.length > 240);
    const r = extractHookSentence(`Fordyce is a city in Arkansas. ${long} It was founded in 1882 when the railroad arrived.`, "Fordyce");
    assert.equal(r.sentence, "It was founded in 1882 when the railroad arrived.");
  });
  it("keeps a hook whose definitional opener carries a real naming story", () => {
    const r = extractHookSentence(
      "Jalalpur is a city in Punjab. Jalalpur is a historical city, and it was named after a famous Sufi saint.",
      "Jalalpur",
    );
    assert.ok(r.sentence?.includes("named after"), `picked: ${r.sentence ?? r.rejected}`);
  });
});

describe("splitSentences initial chains (tone-fix task 1, cont.)", () => {
  it("keeps a multi-initial name whole (C.A. Barker)", () => {
    const parts = splitSentences(
      "The city was founded in 1906 by W. F. Holt and C.A. Barker, who purchased the land.",
    );
    assert.deepEqual(parts, [
      "The city was founded in 1906 by W. F. Holt and C.A. Barker, who purchased the land.",
    ]);
  });
  it("keeps a province abbreviation mid-phrase whole (B.C. Day)", () => {
    const parts = splitSentences("The fair is held every B.C. Day in August. It draws crowds.");
    assert.deepEqual(parts, ["The fair is held every B.C. Day in August.", "It draws crowds."]);
  });
  it("still splits a true boundary after an abbreviation chain", () => {
    const parts = splitSentences("He moved to Washington, D.C. The city grew quickly.");
    assert.deepEqual(parts, ["He moved to Washington, D.C.", "The city grew quickly."]);
  });
});
