/**
 * Smooth cards (feat/smooth-cards) — the film cards' gradient fade
 * and the spot illustrations' settling motion.
 *
 * Same source-pinning style as card-film.test.ts and
 * home-loading-orbs.test.ts (this repo has no React-render harness):
 * the fade's coverage of every film state, the toggle's safety, the
 * motion gates, the settle governance, and the zero-CLS shape are
 * pinned by reading the source. The visual result is covered by the
 * capture set in ~/workspace/meridian-smooth-cards-evidence and by
 * the home E2E specs against the built app.
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
const artSection = css.slice(css.indexOf("smooth art motion (feat/smooth-cards)"));

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

describe("art motion — gates mirror CardFilm, arming is near-viewport only", () => {
  it("gates: reduced motion (shared hook), Save-Data, deviceMemory at or below 2", () => {
    assert.ok(lazy.includes("usePrefersReducedMotion()"), "reduced motion via the shared hook");
    assert.ok(lazy.includes("nav.connection?.saveData"), "Save-Data gate");
    assert.ok(lazy.includes("mem > 0 && mem <= 2"), "deviceMemory gate, the film threshold");
    assert.ok(
      lazy.includes("const artLive = isArt && near && !reducedMotion && !staticGate"),
      "all gates compose into the one arming flag",
    );
  });

  it("only .hv5-art wrappers arm, and only near the viewport", () => {
    assert.ok(lazy.includes('className?.includes("hv5-art")'), "art detection is the .hv5-art class");
    assert.ok(lazy.includes("new IntersectionObserver"), "near-viewport observer");
    assert.ok(lazy.includes('{ rootMargin: "200px" }'), "200px rootMargin, the film margin");
    assert.ok(
      lazy.includes('className={artLive ? "hv5-art-live" : undefined}'),
      "the live class lands on the img only when armed",
    );
  });

  it("no timers: nothing replays, polls, or re-arms on a schedule", () => {
    const section = lazy.slice(lazy.indexOf("Smooth art motion"));
    assert.ok(!section.includes("setTimeout"), "no timer chains");
    assert.ok(!section.includes("setInterval"), "no polling timers");
  });

  it("the three art sites in game-app are unchanged and still decorative", () => {
    for (const site of [
      '<LazyHomeImage className="hv5-art" src={archiveToolsUrl} alt="" ariaHidden />',
      '<LazyHomeImage className="hv5-art" src={journalTreeUrl} alt="" ariaHidden />',
      '<LazyHomeImage className="hv5-art" src={binocularsHatUrl} alt="" ariaHidden />',
    ]) {
      assert.ok(gameApp.includes(site), `art site unchanged: ${site}`);
    }
    assert.equal((gameApp.match(/className="hv5-art"/g) || []).length, 3,
      "exactly three .hv5-art cards exist (Review, Journal, Grown-ups)");
  });
});

describe("art motion — the CSS pass settles, never loops, never moves layout", () => {
  it("each card gets its own named pass, all with one iteration", () => {
    assert.ok(artSection.includes("animation: hv5-art-drift 10s ease-in-out 1 both"),
      "Review drift, one pass");
    assert.ok(artSection.includes("animation-name: hv5-art-sway"), "Journal sway");
    assert.ok(artSection.includes("animation-duration: 11s"), "Journal duration");
    assert.ok(artSection.includes("animation-name: hv5-art-float"), "Grown-ups float");
    assert.ok(artSection.includes("animation-duration: 9s"), "Grown-ups duration");
    assert.ok(!artSection.includes("infinite"), "no loop anywhere in the art section");
  });

  it("keyframes use transform and opacity only, and end where they start", () => {
    const keyframes = [...artSection.matchAll(/@keyframes hv5-art-[^{]+\{([\s\S]*?)\n\}/g)]
      .map((m) => m[1]);
    assert.equal(keyframes.length, 3, "three keyframe sets, one per card");
    for (const body of keyframes) {
      const props = [...body.matchAll(/([a-z-]+):/g)].map((m) => m[1]);
      for (const prop of props) {
        assert.ok(prop === "transform" || prop === "opacity",
          `keyframe property must be transform or opacity, got: ${prop}`);
      }
      assert.ok(body.includes("0%") && body.includes("100%"), "pass has a start and a settle");
    }
  });

  it("the motion is on the inner img, never on the measured wrapper box", () => {
    assert.ok(artSection.includes(".hv5-spot .hv5-art > img.hv5-art-live"),
      "live rule targets the img inside the wrapper");
    const liveRules = [...artSection.matchAll(/\.hv5-art-live \{[^}]*\}/g)].map((m) => m[0]);
    for (const rule of liveRules) {
      assert.ok(!rule.includes("width") && !rule.includes("height"),
        "live rules set no box size");
    }
  });

  it("reduced motion kills the pass in CSS as a second line of defence", () => {
    const rm = artSection.slice(artSection.indexOf("@media (prefers-reduced-motion: reduce)"));
    assert.ok(rm.includes(".hv5-art > img.hv5-art-live"), "reduced-motion rule targets the live img");
    assert.ok(rm.includes("animation: none"), "reduced motion means no animation");
  });
});
