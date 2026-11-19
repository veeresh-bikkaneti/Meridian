/**
 * Living Atlas (feat/why-learn-living-atlas) — the Why Learn picker's
 * world and card pictures. Same source-pinning style as
 * why-learn-hero.test.ts and card-film.test.ts (this repo has no
 * React-render harness for these screens): the components, the media
 * module and the CSS are read and pinned; the visual behaviour is
 * covered by the E2E specs (why-learn-page.desktop.spec.ts) against
 * the built app.
 *
 * Pins: the page world is the home hero's mountain painting with its
 * own overlay system (trail march 3 s, clouds 28 s / 40 s, flag
 * 2.2 s, trekker on the 18 s SMIL clock, still gates mirrored);
 * five cards carry real film assets through the shared CardFilm and
 * the subject-card media module; general knowledge has NO film —
 * its pristine globe still takes overlay motion instead (clouds,
 * the Iberia → North-America route, the 450 ms pin drop + one
 * 600 ms ring); the spotlight walks ready cards on a 4 s clock; the
 * case screens carry the same system by scope class only; and the
 * fill-the-page rule from feat/picker-cards-fill-page survives.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(path, "utf8");

const picker = read(join(here, "SubjectPicker.tsx"));
const world = read(join(here, "WhyLearnWorld.tsx"));
const gk = read(join(here, "GkGlobeOverlay.tsx"));
const subjectCase = read(join(here, "SubjectCase.tsx"));
const media = read(join(here, "../../assets/why-learn/subject-card-media.ts"));
const css = read(join(here, "../../styles.css"));
const assetsDir = join(here, "../../assets/why-learn");

describe("WhyLearnWorld — the mountain painting as the page world", () => {
  it("paints the home hero's own art file, imported, never copied", () => {
    assert.ok(world.includes('from "@/assets/home-v5/hero-mountain.webp"'), "the repo's hero-mountain.webp");
    assert.ok(world.includes('className="wl-world"'), "the band wrapper");
    assert.ok(world.includes('aria-hidden="true"'), "decoration, never announced");
  });

  it("carries the home hero's overlay system at its own clocks", () => {
    assert.ok(world.includes("WorldTrailOverlay"), "the trail overlay");
    assert.ok(world.includes("WorldTrekkerOverlay"), "the trekker overlay");
    assert.ok(world.includes('dur="18s"'), "the trekker's 18 s SMIL master clock");
    assert.ok(world.includes("M322 528 C 305 500, 345 480, 350 460"), "the trail sliced to the painted switchbacks");
    assert.ok(world.includes("wl-trail-still"), "the JS still gate lands on an unmoving trail");
    assert.ok(css.includes("animation: wl-trailmarch 3s linear infinite"), "trail dots march 3 s");
    assert.ok(css.includes("animation: wl-clouddrift-a 28s ease-in-out infinite alternate"), "cloud bank A drifts on the 28 s clock");
    assert.ok(css.includes("animation: wl-clouddrift-b 40s ease-in-out infinite alternate"), "cloud bank B drifts on the 40 s clock");
    assert.ok(css.includes("animation: wl-flagwave 2.2s ease-in-out infinite alternate"), "summit flag waves 2.2 s");
  });

  it("the picker renders the world as its own section above the hero card (D1)", () => {
    assert.ok(picker.includes("<WhyLearnWorld />"), "world band rendered by the picker");
    const worldAt = picker.indexOf("<WhyLearnWorld />");
    const heroAt = picker.indexOf('<div className="screen-hero mode-card mt-4 overflow-hidden">');
    assert.ok(worldAt >= 0 && heroAt > worldAt, "the band section stands above the hero card in the flow");
    assert.equal(picker.split("<WhyLearnWorld />").length - 1, 1, "the band renders exactly once");
    assert.ok(css.includes(".wl-world {"), "band CSS present");
    assert.ok(css.includes(".subject-picker-screen .wl-world {"), "the picker-scoped in-flow band rule (D1)");
    assert.ok(css.includes("position: relative;"), "the band is in normal flow on the picker, not an absolute overlay");
    assert.ok(css.includes("mask-image: linear-gradient(to bottom, #000 78%, transparent)"), "the band feathers into the wash");
  });
});

describe("Subject card media — films for five cards, none for the globe", () => {
  it("the media module is the swap point, in the card-media.ts pattern", () => {
    assert.ok(media.includes("SUBJECT_CARD_MEDIA"), "film/poster/still record exported");
    assert.ok(media.includes("SUBJECT_CARD_STILLS"), "still record exported");
    for (const id of ["math", "physics", "chemistry", "social-studies", "journals"]) {
      assert.ok(media.includes(`${id}: {`) || media.includes(`"${id}": {`), `media entry for ${id}`);
    }
  });

  it("general knowledge has a still and no film — the map is never redrawn", () => {
    const mediaRecord = media.slice(media.indexOf("SUBJECT_CARD_MEDIA"), media.indexOf("SUBJECT_CARD_STILLS"));
    assert.ok(!mediaRecord.includes("general-knowledge"), "no film media for general knowledge");
    assert.ok(media.includes('"general-knowledge": globeStillUrl'), "its still is the home globe fallback");
    assert.ok(media.includes('from "../home-v5/globe-fallback.webp"'), "the repo's own map file, imported");
    assert.ok(media.includes('from "../home-v5/journal-tree.webp"'), "the journals still is the home journal art");
  });

  it("the shipped media files exist and are real assets, not stubs", () => {
    for (const name of ["math", "physics", "chemistry", "social-studies", "journals"]) {
      const film = join(assetsDir, `${name}-film.mp4`);
      assert.ok(existsSync(film), `${name} film present`);
      assert.ok(statSync(film).size > 50_000, `${name} film is a real encode`);
      assert.ok(statSync(join(assetsDir, `${name}-poster.webp`)).size > 5_000, `${name} poster is a real picture`);
    }
    for (const name of ["math", "physics", "chemistry", "social-studies"]) {
      assert.ok(statSync(join(assetsDir, `${name}-still.webp`)).size > 5_000, `${name} still is a real picture`);
    }
  });

  it("the picker plays the films through the shared CardFilm governance", () => {
    assert.ok(picker.includes('import { CardFilm } from "@/components/card-film"'), "the one shared card-film component");
    assert.ok(picker.includes("media={media}"), "media comes from the module, never named in the picker");
    assert.ok(picker.includes('testId={`subject-film-${row.id}`}'), "a stable test id per card film");
  });
});

describe("GkGlobeOverlay — overlay motion over the pristine still", () => {
  it("draws the Iberia → North-America route and drops the pin on the port", () => {
    assert.ok(gk.includes('d="M90 28 Q69 15 48.5 30.5"'), "the route arc in map image space");
    assert.ok(gk.includes("spotTurns"), "spotlight turns drive the re-drop");
    assert.ok(gk.includes("setTimeout(() => setDropKey(1), 1750)"), "the first drop lands after the page settles");
    assert.ok(css.includes("animation: wl-gk-pin-drop 450ms cubic-bezier(0.34, 1.56, 0.64, 1) both"), "pin drop 450 ms, home overshoot");
    assert.ok(css.includes("animation: wl-gk-pulse-ring 600ms ease-out 320ms both"), "exactly one 600 ms pulse ring");
    assert.ok(css.includes("animation: wl-gk-cloud-a 28s ease-in-out infinite alternate"), "cloud bank A on the 28 s clock");
    assert.ok(css.includes("animation: wl-gk-cloud-b 40s ease-in-out infinite alternate"), "cloud bank B on the 40 s clock");
    assert.ok(css.includes("animation: wl-gk-trailmarch 3s linear infinite"), "route dots march 3 s");
    assert.ok(
      css.includes(".why-learn-card.is-spot .wl-gk-cliprect"),
      "the route draw-in is keyed to the card's spotlight turn",
    );
    assert.ok(css.includes("animation: wl-gk-route-draw 1.5s"), "route draws in over 1.5 s");
  });

  it("gates: nothing renders under reduced motion; off-screen pauses", () => {
    assert.ok(gk.includes("if (reducedMotion) return null"), "reduced motion stands on the still alone");
    assert.ok(gk.includes("IntersectionObserver"), "off-screen pause observer");
    assert.ok(gk.includes("wl-gk-paused"), "the paused class the CSS freezes");
  });
});

describe("The spotlight and the entrance cascade", () => {
  it("walks ready cards on a 4 s clock, off under reduced motion", () => {
    assert.ok(picker.includes("}, 4000);"), "4 s spotlight clock");
    assert.ok(picker.includes('row.state === "ready" ? i : -1'), "only ready cards take a turn");
    assert.ok(picker.includes("if (reducedMotion || !released || opened) return;"), "no spotlight under reduced motion");
    assert.ok(picker.includes('" is-spot"'), "the spotlit card carries is-spot");
    assert.ok(css.includes(".why-learn-card.is-spot"), "the gold bloom rule");
    assert.ok(css.includes("animation: wl-spot-pulse 600ms ease-out"), "one 600 ms pulse per turn");
  });

  it("cards rise in on the shared cascade with the mock's uneven stagger", () => {
    assert.ok(picker.includes("RISE_DELAYS_MS = [150, 340, 580, 860, 1180, 1540]"), "uneven rise delays");
    assert.ok(picker.includes("home-rise"), "the shared atlas-rise entrance");
    assert.ok(picker.includes("wl-chip-stamp"), "the chip stamps in behind its card");
    assert.ok(
      picker.includes('className="wl-card-kicker" aria-hidden="true"'),
      "the kicker is decoration — each card's accessible name still starts with the subject",
    );
  });
});

describe("Case screens carry the same system — scope class only", () => {
  it("both SubjectCase shells take the atlas scope", () => {
    const scopes = subjectCase.split("why-learn-screen subject-case-screen").length - 1;
    assert.equal(scopes, 2, "the case shell and the empty-band shell");
    assert.ok(css.includes(".subject-case-screen .mode-card"), "clue + answer cards restyled");
    assert.ok(css.includes(".subject-case-screen .loop-reveal"), "the result band restyled");
    assert.ok(css.includes(".wl-choice-letter"), "the choices' letter badges");
  });

  it("the fill-the-page rule from feat/picker-cards-fill-page survives", () => {
    const block = css.slice(css.indexOf(".why-learn-screen > ul {"), css.indexOf(".wl-drift-item {"));
    assert.ok(block.includes("flex: 1 1 auto"), "the grid still takes the leftover height");
    assert.ok(block.includes("grid-auto-rows: 1fr"), "rows still share it equally");
  });
});
