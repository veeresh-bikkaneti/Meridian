import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * "Why Do We Learn This?" Home card — live for everyone.
 *
 * The card used to ship dark behind the scalePlay flag; since the
 * subjects launch (owner rule, Nov 13: release progressively) it
 * renders for every player in #home-cases right after GeoDetective,
 * with its band film slot and its CTA, with or without `?scale=1`.
 * flags.json is pinned so a live remote value can't change behaviour
 * mid-test.
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

test("card is present without ?scale=1", async ({ page }) => {
  await page.goto(APP_URL);
  await expect(page.getByTestId("tour-stop-geodetective")).toBeVisible();
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await expect(card.getByTestId("card-film-why-learn")).toHaveCount(1);
  const cta = card.getByRole("button", { name: "Why Do We Learn This?: Start exploring" });
  await expect(cta).toBeEnabled();
});

test("card sits right after GeoDetective", async ({ page }) => {
  await page.goto(APP_URL);
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await expect(card.getByRole("heading", { name: /Why Do We Learn This\?/ })).toBeVisible();
  await expect(card.getByText("Case file · Why it matters")).toBeVisible();
  const cta = card.getByRole("button", { name: "Why Do We Learn This?: Start exploring" });
  await expect(cta).toBeVisible();
  await expect(cta).toBeEnabled();
  await expect(cta).toHaveText(/Start exploring/);
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

// ── Layout proof + screenshots (Home, card live for everyone) ──
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
  test(`layout at ${vp.name}: in line with GeoDetective, no overlap, film frame`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(APP_URL);
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

    // The "New" tag stays on the same line as "This?" (never alone on a line).
    const tagLine = await card.locator("h2 .whitespace-nowrap").evaluate((el) => {
      const r = el.getBoundingClientRect();
      const c = el.querySelector(".hv5-chip")!.getBoundingClientRect();
      return { h: r.height, chipMid: c.top + c.height / 2, top: r.top, bottom: r.bottom };
    });
    expect(tagLine.h, "This? + New on one line").toBeLessThanOrEqual(40);
    expect(tagLine.chipMid).toBeGreaterThan(tagLine.top);
    expect(tagLine.chipMid).toBeLessThan(tagLine.bottom);

    await page.screenshot({ path: `${SHOTS}/home-scale-${vp.name}-viewport.png` });
    await card.screenshot({ path: `${SHOTS}/card-${vp.name}-film-frame.png` });
    await page
      .locator("#home-cases")
      .screenshot({ path: `${SHOTS}/home-cases-${vp.name}-film-frame.png` });
  });

  test(`still frame at ${vp.name} (reduced motion)`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(APP_URL);
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

// Subjects launch: the CTA is enabled ("Start exploring") and a tap
// opens the subject picker; the Math row opens the math case. The full
// per-band playthrough lives in math-subject.spec.ts.
test("card opens the subject picker, and Math opens the math case", async ({ page }) => {
  await page.goto(APP_URL);
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  const cta = card.getByRole("button", { name: "Why Do We Learn This?: Start exploring" });
  await expect(cta).toBeEnabled();
  await expect(cta).toHaveText(/Start exploring/);
  await cta.click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  await page.getByTestId("subject-row-math").click();
  await expect(page.getByTestId("math-case")).toBeVisible();
  await expect(page.getByTestId("math-answer-card")).toBeVisible();
  await expect(page.getByTestId("home-card-why-learn")).toHaveCount(0);
});
