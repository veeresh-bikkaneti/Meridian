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
  consumeRetryScreen,
  isPersistedScreen,
  rearmPersistedScreenOpen,
} from "./persisted-screen.ts";
import { setLocalBackend, setSessionBackend } from "../game/storage-slot.ts";

// localStorage is undefined under node:test; stub it per-test
// (the coldtrail store.test.ts pattern). The helpers drive BOTH the
// global and the storage slot: persisted-screen itself reads the
// session slot, while the open-flag readers it delegates to still
// read the global until their own conversion lands.
interface FakeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function slotBackend(data: Record<string, string>, throwing = false) {
  return {
    getItem: (k: string) => (k in data ? data[k]! : null),
    setItem: (k: string, v: string) => {
      if (throwing) throw new Error("quota exceeded");
      data[k] = v;
    },
    removeItem: (k: string) => {
      delete data[k];
    },
    get length(): number {
      return Object.keys(data).length;
    },
    key: (index: number): string | null => Object.keys(data)[index] ?? null,
  };
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
  setLocalBackend(slotBackend(data, throwing));
  return {
    data,
    restore: () => {
      (globalThis as Record<string, unknown>).localStorage = prev;
      setLocalBackend(undefined);
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

/**
 * The 368 rule (owner condition, Stream N Phase 2): a bare visit to
 * `/` always lands on Home even if a case was left open, while the
 * error screen's Try again still reloads into that case. Boot's
 * restore decision is consumeRetryScreen() — these tests drive it
 * the way game-app's first render does.
 */
function stubSession(initial: Record<string, string> = {}) {
  const data = { ...initial };
  const fake: FakeStorage = {
    getItem: (k) => (k in data ? data[k]! : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
  const prev = (globalThis as Record<string, unknown>).sessionStorage;
  (globalThis as Record<string, unknown>).sessionStorage = fake;
  setSessionBackend(slotBackend(data));
  return {
    data,
    restore: () => {
      (globalThis as Record<string, unknown>).sessionStorage = prev;
      setSessionBackend(undefined);
    },
  };
}

/** Fill ONLY the session slot (no global): proves the retry marker is slot-driven. */
function stubSessionSlotOnly(initial: Record<string, string> = {}) {
  const data = { ...initial };
  setSessionBackend(slotBackend(data));
  return {
    data,
    restore: () => {
      setSessionBackend(undefined);
    },
  };
}

test("368 rule: a bare visit lands on Home even with both cases left open", () => {
  const s = stubStorage({ [COLDTRAIL_OPEN_KEY]: "1", [LOOP_OPEN_KEY]: "1" });
  const sess = stubSession();
  try {
    // Both open flags set (cases left open), no retry marker:
    // boot restores nothing — the visit lands on Home.
    assert.equal(consumeRetryScreen(), null);
    assert.equal(consumeRetryScreen(), null, "still nothing on a second read");
  } finally {
    s.restore();
    sess.restore();
  }
});

test("368 rule: Try again reloads into the failed case, exactly once", () => {
  const s = stubStorage({ [COLDTRAIL_OPEN_KEY]: "1" });
  const sess = stubSession();
  try {
    // The boundary's catch clears the flag; Try again re-arms.
    clearPersistedScreenOpen("Cold Trail");
    rearmPersistedScreenOpen("Cold Trail");
    // The retry reload's boot restores Cold Trail…
    assert.equal(consumeRetryScreen(), "Cold Trail");
    // …and only that once: a later bare visit lands on Home.
    assert.equal(consumeRetryScreen(), null);
  } finally {
    s.restore();
    sess.restore();
  }
});

test("368 rule: a retry marker for an unknown surface restores nothing", () => {
  const sess = stubSession({ "meridian.retry-screen": "Subjects" });
  try {
    assert.equal(consumeRetryScreen(), null);
  } finally {
    sess.restore();
  }
});

test("slot-only session: the retry marker round-trips through the session slot", () => {
  // The open flag still comes from the stubbed global (its reader's
  // conversion lands separately); the retry marker must come from
  // the session slot alone — no global sessionStorage is stubbed here.
  const s = stubStorage({ [COLDTRAIL_OPEN_KEY]: "1" });
  const sess = stubSessionSlotOnly();
  try {
    rearmPersistedScreenOpen("Cold Trail");
    assert.equal(consumeRetryScreen(), "Cold Trail");
    assert.equal(consumeRetryScreen(), null, "the marker is one-shot");
  } finally {
    s.restore();
    sess.restore();
  }
});

test("F1a: clearing a failed screen also clears the retry marker (Home cannot resurrect it)", () => {
  const s = stubStorage({ [LOOP_OPEN_KEY]: "1" });
  const sess = stubSession();
  try {
    // Try again on a previous failure armed the one-shot marker…
    rearmPersistedScreenOpen("GeoDetective");
    // …then the screen failed again and the player chose Home: the
    // catch-time / goHome clear must disarm the marker too, or the
    // next boot would restore the broken screen anyway.
    clearPersistedScreenOpen("GeoDetective");
    assert.equal(consumeRetryScreen(), null, "the retry marker is cleared with the open flag");
  } finally {
    s.restore();
    sess.restore();
  }
});
