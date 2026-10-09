import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as copyModule from "./storyteller-home-copy.ts";
import {
  GREETINGS,
  GREET_01,
  LEAF_LINE,
  POKE_LINES,
  SCROLL_TAP_LINE,
  SENDOFFS,
  TOUR_RETURN_LINE,
  dayOfYear,
  greetingIndexForDate,
  localDayKey,
} from "./storyteller-home-copy.ts";
import * as sessionModule from "./storyteller-session.ts";
import {
  armTourReturnLine,
  consumeSessionAutoNarration,
  isSessionAutoNarrationConsumed,
  resetStorytellerSessionForTests,
  takeTourReturnLine,
} from "./storyteller-session.ts";

describe("storyteller home copy — locked lines are byte-identical (copy pack §0)", () => {
  it("greet-01 is the locked line", () => {
    assert.equal(
      GREET_01,
      "Ah, my young explorer! The map is whispering secrets today. Shall we hear its story together?",
    );
    assert.equal(GREETINGS[0], GREET_01);
  });

  it("ships exactly 6 greetings, greet-02…06 verbatim", () => {
    assert.equal(GREETINGS.length, 6);
    assert.deepEqual(GREETINGS.slice(1), [
      "New day, new tales hiding in the hills. Shall we go find one?",
      "Psst… the rivers told me a secret this morning. Want to hear it?",
      "Somewhere out there, a mountain is keeping a story warm. Let's go find it.",
      "The winds brought rumors from faraway cities today. Curious?",
      "Every dot on this map has a tale. Which one shall we wake up first?",
    ]);
  });

  it("post-tour return line is the locked line", () => {
    assert.equal(
      TOUR_RETURN_LINE,
      "Welcome back, explorer! Grandpa showed you around — now, where shall our story go next?",
    );
  });

  it("all 7 send-offs are the locked lines", () => {
    assert.deepEqual(SENDOFFS, {
      terrain: "Boots on! Let's read the land like a detective. 🥾",
      quiz: "Quick-fire questions, brave explorer — show me what you know!",
      passport: "Your passport is hungry for new stamps! ✈️",
      geodetective: "A mystery is afoot… lean in close. 🔍",
      capital: "Capitals and clever guesses — off we go!",
      expedition: "Pack a snack — this trail is a long one. 🎒",
      duel: "A friendly duel! May the sharpest compass win. 🧭",
    });
  });

  it("poke lines: 5 max, then repeat — verbatim", () => {
    assert.equal(POKE_LINES.length, 5);
    assert.deepEqual([...POKE_LINES], [
      "Heh! That tickles my beard.",
      "Careful, explorer — I'm older than these mountains.",
      "Poke all you like. I've survived worse… have I told you about Troy? 😌",
      "Hmm? Did the map just move, or was that you?",
      "Alright, alright — pick a place and I'll tell you its tale.",
    ]);
  });

  it("micro-delight captions verbatim", () => {
    assert.equal(LEAF_LINE, "A leaf for luck. 🍃");
    assert.equal(SCROLL_TAP_LINE, "tap tap… is this thing on? 👀");
  });

  it("no greeting or poke line uses the reserved catchphrase", () => {
    for (const line of [...GREETINGS, ...POKE_LINES, LEAF_LINE, SCROLL_TAP_LINE]) {
      assert.ok(!line.includes("Shh"), `catchphrase leaked: ${line}`);
    }
  });

  it("max 1 emoji per line", () => {
    const emoji = /\p{Extended_Pictographic}/u;
    for (const line of [...GREETINGS, ...POKE_LINES, LEAF_LINE, SCROLL_TAP_LINE]) {
      const count = [...line.matchAll(new RegExp(emoji, "gu"))].length;
      assert.ok(count <= 1, `too many emoji: ${line}`);
    }
  });
});

describe("greeting rotation — day-of-year mod 6 (every visit greets)", () => {
  it("indexes 0…5 across consecutive days", () => {
    // 2026-01-01 is day 1 → index 1; 2026-01-06 is day 6 → index 0.
    assert.equal(dayOfYear(new Date(2026, 0, 1)), 1);
    assert.equal(greetingIndexForDate(new Date(2026, 0, 1)), 1);
    assert.equal(greetingIndexForDate(new Date(2026, 0, 6)), 0);
    assert.equal(greetingIndexForDate(new Date(2026, 0, 7)), 1);
  });

  it("localDayKey is YYYY-MM-DD in local time", () => {
    assert.equal(localDayKey(new Date(2026, 9, 9, 12)), "2026-10-09");
  });
});

describe("owner correction 2026-10-09 — once-per-day logic is gone", () => {
  it("decideHomeMode and the silent mode no longer exist", () => {
    assert.ok(
      !("decideHomeMode" in copyModule),
      "decideHomeMode must be deleted (no same-day-silent path)",
    );
    assert.ok(
      !("HomeGreetingMode" in copyModule),
      "HomeGreetingMode must be deleted",
    );
  });

  it("greet-day storage no longer exists", () => {
    assert.ok(
      !("readHomeGreetDay" in sessionModule),
      "readHomeGreetDay must be deleted",
    );
    assert.ok(
      !("writeHomeGreetDay" in sessionModule),
      "writeHomeGreetDay must be deleted",
    );
    assert.ok(
      !("GREET_DAY_KEY" in sessionModule),
      "GREET_DAY_KEY must be deleted",
    );
  });
});

describe("storyteller-session — storage flags (story cards keep theirs)", () => {
  it("session auto-narration: first consume wins, then consumed", () => {
    resetStorytellerSessionForTests();
    assert.equal(isSessionAutoNarrationConsumed(), false);
    assert.equal(consumeSessionAutoNarration(), true);
    assert.equal(isSessionAutoNarrationConsumed(), true);
    assert.equal(consumeSessionAutoNarration(), false);
  });

  it("tour-return flag: armed → taken exactly once → gone", () => {
    resetStorytellerSessionForTests();
    armTourReturnLine("2026-10-09");
    assert.equal(takeTourReturnLine("2026-10-09"), true);
    assert.equal(takeTourReturnLine("2026-10-09"), false);
  });

  it("tour-return flag: a stale day never fires", () => {
    resetStorytellerSessionForTests();
    armTourReturnLine("2026-10-08");
    assert.equal(takeTourReturnLine("2026-10-09"), false);
  });
});
