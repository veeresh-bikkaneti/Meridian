import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Capitals & Flags (issue #344): the home doorway strip, the pack
 * relabel, and the flag layer's GeoDetective + Cold Trail surfaces.
 *
 * The GeoDetective test stubs the pack manifest down to a single case
 * (Abu Dhabi, index 387 — its land, the United Arab Emirates, has a
 * licence-verified flag) so the dealt case is deterministic; the clue
 * file and sidecar are the real shipped ones. The Cold Trail test
 * uses the real pack deck: a fresh profile deals case 1 first, whose
 * three witnesses (Lima, Buenos Aires, Santiago) all carry verified
 * flags and whose hideout (Yacuiba, Bolivia) carries a country name
 * but no flag — Bolivia is not a pack land.
 */

const BASE = "http://127.0.0.1:4123/Meridian/";

const SINGLE_CASE_MANIFEST = {
  v: 1,
  packId: "capitals",
  category: "capitals",
  size: 1,
  generatedAt: "2026-11-04T00:00:00.000Z",
  loopIndexes: [387],
  loopTiers: [3],
  coldtrailFile: "cases.capitals.generated.json",
};

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

test("home doorway: strip, swatches and the Capitals & Flags name", async ({ page }) => {
  await page.goto(BASE);
  const doorway = page.getByTestId("pack-doorway");
  await expect(doorway).toBeVisible({ timeout: 30_000 });
  await expect(doorway.getByRole("heading", { name: "Capitals & Flags" })).toBeVisible();
  await expect(doorway).toContainText("lands · Find the capital, learn its flag");
  // The design's three swatches render once their lazy chunks arrive.
  await expect(doorway.getByTestId("flag-img").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("pack-doorway-geodetective")).toBeVisible();
  await expect(page.getByTestId("pack-doorway-coldtrail")).toBeVisible();
});

test("doorway into GeoDetective deals the pack with the briefing flag", async ({ page }) => {
  await page.route("**/packs/capitals/manifest.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(SINGLE_CASE_MANIFEST),
    });
  });
  await page.goto(BASE);
  await page.getByTestId("pack-doorway-geodetective").click();
  // The briefing names the land and its flag sits beside the name.
  await expect(
    page.getByText("Your case: find the capital of United Arab Emirates."),
  ).toBeVisible({ timeout: 30_000 });
  const flag = page.getByTestId("flag-img").first();
  await expect(flag).toBeVisible({ timeout: 15_000 });
  await expect(flag).toHaveAttribute("data-flag-key", "ae");
  // The shelf chip carries the ratified relabel.
  await expect(page.getByTestId("pack-chip-capitals")).toContainText("Capitals & Flags");
});

test("doorway into Cold Trail deals the pack; witness flags render", async ({ page }) => {
  await page.goto(BASE);
  await page.getByTestId("pack-doorway-coldtrail").click();
  await expect(page.getByTestId("sighting-card")).toHaveCount(3, { timeout: 30_000 });
  const flags = page.getByTestId("sighting-flag");
  await expect(flags).toHaveCount(3);
  const keys = await flags
    .locator("img")
    .evaluateAll((imgs) => imgs.map((img) => img.getAttribute("data-flag-key")));
  expect(keys).toEqual(["pe", "ar", "cl"]);
});
