import { currentVoiceOwner } from "../../tests/harness/module-seams.ts";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { playCough, playTrail } from "./grandpa-ask.ts";
import {
  stopAllVoices,
} from "../game/audio/voice-channel.ts";
import {
  setLocalBackend,
  type GameEnumerableStorageBackend,
} from "../game/storage-slot.ts";

// ---------------------------------------------------------------------------
// Old-Safari-semantics AudioContext fake.
//
// The point of this fake: every node's connect() returns UNDEFINED. That
// is what old Safari did (WebKit bug 188834 — iOS/desktop Safari 11), what
// the E2E stub in tests/e2e/sfx-stub.ts does, and what the sfx.test.ts
// fake does. Modern browsers return the destination node instead — which
// is exactly the difference that hid the chained-connect() crash in
// playCough() from every modern-browser check while the stubbed E2E
// families (motionmaxxing, cleared-mode applause) failed on main.
//
// grandpa-ask keeps ONE shared context per module load, so the fake's
// source registry is cumulative across this file's tests; assert deltas.
// ---------------------------------------------------------------------------

interface FakeSource {
  buffer: unknown;
  startCalled: boolean;
  connect(): void;
  start(): void;
}

class OldSafariFakeAudioContext {
  static instances: OldSafariFakeAudioContext[] = [];

  sampleRate = 44100;
  destination = {};
  sources: FakeSource[] = [];

  constructor() {
    OldSafariFakeAudioContext.instances.push(this);
  }

  resume(): Promise<void> {
    return Promise.resolve();
  }

  createBuffer(_channels: number, length: number, _sampleRate: number) {
    return { getChannelData: () => new Float32Array(length) };
  }

  createBufferSource(): FakeSource {
    const src: FakeSource = {
      buffer: null,
      startCalled: false,
      connect() {},
      start() {
        src.startCalled = true;
      },
    };
    this.sources.push(src);
    return src;
  }

  createBiquadFilter() {
    return {
      type: "bandpass" as BiquadFilterType,
      frequency: { value: 0 },
      Q: { value: 0 },
      connect() {},
    };
  }

  createGain() {
    return { gain: { value: 0 }, connect() {} };
  }
}

function stubStorage(): void {
  const data = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => (data.has(k) ? (data.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      data.set(k, String(v));
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
    clear: () => data.clear(),
  };
}

/** Install the old-Safari window (and a silent HTMLAudioElement stand-in
 * for playFile's narration clip). Returns the shared fake context once
 * the module has constructed it. */
function withOldSafariAudio(): void {
  stubStorage();
  (globalThis as Record<string, unknown>).window = {
    AudioContext: OldSafariFakeAudioContext,
    // playFile arms a delayed narration play; the timer never fires in
    // these tests — the cough (synchronous) is what is under test.
    setTimeout: () => 0,
    clearTimeout: () => {},
  };
  (globalThis as Record<string, unknown>).Audio = class {
    currentTime = 0;
    duration = NaN;
    play(): Promise<void> {
      return Promise.resolve();
    }
    pause(): void {}
    removeAttribute(): void {}
    addEventListener(): void {}
    removeEventListener(): void {}
  };
}

function withoutAudio(): void {
  delete (globalThis as Record<string, unknown>).window;
  delete (globalThis as Record<string, unknown>).Audio;
  delete (globalThis as Record<string, unknown>).localStorage;
}

function sharedCtx(): OldSafariFakeAudioContext {
  const inst =
    OldSafariFakeAudioContext.instances[OldSafariFakeAudioContext.instances.length - 1];
  assert.ok(inst, "the module should have constructed the fake context");
  return inst;
}

test("playCough: does not throw when connect() returns undefined (old-Safari semantics)", () => {
  withOldSafariAudio();
  try {
    assert.doesNotThrow(() => playCough());
    const ctx = sharedCtx();
    assert.equal(ctx.sources.length, 1, "one cough source created");
    assert.equal(ctx.sources[0]!.startCalled, true, "the cough source was started");
  } finally {
    withoutAudio();
  }
});

test("playTrail: the cough under a trail line does not throw under the same semantics", () => {
  withOldSafariAudio();
  try {
    const before = sharedCtx().sources.length;
    assert.doesNotThrow(() => playTrail(0));
    const ctx = sharedCtx();
    assert.equal(ctx.sources.length, before + 1, "playTrail's cough created a source");
    assert.equal(
      ctx.sources[ctx.sources.length - 1]!.startCalled,
      true,
      "playTrail's cough source was started",
    );
  } finally {
    withoutAudio();
  }
});

// ---------------------------------------------------------------------------
// Ports slice: the sound toggle is read through the storage slot now
// (isSoundEnabled), not the global localStorage — a slot-registered OFF
// must silence both the cough and the clip. And the delayed clip play
// still goes through the voice port: the 420ms cough delay, then play,
// then the ended event releases the channel.
// ---------------------------------------------------------------------------

function totalCoughSources(): number {
  return OldSafariFakeAudioContext.instances.reduce(
    (n, inst) => n + inst.sources.length,
    0,
  );
}

function slotBackend(data: Map<string, string>): GameEnumerableStorageBackend {
  return {
    getItem: (k: string) => (data.has(k) ? (data.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
  };
}

class CountingAudio {
  static constructions = 0;
  constructor() {
    CountingAudio.constructions += 1;
  }
  play(): Promise<void> {
    return Promise.resolve();
  }
  pause(): void {}
}

test("playTrail: a slot-registered sound toggle OFF silences the line and the cough", () => {
  stopAllVoices(); // clear any claim the earlier tests left held
  withOldSafariAudio();
  (globalThis as Record<string, unknown>).Audio = CountingAudio;
  setLocalBackend(
    slotBackend(new Map<string, string>([["meridian.sound", "off"]])),
  );
  try {
    const sourcesBefore = totalCoughSources();
    const audioBefore = CountingAudio.constructions;
    playTrail(0);
    assert.equal(totalCoughSources(), sourcesBefore, "no cough while muted");
    assert.equal(
      CountingAudio.constructions,
      audioBefore,
      "no clip element while muted",
    );
    assert.equal(currentVoiceOwner(), null, "no channel claim while muted");
  } finally {
    setLocalBackend(undefined);
    withoutAudio();
    stopAllVoices();
  }
});

class RecordingAudio {
  static instances: RecordingAudio[] = [];
  src: string;
  currentTime = 0;
  duration = NaN;
  playCalls = 0;
  pauseCalls = 0;
  // The narration clip wires ended/error as element PROPERTIES
  // (audio.onended), not listeners — the fake honours both shapes.
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private handlers = new Map<string, Set<() => void>>();
  constructor(src: string) {
    this.src = src;
    RecordingAudio.instances.push(this);
  }
  play(): Promise<void> {
    this.playCalls += 1;
    return Promise.resolve();
  }
  pause(): void {
    this.pauseCalls += 1;
  }
  removeAttribute(): void {}
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
    if (type === "ended") this.onended?.();
    if (type === "error") this.onerror?.();
    for (const listener of [...(this.handlers.get(type) ?? [])]) listener();
  }
}

test("playTrail: the clip plays after the cough delay and the ended event releases the channel", () => {
  stopAllVoices();
  const timers: Array<() => void> = [];
  (globalThis as Record<string, unknown>).window = {
    AudioContext: OldSafariFakeAudioContext,
    setTimeout: (cb: () => void) => {
      timers.push(cb);
      return timers.length;
    },
    clearTimeout: () => {},
  };
  (globalThis as Record<string, unknown>).Audio = RecordingAudio;
  try {
    const before = RecordingAudio.instances.length;
    playTrail(0);
    assert.equal(
      RecordingAudio.instances.length,
      before + 1,
      "one clip element built",
    );
    const clip = RecordingAudio.instances[before]!;
    assert.equal(clip.playCalls, 0, "nothing plays before the cough delay");
    assert.equal(timers.length, 1, "the cough delay is armed");
    timers[0]!();
    assert.equal(clip.playCalls, 1, "the clip plays after the delay");
    clip.fire("ended");
    assert.equal(currentVoiceOwner(), null, "the ended clip releases the channel");
  } finally {
    withoutAudio();
    stopAllVoices();
  }
});
