import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * WI-9 (Branch 2): storyteller bubble clearance + 5–7 band readability.
 *
 * Before this branch the greeting bubble covered the headline:
 * measured overlap with the h1's box was 17,608px² at 320px and
 * 1,374px² at 1280px. The storyteller now measures the open bubble and
 * publishes its height as --w2-bubble-clear on the hero; the h1's top
 * margin becomes that value, so clearance is exact at every width.
 * These tests pin 0px² of bubble×headline overlap at 320/375/768/1280,
 * the 16px floor on home body text for the 5–7 band, and ≥44px tap
 * targets across the nav and hero.
 */

const APP = "http://127.0.0.1:4123/Meridian/";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function seed(page: Page, band: "5-7" | null) {
  await page.context().addInitScript(
    (args: { today: string; band: string | null }) => {
      try {
        localStorage.setItem("meridian.grandpaTour.lastDate", args.today);
        localStorage.setItem("meridian.tutorialSeen", "1");
        if (args.band) {
          localStorage.setItem(
            "meridian.ageProfile.v1",
            JSON.stringify({
              status: "active",
              band: args.band,
              updatedAt: new Date().toISOString(),
              changeCount: 0,
              schemaVersion: 1,
            }),
          );
        }
      } catch {
        /* private mode — ignore */
      }
    },
    { today: todayKey(), band },
  );
}

type Box = { x: number; y: number; width: number; height: number };
function overlapArea(a: Box | null, b: Box | null): number {
  if (!a || !b) throw new Error("missing box");
  const ix = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return ix * iy;
}

for (const width of [320, 375, 768, 1280]) {
  test(`bubble never overlaps the headline @${width}px`, async ({ page }) => {
    await seed(page, null);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(APP, { waitUntil: "networkidle" });
    const bubble = page.getByTestId("storyteller-home-bubble");
    await expect(bubble).toBeVisible({ timeout: 30_000 });
    // Let the measured margin settle (bubble box stable across samples).
    await expect
      .poll(
        async () => {
          const a = await bubble.boundingBox();
          await page.waitForTimeout(150);
          const b = await bubble.boundingBox();
          if (!a || !b) return false;
          return Math.abs(a.height - b.height) <= 1 && Math.abs(a.y - b.y) <= 1;
        },
        { timeout: 15_000 },
      )
      .toBe(true);
    const bub = await bubble.boundingBox();
    const h1 = await page.locator(".hv5-h1").boundingBox();
    const sub = await page.locator(".hv5-sub").boundingBox();
    expect(overlapArea(bub, h1), `bubble×h1 @${width}`).toBe(0);
    expect(overlapArea(bub, sub), `bubble×sub @${width}`).toBe(0);
    // The bubble itself is fully on screen horizontally.
    expect(bub!.x).toBeGreaterThanOrEqual(0);
    expect(bub!.x + bub!.width).toBeLessThanOrEqual(width);
  });
}

test("5–7 band: home body text is at least 16px", async ({ page }) => {
  await seed(page, "5-7");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(APP, { waitUntil: "networkidle" });
  await expect(page.getByTestId("storyteller-home-bubble")).toBeVisible({ timeout: 30_000 });
  const sizes = await page.evaluate(() => {
    const size = (sel: string) => {
      const el = document.querySelector(sel);
      return el ? parseFloat(getComputedStyle(el).fontSize) : -1;
    };
    return {
      about: size("#home-about p"),
      entry: size(".hv5-entry p:not(.hv5-label)"),
      caption: size(".storyteller-caption-text"),
      hint: size(".hv5-hint"),
      diffCap: size(".hv5-diff-cap"),
      footerNote: size(".agep-footer-note"),
    };
  });
  for (const [name, px] of Object.entries(sizes)) {
    expect(px, `${name} font-size`).toBeGreaterThanOrEqual(16);
  }
});

test("tap targets are at least 44px in the nav and hero", async ({ page }) => {
  await seed(page, null);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(APP, { waitUntil: "networkidle" });
  await expect(page.getByTestId("storyteller-home-bubble")).toBeVisible({ timeout: 30_000 });
  const targets = await page.evaluate(() => {
    const out: Record<string, { w: number; h: number }> = {};
    const put = (label: string, el: Element | null) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      out[label] = { w: r.width, h: r.height };
    };
    document
      .querySelectorAll("nav[aria-label='Primary'] button")
      .forEach((b, i) => put(`nav[${i}]`, b));
    put("join", document.querySelector(".hv5-btn-brown"));
    put("dismiss", document.querySelector(".storyteller-banner-dismiss"));
    put("sound", document.querySelector(".atlas-sound-toggle"));
    return out;
  });
  expect(Object.keys(targets).length).toBeGreaterThanOrEqual(8);
  for (const [label, box] of Object.entries(targets)) {
    expect(box.w, `${label} width`).toBeGreaterThanOrEqual(44);
    expect(box.h, `${label} height`).toBeGreaterThanOrEqual(44);
  }
});
