import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  distanceToFrequencyKm,
  initAudio,
  isSoundEnabled,
  playCardTap,
  playConfirmGuess,
  playDeal,
  playDifficultySelect,
  playLose,
  playRingReveal,
  playWin,
  setSoundEnabled,
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
  assert.doesNotThrow(() => playDeal());
  assert.doesNotThrow(() => playCardTap());
  assert.doesNotThrow(() => playDifficultySelect());
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
