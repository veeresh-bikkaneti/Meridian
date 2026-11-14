import assert from "node:assert/strict";
import { describe, it } from "node:test";
import snapshotJson from "./snapshot.json" with { type: "json" };
import {
  CARD_CHARACTER_IDS,
  characterForStory,
  countCharacters,
} from "./card-character-map.ts";
import type { SnapshotData } from "./board-data.ts";

const snapshot = snapshotJson as SnapshotData;
const byTitle = new Map(snapshot.stories.map((s) => [s.title, s]));

function mapped(title: string) {
  const story = byTitle.get(title);
  assert.ok(story, `snapshot story not found: ${title}`);
  return characterForStory(story);
}

describe("card characters: the mapping is total over the snapshot", () => {
  it("maps every one of the 46 stories to a known character", () => {
    assert.equal(snapshot.stories.length, 46);
    for (const story of snapshot.stories) {
      const id = characterForStory(story);
      assert.ok(
        (CARD_CHARACTER_IDS as readonly string[]).includes(id),
        `${story.title} mapped to unknown character ${id}`,
      );
    }
    const counts = countCharacters(snapshot.stories);
    assert.equal(
      Object.values(counts).reduce((a, b) => a + b, 0),
      46,
    );
  });

  it("lands the snapshot's stories on the expected characters", () => {
    // Pinned from a hand pass over the rule order in
    // card-character-map.ts; a rule or snapshot change that moves a
    // story must update this table on purpose, not by accident.
    assert.deepEqual(countCharacters(snapshot.stories), {
      mic: 4,
      compass: 3,
      abacus: 6,
      wrench: 1,
      eye: 0,
      camera: 2,
      gear: 7,
      book: 3,
      flask: 7,
      globe: 5,
      magnifier: 8,
    });
  });
});

describe("card characters: rule order is the behaviour", () => {
  it("voice beats place, clue beats fix, fix beats infra", () => {
    assert.equal(mapped("88 place names with no Holmes voice"), "mic");
    assert.equal(mapped("Held-finger jitter fix on the clue berth"), "compass");
    assert.equal(mapped("Clue pacing and one voice at a time"), "mic");
    assert.equal(mapped("Cloudflare deploy fix"), "wrench");
  });

  it("places in a journals title still hit the compass rule first", () => {
    // The journals spec story names "people and places": the compass
    // rule (place) sits above the book rule (journal), so this is a
    // compass by design of the order, not an oversight.
    assert.equal(
      mapped(
        "7 journal specs (people and places, technology, WW2 monuments, world wars, modern world, great leaders, freedom fighters)",
      ),
      "compass",
    );
    assert.equal(mapped("Journals release"), "book");
  });

  it("whole lanes land on their subject characters", () => {
    assert.equal(mapped("Math subject screen, 3 items per age group"), "abacus");
    assert.equal(mapped("Physics and Chemistry screens"), "flask");
    assert.equal(mapped("Social studies and GK screens"), "globe");
    assert.equal(mapped("Films (v4, dolly camera)"), "camera");
    assert.equal(mapped("Turn the Scaling streams ruleset back on"), "gear");
  });

  it("synthetic stories follow the same order, eye included", () => {
    const fake = (lane: string, title: string) => characterForStory({ lane, title });
    assert.equal(fake("Anywhere", "Zoom and screen reader support"), "eye");
    assert.equal(fake("Anywhere", "A journal film about readings"), "camera");
    assert.equal(fake("Infra and process", "Scale-play plan"), "gear");
    assert.equal(fake("Anywhere", "Voice from a quiet place"), "mic");
    assert.equal(fake("Anywhere", "An unassuming errand"), "magnifier");
  });
});
