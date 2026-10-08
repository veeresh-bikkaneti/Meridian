import { strict as assert } from "node:assert";
import { test } from "node:test";
import { STARTING_STARS } from "./engine.ts";
import {
  COLDTRAIL_STORAGE_KEY,
  freshProgress,
  loadColdtrail,
  saveColdtrail,
} from "./store.ts";
import type { ColdTrailProgress, ColdTrailStore } from "./types.ts";

// localStorage is undefined under node:test; stub it per-test.
interface FakeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function stubStorage(initial: Record<string, string> = {}, throwing = false) {
  const data = { ...initial };
  const fake: FakeStorage = {
    getItem: (k) => (k in data ? data[k]! : null),
    setItem: (k, v) => {
      if (throwing) throw new Error("quota exceeded");
      data[k] = v;
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

const baseStore = (): ColdTrailStore => ({
  v: 1,
  caseIndex: 3,
  stars: 5,
  solved: 2,
  current: null,
});

test("freshProgress starts with zero rings, no guess, unrevealed", () => {
  const p = freshProgress();
  assert.deepEqual(p.ringsPlaced, [false, false, false]);
  assert.deepEqual(p.informantOn, [false, false, false]);
  assert.equal(p.guess, null);
  assert.equal(p.revealed, false);
  assert.equal(p.scoreKm, null);
});

test("storage key is namespaced and versioned", () => {
  assert.equal(COLDTRAIL_STORAGE_KEY, "meridian.coldtrail.v1");
});

test("loadColdtrail returns a fresh wallet when storage is empty", () => {
  const { restore } = stubStorage();
  try {
    const s = loadColdtrail();
    assert.equal(s.v, 1);
    assert.equal(s.caseIndex, 0);
    assert.equal(s.stars, STARTING_STARS);
    assert.equal(s.solved, 0);
    assert.equal(s.current, null);
  } finally {
    restore();
  }
});

test("loadColdtrail fails closed on corrupt JSON", () => {
  const { restore } = stubStorage({ [COLDTRAIL_STORAGE_KEY]: "{not json" });
  try {
    const s = loadColdtrail();
    assert.equal(s.stars, STARTING_STARS);
    assert.equal(s.current, null);
  } finally {
    restore();
  }
});

test("loadColdtrail fails closed on a version mismatch", () => {
  const { restore } = stubStorage({
    [COLDTRAIL_STORAGE_KEY]: JSON.stringify({ v: 999, caseIndex: 7, stars: 10 }),
  });
  try {
    const s = loadColdtrail();
    assert.equal(s.caseIndex, 0);
    assert.equal(s.stars, STARTING_STARS);
  } finally {
    restore();
  }
});

test("loadColdtrail sanitizes negative/invalid numbers to safe defaults", () => {
  const { restore } = stubStorage({
    [COLDTRAIL_STORAGE_KEY]: JSON.stringify({
      v: 1,
      caseIndex: -4,
      stars: -2,
      solved: "many",
      current: null,
    }),
  });
  try {
    const s = loadColdtrail();
    assert.equal(s.caseIndex, 0);
    assert.equal(s.stars, STARTING_STARS);
    assert.equal(s.solved, 0);
    assert.equal(s.current, null);
  } finally {
    restore();
  }
});

test("loadColdtrail rejects a malformed current progress (wrong array shapes)", () => {
  const { restore } = stubStorage({
    [COLDTRAIL_STORAGE_KEY]: JSON.stringify({
      v: 1,
      caseIndex: 0,
      stars: 2,
      solved: 0,
      current: { ringsPlaced: [true], informantOn: [false, false, false], guess: null, revealed: false, scoreKm: null },
    }),
  });
  try {
    assert.equal(loadColdtrail().current, null);
  } finally {
    restore();
  }
});

test("loadColdtrail rejects a guess with non-numeric coordinates", () => {
  const bad: ColdTrailProgress = {
    ringsPlaced: [true, true, true],
    informantOn: [false, false, false],
    guess: { lon: "x", lat: 1 } as unknown as { lon: number; lat: number },
    revealed: true,
    scoreKm: 10,
  };
  const { restore } = stubStorage({
    [COLDTRAIL_STORAGE_KEY]: JSON.stringify({ v: 1, caseIndex: 0, stars: 2, solved: 0, current: bad }),
  });
  try {
    assert.equal(loadColdtrail().current, null);
  } finally {
    restore();
  }
});

test("saveColdtrail round-trips the whole store including mid-case progress", () => {
  const { restore, data } = stubStorage();
  try {
    const current: ColdTrailProgress = {
      ringsPlaced: [true, true, false],
      informantOn: [true, false, false],
      guess: { lon: 12.5, lat: -44.1 },
      revealed: true,
      scoreKm: 87,
    };
    saveColdtrail({ ...baseStore(), current });
    assert.ok(data[COLDTRAIL_STORAGE_KEY], "persisted under the key");
    const back = loadColdtrail();
    assert.deepEqual(back.current, current);
    assert.equal(back.caseIndex, 3);
    assert.equal(back.stars, 5);
    assert.equal(back.solved, 2);
  } finally {
    restore();
  }
});

test("saveColdtrail swallows storage failures (game continues in memory)", () => {
  const { restore } = stubStorage({}, true);
  try {
    assert.doesNotThrow(() => saveColdtrail(baseStore()));
  } finally {
    restore();
  }
});

test("loadColdtrail is a no-op returning fresh when localStorage is absent", () => {
  assert.equal(typeof localStorage, "undefined");
  const s = loadColdtrail();
  assert.equal(s.stars, STARTING_STARS);
  assert.doesNotThrow(() => saveColdtrail(s));
});
