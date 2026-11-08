/**
 * F2 bundle split — the GeoDetective (Loop) / Cold Trail lazy boundary
 * in game-app.tsx.
 *
 * LoopScreen and TrailScreen statically import LoopMap, which
 * value-imports maplibre-gl (~1.1 MB) plus its stylesheet. While
 * game-app imported the two screens statically, the whole map library
 * landed in the preloaded route chunk and every home visit paid for it.
 * The screens are play-intent only, so they load through React.lazy —
 * the SatelliteMap pattern — behind Suspense (SessionLoadingFallback:
 * a destination-named role="status" fallback; PR #203 panel replaced
 * the silent BootSplash here) and MapErrorBoundary (chunk failure →
 * reload-retry, never a white screen).
 *
 * game-app.tsx is a large component with no unit-render harness in this
 * repo, so — like the boot-wiring pin in src/map/capability.test.ts —
 * the wiring is pinned by reading the source. The entry rule itself
 * (owner, 2026-11-08: a bare visit always lands on Home, even with a
 * saved meridian.loop.open flag from an older version) is walked
 * end-to-end by the Playwright spec in tests/e2e/entry-routing.spec.ts.
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

describe("F2 lazy boundary — open screens cross Suspense + error boundary", () => {
  it("boot never restores GeoDetective from a saved flag (entry rule, owner 2026-11-08)", () => {
    assert.ok(
      gameAppSource.includes("const [loopOpen, setLoopOpen] = useState<boolean>(false);"),
      "loopOpen must start closed on every boot — a bare visit lands on Home",
    );
    assert.ok(
      !gameAppSource.includes("readLoopOpen") && !gameAppSource.includes("writeLoopOpen"),
      "the persisted loop open flag must not be read or written any more",
    );
  });

  it("the loopOpen branch renders LoopScreen inside Suspense + MapErrorBoundary", () => {
    const branch = segment(gameAppSource, "if (loopOpen) {", "if (coldTrailOpen) {");
    // #210: the boundary carries the surface name for its card copy.
    assert.ok(branch.includes('<MapErrorBoundary surface="GeoDetective">'), "loop branch needs the chunk-failure boundary");
    assert.ok(
      branch.includes('<Suspense fallback={<SessionLoadingFallback label="Loading GeoDetective…" />}>'),
      "loop branch must show the destination-named session fallback while the chunk loads",
    );
    assert.ok(branch.includes("<LoopScreen"), "loop branch must render LoopScreen");
    // Boundary outside Suspense, mirroring the SatelliteMap render site.
    assert.ok(
      branch.indexOf("<MapErrorBoundary") < branch.indexOf("<Suspense"),
      "the error boundary wraps the Suspense boundary (SatelliteMap order)",
    );
  });

  it("the coldTrailOpen branch renders TrailScreen inside Suspense + MapErrorBoundary", () => {
    const branch = segment(
      gameAppSource,
      "if (coldTrailOpen) {",
      "// Chunk loading state:",
    );
    assert.ok(branch.includes('<MapErrorBoundary surface="Cold Trail">'), "trail branch needs the chunk-failure boundary");
    assert.ok(
      branch.includes('<Suspense fallback={<SessionLoadingFallback label="Loading Cold Trail…" />}>'),
      "trail branch must show the destination-named session fallback while the chunk loads",
    );
    assert.ok(branch.includes("<TrailScreen"), "trail branch must render TrailScreen");
  });

  it("BootSplash survives ONLY at the boot !ready gate (PR #203 panel)", () => {
    assert.ok(
      !gameAppSource.includes("fallback={<BootSplash />}"),
      "no Suspense boundary may fall back to the silent boot splash in-session",
    );
    assert.ok(
      gameAppSource.includes('if (!ready) {') &&
        gameAppSource.includes("return <BootSplash />;"),
      "the boot !ready gate keeps the BootSplash",
    );
    const fallback = segment(
      gameAppSource,
      "function SessionLoadingFallback",
      "export type Drop = {",
    );
    assert.ok(fallback.includes('role="status"'), "the session fallback must announce");
    assert.ok(
      fallback.includes("meridian-spinner"),
      "the session fallback reuses the existing spinner styling",
    );
  });

  it("coldTrailOpen follows the same entry rule as loopOpen (owner 2026-11-08)", () => {
    assert.ok(
      gameAppSource.includes("const [coldTrailOpen, setColdTrailOpen] = useState<boolean>(false);"),
      "coldTrailOpen must start closed on every boot — a bare visit lands on Home",
    );
    assert.ok(
      !gameAppSource.includes("readColdTrailOpen") && !gameAppSource.includes("writeColdTrailOpen"),
      "the persisted cold-trail open flag must not be read or written any more",
    );
    assert.ok(
      gameAppSource.includes("onColdTrail={withCardTap(\"coldtrail\", () => setColdTrailOpen(true))}"),
      "opening Cold Trail is the Home card tap — in-session state only",
    );
  });
});

describe("Core F-4 — no component prefetch; territory-data prefetch kept", () => {
  // The F2 component prefetches were REMOVED on purpose: a failed
  // dynamic import() is negatively cached by the browser for the life
  // of the document (see map-error-boundary.tsx), so a transient
  // hover-time failure guaranteed the click itself failed into the
  // error card. Swallowing the rejection in the helper could not help —
  // the module map itself was poisoned. The territory-DATA prefetch
  // stays: its loader evicts a failed load and retries, and a miss
  // degrades fail-closed, never to an error card.
  it("the component-prefetch helpers and their loader calls are gone", () => {
    assert.ok(
      !gameAppSource.includes("prefetchLoopScreen"),
      "prefetchLoopScreen must not exist (negative module caching, Core F-4)",
    );
    assert.ok(
      !gameAppSource.includes("prefetchTrailScreen"),
      "prefetchTrailScreen must not exist (negative module caching, Core F-4)",
    );
    assert.ok(
      !gameAppSource.includes("void loadLoopScreen().catch"),
      "no fire-and-forget component import may remain for Loop",
    );
    assert.ok(
      !gameAppSource.includes("void loadTrailScreen().catch"),
      "no fire-and-forget component import may remain for Trail",
    );
  });

  it("the home case-card buttons fire the territory-data prefetch on hover, focus, and pointerdown", () => {
    const loopButton = segment(gameAppSource, "onClick={onLoop}", "</button>");
    const trailButton = segment(gameAppSource, "onClick={onColdTrail}", "</button>");
    for (const [name, button] of [
      ["GeoDetective", loopButton],
      ["Cold Trail", trailButton],
    ] as const) {
      for (const hook of [
        "onPointerEnter={prefetchTerritoryData}",
        "onPointerDown={prefetchTerritoryData}",
        "onFocus={prefetchTerritoryDataOnFocus}",
      ]) {
        assert.ok(button.includes(hook), `${name} case card missing territory prefetch wiring: ${hook}`);
      }
    }
  });
});

describe("#209 — every gameplay chunk load is timeout-bounded", () => {
  // A hung import never settles, so an unbounded lazy()/await spins
  // its fallback forever. The race in src/lib/chunk-timeout.ts (unit
  // tested there) must wrap: the three lazy factories and openRun's
  // places+territory await. Removing any wrap reopens the hang.
  it("the lazy factories for Loop, Trail, and the satellite map race withChunkTimeout", () => {
    assert.ok(
      gameAppSource.includes('withChunkTimeout(import("./home-globe"), "the home globe")'),
      "the home globe's lazy load must be timeout-bounded too — a hang lands on its chunk fallback (#209)",
    );
    assert.ok(
      gameAppSource.includes('withChunkTimeout(loadLoopScreen(), "GeoDetective screen")'),
      "LoopScreen's lazy load must be timeout-bounded (#209)",
    );
    assert.ok(
      gameAppSource.includes('withChunkTimeout(loadTrailScreen(), "Cold Trail screen")'),
      "TrailScreen's lazy load must be timeout-bounded (#209)",
    );
    assert.ok(
      gameAppSource.includes('withChunkTimeout(import("@/map/satellite-map"), "Satellite map")'),
      "the satellite map's lazy load must be timeout-bounded (#209)",
    );
  });

  it("openRun races its places+territory await, so a hang lands in the existing start-error catch", () => {
    const openRun = segment(gameAppSource, "const openRun = useCallback(", "// \"Try again\" on the in-run start-failure box");
    assert.ok(
      openRun.includes("await withChunkTimeout("),
      "openRun's chunk await must be timeout-bounded (#209)",
    );
    assert.ok(
      openRun.indexOf("await withChunkTimeout(") < openRun.indexOf("commit(next);"),
      "the bounded await must precede the run commit",
    );
  });
});
