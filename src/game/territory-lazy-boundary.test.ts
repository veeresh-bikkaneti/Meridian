/**
 * F2b bundle split — the countries-50m lazy boundary in territory.ts.
 *
 * While territory.ts statically imported `world-atlas/countries-50m.json`
 * (~206 KB brotli), Rolldown factored the payload into its own PRELOADED
 * chunk and every home visit paid for data whose earliest true need is
 * inside gameplay (scorePlace's region bonus at the first pin drop, the
 * reveal pin-compare, the GeoDetective / Cold Trail territory units).
 * The data now loads only via the dynamic `import()` inside
 * territory.ts's cached-promise loader, started by `preloadTerritory()`.
 *
 * The runtime behavior of the lazy load itself (no load at import,
 * fail-closed sync reads, load-once memoization) is covered by
 * territory.test.ts and reverse-geocode.test.ts. This file pins the
 * WIRING, in the repo's established source-pin style (cf.
 * game-app-lazy-boundary.test.ts): no static import may creep back, and
 * every gameplay entry point must start or await the preload.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const territorySource = readFileSync(join(here, "territory.ts"), "utf8");
const gameAppSource = readFileSync(
  join(here, "../components/game-app.tsx"),
  "utf8",
);
const resultCardSource = readFileSync(
  join(here, "../components/result-card.tsx"),
  "utf8",
);
const loopScreenSource = readFileSync(join(here, "loop/LoopScreen.tsx"), "utf8");
const trailScreenSource = readFileSync(
  join(here, "coldtrail/TrailScreen.tsx"),
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

describe("F2b lazy boundary — territory.ts holds no static atlas import", () => {
  it("the TopoJSON loads only through a dynamic import", () => {
    assert.ok(
      !/^import\s+.*world-atlas\/countries-50m\.json/m.test(territorySource),
      "territory.ts must not statically import countries-50m.json (it re-enters the preloads)",
    );
    assert.ok(
      territorySource.includes('import("world-atlas/countries-50m.json"'),
      "the data must load via a dynamic import() inside territory.ts",
    );
  });

  it("the load is a cached-promise loader behind preloadTerritory", () => {
    assert.ok(
      territorySource.includes("export function preloadTerritory()"),
      "preloadTerritory is the public entry point gameplay code awaits",
    );
    assert.ok(
      territorySource.includes("if (!loadPromise)"),
      "the load must be guarded by the cached promise (load-once)",
    );
  });
});

describe("F2b wiring — gameplay entry points start or await the preload", () => {
  it("game-app imports preloadTerritory", () => {
    assert.ok(
      gameAppSource.includes('import { preloadTerritory } from "@/game/territory"'),
      "game-app must import the territory preload",
    );
  });

  it("openRun awaits the preload alongside the places load", () => {
    const openRun = segment(gameAppSource, "const openRun = useCallback(", "const startReview");
    assert.ok(
      openRun.includes("preloadTerritory()"),
      "openRun must preload the territory data before a run commits",
    );
    assert.ok(
      openRun.includes("Promise.all"),
      "the preload must ride in parallel with the places load, not serialize after it",
    );
  });

  it("the edition cards prefetch the data on intent", () => {
    for (const hook of [
      "onPointerEnter={prefetchTerritoryData}",
      "onPointerDown={prefetchTerritoryData}",
      "onFocus={prefetchTerritoryData}",
    ]) {
      assert.ok(gameAppSource.includes(hook), `missing edition-card prefetch wiring: ${hook}`);
    }
  });

  it("the Loop/Trail intent prefetches also warm the territory data", () => {
    assert.ok(
      segment(gameAppSource, "function prefetchLoopScreen", "function prefetchTrailScreen").includes(
        "preloadTerritory()",
      ),
      "prefetchLoopScreen must also start the territory load",
    );
    assert.ok(
      segment(gameAppSource, "function prefetchTrailScreen", "function prefetchTerritoryData").includes(
        "preloadTerritory()",
      ),
      "prefetchTrailScreen must also start the territory load",
    );
  });

  it("the reveal card and the two play screens start the load on mount", () => {
    for (const [name, src] of [
      ["result-card", resultCardSource],
      ["LoopScreen", loopScreenSource],
      ["TrailScreen", trailScreenSource],
    ] as const) {
      assert.ok(
        src.includes("void preloadTerritory().then("),
        `${name} must start preloadTerritory on mount and re-render when it lands`,
      );
    }
  });
});
