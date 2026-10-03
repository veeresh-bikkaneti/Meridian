import assert from "node:assert/strict";
import test from "node:test";
import {
  CLEAN_EXIT_KEY,
  clearRunAfterUncleanShutdown,
  handlePageHide,
  isUncleanShutdown,
  stampCleanExitDirty,
  type CleanExitStorage,
} from "./clean-exit.ts";

function makeStorage(): CleanExitStorage & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  return {
    raw,
    getItem: (key: string) => (raw.has(key) ? (raw.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      raw.set(key, value);
    },
    removeItem: (key: string) => {
      raw.delete(key);
    },
  };
}

test("stampCleanExitDirty: marks the page dirty (\"0\") on write", () => {
  const store = makeStorage();
  stampCleanExitDirty(store);
  assert.equal(store.getItem(CLEAN_EXIT_KEY), "0");
});

test("handlePageHide: marks the page clean (\"1\") — the pagehide semantics", () => {
  const store = makeStorage();
  stampCleanExitDirty(store);
  handlePageHide(store);
  assert.equal(store.getItem(CLEAN_EXIT_KEY), "1");
});

test("isUncleanShutdown: missing flag (pre-update run) counts as clean", () => {
  const store = makeStorage();
  assert.equal(isUncleanShutdown(store), false);
});

test("isUncleanShutdown: \"1\" counts as clean, \"0\" as a kill", () => {
  const store = makeStorage();
  handlePageHide(store);
  assert.equal(isUncleanShutdown(store), false);
  stampCleanExitDirty(store);
  assert.equal(isUncleanShutdown(store), true);
});

test("full cycle: dirty write, kill (no pagehide) → unclean; pagehide → clean", () => {
  const store = makeStorage();
  stampCleanExitDirty(store); // page writes a run
  assert.equal(isUncleanShutdown(store), true, "kill before pagehide reads as unclean");
  const store2 = makeStorage();
  stampCleanExitDirty(store2);
  handlePageHide(store2); // normal reload fires pagehide
  assert.equal(isUncleanShutdown(store2), false, "pagehide before reload reads as clean");
});

test("clearRunAfterUncleanShutdown: clears the stale run and re-arms clean", () => {
  const store = makeStorage();
  const RUN_KEY = "meridian.run";
  store.setItem(RUN_KEY, JSON.stringify({ phase: "aim" }));
  stampCleanExitDirty(store);
  clearRunAfterUncleanShutdown(RUN_KEY, store);
  assert.equal(store.getItem(RUN_KEY), null, "stale saved run is cleared");
  assert.equal(store.getItem(CLEAN_EXIT_KEY), "1", "flag re-armed to clean");
  assert.equal(isUncleanShutdown(store), false, "menu landing is never stuck in dirty state");
});

test("helpers tolerate a null/unavailable storage without throwing", () => {
  assert.doesNotThrow(() => stampCleanExitDirty(null));
  assert.doesNotThrow(() => handlePageHide(null));
  assert.doesNotThrow(() => clearRunAfterUncleanShutdown("meridian.run", null));
  assert.equal(isUncleanShutdown(null), false, "no storage fails toward clean/resume");
});

test("helpers tolerate throwing storage without throwing", () => {
  const boom: CleanExitStorage = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  };
  assert.doesNotThrow(() => stampCleanExitDirty(boom));
  assert.doesNotThrow(() => handlePageHide(boom));
  assert.doesNotThrow(() => clearRunAfterUncleanShutdown("meridian.run", boom));
  assert.equal(isUncleanShutdown(boom), false, "storage failure fails toward clean/resume");
});
