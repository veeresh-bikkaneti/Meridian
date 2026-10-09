/**
 * Unit tests for scripts/facts-validate.mjs — the relational no-fabrication
 * gate for the rewrite stage. No network: every test feeds canned source
 * sentences. Heavy on adversarial cases: the Lewis inversion, dropped
 * hedges, mentioned->founded upgrades, smuggled function words, and
 * two-date re-binding.
 *
 * Run: node --test scripts/facts-validate.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateFact,
  checkNamedAfterInversion,
  checkHedging,
  checkDateBinding,
  checkKidSafe,
} from "./facts-validate.mjs";

const has = (violations, code) =>
  violations.some((v) => v === code || v.startsWith(code));

describe("validateFact input guards", () => {
  it("rejects a non-string rewrite", () => {
    assert.deepEqual(validateFact({ sentence: "The town was founded in 1882." }, 42), [
      "invalid-rewrite",
    ]);
  });
  it("rejects an empty rewrite", () => {
    assert.deepEqual(validateFact({ sentence: "The town was founded in 1882." }, "   "), [
      "invalid-rewrite",
    ]);
  });
  it("rejects a missing source sentence", () => {
    assert.deepEqual(validateFact({}, "The town was founded in 1882."), ["invalid-source"]);
  });
  it("rejects a null fact", () => {
    assert.deepEqual(validateFact(null, "The town was founded in 1882."), ["invalid-fact"]);
  });
  it("accepts an identity rewrite", () => {
    const s = "The town was named after explorer Lewis, who mapped the river.";
    assert.deepEqual(
      validateFact({ factType: "named_after", person: "Lewis", sentence: s }, s),
      [],
    );
  });
  it("accepts a reordered rewrite that reuses source words", () => {
    const s = "Explorer Lewis mapped the river; the town was named after him.";
    assert.deepEqual(
      validateFact({ factType: "named_after", person: "Lewis", sentence: s }, s),
      [],
    );
  });
});

describe("(a) content-word presence", () => {
  const src = "The town was founded in 1882.";
  it("flags an invented content word", () => {
    const v = validateFact({ factType: "inception", year: 1882, sentence: src },
      "The town was founded in 1882 by aliens.");
    assert.ok(has(v, "fabricated words"), `got ${JSON.stringify(v)}`);
    assert.ok(v.some((x) => x.includes("aliens")));
  });
  it("flags an invented year", () => {
    const v = validateFact({ factType: "inception", year: 1882, sentence: src },
      "The town was founded in 1881.");
    assert.ok(has(v, "fabricated words"), `got ${JSON.stringify(v)}`);
  });
  it("accepts word reordering", () => {
    const s = "The town was founded in 1882 by settlers.";
    assert.deepEqual(
      validateFact({ factType: "inception", year: 1882, sentence: s },
        "Settlers founded the town in 1882."),
      [],
    );
  });
  it("accepts dropping words (subset is fine)", () => {
    assert.deepEqual(
      validateFact({ factType: "note", sentence: src }, "The town was founded."),
      [],
    );
  });
  it("matches case-insensitively", () => {
    assert.deepEqual(
      validateFact({ factType: "inception", year: 1882, sentence: "The Town Was Founded In 1882." },
        "the town was founded in 1882."),
      [],
    );
  });
});

describe("(b) named_after relational check", () => {
  it("rejects the Lewis inversion: person as subject of naming", () => {
    const src = "The town was named after explorer Lewis, and Lewis named it himself.";
    const v = validateFact(
      { factType: "named_after", person: "Lewis", sentence: src },
      "Explorer Lewis named the town after himself.",
    );
    assert.deepEqual(v, ["named-after-inversion"]);
  });
  it("rejects 'Lewis called it Lewiston'", () => {
    const src = "The town was named after explorer Lewis, called Lewiston by settlers.";
    const v = validateFact(
      { factType: "named_after", person: "Lewis", sentence: src },
      "Lewis called it Lewiston.",
    );
    assert.deepEqual(v, ["named-after-inversion"]);
  });
  it("rejects 'General Lee dubbed the fort after himself'", () => {
    const src = "The fort was named after General Lee, who dubbed it himself.";
    const v = validateFact(
      { factType: "named_after", person: "General Lee", sentence: src },
      "General Lee dubbed the fort after himself.",
    );
    assert.deepEqual(v, ["named-after-inversion"]);
  });
  it("rejects 'Lewis christened the town'", () => {
    const src = "The town was named after explorer Lewis, who christened it.";
    const v = validateFact(
      { factType: "named_after", person: "Lewis", sentence: src },
      "Lewis christened the town.",
    );
    assert.deepEqual(v, ["named-after-inversion"]);
  });
  it("accepts 'named after Lewis'", () => {
    const src = "The town was named after explorer Lewis.";
    assert.deepEqual(
      validateFact({ factType: "named_after", person: "Lewis", sentence: src },
        "The town was named after Lewis."),
      [],
    );
  });
  it("accepts 'named for Lewis'", () => {
    const src = "The town was named after explorer Lewis.";
    assert.deepEqual(
      validateFact({ factType: "named_after", person: "Lewis", sentence: src },
        "The town was named for Lewis."),
      [],
    );
  });
  it("accepts the appositive 'Lewis, the explorer it was named for'", () => {
    const src = "The town was named after explorer Lewis.";
    assert.deepEqual(
      validateFact({ factType: "named_after", person: "Lewis", sentence: src },
        "Lewis, the explorer it was named for."),
      [],
    );
  });
  it("accepts a passive naming with an explicit agent", () => {
    const src = "They named the town for explorer Lewis long ago.";
    assert.deepEqual(
      validateFact({ factType: "named_after", person: "Lewis", sentence: src },
        "They named the town for Lewis."),
      [],
    );
  });
  it("accepts a reduced relative 'the town named after Lewis'", () => {
    const src = "The old town named after Lewis grew fast.";
    assert.deepEqual(
      validateFact({ factType: "named_after", person: "Lewis", sentence: src },
        "The town named after Lewis grew."),
      [],
    );
  });
  it("does not false-positive on passive 'Lewis was named mayor'", () => {
    const src = "Lewis was named mayor of the old town.";
    assert.deepEqual(
      validateFact({ factType: "named_after", person: "Lewis", sentence: src },
        "Lewis was named mayor."),
      [],
    );
  });
  it("accepts person-name truncation: 'General Lee' -> 'Lee'", () => {
    const src = "The fort was named after General Lee.";
    assert.deepEqual(
      validateFact({ factType: "named_after", person: "General Lee", sentence: src },
        "The fort was named after Lee."),
      [],
    );
  });
  it("rejects swapping the honoree: 'named after Grant'", () => {
    const src = "The fort was named after General Lee.";
    const v = validateFact(
      { factType: "named_after", person: "General Lee", sentence: src },
      "The fort was named after Grant.",
    );
    assert.ok(has(v, "fabricated words"), `got ${JSON.stringify(v)}`);
  });
  it("skips the check when factType is not named_after", () => {
    const src = "Lewis named the town after the river.";
    assert.deepEqual(
      validateFact({ factType: "inception", sentence: src }, "Lewis named the town."),
      [],
    );
  });
  it("direct unit: subject before verb fails, object after verb passes", () => {
    assert.deepEqual(checkNamedAfterInversion("Lewis named the town.", "Lewis"), [
      "named-after-inversion",
    ]);
    assert.deepEqual(checkNamedAfterInversion("The town was named after Lewis.", "Lewis"), []);
    assert.deepEqual(checkNamedAfterInversion("Named for Lewis, the town grew.", "Lewis"), []);
  });
});

describe("(c) hedging preservation", () => {
  it("flags a dropped 'probably'", () => {
    const v = validateFact(
      { factType: "inception", year: 1640, sentence: "The town was probably founded in 1640." },
      "The town was founded in 1640.",
    );
    assert.deepEqual(v, ["dropped-hedge"]);
  });
  it("accepts swapping one hedge for another", () => {
    const src = "The town was probably founded in 1640, likely by traders.";
    assert.deepEqual(
      validateFact({ factType: "inception", year: 1640, sentence: src },
        "The town was likely founded in 1640."),
      [],
    );
  });
  it("flags a dropped 'believed to be'", () => {
    const v = validateFact(
      { factType: "note", sentence: "The church is believed to be old and grand." },
      "The church is old and grand.",
    );
    assert.deepEqual(v, ["dropped-hedge"]);
  });
  it("accepts 'tradition holds' rewritten as 'possibly'", () => {
    const src = "Tradition holds that the fort was built by pioneers, possibly in spring.";
    assert.deepEqual(
      validateFact({ factType: "note", sentence: src },
        "The fort was possibly built by pioneers."),
      [],
    );
  });
  it("flags a hedge the source never had as fabricated", () => {
    const v = validateFact(
      { factType: "inception", year: 1640, sentence: "The town was founded in 1640." },
      "The town was probably founded in 1640.",
    );
    assert.ok(has(v, "fabricated words"), `got ${JSON.stringify(v)}`);
  });
  it("direct unit: hedge detection", () => {
    assert.deepEqual(checkHedging("It was thought to be old.", "It was old."), ["dropped-hedge"]);
    assert.deepEqual(checkHedging("It was old.", "It was old."), []);
    assert.deepEqual(checkHedging("It may have been old.", "It was possibly old."), []);
  });
});

describe("(d) date-predicate binding", () => {
  it("flags mentioned -> founded upgrade", () => {
    const src = "First mentioned in 1234, the town was later founded in 1456.";
    const v = validateFact(
      { factType: "inception", year: 1234, sentence: src },
      "The town was founded in 1234.",
    );
    assert.deepEqual(v, ["date-predicate-drift"]);
  });
  it("flags attested -> established upgrade", () => {
    const src = "The town was attested in 1234 and established in 1400.";
    const v = validateFact(
      { factType: "inception", year: 1234, sentence: src },
      "The town was established in 1234.",
    );
    assert.deepEqual(v, ["date-predicate-drift"]);
  });
  it("flags recorded -> built upgrade", () => {
    const src = "The mill was recorded in 1234 and built in 1500.";
    const v = validateFact(
      { factType: "inception", year: 1234, sentence: src },
      "The mill was built in 1234.",
    );
    assert.deepEqual(v, ["date-predicate-drift"]);
  });
  it("flags documented -> opened upgrade", () => {
    const src = "The abbey was documented in 1234 and opened in 1600.";
    const v = validateFact(
      { factType: "inception", year: 1234, sentence: src },
      "The abbey was opened in 1234.",
    );
    assert.deepEqual(v, ["date-predicate-drift"]);
  });
  it("flags founded -> mentioned downgrade", () => {
    const src = "The town was founded in 1882 and mentioned in books.";
    const v = validateFact(
      { factType: "inception", year: 1882, sentence: src },
      "The town was mentioned in 1882.",
    );
    assert.deepEqual(v, ["date-predicate-drift"]);
  });
  it("accepts founded -> established (same class)", () => {
    const src = "Founded and established in 1882, the town is old.";
    assert.deepEqual(
      validateFact({ factType: "inception", year: 1882, sentence: src },
        "The town was established in 1882."),
      [],
    );
  });
  it("accepts founded -> incorporated (same class)", () => {
    const src = "The town was founded and incorporated in 1882.";
    assert.deepEqual(
      validateFact({ factType: "inception", year: 1882, sentence: src },
        "The town was incorporated in 1882."),
      [],
    );
  });
  it("accepts settled -> built (same class)", () => {
    const src = "The village was settled and later built up in 1700.";
    assert.deepEqual(
      validateFact({ factType: "inception", year: 1700, sentence: src },
        "The village was built in 1700."),
      [],
    );
  });
  it("accepts mentioned -> recorded (same class)", () => {
    const src = "Mentioned and recorded in 1234, the town is old.";
    assert.deepEqual(
      validateFact({ factType: "inception", year: 1234, sentence: src },
        "The town was recorded in 1234."),
      [],
    );
  });
  it("catches date re-binding between two dates in one sentence", () => {
    const src = "First mentioned in 1234, it was founded in 1456.";
    const v = validateFact(
      { factType: "inception", year: 1234, sentence: src },
      "Founded in 1234, it was founded.",
    );
    assert.deepEqual(v, ["date-predicate-drift"]);
  });
  it("keeps two dates bound to their own predicates", () => {
    const src = "First mentioned in 1234, it was founded in 1456.";
    assert.deepEqual(
      validateFact({ factType: "inception", year: 1234, sentence: src },
        "Mentioned in 1234, it was founded."),
      [],
    );
  });
  it("flags a dropped year", () => {
    const v = validateFact(
      { factType: "inception", year: 1882, sentence: "The old town was founded in 1882." },
      "The old town was founded.",
    );
    assert.deepEqual(v, ["dropped-year"]);
  });
  it("skips binding when the year is not in the source", () => {
    const src = "The town was founded in 1882.";
    assert.deepEqual(
      validateFact({ factType: "inception", year: 1900, sentence: src }, src),
      [],
    );
  });
  it("skips binding when no year is given", () => {
    const src = "The town was first mentioned long ago.";
    assert.deepEqual(validateFact({ factType: "note", sentence: src }, src), []);
  });
  it("direct unit: nearest predicate wins per year token", () => {
    const src = "First mentioned in 1234, it was founded in 1456.";
    assert.deepEqual(
      checkDateBinding(src, "Founded in 1234, it was founded.", 1234),
      ["date-predicate-drift"],
    );
    assert.deepEqual(checkDateBinding(src, "Mentioned in 1234, it was founded.", 1234), []);
  });
});

describe("(e) banned patterns", () => {
  it("flags coordinates", () => {
    const s = "The town sits at 40° north and is old.";
    const v = validateFact({ factType: "note", sentence: s }, s);
    assert.ok(has(v, "banned-pattern"), `got ${JSON.stringify(v)}`);
  });
  it("flags elevation", () => {
    const s = "The town sits at high elevation and is old.";
    assert.ok(has(validateFact({ factType: "note", sentence: s }, s), "banned-pattern"));
  });
  it("flags population", () => {
    const s = "The town has a population of deer and elk.";
    assert.ok(has(validateFact({ factType: "note", sentence: s }, s), "banned-pattern"));
  });
  it("flags census", () => {
    const s = "The census counted the old town twice.";
    assert.ok(has(validateFact({ factType: "note", sentence: s }, s), "banned-pattern"));
  });
  it("flags people counts", () => {
    const s = "The town holds 5,000 residents today.";
    assert.ok(has(validateFact({ factType: "note", sentence: s }, s), "banned-pattern"));
  });
  it("flags km measurements", () => {
    const s = "The river runs 10 km past the town.";
    assert.ok(has(validateFact({ factType: "note", sentence: s }, s), "banned-pattern"));
  });
  it("flags mile measurements", () => {
    const s = "The trail is 3 miles long and old.";
    assert.ok(has(validateFact({ factType: "note", sentence: s }, s), "banned-pattern"));
  });
});

describe("(f) length + terminal punctuation", () => {
  it("flags too-short", () => {
    const s = "The town is old.";
    assert.deepEqual(validateFact({ factType: "note", sentence: s }, s), ["too-short"]);
  });
  it("accepts exactly 20 chars", () => {
    const rw = "The old town is new.";
    assert.equal(rw.length, 20);
    assert.deepEqual(
      validateFact({ factType: "note", sentence: "The old town is new and fun." }, rw),
      [],
    );
  });
  it("flags too-long and accepts exactly 240", () => {
    const ok = "a ".repeat(119) + "a.";
    assert.equal(ok.length, 240);
    assert.deepEqual(validateFact({ factType: "note", sentence: ok }, ok), []);
    const long = "a ".repeat(120) + ".";
    assert.equal(long.length, 241);
    assert.deepEqual(validateFact({ factType: "note", sentence: long }, long), ["too-long"]);
  });
  it("flags missing terminal punctuation", () => {
    const v = validateFact(
      { factType: "note", sentence: "The town is old and new." },
      "The town is old and new",
    );
    assert.deepEqual(v, ["no-terminal-punctuation"]);
  });
  it("accepts ! and ? terminals", () => {
    const s1 = "The town is old and new!";
    assert.deepEqual(validateFact({ factType: "note", sentence: s1 }, s1), []);
    const s2 = "Is the town old and new?";
    assert.deepEqual(validateFact({ factType: "note", sentence: s2 }, s2), []);
  });
  it("reports multiple violations together", () => {
    const v = validateFact(
      { factType: "note", sentence: "The town is old." },
      "The town is old",
    );
    assert.deepEqual(v, ["too-short", "no-terminal-punctuation"]);
  });
});

describe("smuggled scope words", () => {
  it("flags 'not' added to a naming fact", () => {
    const src = "The town was named after Lewis.";
    const v = validateFact(
      { factType: "named_after", person: "Lewis", sentence: src },
      "The town was not named after Lewis.",
    );
    assert.deepEqual(v, ["smuggled-scope-word: not"]);
  });
  it("flags 'never' added to a naming fact", () => {
    const src = "The town was named after Lewis.";
    const v = validateFact(
      { factType: "named_after", person: "Lewis", sentence: src },
      "The town was never named after Lewis.",
    );
    assert.ok(has(v, "smuggled-scope-word"), `got ${JSON.stringify(v)}`);
  });
  it("flags 'only' added to a naming fact", () => {
    const src = "The town was named after Lewis.";
    const v = validateFact(
      { factType: "named_after", person: "Lewis", sentence: src },
      "The town was only named after Lewis.",
    );
    assert.ok(has(v, "smuggled-scope-word"), `got ${JSON.stringify(v)}`);
    assert.ok(has(v, "fabricated words"), `got ${JSON.stringify(v)}`);
  });
  it("flags 'until' changing a date's meaning", () => {
    const src = "The town was called Milltown in 1900.";
    const v = validateFact(
      { factType: "note", sentence: src },
      "The town was called Milltown until 1900.",
    );
    assert.ok(has(v, "smuggled-scope-word"), `got ${JSON.stringify(v)}`);
  });
  it("does not flag a scope word present in the source", () => {
    const src = "Only the brave crossed the river.";
    assert.deepEqual(
      validateFact({ factType: "note", sentence: src }, "Only the brave crossed it."),
      [],
    );
  });
});

describe("kid-safety screen (g)", () => {
  it("flags adult/atrocity content", () => {
    assert.ok(has(checkKidSafe("The district is known for its historic brothel."), "kid-unsafe"));
    assert.ok(has(checkKidSafe("A massacre took place here in 1890."), "kid-unsafe"));
    assert.ok(has(checkKidSafe("The site of a brutal torture chamber."), "kid-unsafe"));
  });

  it("lets ordinary history through", () => {
    assert.deepEqual(checkKidSafe("The town was named after General Smith, who died in battle."), []);
    assert.deepEqual(checkKidSafe("Founded in 1882 and named after Edna, the railroad official's daughter."), []);
    assert.deepEqual(checkKidSafe(""), []);
  });

  it("zero hits on the 247 human-approved pilot facts", async () => {
    const { readFileSync } = await import("node:fs");
    const { join, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const factsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "game", "data", "geonames", "facts");
    let n = 0;
    for (const region of ["arkansas", "australia"]) {
      const idx = JSON.parse(readFileSync(join(factsDir, `${region}.json`), "utf8"));
      for (const [pid, f] of Object.entries(idx.facts)) {
        n++;
        assert.deepEqual(checkKidSafe(f.text), [], `pilot fact ${pid} flagged`);
      }
    }
    assert.equal(n, 247);
  });

  it("validateFact rejects a kid-unsafe compose", () => {
    const fact = {
      factType: "event",
      sentence: "The old district had a brothel.",
    };
    const v = validateFact(fact, "The old district had a brothel.");
    assert.ok(has(v, "kid-unsafe"));
  });
});
