import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Subject picker — the "Why Do We Learn This?" card's screen.
 *
 * The card is live for everyone (subjects launch, Nov 13): no
 * ?scale=1 needed. The picker lists the released subjects as ready
 * rows and everything not built yet as disabled "Coming soon" rows
 * (all six subjects are released today, Journals included).
 * Picking a ready row opens that subject's case; the case's
 * "Meridian home" (brand) control returns to Home. Per-band "Coming soon" for a released
 * subject is covered by the picker-rows unit tests; no shipped
 * subject currently lacks a band.
 */
test.setTimeout(120_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";
const PROFILE_KEY = "meridian.ageProfile.v1";
const PROGRESS_KEY = "meridian.subject-progress.v1";

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

test("picker lists Math and Journals ready for 10-18", async ({ page, context }) => {
  await setup(context, "10-18");
  const errors = watchErrors(page);
  await openPicker(page);
  const picker = page.getByTestId("subject-picker");
  await expect(picker).toHaveAttribute("data-band", "10-18");
  const math = page.getByTestId("subject-row-math");
  await expect(math).toBeEnabled();
  await expect(math).toContainText("Math");
  // The 10-18 dealing counts every math unit for the band
  // (pickerRows over the registry units): 28 today. This pin
  // read "3 cases" from the first playable slice and was stale
  // on main — it failed there too (measured on unmodified main,
  // 2026-11-18: the card shows "28 cases"). Corrected to the
  // app's actual dealing; the count is the assertion.
  await expect(math).toContainText("28 cases");
  // Journals (Stream D, PR D1) is playable: 7 cases for 10-18.
  const journals = page.getByTestId("subject-row-journals");
  await expect(journals).toBeEnabled();
  await expect(journals).toContainText("Journals");
  await expect(journals).toContainText("7 cases");
  expect(errors).toEqual([]);
});

test("picking Math opens the math case, and its Meridian home control returns Home", async ({
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
  await mathCase.getByRole("button", { name: "Meridian home", exact: true }).click();
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

// The per-card Reset renders through the shared Button's pill
// size: its face must stay the approved mock's size (measured on
// the pre-Button build, 2026-11-18: 52.5 x 26 px at both widths)
// while its tap target — the visible pill plus the Button's
// invisible expanded hit zone — reaches the 44px floor both ways.
for (const vp of [
  { name: "1280px", width: 1280, height: 800 },
  { name: "390px", width: 390, height: 844 },
]) {
  test(`Reset pill at ${vp.name}: mock-size face, 44px hit zone`, async ({ page, context }) => {
    await setup(context, "10-18");
    // Seed one solved Math unit so the Reset is enabled (a live
    // tap target is what the 44px floor governs).
    await context.addInitScript(
      ({ key }) => {
        window.localStorage.setItem(key, JSON.stringify({ math: ["seeded-unit"] }));
      },
      { key: PROGRESS_KEY },
    );
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const errors = watchErrors(page);
    await openPicker(page);
    const reset = page.getByTestId("subject-reset-math");
    await expect(reset).toBeEnabled();
    await reset.scrollIntoViewIfNeeded();
    const box = await reset.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs(box!.width - 52.5)).toBeLessThanOrEqual(2);
    expect(Math.abs(box!.height - 26)).toBeLessThanOrEqual(2);
    // Walk out from the pill's centre one pixel at a time: every
    // point that still lands on the Reset (its hit zone included)
    // counts toward the tap target's true size.
    const hit = await reset.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const scan = (dx: number, dy: number) => {
        let n = 0;
        while (
          n < 80 &&
          document.elementFromPoint(cx + dx * (n + 1), cy + dy * (n + 1)) === el
        ) {
          n++;
        }
        return n;
      };
      return { w: scan(-1, 0) + scan(1, 0) + 1, h: scan(0, -1) + scan(0, 1) + 1 };
    });
    expect(hit.w).toBeGreaterThanOrEqual(44);
    expect(hit.h).toBeGreaterThanOrEqual(44);
    expect(errors).toEqual([]);
  });
}
