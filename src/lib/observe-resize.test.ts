import assert from "node:assert/strict";
import test from "node:test";
import { observeResize } from "./observe-resize.ts";

interface StubCtx {
  fires: Array<() => void>;
  disconnects: number;
  frames: Array<{ id: number; cb: () => void; cancelled: boolean }>;
  runFrames: () => void;
  restore: () => void;
}

function installStubs(): StubCtx {
  const g = globalThis as unknown as Record<string, unknown>;
  const saved = {
    ResizeObserver: g["ResizeObserver"],
    requestAnimationFrame: g["requestAnimationFrame"],
    cancelAnimationFrame: g["cancelAnimationFrame"],
  };
  const ctx: StubCtx = {
    fires: [],
    disconnects: 0,
    frames: [],
    runFrames: () => {
      const pending = ctx.frames.splice(0, ctx.frames.length);
      for (const f of pending) if (!f.cancelled) f.cb();
    },
    restore: () => {
      g["ResizeObserver"] = saved.ResizeObserver;
      g["requestAnimationFrame"] = saved.requestAnimationFrame;
      g["cancelAnimationFrame"] = saved.cancelAnimationFrame;
    },
  };
  let nextId = 1;
  g["ResizeObserver"] = class {
    constructor(cb: () => void) {
      ctx.fires.push(cb);
    }
    observe() {}
    disconnect() {
      ctx.disconnects++;
    }
  };
  g["requestAnimationFrame"] = (cb: () => void) => {
    const id = nextId++;
    ctx.frames.push({ id, cb, cancelled: false });
    return id;
  };
  g["cancelAnimationFrame"] = (id: number) => {
    const f = ctx.frames.find((fr) => fr.id === id);
    if (f) f.cancelled = true;
  };
  return ctx;
}

test("observeResize: rapid re-fires coalesce into one callback per frame", () => {
  const ctx = installStubs();
  try {
    let calls = 0;
    const el = {} as Element;
    observeResize(el, () => calls++);
    assert.equal(ctx.fires.length, 1);
    ctx.fires[0]();
    ctx.fires[0]();
    ctx.fires[0]();
    ctx.runFrames();
    assert.equal(calls, 1);
  } finally {
    ctx.restore();
  }
});

test("observeResize: disconnect cancels the pending frame — no callback after teardown", () => {
  const ctx = installStubs();
  try {
    let calls = 0;
    const el = {} as Element;
    const stop = observeResize(el, () => calls++);
    ctx.fires[0]();
    stop();
    ctx.runFrames();
    assert.equal(calls, 0);
    assert.equal(ctx.disconnects, 1);
  } finally {
    ctx.restore();
  }
});

test("observeResize: a settled resize still delivers the callback", () => {
  const ctx = installStubs();
  try {
    let calls = 0;
    const el = {} as Element;
    observeResize(el, () => calls++);
    ctx.fires[0]();
    ctx.runFrames();
    ctx.fires[0]();
    ctx.runFrames();
    assert.equal(calls, 2);
  } finally {
    ctx.restore();
  }
});
