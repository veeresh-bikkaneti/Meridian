import assert from "node:assert/strict";
import test from "node:test";

import {
  createCelebrationLinePlayer,
  type CelebrationLineDeps,
} from "./ui/summary-celebration-line.ts";
import type { DetectiveManifest } from "../game/loop/detective/detective-audio.ts";
import { stopAllVoices } from "../game/audio/voice-channel.ts";
import { createFakeVoicePort } from "../platform/audio/fake-voice.ts";

/**
 * Cure round (panel round 1, Game Audio MAJOR): the summary
 * celebration line used to gate once at start, keep no Audio handle
 * and subscribe to nothing — a mid-line mute never stopped it.
 * These tests drive the extracted player with fakes: the sound
 * channel is a manual listener set with the onSoundChanged shape,
 * the voice comes from the fake voice port (the same contract the
 * browser port honours), the manifest is in-memory.
 *
 * Ports slice: the player sounds through the voice port, not an
 * Audio element — a mid-line mute pauses the held voice and the
 * hoisted settle completes the play, since pause() fires no
 * callbacks. The fake port claims the real channel, so every test
 * stops all voices on its way out.
 */

const MANIFEST: DetectiveManifest = {
  v: 1,
  voices: { holmes: "holmes-voice", watson: "watson-voice" },
  fixed: {
    "score-celebration": {
      file: "fixed/score-celebration.mp3",
      voice: "holmes-voice",
    },
  },
  cases: {},
  names: {},
};

function fakeSoundChannel() {
  const listeners = new Set<(on: boolean) => void>();
  return {
    subscribe: (listener: (on: boolean) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit: (on: boolean) => {
      for (const l of [...listeners]) l(on);
    },
    count: () => listeners.size,
  };
}

const tick = () => new Promise((r) => setTimeout(r, 5));

function harness(overrides: {
  canAutoPlay?: () => boolean;
  soundEnabled?: () => boolean;
  loadManifest?: () => Promise<DetectiveManifest | null>;
  createVoice?: CelebrationLineDeps["createVoice"];
} = {}) {
  const channel = fakeSoundChannel();
  const { port, handles } = createFakeVoicePort({
    soundEnabled: () => true,
    audible: () => true,
  });
  const speaking: boolean[] = [];
  const player = createCelebrationLinePlayer({
    loadManifest: overrides.loadManifest ?? (async () => MANIFEST),
    createVoice: overrides.createVoice ?? port.createVoice,
    canAutoPlay: overrides.canAutoPlay ?? (() => true),
    audible: () => true,
    soundEnabled: overrides.soundEnabled ?? (() => true),
    subscribeSound: channel.subscribe,
  });
  return { player, channel, handles, speaking };
}

test("celebration line: the master toggle gates directly — autoplay verdict alone is not enough", async () => {
  // Regression for the unset-pref hole: detectiveCanAutoPlay
  // returns the band verdict without consulting the toggle when the
  // read-aloud preference is unset, so canAutoPlay reads true here
  // while the toggle is OFF — the line must still not start.
  const { player, handles } = harness({
    canAutoPlay: () => true,
    soundEnabled: () => false,
  });
  try {
    await player.play(
      () => false,
      () => {},
    );
    assert.deepEqual(handles, []);
  } finally {
    player.dispose();
    stopAllVoices();
  }
});

test("celebration line: gated off at start creates no voice and resolves", async () => {
  const { player, handles } = harness({ canAutoPlay: () => false });
  try {
    await player.play(
      () => false,
      () => {},
    );
    assert.deepEqual(handles, []);
  } finally {
    player.dispose();
    stopAllVoices();
  }
});

test("celebration line: the gate is re-checked after the manifest await", async () => {
  let gate = true;
  let resolveManifest: (m: DetectiveManifest | null) => void = () => {};
  const manifestPromise = new Promise<DetectiveManifest | null>((r) => {
    resolveManifest = r;
  });
  const { player, handles } = harness({
    canAutoPlay: () => gate,
    loadManifest: () => manifestPromise,
  });
  try {
    const done = player.play(
      () => false,
      () => {},
    );
    await tick();
    gate = false; // the mute lands while the manifest is loading
    resolveManifest(MANIFEST);
    await done;
    assert.deepEqual(handles, []); // the line never started
  } finally {
    player.dispose();
    stopAllVoices();
  }
});

test("celebration line: a mid-line sound-off pauses the held voice and settles the play", async () => {
  const { player, channel, handles, speaking } = harness();
  try {
    let settled = false;
    const done = player
      .play(
        () => false,
        (s) => speaking.push(s),
      )
      .then(() => {
        settled = true;
      });
    await tick();
    assert.equal(handles.length, 1);
    assert.equal(handles[0]!.pauseCalls, 0);
    assert.deepEqual(speaking, [true]);
    channel.emit(false); // the mute
    await done;
    assert.equal(handles[0]!.pauseCalls, 1);
    assert.equal(settled, true); // the driver is not left waiting
    assert.deepEqual(speaking, [true, false]);
  } finally {
    player.dispose();
    stopAllVoices();
  }
});

test("celebration line: dispose mid-line pauses the held voice exactly once and settles the play", async () => {
  const { player, handles, speaking } = harness();
  try {
    let settled = false;
    const done = player
      .play(
        () => false,
        (s) => speaking.push(s),
      )
      .then(() => {
        settled = true;
      });
    await tick();
    assert.equal(handles.length, 1);
    assert.equal(handles[0]!.pauseCalls, 0);
    assert.deepEqual(speaking, [true]);
    player.dispose(); // unmount while the line is still playing
    await done;
    assert.equal(handles[0]!.pauseCalls, 1);
    assert.equal(settled, true); // the driver is not left waiting
    assert.deepEqual(speaking, [true, false]);
    player.dispose(); // idempotent — no second pause
    assert.equal(handles[0]!.pauseCalls, 1);
  } finally {
    stopAllVoices();
  }
});

test("celebration line: dispose with no playback does not throw and does not pause", async () => {
  const { player, channel, handles } = harness();
  try {
    assert.doesNotThrow(() => player.dispose());
    assert.deepEqual(handles, []);
    assert.equal(channel.count(), 0);
    assert.doesNotThrow(() => player.dispose());
  } finally {
    stopAllVoices();
  }
});

test("celebration line: dispose unsubscribes from the sound channel", async () => {
  const { player, channel } = harness();
  try {
    assert.equal(channel.count(), 1);
    player.dispose();
    assert.equal(channel.count(), 0);
  } finally {
    stopAllVoices();
  }
});

test("celebration line: a normal ending settles without any pause", async () => {
  const { player, handles, speaking } = harness();
  try {
    const done = player.play(
      () => false,
      (s) => speaking.push(s),
    );
    await tick();
    assert.equal(handles.length, 1);
    handles[0]!.simulateEnded();
    await done;
    assert.equal(handles[0]!.pauseCalls, 0);
    assert.deepEqual(speaking, [true, false]);
  } finally {
    player.dispose();
    stopAllVoices();
  }
});

test("celebration line: an erroring clip settles without any pause", async () => {
  const { player, handles, speaking } = harness();
  try {
    const done = player.play(
      () => false,
      (s) => speaking.push(s),
    );
    await tick();
    assert.equal(handles.length, 1);
    handles[0]!.simulateError();
    await done;
    assert.equal(handles[0]!.pauseCalls, 0);
    assert.deepEqual(speaking, [true, false]);
  } finally {
    player.dispose();
    stopAllVoices();
  }
});

test("celebration line: a refused channel claim stays silent and resolves", async () => {
  const { player, speaking } = harness({ createVoice: () => null });
  try {
    await player.play(
      () => false,
      (s) => speaking.push(s),
    );
    assert.deepEqual(speaking, []); // never started speaking
  } finally {
    player.dispose();
    stopAllVoices();
  }
});
