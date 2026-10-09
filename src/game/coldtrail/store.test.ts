import { strict as assert } from "node:assert";
import { test } from "node:test";
import { STARTING_STARS } from "./engine.ts";
import {
  COLDTRAIL_STORAGE_KEY,
  freshProgress,
  loadColdtrail,
  saveColdtrail,
  takeLegacyMigrationNotice,
} from "./store.ts";
import type { ColdTrailProgress, ColdTrailStore } from "./types.ts";

// localStorage is undefined under node:test; stub it per-test.
interface FakeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const LEGACY_KEY = "meridian.coldtrail.v1";

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

const baseStore = (): ColdTrailStore => ({
  v: 2,
  caseIndex: 3,
  stars: 5,
  solved: 2,
  current: null,
});

test("freshProgress starts with zero rings, no guess, unrevealed", () => {
  const p = freshProgress();
  assert.deepEqual(p.ringsPlaced, [false, false, false]);
  assert.deepEqual(p.informantOn, [false, false, false]);
  assert.deepEqual(p.ringCenters, [null, null, null]);
  assert.equal(p.guess, null);
  assert.equal(p.revealed, false);
  assert.equal(p.scoreKm, null);
});

test("storage key is namespaced and versioned", () => {
  assert.equal(COLDTRAIL_STORAGE_KEY, "meridian.coldtrail.v2");
});

test("fresh store carries v2", () => {
  const { restore } = stubStorage();
  try {
    assert.equal(loadColdtrail().v, 2);
  } finally {
    restore();
  }
});

test("loadColdtrail returns a fresh wallet when storage is empty", () => {
  const { restore } = stubStorage();
  try {
    const s = loadColdtrail();
    assert.equal(s.v, 2);
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
      v: 2,
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
      v: 2,
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
    ringCenters: [{ lon: 1, lat: 1 }, { lon: 2, lat: 2 }, { lon: 3, lat: 3 }],
    guess: { lon: "x", lat: 1 } as unknown as { lon: number; lat: number },
    revealed: true,
    scoreKm: 10,
  };
  const { restore } = stubStorage({
    [COLDTRAIL_STORAGE_KEY]: JSON.stringify({ v: 2, caseIndex: 0, stars: 2, solved: 0, current: bad }),
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
      ringCenters: [{ lon: 12.5, lat: -44.1 }, { lon: -3.2, lat: 51.5 }, null],
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

// ---- v2 ringCenters validation ----

function v2Progress(overrides: Partial<ColdTrailProgress> = {}): ColdTrailProgress {
  return {
    ringsPlaced: [false, false, false],
    informantOn: [false, false, false],
    ringCenters: [null, null, null],
    guess: null,
    revealed: false,
    scoreKm: null,
    ...overrides,
  };
}

function loadWithCurrent(current: unknown) {
  const { restore } = stubStorage({
    [COLDTRAIL_STORAGE_KEY]: JSON.stringify({ v: 2, caseIndex: 0, stars: 2, solved: 0, current }),
  });
  try {
    return loadColdtrail().current;
  } finally {
    restore();
  }
}

test("v2 accepts locked rings with player-chosen centers", () => {
  const current = v2Progress({
    ringsPlaced: [true, false, true],
    ringCenters: [{ lon: -104.9, lat: 39.7 }, null, { lon: 2.35, lat: 48.85 }],
  });
  assert.deepEqual(loadWithCurrent(current), current);
});

test("v2 rejects ringCenters with the wrong shape", () => {
  assert.equal(loadWithCurrent(v2Progress({ ringCenters: [{ lon: 1, lat: 1 }] as never })), null);
  assert.equal(
    loadWithCurrent(v2Progress({ ringCenters: [null, null, "x"] as never })),
    null,
  );
});

test("v2 rejects ringCenters with non-finite coordinates", () => {
  assert.equal(
    loadWithCurrent(
      v2Progress({ ringCenters: [{ lon: NaN, lat: 1 }, null, null] }),
    ),
    null,
  );
  assert.equal(
    loadWithCurrent(
      v2Progress({ ringCenters: [{ lon: Infinity, lat: 1 }, null, null] }),
    ),
    null,
  );
});

test("v2 rejects a locked ring with a null center (impossible state)", () => {
  // ringsPlaced=true but ringCenters=null can only come from corruption:
  // the only writer commits both atomically.
  assert.equal(
    loadWithCurrent(v2Progress({ ringsPlaced: [true, false, false] })),
    null,
  );
});

test("v2 normalizes stored centers (lon wrapped, lat clamped)", () => {
  const back = loadWithCurrent(
    v2Progress({ ringCenters: [{ lon: 190, lat: 95 }, { lon: -190, lat: -95 }, null] }),
  );
  assert.deepEqual(back?.ringCenters, [
    { lon: -170, lat: 90 },
    { lon: 170, lat: -90 },
    null,
  ]);
});

// ---- v1 → v2 migration ----

test("v1 save migrates: wallet kept, case reset to unplaced, notice raised", () => {
  // Drain any stale notice from earlier tests.
  takeLegacyMigrationNotice();
  const { restore, data } = stubStorage({
    [LEGACY_KEY]: JSON.stringify({
      v: 1,
      caseIndex: 4,
      stars: 7,
      solved: 3,
      current: {
        ringsPlaced: [true, true, true],
        informantOn: [false, false, false],
        guess: null,
        revealed: false,
        scoreKm: null,
      },
    }),
  });
  try {
    const s = loadColdtrail();
    assert.equal(s.v, 2);
    assert.equal(s.caseIndex, 4, "case index preserved");
    assert.equal(s.stars, 7, "stars preserved");
    assert.equal(s.solved, 3, "solved count preserved");
    assert.equal(s.current, null, "legacy auto-placed rings reset to unplaced");
    assert.equal(takeLegacyMigrationNotice(), true, "one-time notice raised");
    assert.equal(takeLegacyMigrationNotice(), false, "notice is one-shot");
    assert.ok(data[COLDTRAIL_STORAGE_KEY], "migrated store written under the v2 key");
    assert.ok(!(LEGACY_KEY in data), "legacy key deleted after migration");
  } finally {
    restore();
  }
});

test("v1 migration is a no-op when a v2 save already exists", () => {
  takeLegacyMigrationNotice();
  const { restore } = stubStorage({
    [COLDTRAIL_STORAGE_KEY]: JSON.stringify({ ...baseStore(), caseIndex: 9 }),
    [LEGACY_KEY]: JSON.stringify({ v: 1, caseIndex: 1, stars: 1, solved: 0, current: null }),
  });
  try {
    const s = loadColdtrail();
    assert.equal(s.caseIndex, 9, "v2 save wins");
    assert.equal(takeLegacyMigrationNotice(), false, "no notice when v2 exists");
  } finally {
    restore();
  }
});

test("a v1 blob under the v2 key fails closed (never silently accepted)", () => {
  const { restore } = stubStorage({
    [COLDTRAIL_STORAGE_KEY]: JSON.stringify({ v: 1, caseIndex: 7, stars: 10 }),
  });
  try {
    const s = loadColdtrail();
    assert.equal(s.caseIndex, 0);
    assert.equal(s.stars, STARTING_STARS);
  } finally {
    restore();
  }
});
