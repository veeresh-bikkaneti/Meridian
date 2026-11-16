/**
 * Item 7 (INV1): a failed load does not restore on the next visit.
 *
 * Boot restores GeoDetective / Cold Trail from a persisted open
 * flag: `readLoopOpen()` / `readColdTrailOpen()` are the exact
 * readers game-app's first render uses. These tests drive the
 * failure path MapErrorBoundary drives — seed the flag (the tap
 * that opened the screen), run the catch-time clear, then read
 * the flag back the way the next visit's boot would.
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  COLDTRAIL_OPEN_KEY,
  readColdTrailOpen,
  writeColdTrailOpen,
} from "../game/coldtrail/store.ts";
import { readLoopOpen, writeLoopOpen } from "../game/loop/store.ts";
import { LOOP_OPEN_KEY } from "../game/loop/types.ts";
import {
  clearPersistedScreenOpen,
  isPersistedScreen,
  rearmPersistedScreenOpen,
} from "./persisted-screen.ts";

// localStorage is undefined under node:test; stub it per-test
// (the coldtrail store.test.ts pattern).
interface FakeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function stubStorage(initial: Record<string, string> = {}, throwing = false) {
  const data = { ...initial };
  const fake: FakeStorage = {
    getItem: (k) => (k in data ? data[k]! : null),
    setItem: (k, v) => {
      if (throwing) throw new Error("quota exceeded");
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
  const prev = (globalThis as Record<string, unknown>).localStorage;
  (globalThis as Record<string, unknown>).localStorage = fake;
  return {
    data,
    restore: () => {
      (globalThis as Record<string, unknown>).localStorage = prev;
    },
  };
}

test("a failed Cold Trail load does not restore on the next visit", () => {
  // The card tap persisted the open flag, then the load failed.
  const s = stubStorage({ [COLDTRAIL_OPEN_KEY]: "1" });
  try {
    assert.equal(readColdTrailOpen(), true, "seeded flag restores the screen (the trap)");
    clearPersistedScreenOpen("Cold Trail");
    assert.equal(
      readColdTrailOpen(),
      false,
      "after a failed load, the next visit's boot read must not restore Cold Trail",
    );
  } finally {
    s.restore();
  }
});

test("a failed GeoDetective load does not restore on the next visit", () => {
  const s = stubStorage({ [LOOP_OPEN_KEY]: "1" });
  try {
    assert.equal(readLoopOpen(), true, "seeded flag restores the screen (the trap)");
    clearPersistedScreenOpen("GeoDetective");
    assert.equal(
      readLoopOpen(),
      false,
      "after a failed load, the next visit's boot read must not restore GeoDetective",
    );
  } finally {
    s.restore();
  }
});

test("clearing one failed screen leaves the other screen's flag alone", () => {
  const s = stubStorage({ [COLDTRAIL_OPEN_KEY]: "1", [LOOP_OPEN_KEY]: "1" });
  try {
    clearPersistedScreenOpen("Cold Trail");
    assert.equal(readColdTrailOpen(), false);
    assert.equal(readLoopOpen(), true, "GeoDetective's flag is not Cold Trail's to clear");
  } finally {
    s.restore();
  }
});

test("Try again re-arms the failed screen so the retry reload restores it once", () => {
  const s = stubStorage({ [COLDTRAIL_OPEN_KEY]: "1" });
  try {
    clearPersistedScreenOpen("Cold Trail");
    assert.equal(readColdTrailOpen(), false);
    rearmPersistedScreenOpen("Cold Trail");
    assert.equal(readColdTrailOpen(), true, "the player's own retry restores the screen");
  } finally {
    s.restore();
  }
});

test("surfaces with no persisted flag are a no-op and never throw", () => {
  const s = stubStorage({ [COLDTRAIL_OPEN_KEY]: "1", [LOOP_OPEN_KEY]: "1" });
  try {
    assert.equal(isPersistedScreen("Cold Trail"), true);
    assert.equal(isPersistedScreen("GeoDetective"), true);
    assert.equal(isPersistedScreen("Subjects"), false);
    assert.equal(isPersistedScreen("the map"), false);
    assert.equal(isPersistedScreen(undefined), false);
    clearPersistedScreenOpen("Subjects");
    clearPersistedScreenOpen(undefined);
    rearmPersistedScreenOpen(undefined);
    assert.equal(readColdTrailOpen(), true);
    assert.equal(readLoopOpen(), true);
  } finally {
    s.restore();
  }
});

test("storage failures stay fail-open: the clear and re-arm never throw", () => {
  const s = stubStorage({ [COLDTRAIL_OPEN_KEY]: "1" }, true);
  try {
    clearPersistedScreenOpen("Cold Trail");
    rearmPersistedScreenOpen("GeoDetective");
    writeColdTrailOpen(true);
    writeLoopOpen(false);
  } finally {
    s.restore();
  }
});
