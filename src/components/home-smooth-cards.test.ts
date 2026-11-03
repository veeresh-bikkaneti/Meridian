/**
 * Smooth cards (feat/smooth-cards) — the film cards' gradient fade,
 * plus the removal record for the spot illustrations' CSS motion.
 *
 * Same source-pinning style as card-film.test.ts and
 * home-loading-orbs.test.ts (this repo has no React-render harness):
 * the fade's coverage of every film state and the toggle's safety
 * are pinned by reading the source. The visual result is covered by
 * the capture set in ~/workspace/meridian-smooth-cards-evidence and
 * by the home E2E specs against the built app.
 *
 * Part 2 history: the Review, Journal, and Grown-ups illustrations
 * first got CSS settling passes (hv5-art-drift / hv5-art-sway /
 * hv5-art-float, armed by LazyHomeImage with an hv5-art-live
 * class). The owner rejected that class of motion on 2026-11-03
 * and ruled the three cards get animated cartoon films instead,
 * through the one CardFilm system. The CSS passes, their keyframes,
 * and the LazyHomeImage arming were removed in full; the pins below
 * keep them removed. The films themselves are pinned with the rest
 * of the CardFilm governance in card-film.test.ts.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(here, name), "utf8");

const css = read("home-v5.css");
const lazy = read("lazy-home-image.tsx");
const film = read("card-film.tsx");
const gameApp = read("game-app.tsx");

const fadeRule = css.slice(
  css.indexOf(".hv5-card-film::after {"),
  css.indexOf(".hv5-card-film-toggle {"),
);

describe("film fade — one overlay on the shared wrapper covers every state", () => {
  it("the fade is a ::after on .hv5-card-film, the wrapper every state renders", () => {
    assert.ok(css.includes(".hv5-card-film::after {"), "fade rule exists on the shared wrapper");
    // CardFilm renders this wrapper class in both branches: the gated
    // still branch and the film branch (poster or video inside).
    assert.equal(
      (film.match(/boxClass/g) || []).length >= 3,
      true,
      "both CardFilm branches share the wrapper class",
    );
    assert.ok(film.includes("media.stillUrl"), "gated branch renders the still in the wrapper");
    assert.ok(film.includes("media.posterUrl"), "pre-mount branch renders the poster in the wrapper");
  });

  it("the gradient runs from clear to solid card colour at the bottom edge", () => {
    assert.ok(fadeRule.includes("linear-gradient("), "gradient fill");
    assert.ok(fadeRule.includes("to bottom"), "fades at the bottom of the picture");
    assert.ok(fadeRule.includes("rgba(253, 251, 243, 0) 64%"), "clear until 64% of the box");
    assert.ok(fadeRule.includes("#fdfbf3 100%"), "solid card colour at the bottom edge");
    assert.ok(
      css.includes("--hv5-card: #fdfbf3"),
      "the solid stop is the card colour token's value, so picture and text area meet in one colour",
    );
  });

  it("the overlay can never be tapped and never grows the box", () => {
    assert.ok(fadeRule.includes("pointer-events: none"), "overlay takes no taps");
    assert.ok(fadeRule.includes("position: absolute"), "overlay is positioned inside the box");
    assert.ok(fadeRule.includes("inset: 0"), "overlay fills the existing box, adding no size");
    assert.ok(!fadeRule.includes("height:"), "overlay sets no height of its own");
  });

  it("the pause/play toggle is never faded: top corner, above the overlay", () => {
    assert.ok(fadeRule.includes("z-index: 1"), "overlay sits at z-index 1");
    const toggleRule = css.slice(css.indexOf(".hv5-card-film-toggle {"));
    assert.ok(toggleRule.includes("z-index: 2"), "toggle rides above the overlay");
    assert.ok(toggleRule.includes("top: 8px"), "toggle sits in the top corner, outside the bottom fade zone");
    assert.ok(toggleRule.includes("width: 44px") && toggleRule.includes("height: 44px"),
      "toggle keeps the 44px tap-target floor");
  });

  it("the .hv5-pic box geometry the tour measures is untouched", () => {
    assert.ok(css.includes(".hv5-stack .hv5-pic"), "stack pic rule still present");
    assert.ok(css.includes("aspect-ratio: 16 / 9"), "16/9 pic box unchanged");
    const stackRule = css.slice(
      css.indexOf(".hv5-stack .hv5-pic {"),
      css.indexOf(".hv5-stretch::after"),
    );
    assert.ok(!stackRule.includes("hv5-card-film"), "the fade adds no rule to the box itself");
  });
});

describe("CSS art passes — removed in full (owner ruling, 2026-11-03)", () => {
  it("no hv5-art-live arming survives in the CSS or in LazyHomeImage", () => {
    assert.ok(!css.includes("hv5-art-live"), "live class gone from the CSS");
    assert.ok(!lazy.includes("hv5-art-live"), "live class gone from LazyHomeImage");
    assert.ok(!lazy.includes("artLive"), "arming flag gone from LazyHomeImage");
    assert.ok(!lazy.includes("artStaticGateAtMount"), "art gate copy gone from LazyHomeImage");
  });

  it("the three keyframe passes are gone", () => {
    for (const name of ["hv5-art-drift", "hv5-art-sway", "hv5-art-float"]) {
      assert.ok(!css.includes(name), `keyframe pass removed: ${name}`);
    }
    assert.ok(!css.includes("smooth art motion"), "art-motion CSS section gone");
  });

  it("LazyHomeImage is back to one job: the loading orb", () => {
    assert.ok(!lazy.includes("usePrefersReducedMotion"), "no motion hook in the lazy wrapper");
    assert.ok(!lazy.includes("IntersectionObserver"), "no near-viewport observer in the lazy wrapper");
    assert.ok(lazy.includes("hv5-lazy-orb"), "the orb behaviour itself is untouched");
  });

  it("the Part 1 fade is untouched by the removal", () => {
    assert.ok(css.includes(".hv5-card-film::after {"), "fade rule still present");
    assert.ok(fadeRule.includes("#fdfbf3 100%"), "fade stops unchanged");
  });
});
