import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  REVEAL_WATCHDOG_MS,
  shouldArmRevealWatchdog,
} from "./reveal-watchdog.ts";
import { REVEAL_DURATION_MS } from "../map/zoom-space.ts";

describe("reveal watchdog contract", () => {
  it("waits comfortably longer than the longest legitimate reveal", () => {
    // The card must not appear mid-choreography: the watchdog may only fire
    // after any real reveal beat could have finished.
    assert.ok(
      REVEAL_WATCHDOG_MS > REVEAL_DURATION_MS * 2,
      `watchdog ${REVEAL_WATCHDOG_MS}ms must exceed 2x the reveal beat ${REVEAL_DURATION_MS}ms`,
    );
  });

  it("arms in the story phase with a place and no reveal yet", () => {
    assert.equal(shouldArmRevealWatchdog("story", true, false), true);
  });

  it("does not arm once the reveal completed", () => {
    assert.equal(shouldArmRevealWatchdog("story", true, true), false);
  });

  it("does not arm outside the story phase", () => {
    for (const phase of ["aim", "done", "summary"]) {
      assert.equal(
        shouldArmRevealWatchdog(phase, true, false),
        false,
        `phase ${phase} must not arm`,
      );
    }
  });

  it("does not arm when there is no place", () => {
    assert.equal(shouldArmRevealWatchdog("story", false, false), false);
  });
});
