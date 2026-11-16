/**
 * Header consistency (fix/header-consistency-all-screens, Radhae
 * 2026-11-16): every screen header opens with the homepage's brand
 * lockup (BrandHomeButton, named "Meridian home") — no screen header
 * keeps a separate "Home" pill/link. fix/header-logo-home (PR #510)
 * did the ScreenShell screens; this change carries the same control
 * to the screens that render their own headers.
 *
 * There is no DOM test infra in this repo, so — the case-navigation
 * precedent — these tests pin the rendered contract in the component
 * sources; the Playwright specs prove the behaviour against the
 * built artifact.
 *
 * Converted headers pinned here:
 * - GeoDetective (LoopScreen): brand first in the bar, then End game,
 *   then the sound toggle, Case # on the right — the #510 order.
 * - Cold Trail (TrailScreen): brand first in the header row, sound
 *   toggle beside it, stars on the right.
 * - /board (routes/board.tsx): brand as a router link (`to="/"`)
 *   opening the header; no HomeButton left in the file.
 * - Challenge-a-friend region picker (game-app.tsx menu screen):
 *   brand first, wired to the same setMenu(null) close.
 *
 * Deliberately NOT converted, also pinned here so the boundary is
 * explicit, not accidental:
 * - The globe-run map HUD (game-app.tsx): an overlay cluster over
 *   the map canvas, not a page header.
 * - End-of-flow HomeButtons: LoopReveal's home-button-end, the
 *   review/challenge/run-error primary exits in game-app.tsx.
 * - Cold Trail's fail-closed empty-deck exit: a standalone body
 *   control under an alert, not a header.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), "utf8");

const loopScreen = read("../../game/loop/LoopScreen.tsx");
const trailScreen = read("../../game/coldtrail/TrailScreen.tsx");
const board = read("../../routes/board.tsx");
const gameApp = read("../game-app.tsx");

describe("GeoDetective header (LoopScreen)", () => {
  const barStart = loopScreen.indexOf("screen-home-bar");
  const bar = loopScreen.slice(barStart, loopScreen.indexOf("<header", barStart));

  it("the brand control is first in the bar, before End game and the sound toggle", () => {
    const brandAt = bar.indexOf("<BrandHomeButton");
    const endAt = bar.indexOf('data-testid="end-game-button"');
    const soundAt = bar.indexOf("<SoundToggle");
    assert.ok(brandAt >= 0, "the bar carries the brand control");
    assert.ok(endAt > brandAt, "End game renders after the brand control");
    assert.ok(soundAt > endAt, "the sound toggle renders after End game (the #510 order)");
    assert.ok(bar.includes("onHome={onLeave}"), "wired to the screen's existing onLeave");
  });

  it("no HomeButton pill remains in the bar", () => {
    assert.ok(!bar.includes("<HomeButton"), "no HomeButton in the GeoDetective header bar");
  });

  it("the reveal's end-of-flow Home stays a HomeButton (home-button-end)", () => {
    assert.ok(
      loopScreen.includes('<HomeButton onHome={onLeave} testId="home-button-end"'),
      "LoopReveal's pinned-CTA Home is untouched",
    );
  });
});

describe("Cold Trail header (TrailScreen)", () => {
  const headStart = trailScreen.indexOf("<header>");
  const header = trailScreen.slice(headStart, trailScreen.indexOf("</header>", headStart));

  it("the brand control is first in the header row, before the sound toggle", () => {
    const brandAt = header.indexOf("<BrandHomeButton");
    const soundAt = header.indexOf("<SoundToggle");
    assert.ok(brandAt >= 0, "the header carries the brand control");
    assert.ok(soundAt > brandAt, "the sound toggle renders after the brand control");
    assert.ok(header.includes("onHome={onLeave}"), "wired to the screen's existing onLeave");
    assert.ok(header.includes('data-testid="coldtrail-stars"'), "the stars readout stays in the header");
  });

  it("no HomeButton pill remains in the header", () => {
    assert.ok(!header.includes("<HomeButton"), "no HomeButton in the Cold Trail header");
  });

  it("the fail-closed empty-deck exit stays a HomeButton (body, not header)", () => {
    assert.ok(
      trailScreen.includes('<HomeButton onHome={onLeave} variant="secondary" className="mt-6 self-start" />'),
      "the empty-deck screen's standalone exit is untouched",
    );
  });
});

describe("/board header (routes/board.tsx)", () => {
  it("the brand control opens the header as a router link home", () => {
    const brandAt = board.indexOf("<BrandHomeButton");
    const eyebrowAt = board.indexOf("v3-eyebrow");
    assert.ok(brandAt >= 0, "the board header carries the brand control");
    assert.ok(board.includes('<BrandHomeButton to="/"'), "link mode, the route's existing home semantics");
    assert.ok(eyebrowAt > brandAt, "the brand control is the header's first element");
  });

  it("no HomeButton remains anywhere on the board route", () => {
    assert.ok(!board.includes("<HomeButton"), "no HomeButton JSX on the board route");
    assert.ok(!board.includes("import { HomeButton }"), "the HomeButton import is gone");
  });
});

describe("Challenge-a-friend region picker (game-app.tsx menu screen)", () => {
  // The render block (an effect earlier in the file tests the same
  // menu kind; the picker's own comment anchors the render).
  const start = gameApp.indexOf("The challenge region picker:");
  const segment = gameApp.slice(start, gameApp.indexOf("<h1", start));

  it("the brand control is the screen's top control, on the same close handler", () => {
    assert.ok(segment.includes("<BrandHomeButton"), "the menu screen opens with the brand control");
    assert.ok(
      segment.includes("onHome={() => setMenu(null)}"),
      "wired to the same setMenu(null) the Home pill invoked — no handler change",
    );
    assert.ok(!segment.includes("<HomeButton"), "no HomeButton pill at the top of the menu screen");
  });

  it("the globe-run map HUD keeps its HomeButton (overlay, not a page header)", () => {
    assert.ok(
      gameApp.includes('<HomeButton onHome={onEditions} variant="secondary" className="pointer-events-auto" />'),
      "the HUD cluster over the map canvas is untouched",
    );
  });
});
