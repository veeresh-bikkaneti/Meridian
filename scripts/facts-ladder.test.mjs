/**
 * facts-ladder.test.mjs — unit tests for the Phase 2 fact ladder.
 *
 * Precedence ordering, composition formats, source attribution, and
 * validator rejection of bad composes. No network: all inputs are fixtures.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseWikidataYear,
  pickWikidataParts,
  composeWikidataFact,
  buildValidatedFact,
  factForPlace,
  wikidataRung,
  wikitextRung,
  eb1911Rung,
  hookRung,
  factAttribution,
  withFact,
  indexWikidata,
  indexQidJoin,
} from "./facts-ladder.mjs";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const wdRec = (over) => ({
  qid: "Q1",
  geonamesId: null,
  property: "P138",
  valueLabel: "King Louis XVI of France",
  valueQid: "Q7732",
  rawValue: "http://www.wikidata.org/entity/Q7732",
  qualifiers: [],
  hasReference: true,
  retrievedAt: "2026-10-02T00:00:00.000Z",
  ...over,
});

const p571 = (year, qualifiers = []) =>
  wdRec({
    property: "P571",
    valueLabel: `${year}-01-01T00:00:00Z`,
    valueQid: null,
    rawValue: `${year}-01-01T00:00:00Z`,
    qualifiers,
  });

const place = (over = {}) => ({
  id: "gn-1",
  name: "Louisville",
  lon: -85.7,
  lat: 38.2,
  blurb: "Louisville is a city in Kentucky, the United States.",
  wiki: "Louisville,_Kentucky",
  iso2: "US",
  edition: "state",
  regionId: "kentucky",
  ...over,
});

const fullInputs = () => ({
  qidByGeonames: new Map([["gn-1", "Q1"]]),
  wikidataByQid: new Map([
    ["Q1", [wdRec(), p571("1786")]],
  ]),
  wikiTextByGeonames: new Map([
    ["gn-1", [{ factType: "named_after", person: "King Louis XVI", year: null, sentence: "The city was named after King Louis XVI of France." }]],
  ]),
  eb1911ByGeonames: new Map([
    ["gn-1", [{ sentence: "Louisville was founded in 1778 by George Rogers Clark.", sourceUrl: "https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica/Louisville", needsReview: false }]],
  ]),
});

// ---------------------------------------------------------------------------
// Precedence
// ---------------------------------------------------------------------------

test("ladder precedence: wikidata beats wikitext beats eb1911 beats hook", () => {
  const p = place({ history: "The city was named after King Louis XVI." });
  const r = factForPlace(p, fullInputs());
  assert.equal(r.rung, "wikidata");
  assert.equal(r.fact.kind, "wikidata");
  assert.equal(r.fact.text, "Founded in 1786 and named after King Louis XVI of France.");
});

test("ladder precedence: without a qid, wikitext wins", () => {
  const p = place({ history: "The city was named after King Louis XVI." });
  const inputs = fullInputs();
  inputs.qidByGeonames = new Map();
  const r = factForPlace(p, inputs);
  assert.equal(r.rung, "wikitext");
  assert.equal(r.fact.text, "The city was named after King Louis XVI of France.");
});

test("ladder precedence: without wikitext, eb1911 wins", () => {
  const p = place({ history: "The city was named after King Louis XVI." });
  const inputs = fullInputs();
  inputs.qidByGeonames = new Map();
  inputs.wikiTextByGeonames = new Map();
  const r = factForPlace(p, inputs);
  assert.equal(r.rung, "eb1911");
  assert.equal(r.fact.text, "Louisville was founded in 1778 by George Rogers Clark.");
  assert.equal(r.fact.href, "https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica/Louisville");
});

test("ladder precedence: hook is the fallback before the bare blurb", () => {
  const p = place({ history: "The city was named after King Louis XVI." });
  const inputs = { qidByGeonames: new Map(), wikidataByQid: new Map(), wikiTextByGeonames: new Map(), eb1911ByGeonames: new Map() };
  const r = factForPlace(p, inputs);
  assert.equal(r.rung, "hook");
  assert.equal(r.fact.kind, "hook");
  assert.equal(r.fact.text, "The city was named after King Louis XVI.");
});

test("ladder precedence: nothing above the blurb -> no fact field", () => {
  const p = place();
  delete p.history;
  const inputs = { qidByGeonames: new Map(), wikidataByQid: new Map(), wikiTextByGeonames: new Map(), eb1911ByGeonames: new Map() };
  const r = factForPlace(p, inputs);
  assert.equal(r.fact, null);
  assert.equal(r.rung, "none");
});

// ---------------------------------------------------------------------------
// Wikidata composition formats
// ---------------------------------------------------------------------------

test("compose: named_after + inception -> one story sentence", () => {
  const c = composeWikidataFact("King Louis XVI of France", 1786);
  assert.equal(c.text, "Founded in 1786 and named after King Louis XVI of France.");
});

test("compose: named_after alone", () => {
  const c = composeWikidataFact("King Louis XVI of France", null);
  assert.equal(c.text, "Named after King Louis XVI of France.");
});

test("compose: year alone is a date anchor, not a story", () => {
  assert.equal(composeWikidataFact(null, 1786), null);
  const r = wikidataRung(place(), {
    qidByGeonames: new Map([["gn-1", "Q1"]]),
    wikidataByQid: new Map([["Q1", [p571("1786")]]]),
  });
  assert.equal(r.fact, null);
  assert.ok(r.notes.includes("year-only-dropped"));
});

test("unreferenced statements are never facts", () => {
  const rows = [wdRec({ hasReference: false }), p571("1786", [])].map((r) => ({ ...r, hasReference: r.property === "P571" }));
  const byQid = indexWikidata(rows);
  assert.equal(byQid.get("Q1").length, 1); // only the referenced P571 survives
  assert.equal(byQid.get("Q1")[0].property, "P571");
});

test("attestation qualifiers drop the year (P571 drift guard)", () => {
  const recs = [
    wdRec(),
    p571("1200", [{ property: "P1480", value: "no later than", valueQid: null }]),
  ];
  const { person, year, notes } = pickWikidataParts(place(), recs);
  assert.equal(person, "King Louis XVI of France");
  assert.equal(year, null);
  assert.ok(notes.some((n) => n.startsWith("p571-attestation-dropped")));
  // ...so the compose is the person-only template, not "Founded in 641".
  const c = composeWikidataFact(person, year);
  assert.equal(c.text, "Named after King Louis XVI of France.");
});

test("hedged inception years are dropped, not silently de-hedged", () => {
  const recs = [wdRec(), p571("1786", [{ property: "P1480", value: "circa", valueQid: null }])];
  const { year, notes } = pickWikidataParts(place(), recs);
  assert.equal(year, null);
  assert.ok(notes.some((n) => n.startsWith("p571-hedged-dropped")));
});

test("self-named honorees are rejected", () => {
  const recs = [wdRec({ valueLabel: "Louisville", valueQid: null })];
  const { person, notes } = pickWikidataParts(place({ name: "Louisville" }), recs);
  assert.equal(person, null);
  assert.ok(notes.some((n) => n.startsWith("p138-self-name")));
});

test("parseWikidataYear rejects junk and out-of-range years", () => {
  assert.equal(parseWikidataYear("1786-01-01T00:00:00Z"), 1786);
  assert.equal(parseWikidataYear("0641-01-01T00:00:00Z"), null); // < 1000
  assert.equal(parseWikidataYear("not-a-date"), null);
  assert.equal(parseWikidataYear(null), null);
});

test("qid-join index keeps only real joins", () => {
  const m = indexQidJoin([
    { geonamesId: "gn-1", qid: "Q1", method: "slug" },
    { geonamesId: "gn-2", qid: null, method: "unmatched" },
  ]);
  assert.equal(m.get("gn-1"), "Q1");
  assert.equal(m.has("gn-2"), false);
});

// ---------------------------------------------------------------------------
// Source attribution
// ---------------------------------------------------------------------------

test("attribution per fact kind", () => {
  assert.deepEqual(
    factAttribution({ kind: "wikidata", qid: "Q60" }),
    { label: "Wikidata", href: "https://www.wikidata.org/wiki/Q60" },
  );
  assert.deepEqual(
    factAttribution({ kind: "eb1911", href: "https://en.wikisource.org/wiki/X" }),
    { label: "EB1911", href: "https://en.wikisource.org/wiki/X" },
  );
  assert.deepEqual(
    factAttribution({ kind: "wikitext" }, "Louisville,_Kentucky"),
    { label: "GeoNames · Wikipedia", href: "https://en.wikipedia.org/wiki/Louisville,_Kentucky" },
  );
  assert.deepEqual(
    factAttribution({ kind: "hook" }, "Louisville,_Kentucky"),
    { label: "GeoNames · Wikipedia", href: "https://en.wikipedia.org/wiki/Louisville,_Kentucky" },
  );
});

// ---------------------------------------------------------------------------
// Validator rejection of bad composes
// ---------------------------------------------------------------------------

test("validator rejects a too-long wikitext sentence; place falls to hook", () => {
  const long = "The city was named after King Louis XVI of France, " + "and then many more words were added to pad it out ".repeat(6) + "end.";
  assert.ok(long.length > 240);
  const p = place({ history: "The city was named after King Louis XVI." });
  const inputs = {
    qidByGeonames: new Map(),
    wikidataByQid: new Map(),
    wikiTextByGeonames: new Map([
      ["gn-1", [{ factType: "named_after", person: "King Louis XVI", year: null, sentence: long }]],
    ]),
    eb1911ByGeonames: new Map(),
  };
  const r = factForPlace(p, inputs);
  assert.equal(r.rung, "hook"); // wikitext rung failed loudly, hook caught it
  const wtTrace = r.trace.find((t) => t.rung === "wikitext");
  assert.equal(wtTrace.reason, "validator-rejected");
  assert.ok(wtTrace.rejected[0].violations.some((v) => v === "too-long"));
});

test("validator rejects a smuggled scope word in a compose", () => {
  const draft = { factType: "named_after", person: "Lewis", year: null, sentence: "Named after explorer Lewis." };
  const built = buildValidatedFact("wikidata", "Wikidata", draft, "Not named after explorer Lewis.");
  assert.equal(built.ok, false);
  assert.ok(built.violations.some((v) => v.startsWith("smuggled-scope-word")));
});

test("validator rejects a named-after inversion", () => {
  const draft = { factType: "named_after", person: "Lewis", year: null, sentence: "The town was named after explorer Lewis." };
  const built = buildValidatedFact("wikitext", "Wikipedia", draft, "Explorer Lewis named the town after himself.");
  assert.equal(built.ok, false);
  assert.ok(built.violations.includes("named-after-inversion"));
});

test("validator rejects date-predicate drift (mentioned -> founded)", () => {
  const draft = {
    factType: "founded",
    person: null,
    year: 1234,
    sentence: "The village was first mentioned in 1234.",
  };
  const built = buildValidatedFact("wikitext", "Wikipedia", draft, "The village was founded in 1234.");
  assert.equal(built.ok, false);
  assert.ok(built.violations.includes("date-predicate-drift"));
});

test("eb1911 rung tries the next sentence when one fails validation", () => {
  const bad = "x".repeat(300);
  const good = "The town was founded in 1204 by King John.";
  const inputs = {
    eb1911ByGeonames: new Map([
      ["gn-1", [
        { sentence: bad, sourceUrl: "https://en.wikisource.org/wiki/Bad", needsReview: false },
        { sentence: good, sourceUrl: "https://en.wikisource.org/wiki/Good", needsReview: false },
      ]],
    ]),
  };
  const r = eb1911Rung(place(), inputs);
  assert.equal(r.fact.text, good);
  assert.equal(r.fact.href, "https://en.wikisource.org/wiki/Good");
});

// ---------------------------------------------------------------------------
// Chunk merge helpers
// ---------------------------------------------------------------------------

test("withFact inserts the fact after history (or blurb)", () => {
  const fact = { text: "Named after X.", kind: "hook", source: "Wikipedia" };
  const a = withFact({ id: "1", blurb: "b", history: "h", iso2: "US" }, fact);
  assert.deepEqual(Object.keys(a), ["id", "blurb", "history", "fact", "iso2"]);
  const b = withFact({ id: "1", blurb: "b", iso2: "US" }, fact);
  assert.deepEqual(Object.keys(b), ["id", "blurb", "fact", "iso2"]);
});

test("wikitext rung falls back to the fact's source article when the chunk has no wiki slug", () => {
  const p = place();
  delete p.wiki;
  const mkInputs = (facts) => ({
    qidByGeonames: new Map(),
    wikidataByQid: new Map(),
    wikiTextByGeonames: new Map([["gn-1", facts]]),
    eb1911ByGeonames: new Map(),
  });
  // With a sourceSlug, the fact is kept and attributed to its article.
  const r1 = wikitextRung(
    p,
    mkInputs([{ factType: "named_after", person: "X", year: null, sentence: "The town was named after explorer X.", sourceSlug: "Some_Town" }]),
  );
  assert.equal(r1.fact.text, "The town was named after explorer X.");
  assert.equal(r1.fact.href, "https://en.wikipedia.org/wiki/Some_Town");
  // With neither a wiki slug nor a sourceSlug, the rung is skipped loudly.
  const r2 = wikitextRung(
    p,
    mkInputs([{ factType: "named_after", person: "X", year: null, sentence: "The town was named after explorer X." }]),
  );
  assert.equal(r2.fact, null);
  assert.equal(r2.reason, "no-wiki-slug");
});

test("attribution prefers the wikitext fact's own href when present", () => {
  assert.deepEqual(
    factAttribution({ kind: "wikitext", href: "https://en.wikipedia.org/wiki/Some_Town" }, undefined),
    { label: "GeoNames · Wikipedia", href: "https://en.wikipedia.org/wiki/Some_Town" },
  );
});
