import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Subject picker — the "Why Do We Learn This?" card's screen.
 *
 * The card is live for everyone (subjects launch, Nov 13): no
 * ?scale=1 needed. The picker lists the released subjects as ready
 * rows and everything not built yet as disabled "Coming soon" rows
 * (Journals stay coming soon in this run — their clips are not in the
 * repo). Picking a ready row opens that subject's case; the case's
 * the Home control returns to Home. Per-band "Coming soon" for a released
 * subject is covered by the picker-rows unit tests; no shipped
 * subject currently lacks a band.
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

async function openPicker(page: Page) {
  await page.goto(APP_URL);
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await card
    .getByRole("button", { name: "Why Do We Learn This?: Start exploring" })
    .click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
}

test("picker lists Math ready and Journals as Coming soon", async ({ page, context }) => {
  await setup(context, "10-18");
  const errors = watchErrors(page);
  await openPicker(page);
  const picker = page.getByTestId("subject-picker");
  await expect(picker).toHaveAttribute("data-band", "10-18");
  const math = page.getByTestId("subject-row-math");
  await expect(math).toBeEnabled();
  await expect(math).toContainText("Math");
  await expect(math).toContainText("3 cases");
  const journals = page.getByTestId("subject-row-journals");
  await expect(journals).toBeDisabled();
  await expect(journals).toContainText("Coming soon");
  expect(errors).toEqual([]);
});

test("picking Math opens the math case, and its Home control returns Home", async ({
  page,
  context,
}) => {
  await setup(context, "7-10");
  const errors = watchErrors(page);
  await openPicker(page);
  await page.getByTestId("subject-row-math").click();
  const mathCase = page.getByTestId("math-case");
  await expect(mathCase).toBeVisible();
  await expect(mathCase).toHaveAttribute("data-band", "7-10");
  await mathCase.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page.getByTestId("home-card-why-learn")).toBeVisible();
  expect(errors).toEqual([]);
});

test("reduced motion: the picker still renders and opens a case", async ({
  page,
  context,
}) => {
  await setup(context, "18+");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = watchErrors(page);
  await openPicker(page);
  await page.getByTestId("subject-row-math").click();
  await expect(page.getByTestId("math-case")).toBeVisible();
  expect(errors).toEqual([]);
});

test("390px: the picker renders on a phone with no sideways scroll", async ({
  page,
  context,
}) => {
  await setup(context, "7-10");
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = watchErrors(page);
  await openPicker(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
