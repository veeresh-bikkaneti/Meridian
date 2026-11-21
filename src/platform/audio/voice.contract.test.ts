import assert from "node:assert/strict";
import test, { afterEach, describe } from "node:test";

import {
  currentVoiceOwner,
  stopAllVoices,
} from "../../game/audio/voice-channel.ts";
import { createBrowserVoicePort, createVoice } from "./browser-voice.ts";
import { createFakeVoicePort, type FakeVoiceHandle } from "./fake-voice.ts";
import type {
  CreateVoiceOptions,
  VoiceAudioElement,
  VoiceHandle,
  VoicePort,
} from "./voice.ts";

/**
 * Contract tests for the Phase 1 audio port. One shared scenario
 * suite runs against both implementations: the browser port driven
 * by a recording fake element, and the in-memory fake port driven
 * by its simulate API. Both share the real voice channel, so
 * channel ownership is asserted through currentVoiceOwner().
 */

afterEach(() => stopAllVoices());

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((r) => setImmediate(r));
};

interface Counts {
  ended: number;
  error: number;
  interrupted: number;
  times: number[];
}

function trackedOpts(owner: string, userInitiated: boolean) {
  const counts: Counts = { ended: 0, error: 0, interrupted: 0, times: [] };
  const opts: CreateVoiceOptions = {
    owner,
    userInitiated,
    onEnded: () => counts.ended++,
    onError: () => counts.error++,
    onInterrupted: () => counts.interrupted++,
    onTimeUpdate: (s) => counts.times.push(s),
  };
  return { opts, counts };
}

class FakeAudioElement implements VoiceAudioElement {
  src: string;
  currentTime = 0;
  playCalls = 0;
  pauseCalls = 0;
  removedAttributes: string[] = [];
  rejectNextPlay = false;
  private handlers = new Map<string, Set<() => void>>();

  constructor(src: string) {
    this.src = src;
  }

  play(): Promise<void> {
    this.playCalls++;
    if (this.rejectNextPlay) {
      this.rejectNextPlay = false;
      return Promise.reject(new Error("play rejected"));
    }
    return Promise.resolve();
  }

  pause(): void {
    this.pauseCalls++;
  }

  removeAttribute(name: string): void {
    this.removedAttributes.push(name);
  }

  addEventListener(type: string, listener: () => void): void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(listener);
  }

  removeEventListener(type: string, listener: () => void): void {
    this.handlers.get(type)?.delete(listener);
  }

  fire(type: string): void {
    for (const listener of [...(this.handlers.get(type) ?? [])]) listener();
  }
}

interface Ctl {
  isBrowser: boolean;
  playCalls(): number;
  pauseCalls(): number;
  removedSrc(): boolean;
  armPlayRejection(): void;
  triggerPlayRejection(): void;
  simulateReady(): void;
  simulatePlaying(): void;
  simulateTimeUpdate(t: number): void;
  simulateEnded(): void;
  simulateError(): void;
}

interface Created {
  handle: VoiceHandle | null;
  ctl: Ctl | null;
}

interface Harness {
  port: VoicePort;
  createdCount(): number;
  create(src: string, opts: CreateVoiceOptions): Created;
}

interface Driver {
  name: string;
  setup(deps?: {
    soundEnabled?: () => boolean;
    audible?: () => boolean;
  }): Harness;
}

const browserDriver: Driver = {
  name: "browser voice port",
  setup(deps) {
    const elements: FakeAudioElement[] = [];
    const port = createBrowserVoicePort({
      createAudio: (src) => {
        const el = new FakeAudioElement(src);
        elements.push(el);
        return el;
      },
      soundEnabled: deps?.soundEnabled,
      audible: deps?.audible,
    });
    return {
      port,
      createdCount: () => elements.length,
      create(src, opts) {
        const handle = port.createVoice(src, opts);
        if (!handle) return { handle: null, ctl: null };
        const el = elements[elements.length - 1]!;
        const ctl: Ctl = {
          isBrowser: true,
          playCalls: () => el.playCalls,
          pauseCalls: () => el.pauseCalls,
          removedSrc: () => el.removedAttributes.includes("src"),
          armPlayRejection: () => {
            el.rejectNextPlay = true;
          },
          triggerPlayRejection: () => {},
          simulateReady: () => el.fire("canplay"),
          simulatePlaying: () => el.fire("playing"),
          simulateTimeUpdate: (t) => {
            el.currentTime = t;
            el.fire("timeupdate");
          },
          simulateEnded: () => el.fire("ended"),
          simulateError: () => el.fire("error"),
        };
        return { handle, ctl };
      },
    };
  },
};

const fakeDriver: Driver = {
  name: "fake voice port",
  setup(deps) {
    const { port, handles } = createFakeVoicePort(deps);
    return {
      port,
      createdCount: () => handles.length,
      create(src, opts) {
        const handle = port.createVoice(src, opts);
        if (!handle) return { handle: null, ctl: null };
        const fake: FakeVoiceHandle = handles[handles.length - 1]!;
        const ctl: Ctl = {
          isBrowser: false,
          playCalls: () => fake.playCalls,
          pauseCalls: () => 0,
          removedSrc: () => false,
          armPlayRejection: () => {},
          triggerPlayRejection: () => fake.simulatePlayRejection(),
          simulateReady: () => fake.simulateReady(),
          simulatePlaying: () => fake.simulatePlaying(),
          simulateTimeUpdate: (t) => fake.simulateTimeUpdate(t),
          simulateEnded: () => fake.simulateEnded(),
          simulateError: () => fake.simulateError(),
        };
        return { handle, ctl };
      },
    };
  },
};

function mustCreate(harness: Harness, src: string, opts: CreateVoiceOptions) {
  const { handle, ctl } = harness.create(src, opts);
  assert.ok(handle);
  assert.ok(ctl);
  return { handle, ctl };
}

function toPlaying(harness: Harness, owner: string) {
  const tracked = trackedOpts(owner, true);
  const { handle, ctl } = mustCreate(harness, `${owner}.mp3`, tracked.opts);
  handle.play();
  ctl.simulateReady();
  ctl.simulatePlaying();
  assert.equal(handle.state, "playing");
  return { handle, ctl, counts: tracked.counts };
}

for (const driver of [browserDriver, fakeDriver]) {
  describe(driver.name, () => {
    test("createVoice on a quiet channel returns an idle handle and claims the channel", () => {
      const harness = driver.setup();
      const { opts } = trackedOpts("clue-scene", false);
      const { handle } = mustCreate(harness, "line.mp3", opts);
      assert.equal(handle.state, "idle");
      assert.equal(currentVoiceOwner(), "clue-scene");
    });

    test("a non-userInitiated createVoice while another voice holds the channel returns null and interrupts nobody", () => {
      const harness = driver.setup();
      const first = toPlaying(harness, "first");
      const late = trackedOpts("late", false);
      const { handle } = harness.create("late.mp3", late.opts);
      assert.equal(handle, null);
      assert.equal(first.handle.state, "playing");
      assert.equal(first.counts.interrupted, 0);
      assert.equal(currentVoiceOwner(), "first");
    });

    test("a userInitiated createVoice interrupts a playing handle exactly once", () => {
      const harness = driver.setup();
      const first = toPlaying(harness, "first");
      const second = trackedOpts("second", true);
      const { handle } = mustCreate(harness, "second.mp3", second.opts);
      assert.ok(handle);
      assert.equal(first.handle.state, "interrupted");
      assert.equal(first.counts.interrupted, 1);
      if (first.ctl.isBrowser) assert.equal(first.ctl.pauseCalls(), 1);
      assert.equal(currentVoiceOwner(), "second");
    });

    test("play() calls the element's play() synchronously, then loading -> ready -> playing", () => {
      const harness = driver.setup();
      const { opts } = trackedOpts("clue-scene", true);
      const { handle, ctl } = mustCreate(harness, "line.mp3", opts);
      handle.play();
      // No await has happened: the call must already have landed (iOS).
      assert.equal(ctl.playCalls(), 1);
      assert.equal(handle.state, "loading");
      ctl.simulateReady();
      assert.equal(handle.state, "ready");
      ctl.simulatePlaying();
      assert.equal(handle.state, "playing");
    });

    test("time updates report the element's currentTime", () => {
      const harness = driver.setup();
      const { handle, ctl, counts } = toPlaying(harness, "clue-scene");
      ctl.simulateTimeUpdate(3.25);
      ctl.simulateTimeUpdate(4.5);
      assert.deepEqual(counts.times, [3.25, 4.5]);
      assert.equal(handle.currentTime(), 4.5);
    });

    test("ended: state ended, onEnded exactly once, channel released", () => {
      const harness = driver.setup();
      const { handle, ctl, counts } = toPlaying(harness, "clue-scene");
      ctl.simulateEnded();
      assert.equal(handle.state, "ended");
      assert.equal(counts.ended, 1);
      assert.equal(currentVoiceOwner(), null);
      ctl.simulateEnded();
      assert.equal(counts.ended, 1);
    });

    test("error event: state error, onError exactly once, channel released", () => {
      const harness = driver.setup();
      const { handle, ctl, counts } = toPlaying(harness, "clue-scene");
      ctl.simulateError();
      assert.equal(handle.state, "error");
      assert.equal(counts.error, 1);
      assert.equal(currentVoiceOwner(), null);
      ctl.simulateError();
      assert.equal(counts.error, 1);
    });

    test("play() promise rejection: state error, onError once, channel released", async () => {
      const harness = driver.setup();
      const { opts, counts } = trackedOpts("clue-scene", true);
      const { handle, ctl } = mustCreate(harness, "line.mp3", opts);
      ctl.armPlayRejection();
      handle.play();
      ctl.triggerPlayRejection();
      await flush();
      assert.equal(handle.state, "error");
      assert.equal(counts.error, 1);
      assert.equal(currentVoiceOwner(), null);
    });

    test("stop() during play: aborted, element torn down, channel released, no callbacks; second stop is a no-op", () => {
      const harness = driver.setup();
      const { handle, ctl, counts } = toPlaying(harness, "clue-scene");
      handle.stop();
      assert.equal(handle.state, "aborted");
      assert.equal(currentVoiceOwner(), null);
      assert.equal(counts.ended, 0);
      assert.equal(counts.error, 0);
      assert.equal(counts.interrupted, 0);
      if (ctl.isBrowser) {
        assert.ok(ctl.pauseCalls() >= 1);
        assert.equal(ctl.removedSrc(), true);
      }
      const pauses = ctl.pauseCalls();
      handle.stop();
      assert.equal(handle.state, "aborted");
      assert.equal(ctl.pauseCalls(), pauses);
      assert.equal(counts.ended + counts.error + counts.interrupted, 0);
    });

    test("gate: soundEnabled() false returns null, claims nothing, creates nothing", () => {
      const harness = driver.setup({ soundEnabled: () => false });
      const { opts } = trackedOpts("clue-scene", true);
      const { handle } = harness.create("line.mp3", opts);
      assert.equal(handle, null);
      assert.equal(harness.createdCount(), 0);
      assert.equal(currentVoiceOwner(), null);
    });

    test("gate: audible() false returns null, claims nothing, creates nothing", () => {
      const harness = driver.setup({ audible: () => false });
      const { opts } = trackedOpts("clue-scene", true);
      const { handle } = harness.create("line.mp3", opts);
      assert.equal(handle, null);
      assert.equal(harness.createdCount(), 0);
      assert.equal(currentVoiceOwner(), null);
    });

    test("play() on a terminal (ended) handle is a no-op", () => {
      const harness = driver.setup();
      const { handle, ctl } = toPlaying(harness, "clue-scene");
      ctl.simulateEnded();
      assert.equal(handle.state, "ended");
      const calls = ctl.playCalls();
      handle.play();
      assert.equal(ctl.playCalls(), calls);
      assert.equal(handle.state, "ended");
    });
  });
}

describe("browser voice port without a DOM Audio constructor", () => {
  test("createVoice with no injected createAudio in node returns null instead of throwing", () => {
    const port = createBrowserVoicePort();
    const { opts } = trackedOpts("clue-scene", true);
    let handle: VoiceHandle | null = null;
    assert.doesNotThrow(() => {
      handle = port.createVoice("line.mp3", opts);
    });
    assert.equal(handle, null);
    assert.equal(currentVoiceOwner(), null);
  });

  test("the default createVoice export also returns null instead of throwing", () => {
    const { opts } = trackedOpts("clue-scene", true);
    let handle: VoiceHandle | null = null;
    assert.doesNotThrow(() => {
      handle = createVoice("line.mp3", opts);
    });
    assert.equal(handle, null);
    assert.equal(currentVoiceOwner(), null);
  });
});
