import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  distanceToFrequencyKm,
  initAudio,
  isSoundEnabled,
  playCardTap,
  playConfettiPop,
  playConfirmGuess,
  playDeal,
  playDifficultySelect,
  playEditionEntrance,
  playGrandFanfare,
  playLose,
  playMediumApplause,
  playNextPlace,
  playPinDropFail,
  playPinDropPass,
  playRingReveal,
  playSmallCheer,
  playToastChime,
  playWin,
  setSoundEnabled,
  startGlobeSpin,
  stopGlobeSpin,
} from "./sfx.ts";

// Node has no DOM: provide a minimal localStorage so toggle persistence
// can be exercised. The module must also survive with NO localStorage at
// all (that's the SSR/jsdom case) — see the no-crash tests below.
function stubStorage(): Map<string, string> {
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
  return data;
}

function unplugStorage(): void {
  delete (globalThis as Record<string, unknown>).localStorage;
}

test("distanceToFrequencyKm: spec endpoints", () => {
  assert.equal(distanceToFrequencyKm(1), 1568); // G6
  assert.equal(distanceToFrequencyKm(20000), 98); // G2
});

test("distanceToFrequencyKm: clamps outside [1, 20000]", () => {
  assert.equal(distanceToFrequencyKm(0), 1568);
  assert.equal(distanceToFrequencyKm(-5), 1568);
  assert.equal(distanceToFrequencyKm(50000), 98);
  assert.equal(distanceToFrequencyKm(1_000_000), 98);
});

test("distanceToFrequencyKm: monotonically decreasing", () => {
  const samples = [1, 2, 5, 10, 42, 100, 250, 500, 1000, 1500, 2500, 4000, 6000, 9000, 12000, 15000, 18000, 20000];
  let prev = Infinity;
  for (const d of samples) {
    const f = distanceToFrequencyKm(d);
    assert.ok(f < prev, `${d} km -> ${f} Hz must be below previous ${prev} Hz`);
    prev = f;
  }
});

test("distanceToFrequencyKm: worked examples within rounding tolerance", () => {
  // Spec §2.2 worked examples: 42 km → 550 Hz · 1500 km → 202 Hz ·
  // 9000 km → 123 Hz. The authoritative formula is round(1568 * d^-0.28),
  // which yields 551 for 42 km (±1 of the worked example) — the formula is
  // followed verbatim per the §7 don't-re-tune rule.
  assert.ok(Math.abs(distanceToFrequencyKm(42) - 550) <= 1);
  assert.ok(Math.abs(distanceToFrequencyKm(1500) - 202) <= 1);
  assert.ok(Math.abs(distanceToFrequencyKm(9000) - 123) <= 1);
});

test("distanceToFrequencyKm: all fundamentals in the mobile-speaker band", () => {
  for (let d = 1; d <= 20000; d *= 1.7) {
    const f = distanceToFrequencyKm(d);
    assert.ok(f >= 98 && f <= 1600, `${d} km -> ${f} Hz out of 98–1600 Hz`);
  }
});

test("sound toggle: default ON with empty storage", () => {
  stubStorage();
  assert.equal(isSoundEnabled(), true);
});

test("sound toggle: persistence round-trip", () => {
  stubStorage();
  setSoundEnabled(false);
  assert.equal(isSoundEnabled(), false);
  assert.equal(
    (globalThis as Record<string, unknown>).localStorage &&
      ((globalThis as Record<string, unknown>).localStorage as Storage).getItem("meridian.sound"),
    "off",
  );
  setSoundEnabled(true);
  assert.equal(isSoundEnabled(), true);
  assert.equal(
    ((globalThis as Record<string, unknown>).localStorage as Storage).getItem("meridian.sound"),
    "on",
  );
});

test("sound toggle: garbage value reads as off, missing reads as on", () => {
  const data = stubStorage();
  data.set("meridian.sound", "maybe");
  assert.equal(isSoundEnabled(), false);
  data.delete("meridian.sound");
  assert.equal(isSoundEnabled(), true);
});

test("no AudioContext: initAudio and all play functions are safe no-ops", () => {
  unplugStorage(); // no localStorage, no window, no AudioContext — the SSR case
  assert.doesNotThrow(() => initAudio());
  assert.doesNotThrow(() => initAudio()); // idempotent second call
  assert.doesNotThrow(() => playConfirmGuess());
  assert.doesNotThrow(() => playRingReveal(42));
  assert.doesNotThrow(() => playRingReveal(0));
  assert.doesNotThrow(() => playRingReveal(20000));
  assert.doesNotThrow(() => playWin());
  assert.doesNotThrow(() => playLose());
  assert.doesNotThrow(() => playEditionEntrance());
  assert.doesNotThrow(() => playDeal());
  assert.doesNotThrow(() => playCardTap());
  assert.doesNotThrow(() => playDifficultySelect());
});

test("no AudioContext: celebration sounds and spin are safe no-ops", () => {
  unplugStorage(); // no localStorage, no window, no AudioContext — the SSR case
  assert.doesNotThrow(() => {
    // Starting the spin before initAudio() must be a null-path no-op.
    startGlobeSpin();
    stopGlobeSpin();
    startGlobeSpin();
    stopGlobeSpin();
    playPinDropPass();
    playPinDropFail();
    playNextPlace();
    playSmallCheer();
    playMediumApplause();
    playGrandFanfare();
    playToastChime();
    playConfettiPop();
  });
  // stopGlobeSpin with no active loop stays a no-op.
  assert.doesNotThrow(() => stopGlobeSpin());
});

test("no AudioContext: toggle reads/writes never throw without storage", () => {
  unplugStorage();
  assert.doesNotThrow(() => setSoundEnabled(false));
  assert.doesNotThrow(() => setSoundEnabled(true));
  // Default ON when storage is absent entirely.
  assert.equal(isSoundEnabled(), true);
});

test("sound disabled: play functions short-circuit silently", () => {
  stubStorage();
  setSoundEnabled(false);
  assert.doesNotThrow(() => {
    playConfirmGuess();
    playRingReveal(100);
    playWin();
    playLose();
    playDeal();
    playCardTap();
    playDifficultySelect();
  });
  setSoundEnabled(true);
});

test("sound disabled: celebration play functions short-circuit silently", () => {
  stubStorage();
  setSoundEnabled(false);
  assert.doesNotThrow(() => {
    playPinDropPass();
    playPinDropFail();
    startGlobeSpin(); // dropped by the admitLoop sound check
    stopGlobeSpin();
    playNextPlace();
    playSmallCheer();
    playMediumApplause();
    playGrandFanfare();
    playToastChime();
    playConfettiPop();
  });
  setSoundEnabled(true);
});

// ---------------------------------------------------------------------------
// Celebration tests with a tracked AudioContext fake.
// The module's ctx persists across tests (initAudio is idempotent), so these
// run BEFORE the Math.random test below and leave the tracked fake as the
// module's context — the later test's sounds then schedule on it harmlessly
// (it asserts zero Math.random draws, which this fake never makes).
// ---------------------------------------------------------------------------

interface TrackedSource {
  buffer: unknown;
  loop: boolean;
  stopCalled: boolean;
  connect(): void;
  start(): void;
  stop(): void;
}

class TrackedFakeAudioContext {
  /** Every instance constructed (initAudio news exactly one). */
  static instances: TrackedFakeAudioContext[] = [];
  currentTime = 0;
  state = "running";
  sampleRate = 44100;
  destination = {};
  /** Every osc frequency setValueAtTime, in call order. */
  oscFreqs: number[] = [];
  /** Every buffer source created, in call order. */
  sources: TrackedSource[] = [];
  constructor() {
    TrackedFakeAudioContext.instances.push(this);
  }
  resume() {
    return Promise.resolve();
  }
  private param(onSet?: (v: number) => void) {
    const p = {
      value: 0,
      setValueAtTime(v: number) {
        p.value = v;
        onSet?.(v);
      },
      linearRampToValueAtTime(v: number) {
        p.value = v;
      },
      exponentialRampToValueAtTime(v: number) {
        p.value = v;
      },
      setTargetAtTime() {},
      cancelScheduledValues() {},
    };
    return p;
  }
  createGain() {
    return { gain: this.param(), connect() {}, disconnect() {} };
  }
  createOscillator() {
    const self = this;
    return {
      type: "sine" as OscillatorType,
      frequency: this.param((v) => self.oscFreqs.push(v)),
      detune: this.param(),
      connect() {},
      start() {},
      stop() {},
    };
  }
  createBiquadFilter() {
    return {
      type: "lowpass" as BiquadFilterType,
      frequency: this.param(),
      Q: this.param(),
      connect() {},
    };
  }
  createDynamicsCompressor() {
    return {
      threshold: this.param(),
      knee: this.param(),
      ratio: this.param(),
      attack: this.param(),
      release: this.param(),
      connect() {},
    };
  }
  createBuffer(_ch: number, len: number, _rate: number) {
    return { getChannelData: () => new Float32Array(len) };
  }
  createBufferSource(): TrackedSource {
    const self = this;
    const s: TrackedSource = {
      buffer: null,
      loop: false,
      stopCalled: false,
      connect() {},
      start() {},
      stop() {
        s.stopCalled = true;
      },
    };
    self.sources.push(s);
    return s;
  }
}

function withTrackedAudio(): TrackedFakeAudioContext {
  stubStorage();
  setSoundEnabled(true);
  (globalThis as Record<string, unknown>).window = {
    AudioContext: TrackedFakeAudioContext,
  };
  // initAudio constructs exactly one fake (idempotent afterwards); grab it.
  initAudio();
  const inst = TrackedFakeAudioContext.instances[TrackedFakeAudioContext.instances.length - 1];
  assert.ok(inst, "initAudio should construct the tracked fake");
  return inst;
}

function withoutAudio(): void {
  delete (globalThis as Record<string, unknown>).window;
  unplugStorage();
}

test("globe spin start/stop is idempotent", () => {
  const fake = withTrackedAudio();
  try {
    const before = fake.sources.length;
    startGlobeSpin();
    startGlobeSpin(); // restart cuts the previous loop immediately
    const loops = fake.sources.slice(before).filter((s) => s.loop);
    assert.equal(loops.length, 2, "two loop sources created across the restart");
    const live = loops.filter((s) => !s.stopCalled);
    assert.equal(live.length, 1, "exactly one spin loop stays live after restart");
    stopGlobeSpin();
    assert.equal(live[0].stopCalled, true, "stop ends the live loop");
    assert.doesNotThrow(() => stopGlobeSpin()); // second stop is a no-op
  } finally {
    stopGlobeSpin(); // clears the 30 s backstop timer
    withoutAudio();
  }
});

test("pinDrop pass/fail have distinct fundamentals", () => {
  const fake = withTrackedAudio();
  try {
    playPinDropPass();
    const passFreqs = [...fake.oscFreqs];
    fake.oscFreqs.length = 0;
    playPinDropFail();
    const failFreqs = [...fake.oscFreqs];
    // Pass glides 392 → 440 (±2% jitter); fail falls 247 → 220.
    assert.ok(
      passFreqs.some((f) => f > 380 && f < 402),
      `pass fundamentals near 392 Hz, got [${passFreqs}]`,
    );
    assert.ok(
      failFreqs.some((f) => f > 240 && f < 254),
      `fail fundamentals near 247 Hz, got [${failFreqs}]`,
    );
    const lo = Math.min(...passFreqs);
    const hi = Math.max(...failFreqs);
    assert.ok(hi < lo, `fail max ${hi} Hz must sit below pass min ${lo} Hz`);
  } finally {
    withoutAudio();
  }
});

test("ring steals spin (admitLoop steal ordering)", () => {
  const fake = withTrackedAudio();
  try {
    startGlobeSpin();
    const spinSrc = fake.sources[fake.sources.length - 1];
    assert.ok(spinSrc.loop, "spin uses a looping buffer source");
    assert.equal(spinSrc.stopCalled, false);
    // Fill the remaining 7 of 8 voices with distinct low-priority UI keys.
    playCardTap();
    playConfirmGuess();
    playDifficultySelect();
    playNextPlace();
    playToastChime();
    playConfettiPop();
    playPinDropPass();
    // Ring (priority 3) steals the oldest lowest-priority voice — the spin.
    playRingReveal(42);
    assert.equal(spinSrc.stopCalled, true, "ring reveal steals the globe spin");
    // A stolen spin does NOT auto-restart.
    assert.ok(
      !fake.sources.some((s) => s.loop && !s.stopCalled && s !== spinSrc),
      "no replacement spin loop was started",
    );
  } finally {
    stopGlobeSpin(); // clears the 30 s backstop; no-op if already stolen
    withoutAudio();
    setSoundEnabled(true);
  }
});

test("setSoundEnabled(false) stops the active spin", () => {
  const fake = withTrackedAudio();
  try {
    startGlobeSpin();
    const spinSrc = fake.sources[fake.sources.length - 1];
    assert.ok(spinSrc.loop);
    setSoundEnabled(false);
    assert.equal(spinSrc.stopCalled, true, "disabling sound stops the spin loop");
    assert.doesNotThrow(() => stopGlobeSpin());
  } finally {
    setSoundEnabled(true);
    stopGlobeSpin();
    withoutAudio();
  }
});

test("setSoundEnabled(false) cancels speechSynthesis narration (owner 2026-10-09: mute is the only off switch for Always)", () => {
  let cancelCalls = 0;
  let eventFired = false;
  const origWindow = (globalThis as Record<string, unknown>).window;
  (globalThis as Record<string, unknown>).window = {
    speechSynthesis: {
      cancel: () => {
        cancelCalls += 1;
      },
    },
    dispatchEvent: (e: Event) => {
      if (e.type === "meridian:sound-off") eventFired = true;
      return true;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  try {
    setSoundEnabled(false);
    assert.equal(cancelCalls, 1, "muting cancels in-progress narration");
    assert.equal(eventFired, true, "muting notifies speech-holding UI");
  } finally {
    if (origWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      (globalThis as Record<string, unknown>).window = origWindow;
    }
    setSoundEnabled(true);
  }
});

test("celebration sounds never draw from the global Math.random sequence", () => {
  // Same regression as the shipped-sounds test: all jitter goes through the
  // module-local PRNG (sfxRandom), never the mockable global.
  let draws = 0;
  const origRandom = Math.random;
  (Math as unknown as { random: () => number }).random = () => {
    draws++;
    return origRandom();
  };
  withTrackedAudio();
  try {
    playPinDropPass(); // jittered
    playPinDropFail(); // jittered
    startGlobeSpin();
    stopGlobeSpin();
    playNextPlace(); // jittered
    playSmallCheer(); // deterministic
    playMediumApplause(); // deterministic
    playGrandFanfare(); // deterministic
    playToastChime(); // jittered
    playConfettiPop(); // jittered
    assert.equal(draws, 0, `expected zero Math.random draws, saw ${draws}`);
  } finally {
    (Math as unknown as { random: () => number }).random = origRandom;
    withoutAudio();
  }
});

test("sfx never draws from the global Math.random sequence", () => {
  // Regression: deterministic-deal E2E tests mock Math.random with a
  // stateful sequence, and one jitter draw shifted a seeded deal's true
  // spot (Hungary -> Iran). All sfx randomness goes through a module-local
  // PRNG instead.
  let draws = 0;
  const origRandom = Math.random;
  (Math as unknown as { random: () => number }).random = () => {
    draws++;
    return origRandom();
  };
  // Minimal AudioContext fake so the play functions schedule for real.
  const param = () => {
    const p = { value: 0 };
    return {
      ...p,
      setValueAtTime(v: number) {
        p.value = v;
      },
      linearRampToValueAtTime(v: number) {
        p.value = v;
      },
      exponentialRampToValueAtTime(v: number) {
        p.value = v;
      },
      setTargetAtTime() {},
    };
  };
  const node = () => ({ connect() {} });
  const srcNode = () => ({ connect() {}, start() {}, stop() {} });
  class FakeAudioContext {
    currentTime = 0;
    state = "running";
    sampleRate = 44100;
    destination = {};
    resume() {
      return Promise.resolve();
    }
    createGain() {
      return { ...node(), gain: param() };
    }
    createOscillator() {
      return { ...srcNode(), type: "sine", frequency: param(), detune: param() };
    }
    createBiquadFilter() {
      return { ...node(), type: "lowpass", frequency: param(), Q: param() };
    }
    createDynamicsCompressor() {
      return {
        ...node(),
        threshold: param(),
        knee: param(),
        ratio: param(),
        attack: param(),
        release: param(),
      };
    }
    createBuffer(_ch: number, len: number, _rate: number) {
      return { getChannelData: () => new Float32Array(len) };
    }
    createBufferSource() {
      return { ...srcNode(), buffer: null };
    }
  }
  (globalThis as Record<string, unknown>).window = {
    AudioContext: FakeAudioContext,
  };
  try {
    stubStorage();
    setSoundEnabled(true);
    initAudio();
    playConfirmGuess();
    playRingReveal(42);
    playRingReveal(9000);
    playWin();
    playLose();
    playDeal(); // builds the cached noise buffer — must not draw either
    playCardTap();
    playDifficultySelect();
    assert.equal(draws, 0, `expected zero Math.random draws, saw ${draws}`);
  } finally {
    (Math as unknown as { random: () => number }).random = origRandom;
    delete (globalThis as Record<string, unknown>).window;
    unplugStorage();
  }
});
