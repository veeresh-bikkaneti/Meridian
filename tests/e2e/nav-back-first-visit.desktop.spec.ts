import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Round 2 (Review Round 2, Q1 + bug 12) — two behaviours the unit
 * suite cannot see, asserted on geometry and history, never on
 * constants:
 *
 * Q1: on a first visit with prompts pending, the first-visit queue
 * renders as an OVERLAY below the header. The header's bounding-box
 * top stays at its natural position (≤40px) at phone and desktop
 * widths — before the fix the queue rendered in-flow above the
 * header and pushed it hundreds of pixels down — and exactly one
 * prompt is visible, sitting below the header's bottom edge.
 *
 * Bug 12: Back behaviour. (a) Open GeoDetective from Home, press
 * Back: the app lands on #home with the game closed. (b) A fresh
 * visit to / holds exactly one history entry for the app: one Back
 * leaves cleanly (goBack finds nothing) instead of landing on a
 * phantom hash-less entry the boot used to push under #home.
 */

test.setTimeout(240_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

async function openHome(page: Page) {
  await page.goto(APP_URL);
  await expect(page.locator("header.hv5-nav")).toBeVisible();
}

async function assertFirstVisitOverlay(page: Page) {
  const queue = page.getByTestId("first-visit-queue");
  await expect(queue).toBeVisible();
  // Exactly one prompt at a time (INV4), overlaid, not in flow.
  await expect(queue).toHaveCount(1);
  await expect(queue).toHaveAttribute("data-placement", "overlay");

  const header = page.locator("header.hv5-nav");
  const headerBox = await header.boundingBox();
  const queueBox = await queue.boundingBox();
  expect(headerBox).not.toBeNull();
  expect(queueBox).not.toBeNull();
  // The header never moves for a prompt: its top stays at the
  // page's natural header position.
  expect(headerBox!.y).toBeLessThanOrEqual(40);
  // The overlay sits below the header, not on top of it.
  expect(queueBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1);
}

test("Q1: first-visit prompt overlays below the header at 1280 (header top ≤ 40)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openHome(page);
  await assertFirstVisitOverlay(page);
});

test("Q1: first-visit prompt overlays below the header at 390 (header top ≤ 40)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);
  await assertFirstVisitOverlay(page);
});

test("bug 12a: Back from an opened game lands on #home with the game closed", async ({ page }) => {
  await openHome(page);
  await page.getByRole("button", { name: "GeoDetective: Solve a mystery" }).click();
  await expect(page.getByTestId("loop-screen")).toBeVisible();
  await expect(page).toHaveURL(/#geodetective$/);

  await page.goBack();
  await expect(page).toHaveURL(/#home$/);
  await expect(page.getByTestId("loop-screen")).toHaveCount(0);
  await expect(page.locator("header.hv5-nav")).toBeVisible();
});

test("bug 12b: a fresh visit holds one history entry — one Back leaves cleanly", async ({ page }) => {
  await openHome(page);
  // The boot seeds #home into the current entry (replaceState), so
  // there is no second, hash-less entry under it: one Back leaves
  // the app entirely, back to where the tab started. Before the
  // fix, Back landed on the phantom hash-less entry and the app
  // stayed on screen.
  await page.goBack();
  await expect(page).toHaveURL("about:blank");
});
