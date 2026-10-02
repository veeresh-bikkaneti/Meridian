/**
 * Unit tests for scripts/facts-wiki-text.mjs — structured fact extraction
 * (named_after / founded triples) from Wikipedia article extracts.
 *
 * Run: node --test scripts/facts-wiki-text.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractNamedAfter,
  extractFounded,
  extractFacts,
  captureName,
  isSelfName,
  isFactSentence,
  placeBaseName,
  sourceSlug,
} from "./facts-wiki-text.mjs";

describe("captureName", () => {
  it("captures a simple full name", () => {
    assert.equal(captureName("John Smith was a pioneer."), "John Smith");
  });
  it("keeps titles and initials", () => {
    assert.equal(captureName("General Joseph E. Johnston, a Confederate."), "General Joseph E. Johnston");
  });
  it("keeps lowercase connectors between capitalized tokens", () => {
    assert.equal(captureName("Rio de Janeiro is a city."), "Rio de Janeiro");
  });
  it("stops at lowercase words", () => {
    assert.equal(captureName("John Smith and the town grew."), "John Smith");
  });
  it("returns empty when the text leads lowercase", () => {
    assert.equal(captureName("the county was formed."), "");
  });
  it("strips a trailing possessive", () => {
    assert.equal(captureName("Washington's brother arrived."), "Washington");
  });
});

describe("extractNamedAfter", () => {
  it("named for with title (kept; Worker D handles content safety)", () => {
    const r = extractNamedAfter("It was named for General Joseph E. Johnston, a Confederate general.", "Johnston");
    assert.equal(r?.person, "General Joseph E. Johnston");
  });
  it("named after a president", () => {
    const r = extractNamedAfter("The city was named after President Abraham Lincoln.", "Lincolnton");
    assert.equal(r?.person, "President Abraham Lincoln");
  });
  it("named in honor of (American spelling)", () => {
    const r = extractNamedAfter("It was named in honor of John Muir.", "Muir");
    assert.equal(r?.person, "John Muir");
  });
  it("named in honour of (British spelling)", () => {
    const r = extractNamedAfter("It was named in honour of Queen Victoria.", "Victoria");
    assert.equal(r?.person, "Queen Victoria");
  });
  it("named for its founder, X (role-noun indirection)", () => {
    const r = extractNamedAfter("The city was named for its founder, Thomas Hart Benton.", "Benton");
    assert.equal(r?.person, "Thomas Hart Benton");
  });
  it("honoree sharing part of the place name is kept", () => {
    const r = extractNamedAfter("Beebe was named after Roswell Beebe, a railroad executive.", "Beebe");
    assert.equal(r?.person, "Roswell Beebe");
  });
  it("rejects: named after the county", () => {
    assert.equal(extractNamedAfter("The town was named after the county.", "Greenville"), null);
  });
  it("rejects: named after itself", () => {
    assert.equal(extractNamedAfter("The village was named after itself.", "Springfield"), null);
  });
  it("rejects: named by the Queensland Place Names Board (bureaucracy)", () => {
    assert.equal(
      extractNamedAfter("The locality was named by the Queensland Place Names Board in 1999.", "Meringandan"),
      null,
    );
  });
  it("rejects: the place's own name", () => {
    assert.equal(
      extractNamedAfter("The town was named after Washington, the first president.", "Washington"),
      null,
    );
  });
  it("rejects: Springfield named after Springfield, Massachusetts", () => {
    assert.equal(
      extractNamedAfter("Springfield was named after Springfield, Massachusetts.", "Springfield"),
      null,
    );
  });
  it("rejects: no naming predicate at all", () => {
    assert.equal(extractNamedAfter("The town is home to a large park.", "Riverton"), null);
  });
  it("rejects: population sentence can never be a fact source", () => {
    assert.equal(
      extractNamedAfter("Named after John Smith, the population was 5,000 at the census.", "Smithville"),
      null,
    );
  });
});

describe("extractFounded", () => {
  it("founded in YEAR by Person", () => {
    assert.deepEqual(
      extractFounded("The city was founded in 1854 by John Muir."),
      { year: 1854, founder: "John Muir" },
    );
  });
  it("loose word order: founded by X in YEAR", () => {
    assert.deepEqual(
      extractFounded("The town was founded by Sarah Platt in 1879 as a mining camp."),
      { year: 1879, founder: "Sarah Platt" },
    );
  });
  it("established with a story keyword, no founder", () => {
    assert.deepEqual(
      extractFounded("It was established in 1880 as a railroad stop."),
      { year: 1880, founder: null },
    );
  });
  it("settled in a decade with a story carrier", () => {
    assert.deepEqual(
      extractFounded("The area was settled in the 1840s by pioneers."),
      { year: 1840, founder: null },
    );
  });
  it("incorporated with a railroad founder entity", () => {
    assert.deepEqual(
      extractFounded("The town was incorporated in 1903 by the Texas and Pacific Railway."),
      { year: 1903, founder: "Texas and Pacific Railway" },
    );
  });
  it("rejects: incorporated in 1914 by the County Commission (paperwork)", () => {
    assert.equal(extractFounded("The town was incorporated in 1914 by the County Commission."), null);
  });
  it("rejects: bare date anchor with no story carrier", () => {
    assert.equal(extractFounded("Edna was founded in 1882."), null);
  });
  it("rejects: vague decade with no story carrier", () => {
    assert.equal(extractFounded("It was settled in the 1840s."), null);
  });
  it("rejects: first mentioned in 1234 (P571-style drift guard)", () => {
    assert.equal(extractFounded("The village was first mentioned in 1234."), null);
  });
  it("rejects: first recorded in 1066", () => {
    assert.equal(extractFounded("The hamlet was first recorded in 1066 in the Domesday survey."), null);
  });
  it("rejects: GNIS record-creation date", () => {
    assert.equal(extractFounded("The GNIS entry was created in 1980."), null);
  });
  it("rejects: post office establishment is not the town's founding", () => {
    assert.equal(extractFounded("The post office was established in 1890."), null);
  });
  it("rejects: year before 1000", () => {
    assert.equal(extractFounded("The city was founded in 999 by Vikings."), null);
  });
  it("rejects: year in the future", () => {
    assert.equal(extractFounded("Founded in 2030, the city is brand new."), null);
  });
  it("rejects: census sentence can never be a fact source", () => {
    assert.equal(extractFounded("With a population of 5,000, the town was founded in 1875."), null);
  });
  it("rejects: elevation sentence can never be a fact source", () => {
    assert.equal(extractFounded("At an elevation of 300 ft, it was settled in 1850 by farmers."), null);
  });
});

describe("extractFacts (multi-sentence extracts)", () => {
  it("finds the fact in sentence 3", () => {
    const extract =
      "Milltown is a borough in New Jersey, United States. " +
      "The population was 7,000 at the 2020 census. " +
      "The borough was incorporated in 1889 by the Milltown Council during the clay mining boom.";
    // Council is paperwork and "clay mining boom" carries no whitelisted
    // story keyword... "mining" IS a story keyword -> founder null but keyword present.
    const facts = extractFacts(extract, "Milltown");
    assert.equal(facts.length, 1);
    assert.equal(facts[0].factType, "founded");
    assert.equal(facts[0].year, 1889);
  });
  it("extract with no facts yields nothing", () => {
    const extract =
      "Beebe is a city in White County, Arkansas, United States. " +
      "The population was 9,092 at the 2024 Census Bureau estimate. " +
      "The city is home to Arkansas State University-Beebe.";
    assert.deepEqual(extractFacts(extract, "Beebe"), []);
  });
  it("empty extract yields nothing", () => {
    assert.deepEqual(extractFacts("", "Nowhere"), []);
    assert.deepEqual(extractFacts("   ", "Nowhere"), []);
  });
  it("a sentence can yield both fact types", () => {
    const extract =
      "The town was founded in 1854 by John Smith and named after his wife Mary.";
    const facts = extractFacts(extract, "Marysville");
    const types = facts.map((f) => f.factType).sort();
    assert.deepEqual(types, ["founded", "named_after"]);
  });
  it("keeps the verbatim source sentence on each fact", () => {
    const extract = "The city was named after President Abraham Lincoln. It grew quickly.";
    const facts = extractFacts(extract, "Lincolnton");
    assert.equal(facts[0].sentence, "The city was named after President Abraham Lincoln.");
  });
  it("dedupes the same fact repeated in two sentences", () => {
    const extract =
      "The city was founded in 1854 by John Muir. Founded in 1854 by John Muir, it grew fast.";
    assert.equal(extractFacts(extract, "Muirville").length, 1);
  });
});

describe("guards and helpers", () => {
  it("isSelfName: identical names", () => {
    assert.equal(isSelfName("Washington", "Washington"), true);
  });
  it("isSelfName: partial overlap kept", () => {
    assert.equal(isSelfName("Roswell Beebe", "Beebe"), false);
  });
  it("isFactSentence rejects population/census/elevation/coordinates", () => {
    assert.equal(isFactSentence("The population was 5,000."), false);
    assert.equal(isFactSentence("At the 2020 census it had 700 people."), false);
    assert.equal(isFactSentence("The elevation is 300 feet."), false);
    assert.equal(isFactSentence("It lies at 34°12′N 91°32′W."), false);
    assert.equal(isFactSentence("The town was founded by pioneers."), true);
  });
  it("placeBaseName strips state and parentheticals", () => {
    assert.equal(placeBaseName("Beebe, Arkansas"), "Beebe");
    assert.equal(placeBaseName("Springfield (band)"), "Springfield");
  });
  it("sourceSlug replaces spaces with underscores", () => {
    assert.equal(sourceSlug("Beebe, Arkansas"), "Beebe,_Arkansas");
  });
});
