import { strict as assert } from "node:assert";
import { test } from "node:test";
import { playCough, playTrail } from "./grandpa-ask.ts";

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
    play(): Promise<void> {
      return Promise.resolve();
    }
    pause(): void {}
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
