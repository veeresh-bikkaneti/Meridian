import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Math subject screen (scale-play wave 1) — behind the why-learn card.
 *
 * With `?scale=1`, the card's CTA opens a math case dealt for the
 * player's age band (profile seeded in localStorage, the
 * band-media-variants pattern). One case per band is played through to
 * the result, which must carry the "You just used this in…" line. With
 * the flag off, Home is today's Home and no case can open. Screenshots
 * land in math-shots/ (outside test-results, which Playwright clears).
 */
test.setTimeout(120_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";
const PROFILE_KEY = "meridian.ageProfile.v1";
const SHOTS = "math-shots";

type Band = "7-10" | "10-18" | "18+";

async function setup(context: BrowserContext, band?: Band) {
  await serveBuiltArtifact(context);
  await context.route("**/flags.json", (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ version: 1, flags: { pwaUpdateToast: true } }),
      contentType: "application/json; charset=utf-8",
    }),
  );
  if (band) {
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
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

async function openCase(page: Page) {
  await page.goto(`${APP_URL}&scale=1`);
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await card
    .getByRole("button", { name: "Why Do We Learn This?: Start exploring" })
    .click();
  await expect(page.getByTestId("math-case")).toBeVisible();
  await expect(page.getByTestId("math-answer-card")).toBeVisible();
}

async function dismissCelebration(page: Page) {
  const close = page.getByRole("button", { name: "Close celebration" });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
    await expect(close).toHaveCount(0);
  }
}

async function solveCase(page: Page, correct: string) {
  const answers = page.getByTestId("math-answer-card");
  await answers.getByRole("button", { name: correct, exact: true }).click();
  await dismissCelebration(page);
  const result = page.getByTestId("math-result");
  await expect(result).toBeVisible();
  await expect(result).toContainText("You got it!");
  await expect(page.getByTestId("math-used-in")).toContainText("You just used this in…");
}

test("flag off: Home matches today — no card, no math case", async ({ page, context }) => {
  await setup(context);
  const errors = watchErrors(page);
  await page.goto(APP_URL);
  await expect(page.getByTestId("tour-stop-geodetective")).toBeVisible();
  await expect(page.getByTestId("home-card-why-learn")).toHaveCount(0);
  await expect(page.getByTestId("math-case")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("7-10 case: wrong pick gives kind feedback, right pick reaches the result", async ({
  page,
  context,
}) => {
  await setup(context, "7-10");
  const errors = watchErrors(page);
  await openCase(page);
  const mathCase = page.getByTestId("math-case");
  await expect(mathCase).toHaveAttribute("data-band", "7-10");
  await expect(mathCase).toHaveAttribute("data-item", "math-number:groups:skip-count");
  await page.screenshot({ path: `${SHOTS}/case-7-10-desktop.png` });
  await page.getByTestId("math-answer-card").screenshot({ path: `${SHOTS}/answer-card-desktop.png` });
  // A wrong pick first: kind feedback, still on the same case.
  const answers = page.getByTestId("math-answer-card");
  await answers.getByRole("button", { name: "6", exact: true }).click();
  await expect(page.getByText(/Not quite/)).toBeVisible();
  await expect(page.getByTestId("math-result")).toHaveCount(0);
  await solveCase(page, "8");
  await page.screenshot({ path: `${SHOTS}/result-7-10-desktop.png` });
  expect(errors).toEqual([]);
});

test("10-18 case plays through to the result", async ({ page, context }) => {
  await setup(context, "10-18");
  const errors = watchErrors(page);
  await openCase(page);
  const mathCase = page.getByTestId("math-case");
  await expect(mathCase).toHaveAttribute("data-band", "10-18");
  await expect(mathCase).toHaveAttribute("data-item", "math-number:tables:multi-digit");
  await solveCase(page, "1,081");
  expect(errors).toEqual([]);
});

test("18+ case plays through to the result", async ({ page, context }) => {
  await setup(context, "18+");
  const errors = watchErrors(page);
  await openCase(page);
  const mathCase = page.getByTestId("math-case");
  await expect(mathCase).toHaveAttribute("data-band", "18+");
  await expect(mathCase).toHaveAttribute("data-item", "math-number:tables:mental-strategies");
  await solveCase(page, "360");
  expect(errors).toEqual([]);
});

test("reduced motion: the case still renders and plays", async ({ page, context }) => {
  await setup(context, "10-18");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = watchErrors(page);
  await openCase(page);
  await solveCase(page, "1,081");
  expect(errors).toEqual([]);
});

test("390px: Home card, case, answer card and result render on a phone", async ({
  page,
  context,
}) => {
  await setup(context, "7-10");
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = watchErrors(page);
  await page.goto(`${APP_URL}&scale=1`);
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await card.screenshot({ path: `${SHOTS}/home-card-390.png` });
  await card.getByRole("button", { name: "Why Do We Learn This?: Start exploring" }).click();
  await expect(page.getByTestId("math-case")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/case-7-10-390.png` });
  await solveCase(page, "8");
  await page.screenshot({ path: `${SHOTS}/result-7-10-390.png` });
  expect(errors).toEqual([]);
});
