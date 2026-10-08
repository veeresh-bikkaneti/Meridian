import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  STORYTELLER_AUDIO_FALLBACK_LINE,
  STORYTELLER_LINES,
  storytellerAudioUrl,
  storytellerFigureUrl,
  wordMsFromDuration,
} from "./storyteller-lines.ts";
import {
  claimFirstRevealNarration,
  resetFirstRevealNarrationForTests,
} from "./storyteller-claim.ts";

describe("STORYTELLER_LINES — final copy contract", () => {
  it("ships exactly the three v1 lines with matching mp3 filenames", () => {
    assert.deepEqual(Object.keys(STORYTELLER_LINES).sort(), ["hook", "reveal", "summary"]);
    assert.equal(STORYTELLER_LINES.reveal.audioFile, "reveal-01.mp3");
    assert.equal(STORYTELLER_LINES.hook.audioFile, "hook-01.mp3");
    assert.equal(STORYTELLER_LINES.summary.audioFile, "summary-01.mp3");
  });

  it("line text is the exact design-doc copy (spoken form, do not edit)", () => {
    assert.equal(
      STORYTELLER_LINES.reveal.text,
      "Shh… listen closely. Every place has a story, and this one is a very good one.",
    );
    assert.equal(
      STORYTELLER_LINES.hook.text,
      "Psst… the fourth clue. This is the one that changes everything. Lean in close…",
    );
    assert.equal(
      STORYTELLER_LINES.summary.text,
      "And so our tale comes to an end! What an adventure!",
    );
  });

  it("the fallback line never device-shames", () => {
    assert.equal(
      STORYTELLER_AUDIO_FALLBACK_LINE,
      "The words are right here — read along with me.",
    );
    assert.ok(!/device|phone|browser|upgrade|old/i.test(STORYTELLER_AUDIO_FALLBACK_LINE));
  });
});

describe("storytellerAudioUrl / storytellerFigureUrl", () => {
  it("builds same-origin public URLs under node (import.meta.env absent)", () => {
    // Under node --test import.meta.env is undefined → base falls back to "/".
    assert.equal(storytellerAudioUrl("reveal-01.mp3"), "/audio/storyteller/reveal-01.mp3");
    assert.equal(storytellerFigureUrl(), "/images/storyteller/storyteller.jpg");
  });
});

describe("wordMsFromDuration — caption sync math", () => {
  it("divides clip duration by word count", () => {
    assert.equal(wordMsFromDuration(9000, 18, 260), 500);
  });

  it("falls back on non-finite/zero duration or empty word count", () => {
    assert.equal(wordMsFromDuration(NaN, 10, 260), 260);
    assert.equal(wordMsFromDuration(0, 10, 260), 260);
    assert.equal(wordMsFromDuration(-5, 10, 260), 260);
    assert.equal(wordMsFromDuration(9000, 0, 260), 260);
    assert.equal(wordMsFromDuration(Infinity, 10, 260), 260);
  });
});

describe("claimFirstRevealNarration — session-once auto-narration", () => {
  it("returns true exactly once per session", () => {
    resetFirstRevealNarrationForTests();
    assert.equal(claimFirstRevealNarration(), true);
    assert.equal(claimFirstRevealNarration(), false);
    assert.equal(claimFirstRevealNarration(), false);
  });
});
