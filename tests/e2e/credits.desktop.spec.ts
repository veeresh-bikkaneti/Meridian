import { test, expect } from "playwright/test";
import { readFileSync } from "node:fs";
import { serveBuiltArtifact, APP_NO_IDLE } from "./helpers";

/**
 * WI-15 — /credits page.
 *
 * Proves the footer link reaches /credits in the built artifact (served
 * under the /Meridian/ base, as serveBuiltArtifact serves dist/client),
 * that the page carries the GeoNames, Wikipedia, and Esri credits — the
 * Esri string character-for-character, matching the on-map attribution —
 * plus the MapLibre credit, that no email-shaped text appears on the
 * page, and that the route also works by direct navigation.
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const CREDITS_URL = "http://127.0.0.1:4123/Meridian/credits?idle-ms=3600000";
const ESRI_ATTRIBUTION =
  "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community";
const EMAIL_SHAPED = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

async function expectCreditsContent(page: import("playwright/test").Page) {
  const text = await page.locator("body").innerText();
  expect(text).toContain("GeoNames");
  expect(text).toContain("CC BY 4.0");
  expect(text).toContain("Wikipedia");
  expect(text).toContain("CC BY-SA");
  expect(text).toContain(ESRI_ATTRIBUTION);
  expect(text).toContain("MapLibre");
  expect(text).not.toMatch(EMAIL_SHAPED);
}

test("footer credits link reaches the credits page", async ({ page }) => {
  await page.goto(APP_NO_IDLE);
  await page.getByTestId("credits-link").click();
  await expect(page).toHaveURL(/\/credits$/);
  await expectCreditsContent(page);
});

test("credits page loads by direct navigation", async ({ page, context }) => {
  // serveBuiltArtifact maps only the root path to the SPA shell — a cold
  // request for any deep link 404s in this harness (the grown-ups spec
  // notes the static mirror has no deep-link server; production serves
  // deep links from the app server). Register the SPA fallback for this
  // path so the test proves the cold-load half that is this route's to
  // prove: a fresh page whose first URL is /credits, with no prior
  // in-app navigation, renders the credits page from the URL alone.
  const shell = readFileSync("dist/client/_shell.html");
  await context.route("**/Meridian/credits*", async (route) => {
    if (route.request().isNavigationRequest()) {
      return route.fulfill({ status: 200, body: shell, contentType: "text/html; charset=utf-8" });
    }
    return route.fallback();
  });
  const response = await page.goto(CREDITS_URL);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Credits" })).toBeVisible();
  await expectCreditsContent(page);
});
