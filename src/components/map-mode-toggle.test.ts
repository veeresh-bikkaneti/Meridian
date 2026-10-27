/**
 * MapModeToggle — scroll-anchored popover contract (PR #272).
 *
 * On Home, the Scout Map popover must stay anchored to map-mode-button
 * via position: absolute (top-full mt-2) inside its relative wrapper so
 * scrolling the page scrolls the popover with the button instead of
 * travelling with the viewport or shifting up over the audio button /
 * storyteller greeting. Horizontal placement clamps within [8, innerWidth - 264]
 * via a relative left offset updated on open and window resize.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const toggleSrc = readFileSync(join(here, "map-mode-toggle.tsx"), "utf8");
const homeV5Css = readFileSync(join(here, "home-v5.css"), "utf8");

describe("MapModeToggle — scroll-anchored popover contract", () => {
  it("renders map-mode-popover with position: absolute (top-full mt-2), never fixed", () => {
    assert.ok(
      toggleSrc.includes("pointer-events-auto absolute top-full left-0 z-40 mt-2 w-64"),
      "map-mode-popover must use absolute top-full mt-2 so it stays 8px below the button in document flow",
    );
    assert.ok(
      !toggleSrc.includes("pointer-events-auto fixed"),
      "map-mode-popover must never use fixed positioning (which causes it to travel with viewport scroll)",
    );
    assert.ok(
      !toggleSrc.includes("window.innerHeight - estHeight"),
      "map-mode-popover must not clamp top to window.innerHeight (which shifts it up over the audio button)",
    );
  });

  it("computes horizontal leftOffset relative to the button and updates on resize", () => {
    assert.ok(
      toggleSrc.includes("const [homeLeftOffset, setHomeLeftOffset] = useState<number>(0)"),
      "homeLeftOffset state must track horizontal offset from the button",
    );
    assert.ok(
      toggleSrc.includes("setHomeLeftOffset(clampedViewportLeft - rect.left)"),
      "left offset must be clampedViewportLeft - rect.left",
    );
    assert.ok(
      toggleSrc.includes("style={atHome ? { left: homeLeftOffset } : undefined}"),
      "home popover style must apply only horizontal left offset, keeping vertical top-full mt-2",
    );
    assert.ok(
      toggleSrc.includes('window.addEventListener("resize", measureHomeLeftOffset)'),
      "resize listener must update horizontal offset while open on Home",
    );
  });

  it("allows map-mode-popover to escape .hv5-hero clipping and stack above hero content", () => {
    assert.ok(
      homeV5Css.includes('.home-v5 .hv5-hero:has([data-testid="map-mode-popover"])') &&
        homeV5Css.includes("overflow: visible"),
      ".hv5-hero must become overflow: visible while map-mode-popover is open so narrow viewports are never clipped",
    );
    assert.ok(
      homeV5Css.includes(".home-v5 .hv5-hero-top") &&
        homeV5Css.includes("position: relative") &&
        homeV5Css.includes("z-index: 10"),
      ".hv5-hero-top must establish a stacking context above later hero children",
    );
  });
});
