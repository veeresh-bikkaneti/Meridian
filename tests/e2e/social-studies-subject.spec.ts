import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Social studies subject — through the why-learn card and picker.
 *
 * The Social studies row is ready in the picker; tapping it opens a
 * case dealt for the player's age band (profile seeded in
 * localStorage). This is the last row of the launch plan to go live:
 * with it open, Journals is the only "Coming soon" row left.
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

async function openSocialStudiesCase(page: Page) {
  await page.goto(APP_URL);
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await card
    .getByRole("button", { name: "Why Do We Learn This?: Start exploring" })
    .click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  const row = page.getByTestId("subject-row-social-studies");
  await expect(row).toBeEnabled();
  // Journals stays a disabled "Coming soon" row — not in this run.
  await expect(page.getByTestId("subject-row-journals")).toBeDisabled();
  await row.click();
  await expect(page.getByTestId("social-studies-case")).toBeVisible();
}

async function dismissCelebration(page: Page) {
  const close = page.getByRole("button", { name: "Close celebration" });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
    await expect(close).toHaveCount(0);
  }
}

test("7-10 area-by-squares case plays through to the result", async ({ page, context }) => {
  await setup(context, "7-10");
  const errors = watchErrors(page);
  await openSocialStudiesCase(page);
  const ssCase = page.getByTestId("social-studies-case");
  await expect(ssCase).toHaveAttribute("data-band", "7-10");
  await expect(ssCase).toHaveAttribute("data-item", "social-studies:region:area-by-squares");
  await page
    .getByTestId("social-studies-answer-card")
    .getByRole("button", { name: "The first field, by 4 squares", exact: true })
    .click();
  await dismissCelebration(page);
  await expect(page.getByTestId("social-studies-result")).toBeVisible();
  await expect(page.getByTestId("social-studies-used-in")).toContainText(
    "You just used this in…",
  );
  expect(errors).toEqual([]);
});

test("18+ flat-map-area case plays through to the result", async ({ page, context }) => {
  await setup(context, "18+");
  const errors = watchErrors(page);
  await openSocialStudiesCase(page);
  const ssCase = page.getByTestId("social-studies-case");
  await expect(ssCase).toHaveAttribute("data-band", "18+");
  await expect(ssCase).toHaveAttribute("data-item", "social-studies:region:flat-map-area");
  await page
    .getByTestId("social-studies-answer-card")
    .getByRole("button", {
      name: "Africa is far bigger — the flat map stretches places near the poles",
      exact: true,
    })
    .click();
  await dismissCelebration(page);
  await expect(page.getByTestId("social-studies-result")).toBeVisible();
  expect(errors).toEqual([]);
});
