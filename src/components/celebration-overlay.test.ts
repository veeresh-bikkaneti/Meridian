import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CELEBRATION_CHROME,
  CELEBRATION_COPY,
  CELEBRATION_SFX,
  CELEBRATION_VARIANT_LABEL,
  CHARACTER_CATCHPHRASES,
  type CelebrationMomentKey,
  type CelebrationVariant,
} from "./celebration-copy.ts";

const words = (s: string): number => s.split(/\s+/).filter(Boolean).length;

const MOMENTS: CelebrationMomentKey[] = [
  "difficulty-clear",
  "streak-10",
  "streak-25",
  "streak-50",
  "deck-complete",
  "first-win",
  "region-explored",
  "bullseye",
];

describe("CELEBRATION_COPY — all 8 celebration moments (spec §5)", () => {
  it("has exactly the 8 moments, each fully populated", () => {
    assert.deepEqual(Object.keys(CELEBRATION_COPY).sort(), [...MOMENTS].sort());
    for (const key of MOMENTS) {
      const m = CELEBRATION_COPY[key];
      assert.ok(m.headline.length > 0, `${key}: headline`);
      assert.ok(m.line.length > 0, `${key}: line`);
      assert.ok(m.greeting.length > 0, `${key}: greeting`);
    }
  });

  it("headlines are ≤ 8 words and lines are ≤ 20 words", () => {
    for (const key of MOMENTS) {
      const m = CELEBRATION_COPY[key];
      assert.ok(
        words(m.headline) <= 8,
        `${key}: headline is ${words(m.headline)} words: "${m.headline}"`,
      );
      assert.ok(
        words(m.line) <= 20,
        `${key}: line is ${words(m.line)} words: "${m.line}"`,
      );
    }
  });

  it("every moment is delivered by a real crew member whose catchphrase appears in the greeting", () => {
    for (const key of MOMENTS) {
      const m = CELEBRATION_COPY[key];
      const catchphrase = CHARACTER_CATCHPHRASES[m.character];
      assert.ok(catchphrase, `${key}: unknown character "${m.character}"`);
      // Compare the stem: some greetings continue the catchphrase with an
      // em-dash ("Steady course, explorer — …") instead of ending it with "!".
      const stem = catchphrase.replace(/!$/, "");
      assert.ok(
        m.greeting.includes(stem),
        `${key}: greeting must embed the catchphrase "${catchphrase}"`,
      );
    }
  });
});

describe("CELEBRATION_SFX — variant to sfx.ts recipe mapping", () => {
  it("maps the four overlay variants to the exact recipe names", () => {
    const expected: Record<CelebrationVariant, string | null> = {
      "difficulty-clear": "playMediumApplause",
      "mystery-solved": null, // playWin() already fired for the solve
      "session-milestone": "playSmallCheer",
      "game-complete": "playGrandFanfare",
    };
    assert.deepEqual(CELEBRATION_SFX, expected);
  });

  it("mystery-solved is the only silent variant", () => {
    const variants = Object.keys(CELEBRATION_SFX) as CelebrationVariant[];
    assert.deepEqual(
      variants.filter((v) => CELEBRATION_SFX[v] === null),
      ["mystery-solved"],
    );
  });
});

describe("celebration chrome", () => {
  it("labels every variant and names the dismiss control", () => {
    const variants: CelebrationVariant[] = [
      "difficulty-clear",
      "mystery-solved",
      "session-milestone",
      "game-complete",
    ];
    for (const v of variants) {
      assert.ok(CELEBRATION_VARIANT_LABEL[v].length > 0, v);
    }
    assert.ok(CELEBRATION_CHROME.dismissLabel.length > 0);
    assert.ok(CELEBRATION_CHROME.headingId.length > 0);
  });
});
