import assert from "node:assert/strict";
import test from "node:test";
import { mapStory, RUNG_ORDER, HOOK_MIN_CHARS } from "./rungs.ts";
import type { PlaceFacts } from "./types.ts";

const LADDER: PlaceFacts["ladder"] = {
  hook: { text: "A hook sentence that is long enough to count.", source: "curated" },
  wikitext: { text: "A wikitext extract sentence that is certainly long enough here.", source: "Wikipedia" },
  eb1911: { text: "An EB1911 sentence that is also long enough to qualify here.", source: "EB1911" },
  wikidata: { text: "A wikidata description string long enough to be selected.", source: "Wikidata" },
};

const BLURB = "Plain-spoken geography blurb about the place.";
const HISTORY = "A Wikipedia-extract fallback sentence, plenty long enough.";

const fullFacts: PlaceFacts = { ladder: LADDER, history: HISTORY, blurb: BLURB };

test("5-7 ceiling: hook rung wins over a full ladder", () => {
  const m = mapStory("5-7", fullFacts);
  assert.equal(m.rung, "hook");
  assert.ok(m.text.startsWith(LADDER.hook!.text));
  assert.ok(m.text.endsWith(BLURB));
  assert.equal(m.autoplayAudio, true);
});

test("8-10 ceiling: wikitext rung wins over a full ladder", () => {
  const m = mapStory("8-10", fullFacts);
  assert.equal(m.rung, "wikitext");
  assert.ok(m.text.startsWith(LADDER.wikitext!.text));
  assert.equal(m.autoplayAudio, false);
});

test("11-13 ceiling: wikidata rung wins over a full ladder", () => {
  const m = mapStory("11-13", fullFacts);
  assert.equal(m.rung, "wikidata");
  assert.equal(m.autoplayAudio, false);
});

test("unset band → full-access default (11-13 mapping, never restricts)", () => {
  const m = mapStory(null, fullFacts);
  assert.equal(m.rung, "wikidata");
  assert.equal(m.autoplayAudio, false);
});

test("8-10 with hook-only ladder degrades gracefully to hook", () => {
  const m = mapStory("8-10", { ladder: { hook: LADDER.hook }, blurb: BLURB });
  assert.equal(m.rung, "hook");
  assert.ok(m.text.includes(BLURB));
});

test("rung above ceiling is never shown: 5-7 + wikidata-only falls to history", () => {
  const m = mapStory("5-7", { ladder: { wikidata: LADDER.wikidata }, history: HISTORY, blurb: BLURB });
  assert.equal(m.rung, "history");
  assert.ok(m.text.startsWith(HISTORY));
});

test("5-7 + no ladder + history → history + blurb + autoplay", () => {
  const m = mapStory("5-7", { ladder: {}, history: HISTORY, blurb: BLURB });
  assert.equal(m.rung, "history");
  assert.equal(m.autoplayAudio, true);
});

test("nothing but a blurb → blurb-only (truthful, no fabrication)", () => {
  const m = mapStory("8-10", { ladder: {}, blurb: BLURB });
  assert.equal(m.rung, "blurb-only");
  assert.equal(m.text, BLURB);
});

test("short entries (< HOOK_MIN_CHARS) are skipped", () => {
  const m = mapStory("5-7", {
    ladder: { hook: { text: "too short", source: "x" } },
    history: HISTORY,
    blurb: BLURB,
  });
  assert.equal(m.rung, "history");
  assert.equal(HOOK_MIN_CHARS, 20);
});

test("empty blurb is tolerated (no trailing space invented)", () => {
  const m = mapStory("11-13", { ladder: LADDER, blurb: "" });
  assert.equal(m.text, LADDER.wikidata!.text);
});

test("RUNG_ORDER is ascending difficulty per the card-compose contract", () => {
  assert.deepEqual(RUNG_ORDER, ["hook", "wikitext", "eb1911", "wikidata"]);
});
