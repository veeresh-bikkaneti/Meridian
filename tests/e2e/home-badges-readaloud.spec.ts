import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Home-page badges + read-aloud settings surface (#113 follow-ups).
 *
 * Owner 2026-10-09:
 * - Earned badges show ON the home page card (GeoDetective dossier card,
 *   where Clean Round is earned) — no separate Passport page.
 * - The kid's Always / Sometimes / Never choice is changeable later via a
 *   kid-reachable settings surface in the home footer (never parent-gated).
 */

const BASE = "http://127.0.0.1:4123/Meridian/";
const BADGES_KEY = "meridian.passport.badges.v1";
const PREF_KEY = "meridian.readAloudPref.v1";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

function seedBadges(context: import("playwright/test").BrowserContext) {
  return context.addInitScript(() => {
    window.localStorage.setItem(
      "meridian.passport.badges.v1",
      JSON.stringify([
        { id: "clean-round", earnedAt: "2026-10-09T12:00:00.000Z", schemaVersion: 1 },
      ]),
    );
  });
}

function seedPref(
  context: import("playwright/test").BrowserContext,
  value: "always" | "sometimes" | "never",
) {
  return context.addInitScript((v: string) => {
    window.localStorage.setItem(
      "meridian.readAloudPref.v1",
      JSON.stringify({
        schemaVersion: 1,
        value: v,
        updatedAt: new Date().toISOString(),
      }),
    );
  }, value);
}

function readPref(page: import("playwright/test").Page): Promise<string | null> {
  return page.evaluate(
    ([key]: string[]) => window.localStorage.getItem(key),
    [PREF_KEY],
  );
}

test("earned badge shows on the GeoDetective home card", async ({ page }) => {
  await seedBadges(page.context());
  await page.goto(BASE);
  const row = page.getByTestId("earned-badges");
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect(row).toContainText("Clean Round");
  // It lives on the GeoDetective dossier card.
  const card = page.locator('[data-testid="tour-stop-geodetective"]');
  await expect(card.getByTestId("earned-badges")).toBeVisible();
});

test("no badge row when nothing earned", async ({ page }) => {
  await page.goto(BASE);
  await expect(page.getByTestId("earned-badges")).toHaveCount(0, { timeout: 30_000 });
  // Home still renders fine.
  await expect(page.getByTestId("home-heading")).toBeVisible();
});

test("read-aloud preference is changeable via the home footer", async ({ page }) => {
  await seedPref(page.context(), "always");
  await page.goto(BASE);
  const toggle = page.getByTestId("readaloud-settings-toggle");
  await expect(toggle).toBeVisible({ timeout: 30_000 });
  await expect(toggle).toContainText("Always");

  // Open the options and switch to Sometimes.
  await toggle.click();
  await page.getByTestId("readaloud-option-sometimes").click();
  await expect(toggle).toContainText("Sometimes");

  // Persisted: the write hit localStorage (the addInitScript seed above
  // re-runs on reload, so a reload check would re-seed "always" — the
  // storage read IS the persistence proof).
  const raw = await readPref(page);
  expect(raw).toContain('"sometimes"');
});

test("settings surface is kid-reachable, not behind the grown-ups gate", async ({ page }) => {
  await seedPref(page.context(), "never");
  await page.goto(BASE);
  // The toggle is in the footer next to the gate — visible without opening it.
  const toggle = page.getByTestId("readaloud-settings-toggle");
  await expect(toggle).toBeVisible({ timeout: 30_000 });
  // The grown-ups gate was never opened (no gate dialog present).
  await expect(page.getByTestId("grownup-gate")).toHaveCount(0);
});

async function overlapArea(
  page: import("playwright/test").Page,
  aTestId: string,
  bTestId: string,
  w: number,
  h: number,
): Promise<number> {
  const a = page.getByTestId(aTestId).first();
  const b = page.getByTestId(bTestId).first();
  await a.waitFor({ state: "visible", timeout: 30_000 });
  await b.waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(400);
  const ab = await a.boundingBox();
  const bb = await b.boundingBox();
  if (!ab || !bb) throw new Error(`missing box @${w}x${h} (${aTestId} vs ${bTestId})`);
  const ix = Math.max(0, Math.min(ab.x + ab.width, bb.x + bb.width) - Math.max(ab.x, bb.x));
  const iy = Math.max(0, Math.min(ab.y + ab.height, bb.y + bb.height) - Math.max(ab.y, bb.y));
  console.log(
    `@${w}x${h} ${aTestId} vs ${bTestId}: overlap=${(ix * iy).toFixed(1)}px²`,
  );
  return ix * iy;
}

for (const [w, h] of [[360, 740], [390, 844]] as const) {
  test(`${w}x${h}: badges row never overlaps the card CTA`, async ({ page }) => {
    await seedBadges(page.context());
    await page.setViewportSize({ width: w, height: h });
    await page.goto(BASE);
    const card = page.locator('[data-testid="tour-stop-geodetective"]');
    await expect(card.getByTestId("earned-badges")).toBeVisible({ timeout: 30_000 });
    // The row must not cover the card's choose button (not the badge chip
    // button — the chip is inside the row by design).
    const cta = card.locator("button.atlas-btn-brass");
    const rowBox = await page.getByTestId("earned-badges").first().boundingBox();
    const ctaBox = await cta.boundingBox();
    if (rowBox && ctaBox) {
      const ix = Math.max(0, Math.min(rowBox.x + rowBox.width, ctaBox.x + ctaBox.width) - Math.max(rowBox.x, ctaBox.x));
      const iy = Math.max(0, Math.min(rowBox.y + rowBox.height, ctaBox.y + ctaBox.height) - Math.max(rowBox.y, ctaBox.y));
      expect(ix * iy).toBe(0);
    }
  });

  test(`${w}x${h}: read-aloud settings never overlaps the grown-ups link`, async ({ page }) => {
    await seedPref(page.context(), "always");
    await page.setViewportSize({ width: w, height: h });
    await page.goto(BASE);
    const toggle = page.getByTestId("readaloud-settings-toggle");
    await expect(toggle).toBeVisible({ timeout: 30_000 });
    expect(await overlapArea(page, "readaloud-settings-toggle", "grownups-link", w, h)).toBe(0);
    // Expanded options must not overlap either.
    await toggle.click();
    const opt = page.getByTestId("readaloud-option-sometimes");
    await expect(opt).toBeVisible();
    const optBox = await opt.boundingBox();
    const linkBox = await page.getByTestId("grownups-link").boundingBox();
    if (optBox && linkBox) {
      const ix = Math.max(0, Math.min(optBox.x + optBox.width, linkBox.x + linkBox.width) - Math.max(optBox.x, linkBox.x));
      const iy = Math.max(0, Math.min(optBox.y + optBox.height, linkBox.y + linkBox.height) - Math.max(optBox.y, linkBox.y));
      expect(ix * iy).toBe(0);
    }
  });
}
