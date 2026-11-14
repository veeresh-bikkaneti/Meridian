import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import snapshotJson from "./snapshot.json" with { type: "json" };
import {
  CARD_CHARACTER_IDS,
  characterForStory,
} from "./card-character-map.ts";
import type { SnapshotData } from "./board-data.ts";

const snapshot = snapshotJson as SnapshotData;

/**
 * The components live in .tsx files, which the node test runner
 * cannot import — so the registries are pinned at the source level:
 * extract the keys of one `Record<CardCharacterId, …>` block, one
 * `  id: Value,` entry per line (the format both files keep). The
 * behavioural proof that each card renders its pair is the board
 * e2e (46 cards, mascot theme === chip theme on every card).
 */
function registryKeys(source: string, marker: string): string[] {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `registry marker not found: ${marker}`);
  const block = source.slice(start, source.indexOf("};", start));
  return [...block.matchAll(/^\s+([a-z]+):/gm)].map((m) => m[1]);
}

const mascotKeys = registryKeys(
  readFileSync(new URL("./card-characters.tsx", import.meta.url), "utf8"),
  "CHARACTERS: Record",
);
const iconKeys = registryKeys(
  readFileSync(new URL("./card-icons.tsx", import.meta.url), "utf8"),
  "CARD_ICONS: Record",
);
const labelKeys = registryKeys(
  readFileSync(new URL("./card-icons.tsx", import.meta.url), "utf8"),
  "THEME_LABELS: Record",
);

describe("card icons: every theme has both styles", () => {
  it("registers a mascot and a flat icon for all 11 themes", () => {
    const ids = [...CARD_CHARACTER_IDS].sort();
    assert.deepEqual([...mascotKeys].sort(), ids);
    assert.deepEqual([...iconKeys].sort(), ids);
    assert.deepEqual([...labelKeys].sort(), ids);
  });

  it("resolves a mascot + icon pair for every one of the 46 stories", () => {
    assert.equal(snapshot.stories.length, 46);
    for (const story of snapshot.stories) {
      const id = characterForStory(story);
      assert.ok(
        mascotKeys.includes(id) && iconKeys.includes(id),
        `${story.title} (${id}) is missing one of its pair`,
      );
    }
  });
});
