import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Chemistry subject — through the why-learn card and subject picker.
 *
 * The Chemistry row is ready in the picker; tapping it opens a
 * chemistry case dealt for the player's age band (profile seeded in
 * localStorage). One case per tested band is played to the result.
 */
test.setTimeout(120_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";
const PROFILE_KEY = "meridian.ageProfile.v1";

type Band = "7-10" | "10-18" | "18+";

async function setup(context: BrowserContext, band: Band) {
  await serveBuiltArtifact(context);
  await context.route("**/flags.json", (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ version: 1, flags: { pwaUpdateToast: true } }),
      contentType: "application/json; charset=utf-8",
    }),
  );
  await context.addInitScript(
    ({ key, b }) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          status: "active",
          band: b,
          updatedAt: new Date().toISOString(),
          changeCount: 0,
          schemaVersion: 2,
        }),
      );
    },
    { key: PROFILE_KEY, b: band },
  );
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

async function openChemistryCase(page: Page) {
  await page.goto(APP_URL);
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await card
    .getByRole("button", { name: "Why Do We Learn This?: Start exploring" })
    .click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  const row = page.getByTestId("subject-row-chemistry");
  await expect(row).toBeEnabled();
  await row.click();
  await expect(page.getByTestId("chemistry-case")).toBeVisible();
}

async function dismissCelebration(page: Page) {
  const close = page.getByRole("button", { name: "Close celebration" });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
    await expect(close).toHaveCount(0);
  }
}

test("7-10 chemistry case plays through to the result", async ({ page, context }) => {
  await setup(context, "7-10");
  const errors = watchErrors(page);
  await openChemistryCase(page);
  const chemCase = page.getByTestId("chemistry-case");
  await expect(chemCase).toHaveAttribute("data-band", "7-10");
  await expect(chemCase).toHaveAttribute("data-item", "chemistry:states:solid-liquid");
  await page
    .getByTestId("chemistry-answer-card")
    .getByRole("button", { name: "Warmth melted it", exact: true })
    .click();
  await dismissCelebration(page);
  await expect(page.getByTestId("chemistry-result")).toBeVisible();
  await expect(page.getByTestId("chemistry-used-in")).toContainText("You just used this in…");
  expect(errors).toEqual([]);
});

test("10-18 chemistry case plays through to the result", async ({ page, context }) => {
  await setup(context, "10-18");
  const errors = watchErrors(page);
  await openChemistryCase(page);
  const chemCase = page.getByTestId("chemistry-case");
  await expect(chemCase).toHaveAttribute("data-band", "10-18");
  await expect(chemCase).toHaveAttribute("data-item", "chemistry:states:road-salt");
  await page
    .getByTestId("chemistry-answer-card")
    .getByRole("button", { name: "It lowers the freezing point of the water", exact: true })
    .click();
  await dismissCelebration(page);
  await expect(page.getByTestId("chemistry-result")).toBeVisible();
  expect(errors).toEqual([]);
});
