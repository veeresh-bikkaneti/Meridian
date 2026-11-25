import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { readFileSync } from "node:fs";
import { serveBuiltArtifact } from "./helpers";

/**
 * ADOPTION MOCK sample-video spec (staging only — never a PR).
 *
 * Records a paced walkthrough of the Why Learn adoption staging
 * build (Lanes A–D composed) so the owner can watch the pieces
 * come together: picker (sticker skin + stamps) → Math case →
 * flap lift → hunch (wrong on purpose: 6) → answer (8) → result
 * band naming the hunch back with the stamp earned.
 *
 * Seeds identical to why-learn-adoption-capture.desktop.spec.ts:
 * band 7-10, read-aloud "never", Math + Chemistry fully solved
 * for band 7-10 so the Lane A stamps are earned by the real
 * derivation. Every beat is driven by real taps.
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

/** Slow stepped window scroll so a viewer can read while it moves. */
async function slowScroll(page: Page, totalPx: number, steps = 8, pauseMs = 420) {
  const dy = totalPx / steps;
  for (let i = 0; i < steps; i++) {
    await page.evaluate((y) => window.scrollBy(0, y), dy);
    await page.waitForTimeout(pauseMs);
  }
}

async function walkthrough(page: Page, scrollPx: number) {
  // (a) Picker: settle, then slow-scroll the sticker cards + stamps.
  await openPicker(page);
  await expect(
    page.getByTestId("subject-row-math").locator(".wl-stamp-chip"),
  ).toBeVisible();
  await expect(
    page.getByTestId("subject-row-physics").locator(".wl-stamp-chip"),
  ).toHaveCount(0);
  await page.waitForTimeout(2200); // rise cascade + stamp-in settle
  await page.waitForTimeout(2500); // hold on the composed picker
  await slowScroll(page, scrollPx);
  await page.waitForTimeout(1200);
  await slowScroll(page, -scrollPx);
  await page.waitForTimeout(1500);

  // (b) Open the Math case.
  const mathRow = page.getByTestId("subject-row-math");
  await mathRow.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await mathRow.click();
  await expect(page.getByTestId("math-case")).toBeVisible();
  await page.waitForTimeout(2000);

  // (c) Flap: pause on the closed flap, tap it, watch the hinge lift.
  const flap = page.getByTestId("math-scene-flap");
  await expect(flap).toBeVisible();
  await flap.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2000);
  await flap.click();
  await page.waitForTimeout(700); // 380ms hinge + settle
  await expect(flap).toHaveCount(0);
  await page.waitForTimeout(1000); // hold on the revealed coin scene

  // (d) Hunch card: scroll to it, pause, tap the WRONG hunch (6).
  const hunch = page.getByTestId("math-hunch-card");
  await expect(hunch).toBeVisible();
  await hunch.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2000);
  await hunch.getByRole("button", { name: "6", exact: true }).click();
  await page.waitForTimeout(800);

  // (e) Answer card: pause, tap the correct answer (8).
  const answers = page.getByTestId("math-answer-card");
  await expect(answers).toBeVisible();
  await answers.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2000);
  await answers.getByRole("button", { name: "8", exact: true }).click();
  await dismissCelebration(page);

  // (f) Result band: stamp + hunch named back + step-by-step.
  const result = page.getByTestId("math-result");
  await expect(result).toBeVisible();
  await expect(result.locator(".wl-stamp-case")).toBeVisible();
  await expect(result.locator(".wl-hunch-line")).toContainText("You guessed");
  await result.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2000);
  await slowScroll(page, 420, 6, 350); // walk the step-by-step into view
  await page.waitForTimeout(4000); // hold the final frame
}

test.use({
  viewport: { width: 1280, height: 800 },
  video: { mode: "on", size: { width: 1280, height: 800 } },
});

test("adoption mock sample video — desktop walkthrough", async ({ context, page }) => {
    await setup(context);
    await walkthrough(page, 520);
  });
