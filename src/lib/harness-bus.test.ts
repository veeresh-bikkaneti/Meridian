import assert from "node:assert/strict";
import test from "node:test";
import {
  harnessCelebrationVariant,
  harnessIdleMs,
  harnessLoopPuzzle,
  harnessWriteProbe,
} from "./harness-bus.ts";

test("readers are inert when no harness is installed", () => {
  const previous = (globalThis as { mh?: unknown }).mh;
  delete (globalThis as { mh?: unknown }).mh;
  try {
    assert.equal(harnessLoopPuzzle("?loop-puzzle=4"), null);
    assert.equal(harnessIdleMs("?idle-ms=10", 50), 50);
    assert.equal(harnessCelebrationVariant("?celebration=game-complete"), null);
    const el = { dataset: {} as Record<string, string> };
    harnessWriteProbe(el, { bonds: 1 });
    assert.deepEqual(el.dataset, {});
  } finally {
    if (previous === undefined) delete (globalThis as { mh?: unknown }).mh;
    else (globalThis as { mh?: unknown }).mh = previous;
  }
});

test("readers delegate when the slot is filled", () => {
  const previous = (globalThis as { mh?: unknown }).mh;
  (globalThis as { mh?: unknown }).mh = {
    loopPuzzle: () => 9,
    i: (_search: string, _fallback: number) => 12,
    c: () => "mystery-solved",
    writeProbe: (el: { dataset?: Record<string, string> }) => {
      el.dataset = { ...(el.dataset ?? {}), bondCount: "2" };
    },
  };
  try {
    assert.equal(harnessLoopPuzzle(""), 9);
    assert.equal(harnessIdleMs("", 1), 12);
    assert.equal(harnessCelebrationVariant(""), "mystery-solved");
    const el: { dataset?: Record<string, string> } = {};
    harnessWriteProbe(el, { bonds: 2 });
    assert.equal(el.dataset?.bondCount, "2");
  } finally {
    if (previous === undefined) delete (globalThis as { mh?: unknown }).mh;
    else (globalThis as { mh?: unknown }).mh = previous;
  }
});
