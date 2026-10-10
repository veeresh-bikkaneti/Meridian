import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Storyteller banner host — desktop (1440×900, fine pointer).
 *
 * Owner directive 2026-10-09: the Storyteller sits IN THE BANNER beside the
 * Meridian branding — 56px on all viewports, always visible. The greeting
 * rides in a popover below the banner row.
 *
 * Covers: 56px figure beside the h1 in the banner row, greeting popover on
 * every visit, the silent Comet emblem in the eyebrow row, no console
 * errors.
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const APP = "http://127.0.0.1:4123/Meridian/";

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function loadHome(page: Page): Promise<string[]> {
  await page.context().addInitScript((seeds: Record<string, string>) => {
    try {
      for (const [k, v] of Object.entries(seeds)) localStorage.setItem(k, v);
    } catch {
      /* private mode — ignore */
    }
  }, {
    "meridian.grandpaTour.lastDate": todayKey(),
    "meridian.tutorialSeen": "1",
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  await page.goto(APP);
  await expect(page.getByTestId("storyteller-home")).toBeVisible({ timeout: 20_000 });
  return errors;
}

function expectCleanConsole(errors: string[]): void {
  const relevant = errors.filter((e) => !e.includes("Minified React error #418"));
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

test("banner: 56px figure beside the h1, greeting popover on every visit", async ({
  page,
}) => {
  const errors = await loadHome(page);

  const figure = page.getByTestId("storyteller-figure");
  const fBox = await figure.boundingBox();
  expect(fBox, "figure box").not.toBeNull();
  // The 650ms entrance animation scales the figure — poll until both
  // dimensions settle at 56 simultaneously.
  await expect
    .poll(async () => {
      const b = await figure.boundingBox();
      return b ? `${Math.round(b.width)}x${Math.round(b.height)}` : "none";
    }, { timeout: 5_000 })
    .toBe("56x56");

  const heading = page.getByTestId("home-heading");
  const hBox = await heading.boundingBox();
  expect(hBox, "h1 box").not.toBeNull();
  // Figure sits right of the branding inside the banner row
  // (owner 2026-10-09).
  expect(fBox!.x).toBeGreaterThan(hBox!.x);

  const bubble = page.getByTestId("storyteller-home-bubble");
  await expect(bubble).toBeVisible({ timeout: 10_000 });
  await expect(bubble).toHaveAttribute("role", "status");

  expectCleanConsole(errors);
});

test("Comet emblem: ~30px, static, aria-hidden, in the eyebrow row", async ({
  page,
}) => {
  const errors = await loadHome(page);

  const emblem = page.getByTestId("comet-emblem");
  await expect(emblem).toBeVisible();
  await expect(emblem).toHaveAttribute("aria-hidden", "true");
  const box = await emblem.boundingBox();
  expect(box, "emblem box").not.toBeNull();
  expect(Math.round(box!.width)).toBeGreaterThanOrEqual(28);
  expect(Math.round(box!.width)).toBeLessThanOrEqual(32);
  expect(Math.round(box!.height)).toBeGreaterThanOrEqual(28);
  expect(Math.round(box!.height)).toBeLessThanOrEqual(32);

  // Eyebrow → emblem → sound toggle order (spec §2).
  const eyebrow = page.locator(".atlas-eyebrow").first();
  const toggle = page.getByTestId("sound-toggle");
  const eBox = await eyebrow.boundingBox();
  const tBox = await toggle.boundingBox();
  expect(eBox!.x).toBeLessThan(box!.x);
  expect(box!.x).toBeLessThan(tBox!.x);

  // No interactive Comet host anywhere on home.
  await expect(page.getByTestId("comet-mascot")).toHaveCount(0);

  expectCleanConsole(errors);
});
