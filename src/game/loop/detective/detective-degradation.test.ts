import assert from "node:assert/strict";
import test from "node:test";

import {
  formatDegradation,
  resolveDetectiveDegradation,
  resolveSummaryCelebrationMode,
  watsonReplayCueVisible,
  WATSON_REPLAY_PHASES,
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

/* ------------------------------------------------------------------ */
/* Unit A — tap-Watson replay cue visibility                           */
/* ------------------------------------------------------------------ */

const cue = (patch: Partial<Parameters<typeof watsonReplayCueVisible>[0]> = {}) =>
  watsonReplayCueVisible({
    phase: "READING",
    watsonPlacement: "station",
    hidden: false,
    speechMode: "auto",
    ...patch,
  });

test("Unit A cue: the phase set is exactly the Listen button's phases", () => {
  assert.deepEqual(
    [...WATSON_REPLAY_PHASES].sort(),
    ["READING", "SEARCH_AREA", "SEARCH_IDLE", "THINKING_BEAT"],
  );
});

test("Unit A cue: present at the station in clue phases, in auto and tap modes", () => {
  for (const phase of ["READING", "THINKING_BEAT"]) {
    for (const speechMode of ["auto", "tap"] as const) {
      assert.equal(cue({ phase, speechMode }), true, `${phase}/${speechMode}`);
    }
  }
});

test("Unit A cue: present at the dock in guessing phases", () => {
  for (const phase of ["SEARCH_IDLE", "SEARCH_AREA"]) {
    assert.equal(cue({ phase, watsonPlacement: "dock" }), true, phase);
  }
});

test("Unit A cue: absent whenever Watson is absent — hidden view or hidden placement", () => {
  // Sheet / rings / external speech own the screen (the view's hidden
  // flag): no Watson, no cue, no replay surface.
  assert.equal(cue({ hidden: true }), false);
  assert.equal(cue({ phase: "SEARCH_IDLE", watsonPlacement: "dock", hidden: true }), false);
  assert.equal(cue({ watsonPlacement: "hidden" }), false);
});

test("Unit A cue: absent in off speech mode (nothing is held to replay)", () => {
  assert.equal(cue({ speechMode: "off" }), false);
  assert.equal(cue({ phase: "SEARCH_IDLE", watsonPlacement: "dock", speechMode: "off" }), false);
});

test("Unit A cue: absent outside the clue/guessing phases, even with Watson at the station", () => {
  for (const phase of [
    "CASE_OPEN",
    "SELECTION_READ",
    "NOTE_MARK",
    "ASK_NEXT",
    "CELEBRATE",
    "FAIL_READ",
    "POUT",
    "DEBRIEF",
    "OFF",
  ]) {
    assert.equal(cue({ phase }), false, phase);
  }
});

/* -- Unit B: summary celebration mode -------------------------------- */

const summaryMode = (patch: Partial<{ reducedMotion: boolean; saveData: boolean; deviceMemory: number | null }>) =>
  resolveSummaryCelebrationMode({
    reducedMotion: false,
    saveData: false,
    deviceMemory: 8,
    ...patch,
  });

test("Unit B summary mode: healthy signals → animated", () => {
  assert.equal(summaryMode({}), "animated");
  assert.equal(summaryMode({ deviceMemory: null }), "animated");
});

test("Unit B summary mode: reduced motion → static (no motion, no audio)", () => {
  assert.equal(summaryMode({ reducedMotion: true }), "static");
});

test("Unit B summary mode: Save-Data → static", () => {
  assert.equal(summaryMode({ saveData: true }), "static");
});

test("Unit B summary mode: low memory (≤ 4 GB) → static; above → animated", () => {
  assert.equal(summaryMode({ deviceMemory: 4 }), "static");
  assert.equal(summaryMode({ deviceMemory: 2 }), "static");
  assert.equal(summaryMode({ deviceMemory: 8 }), "animated");
});
