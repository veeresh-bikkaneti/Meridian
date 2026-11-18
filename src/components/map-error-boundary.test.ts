/**
 * #210 — MapErrorBoundary stale-probe + destination-neutral copy
 * (source pin).
 *
 * The boundary wraps the map, GeoDetective, and Cold Trail. Two
 * behaviors are pinned here (the card needs a browser to render
 * end-to-end; the behavioral half rides the chunk E2E suite):
 *
 * 1. On error it probes `isNewBuildDeployed()` once per error; a
 *    stale verdict swaps the card to the owner-approved update
 *    prompt, verbatim — "A new version of Meridian is available." —
 *    with a Refresh action. A failed probe keeps the neutral card
 *    (fail closed).
 * 2. The neutral card names the wrapped surface via the `surface`
 *    prop instead of always claiming "the map": GeoDetective and
 *    Cold Trail failures were being reported as map failures.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const boundarySource = readFileSync(join(here, "map-error-boundary.tsx"), "utf8");
const gameAppSource = readFileSync(join(here, "game-app.tsx"), "utf8");

/** The source between two markers (both must exist). */
function segment(src: string, from: string, to: string): string {
  const start = src.indexOf(from);
  assert.ok(start >= 0, `segment start missing: ${from}`);
  const end = src.indexOf(to, start + from.length);
  assert.ok(end >= 0, `segment end missing: ${to}`);
  return src.slice(start, end);
}

describe("#210 boundary probes staleness and routes to the update prompt", () => {
  it("the probe is the shared isNewBuildDeployed, started from the catch path, once per error", () => {
    assert.ok(
      boundarySource.includes('import { isNewBuildDeployed } from "@/game/build-staleness";'),
      "the boundary must use the shared build-staleness probe (#210)",
    );
    const caught = segment(boundarySource, "componentDidCatch", "private startStaleProbe");
    assert.ok(caught.includes("this.startStaleProbe(error);"), "componentDidCatch must start the probe");
    const probe = segment(boundarySource, "private startStaleProbe", "private focusAlert");
    assert.ok(probe.includes("if (this.probedFor === error) return;"), "the probe must run once per error");
    assert.ok(probe.includes("this.setState({ staleBuild: true })"), "a stale verdict must swap the card");
  });

  it("the stale card carries the approved copy verbatim and a Refresh action", () => {
    assert.ok(
      boundarySource.includes("A new version of Meridian is available."),
      "stale copy must match the owner-approved wording exactly (#210)",
    );
    const staleCard = segment(boundarySource, "this.state.staleBuild ? (", ") : (");
    assert.ok(staleCard.includes("Refresh"), "the stale card's action must be Refresh");
    assert.ok(staleCard.includes("Your game is safe"), "the stale card must reassure that the game is safe");
  });

  it("the neutral card names the surface prop, defaulting to the map", () => {
    assert.ok(
      boundarySource.includes('const surface = this.props.surface ?? "the map";'),
      "the neutral heading must default to the map for the map render site",
    );
    assert.ok(
      boundarySource.includes("Couldn&rsquo;t load {surface}."),
      "the neutral heading must name the wrapped surface, not a hardcoded destination",
    );
    assert.ok(
      !boundarySource.includes("the map just didn&rsquo;t finish"),
      "the neutral body must not claim the map failed on non-map screens",
    );
  });

  it("game-app passes the real surface at the GeoDetective and Cold Trail sites", () => {
    assert.ok(
      gameAppSource.includes('<MapErrorBoundary surface="GeoDetective">'),
      "the LoopScreen site must name GeoDetective (#210)",
    );
    assert.ok(
      gameAppSource.includes('<MapErrorBoundary surface="Cold Trail">'),
      "the TrailScreen site must name Cold Trail (#210)",
    );
  });

  it("the Refresh offer honors the shared one-shot stale-refresh guard", () => {
    assert.ok(
      boundarySource.includes('const STALE_REFRESH_KEY = "meridian.staleRefresh";'),
      "the boundary must use the shared stale-refresh key",
    );
    assert.ok(
      gameAppSource.includes('const STALE_REFRESH_KEY = "meridian.staleRefresh";'),
      "game-app must use the same key — the two literals are pinned together",
    );
    const probe = segment(boundarySource, "private startStaleProbe", "private focusAlert");
    assert.ok(
      probe.includes("staleRefreshRecentlyUsed()) return;"),
      "an already-refreshed tab (inside the F6 window) must skip the probe (neutral card, no Refresh loop)",
    );
    const retry = segment(boundarySource, "private retry", "render()");
    assert.ok(
      retry.includes("setItem(STALE_REFRESH_KEY, String(Date.now()))"),
      "tapping Refresh on the stale card must arm the one-shot guard with a timestamp (F6)",
    );
  });

  it("item 7: a failed persisted screen is not restored, and the card offers Home", () => {
    const caught = segment(boundarySource, "componentDidCatch", "private startStaleProbe");
    assert.ok(
      caught.includes("clearPersistedScreenOpen(this.props.surface);"),
      "the catch must clear the failed screen's persisted open flag (INV1)",
    );
    const retry = segment(boundarySource, "private retry", "private goHome");
    assert.ok(
      retry.includes("rearmPersistedScreenOpen(this.props.surface);"),
      "Try again must re-arm the flag so its reload retries the screen (INV1)",
    );
    const render = segment(boundarySource, "render(): ReactNode", "return this.props.children;");
    assert.ok(
      render.includes("isPersistedScreen(this.props.surface)"),
      "the Home control must be gated to the persisted screens",
    );
    assert.ok(
      render.includes("<HomeButton onHome={this.goHome} />"),
      "the card must offer the shared Home control beside Try again / Refresh (INV2)",
    );
    const goHome = segment(boundarySource, "private goHome", "render()");
    assert.ok(
      goHome.includes("clearPersistedScreenOpen(this.props.surface);"),
      "Home must leave the failed screen's flag cleared so the reload boots to Home",
    );
  });
});

describe("chunk skew: the boundary recovers itself and reports only the post-reload repeat", () => {
  it("a confirmed-stale chunk failure issues the guarded reload from the probe path", () => {
    assert.ok(
      boundarySource.includes("attemptGuardedChunkReload({"),
      "the probe's stale verdict must attempt the guarded chunk reload",
    );
    const probe = segment(boundarySource, "private startStaleProbe", "private focusAlert");
    assert.ok(
      probe.includes("isChunkLoadError(error)"),
      "the self-reload is scoped to chunk-load failures, not render errors",
    );
    assert.ok(
      probe.includes("rearmPersistedScreenOpen(this.props.surface)"),
      "the reload must re-arm the persisted screen so the fresh shell restores it",
    );
  });

  it("the catch reports through the chunk-aware rule, never directly", () => {
    const caught = segment(boundarySource, "componentDidCatch", "private reportError");
    assert.ok(
      caught.includes("this.reportError(error);"),
      "componentDidCatch must route reporting through reportError",
    );
    assert.ok(
      !caught.includes("emitMapError(error);"),
      "componentDidCatch must not file a crash report unconditionally",
    );
    const report = segment(boundarySource, "private reportError", "private startStaleProbe");
    assert.ok(
      report.includes("isChunkLoadError(error)"),
      "the report rule must classify chunk-load failures",
    );
    assert.ok(
      report.includes("shouldReportChunkFailure("),
      "a chunk failure is reported only through the shared F3 discipline (fresh stamp, surface-matched)",
    );
    assert.ok(
      report.includes('this.props.surface ?? "the map"'),
      "the discipline is judged against THIS boundary's surface, so another surface's reload cannot report here",
    );
  });
});

describe("arena Phase 2 (PR #532): exit/restore, dwell-for-all, deferred report", () => {
  it("F2: the alert root carries data-map-error-card and data-surface for every surface", () => {
    assert.ok(boundarySource.includes('data-map-error-card=""'), "the card root must carry the dwell attribute");
    assert.ok(boundarySource.includes("data-surface={surface}"), "the card root must name its surface");
  });

  it("F1b/c/d: goHome cancels the probe, strips the screen hash, clears the marker path and emits the deferred report", () => {
    const goHome = segment(boundarySource, "private goHome", "render()");
    assert.ok(goHome.includes("this.exitChosen = true;"), "goHome must set the exit-intent guard");
    assert.ok(goHome.includes("clearPersistedScreenOpen(this.props.surface);"), "goHome clears the persisted flag (and, via F1a, the retry marker)");
    assert.ok(goHome.includes("this.suppressedChunkError"), "goHome must emit a catch-suppressed chunk report before leaving");
    assert.ok(goHome.includes("emitMapError(deferred);"), "the deferred report goes through the shared emitter");
    assert.ok(goHome.includes('hashForScreen("home")'), "goHome must rewrite the fragment to Home's hash so boot cannot resurrect the screen");
    const probe = segment(boundarySource, "private startStaleProbe", "private focusAlert");
    assert.ok(probe.includes("!this.exitChosen"), "a late probe resolution must not reload after the player chose Home");
  });

  it("F3: a suppressed catch report is tracked on the instance", () => {
    const report = segment(boundarySource, "private reportError", "private startStaleProbe");
    assert.ok(report.includes("this.suppressedChunkError = error;"), "a silent first failure is held for the goHome path");
  });

  it("F3: the guarded reload carries this boundary's surface as the companion record", () => {
    const probe = segment(boundarySource, "private startStaleProbe", "private focusAlert");
    assert.ok(probe.includes('surface: this.props.surface ?? "the map"'), "attemptGuardedChunkReload must receive the surface");
  });
});
