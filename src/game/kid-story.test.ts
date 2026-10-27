import assert from "node:assert/strict";
import test from "node:test";
import { KID_TARGET_MIN_CHARS, kidStoryVersion, splitSentences } from "./kid-story.ts";

test("splitSentences: abbreviation does not split (St. Louis)", () => {
  const sentences = splitSentences(
    "St. Louis sits by the wide river. It grew up around the tall arch.",
  );
  assert.equal(sentences.length, 2);
  assert.equal(sentences[0], "St. Louis sits by the wide river.");
  assert.equal(sentences[1], "It grew up around the tall arch.");
});

test("splitSentences: decimal point does not split (3.5 km)", () => {
  const sentences = splitSentences(
    "The trail is 3.5 km long. It winds slowly up the hill.",
  );
  assert.equal(sentences.length, 2);
  assert.equal(sentences[0], "The trail is 3.5 km long.");
});

test("splitSentences: single-capital initial does not split (J. Smith)", () => {
  const sentences = splitSentences(
    "J. Smith drew the first map of the town. It still hangs in the hall.",
  );
  assert.equal(sentences.length, 2);
  assert.equal(sentences[0], "J. Smith drew the first map of the town.");
});

test("kidStoryVersion: single-sentence story passes through trimmed", () => {
  const story = "One quiet sentence about a lighthouse by the sea.";
  assert.equal(splitSentences(story).length, 1);
  assert.equal(kidStoryVersion(story), story);
  assert.equal(kidStoryVersion(`  ${story}  `), story);
});

test("kidStoryVersion: 2-sentence story with a short first sentence keeps only the first (one must remain)", () => {
  const story =
    "A tiny chapel tops the hill. Bells ring out over the harbour town below every morning.";
  assert.ok(splitSentences(story)[0].length < KID_TARGET_MIN_CHARS);
  assert.equal(kidStoryVersion(story), "A tiny chapel tops the hill.");
});

test("kidStoryVersion: 3-sentence story with a short first sentence takes the first two", () => {
  const story =
    "A tiny chapel tops the hill. Bells ring over the town. Boats crowd the small harbour below.";
  assert.ok(splitSentences(story)[0].length < KID_TARGET_MIN_CHARS);
  assert.equal(
    kidStoryVersion(story),
    "A tiny chapel tops the hill. Bells ring over the town.",
  );
});

test("kidStoryVersion: target constant is 50 and the result is a strictly shorter sentence-prefix", () => {
  assert.equal(KID_TARGET_MIN_CHARS, 50);
  const story =
    "Three stone pyramids sit on the desert edge of Cairo. They were already old when the city around them was young.";
  const kid = kidStoryVersion(story);
  assert.ok(kid.length < story.length);
  assert.ok(story.startsWith(kid));
  assert.deepEqual(splitSentences(kid), splitSentences(story).slice(0, 1));
});
