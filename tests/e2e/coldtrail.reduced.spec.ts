import { test, expect } from "playwright/test";
import { serveBuiltArtifact, sourceFeatures } from "./helpers";

/**
 * Cold Trail reduced-motion gate (runs in the "reduced" project).
 *
 * Placement mode must be fully usable with no animation: the draft ring
 * appears instantly, the armed-map border is static (no pulse), and the
 * place→adjust→lock loop completes.
 */

const BASE = "http://127.0.0.1:4123/Meridian/";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

test("reduced motion: placement flow completes, armed border is static", async ({
  page,
}) => {
  const reduced = await page.evaluate(() =>
    matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  expect(reduced).toBe(true);

  await page.goto(BASE);
  await page.getByRole("button", { name: "❄️ Start the trail" }).click();
  await expect(page.getByTestId("coldtrail-screen")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("sighting-card")).toHaveCount(3, { timeout: 30_000 });

  await page.getByTestId("place-ring-btn").first().click();
  await expect(page.getByTestId("map-hint")).toContainText("Tap where you think the ring goes");

  // The armed border exists but carries no animation (static dashed border,
  // not a pulse) under reduced motion.
  const animated = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll(".border-dashed"));
    return els.map((el) => getComputedStyle(el).animationName);
  });
  for (const name of animated) {
    expect(name === "none" || name === "").toBe(true);
  }

  // The loop itself works: tap plants the draft, "Yes, keep it" locks it.
  await page.getByTestId("loop-map").click({ position: { x: 200, y: 200 } });
  await expect(page.getByTestId("confirm-ring-btn")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("confirm-ring-btn").click();
  await expect(page.getByTestId("map-hint")).toContainText("Ring 1 locked");
  await expect(page.getByTestId("place-ring-btn")).toHaveCount(2);

  // F11 lens under reduced motion: lock all 3 — the STATIC overlap fill
  // paints (the lens is still the "where they cross" anchor), but the
  // one-time pulse never fires.
  for (const tap of [
    { x: 300, y: 250 },
    { x: 400, y: 300 },
  ]) {
    await page.getByTestId("place-ring-btn").first().click();
    await page.getByTestId("loop-map").click({ position: tap });
    await expect(page.getByTestId("confirm-ring-btn")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("confirm-ring-btn").click();
  }
  await expect(page.getByTestId("map-hint")).toContainText("All 3 rings are down");
  // The overlap source painted (proves the repaint effect ran — the exact
  // path that would have created the pulse), yet no pulse element exists.
  await sourceFeatures(page, "loop-overlap", 1);
  await expect(page.locator(".ct-overlap-pulse")).toHaveCount(0);
});
