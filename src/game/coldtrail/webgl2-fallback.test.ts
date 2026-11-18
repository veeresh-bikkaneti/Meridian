/**
 * WebGL2 crash fix — source pins (sharpened after the adversarial arena).
 *
 * Field crash (2026-11-16, build b2ef88a7): on a device with no WebGL2,
 * opening Cold Trail filed a `map_error` crash report
 * (GPUInitializationError — "WebGL2 is required to display this map")
 * and replaced the whole screen with a reload card that could never
 * succeed. Root cause: TrailScreen rendered LoopMap bare, so the map
 * constructor's synchronous throw escaped to the app's outer
 * MapErrorBoundary — the one component that emits `map_error`.
 * GeoDetective never filed this report because LoopScreen wraps the
 * same LoopMap in LoopMapBoundary, which contains the throw.
 *
 * These pins keep the containment — and the arena's corrections — in
 * place:
 *  - TrailScreen wraps its LoopMap in LoopMapBoundary (GeoDetective
 *    parity), so the throw is contained at the map surface.
 *  - The boundary's reporting is NARROW, not silent: a contained failure
 *    is console-logged always and filed via emitMapError EXCEPT when it
 *    is the permanent WebGL2 gap (a device limit, not a bug). The
 *    predicate lives in the leaf module src/lib/webgl2-unavailable.ts
 *    so the boundary never imports the satellite-map stack.
 *  - The main game's map takes its static scout fallback for the
 *    WebGL2-missing error in full mode too (a reload cannot fix a
 *    missing WebGL2), while every other full-mode construction error
 *    still goes to the error boundary — and the fallback it lands on is
 *    playable (intro gate released, tile status settled, no zoom
 *    buttons over a camera-less surface).
 *  - Cold Trail mirrors LoopScreen's map-off state: tile failures and
 *    boundary failures take the map off, ring placement cannot be
 *    armed, and the off-line is Cold Trail's own truthful copy (its
 *    only input is the map — "your guesses still work" would be false).
 *  - LoopMap routes a post-init WebGL context loss (and a MapLibre
 *    error carrying a GPU initialization failure) to the same map-off
 *    channel instead of leaving a frozen dead canvas.
 *
 * The pins are deliberately tolerant (quote/alias/props/whitespace) so
 * they fail on behaviour changes, not on formatting. The predicate pin
 * is behavioural: it imports the leaf module and runs fixtures.
 *
 * The browser behaviour half (WebGL2 disabled in a real browser:
 * fallback rendered and playable, no crash report for the WebGL2 case,
 * screens stay alive) rides the manual WebGL-disabled walk saved with
 * this branch's proof artefacts; the repo's unit runner cannot launch
 * a browser.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isWebgl2Unavailable } from "../../lib/webgl2-unavailable.ts";

const here = dirname(fileURLToPath(import.meta.url));
const trailSource = readFileSync(join(here, "TrailScreen.tsx"), "utf8");
const loopScreenSource = readFileSync(
  join(here, "../loop/LoopScreen.tsx"),
  "utf8",
);
const boundarySource = readFileSync(
  join(here, "../loop/loop-map-boundary.tsx"),
  "utf8",
);
const loopMapSource = readFileSync(
  join(here, "../loop/LoopMap.tsx"),
  "utf8",
);
const satelliteSource = readFileSync(
  join(here, "../../map/satellite-map.tsx"),
  "utf8",
);

/** The source between two markers (both must exist). */
function segment(src: string, from: string, to: string): string {
  const start = src.indexOf(from);
  assert.ok(start >= 0, `segment start missing: ${from}`);
  const end = src.indexOf(to, start + from.length);
  assert.ok(end >= 0, `segment end missing: ${to}`);
  return src.slice(start, end);
}

/**
 * Props-tolerant wrap check: a `<LoopMapBoundary …>` opening tag (any
 * props, any quote style) exists, a `<LoopMap …>` element starts after
 * it, and the matching `</LoopMapBoundary>` closes after that.
 */
function assertLoopMapWrapped(src: string, label: string): void {
  const open = src.match(/<LoopMapBoundary\b[\s\S]*?>/);
  assert.ok(open && open.index !== undefined, `${label}: no <LoopMapBoundary …> opening tag`);
  const openIdx = open.index!;
  const closeIdx = src.indexOf("</LoopMapBoundary>", openIdx);
  assert.ok(closeIdx > openIdx, `${label}: no </LoopMapBoundary> after the opening tag`);
  const mapIdx = src.slice(openIdx, closeIdx).search(/<LoopMap[\s>]/);
  assert.ok(
    mapIdx >= 0,
    `${label}: the LoopMap element must sit between <LoopMapBoundary …> and </LoopMapBoundary>`,
  );
}

describe("WebGL2 fix — Cold Trail contains the map constructor throw", () => {
  it("pin 1: TrailScreen imports the GeoDetective map boundary", () => {
    assert.match(
      trailSource,
      /import\s*\{[^}]*\bLoopMapBoundary\b[^}]*\}\s*from\s*["']\.\.\/loop\/loop-map-boundary["']\s*;/,
      "TrailScreen must import LoopMapBoundary from ../loop/loop-map-boundary (any quote style / import list)",
    );
  });

  it("pin 2: TrailScreen's LoopMap renders inside LoopMapBoundary", () => {
    assertLoopMapWrapped(trailSource, "TrailScreen");
  });

  it("pin 3: GeoDetective keeps the same wrapping (the reference pattern)", () => {
    assertLoopMapWrapped(loopScreenSource, "LoopScreen");
  });

  it("pin 4: the boundary reports narrowly — emitMapError gated on NOT-WebGL2", () => {
    assert.match(
      boundarySource,
      /import\s*\{[^}]*\bemitMapError\b[^}]*\}\s*from\s*["']@\/lib\/observability["']\s*;/,
      "LoopMapBoundary must import emitMapError — a contained non-WebGL2 failure is a real crash signal",
    );
    assert.match(
      boundarySource,
      /import\s*\{[^}]*\bisWebgl2Unavailable\b[^}]*\}\s*from\s*["']@\/lib\/webgl2-unavailable["']\s*;/,
      "the boundary must take the predicate from the leaf module",
    );
    assert.ok(
      !/from\s*["'][^"']*satellite-map/.test(boundarySource),
      "the boundary must not import the satellite-map stack",
    );
    const caught = segment(boundarySource, "componentDidCatch", "render()");
    assert.match(
      caught,
      /if\s*\(\s*!\s*isWebgl2Unavailable\(\s*error\s*\)\s*\)\s*\{?\s*emitMapError\(\s*error\s*\)/,
      "emitMapError must fire only on the NOT-WebGL2 branch — WebGL2 stays console-only, everything else is reported",
    );
    assert.match(
      caught,
      /console\.error\(/,
      "a contained failure is always console-logged (today's behaviour)",
    );
    assert.match(
      caught,
      /this\.props\.onFailed\?\.\(\)/,
      "the boundary must fire its optional onFailed callback from componentDidCatch",
    );
    assert.ok(
      boundarySource.includes("LoopMapOffLine"),
      "the boundary's fallback is the existing 'map pictures are off' line",
    );
  });
});

describe("WebGL2 fix — the WebGL2 predicate (behavioural)", () => {
  it("pin 5: matches the GPUInitializationError name", () => {
    const err = new Error("initialization failed");
    err.name = "GPUInitializationError";
    assert.equal(isWebgl2Unavailable(err), true);
  });

  it("pin 5: matches the 'WebGL2 is required' message", () => {
    assert.equal(
      isWebgl2Unavailable(new Error("WebGL2 is required to display this map")),
      true,
    );
    assert.equal(
      isWebgl2Unavailable(new Error("Failed: … WebGL2 is required …")),
      true,
    );
  });

  it("pin 5: rejects unrelated errors", () => {
    assert.equal(isWebgl2Unavailable(new Error("tile fetch failed")), false);
    assert.equal(isWebgl2Unavailable(new TypeError("undefined is not a function")), false);
    assert.equal(isWebgl2Unavailable(new Error("WebGL1 context creation failed")), false);
  });

  it("pin 5: rejects non-Error values, even ones shaped like the error", () => {
    assert.equal(isWebgl2Unavailable("WebGL2 is required"), false);
    assert.equal(
      isWebgl2Unavailable({ name: "GPUInitializationError", message: "WebGL2 is required" }),
      false,
    );
    assert.equal(isWebgl2Unavailable(null), false);
    assert.equal(isWebgl2Unavailable(undefined), false);
    assert.equal(isWebgl2Unavailable(42), false);
  });

  it("pin 5: satellite-map takes the predicate from the leaf module", () => {
    assert.match(
      satelliteSource,
      /from\s*["']@\/lib\/webgl2-unavailable["']/,
      "satellite-map must import isWebgl2Unavailable from src/lib/webgl2-unavailable",
    );
    assert.ok(
      !/function\s+isWebgl2Unavailable/.test(satelliteSource),
      "satellite-map must not keep a private copy of the predicate",
    );
  });
});

describe("WebGL2 fix — main game map falls back instead of the reload card", () => {
  it("pin 6: construction failure drops to the static fallback for WebGL2 in any mode", () => {
    const constructionCatch = segment(
      satelliteSource,
      "catch (err)",
      "maxBoundsRef.current",
    );
    const guard =
      /if\s*\(\s*mapMode\s*!==\s*"scout"\s*&&\s*!\s*isWebgl2Unavailable\(\s*err\s*\)\s*\)\s*throw\s+err\s*;/;
    const guardMatch = constructionCatch.match(guard);
    assert.ok(
      guardMatch && guardMatch.index !== undefined,
      "full mode may only rethrow construction errors that are NOT the WebGL2 gap",
    );
    const fallbackMatch = constructionCatch.match(/setScoutFallback\(\s*true\s*\)/);
    assert.ok(
      fallbackMatch && fallbackMatch.index !== undefined,
      "a contained construction failure must engage the static scout fallback",
    );
    assert.ok(
      guardMatch!.index! < fallbackMatch!.index!,
      "the rethrow guard must come before the fallback is engaged in the same catch",
    );
  });

  it("pin 7: the engaged fallback is playable — intro released, tiles settled, zoom hidden", () => {
    const release = segment(
      satelliteSource,
      "if (!scoutFallback) return;",
      "}, [scoutFallback, tileStatus.kind]);",
    );
    assert.match(
      release,
      /setIntroActive\(\s*false\s*\)/,
      "engaging the fallback must release the intro gate (the wrapper is inert until then)",
    );
    assert.match(
      release,
      /dispatchTile\(\s*\{\s*type:\s*"map-idle"\s*\}\s*\)/,
      "engaging the fallback must settle a still-loading tile status (no spinner forever)",
    );
    assert.match(
      satelliteSource,
      /!\s*scoutFallback\s*&&\s*\(\s*<ZoomControls/,
      "ZoomControls must be hidden while the camera-less fallback owns the surface",
    );
  });
});

describe("WebGL2 arena — Cold Trail map-off channel and LoopMap context loss", () => {
  it("pin 8: TrailScreen holds mapOff from both the tile channel and the boundary", () => {
    assert.match(
      trailSource,
      /onTilesFailed=\{handleMapFailed\}/,
      "TrailScreen must pass onTilesFailed to LoopMap (the tile/context-loss channel)",
    );
    assert.match(
      trailSource,
      /onFailed=\{handleMapFailed\}/,
      "TrailScreen must pass onFailed to LoopMapBoundary (the construction channel)",
    );
    assert.match(
      trailSource,
      /TILE_FALLBACK_COPY\.coldTrailMapOff/,
      "Cold Trail must show its own truthful off-line, not the GeoDetective one",
    );
    assert.match(
      trailSource,
      /placing\s*!==\s*null\s*&&\s*!\s*mapOff/,
      "placement must read as disarmed while the map is off (placingNow gates on !mapOff)",
    );
  });

  it("pin 9: LoopMap routes context loss and GPU errors to the map-off channel", () => {
    assert.match(
      loopMapSource,
      /addEventListener\(\s*["']webglcontextlost["']\s*,\s*reportTilesOff\s*\)/,
      "LoopMap must listen for webglcontextlost and route it to the map-off channel",
    );
    assert.match(
      loopMapSource,
      /isWebgl2Unavailable\([\s\S]{0,120}?\)\s*\)\s*\{\s*reportTilesOff\(\)/,
      "a MapLibre error carrying a GPU initialization failure must take the map-off channel, not the tile-only filter",
    );
  });
});
