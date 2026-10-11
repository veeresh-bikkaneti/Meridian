import { test, expect } from "playwright/test";
import type { Page } from "playwright/test";
import {
  serveBuiltArtifact,
  APP_NO_IDLE,
  commitPin,
  readPhase,
  resultCard,
  clickNextPlace,
  dismissTileOverlayIfPresent,
  spotViewportPoint,
  tapHitsMap,
} from "./helpers";

/**
 * Black-box verification for the distance-units fix
 * (branch fix/distance-units-locale, owner ruling 2026-10-11:
 * "one unit per result — USA reads miles everywhere, rest of world km").
 *
 * Asserts what the player SEES at 390×844 (mobile project):
 *  - Journey A: a Nebraska (state edition) miss — the result headline
 *    ("N mi <wind> of your pin") and the gold-line map pill read MILES
 *    with the SAME number (the reported bug: headline "256 mi" + pill
 *    "411 km" for the same distance).
 *  - Journey B: a France (country edition) miss — headline and pill read
 *    KILOMETERS with the same number.
 *  - Both journeys: the sr-only aria-live announcement speaks the run's
 *    unit too.
 *  - Red-team: the end-of-game summary card reads miles only for an
 *    all-USA session and kilometers for a mixed session.
 */

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

async function expectRunStarted(page: Page): Promise<void> {
  await dismissTileOverlayIfPresent(page);
  await expect(page.locator(".satellite-map")).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
}

async function startNebraska(page: Page): Promise<void> {
  await page.goto(APP_NO_IDLE);
  await page.getByRole("button", { name: "Choose a country" }).click();
  await page.getByRole("button", { name: "United States" }).click();
  await page.getByRole("button", { name: "Nebraska" }).click();
  await expectRunStarted(page);
}

async function startFrance(page: Page): Promise<void> {
  await page.goto(APP_NO_IDLE);
  await page.getByRole("button", { name: "Choose a country" }).click();
  await page.getByRole("button", { name: "France" }).click();
  await expectRunStarted(page);
}

/**
 * Commit a guaranteed miss on the 390×844 mobile viewport: tap the map
 * corner farthest from the true spot (the desktop helper's (500, 400) is
 * off-screen here). The farthest corner is ≥ half the region diagonal from
 * any spot — well outside the hit radius (Nebraska ~89 km, France ~138 km).
 */
async function commitCornerMiss(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const spot = await spotViewportPoint(page);
    const box = await page.locator(".satellite-map").boundingBox();
    const corners = box
      ? [
          { x: box.x + 30, y: box.y + 60 },
          { x: box.x + box.width - 30, y: box.y + 60 },
          { x: box.x + 30, y: box.y + box.height - 60 },
          { x: box.x + box.width - 30, y: box.y + box.height - 60 },
        ]
      : [];
    let best: { x: number; y: number } | null = null;
    let bestD = -1;
    for (const c of corners) {
      if (!(await tapHitsMap(page, c.x, c.y))) continue;
      const d = spot ? Math.hypot(c.x - spot.x, c.y - spot.y) : 0;
      if (d > bestD) {
        bestD = d;
        best = c;
      }
    }
    if (!best) throw new Error("commitCornerMiss: no tappable map corner");
    const { phase } = await commitPin(page, best.x, best.y);
    if (phase === "done") return;
    // Rare hit: move on and try the next place.
    await clickNextPlace(page);
    await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  }
  throw new Error("commitCornerMiss: hit three places in a row");
}

/** The gold-line map pill: a MapLibre marker whose text is a distance label. */
async function pillText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const els = Array.from(document.querySelectorAll(".maplibregl-marker"));
    for (const el of els) {
      const t = (el.textContent ?? "").trim();
      if (/[\d,]+(\.\d+)?\s*(mi|km|ft|m)\b/.test(t) && !/SCORE/i.test(t)) return t;
    }
    return "";
  });
}

function parseLen(s: string): { n: number; unit: string } | null {
  const m = s.match(/([\d,]+(?:\.\d+)?)\s*(mi|km|ft|m)\b/);
  if (!m) return null;
  return { n: Number(m[1]!.replace(/,/g, "")), unit: m[2]! };
}

async function liveRegionText(page: Page): Promise<string> {
  // Two aria-live regions exist (one empty); read the speaking one.
  const texts = await page
    .locator('p.sr-only[aria-live="polite"]')
    .evaluateAll((els) => els.map((e) => e.textContent ?? ""));
  return texts.find((t) => t.trim().length > 0) ?? "";
}

/** <dt> label → its <dd> value inside the Game summary dialog. */
async function summaryRow(page: Page, label: string): Promise<string> {
  const dialog = page.getByRole("dialog", { name: "Game summary" });
  return dialog.evaluate((dlg, lbl) => {
    const dt = Array.from(dlg.querySelectorAll("dt")).find(
      (d) => (d.textContent ?? "").trim() === lbl,
    );
    return (dt?.nextElementSibling?.textContent ?? "").trim();
  }, label);
}

test("Journey A — Nebraska miss: headline AND map pill both read miles, same value", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await startNebraska(page);
  await commitCornerMiss(page);

  const headline = (await page.getByTestId("miss-headline").textContent()) ?? "";
  const pill = await pillText(page);
  expect(pill, "the gold-line map pill is visible").not.toBe("");

  const h = parseLen(headline);
  const p = parseLen(pill);
  expect(h, `headline parses as a length (got: ${headline!})`).not.toBeNull();
  expect(p, `pill parses as a length (got: ${pill})`).not.toBeNull();
  // USA → miles on BOTH, and the same underlying distance.
  expect(h!.unit).toBe("mi");
  expect(p!.unit).toBe("mi");
  expect(p!.n).toBe(h!.n);

  // No kilometer anywhere on the result card or in the announcement.
  await expect(resultCard(page)).not.toContainText(/[\d,]+\s*km\b/);
  await expect
    .poll(() => liveRegionText(page), { timeout: 15_000 })
    .toMatch(/Pin dropped\./);
  expect(await liveRegionText(page)).toMatch(/\bmi\b/);
  expect(await liveRegionText(page)).not.toMatch(/[\d,]+\s*km\b/);
});

test("Journey B — France miss: headline AND map pill both read kilometers, same value", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await startFrance(page);
  await commitCornerMiss(page);

  const headline = (await page.getByTestId("miss-headline").textContent()) ?? "";
  const pill = await pillText(page);
  expect(pill, "the gold-line map pill is visible").not.toBe("");

  const h = parseLen(headline);
  const p = parseLen(pill);
  expect(h, `headline parses as a length (got: ${headline!})`).not.toBeNull();
  expect(p, `pill parses as a length (got: ${pill})`).not.toBeNull();
  // France → kilometers on BOTH, same underlying distance.
  expect(h!.unit).toBe("km");
  expect(p!.unit).toBe("km");
  expect(p!.n).toBe(h!.n);

  await expect(resultCard(page)).not.toContainText(/[\d,]+(\.\d+)?\s*mi\b/);
  await expect
    .poll(() => liveRegionText(page), { timeout: 15_000 })
    .toMatch(/Pin dropped\./);
  expect(await liveRegionText(page)).toMatch(/[\d,]+\s*km\b/);
});

test("Red-team — mixed USA+France session summary reads kilometers", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await startNebraska(page);
  await commitCornerMiss(page);
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");

  // Switch editions mid-session (no End game) and play France.
  await page.getByRole("button", { name: "Editions" }).click();
  await page.getByRole("button", { name: "Choose a country" }).click();
  await page.getByRole("button", { name: "France" }).click();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  await commitCornerMiss(page);
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");

  await page.getByRole("button", { name: "End game" }).click();
  await expect(page.getByRole("dialog", { name: "Game summary" })).toBeVisible();

  // Mixed session fails closed to kilometers (owner ruling 2026-10-11).
  expect(await summaryRow(page, "Average distance")).toMatch(/km\b/);
  expect(await summaryRow(page, "Average distance")).not.toMatch(/\bmi\b/);
  expect(await summaryRow(page, "Best pin")).toMatch(/km\b/);
});

test("Red-team — all-USA session summary reads miles", async ({ page }) => {
  test.setTimeout(240_000);
  await startNebraska(page);
  await commitCornerMiss(page);
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");

  await page.getByRole("button", { name: "End game" }).click();
  await expect(page.getByRole("dialog", { name: "Game summary" })).toBeVisible();

  // Every played region is a USA context → miles.
  expect(await summaryRow(page, "Average distance")).toMatch(/\bmi\b/);
  expect(await summaryRow(page, "Best pin")).toMatch(/\bmi\b/);
});
