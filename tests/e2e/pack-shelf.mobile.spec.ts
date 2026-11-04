import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Pack shelf at 320px (docs/story-packs.md section 7): the chip row
 * reserves a second row at narrow widths, so when the pack chip
 * arrives late (slow manifest) it wraps into space that is already
 * reserved instead of pushing the case below it down. At 320px the
 * two chips cannot share one row — this is the width where the
 * round-1 layout shifted the clue card by 66px.
 *
 * The mobile project runs at 390px; this spec narrows the viewport
 * to 320px itself so the pinned width is the width under test.
 */

const BASE = "http://127.0.0.1:4123/Meridian/";

const PACK_MANIFEST = {
  v: 1,
  packId: "capitals",
  category: "capitals",
  size: 72,
  generatedAt: "2026-11-03T00:00:00.000Z",
  loopIndexes: Array.from({ length: 72 }, (_, i) => 387 + i),
  loopTiers: Array.from({ length: 72 }, () => 1),
  coldtrailFile: "cases.capitals.generated.json",
};

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

test("pack shelf at 320px: the late pack chip shifts the clue card by at most 1px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.route("**/packs/capitals/manifest.json", async (route) => {
    await new Promise((r) => setTimeout(r, 1_500));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(PACK_MANIFEST),
    });
  });
  await page.goto(BASE);
  await page.getByRole("button", { name: "GeoDetective: Solve a mystery" }).click();
  await expect(page.getByTestId("pack-shelf")).toBeVisible({ timeout: 30_000 });
  const clue = page.getByRole("article", { name: /Clue 1: Geography/ });
  await expect(clue).toBeVisible({ timeout: 30_000 });
  const before = await clue.boundingBox();
  expect(before).not.toBeNull();
  await expect(page.getByTestId("pack-chip-capitals")).toBeVisible({ timeout: 15_000 });
  const after = await clue.boundingBox();
  expect(after).not.toBeNull();
  expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
});
