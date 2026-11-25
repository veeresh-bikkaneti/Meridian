import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { readFileSync } from "node:fs";
import { serveBuiltArtifact } from "./helpers";

/**
 * ADOPTION MOCK interactable-prototype video spec (staging only —
 * never a PR). Records the PLAYED coin case (owner direction,
 * 2026-11-24 15:32 CST): picker → Math case → flap lift → hunch
 * "6" (wrong on purpose) → the player groups all 40 coins into
 * fives through the real interaction (first group by pointer
 * drags, the rest by tap-to-place) → the scene reports solved →
 * result band with the stamp, the hunch named back, and the
 * explanation playing as a motion segment.
 *
 * Seeds identical to the other adoption specs: band 7-10,
 * read-aloud "never", Math + Chemistry fully solved for band
 * 7-10 (picker stamps earned by the real derivation).
 */
test.setTimeout(600_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";
const PROFILE_KEY = "meridian.ageProfile.v1";
const PREF_KEY = "meridian.readAloudPref.v1";
const PROGRESS_KEY = "meridian.subject-progress.v1";
const BAND = "7-10";

function bandIds(subject: string, band: string): string[] {
  const src = readFileSync(`src/subjects/${subject}/items.ts`, "utf8");
  const ids: string[] = [];
  const re = /"id": "([^"]+)",\s*\n\s*"group": "([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m[2] === band) ids.push(m[1]);
  }
  return ids;
}

async function setup(context: BrowserContext) {
  await serveBuiltArtifact(context);
  await context.route("**/flags.json", (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ version: 1, flags: { pwaUpdateToast: true } }),
      contentType: "application/json; charset=utf-8",
    }),
  );
  const progress = {
    math: bandIds("math", BAND),
    chemistry: bandIds("chemistry", BAND),
  };
  await context.addInitScript(
    ({ profileKey, prefKey, progressKey, progressDoc }) => {
      window.localStorage.setItem(
        profileKey,
        JSON.stringify({
          status: "active",
          band: "7-10",
          updatedAt: new Date().toISOString(),
          changeCount: 0,
          schemaVersion: 2,
        }),
      );
      window.localStorage.setItem(
        prefKey,
        JSON.stringify({
          schemaVersion: 1,
          value: "never",
          updatedAt: new Date().toISOString(),
        }),
      );
      window.localStorage.setItem(progressKey, JSON.stringify(progressDoc));
    },
    { profileKey: PROFILE_KEY, prefKey: PREF_KEY, progressKey: PROGRESS_KEY, progressDoc: progress },
  );
}

async function openPicker(page: Page) {
  await page.goto(APP_URL);
  await page.waitForTimeout(700);
  const never = page.getByRole("button", { name: "Never", exact: true });
  if (await never.isVisible().catch(() => false)) {
    await never.click();
  }
  const card = page.getByTestId("home-card-why-learn");
  await card.scrollIntoViewIfNeeded();
  await card
    .getByRole("button", { name: "Why Do We Learn This?: Start exploring" })
    .click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
}

async function dismissCelebration(page: Page) {
  const close = page.getByRole("button", { name: "Close celebration" });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
    await expect(close).toHaveCount(0);
  }
}

async function slowScroll(page: Page, totalPx: number, steps = 8, pauseMs = 420) {
  const dy = totalPx / steps;
  for (let i = 0; i < steps; i++) {
    await page.evaluate((y) => window.scrollBy(0, y), dy);
    await page.waitForTimeout(pauseMs);
  }
}

/** Tap the topmost unplaced coin in the spill (tap-to-place). */
async function tapCoin(page: Page) {
  const coin = page.locator('[data-testid="math-coin-play"] .wl-play-spill .wl-coin').last();
  await coin.click({ timeout: 5_000 });
}

test.use({
  viewport: { width: 390, height: 844 },
  video: { mode: "on", size: { width: 390, height: 844 } },
});

test("adoption mock interactable prototype — played coin case", async ({ context, page }) => {
  await setup(context);

  // (a) Picker: brief hold on the composed picker, open Math.
  await openPicker(page);
  await expect(
    page.getByTestId("subject-row-math").locator(".wl-stamp-chip"),
  ).toBeVisible();
  await page.waitForTimeout(2500);
  const mathRow = page.getByTestId("subject-row-math");
  await mathRow.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await mathRow.click();
  await expect(page.getByTestId("math-case")).toBeVisible();
  await page.waitForTimeout(1800);

  // (b) Flap: pause on it, tap, hinge lifts onto the playable scene.
  const flap = page.getByTestId("math-scene-flap");
  await expect(flap).toBeVisible();
  await flap.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1800);
  await flap.click();
  await page.waitForTimeout(800);
  await expect(flap).toHaveCount(0);
  await expect(page.getByTestId("math-coin-play")).toBeVisible();
  await page.waitForTimeout(1000);

  // (c) Hunch: scroll down, pause, commit the WRONG hunch (6).
  const hunch = page.getByTestId("math-hunch-card");
  await expect(hunch).toBeVisible();
  await hunch.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1800);
  await hunch.getByRole("button", { name: "6", exact: true }).click();
  await page.waitForTimeout(900);
  await expect(page.getByTestId("math-play-prompt")).toBeVisible();

  // (d) Play: scroll the scene back into view.
  const scene = page.getByTestId("math-coin-play");
  await scene.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1300);

  // First group of five by real pointer drags into tray 0.
  const tray0 = page.getByTestId("play-tray-0");
  for (let i = 0; i < 5; i++) {
    const coin = page.locator('[data-testid="math-coin-play"] .wl-play-spill .wl-coin').last();
    const coinBox = await coin.boundingBox();
    const trayBox = await tray0.boundingBox();
    if (!coinBox || !trayBox) throw new Error("drag geometry missing");
    const sx = coinBox.x + coinBox.width / 2;
    const sy = coinBox.y + coinBox.height / 2;
    const tx = trayBox.x + trayBox.width / 2;
    const ty = trayBox.y + trayBox.height / 2;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(tx, ty, { steps: 14 });
    await page.mouse.up();
    await page.waitForTimeout(380);
  }
  await expect(page.getByTestId("play-tray-0")).toHaveClass(/is-locked/);
  await page.waitForTimeout(700); // let the "5" chip read

  // Remaining 35 coins by tap-to-place; pause as each group locks.
  for (let placed = 5; placed < 40; placed++) {
    await tapCoin(page);
    if ((placed + 1) % 5 === 0) {
      await page.waitForTimeout(650); // count chip beat: 10, 15, … 40
    } else {
      await page.waitForTimeout(150);
    }
  }

  // (e) Scene solved → shared correct path → result band.
  const result = page.getByTestId("math-result");
  await expect(result).toBeVisible({ timeout: 30_000 });
  await dismissCelebration(page);
  await expect(result.locator(".wl-stamp-case")).toBeVisible();
  await expect(result.locator(".wl-hunch-line")).toContainText("You guessed");
  await result.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);

  // (f) The explanation plays as motion: hold while the coins
  // slide into groups and the count builds to 40.
  const motion = page.getByTestId("math-explanation-motion");
  await expect(motion).toBeVisible();
  await motion.scrollIntoViewIfNeeded();
  await page.waitForTimeout(9500);

  // (g) The text fallback below it, then hold the final frame.
  await slowScroll(page, 430, 6, 350);
  await page.waitForTimeout(3200);
});
