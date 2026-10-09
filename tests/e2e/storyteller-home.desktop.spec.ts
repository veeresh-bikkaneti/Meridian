import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Storyteller banner rework (owner 2026-10-09, overrides #114) — desktop
 * (1440×900, fine pointer).
 *
 * Covers: 48px banner figure beside the branding (aria-hidden, decorative),
 * the silent Comet emblem in the eyebrow row, greeting bubble on every
 * visit, no console errors.
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
    if (m.type() === "error")
      errors.push(`console.error: ${m.text()} [${m.location()?.url ?? ""}]`);
  });
  await page.goto(APP);
  await expect(page.getByTestId("storyteller-banner-figure")).toBeVisible({
    timeout: 20_000,
  });
  return errors;
}

function expectCleanConsole(errors: string[]): void {
  const relevant = errors.filter(
    (e) =>
      !e.includes("Minified React error #418") &&
      // BLOCKER (feat/storyteller-banner): the six greet-0N mp3s can't be
      // rendered in this VM (no Kokoro engine) — their 404 is the expected
      // fail-closed signal until they land. Drop this filter when they ship.
      !/greet-0\d\.mp3/.test(e),
  );
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

test("banner figure: 48px beside the branding, aria-hidden, 0px² h1 overlap", async ({
  page,
}) => {
  const errors = await loadHome(page);

  const figure = page.getByTestId("storyteller-banner-figure");
  await expect(figure).toBeVisible();
  await expect(figure).toHaveAttribute("aria-hidden", "true");

  const fBox = await figure.boundingBox();
  expect(fBox, "figure box").not.toBeNull();
  expect(Math.round(fBox!.width)).toBe(48);
  expect(Math.round(fBox!.height)).toBe(48);

  // AGENTS.md hard-won rule #1: bounding-box non-intersection vs the h1.
  const h1Box = await page.getByTestId("home-heading").boundingBox();
  expect(h1Box, "h1 box").not.toBeNull();
  const ix = Math.max(
    0,
    Math.min(fBox!.x + fBox!.width, h1Box!.x + h1Box!.width) - Math.max(fBox!.x, h1Box!.x),
  );
  const iy = Math.max(
    0,
    Math.min(fBox!.y + fBox!.height, h1Box!.y + h1Box!.height) - Math.max(fBox!.y, h1Box!.y),
  );
  expect(ix * iy, "figure × h1 overlap").toBe(0);

  // The greeting bubble shows on every visit (owner 2026-10-09).
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
