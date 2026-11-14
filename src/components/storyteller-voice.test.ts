import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { claimVoice, currentVoiceOwner, stopAllVoices } from "../game/audio/voice-channel.ts";
import { claimStorytellerVoice } from "./storyteller-voice.ts";

afterEach(() => stopAllVoices());

test("resume after takeover claims the channel and stops the other voice", () => {
  const leftover = claimStorytellerVoice(null, () => {}, { userInitiated: true });
  assert.ok(leftover);
  assert.equal(currentVoiceOwner(), "storyteller");

  let otherStopped = false;
  const other = claimVoice("watson", () => {
    otherStopped = true;
  }, { userInitiated: true });
  assert.ok(other);
  assert.equal(currentVoiceOwner(), "watson");

  // The component still holds the stale leftover claim after the stop
  // callback paused it. Resume must go through claimStorytellerVoice so
  // Watson shuts up before the storyteller plays again.
  const resumed = claimStorytellerVoice(leftover, () => {}, { userInitiated: true });
  assert.ok(resumed);
  assert.equal(otherStopped, true);
  assert.equal(currentVoiceOwner(), "storyteller");
});

test("a leftover release after takeover does not vacate the resumed claim", () => {
  const leftover = claimStorytellerVoice(null, () => {}, { userInitiated: true });
  assert.ok(leftover);
  claimVoice("watson", () => {}, { userInitiated: true });

  const resumed = claimStorytellerVoice(leftover, () => {}, { userInitiated: true });
  assert.ok(resumed);
  leftover.release();
  assert.equal(currentVoiceOwner(), "storyteller");
});
