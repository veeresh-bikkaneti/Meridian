import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { claimVoice, currentVoiceOwner, stopAllVoices } from "./voice-channel.ts";

afterEach(() => stopAllVoices());

test("a tap claim stops the holder first, then takes the channel", () => {
  const order: string[] = [];
  const a = claimVoice("grandpa", () => order.push("stop grandpa"), { userInitiated: false });
  assert.ok(a);
  const b = claimVoice("watson", () => order.push("stop watson"), { userInitiated: true });
  assert.ok(b);
  assert.deepEqual(order, ["stop grandpa"]);
  assert.equal(currentVoiceOwner(), "watson");
});

test("an autoplay claim during speech gets null and stops nobody", () => {
  let stopped = false;
  claimVoice("grandpa", () => (stopped = true), { userInitiated: true });
  const late = claimVoice("comet", () => {}, { userInitiated: false });
  assert.equal(late, null);
  assert.equal(stopped, false);
  assert.equal(currentVoiceOwner(), "grandpa");
});

test("an autoplay claim on a quiet channel succeeds", () => {
  assert.ok(claimVoice("comet", () => {}, { userInitiated: false }));
  assert.equal(currentVoiceOwner(), "comet");
});

test("a stale release (claim already stopped) is a no-op", () => {
  const old = claimVoice("grandpa", () => {}, { userInitiated: true })!;
  claimVoice("watson", () => {}, { userInitiated: true });
  old.release(); // must not vacate watson's hold
  assert.equal(currentVoiceOwner(), "watson");
  assert.equal(claimVoice("comet", () => {}, { userInitiated: false }), null);
});

test("release hands the channel back, and twice is harmless", () => {
  const c = claimVoice("grandpa", () => {}, { userInitiated: true })!;
  c.release();
  c.release();
  assert.equal(currentVoiceOwner(), null);
});

test("stopAllVoices stops the holder once and empties the channel", () => {
  let stops = 0;
  claimVoice("grandpa", () => stops++, { userInitiated: true });
  stopAllVoices();
  stopAllVoices();
  assert.equal(stops, 1);
  assert.equal(currentVoiceOwner(), null);
});

test("never two holders: a stop that throws still lets the new claim in", () => {
  claimVoice("grandpa", () => { throw new Error("boom"); }, { userInitiated: true });
  const next = claimVoice("watson", () => {}, { userInitiated: true });
  assert.ok(next);
  assert.equal(currentVoiceOwner(), "watson");
});
