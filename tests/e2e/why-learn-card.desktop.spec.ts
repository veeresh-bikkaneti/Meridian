import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * "Why Do We Learn This?" Home card (scale-play) — flag gate only.
 *
 * The card ships dark behind the scalePlay flag. Without `?scale=1` Home
 * is today's Home (no card); with it, the card renders in #home-cases
 * right after GeoDetective, with its band film slot and its CTA.
 * flags.json is pinned so a live remote value can't turn it on.
 */
test.setTimeout(120_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  await context.route("**/flags.json", (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ version: 1, flags: { pwaUpdateToast: true } }),
      contentType: "application/json; charset=utf-8",
    }),
  );
});

test("card is absent without ?scale=1", async ({ page }) => {
  await page.goto(APP_URL);
  await expect(page.getByTestId("tour-stop-geodetective")).toBeVisible();
  await expect(page.getByTestId("home-card-why-learn")).toHaveCount(0);
  await expect(page.getByTestId("card-film-why-learn")).toHaveCount(0);
});

test("card is present with ?scale=1, right after GeoDetective", async ({ page }) => {
  await page.goto(`${APP_URL}&scale=1`);
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await expect(card.getByRole("heading", { name: /Why Do We Learn This\?/ })).toBeVisible();
  await expect(card.getByText("Case file · Why it matters")).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Why Do We Learn This?: Start exploring" }),
  ).toBeVisible();
  await expect(card.getByTestId("card-film-why-learn")).toHaveCount(1);
  const order = await page
    .locator("#home-cases > article")
    .evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-testid") ?? el.getAttribute("aria-labelledby")),
    );
  const geo = order.indexOf("tour-stop-geodetective");
  expect(geo).toBeGreaterThanOrEqual(0);
  expect(order[geo + 1]).toBe("home-card-why-learn");
});
