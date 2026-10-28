import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { HIGH_CONTRAST, PALETTE_STORAGE_KEY, STANDARD } from "./palette.ts";
import {
  applyPalettePreference,
  isHighContrastEnabled,
  readPalettePreference,
  setHighContrastEnabled,
} from "./palette-preference.ts";

/**
 * Contracts for the palette preference module (Council manifest
 * 2026-10-27-high-contrast-view, Councilor B). The module mirrors the
 * sfx.ts sound-toggle pattern: safe storage behind try/catch, the
 * selectPalette token language, a data-palette attribute on the root
 * element, and a "meridian:palette-change" CustomEvent. Fakes are
 * installed on globalThis, the trail.test.ts precedent.
 */

type FakeGlobals = {
  localStorage?: unknown;
  document?: unknown;
  window?: unknown;
};

function installStorage(data: Map<string, string>, opts: { throws?: boolean } = {}) {
  const g = globalThis as FakeGlobals;
  const prev = g.localStorage;
  g.localStorage = {
    getItem(key: string) {
      if (opts.throws) throw new Error("storage denied");
      return data.has(key) ? data.get(key)! : null;
    },
    setItem(key: string, value: string) {
      if (opts.throws) throw new Error("storage denied");
      data.set(key, value);
    },
    removeItem(key: string) {
      data.delete(key);
    },
  };
  return () => {
    if (prev === undefined) delete g.localStorage;
    else g.localStorage = prev;
  };
}

function installDom() {
  const g = globalThis as FakeGlobals;
  const prevDocument = g.document;
  const prevWindow = g.window;
  const attrs = new Map<string, string>();
  const events: { type: string; detail?: unknown }[] = [];
  g.document = {
    documentElement: {
      setAttribute(name: string, value: string) {
        attrs.set(name, value);
      },
      removeAttribute(name: string) {
        attrs.delete(name);
      },
      getAttribute(name: string) {
        return attrs.has(name) ? attrs.get(name)! : null;
      },
    },
  };
  g.window = {
    dispatchEvent(event: { type: string; detail?: unknown }) {
      events.push({ type: event.type, detail: event.detail });
      return true;
    },
  };
  return {
    attrs,
    events,
    restore() {
      if (prevDocument === undefined) delete g.document;
      else g.document = prevDocument;
      if (prevWindow === undefined) delete g.window;
      else g.window = prevWindow;
    },
  };
}

test("readPalettePreference returns HIGH_CONTRAST only for the exact stored token", () => {
  const data = new Map([[PALETTE_STORAGE_KEY, "high-contrast"]]);
  const restore = installStorage(data);
  try {
    assert.equal(readPalettePreference(), HIGH_CONTRAST);
    assert.equal(isHighContrastEnabled(), true);
  } finally {
    restore();
  }
});

test("readPalettePreference fails closed on corrupt values", () => {
  for (const raw of ["HIGH-CONTRAST", "high contrast", "", "nope", "banana", '{"palette":1}', "true"]) {
    const data = new Map([[PALETTE_STORAGE_KEY, raw]]);
    const restore = installStorage(data);
    try {
      assert.equal(readPalettePreference(), STANDARD, JSON.stringify(raw));
      assert.equal(isHighContrastEnabled(), false, JSON.stringify(raw));
    } finally {
      restore();
    }
  }
});

test("readPalettePreference fails closed when storage is absent or throws", () => {
  const g = globalThis as FakeGlobals;
  const prev = g.localStorage;
  delete g.localStorage;
  try {
    assert.equal(readPalettePreference(), STANDARD);
  } finally {
    if (prev === undefined) delete g.localStorage;
    else g.localStorage = prev;
  }
  const restore = installStorage(new Map(), { throws: true });
  try {
    assert.equal(readPalettePreference(), STANDARD);
    assert.doesNotThrow(() => setHighContrastEnabled(true));
  } finally {
    restore();
  }
});

test("setHighContrastEnabled writes the selectPalette token language", () => {
  const data = new Map<string, string>();
  const restoreStorage = installStorage(data);
  const dom = installDom();
  try {
    setHighContrastEnabled(true);
    assert.equal(data.get(PALETTE_STORAGE_KEY), "high-contrast");
    setHighContrastEnabled(false);
    assert.equal(data.get(PALETTE_STORAGE_KEY), "standard");
  } finally {
    restoreStorage();
    dom.restore();
  }
});

test("setHighContrastEnabled applies the attribute and notifies in place", () => {
  const restoreStorage = installStorage(new Map());
  const dom = installDom();
  try {
    setHighContrastEnabled(true);
    assert.equal(dom.attrs.get("data-palette"), "high-contrast");
    assert.deepEqual(dom.events, [{ type: "meridian:palette-change", detail: true }]);
    setHighContrastEnabled(false);
    assert.equal(dom.attrs.has("data-palette"), false);
    assert.deepEqual(dom.events[1], { type: "meridian:palette-change", detail: false });
  } finally {
    restoreStorage();
    dom.restore();
  }
});

test("applyPalettePreference applies the stored value and fails closed on corrupt values", () => {
  const restoreStorage = installStorage(new Map([[PALETTE_STORAGE_KEY, "high-contrast"]]));
  const dom = installDom();
  try {
    assert.equal(applyPalettePreference(), HIGH_CONTRAST);
    assert.equal(dom.attrs.get("data-palette"), "high-contrast");
  } finally {
    restoreStorage();
    dom.restore();
  }
  const restoreStorage2 = installStorage(new Map([[PALETTE_STORAGE_KEY, "banana"]]));
  const dom2 = installDom();
  try {
    assert.equal(applyPalettePreference(), STANDARD);
    assert.equal(dom2.attrs.has("data-palette"), false);
  } finally {
    restoreStorage2();
    dom2.restore();
  }
});

test("styles.css high-contrast block equals HIGH_CONTRAST", () => {
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const start = css.indexOf(':root[data-palette="high-contrast"]');
  assert.ok(start >= 0, "high-contrast block exists in styles.css");
  const block = css.slice(start, css.indexOf("}", start));
  const expected: Record<string, string> = {
    "--map-water": HIGH_CONTRAST.water,
    "--map-land": HIGH_CONTRAST.land,
    "--map-arc": HIGH_CONTRAST.arc,
    "--map-lake": HIGH_CONTRAST.lake,
    "--map-coast": HIGH_CONTRAST.coast,
  };
  for (const [name, value] of Object.entries(expected)) {
    assert.ok(block.includes(`${name}: ${value};`), `${name} is ${value} in the high-contrast block`);
  }
});

test("game-app wires the toggle hosts and the boot apply", () => {
  const src = readFileSync(new URL("../components/game-app.tsx", import.meta.url), "utf8");
  assert.ok(src.includes('data-testid="high-contrast-toggle"'), "home toggle host");
  assert.ok(src.includes('data-testid="high-contrast-toggle-game"'), "in-game toggle host");
  assert.ok(src.includes("applyPalettePreference()"), "boot apply call");
});
