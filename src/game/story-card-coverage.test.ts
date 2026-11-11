import assert from "node:assert/strict";
import test from "node:test";
import { STARTERS } from "./starters.ts";
import { storyForBand } from "./generated-places.ts";
import { splitSentences } from "./kid-story.ts";

/**
 * WI-14 PO proof test: EVERY curated starter resolves to a full
 * Journal-quality card at every age group (7-10 / 10-18 / 18+) — never to a
 * fallback blurb. (The 5-7 sentence-shortened kid-version assertions were
 * removed: no group under 7 exists, so storyForBand never shortens.) Iterates STARTERS;
 * the count is never hardcoded (WI-16 grows the set on this branch).
 */
test("every curated starter resolves to a full card at every group (WI-14)", () => {
  assert.ok(STARTERS.length > 0, "STARTERS must not be empty");
  for (const place of STARTERS) {
    assert.equal(place.curated, true, `${place.id}: expected a curated starter`);

    // Every group: the reviewed story, byte-identical.
    assert.equal(storyForBand(place, "7-10"), place.story, `${place.id} (7-10)`);
    assert.equal(storyForBand(place, "10-18"), place.story, `${place.id} (10-18)`);
    assert.equal(storyForBand(place, "18+"), place.story, `${place.id} (18+)`);

    // The full card meets the PO's testable Journal-quality shape.
    const sentences = splitSentences(place.story);
    assert.ok(sentences.length >= 2, `${place.id}: full story has ${sentences.length} sentences`);
    assert.ok(place.story.length >= 40, `${place.id}: full story is ${place.story.length} chars`);
  }
});
