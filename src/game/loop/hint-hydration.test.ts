/**
 * #185 — GeoDetective hint counter hydration (source pin).
 *
 * LoopScreen's local hint counter (`hintsUsedThisMystery`) used to start
 * at a blind zero on every mount, so a mid-mystery reload handed a
 * one-per-round player a second hint in the UI. (The store-committed
 * count always blocked the Clean Round badge — this pin guards the UI
 * half: the button must stay used after a reload.)
 *
 * The counter is React state wiring inside a large screen component
 * that needs a browser to render end-to-end, so — in the repo's
 * established source-pin style (cf. territory-lazy-boundary.test.ts) —
 * this file pins the wiring; the behavioral half is the Playwright pin
 * in tests/e2e/geodetective-hint.spec.ts ("reload mid-mystery").
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const loopScreenSource = readFileSync(join(here, "LoopScreen.tsx"), "utf8");

/** The source between two markers (both must exist). */
function segment(src: string, from: string, to: string): string {
  const start = src.indexOf(from);
  assert.ok(start >= 0, `segment start missing: ${from}`);
  const end = src.indexOf(to, start + from.length);
  assert.ok(end >= 0, `segment end missing: ${to}`);
  return src.slice(start, end);
}

describe("#185 hint counter hydrates from the persisted puzzle count", () => {
  it("the useState initializer reads puzzle.hintsUsed, not a blind zero", () => {
    assert.ok(
      loopScreenSource.includes(
        "const [hintsUsedThisMystery, setHintsUsedThisMystery] = useState(\n    () => puzzle.hintsUsed ?? 0,\n  );",
      ),
      "hintsUsedThisMystery must initialize from puzzle.hintsUsed ?? 0 (#185)",
    );
    assert.ok(
      !loopScreenSource.includes("setHintsUsedThisMystery] = useState(0)"),
      "the counter must never initialize to a blind zero (#185)",
    );
  });

  it("the per-mystery reset effect restores the persisted count, not zero", () => {
    const effect = segment(
      loopScreenSource,
      "const hintResetKey =",
      "function onUseGeoHint()",
    );
    assert.ok(
      effect.includes("setHintsUsedThisMystery(puzzle.hintsUsed ?? 0);"),
      "the reset effect must set the new mystery's persisted count (#185)",
    );
    assert.ok(
      !effect.includes("setHintsUsedThisMystery(0);"),
      "the reset effect must not zero a restored mystery's spent hint (#185)",
    );
  });
});
