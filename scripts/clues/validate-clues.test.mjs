// validate-clues.test.mjs — tests for the Phase 2 (prompt v1) validator.
//
// Run: node --test scripts/clues/validate-clues.test.mjs
//
// Every fixture uses an obviously FICTIONAL place ("Zorblaxia") with a
// fictional extract — no facts about any real place are fabricated or
// asserted. Each rule of validate-clues.mjs has a deliberate-failure
// test asserting its reason code.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  buildLeakTerms,
  countSyllables,
  findLeaks,
  fleschKincaidGrade,
  toRejectionRecord,
  validateRecord,
  validateRejectionRecord,
} from "./validate-clues.mjs";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EXTRACT_TEXT = [
  "Zorblaxia is a port town on the west coast of the island of Velmara, where the River Sarn meets the Grey Sea.",
  "The town stands on a wide natural harbour sheltered by two long sand spits.",
  "Winters are mild and wet, because warm sea winds cross the harbour and drop their rain on the hills behind the town, while summers stay cool and breezy.",
  "The port was founded in 1712 by the fisher Tomas Ren, whose stone lighthouse still guides ships into the harbour.",
  "Zorblaxia is famous for its night market, where lantern boats crowd the harbour each spring and cooks serve spiced eel pies.",
  "The old Salt Tower, built in 1740 to store sea salt, is the town's best-known landmark and appears on its flag.",
  "People who live in Zorblaxia are called Zorblaxians.",
].join("\n");

const INPUT = {
  place: {
    place_id: "gn-9999999",
    name: "Zorblaxia",
    country: "Velmara",
    subdivision: "Sarn Coast",
    lat: 12.34,
    lon: -45.67,
  },
  curated_aliases: [],
  extracts: [
    {
      article: "Zorblaxia",
      url: "https://en.wikipedia.org/wiki/Zorblaxia",
      text: EXTRACT_TEXT,
    },
  ],
};

function validRecord() {
  const src = (quote) => ({
    article: "Zorblaxia",
    url: "https://en.wikipedia.org/wiki/Zorblaxia",
    quote,
  });
  return {
    schema: "meridian.loop.clues.v1",
    status: "accepted",
    place_id: "gn-9999999",
    answer: {
      name: "Zorblaxia",
      aliases: ["Zorblaxian"],
      country: "Velmara",
      subdivision: "Sarn Coast",
      lat: 12.34,
      lon: -45.67,
      difficulty: 3,
    },
    clues: [
      {
        tier: 1,
        tier_name: "geography",
        text: "This port town sits on the west coast of a large island. A river runs through it and flows out to a grey sea.",
        narrowing: "rules out everything except west-coast island port towns",
        source: src("Zorblaxia is a port town on the west coast of the island of Velmara, where the River Sarn meets the Grey Sea."),
      },
      {
        tier: 2,
        tier_name: "climate",
        text: "Winters here are mild and wet, not cold. Warm sea winds cross the harbour and drop their rain on the hills behind town.",
        narrowing: "rules out cold or dry island coasts",
        source: src("Winters are mild and wet, because warm sea winds cross the harbour and drop their rain on the hills behind the town, while summers stay cool and breezy."),
      },
      {
        tier: 3,
        tier_name: "history",
        text: "This port began in 1712, when a fisher built it by the harbour. His stone lighthouse still guides ships in today.",
        narrowing: "rules out ports founded in other centuries",
        source: src("The port was founded in 1712 by the fisher Tomas Ren, whose stone lighthouse still guides ships into the harbour."),
      },
      {
        tier: 4,
        tier_name: "hook",
        text: "Each spring, lantern boats crowd the harbour for a night market. Cooks serve hot spiced eel pies to the crowds.",
        narrowing: "near-decisive: the lantern-boat night market is unique to this port",
        source: src("Zorblaxia is famous for its night market, where lantern boats crowd the harbour each spring and cooks serve spiced eel pies."),
      },
      {
        tier: 5,
        tier_name: "giveaway",
        text: "An old tower built to store sea salt stands over the town. It is so loved here that it appears on the town flag.",
        narrowing: "converts: the salt tower on the flag settles it",
        source: src("The old Salt Tower, built in 1740 to store sea salt, is the town's best-known landmark and appears on its flag."),
      },
    ],
  };
}

function codes(result) {
  return result.reasons.map((r) => r.code);
}

function expectCode(record, code, ctx = { input: INPUT }) {
  const result = validateRecord(record, ctx);
  assert.equal(result.ok, false, `expected rejection with ${code}, got ok`);
  assert.ok(
    codes(result).includes(code),
    `expected ${code} among [${codes(result).join(", ")}]`,
  );
  return result;
}

// ---------------------------------------------------------------------------
// Accept path + machinery sanity
// ---------------------------------------------------------------------------

test("valid record passes against its input", () => {
  const result = validateRecord(validRecord(), { input: INPUT });
  assert.deepEqual(result, { ok: true, reasons: [] });
});

test("countSyllables basics", () => {
  assert.equal(countSyllables("cat"), 1);
  assert.equal(countSyllables("table"), 2);
  assert.equal(countSyllables("banana"), 3);
});

test("fleschKincaidGrade: plain text grades below convoluted text", () => {
  const plain = fleschKincaidGrade("The cat sat on the mat. The dog ran to the park.");
  const dense = fleschKincaidGrade(
    "The extraordinarily picturesque municipality experiences extraordinarily changeable meteorological conditions throughout the year.",
  );
  assert.ok(plain < dense, `plain ${plain} should grade below dense ${dense}`);
});

// ---------------------------------------------------------------------------
// Leak machinery (prompt §4 LOCKED rule)
// ---------------------------------------------------------------------------

test("buildLeakTerms: multi-word name yields full term, substring parts, token-only short parts", () => {
  const terms = buildLeakTerms({ name: "Rio de Janeiro", aliases: [] });
  const byTerm = new Map(terms.map((t) => [t.term, t]));
  assert.ok(byTerm.has("rio de janeiro"));
  assert.equal(byTerm.get("rio").tokenOnly, false);
  assert.equal(byTerm.get("janeiro").tokenOnly, false);
  assert.equal(byTerm.get("de").tokenOnly, true);
});

test("findLeaks: derived form hits the base name as substring", () => {
  const terms = buildLeakTerms({ name: "Paris", aliases: [] });
  const hits = findLeaks("The Parisian bakers wake early.", terms);
  assert.ok(hits.some((h) => h.term === "paris"));
});

test("findLeaks: diacritic folding — folded clue text still leaks", () => {
  const terms = buildLeakTerms({ name: "São Brisa", aliases: [] });
  const hits = findLeaks("The road to Sao Brisa is long.", terms);
  assert.ok(hits.length > 0);
});

test("findLeaks: short part is token-only (no hit inside unrelated words)", () => {
  const terms = buildLeakTerms({ name: "Rio de Janeiro", aliases: [] });
  const hits = findLeaks("A description of the harbour and its modern defences.", terms);
  assert.equal(hits.length, 0);
});

test("findLeaks: substring part hits inside another word (accepted over-strictness)", () => {
  const terms = buildLeakTerms({ name: "New York", aliases: [] });
  const hits = findLeaks("The crew renewed the old dock.", terms);
  assert.ok(hits.some((h) => h.term === "new"));
});

// ---------------------------------------------------------------------------
// Deliberate failures — one per rule
// ---------------------------------------------------------------------------

test("wrong schema id -> SCHEMA_ID", () => {
  const record = validRecord();
  record.schema = "meridian.loop.clues.v0";
  expectCode(record, "SCHEMA_ID");
});

test("difficulty out of range or non-integer -> DIFFICULTY_INVALID", () => {
  const a = validRecord();
  a.answer.difficulty = 7;
  expectCode(a, "DIFFICULTY_INVALID");
  const b = validRecord();
  b.answer.difficulty = 2.5;
  expectCode(b, "DIFFICULTY_INVALID");
});

test("place_id mismatch vs input -> PLACE_ID_MISMATCH", () => {
  const record = validRecord();
  record.place_id = "gn-8888888";
  expectCode(record, "PLACE_ID_MISMATCH");
});

test("answer name mismatch vs input -> ANSWER_MISMATCH", () => {
  const record = validRecord();
  record.answer.name = "Zorblaxia City";
  expectCode(record, "ANSWER_MISMATCH");
});

test("unsourced alias -> ALIAS_UNSOURCED", () => {
  const record = validRecord();
  record.answer.aliases = ["Zorb City"];
  expectCode(record, "ALIAS_UNSOURCED");
});

test("curated alias is accepted as sourced, and leaks when used", () => {
  const input = { ...INPUT, curated_aliases: ["Sarnport"] };
  const record = validRecord();
  record.answer.aliases = ["Sarnport"];
  const okResult = validateRecord(record, { input });
  assert.equal(okResult.ok, true, JSON.stringify(okResult.reasons));
  record.clues[0].text = "This port town, once called Sarnport by sailors, sits on the west coast of a large island.";
  expectCode(record, "NAME_LEAK", { input });
});

test("four clues -> CLUE_COUNT", () => {
  const record = validRecord();
  record.clues = record.clues.slice(0, 4);
  expectCode(record, "CLUE_COUNT");
});

test("tier numbers out of order -> TIER_ORDER", () => {
  const record = validRecord();
  record.clues[0].tier = 2;
  expectCode(record, "TIER_ORDER");
});

test("wrong tier_name -> TIER_NAME", () => {
  const record = validRecord();
  record.clues[1].tier_name = "weather";
  expectCode(record, "TIER_NAME");
});

test("clue under 15 words -> CLUE_WORDS; over 40 words -> CLUE_WORDS", () => {
  const short = validRecord();
  short.clues[0].text = "This port town sits on the west coast of a large island.";
  expectCode(short, "CLUE_WORDS");
  const long = validRecord();
  long.clues[0].text =
    "This port town sits on the west coast of a large island by a wide bay. " +
    "A river runs through it and flows out to a grey sea past the long sand spits and the old stone quay where boats rest.";
  expectCode(long, "CLUE_WORDS");
});

test("three sentences -> CLUE_SENTENCES", () => {
  const record = validRecord();
  record.clues[0].text = "This port town sits on an island. A river runs through it. The sea beside it is grey.";
  expectCode(record, "CLUE_SENTENCES");
});

test("sentence over 25 words -> SENTENCE_TOO_LONG", () => {
  const record = validRecord();
  record.clues[0].text =
    "This port town sits on the west coast of a large island where a river runs down through green hills to a grey and windy sea.";
  expectCode(record, "SENTENCE_TOO_LONG");
});

test("missing narrowing -> NARROWING_MISSING", () => {
  const record = validRecord();
  record.clues[2].narrowing = "";
  expectCode(record, "NARROWING_MISSING");
});

test("missing quote -> SOURCE_FIELD", () => {
  const record = validRecord();
  delete record.clues[0].source.quote;
  expectCode(record, "SOURCE_FIELD");
});

test("fabricated quote -> QUOTE_UNTRACEABLE", () => {
  const record = validRecord();
  record.clues[0].source.quote = "Zorblaxia is a desert city high in the cold mountains of the far north.";
  expectCode(record, "QUOTE_UNTRACEABLE");
});

test("trivial quote -> QUOTE_TRIVIAL", () => {
  const record = validRecord();
  record.clues[0].source.quote = "The town stands";
  expectCode(record, "QUOTE_TRIVIAL");
});

test("quote cited from an unsupplied article -> SOURCE_ARTICLE_UNKNOWN", () => {
  const record = validRecord();
  record.clues[0].source.article = "Nowhere Land";
  record.clues[0].source.url = "https://en.wikipedia.org/wiki/Nowhere_Land";
  expectCode(record, "SOURCE_ARTICLE_UNKNOWN");
});

test("no input supplied: quotes fail closed -> QUOTE_UNTRACEABLE", () => {
  const result = validateRecord(validRecord());
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes("QUOTE_UNTRACEABLE"));
});

test("direct name in a clue -> NAME_LEAK", () => {
  const record = validRecord();
  record.clues[3].text = "Each spring, lantern boats crowd the harbour of Zorblaxia for a night market. Cooks serve hot spiced eel pies.";
  expectCode(record, "NAME_LEAK");
});

test("derived demonym form in a clue -> NAME_LEAK (substring rule)", () => {
  const record = validRecord();
  record.clues[3].text = "Each spring, Zorblaxian lantern boats crowd the harbour for a night market. Cooks serve hot spiced eel pies.";
  expectCode(record, "NAME_LEAK");
});

test("wordplay resolving to the name -> NAME_LEAK_INDIRECT", () => {
  const record = validRecord();
  record.clues[3].text = "Here is a sly hint for sharp ears: the name of this port rhymes with galaxy. Boats crowd its harbour each spring.";
  expectCode(record, "NAME_LEAK_INDIRECT");
});

test("census filler -> CONTENT_BANNED", () => {
  const record = validRecord();
  record.clues[2].text = "This port began long ago by the harbour. The census counted a population of 4,000 in the town.";
  expectCode(record, "CONTENT_BANNED");
});

test("decimal number in geography clue -> TIER1_COORDS", () => {
  const record = validRecord();
  record.clues[0].text = "This port town sits 12.5 degrees of latitude above the equator on an island. A river runs through it to a grey sea.";
  expectCode(record, "TIER1_COORDS");
});

test("convoluted clue -> READING_LEVEL", () => {
  const record = validRecord();
  record.clues[0].text =
    "The extraordinarily picturesque municipality experiences extraordinarily changeable meteorological conditions throughout the year.";
  expectCode(record, "READING_LEVEL");
});

test("climate clue restating geography -> CLIMATE_REDUNDANT", () => {
  const record = validRecord();
  record.clues[1].text =
    "This port town sits on the west coast of a large island. Winter rain falls on the river and the grey sea.";
  expectCode(record, "CLIMATE_REDUNDANT");
});

test("climate clue with no weather signal -> CLIMATE_NO_SIGNAL", () => {
  const record = validRecord();
  record.clues[1].text =
    "The hills behind the town are green all year. Old stone walls line the quiet lanes near the harbour.";
  expectCode(record, "CLIMATE_NO_SIGNAL");
});

test("giveaway recapping earlier clues -> TIER5_SUMMARY", () => {
  const record = validRecord();
  record.clues[4].text =
    "This port town sits on the west coast of a large island. Winters here are mild and wet with warm sea winds and rain.";
  expectCode(record, "TIER5_SUMMARY");
});

// ---------------------------------------------------------------------------
// Rejection records (prompt §6)
// ---------------------------------------------------------------------------

test("well-formed rejection record passes", () => {
  const rejection = {
    schema: "meridian.loop.clues.v1",
    status: "rejected",
    place_id: "gn-9999999",
    rejection: {
      tier: 2,
      tier_name: "climate",
      reason: "extract states a climate classification with no mechanism, extreme, or paradox",
      missing: "place-specific climate mechanism or extreme in the extract",
    },
  };
  assert.deepEqual(validateRejectionRecord(rejection), { ok: true, reasons: [] });
});

test("rejection record missing 'missing' fails; bad tier fails", () => {
  const base = {
    schema: "meridian.loop.clues.v1",
    status: "rejected",
    place_id: "gn-9999999",
    rejection: { tier: 2, tier_name: "climate", reason: "thin extract", missing: "more climate material" },
  };
  const noMissing = JSON.parse(JSON.stringify(base));
  delete noMissing.rejection.missing;
  assert.equal(validateRejectionRecord(noMissing).ok, false);
  const badTier = JSON.parse(JSON.stringify(base));
  badTier.rejection.tier = 7;
  assert.equal(validateRejectionRecord(badTier).ok, false);
  const badName = JSON.parse(JSON.stringify(base));
  badName.rejection.tier_name = "history";
  assert.equal(validateRejectionRecord(badName).ok, false);
});

test("toRejectionRecord converts validator failures into a valid §6 record", () => {
  const record = validRecord();
  record.clues[3].text = "Each spring, lantern boats crowd the harbour of Zorblaxia for a night market. Cooks serve hot spiced eel pies.";
  const result = validateRecord(record, { input: INPUT });
  assert.equal(result.ok, false);
  const rejection = toRejectionRecord(record, result.reasons);
  assert.equal(rejection.status, "rejected");
  assert.equal(rejection.place_id, "gn-9999999");
  assert.deepEqual(validateRejectionRecord(rejection), { ok: true, reasons: [] });
  assert.ok(rejection.rejection.reason.includes("NAME_LEAK"));
});
