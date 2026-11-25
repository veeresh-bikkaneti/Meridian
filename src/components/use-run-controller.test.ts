/**
 * Step 7 (TD-06.7) — run controller source pin.
 *
 * `commit`, `openRun`, and `startReview` live in use-run-controller.ts,
 * not in game-app.tsx. GameApp calls the hook. `commit` stays the one
 * writer pairing `writeRun` + `setRun`; `openRun` still awaits
 * `preloadTerritory()` before a run commits and still honors
 * `runStartGenRef`. This file pins that wiring in the repo's
 * source-pin style.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const controllerSource = readFileSync(join(here, "use-run-controller.ts"), "utf8");
const gameAppSource = readFileSync(join(here, "game-app.tsx"), "utf8");

describe("Step 7: run controller lives in use-run-controller", () => {
  it("exports useRunController owning commit / openRun / startReview", () => {
    assert.ok(controllerSource.includes("export function useRunController("));
    assert.ok(controllerSource.includes("const commit = useCallback((next: Run) => {"));
    assert.ok(controllerSource.includes("const openRun = useCallback("));
    assert.ok(controllerSource.includes("const startReview = useCallback(() => {"));
  });

  it("commit still pairs writeRun + setRun, openRun still preloads territory", () => {
    assert.ok(controllerSource.includes("writeRun(next);"));
    assert.ok(controllerSource.includes("setRun(next);"));
    assert.ok(controllerSource.includes("preloadTerritory(),"));
    assert.ok(controllerSource.includes("runStartGenRef.current"));
  });

  it("game-app.tsx calls the hook and no longer defines the pieces", () => {
    assert.ok(gameAppSource.includes("useRunController({"));
    assert.ok(!gameAppSource.includes("const commit = useCallback((next: Run) => {"));
    assert.ok(!gameAppSource.includes("const openRun = useCallback("));
    assert.ok(!gameAppSource.includes("const startReview = useCallback(() => {"));
  });
});
