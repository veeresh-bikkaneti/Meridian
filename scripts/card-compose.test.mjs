import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { composeCardStory, factText, lintCard } from "./card-compose.mjs";

/**
 * Card composition template tests (card-pipeline-rules).
 *
 * The template: [validated history/hook sentence] + [plain-spoken geographic
 * context]. composeCardStory() only reorders existing fields — it never
 * invents text. A missing hook is reported via hookMissing, never papered
 * over.
 */

const GEO = "Springfield is a town in central Illinois, the United States.";
const FACT = {
  text: "Named for President Abraham Lincoln, who practiced law here before the White House.",
  kind: "wikidata",
  source: "Wikidata",
  qid: "Q123",
};
const HISTORY =
  "In 1908 a race riot here shocked the nation and spurred the founding of the NAACP.";

describe("factText()", () => {
  it("extracts text from the fact-ladder object contract", () => {
    assert.equal(factText(FACT), FACT.text);
  });
  it("tolerates a plain string fact", () => {
    assert.equal(factText(FACT.text), FACT.text);
  });
  it("returns null for missing, empty, or too-short facts", () => {
    assert.equal(factText(null), null);
    assert.equal(factText(undefined), null);
    assert.equal(factText(""), null);
    assert.equal(factText("Too short."), null);
    assert.equal(factText({ kind: "wikidata" }), null);
    assert.equal(factText(42), null);
  });
});

describe("composeCardStory()", () => {
  it("puts the fact-ladder fact first", () => {
    const c = composeCardStory({ fact: FACT, blurb: GEO });
    assert.equal(c.hookSource, "fact");
    assert.equal(c.hookMissing, false);
    assert.ok(c.story.startsWith(FACT.text), "fact must lead");
    assert.ok(c.story.endsWith(GEO), "geo blurb anchors");
  });

  it("falls back to the history hook when no fact exists", () => {
    const c = composeCardStory({ history: HISTORY, blurb: GEO });
    assert.equal(c.hookSource, "history");
    assert.ok(c.story.startsWith(HISTORY));
  });

  it("fact outranks history (ladder precedence)", () => {
    const c = composeCardStory({ fact: FACT, history: HISTORY, blurb: GEO });
    assert.equal(c.hookSource, "fact");
    assert.ok(c.story.startsWith(FACT.text));
  });

  it("marks hook-missing truthfully and never invents a story", () => {
    const c = composeCardStory({ blurb: GEO });
    assert.equal(c.hookSource, null);
    assert.equal(c.hookMissing, true);
    assert.equal(c.story, GEO);
  });

  it("never fabricates: output is only reordered input", () => {
    const c = composeCardStory({ fact: FACT, blurb: GEO });
    assert.equal(c.story, `${FACT.text} ${GEO}`);
  });
});

describe("lintCard()", () => {
  it("passes a well-formed fact-first card", () => {
    const c = composeCardStory({ fact: FACT, blurb: GEO });
    const r = lintCard({ story: c.story, hookSource: c.hookSource, hookText: c.hookText });
    assert.deepEqual(r, { ok: true, violations: [] });
  });

  it("passes a hook-less card (honest, flagged via hookMissing on the record)", () => {
    const c = composeCardStory({ blurb: GEO });
    const r = lintCard({ story: c.story, hookSource: c.hookSource, hookText: c.hookText });
    assert.equal(r.ok, true);
  });

  it("bites when the hook is buried under the flat opener", () => {
    const r = lintCard({
      story: `${GEO} ${HISTORY}`,
      hookSource: "history",
      hookText: HISTORY,
    });
    assert.equal(r.ok, false);
    assert.ok(r.violations.includes("hook-not-first"));
  });

  it("bites on stats filler in the hook", () => {
    const hook = "Founded in 1821, it now has a population of 114,000.";
    const r = lintCard({
      story: `${hook} ${GEO}`,
      hookSource: "history",
      hookText: hook,
    });
    assert.equal(r.ok, false);
    assert.ok(r.violations.includes("hook-stats-leak"));
  });

  it("bites on a too-short hook", () => {
    const r = lintCard({ story: `Old town. ${GEO}`, hookSource: "history", hookText: "Old town." });
    assert.equal(r.ok, false);
    assert.ok(r.violations.includes("hook-too-short"));
  });

  it("bites on coordinate leaks", () => {
    const r = lintCard({
      story: `${HISTORY} ${GEO} (39.7817° N)`,
      hookSource: "history",
      hookText: HISTORY,
    });
    assert.equal(r.ok, false);
    assert.ok(r.violations.includes("coordinate-leak"));
  });

  it("bites on an empty story", () => {
    const r = lintCard({ story: "  ", hookSource: null, hookText: "" });
    assert.equal(r.ok, false);
    assert.ok(r.violations.includes("empty-story"));
  });
});
