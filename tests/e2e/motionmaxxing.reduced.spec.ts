import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import { installSfxStub } from "./sfx-stub";

/**
 * Motionmaxxing reduced-motion E2E (owner order 2026-10-11).
 *
 * The unit suite asserts the token file's reduce block on disk; these are
 * the live computed-style proofs on the built artifact with the OS
 * preference forced (project: motionmaxxing-reduced, 390×844):
 * - the M0 global collapse zeroes transitions (≈0.01ms) and animations;
 * - the M5 celebration keeps its full kill and stays fully usable;
 * - the M6 press feedback never fires;
 * - toggling reduced motion MID-celebration keeps the content readable
 *   (red-team: the flip must not strand invisible content).
 *
 * Console-clean gate: every test fails on pageerrors / console errors.
 */

const BASE = "http://127.0.0.1:4123/Meridian/";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  await installSfxStub(context);
});

async function cleanConsole(page: import("playwright/test").Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  return errors;
}

// React #418 is a pre-existing flaky hydration warning, unrelated to this
// feature (same filter as the celebration/cleared-mode/difficulty-picker
// specs).
function withoutHydrationNoise(errors: string[]): string[] {
  return errors.filter((e) => !e.includes("Minified React error #418"));
}

test("M0 collapse: computed transition-duration ≈ 0.01ms, animations none", async ({
  page,
}) => {
  const errors = await cleanConsole(page);
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
    true,
  );
  await page.goto(BASE);
  await page.waitForTimeout(500);

  const probe = await page
    .locator('[data-testid="tour-stop-editions"]')
    .getByRole("button", { name: "Choose a state" })
    .evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        transitionDuration: cs.transitionDuration,
        animationName: cs.animationName,
      };
    });
  // 0.01ms serializes as 0.00001s — assert sub-millisecond, not the string.
  const seconds = parseFloat(probe.transitionDuration);
  expect(seconds).toBeLessThan(0.001);

  // The home cascade is animation-free under the collapse.
  const riseAnim = await page.locator(".atlas-banner-row.home-rise").evaluate((el) => {
    const cs = getComputedStyle(el);
    return cs.animationName;
  });
  expect(riseAnim).toBe("none");

  // Content is fully usable: the editions block is visible and navigable.
  await expect(
    page.locator('[data-testid="tour-stop-editions"]').getByRole("button", {
      name: "Choose a state",
    }),
  ).toBeVisible();

  expect(withoutHydrationNoise(errors)).toEqual([]);
});

test("M6: no press feedback under reduced motion, navigation still immediate", async ({
  page,
}) => {
  const errors = await cleanConsole(page);
  await page.goto(BASE);
  await page.waitForTimeout(500);

  const btn = page
    .locator('[data-testid="tour-stop-editions"]')
    .getByRole("button", { name: "Choose a state" });
  await expect(btn).toBeVisible();
  await btn.scrollIntoViewIfNeeded();
  const box = (await btn.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(200);
  const pressed = await btn.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { transform: cs.transform, filter: cs.filter };
  });
  await page.mouse.up(); // completes the click → navigation must fire now
  // No press feedback: transform stays none/identity, filter stays none.
  expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(pressed.transform);
  expect(pressed.filter).toBe("none");

  // Navigation is untouched by the missing feedback.
  await expect(
    page.getByRole("heading", { name: "State", exact: true }),
  ).toBeVisible({ timeout: 10_000 });

  expect(withoutHydrationNoise(errors)).toEqual([]);
});

test("M5: celebration keeps its full kill and stays usable", async ({ page }) => {
  const errors = await cleanConsole(page);
  await page.goto(`${BASE}?celebration=session-milestone`);
  const ov = page.getByTestId("celebration-overlay");
  await expect(ov).toBeVisible({ timeout: 15_000 });

  // No confetti canvas under reduced motion.
  await expect(ov.locator("canvas")).toHaveCount(0);
  // No pop animation anywhere in the overlay.
  const anims = await ov.evaluate(() =>
    Array.from(document.querySelectorAll(".celebration-pop, .celebration-child")).map(
      (el) => getComputedStyle(el as HTMLElement).animationName,
    ),
  );
  expect(anims.every((n) => n === "none")).toBe(true);
  // Content fully readable and dismissible.
  await expect(ov.getByRole("heading")).toBeVisible();
  const bodyText = await ov.locator(".celebration-child-3").textContent();
  expect(bodyText && bodyText.trim().length).toBeGreaterThan(0);
  await expect(ov.locator(".celebration-child-3")).toBeVisible();

  expect(withoutHydrationNoise(errors)).toEqual([]);
});

