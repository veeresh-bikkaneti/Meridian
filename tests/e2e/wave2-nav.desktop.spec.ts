import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * WI-10 (Branch 2): top-nav honesty.
 *
 * The old nav carried a Search button with aria-disabled="true" and an
 * sr-only "Not yet available" note — a control that looked actionable
 * and announced itself to assistive tech but did nothing. It is now
 * hidden (removed), and every remaining item is labeled for what it
 * actually does: a jump to a section on this same page. These tests
 * pin that: no disabled nav items anywhere in the header, no Search
 * control, honest accessible names, and the jumps still work.
 */

const APP = "http://127.0.0.1:4123/Meridian/";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

test("nav: no disabled items, no dead Search, items labeled for what they do", async ({ page }) => {
  await page.goto(APP);
  const header = page.locator("header.hv5-nav");
  await expect(header).toBeVisible();

  // Nothing in the header is disabled or aria-disabled.
  await expect(header.locator("[disabled]")).toHaveCount(0);
  await expect(header.locator('[aria-disabled="true"]')).toHaveCount(0);

  // The dead Search control and its "Not yet available" note are gone.
  await expect(header.getByRole("button", { name: "Search" })).toHaveCount(0);
  await expect(page.locator("#hv5-unmapped-note")).toHaveCount(0);

  // Every nav item names the section it jumps to.
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("button", { name: "Jump to the expeditions section" })).toBeVisible();
  await expect(nav.getByRole("button", { name: "Jump to the case files section" })).toBeVisible();
  await expect(nav.getByRole("button", { name: "Jump to the about section" })).toBeVisible();
  await expect(nav.getByRole("button", { name: "Jump to the journal section" })).toBeVisible();
  await expect(nav.getByRole("button", { name: "Jump to the get involved section" })).toBeVisible();

  // And a jump still works: ABOUT scrolls the About section into view
  // and moves focus to it (the sections carry tabIndex={-1}).
  await nav.getByRole("button", { name: "Jump to the about section" }).click();
  const about = page.locator("#home-about");
  await expect(about).toBeInViewport();
  await expect(about).toBeFocused();
});
