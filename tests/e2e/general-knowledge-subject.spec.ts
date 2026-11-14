import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * General knowledge subject — through the why-learn card and picker.
 *
 * The General knowledge row is ready in the picker; tapping it opens
 * a case dealt for the player's age band (profile seeded in
 * localStorage). The 7-10 opener is the year-gap case: its correct
 * answer is computed from the device year at play time, so the spec
 * computes it the same way instead of hard-coding a year.
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

async function openGkCase(page: Page) {
  await page.goto(APP_URL);
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await card
    .getByRole("button", { name: "Why Do We Learn This?: Start exploring" })
    .click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  const row = page.getByTestId("subject-row-general-knowledge");
  await expect(row).toBeEnabled();
  await row.click();
  await expect(page.getByTestId("general-knowledge-case")).toBeVisible();
}

async function dismissCelebration(page: Page) {
  const close = page.getByRole("button", { name: "Close celebration" });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
    await expect(close).toHaveCount(0);
  }
}

test("7-10 year-gap case plays through to the result", async ({ page, context }) => {
  await setup(context, "7-10");
  const errors = watchErrors(page);
  await openGkCase(page);
  const gkCase = page.getByTestId("general-knowledge-case");
  await expect(gkCase).toHaveAttribute("data-band", "7-10");
  await expect(gkCase).toHaveAttribute("data-item", "general-knowledge:mixed:opera-years-ago");
  const expected = String(new Date().getFullYear() - 1973);
  await page
    .getByTestId("general-knowledge-answer-card")
    .getByRole("button", { name: expected, exact: true })
    .click();
  await dismissCelebration(page);
  await expect(page.getByTestId("general-knowledge-result")).toBeVisible();
  await expect(page.getByTestId("general-knowledge-used-in")).toContainText(
    "You just used this in…",
  );
  expect(errors).toEqual([]);
});

test("7-10 older-landmark case (new in v2) plays through to the result", async ({
  page,
  context,
}) => {
  await setup(context, "7-10");
  const errors = watchErrors(page);
  await openGkCase(page);
  const gkCase = page.getByTestId("general-knowledge-case");
  // Cases deal in order: opera-years-ago, eiffel-antennas, then the
  // v2 newcomer older-landmark. Solve each and take "Next case".
  const expectedYear = String(new Date().getFullYear() - 1973);
  await page
    .getByTestId("general-knowledge-answer-card")
    .getByRole("button", { name: expectedYear, exact: true })
    .click();
  await dismissCelebration(page);
  await page.getByRole("button", { name: /Next case/ }).click();
  await expect(gkCase).toHaveAttribute(
    "data-item",
    "general-knowledge:mixed:eiffel-antennas",
  );
  await page
    .getByTestId("general-knowledge-answer-card")
    .getByRole("button", { name: "59 feet", exact: true })
    .click();
  await page.getByRole("button", { name: /Next case/ }).click();
  await expect(gkCase).toHaveAttribute(
    "data-item",
    "general-knowledge:mixed:older-landmark",
  );
  await page
    .getByTestId("general-knowledge-answer-card")
    .getByRole("button", { name: "The Eiffel Tower", exact: true })
    .click();
  await expect(page.getByTestId("general-knowledge-result")).toBeVisible();
  await expect(page.getByTestId("general-knowledge-used-in")).toContainText(
    "You just used this in…",
  );
  expect(errors).toEqual([]);
});

test("18+ great-circle case plays through to the result", async ({ page, context }) => {
  await setup(context, "18+");
  const errors = watchErrors(page);
  await openGkCase(page);
  const gkCase = page.getByTestId("general-knowledge-case");
  await expect(gkCase).toHaveAttribute("data-band", "18+");
  await expect(gkCase).toHaveAttribute("data-item", "general-knowledge:mixed:great-circle");
  await page
    .getByTestId("general-knowledge-answer-card")
    .getByRole("button", { name: "8,000 to 8,500 km", exact: true })
    .click();
  await dismissCelebration(page);
  await expect(page.getByTestId("general-knowledge-result")).toBeVisible();
  expect(errors).toEqual([]);
});
