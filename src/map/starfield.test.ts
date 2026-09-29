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
  STAR_COUNT,
  STARFIELD_SEED,
  TWINKLE_KEYFRAMES_ID,
  TWINKLE_STAR_COUNT,
} from "./starfield.ts";

// ---- light DOM stub -------------------------------------------------------

interface CtxRecord {
  arcs: Array<[number, number, number]>;
  fills: number;
  gradientStops: string[];
}

const createdCanvases: any[] = [];
const headChildren: any[] = [];
const elementsById: Record<string, any> = {};
const windowListeners: Record<string, Array<(...a: any[]) => void>> = {};
let reduceMotionMatches = false;

function makeCtx(): any {
  const record: CtxRecord = { arcs: [], fills: 0, gradientStops: [] };
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
    fillRect() {},
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
