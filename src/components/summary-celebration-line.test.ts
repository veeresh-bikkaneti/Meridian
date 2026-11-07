import assert from "node:assert/strict";
import test from "node:test";

import {
  createCelebrationLinePlayer,
  type CelebrationAudioElement,
} from "./summary-celebration-line.ts";
import type { DetectiveManifest } from "../game/loop/detective/detective-audio.ts";

/**
 * Cure round (panel round 1, Game Audio MAJOR): the summary
 * celebration line used to gate once at start, keep no Audio handle
 * and subscribe to nothing — a mid-line mute never stopped it.
 * These tests drive the extracted player with fakes: the sound
 * channel is a manual listener set with the onSoundChanged shape,
 * Audio is a recording fake, the manifest is in-memory.
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

class FakeAudio implements CelebrationAudioElement {
  private handlers = new Map<string, () => void>();
  paused = false;
  pauseCalls = 0;
  url: string;
  constructor(url: string) {
    this.url = url;
  }
  addEventListener(type: string, fn: () => void) {
    this.handlers.set(type, fn);
  }
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.pauseCalls += 1;
    this.paused = true;
    this.handlers.get("pause")?.();
  }
  end() {
    this.handlers.get("ended")?.();
  }
}

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
} = {}) {
  const channel = fakeSoundChannel();
  const audios: FakeAudio[] = [];
  const speaking: boolean[] = [];
  const player = createCelebrationLinePlayer({
    loadManifest: overrides.loadManifest ?? (async () => MANIFEST),
    createAudio: (url) => {
      const a = new FakeAudio(url);
      audios.push(a);
      return a;
    },
    canAutoPlay: overrides.canAutoPlay ?? (() => true),
    audible: () => true,
    soundEnabled: overrides.soundEnabled ?? (() => true),
    subscribeSound: channel.subscribe,
  });
  return { player, channel, audios, speaking };
}

test("celebration line: the master toggle gates directly — autoplay verdict alone is not enough", async () => {
  // Regression for the unset-pref hole: detectiveCanAutoPlay
  // returns the band verdict without consulting the toggle when the
  // read-aloud preference is unset, so canAutoPlay reads true here
  // while the toggle is OFF — the line must still not start.
  const { player, audios } = harness({
    canAutoPlay: () => true,
    soundEnabled: () => false,
  });
  await player.play(
    () => false,
    () => {},
  );
  assert.deepEqual(audios, []);
  player.dispose();
});

test("celebration line: gated off at start creates no Audio and resolves", async () => {
  const { player, audios } = harness({ canAutoPlay: () => false });
  await player.play(
    () => false,
    () => {},
  );
  assert.deepEqual(audios, []);
  player.dispose();
});

test("celebration line: the gate is re-checked after the manifest await", async () => {
  let gate = true;
  let resolveManifest: (m: DetectiveManifest | null) => void = () => {};
  const manifestPromise = new Promise<DetectiveManifest | null>((r) => {
    resolveManifest = r;
  });
  const { player, audios } = harness({
    canAutoPlay: () => gate,
    loadManifest: () => manifestPromise,
  });
  const done = player.play(
    () => false,
    () => {},
  );
  await tick();
  gate = false; // the mute lands while the manifest is loading
  resolveManifest(MANIFEST);
  await done;
  assert.deepEqual(audios, []); // the line never started
  player.dispose();
});

test("celebration line: a mid-line sound-off pauses the held element and settles the play", async () => {
  const { player, channel, audios, speaking } = harness();
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
  assert.equal(audios.length, 1);
  assert.equal(audios[0]!.paused, false);
  assert.deepEqual(speaking, [true]);
  channel.emit(false); // the mute
  await done;
  assert.equal(audios[0]!.pauseCalls, 1);
  assert.equal(settled, true); // the driver is not left waiting
  assert.deepEqual(speaking, [true, false]);
  player.dispose();
});

test("celebration line: dispose mid-line pauses the held element exactly once and settles the play", async () => {
  const { player, audios, speaking } = harness();
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
  assert.equal(audios.length, 1);
  assert.equal(audios[0]!.paused, false);
  assert.deepEqual(speaking, [true]);
  player.dispose(); // unmount while the line is still playing
  await done;
  assert.equal(audios[0]!.pauseCalls, 1);
  assert.equal(settled, true); // the driver is not left waiting
  assert.deepEqual(speaking, [true, false]);
  player.dispose(); // idempotent — no second pause
  assert.equal(audios[0]!.pauseCalls, 1);
});

test("celebration line: dispose with no playback does not throw and does not pause", async () => {
  const { player, channel, audios } = harness();
  assert.doesNotThrow(() => player.dispose());
  assert.deepEqual(audios, []);
  assert.equal(channel.count(), 0);
  assert.doesNotThrow(() => player.dispose());
});

test("celebration line: dispose unsubscribes from the sound channel", async () => {
  const { player, channel } = harness();
  assert.equal(channel.count(), 1);
  player.dispose();
  assert.equal(channel.count(), 0);
});

test("celebration line: a normal ending settles without any pause", async () => {
  const { player, audios, speaking } = harness();
  const done = player.play(
    () => false,
    (s) => speaking.push(s),
  );
  await tick();
  assert.equal(audios.length, 1);
  audios[0]!.end();
  await done;
  assert.equal(audios[0]!.pauseCalls, 0);
  assert.deepEqual(speaking, [true, false]);
  player.dispose();
});
