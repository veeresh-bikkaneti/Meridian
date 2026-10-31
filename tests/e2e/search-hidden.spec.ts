import { test, expect, type Browser } from "playwright/test";
import { serveBuiltArtifact, APP_NO_IDLE } from "./helpers";

/**
 * Search-hidden E2E (Wave 1 P0 Item 4H/4I): the dead Search control is
 * removed from home entirely. Even a greyed/disabled Search button, and
 * any screen-reader-announced "Search" control, FAILS this spec. The
 * second half guards against over-deletion: every other home control
 * must still be present and working.
 */

async function openHome(browser: Browser, width: number, height: number) {
  const context = await browser.newContext({
    viewport: { width, height },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  await serveBuiltArtifact(context);
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);
  await expect(page.getByRole("button", { name: "Meridian home" })).toBeVisible();
  return { context, page };
}

async function checkHome(browser: Browser, width: number, height: number) {
  const { context, page } = await openHome(browser, width, height);
  try {
    // No Search control anywhere: no button, no aria-label, no
    // screen-reader "Not yet available" note for Search.
    await expect(page.getByRole("button", { name: "Search" })).toHaveCount(0);
    await expect(page.locator('[aria-label="Search"]')).toHaveCount(0);
    await expect(page.getByText("Not yet available")).toHaveCount(0);

    // No other home control disappeared: all present and enabled.
    await expect(page.getByRole("button", { name: "Meridian home" })).toBeEnabled();
    for (const name of ["EXPEDITIONS", "CASES", "ABOUT", "JOURNAL", "GET INVOLVED", "JOIN THE JOURNEY"]) {
      await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
    }

    // ...and working: each nav jump lands on its section hash.
    const jumps: Array<[string, string]> = [
      ["ABOUT", "#home-about"],
      ["EXPEDITIONS", "#home-editions"],
      ["CASES", "#home-cases"],
      ["JOURNAL", "#home-journal"],
      ["GET INVOLVED", "#home-grownups"],
      ["JOIN THE JOURNEY", "#home-cases"],
    ];
    for (const [name, hash] of jumps) {
      await page.getByRole("button", { name, exact: true }).click();
      await expect.poll(() => page.url(), { timeout: 10_000 }).toContain(hash);
    }
  } finally {
    await context.close();
  }
}

test("home has no Search control anywhere at 360x740, other controls intact", async ({ browser }) => {
  test.setTimeout(180_000);
  await checkHome(browser, 360, 740);
});

test("home has no Search control anywhere at 390x844, other controls intact", async ({ browser }) => {
  test.setTimeout(180_000);
  await checkHome(browser, 390, 844);
});
