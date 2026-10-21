/**
 * F2 bundle split — the GeoDetective (Loop) / Cold Trail lazy boundary
 * in game-app.tsx.
 *
 * LoopScreen and TrailScreen statically import LoopMap, which
 * value-imports maplibre-gl (~1.1 MB) plus its stylesheet. While
 * game-app imported the two screens statically, the whole map library
 * landed in the preloaded route chunk and every home visit paid for it.
 * The screens are play-intent only, so they load through React.lazy —
 * the SatelliteMap pattern — behind Suspense (BootSplash fallback) and
 * MapErrorBoundary (chunk failure → reload-retry, never a white screen).
 *
 * game-app.tsx is a large component with no unit-render harness in this
 * repo, so — like the boot-wiring pin in src/map/capability.test.ts —
 * the wiring is pinned by reading the source. The runtime restore path
 * itself (a saved meridian.loop.open flag reopening GeoDetective across
 * this boundary after a reload) is walked end-to-end by the Playwright
 * spec "reload mid-game resumes the open mystery without re-dealing"
 * in tests/e2e/geodetective.spec.ts.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const gameAppSource = readFileSync(join(here, "game-app.tsx"), "utf8");
const loopMapSource = readFileSync(
  join(here, "../game/loop/LoopMap.tsx"),
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

describe("F2 lazy boundary — Loop/Trail are not eagerly imported", () => {
  it("game-app has no static import of either screen", () => {
    assert.ok(
      !/import\s*\{\s*LoopScreen\s*\}/.test(gameAppSource),
      "LoopScreen must not be statically imported (it drags MapLibre in)",
    );
    assert.ok(
      !/import\s*\{\s*TrailScreen\s*\}/.test(gameAppSource),
      "TrailScreen must not be statically imported (it drags MapLibre in)",
    );
  });

  it("both screens are declared via React.lazy over a dynamic import", () => {
    assert.ok(
      gameAppSource.includes("const LoopScreen = lazy("),
      "LoopScreen must be a React.lazy component",
    );
    assert.ok(
      gameAppSource.includes("const TrailScreen = lazy("),
      "TrailScreen must be a React.lazy component",
    );
    assert.ok(
      gameAppSource.includes('import("@/game/loop/LoopScreen")'),
      "the Loop loader must dynamically import the LoopScreen module",
    );
    assert.ok(
      gameAppSource.includes('import("@/game/coldtrail/TrailScreen")'),
      "the Trail loader must dynamically import the TrailScreen module",
    );
  });

  it("LoopMap still value-imports maplibre-gl (deferred, not removed)", () => {
    assert.ok(
      loopMapSource.includes('from "maplibre-gl"'),
      "LoopMap's MapLibre import is the payload this boundary defers",
    );
  });
});

describe("F2 lazy boundary — restore path crosses Suspense + error boundary", () => {
  it("the saved loopOpen flag still restores GeoDetective on boot", () => {
    assert.ok(
      gameAppSource.includes("useState<boolean>(() => readLoopOpen())"),
      "loopOpen must keep initializing from the persisted flag",
    );
  });

  it("the loopOpen branch renders LoopScreen inside Suspense + MapErrorBoundary", () => {
    const branch = segment(gameAppSource, "if (loopOpen) {", "if (coldTrailOpen) {");
    assert.ok(branch.includes("<MapErrorBoundary>"), "loop branch needs the chunk-failure boundary");
    assert.ok(
      branch.includes("<Suspense fallback={<BootSplash />}>"),
      "loop branch must show the BootSplash while the chunk loads (restore first paint)",
    );
    assert.ok(branch.includes("<LoopScreen"), "loop branch must render LoopScreen");
    // Boundary outside Suspense, mirroring the SatelliteMap render site.
    assert.ok(
      branch.indexOf("<MapErrorBoundary>") < branch.indexOf("<Suspense"),
      "the error boundary wraps the Suspense boundary (SatelliteMap order)",
    );
  });

  it("the coldTrailOpen branch renders TrailScreen inside Suspense + MapErrorBoundary", () => {
    const branch = segment(
      gameAppSource,
      "if (coldTrailOpen) {",
      "// Chunk loading state:",
    );
    assert.ok(branch.includes("<MapErrorBoundary>"), "trail branch needs the chunk-failure boundary");
    assert.ok(
      branch.includes("<Suspense fallback={<BootSplash />}>"),
      "trail branch must show the BootSplash while the chunk loads",
    );
    assert.ok(branch.includes("<TrailScreen"), "trail branch must render TrailScreen");
  });
});

describe("F2 lazy boundary — prefetch on intent is fire-and-forget safe", () => {
  it("prefetch helpers call the shared loaders and swallow rejections", () => {
    assert.ok(
      gameAppSource.includes("void loadLoopScreen().catch(() => {})"),
      "loop prefetch must catch silently — the render path owns failures",
    );
    assert.ok(
      gameAppSource.includes("void loadTrailScreen().catch(() => {})"),
      "trail prefetch must catch silently — the render path owns failures",
    );
  });

  it("the home case-card buttons prefetch on hover, focus, and pointerdown", () => {
    for (const hook of [
      "onPointerEnter={prefetchLoopScreen}",
      "onPointerDown={prefetchLoopScreen}",
      "onFocus={prefetchLoopScreen}",
      "onPointerEnter={prefetchTrailScreen}",
      "onPointerDown={prefetchTrailScreen}",
      "onFocus={prefetchTrailScreen}",
    ]) {
      assert.ok(gameAppSource.includes(hook), `missing prefetch wiring: ${hook}`);
    }
  });
});
