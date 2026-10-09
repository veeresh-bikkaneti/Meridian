import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

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
});
