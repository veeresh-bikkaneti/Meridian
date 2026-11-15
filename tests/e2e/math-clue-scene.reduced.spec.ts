import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Math clue scenes (pilot, feat/clue-scene-pilot) — reduced motion.
 *
 * With prefers-reduced-motion the scene renders the still frame
 * of the current phase: the setup still before the pick, the
 * solved still after it, and no Replay control (nothing can move).
 * Pins the first pilot item (the coin scene) end to end.
 *
 * Act 3 under reduced motion: the summary never auto-plays. The
 * solved still stands, the full script stands as text in the
 * result section, and the summary's own play control is offered —
 * tapping it runs the voice and captions against the still.
 */
test.setTimeout(120_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";
const PROFILE_KEY = "meridian.ageProfile.v1";
const SHOTS = "clue-scene-shots";

async function setup(context: BrowserContext) {
  await serveBuiltArtifact(context);
  await context.route("**/flags.json", (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ version: 1, flags: { pwaUpdateToast: true } }),
      contentType: "application/json; charset=utf-8",
    }),
  );
  await context.addInitScript(
    ({ key }) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          status: "active",
          band: "7-10",
          updatedAt: new Date().toISOString(),
          changeCount: 0,
          schemaVersion: 2,
        }),
      );
    },
    { key: PROFILE_KEY },
  );
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

test("reduced motion: still frames of both phases, no replay control", async ({ page, context }) => {
  await setup(context);
  const errors = watchErrors(page);
  await page.goto(APP_URL);
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await card.getByRole("button", { name: "Why Do We Learn This?: Start exploring" }).click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  await page.getByTestId("subject-row-math").click();
  await expect(page.getByTestId("math-case")).toBeVisible();
  await expect(page.getByTestId("math-case")).toHaveAttribute(
    "data-item",
    "math-number:groups:skip-count",
  );

  const scene = page.getByTestId("clue-scene");
  await expect(scene).toBeVisible();
  await expect(scene).toHaveAttribute("data-phase", "setup");
  await expect(scene).toHaveAttribute("data-still", "true");
  await expect(page.locator(".clue-scene-replay")).toHaveCount(0);
  await scene.screenshot({ path: `${SHOTS}/skip-count-setup-reduced.png` });

  await page
    .getByTestId("math-answer-card")
    .getByRole("button", { name: "8", exact: true })
    .click();
  const close = page.getByRole("button", { name: "Close celebration" });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
    await expect(close).toHaveCount(0);
  }
  await expect(page.getByTestId("math-result")).toBeVisible();
  await expect(scene).toHaveAttribute("data-phase", "solved");
  await expect(scene).toHaveAttribute("data-still", "true");
  // Act 3, reduced: the film's replay stays absent (nothing can
  // move), the summary does NOT auto-play, its full script stands
  // in the result, and its play control waits for a tap.
  await expect(page.getByRole("button", { name: "↻ Replay the film" })).toHaveCount(0);
  await expect(scene).toHaveAttribute("data-summary", "idle");
  const summaryText = page.getByTestId("clue-summary-text");
  await expect(summaryText).toBeVisible();
  await expect(summaryText).toContainText("Counting in fives finds the groups fast");
  await scene.screenshot({ path: `${SHOTS}/skip-count-solved-reduced.png` });
  // A tap runs the performance against the still: voice and
  // captions move, the picture does not.
  await page.getByTestId("clue-summary-play").click();
  await expect(scene).toHaveAttribute("data-summary", "playing");
  await expect(scene).toHaveAttribute("data-still", "true");
  await expect
    .poll(async () => (await page.getByTestId("clue-scene-caption").innerText()).trim().length, {
      timeout: 12_000,
    })
    .toBeGreaterThan(0);
  await scene.screenshot({ path: `${SHOTS}/skip-count-summary-reduced.png` });

  expect(errors).toEqual([]);
});
