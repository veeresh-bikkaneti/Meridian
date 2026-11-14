import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Journals subject (Stream D, PR D1): picker -> Journals -> a case played
 * to the result, through the shared case flow. Covers the Lincoln
 * Memorial (7-10) with its caption lead and reduced motion, then one
 * 10-18 item. Clip movies are not rendered yet: the lead shows the
 * caption text. Screenshots land in journals-shots/.
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

async function openJournals(page: Page) {
  await page.goto(APP_URL);
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await card
    .getByRole("button", { name: "Why Do We Learn This?: Start exploring" })
    .click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  const row = page.getByTestId("subject-row-journals");
  await expect(row).toBeEnabled();
  await row.click();
  await expect(page.getByTestId("journals-case")).toBeVisible();
  await expect(page.getByTestId("journals-answer-card")).toBeVisible();
}

async function dismissCelebration(page: Page) {
  const close = page.getByRole("button", { name: "Close celebration" });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
    await expect(close).toHaveCount(0);
  }
}

test("7-10: Lincoln Memorial shows its caption lead, a wrong pick is kind, the right pick reaches the result", async ({
  page,
  context,
}) => {
  await setup(context, "7-10");
  const errors = watchErrors(page);
  // Reduced motion must still render the case in full.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openJournals(page);
  await expect(page.getByTestId("journals-case")).toHaveAttribute(
    "data-item",
    "great-leaders:lincoln-memorial",
  );
  await expect(page.getByTestId("journals-caption")).toContainText("Washington, D.C., 1922.");
  await page.screenshot({ path: "journals-shots/lincoln-7-10.png" });

  const answers = page.getByTestId("journals-answer-card");
  await answers.getByRole("button", { name: "6", exact: true }).click();
  await expect(page.getByTestId("journals-result")).toHaveCount(0);

  await answers.getByRole("button", { name: "8", exact: true }).click();
  await dismissCelebration(page);
  const result = page.getByTestId("journals-result");
  await expect(result).toBeVisible();
  await expect(result).toContainText("You got it!");
  await expect(page.getByTestId("journals-used-in")).toContainText("You just used this in…");
  expect(errors).toEqual([]);
});

test("10-18: the first case is the mobile phone, and its right answer reaches the result", async ({
  page,
  context,
}) => {
  await setup(context, "10-18");
  const errors = watchErrors(page);
  await openJournals(page);
  await expect(page.getByTestId("journals-case")).toHaveAttribute(
    "data-item",
    "technology:mobile-phone",
  );
  await expect(page.getByTestId("journals-caption")).toContainText("1973");
  await page
    .getByTestId("journals-answer-card")
    .getByRole("button", { name: "97", exact: true })
    .click();
  await dismissCelebration(page);
  await expect(page.getByTestId("journals-result")).toContainText("The answer is");
  await expect(page.getByTestId("journals-result")).toContainText("97");
  expect(errors).toEqual([]);
});
