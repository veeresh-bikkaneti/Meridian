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
});
