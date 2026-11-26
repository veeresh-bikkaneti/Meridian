import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  readDifficultyChoice,
  readModuleDifficulty,
  useDifficultyChoice,
  useModuleDifficulty,
  writeDifficultyChoice,
  writeModuleDifficulty,
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

function readModuleMap(store: Map<string, string>): Record<string, string> {
  const raw = store.get("meridian.difficulty.byModule");
  return raw ? (JSON.parse(raw) as Record<string, string>) : {};
}

describe("readModuleDifficulty / writeModuleDifficulty (FW-11.1)", () => {
  it("seeds globe, country and state from the legacy choice on first read", () => {
    const store = stubLocalStorage({ "meridian.difficulty": "hard" });
    assert.equal(readModuleDifficulty("globe"), "hard");
    assert.equal(readModuleDifficulty("country"), "hard");
    assert.equal(readModuleDifficulty("state"), "hard");
    assert.deepEqual(readModuleMap(store), {
      globe: "hard",
      country: "hard",
      state: "hard",
    });
    // The legacy key is left in place (still the stubbed value).
    assert.equal(store.get("meridian.difficulty"), "hard");
  });

  it("seeds medium when the legacy value is invalid or missing", () => {
    const store = stubLocalStorage({ "meridian.difficulty": "extreme" });
    assert.equal(readModuleDifficulty("globe"), "medium");
    assert.deepEqual(readModuleMap(store), {
      globe: "medium",
      country: "medium",
      state: "medium",
    });
    const empty = stubLocalStorage();
    assert.equal(readModuleDifficulty("state"), "medium");
    assert.deepEqual(readModuleMap(empty), {
      globe: "medium",
      country: "medium",
      state: "medium",
    });
  });

  it("falls back to the module default on a stored invalid value (no re-seed)", () => {
    stubLocalStorage({
      "meridian.difficulty.byModule": JSON.stringify({ globe: "extreme" }),
    });
    assert.equal(readModuleDifficulty("globe"), "medium");
    // A stub module with nothing stored reads its default.
    assert.equal(readModuleDifficulty("geodetective"), "medium");
  });

  it("writeModuleDifficulty writes to the map only and never clobbers another module", () => {
    const store = stubLocalStorage({
      "meridian.difficulty": "easy",
      "meridian.difficulty.byModule": JSON.stringify({ globe: "hard", country: "easy" }),
    });
    writeModuleDifficulty("state", "hard");
    assert.deepEqual(readModuleMap(store), {
      globe: "hard",
      country: "easy",
      state: "hard",
    });
    // The legacy key is untouched by a module write (still the stubbed value).
    assert.equal(store.get("meridian.difficulty"), "easy");
  });

  it("isolation: setting Globe to Hard does not change a State run's stored choice", () => {
    const store = stubLocalStorage({
      "meridian.difficulty.byModule": JSON.stringify({ globe: "medium", state: "easy" }),
    });
    writeModuleDifficulty("globe", "hard");
    assert.equal(readModuleDifficulty("globe"), "hard");
    assert.equal(readModuleDifficulty("state"), "easy");
    assert.deepEqual(readModuleMap(store), { globe: "hard", state: "easy" });
  });
});

function ModuleProbe({ moduleId }: { moduleId: "globe" | "country" | "state" }) {
  const [choice] = useModuleDifficulty(moduleId);
  return createElement("span", null, choice);
}

describe("useModuleDifficulty", () => {
  it("initialises from the module's stored choice", () => {
    stubLocalStorage({
      "meridian.difficulty.byModule": JSON.stringify({ globe: "hard" }),
    });
    assert.match(
      renderToStaticMarkup(createElement(ModuleProbe, { moduleId: "globe" })),
      /<span>hard<\/span>/,
    );
    assert.match(
      renderToStaticMarkup(createElement(ModuleProbe, { moduleId: "country" })),
      /<span>medium<\/span>/,
    );
  });

  it("is SSR-safe with no storage at all: reads as medium and never throws", () => {
    delete globals.localStorage;
    assert.doesNotThrow(() =>
      renderToStaticMarkup(createElement(ModuleProbe, { moduleId: "globe" })),
    );
    assert.match(
      renderToStaticMarkup(createElement(ModuleProbe, { moduleId: "globe" })),
      /<span>medium<\/span>/,
    );
  });
});
