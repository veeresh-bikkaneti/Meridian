import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import { fulfillFlagsOn } from "./detective-u10";

/**
 * Home layout + one Home control (nav-home council, 2026-11-13).
 *
 * Mistake class M3 (docs/reviews/2026-11-13-nav-home-council/pack.md §5):
 * cards were added to fixed-column home grids and left orphans (#242
 * deferred the 768 orphan; #433 put a third card in a 2-column grid; the
 * deck-off placeholder held a slot open). A lint cannot see geometry, so
 * this spec measures it at the six council viewports:
 *
 * - every row of both home grids is full (no empty cell), and the two
 *   rows share one column count when they hold the same number of cards;
 * - cards in one row have one height;
 * - with Review off (2 spot cards) the spot row is 2 full columns;
 * - on Home's destinations (Why Learn picker, Country list, Cold Trail,
 *   GeoDetective, /credits) the home control is named exactly "Home",
 *   is at least 44×44, and none of the old names is left.
 *
 * Runs on the built artifact like the rest of tests/e2e; it reads layout
 * only, so it needs no map interaction. The owner's playtest (real globe,
 * 390×844 and 1280×800) is separate and still required before a merge.
 */
test.setTimeout(240_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";
const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
];

async function setup(context: BrowserContext, deck: boolean) {
  await serveBuiltArtifact(context);
  await context.route("**/flags.json", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ version: 1, flags: { learningOutcomes: deck, pwaUpdateToast: true } }),
    }),
  );
}

type GridReport = { cols: number; rows: { n: number; spread: number }[] };

async function measureGrids(page: Page): Promise<Record<string, GridReport>> {
  return page.evaluate(() => {
    const out: Record<string, { cols: number; rows: { n: number; spread: number }[] }> = {};
    for (const sel of [".hv5-grid2", ".hv5-grid3"]) {
      const g = document.querySelector(sel);
      if (!g) continue;
      const cols = getComputedStyle(g).gridTemplateColumns.split(" ").filter(Boolean).length;
      const byTop = new Map<number, number[]>();
      for (const c of Array.from(g.children)) {
        const b = c.getBoundingClientRect();
        if (b.width === 0 && b.height === 0) continue;
        const top = Math.round(b.top);
        byTop.set(top, [...(byTop.get(top) ?? []), b.height]);
      }
      out[sel] = {
        cols,
        rows: [...byTop.values()].map((hs) => ({ n: hs.length, spread: Math.max(...hs) - Math.min(...hs) })),
      };
    }
    return out;
  });
}

function expectFullRows(label: string, g: GridReport | undefined, expectedCards: number) {
  expect(g, `${label}: grid present`).toBeTruthy();
  const cards = g!.rows.reduce((a, r) => a + r.n, 0);
  expect(cards, `${label}: card count`).toBe(expectedCards);
  for (const [i, r] of g!.rows.entries()) {
    expect(r.n, `${label}: row ${i + 1} has an empty cell (${r.n} cards in ${g!.cols} columns)`).toBe(g!.cols);
    expect(r.spread, `${label}: row ${i + 1} card heights differ by ${r.spread.toFixed(1)}px`).toBeLessThanOrEqual(1);
  }
}

async function expectHomeControl(page: Page, label: string, role: "button" | "link" = "button") {
  const home = page.getByRole(role, { name: "Home", exact: true }).first();
  await expect(home, `${label}: a ${role} named exactly Home`).toBeVisible({ timeout: 30_000 });
  const box = await home.boundingBox();
  expect(box, `${label}: Home box`).not.toBeNull();
  expect(box!.width, `${label}: Home width ${box!.width}`).toBeGreaterThanOrEqual(44);
  expect(box!.height, `${label}: Home height ${box!.height}`).toBeGreaterThanOrEqual(44);
  const names = await page
    .locator("button:visible, a:visible")
    .evaluateAll((els) => els.map((e) => (e.getAttribute("aria-label") ?? e.textContent ?? "").trim()));
  const leftovers = names.filter((n) => /^\s*(←\s*)?(Editions|Back to editions|Back to Home|All games|Back to the game)\s*$/.test(n));
  expect(leftovers, `${label}: old home names left`).toEqual([]);
}

for (const vp of VIEWPORTS) {
  const tag = `${vp.width}x${vp.height}`;

  test(`home grids are full and even at ${tag} (Review on and off)`, async ({ browser }) => {
    for (const deck of [true, false]) {
      const context = await browser.newContext({ viewport: vp, serviceWorkers: "block" });
      await setup(context, deck);
      const page = await context.newPage();
      await page.goto(APP_URL);
      await expect(page.getByTestId("home-card-why-learn")).toBeVisible({ timeout: 30_000 });
      if (deck) await expect(page.getByTestId("tour-stop-review")).toBeVisible({ timeout: 15_000 });
      const grids = await measureGrids(page);
      const lbl = `${tag} review ${deck ? "on" : "off"}`;
      expectFullRows(`${lbl} game cards`, grids[".hv5-grid2"], 3);
      expectFullRows(`${lbl} spot cards`, grids[".hv5-grid3"], deck ? 3 : 2);
      if (deck) {
        expect(grids[".hv5-grid3"].cols, `${lbl}: both rows share one column count`).toBe(grids[".hv5-grid2"].cols);
      }
      await context.close();
    }
  });

  test(`every home control is one 44px "Home" at ${tag}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: vp, serviceWorkers: "block" });
    await setup(context, true);
    const page = await context.newPage();

    await page.goto(APP_URL);
    await page.getByRole("button", { name: "Why Do We Learn This?: Start exploring" }).click();
    await expect(page.getByTestId("subject-picker")).toBeVisible();
    await expectHomeControl(page, `${tag} Why Learn`);
    await page.getByRole("button", { name: "Home", exact: true }).click();

    await page.getByRole("button", { name: "Choose a country" }).click();
    await expect(page.getByRole("heading", { name: "Country" })).toBeVisible();
    await expectHomeControl(page, `${tag} Country list`);
    await page.getByRole("button", { name: "Home", exact: true }).click();

    await page.getByRole("button", { name: "Cold Trail: Start the trail" }).click();
    await expect(page.getByTestId("coldtrail-screen")).toBeVisible({ timeout: 30_000 });
    await expectHomeControl(page, `${tag} Cold Trail`);
    await page.getByRole("button", { name: "Home", exact: true }).click();

    await page.getByRole("button", { name: "GeoDetective: Solve a mystery" }).click();
    await expect(page.getByTestId("end-game-button")).toBeVisible({ timeout: 45_000 });
    await expectHomeControl(page, `${tag} GeoDetective`);

    // The harness serves only the root path; reach /credits the way a
    // player does, through the footer link (credits.desktop.spec.ts).
    await page.goto(APP_URL);
    await page.getByTestId("credits-link").click();
    await expect(page).toHaveURL(/\/credits$/);
    await expectHomeControl(page, `${tag} /credits`, "link");
    await context.close();
  });
}

async function expectHomeFullyInViewport(page: Page, label: string) {
  const home = page.getByTestId("home-button");
  await expect(home, `${label}: Home present`).toBeVisible({ timeout: 45_000 });
  const box = await home.evaluate((el) => {
    const b = el.getBoundingClientRect();
    return { top: b.top, left: b.left, bottom: b.bottom, right: b.right, iw: innerWidth, ih: innerHeight };
  });
  expect(box.top, `${label}: Home top ${box.top.toFixed(1)} is above the viewport`).toBeGreaterThanOrEqual(0);
  expect(box.left, `${label}: Home left ${box.left.toFixed(1)} is left of the viewport`).toBeGreaterThanOrEqual(0);
  expect(box.bottom, `${label}: Home bottom ${box.bottom.toFixed(1)} is below the viewport (${box.ih})`).toBeLessThanOrEqual(box.ih);
  expect(box.right, `${label}: Home right ${box.right.toFixed(1)} is past the viewport (${box.iw})`).toBeLessThanOrEqual(box.iw);
}

async function expectClickHomeLandsOnHome(page: Page, label: string) {
  await page.getByTestId("home-button").click();
  await expect(page.getByTestId("home-card-why-learn"), `${label}: click Home returns to Home`).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Playtest item 2 (PR #459): after a screen opens, Home must be fully
 * inside the viewport and clickable — Playwright's toBeVisible() does
 * not require that (the GeoDetective case-open scroll left Home at
 * y ≈ -551 while still "visible"). Also, after the player scrolls a
 * subject screen, sticky Home must stay on screen.
 */
for (const vp of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`Home stays in the viewport on globe, a case, Why Learn and a subject at ${vp.width}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: vp, serviceWorkers: "block" });
    await serveBuiltArtifact(context);
    await fulfillFlagsOn(context);
    await context.addInitScript(() => {
      window.localStorage.setItem(
        "meridian.ageProfile.v1",
        JSON.stringify({
          status: "active",
          band: "7-10",
          updatedAt: new Date().toISOString(),
          changeCount: 0,
          schemaVersion: 2,
        }),
      );
    });
    const page = await context.newPage();
    const tag = `${vp.width}x${vp.height}`;

    await page.goto(APP_URL);
    await expect(page.getByTestId("home-card-why-learn")).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Why Do We Learn This?: Start exploring" }).click();
    await expect(page.getByTestId("subject-picker")).toBeVisible();
    await expect(page.getByTestId("subject-row-math")).toBeVisible({ timeout: 30_000 });
    await expectHomeFullyInViewport(page, `${tag} Why Learn`);
    await expectClickHomeLandsOnHome(page, `${tag} Why Learn`);

    await page.getByRole("button", { name: "Why Do We Learn This?: Start exploring" }).click();
    await expect(page.getByTestId("subject-row-math")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("subject-row-math").click();
    await expect(page.getByRole("heading", { name: /Math/ })).toBeVisible({ timeout: 30_000 });
    await expectHomeFullyInViewport(page, `${tag} subject`);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expectHomeFullyInViewport(page, `${tag} subject scrolled to the bottom`);
    await expectClickHomeLandsOnHome(page, `${tag} subject`);

    await page.getByRole("button", { name: "GeoDetective: Solve a mystery" }).click();
    await expect(page.getByTestId("end-game-button")).toBeVisible({ timeout: 45_000 });
    // The case-open reading scroll (DetectiveHost, #358) is what parked
    // Home above the viewport; wait until the clue is on screen and the
    // window has stopped moving, then measure.
    await expect(page.getByRole("article", { name: /^Clue 1:/ })).toBeVisible({ timeout: 45_000 });
    // Prod has detectivePair on; the case-open reading scroll then
    // moves the window (scrollY was 583 at 1280 on bb31ef95). Wait
    // for that move, then for it to settle, before measuring Home.
    await page.waitForFunction(() => window.scrollY > 100, null, { timeout: 15_000 });
    await page.waitForFunction(
      () => {
        const y = window.scrollY;
        return new Promise((resolve) => {
          window.setTimeout(() => resolve(Math.abs(window.scrollY - y) < 1), 500);
        });
      },
      null,
      { timeout: 15_000 },
    );
    await expectHomeFullyInViewport(page, `${tag} GeoDetective case`);
    await expectClickHomeLandsOnHome(page, `${tag} GeoDetective case`);

    await page.getByRole("button", { name: "Play the globe" }).click();
    await expect(page.getByTestId("home-button")).toBeVisible({ timeout: 45_000 });
    await expectHomeFullyInViewport(page, `${tag} globe`);
    await expectClickHomeLandsOnHome(page, `${tag} globe`);

    await context.close();
  });
}
