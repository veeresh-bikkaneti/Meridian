import assert from "node:assert/strict";
import test from "node:test";
import { STARTERS } from "./starters.ts";
import { storyForBand } from "./generated-places.ts";
import { kidStoryVersion, splitSentences } from "./kid-story.ts";

/**
 * WI-14 PO proof test: EVERY curated starter resolves to a full
 * Journal-quality card at bands 8-10 / 11-13 and to the sentence-shortened
 * kid version at band 5-7 — never to a fallback blurb. Iterates STARTERS;
 * the count is never hardcoded (WI-16 grows the set on this branch).
 */
test("every curated starter resolves to a full card and a kid version (WI-14)", () => {
  assert.ok(STARTERS.length > 0, "STARTERS must not be empty");
  for (const place of STARTERS) {
    assert.equal(place.curated, true, `${place.id}: expected a curated starter`);

    // Bands 8-10 / 11-13: the reviewed story, byte-identical.
    assert.equal(storyForBand(place, "8-10"), place.story, `${place.id} (8-10)`);
    assert.equal(storyForBand(place, "11-13"), place.story, `${place.id} (11-13)`);

    // The full card meets the PO's testable Journal-quality shape.
    const sentences = splitSentences(place.story);
    assert.ok(sentences.length >= 2, `${place.id}: full story has ${sentences.length} sentences`);
    assert.ok(place.story.length >= 40, `${place.id}: full story is ${place.story.length} chars`);

    // Band 5-7: exactly the shortening of that same reviewed text.
    const kid = storyForBand(place, "5-7");
    assert.equal(kid, kidStoryVersion(place.story), `${place.id} (5-7)`);
    assert.ok(kid.length > 0, `${place.id}: kid version is empty`);
    assert.ok(kid.length < place.story.length, `${place.id}: kid version is not shorter`);
    assert.ok(place.story.startsWith(kid), `${place.id}: kid version is not a prefix of the story`);
    assert.deepEqual(
      splitSentences(kid),
      sentences.slice(0, splitSentences(kid).length),
      `${place.id}: kid version is not a sentence-prefix of the story`,
    );
  }
});
