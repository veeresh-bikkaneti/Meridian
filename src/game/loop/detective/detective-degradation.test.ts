import assert from "node:assert/strict";
import test from "node:test";

import {
  formatDegradation,
  resolveDetectiveDegradation,
  type DegradationInputs,
} from "./detective-degradation.ts";

/** The unconstrained baseline: every signal healthy → full/auto. */
const BASE: DegradationInputs = {
  reducedMotion: false,
  saveData: false,
  deviceMemory: 8,
  batterySaver: false,
  soundOn: true,
  autoSpeechAllowed: true,
};

const resolve = (patch: Partial<DegradationInputs>) =>
  resolveDetectiveDegradation({ ...BASE, ...patch });

test("matrix baseline: healthy signals → full / animated / auto", () => {
  assert.deepEqual(resolve({}), {
    companionMode: "full",
    walkMode: "animated",
    speechMode: "auto",
  });
});

test("matrix: reducedMotion alone → walk cut, audio unaffected", () => {
  assert.deepEqual(resolve({ reducedMotion: true }), {
    companionMode: "full",
    walkMode: "cut",
    speechMode: "auto",
  });
});

test("matrix: saveData alone → dock-only + speech tap", () => {
  assert.deepEqual(resolve({ saveData: true }), {
    companionMode: "dock-only",
    walkMode: "animated",
    speechMode: "tap",
  });
});

test("matrix: deviceMemory ≤ 4 alone → dock-only + speech tap", () => {
  for (const deviceMemory of [4, 2, 1]) {
    assert.deepEqual(resolve({ deviceMemory }), {
      companionMode: "dock-only",
      walkMode: "animated",
      speechMode: "tap",
    });
  }
  // Above the threshold, and the unknown (null) read, stay full.
  assert.equal(resolve({ deviceMemory: 8 }).companionMode, "full");
  assert.equal(resolve({ deviceMemory: null }).companionMode, "full");
  assert.equal(resolve({ deviceMemory: null }).speechMode, "auto");
});

test("matrix: batterySaver alone → dock-only + speech tap; null is no signal", () => {
  assert.deepEqual(resolve({ batterySaver: true }), {
    companionMode: "dock-only",
    walkMode: "animated",
    speechMode: "tap",
  });
  assert.deepEqual(resolve({ batterySaver: null }), {
    companionMode: "full",
    walkMode: "animated",
    speechMode: "auto",
  });
});

test("matrix: sound off alone → speech off, pair fully visual (modes otherwise full)", () => {
  assert.deepEqual(resolve({ soundOn: false }), {
    companionMode: "full",
    walkMode: "animated",
    speechMode: "off",
  });
});

test("matrix: autoSpeechAllowed false alone → speech tap, companion/walk untouched", () => {
  assert.deepEqual(resolve({ autoSpeechAllowed: false }), {
    companionMode: "full",
    walkMode: "animated",
    speechMode: "tap",
  });
});

test("matrix: combined worst case → dock-only / cut / off (sound off beats tap)", () => {
  assert.deepEqual(
    resolve({
      reducedMotion: true,
      saveData: true,
      deviceMemory: 2,
      batterySaver: true,
      soundOn: false,
      autoSpeechAllowed: false,
    }),
    { companionMode: "dock-only", walkMode: "cut", speechMode: "off" },
  );
});

test("matrix: reduced + constrained, sound on → dock-only / cut / tap", () => {
  assert.deepEqual(
    resolve({ reducedMotion: true, saveData: true, autoSpeechAllowed: false }),
    { companionMode: "dock-only", walkMode: "cut", speechMode: "tap" },
  );
});

test("format: the host-root summary attribute", () => {
  assert.equal(
    formatDegradation(resolve({})),
    "companion:full,walk:animated,speech:auto",
  );
  assert.equal(
    formatDegradation(
      resolve({ reducedMotion: true, deviceMemory: 4, soundOn: false }),
    ),
    "companion:dock-only,walk:cut,speech:off",
  );
});
