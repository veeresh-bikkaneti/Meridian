import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * "Why Do We Learn This?" Home card (scale-play) — flag gate only.
 *
 * The card ships dark behind the scalePlay flag. Without `?scale=1` Home
 * is today's Home (no card); with it, the card renders in #home-cases
 * right after GeoDetective, with its band film slot and its CTA.
 * flags.json is pinned so a live remote value can't turn it on.
 */
test.setTimeout(120_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  await context.route("**/flags.json", (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ version: 1, flags: { pwaUpdateToast: true } }),
      contentType: "application/json; charset=utf-8",
    }),
  );
});

test("card is absent without ?scale=1", async ({ page }) => {
  await page.goto(APP_URL);
  await expect(page.getByTestId("tour-stop-geodetective")).toBeVisible();
  await expect(page.getByTestId("home-card-why-learn")).toHaveCount(0);
  await expect(page.getByTestId("card-film-why-learn")).toHaveCount(0);
});

test("card is present with ?scale=1, right after GeoDetective", async ({ page }) => {
  await page.goto(`${APP_URL}&scale=1`);
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await expect(card.getByRole("heading", { name: /Why Do We Learn This\?/ })).toBeVisible();
  await expect(card.getByText("Case file · Why it matters")).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Why Do We Learn This?: Start exploring" }),
  ).toBeVisible();
  await expect(card.getByTestId("card-film-why-learn")).toHaveCount(1);
  const order = await page
    .locator("#home-cases > article")
    .evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-testid") ?? el.getAttribute("aria-labelledby")),
    );
  const geo = order.indexOf("tour-stop-geodetective");
  expect(geo).toBeGreaterThanOrEqual(0);
  expect(order[geo + 1]).toBe("home-card-why-learn");
});

// ── Layout proof + screenshots (Home with ?scale=1) ──
// Saved under why-learn-shots/ (outside test-results, which Playwright clears per run) so CI can upload them.

type Box = { x: number; y: number; width: number; height: number };
const SHOTS = "why-learn-shots";

function overlaps(a: Box, b: Box): boolean {
  const eps = 0.5;
  return (
    a.x + eps < b.x + b.width - eps &&
    b.x + eps < a.x + a.width - eps &&
    a.y + eps < b.y + b.height - eps &&
    b.y + eps < a.y + a.height - eps
  );
}

async function caseBoxes(page: import("playwright/test").Page) {
  return page.locator("#home-cases > article").evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        id: el.getAttribute("data-testid") ?? el.getAttribute("aria-labelledby") ?? "?",
        box: { x: r.x, y: r.y + window.scrollY, width: r.width, height: r.height },
      };
    }),
  );
}

for (const vp of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "390", width: 390, height: 844 },
]) {
  test(`?scale=1 layout at ${vp.name}: in line with GeoDetective, no overlap, film frame`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`${APP_URL}&scale=1`);
    const card = page.getByTestId("home-card-why-learn");
    await expect(card).toBeVisible();
    await card.scrollIntoViewIfNeeded();
    const video = card.locator("video");
    await expect(video).toHaveCount(1, { timeout: 15_000 });
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState >= 2 && v.currentTime > 1), {
        timeout: 30_000,
      })
      .toBe(true);

    const boxes = await caseBoxes(page);
    const geo = boxes.find((b) => b.id === "tour-stop-geodetective")!;
    const why = boxes.find((b) => b.id === "home-card-why-learn")!;
    expect(geo, "GeoDetective card").toBeTruthy();
    expect(why, "Why card").toBeTruthy();
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(overlaps(boxes[i].box, boxes[j].box), `${boxes[i].id} overlaps ${boxes[j].id}`).toBe(
          false,
        );
      }
    }
    if (vp.width >= 1000) {
      // Two-column grid: same row as GeoDetective, same top and height.
      expect(Math.abs(why.box.y - geo.box.y), "same row top").toBeLessThanOrEqual(2);
      expect(Math.abs(why.box.height - geo.box.height), "same row height").toBeLessThanOrEqual(2);
      expect(why.box.x).toBeGreaterThan(geo.box.x);
    } else {
      // One column: directly under GeoDetective, same width.
      expect(why.box.y).toBeGreaterThanOrEqual(geo.box.y + geo.box.height - 1);
      expect(Math.abs(why.box.width - geo.box.width), "same width").toBeLessThanOrEqual(2);
    }
    // Nothing inside the card spills outside it horizontally.
    const spill = await card.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return Array.from(el.querySelectorAll("*")).filter((c) => {
        const b = c.getBoundingClientRect();
        return b.width > 0 && (b.left < r.left - 1 || b.right > r.right + 1);
      }).length;
    });
    expect(spill, "children inside the card box").toBe(0);

    await page.screenshot({ path: `${SHOTS}/home-scale-${vp.name}-viewport.png` });
    await card.screenshot({ path: `${SHOTS}/card-${vp.name}-film-frame.png` });
    await page
      .locator("#home-cases")
      .screenshot({ path: `${SHOTS}/home-cases-${vp.name}-film-frame.png` });
  });

  test(`?scale=1 still frame at ${vp.name} (reduced motion)`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${APP_URL}&scale=1`);
    const card = page.getByTestId("home-card-why-learn");
    await expect(card).toBeVisible();
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator("video")).toHaveCount(0);
    const img = card.locator('[data-testid="card-film-why-learn"] img');
    await expect(img).toHaveAttribute("src", /why-learn-still/);
    await expect
      .poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0))
      .toBe(true);
    await card.screenshot({ path: `${SHOTS}/card-${vp.name}-still-frame.png` });
  });
}

// Whole-card action (Form S, same as GeoDetective): a tap anywhere on the
// card opens its target. Until the scale-play subject picker lands the
// target is GeoDetective (WHY_LEARN_OPENS in game-app.tsx).
for (const point of ["image", "heading", "paragraph"] as const) {
  test(`?scale=1 whole-card click (${point}) leaves Home`, async ({ page }) => {
    await page.goto(`${APP_URL}&scale=1`);
    const card = page.getByTestId("home-card-why-learn");
    await expect(card).toBeVisible();
    await card.scrollIntoViewIfNeeded();
    const target =
      point === "image"
        ? card.getByTestId("card-film-why-learn")
        : point === "heading"
          ? card.getByRole("heading", { name: /Why Do We Learn This\?/ })
          : card.locator(".hv5-txt p").first();
    const box = (await target.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(card).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByTestId("home-heading")).toHaveCount(0);
  });
}
