import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  readDifficultyChoice,
  useDifficultyChoice,
  writeDifficultyChoice,
} from "./use-difficulty-choice.ts";

/**
 * The read/write pair runs against the real storage port with a fake
 * localStorage global in place (the port resolves the global lazily on
 * every call). The hook itself is exercised through a tiny probe
 * component rendered with react-dom/server (no jsdom in the repo's
 * node:test harness): effects do not run in SSR, so this covers the
 * initial value + SSR safety.
 */

const globals = globalThis as { localStorage?: unknown };
const hadLocalStorage = "localStorage" in globals;
const originalLocalStorage = globals.localStorage;

function stubLocalStorage(initial: Record<string, string> = {}): Map<string, string> {
  const store = new Map(Object.entries(initial));
  globals.localStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
  return store;
}

beforeEach(() => {
  stubLocalStorage();
});

afterEach(() => {
  if (hadLocalStorage) globals.localStorage = originalLocalStorage;
  else delete globals.localStorage;
});

describe("readDifficultyChoice / writeDifficultyChoice", () => {
  it("falls back to medium when nothing is stored", () => {
    assert.equal(readDifficultyChoice(), "medium");
  });

  it("returns a stored valid choice", () => {
    stubLocalStorage({ "meridian.difficulty": "hard" });
    assert.equal(readDifficultyChoice(), "hard");
  });

  it("falls back to medium on a stored invalid value", () => {
    stubLocalStorage({ "meridian.difficulty": "extreme" });
    assert.equal(readDifficultyChoice(), "medium");
  });

  it("writeDifficultyChoice stores the choice under meridian.difficulty, and it reads back", () => {
    const store = stubLocalStorage();
    writeDifficultyChoice("easy");
    assert.equal(JSON.parse(store.get("meridian.difficulty")!), "easy");
    assert.equal(readDifficultyChoice(), "easy");
  });
});

function Probe() {
  const [choice] = useDifficultyChoice();
  return createElement("span", null, choice);
}

describe("useDifficultyChoice", () => {
  it("initialises from the stored choice", () => {
    stubLocalStorage({ "meridian.difficulty": "easy" });
    assert.match(renderToStaticMarkup(createElement(Probe)), /<span>easy<\/span>/);
  });

  it("is SSR-safe with no storage at all: reads as medium and never throws", () => {
    delete globals.localStorage;
    assert.doesNotThrow(() => renderToStaticMarkup(createElement(Probe)));
    assert.match(renderToStaticMarkup(createElement(Probe)), /<span>medium<\/span>/);
  });
});
