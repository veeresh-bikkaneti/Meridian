import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  readDifficultyChoice,
  useDifficultyChoice,
  writeDifficultyChoice,
} from "./game-app-difficulty.ts";

const realLocalStorage = (globalThis as { localStorage?: unknown }).localStorage;

function stubLocalStorage(): Map<string, string> {
  const backing = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
    setItem: (k: string, v: string) => {
      backing.set(k, v);
    },
    removeItem: (k: string) => {
      backing.delete(k);
    },
    clear: () => backing.clear(),
    get length() {
      return backing.size;
    },
    key: (i: number) => [...backing.keys()][i] ?? null,
  };
  return backing;
}

beforeEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

afterEach(() => {
  if (realLocalStorage === undefined) {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  } else {
    (globalThis as { localStorage?: unknown }).localStorage = realLocalStorage;
  }
});

function Probe() {
  const [choice] = useDifficultyChoice();
  return createElement("span", null, choice);
}

describe("readDifficultyChoice / writeDifficultyChoice", () => {
  it("falls back to medium with no storage", () => {
    assert.equal(readDifficultyChoice(), "medium");
  });

  it("round-trips a stored choice", () => {
    stubLocalStorage();
    writeDifficultyChoice("hard");
    assert.equal(readDifficultyChoice(), "hard");
  });

  it("falls back to medium on an invalid stored value", () => {
    const backing = stubLocalStorage();
    backing.set("meridian.difficulty", "impossible");
    assert.equal(readDifficultyChoice(), "medium");
  });
});

describe("useDifficultyChoice", () => {
  it("initialises from the stored choice (SSR probe, effects do not run)", () => {
    stubLocalStorage();
    writeDifficultyChoice("easy");
    assert.equal(renderToStaticMarkup(createElement(Probe)), "<span>easy</span>");
  });

  it("initialises to medium when nothing is stored", () => {
    assert.equal(renderToStaticMarkup(createElement(Probe)), "<span>medium</span>");
  });
});
