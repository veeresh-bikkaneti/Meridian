import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { HIGH_CONTRAST, HIGH_CONTRAST_MARKS, PALETTE_STORAGE_KEY, STANDARD } from "./palette.ts";
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

test("styles.css high-contrast block carries the seven HIGH_CONTRAST_MARKS vars", () => {
  // Council addendum 2026-10-28 (D9): the HC block grows from five palette
  // tokens to twelve vars — the five plus the seven marks, sourced from
  // HIGH_CONTRAST_MARKS so CSS and tokens cannot drift.
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const start = css.indexOf(':root[data-palette="high-contrast"]');
  assert.ok(start >= 0, "high-contrast block exists in styles.css");
  const block = css.slice(start, css.indexOf("}", start));
  const expected: Record<string, string> = {
    "--map-pin": HIGH_CONTRAST_MARKS.pin,
    "--map-answer": HIGH_CONTRAST_MARKS.answer,
    "--map-highlight": HIGH_CONTRAST_MARKS.highlight,
    "--map-border": HIGH_CONTRAST_MARKS.border,
    "--map-park": HIGH_CONTRAST_MARKS.park,
    "--map-cross": HIGH_CONTRAST_MARKS.cross,
    "--map-lit": HIGH_CONTRAST_MARKS.lit,
  };
  for (const [name, value] of Object.entries(expected)) {
    assert.ok(block.includes(`${name}: ${value};`), `${name} is ${value} in the high-contrast block`);
  }
});

test("styles.css high-contrast block has no road, highway, road-case, or river override", () => {
  // Adjudication (D9): roads are OUT of this cure (Councilor C's challenge
  // recorded, Chair disposition) and river KEEPS both theme values — so the
  // HC block must not carry any of those vars.
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const start = css.indexOf(':root[data-palette="high-contrast"]');
  assert.ok(start >= 0, "high-contrast block exists in styles.css");
  const block = css.slice(start, css.indexOf("}", start));
  for (const name of ["--map-road:", "--map-highway:", "--map-road-case:", "--map-river:"]) {
    assert.ok(!block.includes(name), `high-contrast block must not override ${name}`);
  }
});

test("pin centre-dot seam: theme blocks keep the translucent dot, HC block uses solid HC land", () => {
  // Councilor C condition (f): rgba(0,0,0,0.38) over the new HC pin body
  // composites to 1.95:1 — below the standard path's own 2.65:1. The dot
  // rides a --map-pin-dot var through colors.ts (pinDot) into drawGuessPin.
  // Standard themes keep the exact current value; HC alone goes solid.
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const hcStart = css.indexOf(':root[data-palette="high-contrast"]');
  assert.ok(hcStart >= 0, "high-contrast block exists in styles.css");
  const hcBlock = css.slice(hcStart, css.indexOf("}", hcStart));
  assert.ok(hcBlock.includes("--map-pin-dot: #f6f3ea;"), "HC dot is solid HC land");
  const themeCss = css.slice(0, hcStart);
  const standardDots = themeCss.match(/--map-pin-dot: rgba\(0,0,0,0\.38\);/g) ?? [];
  assert.ok(standardDots.length >= 4, `theme blocks keep the standard dot (found ${standardDots.length})`);

  const colors = readFileSync(new URL("../map/colors.ts", import.meta.url), "utf8");
  assert.ok(
    colors.includes('pinDot: pick("--map-pin-dot", "rgba(0,0,0,0.38)")'),
    "colors.ts reads --map-pin-dot as pinDot with the standard rgba fallback",
  );
  const paint = readFileSync(new URL("../map/paint-scene.ts", import.meta.url), "utf8");
  assert.ok(paint.includes("colors.pinDot"), "paintOverlay passes colors.pinDot to the pin");
  assert.ok(!paint.includes('fillStyle = "rgba(0,0,0,0.38)"'), "the dot fill is no longer hard-coded");
});

test("toggle pressed state has a visible brass treatment (panel BLOCK 3 cure)", () => {
  // UX Designer BLOCK: aria-pressed alone is invisible to sighted users.
  // The toggle carries a dedicated class in BOTH hosts, and styles.css
  // gives its [aria-pressed="true"] state the .atlas-seg brass fill plus
  // a filled icon — a difference a sighted user cannot miss.
  const src = readFileSync(new URL("../components/game-app.tsx", import.meta.url), "utf8");
  assert.ok(src.includes("atlas-contrast-toggle"), "toggle renders the dedicated pressed-state class");
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const start = css.indexOf('.atlas-contrast-toggle[aria-pressed="true"]');
  assert.ok(start >= 0, "pressed rule exists in styles.css");
  const block = css.slice(start, css.indexOf("}", start));
  assert.ok(block.includes("background: var(--atlas-brass);"), "pressed background is the brass fill");
  assert.ok(block.includes("color: var(--atlas-brass-ink);"), "pressed foreground is the brass ink");
});

test("game-app wires the toggle hosts and the boot apply", () => {
  const src = readFileSync(new URL("../components/game-app.tsx", import.meta.url), "utf8");
  // Hosts pass the id through the SoundToggle-pattern `testId` prop;
  // HighContrastToggle renders it as data-testid={testId}.
  assert.ok(src.includes('testId="high-contrast-toggle"'), "home toggle host");
  assert.ok(src.includes('testId="high-contrast-toggle-game"'), "in-game toggle host");
  assert.ok(src.includes("data-testid={testId}"), "toggle renders its testId as data-testid");
  assert.ok(src.includes("applyPalettePreference()"), "boot apply call");
});
