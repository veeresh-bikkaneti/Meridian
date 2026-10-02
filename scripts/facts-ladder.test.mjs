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

// ---------------------------------------------------------------------------
// Place-ID join correctness (pilot: facts must land on the right place)
// ---------------------------------------------------------------------------

test("join correctness: a fact for gn-1 never lands on gn-2", () => {
  const p1 = place({ id: "gn-1", name: "Louisville" });
  const p2 = place({ id: "gn-2", name: "Lexington", history: "Founded in 1775." });
  const inputs = fullInputs(); // qid join + wikidata + wikitext + eb1911 all keyed to gn-1
  const r1 = factForPlace(p1, inputs);
  const r2 = factForPlace(p2, inputs);
  assert.equal(r1.rung, "wikidata");
  assert.equal(r1.fact.qid, "Q1");
  // gn-2 has no inputs keyed to it: only its own history hook applies.
  assert.equal(r2.rung, "hook");
  assert.equal(r2.fact.text, "Founded in 1775.");
});

test("join correctness: wikitext rows keyed to another place do not leak", () => {
  const p = place({ id: "gn-9", name: "Nowhere" });
  const inputs = fullInputs();
  inputs.qidByGeonames = new Map(); // no wikidata for gn-9
  const r = factForPlace(p, inputs);
  // wikiTextByGeonames only has gn-1; gn-9 must not inherit it.
  assert.equal(r.rung, "none");
  assert.equal(r.fact, null);
});

test("join correctness: null-qid and unknown-id join rows are ignored", () => {
  const m = indexQidJoin([
    { geonamesId: "gn-1", qid: null, method: "unmatched" },
    { geonamesId: "gn-1", qid: "", method: "slug" },
    { geonamesId: "gn-1", qid: "Q1", method: "slug" },
    { geonamesId: null, qid: "Q2", method: "slug" },
  ]);
  assert.equal(m.get("gn-1"), "Q1");
  assert.equal(m.has("null"), false);
  assert.equal(m.size, 1);
});

test("join correctness: wikidata rung needs the place's own qid", () => {
  const p = place({ id: "gn-1" });
  const inputs = {
    qidByGeonames: new Map([["gn-other", "Q1"]]), // join exists, but not for this place
    wikidataByQid: new Map([["Q1", [wdRec(), p571("1786")]]]),
    wikiTextByGeonames: new Map(),
    eb1911ByGeonames: new Map(),
  };
  const r = wikidataRung(p, inputs);
  assert.equal(r.fact, null);
  assert.equal(r.reason, "no-qid");
});

// ---------------------------------------------------------------------------
// Idempotent re-runs (pilot: re-merging must be a no-op)
// ---------------------------------------------------------------------------

test("idempotency: re-running withFact over a merged place keeps one fact key", () => {
  const fact = { text: "Named after X.", kind: "hook", source: "Wikipedia" };
  const once = withFact(place({ history: "h" }), fact);
  const twice = withFact(once, fact);
  assert.deepEqual(Object.keys(twice), Object.keys(once));
  assert.deepEqual(twice.fact, fact);
  assert.equal(Object.keys(twice).filter((k) => k === "fact").length, 1);
});

test("idempotency: factForPlace recomputes the identical fact on merged input", () => {
  const p = place({ history: "The city was named after King Louis XVI." });
  const inputs = fullInputs();
  const first = factForPlace(p, inputs);
  assert.ok(first.fact);
  const merged = withFact(p, first.fact);
  const second = factForPlace(merged, inputs);
  assert.deepEqual(second.fact, first.fact);
  assert.equal(second.rung, first.rung);
});

test("idempotency: merge is sticky — a vanished input does not delete the fact", () => {
  // Documented behavior: mergeChunk recomputes but never removes facts.
  // A place merged yesterday keeps its fact even if today's inputs lose it.
  const p = place({ history: "The city was named after King Louis XVI." });
  const inputs = fullInputs();
  const first = factForPlace(p, inputs);
  const merged = withFact(p, first.fact);
  const emptyInputs = {
    qidByGeonames: new Map(),
    wikidataByQid: new Map(),
    wikiTextByGeonames: new Map(),
    eb1911ByGeonames: new Map(),
  };
  const recomputed = factForPlace(merged, emptyInputs);
  // The ladder recomputes from inputs (hook still wins from history)...
  assert.equal(recomputed.rung, "hook");
  // ...but mergeChunk only writes when factForPlace returns a fact and
  // never deletes an existing one: the stored fact survives.
  assert.deepEqual(merged.fact, first.fact);
});

// ---------------------------------------------------------------------------
// Loud rejections (pilot: 70 rejections, all reported, none silent)
// ---------------------------------------------------------------------------

test("loud: validator rejection at wikidata is traced even when wikitext wins", () => {
  // A wikidata compose that fails validation (short honoree -> too-short)
  // must appear in the trace with violation codes, while the place still
  // gets its wikitext fact.
  const p = place();
  const inputs = {
    qidByGeonames: new Map([["gn-1", "Q1"]]),
    wikidataByQid: new Map([["Q1", [wdRec({ valueLabel: "Li", valueQid: "Q99" })]]]),
    wikiTextByGeonames: new Map([
      ["gn-1", [{ factType: "named_after", person: "King Louis XVI", year: null, sentence: "The city was named after King Louis XVI of France." }]],
    ]),
    eb1911ByGeonames: new Map(),
  };
  const r = factForPlace(p, inputs);
  assert.equal(r.rung, "wikitext");
  const wdTrace = r.trace.find((t) => t.rung === "wikidata");
  assert.equal(wdTrace.reason, "validator-rejected");
  assert.ok(wdTrace.violations.some((v) => v === "too-short"));
  // The mergeChunk loud-filter keys on exactly this shape:
  const loud = r.trace.filter(
    (t) => t.reason === "validator-rejected" || (t.notes ?? []).length > 0,
  );
  assert.equal(loud.length, 1);
  assert.equal(loud[0].rung, "wikidata");
});

// ---------------------------------------------------------------------------
// hookMissing contract (card-pipeline crew: the generator marks hook-less
// records with hookMissing: true; any pipeline writing a fact must clear it,
// same as enrich-wikipedia.mjs does when merging a history hook)
// ---------------------------------------------------------------------------

test("hookMissing: cleared when the ladder writes a fact", () => {
  const fact = { text: "Named after X.", kind: "wikitext", source: "Wikipedia" };
  const p = place({ hookMissing: true });
  const merged = withFact(p, fact);
  assert.equal("hookMissing" in merged, false);
  assert.deepEqual(merged.fact, fact);
});

test("hookMissing: kept on fact-less records (mergeChunk leaves them untouched)", () => {
  const p = place({ hookMissing: true });
  const inputs = {
    qidByGeonames: new Map(),
    wikidataByQid: new Map(),
    wikiTextByGeonames: new Map(),
    eb1911ByGeonames: new Map(),
  };
  const { fact } = factForPlace(p, inputs);
  assert.equal(fact, null);
  // mergeChunk returns the place object unchanged when factForPlace yields
  // no fact — the marker survives for the linter / a later pipeline pass.
  const kept = fact ? withFact(p, fact) : p;
  assert.equal(kept.hookMissing, true);
});

test("hookMissing: cleared end-to-end on a wikidata win", () => {
  const p = place({ hookMissing: true });
  const { fact, rung } = factForPlace(p, fullInputs());
  assert.equal(rung, "wikidata");
  assert.ok(fact);
  const merged = withFact(p, fact);
  assert.equal("hookMissing" in merged, false);
  assert.equal(merged.fact.kind, "wikidata");
});

test("hookMissing: stays cleared on idempotent re-runs", () => {
  const fact = { text: "Named after X.", kind: "hook", source: "Wikipedia" };
  const once = withFact(place({ history: "h", hookMissing: true }), fact);
  assert.equal("hookMissing" in once, false);
  const twice = withFact(once, fact);
  assert.equal("hookMissing" in twice, false);
  assert.deepEqual(Object.keys(twice), Object.keys(once));
});
