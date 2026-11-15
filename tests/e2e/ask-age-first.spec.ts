import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Ask first (fix/ask-age-first, owner decision 2026-11-14):
 * a player with NO age band set is asked to pick one before any
 * case starts — never silently defaulted to 10-18.
 *
 * - The Why Learn card asks first; the pick continues to the
 *   subject picker, and a subject card lands on that subject's
 *   case at the picked band.
 * - "Resume your case" (Home's GeoDetective card in its resume
 *   mode) asks first; the pick resumes the same mystery.
 * - A player who already has a band set sees no change: no ask
 *   on any of these paths.
 * - Backing out of the picker ("Not now") writes nothing and
 *   starts nothing.
 *
 * The picker under test is prod's own AgePicker (the settings
 * flow's component), hosted by AgeAskGate: card order is the
 * band table's — 0 = 7-10, 1 = 10-18, 2 = 18+.
 */

test.setTimeout(120_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";
const PROFILE_KEY = "meridian.ageProfile.v1";

async function setup(context: BrowserContext) {
  await serveBuiltArtifact(context);
  await context.route("**/flags.json", (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ version: 1, flags: { pwaUpdateToast: true } }),
      contentType: "application/json; charset=utf-8",
    }),
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

async function seedBand(context: BrowserContext, band: "7-10" | "10-18" | "18+") {
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

async function readProfileBand(page: Page): Promise<string | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw).band as string) : null;
  }, PROFILE_KEY);
}

async function readLoopCurrent(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem("meridian.loop.v2");
    const store = raw ? JSON.parse(raw) : null;
    return store?.current
      ? { index: store.current.index, status: store.current.status }
      : null;
  });
}

/** Answer the ask: pick the band card (band-table order) and save. */
async function answerAsk(page: Page, cardIndex: number) {
  const picker = page.getByTestId("age-picker");
  await expect(picker).toBeVisible();
  const cards = picker.locator(".agep-card");
  await expect(cards).toHaveCount(3);
  await cards.nth(cardIndex).click();
  await expect(cards.nth(cardIndex)).toHaveClass(/agep-card-checked/);
  await page.getByTestId("agep-save").click();
  await expect(picker).toHaveCount(0);
}

async function tapWhyLearn(page: Page) {
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await card
    .getByRole("button", { name: "Why Do We Learn This?: Start exploring" })
    .click();
}

/** Deal a GeoDetective mystery and leave it mid-play. */
async function dealMystery(page: Page) {
  await page
    .getByRole("button", { name: "GeoDetective: Solve a mystery" })
    .click();
  await expect(page.getByTestId("loop-screen")).toBeVisible({ timeout: 30_000 });
  const dealt = await readLoopCurrent(page);
  expect(dealt?.status).toBe("playing");
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page.getByTestId("home-heading")).toBeVisible();
  return dealt;
}

test("no band: the Why Learn card asks first, then the case lands at the picked band", async ({
  page,
  context,
}) => {
  await setup(context);
  const errors = watchErrors(page);
  await page.goto(APP_URL);
  await tapWhyLearn(page);
  // The ask comes first — no picker, no case, nothing dealt yet.
  await expect(page.getByTestId("age-picker")).toBeVisible();
  await expect(page.getByTestId("subject-picker")).toHaveCount(0);
  await answerAsk(page, 0); // Ages 7-10
  // The continuation survives the ask: the picker opens at 7-10…
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  await expect(page.getByTestId("subject-picker")).toContainText("Ages 7-10");
  expect(await readProfileBand(page)).toBe("7-10");
  // …and the subject card lands on the intended case, at 7-10.
  await page.getByTestId("subject-row-math").click();
  await expect(page.getByTestId("math-case")).toBeVisible();
  await expect(page.getByTestId("math-answer-card")).toBeVisible();
  await expect(page.getByText("Ages 7-10").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("no band: Resume your case asks first, then the same mystery resumes", async ({
  page,
  context,
}) => {
  await setup(context);
  const errors = watchErrors(page);
  await page.goto(APP_URL);
  // A fresh deal is a main-game loop start and is not gated; it
  // leaves a mystery mid-play with the profile still unset.
  const dealt = await dealMystery(page);
  expect(await readProfileBand(page)).toBeNull();
  // The card is now the resume offer — and the resume asks first.
  await page
    .getByRole("button", { name: "GeoDetective: Resume your case" })
    .click();
  await expect(page.getByTestId("age-picker")).toBeVisible();
  await expect(page.getByTestId("loop-screen")).toHaveCount(0);
  await answerAsk(page, 1); // Ages 10-18
  // The same mystery resumes — the store's current case is
  // unchanged, not a fresh deal.
  await expect(page.getByTestId("loop-screen")).toBeVisible({ timeout: 30_000 });
  expect(await readLoopCurrent(page)).toEqual(dealt);
  expect(await readProfileBand(page)).toBe("10-18");
  expect(errors).toEqual([]);
});

test("band set: no ask on the Why Learn path or on resume", async ({
  page,
  context,
}) => {
  await setup(context);
  await seedBand(context, "7-10");
  const errors = watchErrors(page);
  await page.goto(APP_URL);
  await tapWhyLearn(page);
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  await expect(page.getByTestId("age-picker")).toHaveCount(0);
  await expect(page.getByTestId("subject-picker")).toContainText("Ages 7-10");
  await page.getByTestId("subject-row-math").click();
  await expect(page.getByTestId("math-case")).toBeVisible();
  await expect(page.getByTestId("age-picker")).toHaveCount(0);
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page.getByTestId("home-heading")).toBeVisible();
  const dealt = await dealMystery(page);
  await page
    .getByRole("button", { name: "GeoDetective: Resume your case" })
    .click();
  await expect(page.getByTestId("loop-screen")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("age-picker")).toHaveCount(0);
  expect(await readLoopCurrent(page)).toEqual(dealt);
  expect(errors).toEqual([]);
});

test("backing out of the ask writes nothing and starts nothing", async ({
  page,
  context,
}) => {
  await setup(context);
  const errors = watchErrors(page);
  await page.goto(APP_URL);
  await tapWhyLearn(page);
  await expect(page.getByTestId("age-picker")).toBeVisible();
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page.getByTestId("age-picker")).toHaveCount(0);
  await expect(page.getByTestId("subject-picker")).toHaveCount(0);
  await expect(page.getByTestId("home-card-why-learn")).toBeVisible();
  expect(await readProfileBand(page)).toBeNull();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), PROFILE_KEY),
  ).toBeNull();
  expect(errors).toEqual([]);
});
