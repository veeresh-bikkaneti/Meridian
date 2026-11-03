/**
 * Card films (feat/home-card-films) — the two home game cards'
 * .hv5-pic slots as governed films behind one shared component.
 *
 * Same source-pinning style as home-loading-orbs.test.ts (this
 * repo has no React-render harness): the gates, the lazy mount,
 * the once-only playback, and the WCAG 2.2.2 toggle are pinned by
 * reading the component; the byte caps are pinned against the
 * real asset files; the visual behaviour is covered by the E2E
 * specs (card-redesign + loading-orbs updates) against the built
 * app.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(here, name), "utf8");

const film = read("card-film.tsx");
const css = read("home-v5.css");
const gameApp = read("game-app.tsx");
const media = readFileSync(join(here, "../assets/home-v5/card-media.ts"), "utf8");
const assetBytes = (name: string) =>
  statSync(join(here, "../assets/home-v5", name)).size;

describe("CardFilm — gates land on the still, video never fetched", () => {
  it("gates: reduced motion (shared hook), Save-Data, deviceMemory <= 2, video error", () => {
    assert.ok(film.includes("usePrefersReducedMotion()"), "reduced motion via the shared hook");
    assert.ok(film.includes("nav.connection?.saveData"), "Save-Data gate");
    assert.ok(
      film.includes("mem > 0 && mem <= 2"),
      "deviceMemory <= 2 gate (globe's threshold)",
    );
    assert.ok(film.includes('onError={() => setFailed(true)}'), "video error falls back");
    assert.ok(
      film.includes("const gated = reducedMotion || staticGate || failed"),
      "all gates compose into the one still branch",
    );
  });

  it("the gated branch renders the still and contains no video element", () => {
    const gateBranch = film.slice(film.indexOf("if (gated) {"), film.indexOf("rootRef} className"));
    assert.ok(gateBranch.includes("media.stillUrl"), "gated branch renders the still");
    assert.ok(!gateBranch.includes("<video"), "gated branch must not mount a video (no fetch)");
    assert.ok(
      film.indexOf("if (gated) {") < film.indexOf("<video"),
      "the still branch returns before any video JSX",
    );
  });
});

describe("CardFilm — lazy mount + play once + settle", () => {
  it("video mounts only near the viewport (IntersectionObserver, 200px, the globe's pattern)", () => {
    assert.ok(film.includes("new IntersectionObserver"), "observer gate");
    assert.ok(film.includes('{ rootMargin: "200px" }'), "200px rootMargin");
    assert.ok(
      film.includes("near ? (\n        <video") || film.includes("{near ? ("),
      "video element is conditional on near",
    );
    assert.ok(film.includes('preload="none"'), "no eager fetch");
    assert.ok(film.includes("media.posterUrl"), "poster fills the slot before the film");
  });

  it("plays once: autoPlay + muted + playsInline, and NO loop anywhere", () => {
    assert.ok(film.includes("autoPlay"), "plays when mounted");
    assert.ok(film.includes("muted"), "muted (autoplay policy + silent by design)");
    assert.ok(film.includes("playsInline"), "inline on phones");
    const videoTag = film.slice(film.indexOf("<video"), film.indexOf("<video") + 700);
    assert.ok(!videoTag.includes("loop"), "no loop attribute — it plays once and holds the last frame");
    assert.ok(film.includes("onEnded"), "the end is handled (label returns to Play)");
  });

  it("no timers: nothing auto-replays, pauses on a schedule, or polls", () => {
    assert.ok(!film.includes("setTimeout"), "no timer chains");
    assert.ok(!film.includes("setInterval"), "no polling timers");
  });
});

describe("CardFilm — WCAG 2.2.2 stop (the toggle)", () => {
  it("labels are the #295 wording, driven by the video's own events", () => {
    assert.ok(film.includes('"Play the cartoon"') && film.includes('"Pause the cartoon"'));
    assert.ok(film.includes("onPlay={() => setPaused(false)}"), "play event drives the label");
    assert.ok(film.includes("onPause={() => setPaused(true)}"), "pause event drives the label");
    assert.ok(film.includes("aria-pressed={paused}"), "toggle state is exposed");
  });

  it("after the film ends, the toggle replays it — by gesture only", () => {
    assert.ok(film.includes("if (film.ended) film.currentTime = 0"), "replay rewinds first");
    assert.ok(film.includes("film.play().catch(() => {})"), "rejected play() never surfaces");
  });

  it("the film itself is decoration; the toggle is 44x44 in the CSS", () => {
    const videoTag = film.slice(film.indexOf("<video"), film.indexOf("<video") + 700);
    assert.ok(videoTag.includes('aria-hidden="true"'), "video is aria-hidden");
    assert.ok(videoTag.includes("tabIndex={-1}"), "video is never focusable");
    const toggleRule = css.slice(css.indexOf(".hv5-card-film-toggle {"));
    assert.ok(toggleRule.includes("width: 44px") && toggleRule.includes("height: 44px"),
      "toggle keeps the 44px tap-target floor");
    assert.ok(toggleRule.includes("z-index: 2"), "toggle rides above the stretched CTA");
  });
});

describe("CardFilm — zero CLS: media fills the existing .hv5-pic box", () => {
  it("fill rules exist and the .hv5-pic box geometry is untouched", () => {
    assert.ok(css.includes(".hv5-card-film > img,\n.home-v5 .hv5-card-film > video") ||
      css.includes(".hv5-card-film > video"), "media fill rule exists");
    assert.ok(css.includes("position: absolute"), "media is absolutely filled");
    // The box itself: stack rule still sets the 16/9 box the tour measures.
    assert.ok(css.includes(".hv5-stack .hv5-pic"), "stack pic rule still present");
    assert.ok(css.includes("aspect-ratio: 16 / 9"), "16/9 pic box unchanged");
  });
});

describe("home wiring — both cards, one component, nothing else moves", () => {
  it("both .hv5-pic slots render CardFilm with their card-media entries", () => {
    assert.ok(
      gameApp.includes('<CardFilm className="hv5-pic" media={GEODETECTIVE_FILM} testId="card-film-geodetective" />'),
      "GeoDetective slot",
    );
    assert.ok(
      gameApp.includes('<CardFilm className="hv5-pic" media={COLDTRAIL_FILM} testId="card-film-coldtrail" />'),
      "Cold Trail slot",
    );
    assert.equal((gameApp.match(/<CardFilm/g) || []).length, 2, "exactly two film slots");
  });

  it("the locked band still renders LockedLoop, byte-identical branch", () => {
    assert.ok(
      gameApp.includes('isLoopLocked(ageBand, "geodetective")'),
      "lock check untouched",
    );
    assert.ok(
      gameApp.includes('<LockedLoop title="GeoDetective" onGrownUpOpen={onGrownUpOpen} />'),
      "locked variant untouched",
    );
  });

  it("card copy locks are byte-exact (eyebrows + CTAs)", () => {
    for (const locked of [
      "Case file · Unlimited",
      "Case file · Triangulation",
      "Solve a mystery",
      "Start the trail",
      "A smuggler moves between cities. Three sightings, three rings — tap where",
    ]) {
      assert.ok(gameApp.includes(locked), `copy lock missing: ${locked}`);
    }
  });

  it("the old stills are gone from the home wiring", () => {
    assert.ok(!gameApp.includes("desertRuinsUrl"), "desert-ruins import removed");
    assert.ok(!gameApp.includes("patagoniaUrl"), "patagonia import removed");
  });
});

describe("card-media — the swap point", () => {
  it("exports one entry per card, each with video + poster + still", () => {
    assert.ok(media.includes("export const GEODETECTIVE_FILM"), "GeoDetective entry");
    assert.ok(media.includes("export const COLDTRAIL_FILM"), "Cold Trail entry");
    for (const field of ["videoUrl", "posterUrl", "stillUrl"]) {
      assert.ok(media.includes(field), `field ${field}`);
    }
  });

  it("poster and still are different files per card (documented distinction)", () => {
    assert.ok(media.includes('from "./geodetective-poster.webp"'));
    assert.ok(media.includes('from "./geodetective-still.webp"'));
    assert.ok(media.includes('from "./coldtrail-poster.webp"'));
    assert.ok(media.includes('from "./coldtrail-still.webp"'));
    assert.ok(
      media.includes("Poster vs still"),
      "the distinction is documented in the module header",
    );
  });
});

describe("card-media — byte caps (measured on the real files)", () => {
  it("each film is <= ~400 KB (the verdict league)", () => {
    assert.ok(assetBytes("geodetective-film.mp4") <= 400_000,
      `geodetective film: ${assetBytes("geodetective-film.mp4")}`);
    assert.ok(assetBytes("coldtrail-film.mp4") <= 400_000,
      `coldtrail film: ${assetBytes("coldtrail-film.mp4")}`);
  });

  it("posters and stills are in the verdict league (~65-135 KB)", () => {
    for (const name of [
      "geodetective-poster.webp",
      "geodetective-still.webp",
      "coldtrail-poster.webp",
      "coldtrail-still.webp",
    ]) {
      const bytes = assetBytes(name);
      assert.ok(bytes >= 30_000 && bytes <= 140_000, `${name}: ${bytes}`);
    }
  });
});
