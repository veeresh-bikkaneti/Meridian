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

  it("the Loop/Trail case cards warm the territory data on intent (Core F-4: data prefetch kept, component prefetch removed)", () => {
    // The cards no longer prefetch the screen COMPONENTS (a failed
    // import() is negatively cached for the document's life — see
    // game-app-lazy-boundary.test.ts), but their intent handlers still
    // fire prefetchTerritoryData, whose body is the territory preload.
    assert.ok(
      segment(gameAppSource, "function prefetchTerritoryData", "import {").includes(
        "void preloadTerritory();",
      ),
      "prefetchTerritoryData must start the territory load",
    );
    for (const marker of ["onClick={onLoop}", "onClick={onColdTrail}"]) {
      const button = segment(gameAppSource, marker, "</button>");
      assert.ok(
        button.includes("onPointerEnter={prefetchTerritoryData}") &&
          button.includes("onPointerDown={prefetchTerritoryData}") &&
          button.includes("onFocus={prefetchTerritoryData}"),
        `case card at ${marker} must fire the territory prefetch on pointerenter/pointerdown/focus`,
      );
    }
  });

  it("the loader evicts a failed load so the next preload retries (retry-eviction branch)", () => {
    // Source pin: territory.test.ts runs against the real atlas file,
    // so no failing load can be driven at runtime without a test seam
    // in production code. The eviction assignment inside the loader's
    // catch is therefore pinned here — removing it (a poisoned cached
    // promise forever) fails this test.
    const loader = segment(territorySource, "function loadCountryFeatures", "export function preloadTerritory");
    assert.ok(loader.includes(".catch((err: unknown) => {"), "the loader must catch load failures");
    assert.ok(
      loader.includes("loadPromise = null;"),
      "a failed load must evict the cached promise so the next call retries",
    );
  });

  it("preloadTerritory swallows both outcomes (the never-rejects contract)", () => {
    // Awaiting gameplay entry points (openRun, boot restore, onReplay)
    // rely on this: preloadTerritory must resolve even when the load
    // fails. Pinned by shape — the two-branch then() that maps both
    // fulfillment and rejection to undefined.
    const preload = segment(territorySource, "export function preloadTerritory", "territoryLoadRunsForTests");
    assert.ok(preload.includes("loadCountryFeatures().then("), "preload must ride the shared loader");
    assert.equal(
      preload.split("() => undefined").length - 1,
      2,
      "both the fulfill and reject branches must map to undefined (never rejects)",
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

describe("Core F-2 — every run start crosses an AWAITED territory preload", () => {
  it("boot restore: an aim-phase restored run commits only after the preload lands", () => {
    // The F-2 shape this catches: `void preloadTerritory()` followed by
    // an immediate commit(restored) — a restored aim run whose first
    // pin drop scored against the fail-closed default.
    const restore = segment(
      gameAppSource,
      "if (isResumable(resumable, today)) {",
      "const refreshForNewBuild",
    );
    assert.ok(
      restore.includes('restored.phase === "aim"'),
      "the boot restore must branch on the aim phase",
    );
    assert.ok(
      restore.includes("void preloadTerritory().then(() => {"),
      "the aim-phase commit must be deferred behind the preload promise",
    );
    assert.ok(
      restore.indexOf("void preloadTerritory().then(() => {") < restore.indexOf("commit(restored)"),
      "the deferred commit must sit behind the preload, never ahead of it",
    );
  });

  it("onReplay: the Play-again commit awaits the preload (async funnel like openRun)", () => {
    const replay = segment(gameAppSource, "async function onReplay()", "// Review sessions replay");
    assert.ok(
      replay.includes("await preloadTerritory();"),
      "onReplay must await the territory preload",
    );
    assert.ok(
      replay.indexOf("await preloadTerritory();") < replay.indexOf("onRun(freshRun)"),
      "the await must precede the replayed run's commit",
    );
  });
});

describe("Core F-3 — GeoDetective tap names are re-resolved at pick time", () => {
  it("LoopScreen imports unlabeledSpotEntry for the re-resolution", () => {
    assert.ok(
      loopScreenSource.includes(
        'import { displayLoopName, fetchLoopIndex, isDuplicateGuess, unlabeledSpotEntry } from "./evaluate";',
      ),
      "LoopScreen must import unlabeledSpotEntry from evaluate",
    );
  });

  it("onPick re-resolves tap entries before the duplicate check and the submit", () => {
    // The F-3 shape this catches: the entry LoopMap built at tap time
    // (possibly named "open water" pre-load) flowing straight into
    // buildLoopGuess. Tap entries are discriminated by their "tap:" id
    // — the same discrimination evaluate.test.ts uses.
    const onPick = segment(loopScreenSource, "const onPick = (entry: LoopNameEntry)", "const progressed: LoopPuzzleState");
    assert.ok(
      onPick.includes('entry.id.startsWith("tap:")'),
      "onPick must discriminate tap entries by their tap: id",
    );
    assert.ok(
      onPick.includes("unlabeledSpotEntry(entry.lon, entry.lat)"),
      "onPick must re-resolve the tap entry from its coordinates at pick time",
    );
    assert.ok(
      onPick.indexOf("unlabeledSpotEntry(entry.lon, entry.lat)") < onPick.indexOf("isDuplicateGuess("),
      "the re-resolution must happen before the duplicate check (same id, fresh name)",
    );
  });

  it("the confirm sheet re-derives tap entries at render (no frozen snapshot)", () => {
    // PR #203 panel, Eng BLOCK: onPick's re-resolution fixed the RECORDED
    // name, but the PlaceSheet still rendered the frozen `selected`
    // snapshot — a pre-load land tap showed "Open Water" in the sheet
    // while the guess recorded under the correct name. The sheet's entry
    // must be re-derived from the selected coordinates for tap: ids.
    const sheet = segment(
      loopScreenSource,
      "{selected && !finished ? (",
      "<section aria-label=\"Clues\"",
    );
    assert.ok(
      sheet.includes('selected.id.startsWith("tap:")'),
      "the sheet render must discriminate tap entries by their tap: id",
    );
    assert.ok(
      sheet.includes("unlabeledSpotEntry(selected.lon, selected.lat)"),
      "the sheet entry must be re-derived from the selected coordinates at render",
    );
    assert.ok(
      !sheet.includes("entry={selected}"),
      "the sheet must not render the frozen selected snapshot directly",
    );
  });
});
