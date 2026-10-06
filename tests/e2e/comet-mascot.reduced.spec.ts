import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * CometMascot E2E — reduced motion (1440×900, prefers-reduced-motion: reduce).
 *
 * Covers: cursor tracking is disabled (static pose), the greeting text
 * appears instantly (no word-by-word), the mascot stays tappable,
 * no console errors. Audio timing is unchanged by reduced motion.
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const APP = "http://127.0.0.1:4123/Meridian/";

function yesterdayKey(): string {
  const d = new Date(Date.now() - 86_400_000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function loadHome(page: Page): Promise<string[]> {
  await page.context().addInitScript((key: string) => {
    try {
      if (!localStorage.getItem("meridian.cometGreeting.lastDate"))
        localStorage.setItem("meridian.cometGreeting.lastDate", key);
    } catch {
      /* private mode — ignore */
    }
  }, yesterdayKey());
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  await page.goto(APP);
  await expect(page.getByTestId("comet-mascot")).toBeVisible({ timeout: 20_000 });
  return errors;
}

function expectCleanConsole(errors: string[]): void {
  // React #418 is a pre-existing flaky hydration warning, unrelated to this
  // feature (same filter as the cleared-mode and difficulty-picker specs).
  const relevant = errors.filter((e) => !e.includes("Minified React error #418"));
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

test("reduced motion disables cursor tracking", async ({ page }) => {
  const errors = await loadHome(page);
  const mascot = page.getByTestId("comet-mascot");
  await expect(mascot).toHaveAttribute("data-tracking", "off");
  const pupils = page.getByTestId("comet-pupils");
  await expect.poll(async () => pupils.getAttribute("style")).toContain("translate(0px, 0px)");
  // Sweep the pointer across the viewport: the pose must not move.
  await page.mouse.move(60, 60);
  await page.waitForTimeout(400);
  await page.mouse.move(1300, 200);
  await page.waitForTimeout(400);
  await expect.poll(async () => pupils.getAttribute("style")).toContain("translate(0px, 0px)");
  expectCleanConsole(errors);
});

test("reduced motion shows the full greeting text instantly", async ({ page }) => {
  const errors = await loadHome(page);
  const bubble = page.getByTestId("comet-greeting");
  await expect(bubble).toBeVisible();
  // No word-by-word: every word is shown on the first paint.
  const hidden = await page.locator(".comet-greeting-word:not(.shown)").count();
  expect(hidden).toBe(0);
  const text = await page.getByTestId("comet-greeting-text").getAttribute("aria-label");
  expect(text).toBeTruthy();
  expect(text!.length).toBeGreaterThan(20);
  expectCleanConsole(errors);
});

test("mascot stays tappable under reduced motion", async ({ page }) => {
  const errors = await loadHome(page);
  const mascot = page.getByTestId("comet-mascot");
  await mascot.click();
  // Instant reaction swap, no squash animation — the state still cycles.
  await expect(mascot).toHaveAttribute("data-state", "booped");
  await expect(mascot).toHaveAttribute("data-state", "idle", { timeout: 5000 });
  expectCleanConsole(errors);
});
