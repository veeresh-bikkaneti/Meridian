import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { readFileSync } from "node:fs";
import { serveBuiltArtifact } from "./helpers";

/**
 * ADOPTION MOCK verify spec (staging only): element screenshots
 * (no full-page stitching) to settle two capture-artifact
 * questions from the composed run — the hunch card's heading at
 * 320px and the result band's buttons at 390px.
 */
test.setTimeout(300_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";

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
  const progress = { math: bandIds("math", "7-10"), chemistry: bandIds("chemistry", "7-10") };
  await context.addInitScript(
    (doc) => {
      window.localStorage.setItem(
        "meridian.ageProfile.v1",
        JSON.stringify({ status: "active", band: "7-10", updatedAt: new Date().toISOString(), changeCount: 0, schemaVersion: 2 }),
      );
      window.localStorage.setItem(
        "meridian.readAloudPref.v1",
        JSON.stringify({ schemaVersion: 1, value: "never", updatedAt: new Date().toISOString() }),
      );
      window.localStorage.setItem("meridian.subject-progress.v1", JSON.stringify(doc));
    },
    progress,
  );
}

async function openMathCase(page: Page) {
  await page.goto(APP_URL);
  await page.waitForTimeout(700);
  const card = page.getByTestId("home-card-why-learn");
  await card.scrollIntoViewIfNeeded();
  await card.getByRole("button", { name: "Why Do We Learn This?: Start exploring" }).click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  await page.getByTestId("subject-row-math").click();
  await expect(page.getByTestId("math-case")).toBeVisible();
}

test("hunch card element at 320x568", async ({ context, page }) => {
  await setup(context);
  await page.setViewportSize({ width: 320, height: 568 });
  await openMathCase(page);
  const hunch = page.getByTestId("math-hunch-card");
  await expect(hunch).toBeVisible();
  await expect(hunch.locator("h2")).toContainText("What's your hunch?");
  await hunch.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await hunch.screenshot({ path: "captures/verify-hunch-card-320x568.png" });
});

test("result band element at 320x568", async ({ context, page }) => {
  await setup(context);
  await page.setViewportSize({ width: 320, height: 568 });
  await openMathCase(page);
  await page.getByTestId("math-scene-flap").click();
  await page.waitForTimeout(600);
  await page
    .getByTestId("math-hunch-card")
    .getByRole("button", { name: "6", exact: true })
    .click();
  const answers = page.getByTestId("math-answer-card");
  await expect(answers).toBeVisible();
  await answers.getByRole("button", { name: "8", exact: true }).click();
  const close = page.getByRole("button", { name: "Close celebration" });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
    await expect(close).toHaveCount(0);
  }
  const result = page.getByTestId("math-result");
  await expect(result).toBeVisible();
  await result.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await result.screenshot({ path: "captures/verify-result-band-320x568.png" });
});

test("result band element at 390x844", async ({ context, page }) => {
  await setup(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await openMathCase(page);
  await page.getByTestId("math-scene-flap").click();
  await page.waitForTimeout(600);
  await page
    .getByTestId("math-hunch-card")
    .getByRole("button", { name: "6", exact: true })
    .click();
  const answers = page.getByTestId("math-answer-card");
  await expect(answers).toBeVisible();
  await answers.getByRole("button", { name: "8", exact: true }).click();
  const close = page.getByRole("button", { name: "Close celebration" });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
    await expect(close).toHaveCount(0);
  }
  const result = page.getByTestId("math-result");
  await expect(result).toBeVisible();
  await result.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await result.screenshot({ path: "captures/verify-result-band-390x844.png" });
});
