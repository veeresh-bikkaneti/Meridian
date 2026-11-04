/**
 * Starfield tests — the module is DOM-bound, so these run against a light
 * hand-rolled DOM stub (no jsdom, zero new packages). The stub only covers
 * what mountStarfield touches; the canvas 2D context is a recording stub so
 * we can assert the seeded field is drawn deterministically.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  createStarPRNG,
  generateStars,
  mountStarfield,
  starfieldPixelRatio,
  STAR_COUNT,
  STARFIELD_SEED,
  TWINKLE_KEYFRAMES_ID,
  TWINKLE_STAR_COUNT,
} from "./starfield.ts";

// ---- light DOM stub -------------------------------------------------------

interface CtxRecord {
  arcs: Array<[number, number, number]>;
  fills: number;
  clearRects: number;
  fillRects: number;
  gradientStops: string[];
}

const createdCanvases: any[] = [];
const headChildren: any[] = [];
const elementsById: Record<string, any> = {};
const windowListeners: Record<string, Array<(...a: any[]) => void>> = {};
let reduceMotionMatches = false;

function makeCtx(): any {
  const record: CtxRecord = {
    arcs: [],
    fills: 0,
    clearRects: 0,
    fillRects: 0,
    gradientStops: [],
  };
  const ctx: any = {
    fillStyle: "",
    globalAlpha: 1,
    __record: record,
    beginPath() {},
    arc(x: number, y: number, r: number) {
      record.arcs.push([x, y, r]);
    },
    fill() {
      record.fills += 1;
    },
    clearRect() {
      record.clearRects += 1;
    },
    fillRect() {
      record.fillRects += 1;
    },
    createLinearGradient() {
      return {
        addColorStop(_offset: number, color: string) {
          record.gradientStops.push(color);
        },
      };
    },
  };
  return ctx;
}

function makeElement(tag: string): any {
  const children: any[] = [];
  const el: any = {
    tagName: tag.toUpperCase(),
    id: "",
    textContent: "",
    style: {},
    attributes: {},
    children,
    parentNode: null,
    setAttribute(k: string, v: string) {
      el.attributes[k] = v;
    },
    getAttribute(k: string) {
      return el.attributes[k] ?? null;
    },
    appendChild(child: any) {
      child.parentNode = el;
      children.push(child);
      return child;
    },
    insertBefore(child: any, before: any) {
      child.parentNode = el;
      const i = before ? children.indexOf(before) : -1;
      if (i >= 0) children.splice(i, 0, child);
      else children.unshift(child);
      return child;
    },
    removeChild(child: any) {
      const i = children.indexOf(child);
      if (i >= 0) children.splice(i, 1);
      return child;
    },
    remove() {
      if (el.parentNode) el.parentNode.removeChild(el);
    },
  };
  Object.defineProperty(el, "firstChild", {
    get() {
      return children[0] ?? null;
    },
  });
  if (tag === "canvas") {
    el.width = 0;
    el.height = 0;
    const ctx = makeCtx();
    el.__ctx = ctx;
    el.getContext = (_kind: string) => ctx;
    createdCanvases.push(el);
  }
  return el;
}

function makeContainer(): any {
  const children: any[] = [];
  const el: any = {
    clientWidth: 800,
    clientHeight: 600,
    children,
    appendChild(child: any) {
      child.parentNode = el;
      children.push(child);
      return child;
    },
    insertBefore(child: any, before: any) {
      child.parentNode = el;
      const i = before ? children.indexOf(before) : -1;
      if (i >= 0) children.splice(i, 0, child);
      else children.unshift(child);
      return child;
    },
    removeChild(child: any) {
      const i = children.indexOf(child);
      if (i >= 0) children.splice(i, 1);
      return child;
    },
  };
  Object.defineProperty(el, "firstChild", {
    get() {
      return children[0] ?? null;
    },
  });
  return el;
}

(globalThis as any).document = {
  createElement: (tag: string) => makeElement(tag),
  getElementById: (id: string) => elementsById[id] ?? null,
  head: {
    appendChild: (el: any) => {
      if (el.id) elementsById[el.id] = el;
      headChildren.push(el);
    },
  },
};

(globalThis as any).window = {
  devicePixelRatio: 1,
  matchMedia: (_query: string) => ({ matches: reduceMotionMatches }),
  addEventListener: (type: string, fn: (...a: any[]) => void) => {
    (windowListeners[type] ??= []).push(fn);
  },
  removeEventListener: (type: string, fn: (...a: any[]) => void) => {
    windowListeners[type] = (windowListeners[type] ?? []).filter(
      (f) => f !== fn,
    );
  },
};
// ResizeObserver intentionally left undefined → window resize fallback path.

function resetStubs() {
  createdCanvases.length = 0;
  headChildren.length = 0;
  for (const k of Object.keys(elementsById)) delete elementsById[k];
  for (const k of Object.keys(windowListeners)) delete windowListeners[k];
  reduceMotionMatches = false;
}

// ---- tests ----------------------------------------------------------------

test("mount inserts an aria-hidden, pointer-events-none wrapper first", () => {
  resetStubs();
  const container = makeContainer();
  const mapDiv = makeElement("div");
  container.appendChild(mapDiv); // the map container paints above
  mountStarfield(container);
  const wrapper = container.children[0];
  assert.equal(wrapper.tagName, "DIV");
  assert.ok(wrapper.className.includes("meridian-starfield"));
  assert.equal(wrapper.getAttribute("aria-hidden"), "true");
  assert.equal(wrapper.style.pointerEvents, "none");
  assert.equal(wrapper.style.position, "absolute");
  assert.equal(container.children[1], mapDiv);
});

test("main canvas paints the near-black gradient + STAR_COUNT seeded stars", () => {
  resetStubs();
  const container = makeContainer();
  mountStarfield(container);
  const main = createdCanvases[0];
  assert.equal(main.tagName, "CANVAS");
  assert.deepEqual(main.__ctx.__record.gradientStops, ["#05070c", "#020306"]);
  assert.equal(main.__ctx.__record.arcs.length, STAR_COUNT);
  assert.equal(main.__ctx.__record.fills, STAR_COUNT);
});

test("star field is stable across mounts (seeded PRNG)", () => {
  resetStubs();
  mountStarfield(makeContainer());
  const first = createdCanvases[0].__ctx.__record.arcs.map((a: number[]) => [...a]);
  resetStubs();
  mountStarfield(makeContainer());
  const second = createdCanvases[0].__ctx.__record.arcs;
  assert.deepEqual(second, first);
});

test("generateStars is pure: same seed → identical, different seed → different", () => {
  const a = generateStars(50, createStarPRNG(STARFIELD_SEED), false);
  const b = generateStars(50, createStarPRNG(STARFIELD_SEED), false);
  const c = generateStars(50, createStarPRNG(STARFIELD_SEED + 1), false);
  assert.deepEqual(b, a);
  assert.notDeepEqual(c, a);
  assert.ok(a.every((s) => s.r >= 0.4 && s.r <= 1.4));
  assert.ok(a.every((s) => s.alpha >= 0.25 && s.alpha <= 1.0));
});

test("reduced motion: twinkle layer skipped, keyframes never injected", () => {
  resetStubs();
  reduceMotionMatches = true;
  const container = makeContainer();
  mountStarfield(container);
  const wrapper = container.children[0];
  assert.equal(wrapper.children.length, 1);
  assert.equal(createdCanvases.length, 1);
  assert.equal(headChildren.length, 0);
});

test("twinkle layer: second canvas + keyframes injected exactly once", () => {
  resetStubs();
  const c1 = makeContainer();
  mountStarfield(c1);
  const wrapper = c1.children[0];
  assert.equal(wrapper.children.length, 2);
  assert.equal(createdCanvases.length, 2);
  const twinkle = createdCanvases[1];
  assert.equal(twinkle.__ctx.__record.arcs.length, TWINKLE_STAR_COUNT);
  assert.ok(
    String(twinkle.style.animation).includes("meridian-star-twinkle"),
    "twinkle canvas carries the CSS animation",
  );
  assert.equal(headChildren.length, 1);
  assert.equal(elementsById[TWINKLE_KEYFRAMES_ID], headChildren[0]);
  assert.ok(
    String(headChildren[0].textContent).includes("meridian-star-twinkle"),
  );
  // Second mount reuses the keyframes element.
  mountStarfield(makeContainer());
  assert.equal(headChildren.length, 1);
});

test("twinkle layer paints stars only — never an opaque background (regression)", () => {
  resetStubs();
  const container = makeContainer();
  mountStarfield(container);
  const main = createdCanvases[0];
  const twinkle = createdCanvases[1];
  // Main canvas: one opaque gradient background + the 600-star field.
  assert.equal(main.__ctx.__record.fillRects, 1);
  assert.deepEqual(main.__ctx.__record.gradientStops, ["#05070c", "#020306"]);
  assert.equal(main.__ctx.__record.arcs.length, STAR_COUNT);
  // Twinkle canvas: transparent — stars drawn, zero background fills and no
  // gradient. An opaque fill here hides the base field. (No clearRect is
  // needed: sizeCanvas's bitmap reset precedes every paint.)
  assert.equal(twinkle.__ctx.__record.clearRects, 0);
  assert.equal(twinkle.__ctx.__record.fillRects, 0);
  assert.deepEqual(twinkle.__ctx.__record.gradientStops, []);
  assert.equal(twinkle.__ctx.__record.arcs.length, TWINKLE_STAR_COUNT);
});

test("resize repaints (window resize fallback when ResizeObserver is absent)", () => {
  resetStubs();
  const container = makeContainer();
  mountStarfield(container);
  const main = createdCanvases[0];
  assert.equal((windowListeners["resize"] ?? []).length, 1);
  const before = main.__ctx.__record.arcs.length;
  for (const fn of windowListeners["resize"] ?? []) fn();
  assert.equal(main.__ctx.__record.arcs.length, before * 2);
});

test("destroy removes the wrapper and the resize listener", () => {
  resetStubs();
  const container = makeContainer();
  const handle = mountStarfield(container);
  assert.equal(container.children.length, 1);
  handle.destroy();
  assert.equal(container.children.length, 0);
  assert.equal((windowListeners["resize"] ?? []).length, 0);
});

// ---- issue #330: shared pixel-ratio policy --------------------------------

test("#330 starfieldPixelRatio: coarse pointers share the map's 1.5 cap; fine pointers unchanged", () => {
  assert.equal(starfieldPixelRatio(2, true), 1.5);
  assert.equal(starfieldPixelRatio(3, true), 1.5);
  assert.equal(starfieldPixelRatio(1.5, true), 1.5);
  assert.equal(starfieldPixelRatio(1, true), 1);
  assert.equal(starfieldPixelRatio(2, false), 2);
  assert.equal(starfieldPixelRatio(3, false), 2);
  assert.equal(starfieldPixelRatio(1, false), 1);
  assert.equal(starfieldPixelRatio(Number.NaN, true), 1);
});

function withPointer(coarse: boolean, dpr: number, fn: () => void): void {
  const w = (globalThis as any).window;
  const prevMatchMedia = w.matchMedia;
  const prevDpr = w.devicePixelRatio;
  w.matchMedia = (query: string) => ({
    matches: query.includes("pointer: coarse") ? coarse : reduceMotionMatches,
  });
  w.devicePixelRatio = dpr;
  try {
    fn();
  } finally {
    w.matchMedia = prevMatchMedia;
    w.devicePixelRatio = prevDpr;
  }
}

function makePhoneContainer(): any {
  const container = makeContainer();
  container.clientWidth = 414; // iPhone 11 CSS viewport
  container.clientHeight = 896;
  return container;
}

test("#330 mount: coarse DPR 2 (iPhone 11) sizes both canvases at the 1.5 cap — 6,676,992 B total", () => {
  resetStubs();
  withPointer(true, 2, () => {
    mountStarfield(makePhoneContainer());
  });
  assert.equal(createdCanvases.length, 2);
  for (const canvas of createdCanvases) {
    assert.equal(canvas.width, 621); // floor(414 × 1.5)
    assert.equal(canvas.height, 1344); // floor(896 × 1.5)
  }
  const totalBytes = createdCanvases.reduce((n: number, c: any) => n + c.width * c.height * 4, 0);
  assert.equal(totalBytes, 6_676_992);
  // The pre-fix size at DPR 2 — the number this fix removes from the
  // map_init_start → map_ready window.
  assert.equal(2 * 828 * 1792 * 4, 11_870_208);
  assert.ok(totalBytes < 11_870_208);
});

test("#330 mount: fine pointer at DPR 2 keeps the old full-size canvases (desktop unchanged)", () => {
  resetStubs();
  withPointer(false, 2, () => {
    mountStarfield(makePhoneContainer());
  });
  for (const canvas of createdCanvases) {
    assert.equal(canvas.width, 828);
    assert.equal(canvas.height, 1792);
  }
});
