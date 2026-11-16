import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Subject case navigation (fix/case-navigation, owner reports
 * 2026-11-14): the Why Learn flow's chrome.
 *
 * - A reload inside a case lands on Home, never back inside the case
 *   (the tap-in screens are session-only; boot always lands Home).
 * - The case screen carries the game's own controls in its header
 *   bar: "Meridian home" (the brand home control), then End game
 *   (GameApp's handleEndGame — ending the
 *   session leaves the case for Home), and the game's "Start over"
 *   reset in a separated footer.
 * - The picker footer carries the reset plus Home's grown-ups entry:
 *   the gate opens, and cancelling returns to the picker untouched.
 * - Amendment (owner decision, 2026-11-14): while a GeoDetective
 *   mystery is mid-play, the picker and the case carry "Resume your
 *   case" — Home's own card offer, wired to GameApp's GeoDetective
 *   tap-in. It is absent when nothing is resumable, and tapping it
 *   reopens the same mystery (the loop store's current case), with
 *   the subjects closed behind it so the loop's leave lands Home.
 */

test.setTimeout(120_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";

async function setup(context: BrowserContext) {
  await serveBuiltArtifact(context);
  await context.route("**/flags.json", (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ version: 1, flags: { pwaUpdateToast: true } }),
      contentType: "application/json; charset=utf-8",
    }),
  );
  // These specs cover the navigation chrome, not the age ask.
  // Since fix/ask-age-first, a player with no band set is asked
  // before the picker opens — so seed the band a returning player
  // would already have (the ask itself is covered by
  // ask-age-first.spec.ts).
  await context.addInitScript(() => {
    window.localStorage.setItem(
      "meridian.ageProfile.v1",
      JSON.stringify({
        status: "active",
        band: "10-18",
        updatedAt: new Date().toISOString(),
        changeCount: 0,
        schemaVersion: 2,
      }),
    );
  });
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

async function openCase(page: Page) {
  await openPicker(page);
  await page.getByTestId("subject-row-math").click();
  await expect(page.getByTestId("math-case")).toBeVisible();
  await expect(page.getByTestId("math-answer-card")).toBeVisible();
}

test("a reload inside a case lands on Home, not back in the case", async ({
  page,
  context,
}) => {
  await setup(context);
  const errors = watchErrors(page);
  await openCase(page);
  await page.reload();
  await expect(page.getByTestId("home-card-why-learn")).toBeVisible();
  await expect(page.getByTestId("math-case")).toHaveCount(0);
  await expect(page.getByTestId("subject-picker")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the case screen carries End game and Start over; End game lands Home", async ({
  page,
  context,
}) => {
  await setup(context);
  const errors = watchErrors(page);
  await openCase(page);
  await expect(page.getByTestId("end-game-button")).toBeVisible();
  await expect(page.getByTestId("reset-history-open")).toBeVisible();
  await page.getByTestId("end-game-button").click();
  await expect(page.getByTestId("home-card-why-learn")).toBeVisible();
  await expect(page.getByTestId("math-case")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Resume your case: offered only with a mystery mid-play, and it reopens that mystery", async ({
  page,
  context,
}) => {
  await setup(context);
  const errors = watchErrors(page);
  // No mystery yet: neither the picker nor a case offers resume.
  await openCase(page);
  await expect(page.getByTestId("resume-case-button")).toHaveCount(0);
  await page.getByRole("button", { name: "Meridian home", exact: true }).click();
  await expect(page.getByTestId("home-heading")).toBeVisible();

  // Deal a mystery from Home's GeoDetective card, then leave it
  // mid-play (the loop store keeps it, status "playing").
  await page
    .getByRole("button", { name: "GeoDetective: Solve a mystery" })
    .click();
  await expect(page.getByTestId("loop-screen")).toBeVisible({ timeout: 30_000 });
  const dealt = await page.evaluate(() => {
    const raw = localStorage.getItem("meridian.loop.v2");
    const store = raw ? JSON.parse(raw) : null;
    return store?.current
      ? { index: store.current.index, status: store.current.status }
      : null;
  });
  expect(dealt?.status).toBe("playing");
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page.getByTestId("home-heading")).toBeVisible();

  // The picker and the case now offer the resume, on Home's terms.
  await openPicker(page);
  await expect(page.getByTestId("resume-case-button")).toBeVisible();
  await page.getByTestId("subject-row-math").click();
  await expect(page.getByTestId("math-case")).toBeVisible();
  await page.getByTestId("resume-case-button").click();

  // The same mystery reopens — the store's current case is
  // unchanged, not a fresh deal — and leaving it lands on Home
  // (the subjects closed behind the resume).
  await expect(page.getByTestId("loop-screen")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("math-case")).toHaveCount(0);
  const resumed = await page.evaluate(() => {
    const raw = localStorage.getItem("meridian.loop.v2");
    const store = raw ? JSON.parse(raw) : null;
    return store?.current
      ? { index: store.current.index, status: store.current.status }
      : null;
  });
  expect(resumed).toEqual(dealt);
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page.getByTestId("home-heading")).toBeVisible();
  await expect(page.getByTestId("subject-picker")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the picker footer carries the reset and the grown-ups age entry", async ({
  page,
  context,
}) => {
  await setup(context);
  const errors = watchErrors(page);
  await openPicker(page);
  // The reset opens the game's own confirm dialog; cancelling is a
  // no-change close back to the picker.
  await expect(page.getByTestId("reset-history-open")).toBeVisible();
  await page.getByTestId("reset-history-open").click();
  await expect(page.getByTestId("reset-history-confirm")).toBeVisible();
  await page.getByTestId("reset-history-cancel").click();
  await expect(page.getByTestId("reset-history-confirm")).toHaveCount(0);
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  // The grown-ups entry opens the age-profile gate; cancelling
  // returns to the picker with the band untouched.
  await expect(page.getByTestId("grownups-link")).toBeVisible();
  await page.getByTestId("grownups-link").click();
  await expect(page.getByTestId("grownup-gate")).toBeVisible();
  await page.getByRole("button", { name: "Cancel and go back" }).click();
  await expect(page.getByTestId("grownup-gate")).toHaveCount(0);
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  await expect(page.getByTestId("subject-picker")).toContainText("Ages 10-18");
  expect(errors).toEqual([]);
});
