import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers.ts";

test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const PLAY_LAB_URL = "http://127.0.0.1:4123/Meridian/play-lab";

test("play-lab loads with robots noindex and shows both candidate tabs", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(err.message);
  });

  await page.goto(PLAY_LAB_URL);

  // Check robots noindex meta tag
  const robotsMeta = page.locator('meta[name="robots"]');
  await expect(robotsMeta).toHaveAttribute("content", "noindex");

  // Verify Play Lab root
  const root = page.locator('[data-testid="playlab-root"]');
  await expect(root).toBeVisible();

  // Verify Tab A is default active
  const tabA = page.locator('[data-testid="tab-case-file"]');
  const tabB = page.locator('[data-testid="tab-atlas-skills"]');
  await expect(tabA).toBeVisible();
  await expect(tabB).toBeVisible();
  await expect(tabA).toHaveAttribute("aria-selected", "true");

  const flowAContainer = page.locator('[data-testid="flow-a-container"]');
  await expect(flowAContainer).toBeVisible();

  // Switch to Tab B
  await tabB.click();
  await expect(tabB).toHaveAttribute("aria-selected", "true");
  const flowBContainer = page.locator('[data-testid="flow-b-container"]');
  await expect(flowBContainer).toBeVisible();

  // Switch back to Tab A
  await tabA.click();
  await expect(flowAContainer).toBeVisible();

  // Verify no console errors occurred
  expect(consoleErrors.filter((e) => !e.includes("favicon"))).toEqual([]);
});

test("all 6 scale interactions answer correctly and render bridge cards", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await page.goto(PLAY_LAB_URL);

  // 1. Math: math-number:groups:skip-count
  const mathCard = page.locator('[data-testid="case-card-math-number:groups:skip-count"]');
  await expect(mathCard).toBeVisible();
  await mathCard.click();

  const mathChoice40 = page.locator('[data-testid="choice-40"]');
  await expect(mathChoice40).toBeVisible();
  await mathChoice40.click();

  const mathFeedback = page.locator('[data-testid="feedback-banner"]');
  await expect(mathFeedback).toBeVisible();
  await expect(mathFeedback).toContainText("Solved!");

  const mathBridge = page.locator('[data-testid="playlab-bridge-card"]');
  await expect(mathBridge).toBeVisible();
  await expect(mathBridge).toContainText("You just used this in...");

  // Dismiss celebration overlay if open
  const celebrationClose = page.locator(".celebration-dismiss, [aria-label='Close celebration']");
  if (await celebrationClose.isVisible()) {
    await celebrationClose.click();
  }

  // Back to ledger
  await page.locator('[data-testid="back-to-ledger-btn"]').click();

  // 2. Physics: physics:arrive:equal-steps
  const physicsCard = page.locator('[data-testid="case-card-physics:arrive:equal-steps"]');
  await expect(physicsCard).toBeVisible();
  await physicsCard.click();

  const cartAChoice = page.locator('[data-testid="choice-cart-a"]');
  await expect(cartAChoice).toBeVisible();
  await cartAChoice.click();

  const physicsFeedback = page.locator('[data-testid="feedback-banner"]');
  await expect(physicsFeedback).toBeVisible();
  await expect(physicsFeedback).toContainText("Solved!");

  const physicsBridge = page.locator('[data-testid="playlab-bridge-card"]');
  await expect(physicsBridge).toBeVisible();

  if (await celebrationClose.isVisible()) {
    await celebrationClose.click();
  }
  await page.locator('[data-testid="back-to-ledger-btn"]').click();

  // 3. Chemistry: chemistry:states:solid-liquid
  const chemCard = page.locator('[data-testid="case-card-chemistry:states:solid-liquid"]');
  await expect(chemCard).toBeVisible();
  await chemCard.click();

  const liquidChoice = page.locator('[data-testid="choice-liquid"]');
  await expect(liquidChoice).toBeVisible();
  await liquidChoice.click();

  const chemFeedback = page.locator('[data-testid="feedback-banner"]');
  await expect(chemFeedback).toBeVisible();
  await expect(chemFeedback).toContainText("Solved!");

  if (await celebrationClose.isVisible()) {
    await celebrationClose.click();
  }
  await page.locator('[data-testid="back-to-ledger-btn"]').click();

  // 4. Social Studies: social-studies:route:trip-clock
  const socCard = page.locator('[data-testid="case-card-social-studies:route:trip-clock"]');
  await expect(socCard).toBeVisible();
  await socCard.click();

  const clockChoice3 = page.locator('[data-testid="choice-3"]');
  await expect(clockChoice3).toBeVisible();
  await clockChoice3.click();

  const socFeedback = page.locator('[data-testid="feedback-banner"]');
  await expect(socFeedback).toBeVisible();
  await expect(socFeedback).toContainText("Solved!");

  if (await celebrationClose.isVisible()) {
    await celebrationClose.click();
  }
  await page.locator('[data-testid="back-to-ledger-btn"]').click();

  // 5. General Knowledge: general-knowledge:mixed:opera-years-ago
  const gkCard = page.locator('[data-testid="case-card-general-knowledge:mixed:opera-years-ago"]');
  await expect(gkCard).toBeVisible();
  await gkCard.click();

  const currentYear = new Date().getFullYear();
  const operaYears = currentYear - 1973;
  const operaChoice = page.locator(`[data-testid="choice-${operaYears}"]`);
  await expect(operaChoice).toBeVisible();
  await operaChoice.click();

  const gkFeedback = page.locator('[data-testid="feedback-banner"]');
  await expect(gkFeedback).toBeVisible();
  await expect(gkFeedback).toContainText("Solved!");

  if (await celebrationClose.isVisible()) {
    await celebrationClose.click();
  }
  await page.locator('[data-testid="back-to-ledger-btn"]').click();

  // 6. Journal: great-leaders:lincoln-memorial
  const journalCard = page.locator('[data-testid="case-card-great-leaders:lincoln-memorial"]');
  await expect(journalCard).toBeVisible();
  await journalCard.click();

  // Step 1: 8 years
  const choice8 = page.locator('[data-testid="choice-8"]');
  await expect(choice8).toBeVisible();
  await choice8.click();

  // Video slot appears
  const videoSlot = page.locator('[data-testid="journal-video-slot"]');
  await expect(videoSlot).toBeVisible({ timeout: 5000 });

  // Step 2: "He sits"
  const choiceSits = page.locator('[data-testid="choice-sits"]');
  await expect(choiceSits).toBeVisible();
  await choiceSits.click();

  const journalFeedback = page.locator('[data-testid="feedback-banner"]');
  await expect(journalFeedback).toBeVisible();
  await expect(journalFeedback).toContainText("Solved!");

  const journalBridge = page.locator('[data-testid="playlab-bridge-card"]');
  await expect(journalBridge).toBeVisible();

  expect(consoleErrors.filter((e) => !e.includes("favicon"))).toEqual([]);
});

test("reduced-motion path renders flat tier without motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(PLAY_LAB_URL);

  // Flow B check with reduced motion
  await page.locator('[data-testid="tab-atlas-skills"]').click();

  // In reduced motion, constellation uses the 2D lite/flat view
  const liteView = page.locator('[data-testid="constellation-lite-view"]');
  await expect(liteView).toBeVisible();

  // Globe uses the 2D disc view
  const globeLite = page.locator('[data-testid="globe-lite-view"]');
  await expect(globeLite).toBeVisible();
});

