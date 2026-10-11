import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decideFirstGesture,
  fallbackLine,
  resolvePlayAbort,
  shouldReplayGreeting,
} from "./storyteller-audio-guards.ts";
import {
  STORYTELLER_AUDIO_FALLBACK_LINE,
  STORYTELLER_RETRY_HINT,
} from "./storyteller-lines.ts";

/**
 * Narration-silence regression tests (owner's phone: captions advance,
 * zero audio). Each decision helper encodes a fix; the cases below are the
 * FAIL-pre shapes — the old inline code got every one of these wrong
 * (consumed the one-shot while muted, stranded "playing" on AbortError,
 * trapped the silent greeting behind poke lines, showed no retry hint).
 */

describe("decideFirstGesture — Fix A: re-armable one-shot", () => {
  it("sound off keeps the one-shot armed (does NOT consume)", () => {
    assert.equal(
      decideFirstGesture({
        alreadyDone: false,
        dismissed: false,
        celebrationActive: false,
        soundOn: false,
      }),
      "keep-armed",
    );
  });

  it("sound on consumes the one-shot", () => {
    assert.equal(
      decideFirstGesture({
        alreadyDone: false,
        dismissed: false,
        celebrationActive: false,
        soundOn: true,
      }),
      "consume",
    );
  });

  it("already-done or dismissed gestures are ignored", () => {
    assert.equal(
      decideFirstGesture({
        alreadyDone: true,
        dismissed: false,
        celebrationActive: false,
        soundOn: true,
      }),
      "ignore",
    );
    assert.equal(
      decideFirstGesture({
        alreadyDone: false,
        dismissed: true,
        celebrationActive: false,
        soundOn: true,
      }),
      "ignore",
    );
  });

  it("a celebration-owned gesture is never consumed (P1-1 preserved)", () => {
    assert.equal(
      decideFirstGesture({
        alreadyDone: false,
        dismissed: false,
        celebrationActive: true,
        soundOn: true,
      }),
      "ignore",
    );
  });
});

describe("resolvePlayAbort — Fix C: AbortError must not strand 'playing'", () => {
  it("aborted play() on our own paused element → recoverable 'paused'", () => {
    assert.equal(
      resolvePlayAbort({
        isCurrentAttempt: true,
        elementPaused: true,
        dismissed: false,
      }),
      "mark-paused",
    );
  });

  it("a newer attempt took over → leave it alone", () => {
    assert.equal(
      resolvePlayAbort({
        isCurrentAttempt: false,
        elementPaused: true,
        dismissed: false,
      }),
      "leave",
    );
  });

  it("dismissed narration → leave it alone", () => {
    assert.equal(
      resolvePlayAbort({
        isCurrentAttempt: true,
        elementPaused: true,
        dismissed: true,
      }),
      "leave",
    );
  });

  it("element not paused (still live) → leave it alone", () => {
    assert.equal(
      resolvePlayAbort({
        isCurrentAttempt: true,
        elementPaused: false,
        dismissed: false,
      }),
      "leave",
    );
  });
});

describe("shouldReplayGreeting — Fix D: figure tap replays a silent greeting", () => {
  const base = {
    mode: "greeting" as const,
    started: true,
    attempted: true,
    heard: false,
    dismissedByUser: false,
    oneShotConsumed: true,
    greetAudioAvailable: true,
    soundOn: true,
  };

  it("attempted-but-never-heard greeting → replay", () => {
    assert.equal(shouldReplayGreeting(base), true);
  });

  it("heard greeting → poke lines (existing behavior)", () => {
    assert.equal(shouldReplayGreeting({ ...base, heard: true }), false);
  });

  it("never attempted → poke lines", () => {
    assert.equal(shouldReplayGreeting({ ...base, attempted: false }), false);
  });

  it("kid-dismissed greeting stays quiet → poke lines", () => {
    assert.equal(
      shouldReplayGreeting({ ...base, dismissedByUser: true }),
      false,
    );
  });

  it("tour-return mode is text-only → poke lines", () => {
    assert.equal(
      shouldReplayGreeting({ ...base, mode: "tour-return" }),
      false,
    );
  });

  it("muted or missing audio → poke lines (never bypasses the mute)", () => {
    assert.equal(shouldReplayGreeting({ ...base, soundOn: false }), false);
    assert.equal(
      shouldReplayGreeting({ ...base, greetAudioAvailable: false }),
      false,
    );
  });

  it("one-shot not yet consumed → the window listener owns this tap", () => {
    assert.equal(
      shouldReplayGreeting({ ...base, oneShotConsumed: false }),
      false,
    );
  });

  it("banner not started (tutorial invite up) → poke lines", () => {
    assert.equal(shouldReplayGreeting({ ...base, started: false }), false);
  });
});

describe("fallbackLine — Fix E: retry hint only on play() rejection", () => {
  it("not failed → no caption", () => {
    assert.equal(
      fallbackLine({ failed: false, playRejected: true }),
      null,
    );
  });

  it("play() rejection appends the one-time retry affordance", () => {
    assert.equal(
      fallbackLine({ failed: true, playRejected: true }),
      `${STORYTELLER_AUDIO_FALLBACK_LINE} ${STORYTELLER_RETRY_HINT}`,
    );
  });

  it("network error keeps the plain fallback", () => {
    assert.equal(
      fallbackLine({ failed: true, playRejected: false }),
      STORYTELLER_AUDIO_FALLBACK_LINE,
    );
  });

  it("the retry hint never device-shames", () => {
    assert.ok(
      !/device|phone|browser|upgrade|old|silent switch/i.test(
        STORYTELLER_RETRY_HINT,
      ),
    );
    assert.ok(
      !/device|phone|browser|upgrade|old/i.test(STORYTELLER_AUDIO_FALLBACK_LINE),
    );
  });
});
