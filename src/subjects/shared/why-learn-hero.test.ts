/**
 * Why Learn montage hero + drift (feat/why-learn-montage) — the
 * hero slot of the "Why Do We Learn This?" picker carries the
 * blended montage film; the page background gains a slow formula
 * drift. Same source-pinning style as card-film.test.ts (this
 * repo has no React-render harness): the component and CSS are
 * read and pinned; the visual behaviour is covered by the E2E
 * spec (why-learn-page.desktop.spec.ts) against the built app.
 *
 * Brief pins (2026-11-13): the film replaces ONLY the hero strip;
 * autoplay muted + loop + playsInline; controls are pause,
 * replay, and a sound toggle; prefers-reduced-motion shows the
 * poster frame as a still and no film is fetched; the song's
 * words are audio only — no lyric text may render on the page;
 * the drift is texture (aria-hidden, pointer-events: none,
 * ~10% opacity, still under reduced motion); the subject cards
 * are untouched.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(path, "utf8");

const hero = read(join(here, "WhyLearnHero.tsx"));
const drift = read(join(here, "WhyLearnDrift.tsx"));
const picker = read(join(here, "SubjectPicker.tsx"));
const art = read(join(here, "../../assets/why-learn/why-learn-art.ts"));
const css = read(join(here, "../../styles.css"));
const publicDir = join(here, "../../../public");

describe("WhyLearnHero — the montage in the hero slot", () => {
  it("picker renders the hero component in the ScreenShell hero slot, and the drift behind the content", () => {
    assert.ok(picker.includes("hero={<WhyLearnHero />}"), "hero slot carries WhyLearnHero");
    assert.ok(picker.includes("<WhyLearnDrift />"), "picker renders the drift layer");
    assert.ok(!picker.includes("WHY_LEARN_HERO_URL"), "the old hero still is no longer rendered");
  });

  it("video: autoplay, muted, loop, playsInline, poster, and the montage as its source", () => {
    assert.ok(hero.includes("autoPlay"), "autoplay");
    assert.ok(hero.includes("muted"), "starts muted (audible autoplay is blocked; the song waits for the toggle)");
    assert.ok(hero.includes("loop"), "loops");
    assert.ok(hero.includes("playsInline"), "plays inline on phones");
    assert.ok(hero.includes("poster={posterUrl}"), "poster fills the slot before the film can play");
    assert.ok(hero.includes("WHY_LEARN_MONTAGE_PATH"), "source comes from the art module's swap point");
    assert.ok(art.includes('WHY_LEARN_MONTAGE_PATH = "videos/why-learn-montage.mp4"'), "film lives in public/videos/");
    assert.ok(art.includes('WHY_LEARN_MONTAGE_POSTER_PATH = "videos/why-learn-montage-poster.webp"'), "poster beside it");
  });

  it("media URLs are built through the assetBase seam, never bundled imports", () => {
    assert.ok(hero.includes("assetBase()"), "assetBase seam (same as the journal manifest)");
    assert.ok(!hero.includes(".mp4\""), "no hard-coded file path in the component");
  });

  it("controls: pause/play, replay, and a sound toggle that flips the muted property", () => {
    assert.ok(hero.includes('aria-label={playing ? "Pause montage" : "Play montage"}'), "pause/play with a spoken label");
    assert.ok(hero.includes('aria-label="Replay montage"'), "replay with a spoken label");
    assert.ok(hero.includes("film.currentTime = 0"), "replay restarts the film");
    assert.ok(hero.includes('aria-pressed={soundOn}'), "sound toggle exposes its state");
    assert.ok(hero.includes("film.muted = !soundOn"), "the toggle drives the element's muted property");
    assert.ok(hero.includes('data-testid="why-learn-hero-video"'), "video testid for the E2E spec");
    for (const id of ["why-learn-hero-playpause", "why-learn-hero-replay", "why-learn-hero-sound"]) {
      assert.ok(hero.includes(`data-testid="${id}"`), `control testid ${id}`);
    }
  });

  it("the film itself is decoration: aria-hidden and never focusable", () => {
    assert.ok(hero.includes('aria-hidden="true"'), "video aria-hidden");
    assert.ok(hero.includes("tabIndex={-1}"), "video out of the Tab order");
  });

  it("reduced motion and load failure land on the poster still — no video element, no controls", () => {
    assert.ok(hero.includes("usePrefersReducedMotion()"), "reduced motion via the shared hook");
    assert.ok(
      hero.includes("if (reducedMotion || failed)"),
      "one gated branch for reduced motion and failure",
    );
    const gated = hero.slice(hero.indexOf("if (reducedMotion || failed)"), hero.indexOf("const togglePlay"));
    assert.ok(gated.includes('className="why-learn-hero"'), "the still keeps the hero box");
    assert.ok(gated.includes("alt={WHY_LEARN_MONTAGE_ALT}"), "the still carries alt text");
    assert.ok(!gated.includes("<video"), "no video element in the gated branch (the .mp4 is never fetched)");
    assert.ok(!gated.includes("why-learn-hero-controls"), "no controls with nothing to control");
    assert.ok(hero.includes("onError={() => setFailed(true)}"), "a failed film latches to the still");
  });

  it("the shipped media files exist under public/videos/", () => {
    const film = join(publicDir, "videos/why-learn-montage.mp4");
    const poster = join(publicDir, "videos/why-learn-montage-poster.webp");
    assert.ok(existsSync(film), "montage film present");
    assert.ok(existsSync(poster), "montage poster present");
    assert.ok(statSync(film).size > 1_000_000, "film is the real asset, not a stub");
    assert.ok(statSync(poster).size > 10_000, "poster is a real picture");
  });
});

describe("WhyLearnDrift — background texture only", () => {
  it("is aria-hidden and carries the card's own formulas and diagrams", () => {
    assert.ok(drift.includes('aria-hidden="true"'), "never announced");
    for (const bit of ["a² + b² = c²", "F = ma", "g = 9.8 m/s²", "πr²"]) {
      assert.ok(drift.includes(bit), `formula ${bit}`);
    }
    assert.ok(drift.includes("<svg"), "triangle and orbit diagrams are inline SVG");
  });

  it("CSS: the layer takes no clicks, sits at a tenth opacity, and the content rides above it", () => {
    const block = css.slice(css.indexOf(".why-learn-drift {"), css.indexOf(".wl-drift-item {"));
    assert.ok(block.includes("pointer-events: none"), "clicks pass through");
    assert.ok(block.includes("opacity: 0.1"), "~10% opacity");
    assert.ok(block.includes("position: absolute"), "out of flow — no layout shift");
    assert.ok(css.includes(".why-learn-screen > header,"), "content lifted above the layer");
    assert.ok(css.includes("@keyframes wl-drift"), "the slow drift keyframes");
  });

  it("CSS: still under reduced motion, gone under the plain-surface palettes", () => {
    const rm = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)", css.indexOf("wl-drift")));
    assert.ok(rm.includes(".wl-drift-item"), "reduced-motion rule names the drift items");
    assert.ok(rm.includes("animation: none"), "drift animation off under reduced motion");
    assert.ok(
      css.includes(':root[data-palette="high-contrast"] .why-learn-drift'),
      "drift hidden in the high-contrast palette, like the page's other art",
    );
  });
});

describe("No lyric text ships on the page", () => {
  // The song is audio only (brief: heard, not read). These are the
  // recording script's distinctive phrases; none may appear in the
  // picker, the hero, the drift, or the art module. (The cards'
  // one-liners — "Why bread rises and iron rusts" — are card copy,
  // not lyrics, and are not in this list.)
  const lyricPhrases = [
    "Count it, measure it",
    "Roll it, push it",
    "drops the apple",
    "chart each star",
    "name the place",
    "grew up by rivers",
    "That's why we learn this",
  ];
  it("no lyric phrase appears in any shipped picker source", () => {
    for (const [name, source] of [
      ["SubjectPicker.tsx", picker],
      ["WhyLearnHero.tsx", hero],
      ["WhyLearnDrift.tsx", drift],
      ["why-learn-art.ts", art],
    ] as const) {
      for (const phrase of lyricPhrases) {
        assert.ok(!source.includes(phrase), `${name} must not contain lyric text: ${phrase}`);
      }
    }
  });
});
