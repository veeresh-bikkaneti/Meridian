import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Ask first (fix/ask-age-first, owner decision 2026-11-14):
 * a player with NO age band set is asked to pick one before any
 * case starts — never silently defaulted to 10-18.
 *
 * Amendment (Radhae's reconciliation design, voice call
 * 2026-11-15): the Why Learn workflow asks on the picker page
 * itself — the page shows the three band pills while no band is
 * set, and a subject tap in that state goes to the pills instead
 * of opening a case; once a band is set the pills collapse to a
 * "Change band" option, which re-opens them (graduation). The
 * modal ask remains only where a case can start without the
 * page:
 *
 * - "Resume your case" (Home's GeoDetective card in its resume
 *   mode) asks first; the pick resumes the same mystery.
 * - A player who already has a band set sees no ask anywhere.
 * - Backing out of the resume ask ("Not now") writes nothing
 *   and starts nothing.
 *
 * The modal picker under test is prod's own AgePicker (the
 * settings flow's component), hosted by AgeAskGate: card order
 * is the band table's — 0 = 7-10, 1 = 10-18, 2 = 18+. The page
 * pills are AgeBandControl's, labelled from the same table.
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
  await page.getByRole("button", { name: "Meridian home", exact: true }).click();
  await expect(page.getByTestId("home-heading")).toBeVisible();
  return dealt;
}

test("no band: the picker page asks with its pills, then the case lands at the picked band", async ({
  page,
  context,
}) => {
  await setup(context);
  const errors = watchErrors(page);
  await page.goto(APP_URL);
  await tapWhyLearn(page);
  // The page itself asks: the picker opens directly — no modal —
  // with the three band pills showing and no Change band yet.
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  await expect(page.getByTestId("age-picker")).toHaveCount(0);
  await expect(page.getByTestId("band-pills")).toBeVisible();
  await expect(page.getByTestId("band-pill-7-10")).toBeVisible();
  await expect(page.getByTestId("band-pill-10-18")).toBeVisible();
  await expect(page.getByTestId("band-pill-18+")).toBeVisible();
  await expect(page.getByTestId("change-band-button")).toHaveCount(0);
  // A subject tap with no band set starts no case: it takes the
  // player to the pills (the first pill takes focus).
  await page.getByTestId("subject-row-math").click();
  await expect(page.getByTestId("math-case")).toHaveCount(0);
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  await expect(page.getByTestId("band-pill-7-10")).toBeFocused();
  expect(await readProfileBand(page)).toBeNull();
  // The pick writes the band, the pills collapse to Change band,
  // and the list re-deals at the picked band.
  await page.getByTestId("band-pill-7-10").click();
  expect(await readProfileBand(page)).toBe("7-10");
  await expect(page.getByTestId("band-pills")).toHaveCount(0);
  await expect(page.getByTestId("change-band-button")).toBeVisible();
  await expect(page.getByTestId("subject-picker")).toContainText("Ages 7-10");
  // …and now the subject card lands on its case, at 7-10.
  await page.getByTestId("subject-row-math").click();
  await expect(page.getByTestId("math-case")).toBeVisible();
  await expect(page.getByTestId("math-answer-card")).toBeVisible();
  await expect(page.getByText("Ages 7-10").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("band set: Change band re-opens the pills and graduates the player", async ({
  page,
  context,
}) => {
  await setup(context);
  await seedBand(context, "7-10");
  const errors = watchErrors(page);
  await page.goto(APP_URL);
  await tapWhyLearn(page);
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  // Set state: no pills — the Change band option instead.
  await expect(page.getByTestId("band-pills")).toHaveCount(0);
  await expect(page.getByTestId("change-band-button")).toBeVisible();
  // Change band re-opens the pills, the current band marked.
  await page.getByTestId("change-band-button").click();
  await expect(page.getByTestId("band-pills")).toBeVisible();
  await expect(page.getByTestId("band-pill-7-10")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("band-pill-18+")).toHaveAttribute("aria-pressed", "false");
  // Graduating writes the new band and re-deals in place.
  await page.getByTestId("band-pill-18+").click();
  expect(await readProfileBand(page)).toBe("18+");
  await expect(page.getByTestId("band-pills")).toHaveCount(0);
  await expect(page.getByTestId("change-band-button")).toBeVisible();
  await expect(page.getByTestId("subject-picker")).toContainText("Ages 18+");
  await page.getByTestId("subject-row-math").click();
  await expect(page.getByTestId("math-case")).toBeVisible();
  await expect(page.getByText("Ages 18+").first()).toBeVisible();
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
  // The page's set state: the Change band option, no pills.
  await expect(page.getByTestId("change-band-button")).toBeVisible();
  await expect(page.getByTestId("band-pills")).toHaveCount(0);
  await expect(page.getByTestId("subject-picker")).toContainText("Ages 7-10");
  await page.getByTestId("subject-row-math").click();
  await expect(page.getByTestId("math-case")).toBeVisible();
  await expect(page.getByTestId("age-picker")).toHaveCount(0);
  await page.getByRole("button", { name: "Meridian home", exact: true }).click();
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

test("backing out of the resume ask writes nothing and starts nothing", async ({
  page,
  context,
}) => {
  await setup(context);
  const errors = watchErrors(page);
  await page.goto(APP_URL);
  // Deal a mystery while unset (a fresh deal is not gated), then
  // back out of the resume ask: the mystery stays mid-play, no
  // band is written, nothing resumes.
  const dealt = await dealMystery(page);
  await page
    .getByRole("button", { name: "GeoDetective: Resume your case" })
    .click();
  await expect(page.getByTestId("age-picker")).toBeVisible();
  // Scoped to the ask: Home's tutorial invite (inert behind the
  // overlay) carries its own "Not now".
  await page.getByTestId("age-picker").getByRole("button", { name: "Not now" }).click();
  await expect(page.getByTestId("age-picker")).toHaveCount(0);
  await expect(page.getByTestId("loop-screen")).toHaveCount(0);
  await expect(page.getByTestId("home-card-why-learn")).toBeVisible();
  expect(await readLoopCurrent(page)).toEqual(dealt);
  expect(await readProfileBand(page)).toBeNull();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), PROFILE_KEY),
  ).toBeNull();
  expect(errors).toEqual([]);
});
