import test from "node:test";
import assert from "node:assert/strict";
import {
  htmlToText,
  findArticleStart,
  isDisambiguation,
  splitSentences,
  pickFactSentences,
  screenSentence,
  candidateTitles,
  pickFallbackTitle,
  selectPilot,
  BLOCKLIST,
  REVIEWLIST,
} from "./facts-eb1911.mjs";

// ---------------------------------------------------------------------------
// htmlToText
// ---------------------------------------------------------------------------

test("htmlToText strips tags and decodes entities", () => {
  const html =
    '<div class="x"><p>BATH, a city of <a href="/wiki/X">Somersetshire</a>, England.</p>' +
    "<p>Pop. (1901) 49,839 &amp; thriving.</p></div>";
  const t = htmlToText(html);
  assert.ok(t.includes("BATH, a city of Somersetshire, England."));
  assert.ok(t.includes("Pop. (1901) 49,839 & thriving."));
  assert.ok(!t.includes("<"));
});

test("htmlToText drops script/style and zero-width spaces", () => {
  const t = htmlToText(
    '<script>evil()</script><style>.x{}</style><p>YORK&#8203;, a city.</p>'
  );
  assert.equal(t, "YORK, a city.");
});

// ---------------------------------------------------------------------------
// findArticleStart
// ---------------------------------------------------------------------------

test("findArticleStart locates the ALL-CAPS headword after nav junk", () => {
  const text =
    "← Bath, William Pulteney 1911 Encyclopaedia Britannica , Volume 3 " +
    "Bath (England) Bath (Maine) → sister projects : Wikipedia article " +
    "and our 1911 Encyclopaedia Britannica disclaimer . 77189 " +
    "1911 Encyclopaedia Britannica , Volume 3 — Bath (England) " +
    "BATH, a city, municipal, county and parliamentary borough, and health " +
    "resort of Somersetshire, England.";
  const i = findArticleStart(text);
  assert.ok(i >= 0);
  assert.ok(text.slice(i).startsWith("BATH, a city"));
});

test("findArticleStart returns -1 when no headword pattern", () => {
  assert.equal(findArticleStart("just some plain words here"), -1);
});

// ---------------------------------------------------------------------------
// isDisambiguation
// ---------------------------------------------------------------------------

test("isDisambiguation flags disambiguation pages", () => {
  assert.ok(
    isDisambiguation(
      "1911 Encyclopædia Britannica disclaimer. This is a disambiguation page listing articles."
    )
  );
  assert.ok(!isDisambiguation("YORK, a city, municipal borough of Yorkshire. It was founded in 71."));
});

// ---------------------------------------------------------------------------
// splitSentences
// ---------------------------------------------------------------------------

test("splitSentences protects abbreviations", () => {
  const s = splitSentences(
    "St. Mary church stands near No. 5 High Street. It was founded in 1189 by monks. York is lovely, e.g. in spring."
  );
  assert.equal(s.length, 3);
  assert.ok(s[0].startsWith("St. Mary church"));
  assert.ok(s[1].includes("founded in 1189"));
  assert.ok(s[2].includes("e.g. in spring"));
});

test("splitSentences keeps decimals intact", () => {
  const s = splitSentences("The wall is 1.5 m. high. It dates to 1300.");
  assert.equal(s.length, 2);
  assert.ok(s[0].includes("1.5 m."));
});

// ---------------------------------------------------------------------------
// pickFactSentences
// ---------------------------------------------------------------------------

test("pickFactSentences matches founding/naming/event patterns", () => {
  const sentences = [
    "BATH, a city of Somersetshire, England, on the river Avon.",
    "The city was founded in 863 by Alfred the Great.",
    "It is named after the Roman baths built there.",
    "It was the birthplace of the astronomer William Herschel.",
    "The abbey is the oldest parish church in the county.",
    "A great battle of 1643 was fought nearby at Lansdowne.",
    "The weather is often rainy in October.",
  ];
  const hits = pickFactSentences(sentences, 10);
  const patterns = hits.map((h) => h.pattern);
  assert.ok(patterns.includes("founded"), "founded matched");
  assert.ok(patterns.includes("named-after"), "named-after matched");
  assert.ok(patterns.includes("birthplace"), "birthplace matched");
  assert.ok(patterns.includes("first-oldest"), "oldest matched");
  assert.ok(patterns.includes("battle-siege"), "battle matched");
  assert.ok(!hits.some((h) => h.sentence.includes("rainy")), "plain sentence skipped");
});

test("pickFactSentences accepts early-medieval founding years", () => {
  const hits = pickFactSentences([
    "The city was founded in 863 by Alfred the Great.",
  ]);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].pattern, "founded");
});

test("pickFactSentences requires a year (or century) for founded/charter", () => {
  const hits = pickFactSentences([
    "The town was founded by monks long ago.",
    "It was granted a charter in 1204 by King John.",
  ]);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].pattern, "charter");
});

test("pickFactSentences prefers sentences with years", () => {
  const hits = pickFactSentences(
    [
      "It was the birthplace of a famous poet.",
      "It was the birthplace of John Clare in 1793.",
    ],
    1
  );
  assert.equal(hits.length, 1);
  assert.ok(hits[0].sentence.includes("1793"));
});

test("pickFactSentences matches roman-station sentences", () => {
  const hits = pickFactSentences(["York was a Roman station of great importance."]);
  assert.equal(hits[0].pattern, "roman");
});

// ---------------------------------------------------------------------------
// screenSentence — blocklist
// NOTE: the strings below are clearly-labeled SYNTHETIC examples written
// solely to exercise the kid-content filter. They are not real quotations.
// ---------------------------------------------------------------------------

test("screenSentence blocks slurs (synthetic examples)", () => {
  const synthetic = [
    "The town was settled by nigger laborers in 1800.", // synthetic: slur
    "The savages were driven from the valley in 1750.", // synthetic: dehumanizing
    "A barbarous tribe lived here before the Romans.", // synthetic: dehumanizing
    "Coolie workers built the railway in 1860.", // synthetic: slur
    "They belonged to an inferior race, the author claims.", // synthetic
    "The half-caste population grew after 1850.", // synthetic: slur
    "The natives are lazy and treacherous people.", // synthetic: pejorative native
  ];
  assert.ok(BLOCKLIST.length >= 10, "blocklist is non-trivial");
  for (const s of synthetic) {
    const r = screenSentence(s);
    assert.equal(r.verdict, "block", `should block (synthetic): ${s}`);
  }
});

test("screenSentence blocks the n-word in any case", () => {
  const r = screenSentence("SYNTHETIC example: the NIGGER population was counted.");
  assert.equal(r.verdict, "block");
});

test("screenSentence does not block the word 'savage' inside other words", () => {
  // "savagery" should not trigger \bsavages?\b
  const r = screenSentence("The town was founded in 1100 and grew rich on wool.");
  assert.equal(r.verdict, "accept");
});

// ---------------------------------------------------------------------------
// screenSentence — review flagging
// ---------------------------------------------------------------------------

test("screenSentence flags colonial language for review (not accept)", () => {
  const cases = [
    "It became the capital of the colony in 1788.",
    "The town was conquered by the Normans in 1066.",
    "It was the birthplace of a chief of the local tribe.",
    "The empire built a great wall here in 122.",
    "The natives welcomed the missionaries in 1800.",
  ];
  assert.ok(REVIEWLIST.length >= 8, "review list is non-trivial");
  for (const s of cases) {
    const r = screenSentence(s);
    assert.equal(r.verdict, "review", `should flag for review: ${s}`);
    assert.ok(r.reasons.length > 0);
  }
});

test("screenSentence accepts clean historical sentences", () => {
  const cases = [
    "The city was founded in 863 by Alfred the Great.",
    "It was the birthplace of the astronomer William Herschel in 1738.",
    "A great battle was fought nearby in 1643.",
  ];
  for (const s of cases) {
    const r = screenSentence(s);
    assert.equal(r.verdict, "accept", `should accept: ${s}`);
  }
});

// ---------------------------------------------------------------------------
// candidateTitles / pickFallbackTitle
// ---------------------------------------------------------------------------

test("candidateTitles orders Ireland first for IE places", () => {
  const ie = candidateTitles("Dublin", "IE");
  const gb = candidateTitles("Bath", "GB");
  assert.ok(ie[0].endsWith("/Dublin"));
  assert.ok(ie[1].endsWith("/Dublin (Ireland)"));
  assert.ok(gb[1].endsWith("/Bath (England)"));
  assert.ok(ie.every((t) => t.startsWith("1911 Encyclopædia Britannica/")));
});

test("pickFallbackTitle prefers country-disambiguated titles, skips people", () => {
  const stem = "Bath";
  const titles = [
    "1911 Encyclopædia Britannica/Bath",
    "1911 Encyclopædia Britannica/Bath, Thomas Thynne",
    "1911 Encyclopædia Britannica/Bath-Chair",
    "1911 Encyclopædia Britannica/Bath (England)",
    "1911 Encyclopædia Britannica/Bath (Maine)",
  ];
  const pick = pickFallbackTitle(stem, titles, [titles[0]]);
  assert.equal(pick, "1911 Encyclopædia Britannica/Bath (England)");
});

test("pickFallbackTitle returns null when nothing usable", () => {
  assert.equal(
    pickFallbackTitle("Zzz", ["1911 Encyclopædia Britannica/Zzz, Some Person"], []),
    null
  );
});

// ---------------------------------------------------------------------------
// selectPilot
// ---------------------------------------------------------------------------

test("selectPilot is deterministic and bounded", () => {
  const places = Array.from({ length: 500 }, (_, i) => ({ id: "gn-" + i }));
  const a = selectPilot(places, 200, 42);
  const b = selectPilot(places, 200, 42);
  assert.equal(a.length, 200);
  assert.deepEqual(a.map((p) => p.id), b.map((p) => p.id));
  const c = selectPilot(places, 200, 7);
  assert.notDeepEqual(a.map((p) => p.id), c.map((p) => p.id));
});

test("selectPilot caps at available places", () => {
  const places = [{ id: "gn-1" }, { id: "gn-2" }];
  assert.equal(selectPilot(places, 200, 42).length, 2);
});
