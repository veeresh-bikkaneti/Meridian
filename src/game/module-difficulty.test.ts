import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DIFFICULTY_HINTS,
  getModuleDifficulty,
  isModuleId,
  MODULE_DIFFICULTY,
  PICKER_DIFFICULTIES,
} from "./module-difficulty.ts";
import { isPickerDifficulty } from "./tier-filter.ts";

describe("MODULE_DIFFICULTY registry (FW-11.1)", () => {
  it("declares all eight modules", () => {
    assert.deepEqual(Object.keys(MODULE_DIFFICULTY).sort(), [
      "challenge",
      "coldtrail",
      "country",
      "geodetective",
      "globe",
      "review",
      "state",
      "subjects",
    ]);
  });

  it("MapTap editions show the picker on all three levels, default medium", () => {
    for (const moduleId of ["globe", "country", "state"] as const) {
      const entry = getModuleDifficulty(moduleId);
      assert.equal(entry.showsPicker, true, moduleId);
      assert.deepEqual(entry.supported, ["easy", "medium", "hard"]);
      assert.equal(entry.defaultChoice, "medium");
      assert.equal(entry.hints, DIFFICULTY_HINTS);
    }
  });

  it("GeoDetective, Cold Trail, Subjects, Review and Challenge are picker stubs", () => {
    for (const moduleId of [
      "geodetective",
      "coldtrail",
      "subjects",
      "review",
      "challenge",
    ] as const) {
      const entry = getModuleDifficulty(moduleId);
      assert.equal(entry.showsPicker, false, moduleId);
      assert.deepEqual(entry.supported, []);
      assert.equal(entry.defaultChoice, "medium");
    }
  });

  it("keeps the home hero's hint copy verbatim", () => {
    assert.equal(
      DIFFICULTY_HINTS.easy,
      "Famous places — the spots every explorer starts with.",
    );
    assert.equal(
      DIFFICULTY_HINTS.medium,
      "A little of everything — grow your map one discovery at a time.",
    );
    assert.equal(
      DIFFICULTY_HINTS.hard,
      "Hidden corners of the world — for explorers ready to discover more.",
    );
    for (const choice of PICKER_DIFFICULTIES) {
      assert.equal(isPickerDifficulty(choice), true);
    }
  });

  it("isModuleId accepts only the eight module ids", () => {
    assert.equal(isModuleId("globe"), true);
    assert.equal(isModuleId("challenge"), true);
    assert.equal(isModuleId("easy"), false);
    assert.equal(isModuleId(""), false);
    assert.equal(isModuleId(undefined), false);
  });
});
