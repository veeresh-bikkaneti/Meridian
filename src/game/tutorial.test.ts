import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  TUTORIAL_SEEN_KEY,
  TUTORIAL_PLACE_ID,
  hasSeenTutorial,
  markTutorialSeen,
  clearTutorialSeen,
  isTutorialRunPool,
  type TutorialStorage,
} from "./tutorial.ts";

/** In-memory Storage stand-in (node --test has no DOM). */
function fakeStorage(initial: Record<string, string> = {}): TutorialStorage {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

function throwingStorage(): TutorialStorage {
  const boom = (): never => {
    throw new Error("storage unavailable");
  };
  return { getItem: boom, setItem: boom, removeItem: boom };
}

describe("tutorial seen flag", () => {
  it("reads unseen when the key is absent", () => {
    assert.equal(hasSeenTutorial(fakeStorage()), false);
  });

  it("reads seen after marking", () => {
    const store = fakeStorage();
    markTutorialSeen(store);
    assert.equal(store.getItem(TUTORIAL_SEEN_KEY), "1");
    assert.equal(hasSeenTutorial(store), true);
  });

  it("clears back to unseen", () => {
    const store = fakeStorage();
    markTutorialSeen(store);
    clearTutorialSeen(store);
    assert.equal(hasSeenTutorial(store), false);
  });

  it("ignores unrelated keys", () => {
    const store = fakeStorage({ "meridian.run": "{}" });
    assert.equal(hasSeenTutorial(store), false);
  });

  it("fail-closed: a throwing store reads as seen (never nags)", () => {
    assert.equal(hasSeenTutorial(throwingStorage()), true);
  });

  it("fail-closed: mark/clear never throw on a broken store", () => {
    const store = throwingStorage();
    assert.doesNotThrow(() => markTutorialSeen(store));
    assert.doesNotThrow(() => clearTutorialSeen(store));
  });

  it("fail-closed: null/undefined storage reads as seen, writes are no-ops", () => {
    assert.equal(hasSeenTutorial(null), true);
    assert.doesNotThrow(() => markTutorialSeen(null));
    assert.doesNotThrow(() => clearTutorialSeen(null));
  });
});

describe("isTutorialRunPool", () => {
  it("matches exactly the single tutorial place id", () => {
    assert.equal(isTutorialRunPool([TUTORIAL_PLACE_ID]), true);
  });

  it("rejects empty, multi-place, and other single-place pools", () => {
    assert.equal(isTutorialRunPool([]), false);
    assert.equal(isTutorialRunPool(["oia"]), false);
    assert.equal(isTutorialRunPool([TUTORIAL_PLACE_ID, "oia"]), false);
  });

  it("rejects null/undefined", () => {
    assert.equal(isTutorialRunPool(null), false);
    assert.equal(isTutorialRunPool(undefined), false);
  });
});
