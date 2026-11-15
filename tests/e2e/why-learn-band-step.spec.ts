import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Age-band step (feat/why-learn-band-step, owner direction
 * 2026-11-15): the band comes right after the "Why Do We Learn
 * This?" card, so a case takes fewer taps and the band is never
 * silently assumed.
 *
 * - Card tap lands on the band step, not the picker; the step
 *   carries the three bands as AgePicker's own cards, with no Save
 *   or confirm — one tap on a band writes it (through the
 *   age-profile store, the settings flow's own write path) and
 *   advances to the picker at that band: card → band → subject →
 *   case is three taps.
 * - The step is presented on every entry. A stored profile band
 *   shows as the current selection; picking a different band
 *   rewrites the profile and the picker follows.
 * - The step's Home button lands on Home; the picker's grown-ups
 *   entry still opens the gated settings flow, unchanged.
 */

test.setTimeout(120_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";
const PROFILE_KEY = "meridian.ageProfile.v1";

async function setup(context: BrowserContext, band?: "7-10" | "10-18" | "18+") {
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

async function openBandStep(page: Page) {
  await page.goto(APP_URL);
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await card
    .getByRole("button", { name: "Why Do We Learn This?: Start exploring" })
    .click();
  await expect(page.getByTestId("subject-band-step")).toBeVisible();
}

async function storedBand(page: Page): Promise<string | null> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw).band as string) : null;
  }, PROFILE_KEY);
}

test("card tap lands on the band step; one band tap reaches the picker at that band and writes it", async ({
  page,
  context,
}) => {
  await setup(context);
  const errors = watchErrors(page);
  await openBandStep(page);
  // The picker is NOT what the card opens any more.
  await expect(page.getByTestId("subject-picker")).toHaveCount(0);
  // All three bands, as cards; an unset profile checks none of them.
  await expect(page.getByTestId("band-step-card-7-10")).toBeVisible();
  await expect(page.getByTestId("band-step-card-10-18")).toBeVisible();
  await expect(page.getByTestId("band-step-card-18+")).toBeVisible();
  await expect(page.locator('[data-testid^="band-step-card-"].agep-card-checked')).toHaveCount(0);
  expect(await storedBand(page)).toBeNull();

  // One tap on a band: the picker opens at that band, the profile
  // carries it, and the first case is dealt for it.
  await page.getByTestId("band-step-card-7-10").click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  await expect(page.getByTestId("subject-picker")).toHaveAttribute("data-band", "7-10");
  expect(await storedBand(page)).toBe("7-10");
  await page.getByTestId("subject-row-math").click();
  await expect(page.getByTestId("math-case")).toBeVisible();
  await expect(page.getByTestId("math-case")).toHaveAttribute("data-band", "7-10");
  expect(errors).toEqual([]);
});

test("a stored band shows as the current selection; picking another rewrites it", async ({
  page,
  context,
}) => {
  await setup(context, "10-18");
  const errors = watchErrors(page);
  await openBandStep(page);
  // The step is presented even with a stored profile, its band checked.
  await expect(page.getByTestId("band-step-card-10-18")).toHaveClass(/agep-card-checked/);
  await page.getByTestId("band-step-card-18+").click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  await expect(page.getByTestId("subject-picker")).toHaveAttribute("data-band", "18+");
  expect(await storedBand(page)).toBe("18+");
  expect(errors).toEqual([]);
});

test("the step's Home button lands on Home, and re-entry asks again", async ({
  page,
  context,
}) => {
  await setup(context);
  const errors = watchErrors(page);
  await openBandStep(page);
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page.getByTestId("home-card-why-learn")).toBeVisible();
  await expect(page.getByTestId("subject-band-step")).toHaveCount(0);
  // Re-entering the flow presents the step again (no silent skip).
  await openBandStep(page);
  expect(errors).toEqual([]);
});

test("the picker's grown-ups entry still opens the gated settings flow", async ({
  page,
  context,
}) => {
  await setup(context);
  const errors = watchErrors(page);
  await openBandStep(page);
  await page.getByTestId("band-step-card-10-18").click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  await page.getByTestId("grownups-link").click();
  await expect(page.getByTestId("grownup-gate")).toBeVisible();
  await page.getByRole("button", { name: "Cancel and go back" }).click();
  await expect(page.getByTestId("grownup-gate")).toHaveCount(0);
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  expect(errors).toEqual([]);
});
