/**
 * Smooth cards (feat/smooth-cards) — the film cards' fade, plus
 * the removal record for the spot illustrations' CSS motion.
 *
 * Same source-pinning style as card-film.test.ts and
 * home-loading-orbs.test.ts (this repo has no React-render harness):
 * the fade's coverage of every film state and the geometry pins
 * are pinned by reading the source. The visual result is covered
 * by the capture set in ~/workspace/meridian-smooth-cards-evidence
 * and by the home E2E specs against the built app.
 *
 * Fade history: the first build painted a cream ramp over the
 * scene (clear at 64% of the box, solid card colour at 100%).
 * The owner rejected it on 2026-11-03 as too harsh on the eyes,
 * and the three softer variants captured for his pick still read
 * too heavy, so he asked for the gradient reduced even further.
 * The rework shipped a mask feather (84% to 100%) plus a thin
 * painted landing strip on the wrapper's ::after. The owner
 * then ruled on 2026-11-03 (10:25 CST, verbatim): "use gradient
 * that belends into the bacground of the page, and it should be
 * very small not too big since its covering up the actual txt
 * and animation cartoon". The shipped fade is now a pure mask
 * feather on the media over the box's last 7% (93% to 100%)
 * with zero pigment painted anywhere; the strip is deleted and
 * pinned below by absence pins, like the 64% ramp before it, so
 * either fails this suite if it returns.
 *
 * Part 2 history: the Review, Journal, and Grown-ups illustrations
 * first got CSS settling passes (hv5-art-drift / hv5-art-sway /
 * hv5-art-float, armed by LazyHomeImage with an hv5-art-live
 * class). The owner rejected that class of motion on 2026-11-03
 * and ruled the three cards get animated cartoon films instead,
 * through the one CardFilm system. The CSS passes, their keyframes,
 * and the LazyHomeImage arming were removed in full; the pins below
 * keep them removed. The films themselves are pinned with the rest
 * of the CardFilm governance in card-film.test.ts. The rework then
 * made the three art slots full-bleed banners (WP3) and removed
 * the film toggle (WP2, owner's autoloop order); the banner pins
 * and toggle absence pins below record both.
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

const maskRuleStart = css.indexOf(".home-v5 .hv5-card-film.hv5-pic > img,");
const maskRule = css.slice(
  maskRuleStart,
  css.indexOf("}", maskRuleStart) + 1,
);

describe("film fade — mask feather on the media covers every state", () => {
  it("the feather is a mask on the .hv5-pic media elements themselves", () => {
    assert.ok(
      css.includes(".home-v5 .hv5-card-film.hv5-pic > img,"),
      "mask rule covers the img states (poster, still)",
    );
    assert.ok(
      css.includes(".home-v5 .hv5-card-film.hv5-pic > video"),
      "mask rule covers the video state (film)",
    );
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

  it("the mask holds full opacity to 93% and feathers out by 100%", () => {
    // Owner, 2026-11-03 10:25 CST: the gradient "should be very
    // small not too big" — a melt zone of about 7% of the box
    // (~23px on the 332px desktop box), down from the rework's
    // 84%-to-100% feather.
    assert.ok(maskRule.includes("-webkit-mask-image: linear-gradient("), "webkit mask gradient");
    assert.ok(maskRule.includes("mask-image: linear-gradient("), "standard mask gradient");
    assert.ok(maskRule.includes("#000 93%"), "scene at full opacity until 93% of the box");
    assert.ok(maskRule.includes("transparent 100%"), "fully feathered at the bottom edge");
    assert.ok(!maskRule.includes("#000 84%"), "the rework's wider 84% feather is gone");
    assert.ok(!maskRule.includes("rgba(0, 0, 0, 0.55)"), "no mid stop: the melt is one clean ramp");
  });

  it("the painted landing strip is deleted entirely (owner ruling, 2026-11-03 10:25 CST)", () => {
    // The rework's ::after strip painted card colour over the
    // scene's last rows. The owner's ruling deletes it: the melt
    // is a pure alpha feather with zero pigment, so the picture
    // dissolves into the card ground it actually sits on and no
    // cloud can form. Removal pins, like the art-slot ones: the
    // strip fails this suite if it returns.
    assert.ok(!css.includes(".home-v5 .hv5-card-film::after {"), "no ::after rule on the shared wrapper");
    assert.ok(!css.includes("rgba(253, 251, 243, 0) 94%"), "strip's clear stop gone");
    assert.ok(!css.includes("rgba(253, 251, 243, 0.5) 97.5%"), "strip's half-colour stop gone");
    assert.ok(!css.includes("#fdfbf3 100%"), "strip's solid card-colour stop gone");
    assert.ok(
      css.includes(".home-v5 .hv5-card-film.hv5-art::after {"),
      "the art slots' content: none guard on the wrapper ::after stays",
    );
  });

  it("the rejected cream ramp is gone and fails here if it returns", () => {
    // Owner rejection, 2026-11-03: the 36% cream ramp (clear at
    // 64%) was too harsh on the eyes, and the softer captures
    // were still too heavy. Neither the ramp stops nor the solid
    // band may come back.
    assert.ok(!css.includes("rgba(253, 251, 243, 0.45)"), "old 82% ramp stop gone");
    assert.ok(!css.includes("rgba(253, 251, 243, 0.88)"), "old 93% ramp stop gone");
    assert.ok(!maskRule.includes("253, 251, 243"), "the mask paints no cream over the scene");
  });

  it("the feather is a mask only: it can never be tapped and never grows the box", () => {
    assert.ok(!maskRule.includes("height:"), "the mask rule sets no height of its own");
    assert.ok(!maskRule.includes("width:"), "the mask rule sets no width of its own");
    assert.ok(!maskRule.includes("position:"), "the mask rule positions nothing");
  });

  it("no toggle survives for the fade to clear (owner autoloop order, 2026-11-03)", () => {
    // The old pin kept the pause/play toggle above the fade. The
    // toggle itself is deleted now, so the pin is an absence pin.
    assert.ok(!css.includes(".hv5-card-film-toggle"), "toggle rule deleted from the CSS");
    assert.ok(!css.includes(".hv5-film-icon"), "toggle icon rules deleted from the CSS");
    assert.ok(!film.includes("<button"), "CardFilm renders no button");
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
    assert.ok(css.includes(".hv5-card-film.hv5-pic > img,"), "fade mask rule still present");
    assert.ok(maskRule.includes("#000 93%"), "fade stops unchanged (93% feather, strip deleted)");
  });
});

describe("art films — the three spot cards joined the CardFilm system", () => {
  it("all three .hv5-art slots render CardFilm, none renders LazyHomeImage", () => {
    for (const site of [
      '<CardFilm className="hv5-art" media={reviewMediaForBand(ageBand)} testId="card-film-review" />',
      '<CardFilm className="hv5-art" media={JOURNAL_FILM} testId="card-film-journal" />',
      '<CardFilm className="hv5-art" media={GROWNUPS_FILM} testId="card-film-grownups" />',
    ]) {
      assert.ok(gameApp.includes(site), `art film site: ${site}`);
    }
    assert.equal((gameApp.match(/<CardFilm/g) || []).length, 5,
      "five film slots total — one motion system for every illustrated card");
  });

  it("the art stills are the original illustrations, imported by card-media only", () => {
    assert.ok(!gameApp.includes("archiveToolsUrl"), "game-app no longer imports the Review still directly");
    assert.ok(!gameApp.includes("journalTreeUrl"), "game-app no longer imports the Journal still directly");
    assert.ok(!gameApp.includes("binocularsHatUrl"), "game-app no longer imports the Grown-ups still directly");
  });

  it("the art slots are full-bleed banners at the top of the card (rework WP3)", () => {
    const artBlock = css.slice(css.indexOf("art films (feat/smooth-cards"));
    const banner = artBlock.slice(artBlock.indexOf(".hv5-card-film.hv5-art {"));
    assert.ok(banner.includes("position: relative"), "banner sits in flow at the card top");
    assert.ok(banner.includes("width: calc(100% + 56px)"), "banner width = card width");
    assert.ok(banner.includes("max-width: none"), "no width cap from the corner-slot rules");
    assert.ok(banner.includes("margin: -26px -28px 18px"), "banner cancels the card padding");
    assert.ok(banner.includes("right: auto") && banner.includes("bottom: auto"),
      "corner-slot offsets cleared");
    assert.ok(banner.includes("border-radius: 0"), "no corner rounding (Journal's 50% circle is gone)");
    assert.ok(banner.includes("-webkit-mask-image: none") && banner.includes("mask-image: none"),
      "radial corner mask removed — the banner edge is its crop");
    assert.ok(artBlock.includes(".home-v5 .hv5-spot .hv5-txt { max-width: 100%; }") ||
      (artBlock.includes(".home-v5 .hv5-spot .hv5-txt") && artBlock.includes("max-width: 100%")),
      "spot text column returns to full width");
  });

  it("the spot text column's height: 100% is neutralized in the art-film block (aspect cure)", () => {
    // Cure, PR #324 rework: the base .hv5-spot .hv5-txt rule sets
    // height: 100%, written for the old corner layout where the
    // art was absolutely positioned. Inside the flex-column card
    // the in-flow banner plus a 100%-tall text column overflow
    // the card, and flex shrink took the overflow out of the
    // banner, cropping the films (measured at 1280px: Review
    // 386x185.56, Journal and Grown-ups 386x241.34, against the
    // native 386x259.6 / 386x386 / 386x386). The cure lives in
    // the appended art-film block, with the layout it serves.
    const artBlock = css.slice(css.indexOf("art films (feat/smooth-cards"));
    assert.ok(artBlock.includes(".home-v5 .hv5-spot .hv5-txt"), "spot text rule present in the art block");
    assert.ok(artBlock.includes("height: auto"), "height: 100% neutralized where the banner layout lives");
    const baseTxt = css.slice(
      css.indexOf(".home-v5 .hv5-spot .hv5-txt {"),
      css.indexOf(".home-v5 .hv5-journal .hv5-art {"),
    );
    assert.ok(baseTxt.includes("height: 100%"),
      "the base rule itself is untouched — the cure is the art block's override, not a base edit");
  });

  it("the banner wrapper stays decorative: pointer-events none survives on the base rule", () => {
    const spotArt = css.slice(
      css.indexOf(".home-v5 .hv5-spot .hv5-art {"),
      css.indexOf(".home-v5 .hv5-spot .hv5-txt {"),
    );
    assert.ok(spotArt.includes("pointer-events: none"), "base art rule keeps the wrapper click-through");
    const artBlock = css.slice(css.indexOf("art films (feat/smooth-cards"));
    assert.ok(!artBlock.includes("pointer-events: auto"), "no control takes pointer events back");
    assert.ok(!artBlock.includes("z-index: 3"), "the toggle's layer lift is deleted");
  });
});
