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
 * the wiring is pinned by reading the source. The runtime resume path
 * itself (tapping the GeoDetective card reopens the saved mystery
 * without re-dealing) is walked end-to-end by the Playwright specs
 * "reload mid-game lands on Home; tapping in resumes the open mystery
 * without re-dealing" in tests/e2e/geodetective.spec.ts and the boot
 * spec tests/e2e/geodetective-boot-home.desktop.spec.ts. B7 (owner
 * ruling, 2026-11-09): boot NEVER auto-opens from the saved
 * meridian.loop.open flag — the flag restores nothing on boot.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const gameAppSource = readFileSync(join(here, "game-app.tsx"), "utf8");
// Step 7 (TD-06.7): openRun lives in use-run-controller.ts now.
const runControllerSource = readFileSync(join(here, "use-run-controller.ts"), "utf8");
// Step 14 (TD-06.10): the TrailScreen lazy factory and the leave
// wiring live in src/game/coldtrail/ColdTrailHost.tsx now.
const coldTrailHostSource = readFileSync(
  join(here, "../game/coldtrail/ColdTrailHost.tsx"),
  "utf8",
);
// Step 15 (TD-06.11): the LoopScreen lazy factory and the leave
// wiring live in src/game/loop/GeoDetectiveHost.tsx now.
const geoDetectiveHostSource = readFileSync(
  join(here, "../game/loop/GeoDetectiveHost.tsx"),
  "utf8",
);
const chunkReloadNoticeSource = readFileSync(
  join(here, "use-chunk-reload-notice.ts"),
  "utf8",
);
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
      geoDetectiveHostSource.includes("const LoopScreen = lazy("),
      "LoopScreen must be a React.lazy component",
    );
    assert.ok(
      coldTrailHostSource.includes("const TrailScreen = lazy("),
      "TrailScreen must be a React.lazy component",
    );
    assert.ok(
      geoDetectiveHostSource.includes('import("@/game/loop/LoopScreen")'),
      "the Loop loader must dynamically import the LoopScreen module",
    );
    assert.ok(
      coldTrailHostSource.includes('import("@/game/coldtrail/TrailScreen")'),
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
  it("boot never auto-opens GeoDetective from the saved loopOpen flag (B7)", () => {
    // The 368 rule (owner condition): a bare visit always lands on
    // Home — boot never reads the persisted open flag. The one
    // exception is the error screen's Try again: boot consumes its
    // one-shot session marker (consumeRetryScreen) and loopOpen
    // initialises open only when that marker names GeoDetective.
    assert.ok(
      gameAppSource.includes(
        'const [loopOpen, setLoopOpen] = useState<boolean>(() => bootRetryRef.current === "GeoDetective");',
      ),
      "loopOpen must initialize from the one-shot retry marker only, never from the persisted flag",
    );
    assert.ok(
      gameAppSource.includes("bootRetryRef.current = consumeRetryScreen();"),
      "boot must consume the one-shot retry marker before the open states initialise",
    );
    assert.ok(
      !gameAppSource.includes("useState<boolean>(() => readLoopOpen())"),
      "boot must not read the persisted open flag for its landing",
    );
    // The flag itself still exists: tap-in writes it, leave clears it —
    // only the boot restore is gone.
    assert.ok(
      gameAppSource.includes("writeLoopOpen(true);"),
      "tap-in must still record the open flag",
    );
  });

  it("the loopOpen branch renders the GeoDetective host inside Suspense + MapErrorBoundary", () => {
    const branch = segment(gameAppSource, "if (loopOpen) {", "if (coldTrailOpen) {");
    // #210: the boundary carries the surface name for its card copy.
    assert.ok(branch.includes('<MapErrorBoundary surface="GeoDetective">'), "loop branch needs the chunk-failure boundary");
    assert.ok(
      branch.includes('<Suspense fallback={<SessionLoadingFallback label="Loading GeoDetective…" />}>'),
      "loop branch must show the destination-named session fallback while the chunk loads",
    );
    assert.ok(branch.includes("<GeoDetectiveHost"), "loop branch must render GeoDetectiveHost");
    assert.ok(
      branch.includes("onLeave={() => setLoopOpen(false)}"),
      "the host's leave callback must clear the shell's open state",
    );
    assert.ok(
      geoDetectiveHostSource.includes("<LoopScreen"),
      "the host must render LoopScreen",
    );
    // Step 15 (TD-06.11): the leave wiring is split — the host
    // clears the persisted flag, then the shell callback it was
    // handed clears the open state.
    assert.ok(
      geoDetectiveHostSource.includes("writeLoopOpen(false);"),
      "leaving GeoDetective must clear the persisted flag (host leave wiring)",
    );
    // Boundary outside Suspense, mirroring the SatelliteMap render site.
    assert.ok(
      branch.indexOf("<MapErrorBoundary") < branch.indexOf("<Suspense"),
      "the error boundary wraps the Suspense boundary (SatelliteMap order)",
    );
  });

  it("the coldTrailOpen branch renders the Cold Trail host inside Suspense + MapErrorBoundary", () => {
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
    assert.ok(branch.includes("<ColdTrailHost"), "trail branch must render ColdTrailHost");
    assert.ok(
      coldTrailHostSource.includes("<TrailScreen"),
      "the host must render TrailScreen",
    );
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
    // Phase 0 slice 1: `export type Drop` moved verbatim to
    // src/game/shell-helpers.ts, so the segment now ends at the next
    // declaration after the fallback (ModelAvailability). What the
    // segment pins — the fallback's role="status" + spinner — is unchanged.
    const fallback = segment(
      gameAppSource,
      "function SessionLoadingFallback",
      'type ModelAvailability = "available"',
    );
    assert.ok(fallback.includes('role="status"'), "the session fallback must announce");
    assert.ok(
      fallback.includes("meridian-spinner"),
      "the session fallback reuses the existing spinner styling",
    );
  });

  it("coldTrailOpen follows the 368 rule: flag written on tap-in/leave, boot restore only via the retry marker", () => {
    // Supersedes the PR #203 reload-restore pin: under the 368 rule
    // (owner condition) a bare visit always lands on Home, so boot
    // must NOT initialise from the persisted flag. The only boot
    // restore is the error screen's Try again — the one-shot session
    // marker consumed next to loopOpen — and coldTrailOpen
    // initialises open only when that marker names Cold Trail.
    assert.ok(
      gameAppSource.includes(
        'const [coldTrailOpen, setColdTrailOpen] = useState<boolean>(() => bootRetryRef.current === "Cold Trail");',
      ),
      "coldTrailOpen must initialize from the one-shot retry marker only, never from the persisted flag",
    );
    assert.ok(
      !gameAppSource.includes("useState<boolean>(() => readColdTrailOpen())"),
      "boot must not read the persisted Cold Trail flag for its landing (368 rule)",
    );
    assert.ok(
      gameAppSource.includes("writeColdTrailOpen(true); setColdTrailOpen(true);"),
      "opening Cold Trail must persist the flag",
    );
    // Step 14 (TD-06.10): the leave wiring is split — the host
    // clears the persisted flag, then the shell callback it was
    // handed clears the open state.
    assert.ok(
      coldTrailHostSource.includes("writeColdTrailOpen(false);"),
      "leaving Cold Trail must clear the persisted flag (host leave wiring)",
    );
    assert.ok(
      gameAppSource.includes("<ColdTrailHost onLeave={() => setColdTrailOpen(false)} />"),
      "the host's leave callback must clear the shell's open state",
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
    assert.ok(
      !coldTrailHostSource.includes("void loadTrailScreen().catch"),
      "no fire-and-forget component import may remain for Trail (host)",
    );
    assert.ok(
      !geoDetectiveHostSource.includes("void loadLoopScreen().catch"),
      "no fire-and-forget component import may remain for Loop (host)",
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
      geoDetectiveHostSource.includes('withChunkTimeout(loadLoopScreen(), "GeoDetective screen")'),
      "LoopScreen's lazy load must be timeout-bounded (#209)",
    );
    assert.ok(
      coldTrailHostSource.includes('withChunkTimeout(loadTrailScreen(), "Cold Trail screen")'),
      "TrailScreen's lazy load must be timeout-bounded (#209)",
    );
    assert.ok(
      gameAppSource.includes('withChunkTimeout(import("@/map/satellite-map"), "Satellite map")'),
      "the satellite map's lazy load must be timeout-bounded (#209)",
    );
  });

  it("openRun races its places+territory await, so a hang lands in the existing start-error catch", () => {
    const openRun = segment(runControllerSource, "const openRun = useCallback(", "const startReview = useCallback(");
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

describe("arena Phase 2 (PR #532): boundary-less hosts and notice timing", () => {
  it("F4: AgeAskGate renders inside MapErrorBoundary", () => {
    assert.ok(
      gameAppSource.includes('<MapErrorBoundary surface="Age picker">'),
      "the age-ask gate must show the standard card on a chunk failure, not unmount the app",
    );
  });

  it("F4: every AgeProfileSettings render site renders inside MapErrorBoundary", () => {
    const sites = gameAppSource.split('<MapErrorBoundary surface="Age settings">').length - 1;
    assert.equal(sites, 2, "both settings sites (subjects branch and Home) are wrapped");
  });

  it("F4: JournalPlayer is wrapped in its fail-closed local boundary, so Home survives its chunk failure", () => {
    assert.ok(gameAppSource.includes("<JournalBoundary>"), "the journal player must fail closed in place");
    assert.ok(gameAppSource.includes("</JournalBoundary>"), "the journal boundary must close around the player");
  });

  it("F4: GlobeChunkFallback marks itself so the recovery handler stands down", () => {
    assert.ok(
      gameAppSource.includes('data-chunk-fallback="globe"'),
      "the globe's graceful fallback must carry data-chunk-fallback",
    );
  });

  it("F7d: the chunk-reload notice is consumed at the ready point, not in the mount effect", () => {
    // TD-06.5: the consume lives in the useChunkReloadNotice hook now;
    // game-app calls the hook's consume at the same ready point, and the
    // hook module holds the one chunk-recovery consume.
    const readyEffect = segment(gameAppSource, "if (ready && !readySignaledRef.current) {", "}, [ready, consumeChunkReloadNoticeOnce]);");
    assert.ok(
      readyEffect.includes("consumeChunkReloadNoticeOnce()"),
      "consume must ride the __meridian_ready signal so a mount-then-stall page keeps its notice for the watchdog",
    );
    assert.equal(
      gameAppSource.split("consumeChunkReloadNoticeOnce()").length - 1,
      1,
      "exactly one consume site in game-app",
    );
    assert.equal(
      chunkReloadNoticeSource.split("consumeChunkReloadNotice()").length - 1,
      1,
      "exactly one chunk-recovery consume site, inside the hook",
    );
  });

  it("F8: the menu loadNotice card offers a reload button beside the message", () => {
    const notice = segment(gameAppSource, "const loadNotice = startError ? (", "const discardedNoticeEl");
    assert.ok(notice.includes("Try again"), "the non-stale menu card must not be button-less");
    assert.ok(notice.includes("window.location.reload()"), "the menu card's button is a plain reload, like the in-run variant");
  });
});
