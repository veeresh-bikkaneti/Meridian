import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Math clue scenes (wave 3) — reduced motion, ages 18+.
 *
 * With prefers-reduced-motion the scene renders the still frame
 * of the current phase: the setup still before the pick, the
 * solved still after it, and no Replay control (nothing can move).
 * Pins the first 18+ item (the split-product scene) end to end,
 * then the other covered item (the share-bar scene).
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
          band: "18+",
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
    "math-number:tables:mental-strategies",
  );

  const scene = page.getByTestId("clue-scene");
  await expect(scene).toBeVisible();
  await expect(scene).toHaveAttribute("data-phase", "setup");
  await expect(scene).toHaveAttribute("data-still", "true");
  await expect(page.locator(".clue-scene-replay")).toHaveCount(0);
  await scene.screenshot({ path: `${SHOTS}/mental-strategies-setup-reduced.png` });

  await page
    .getByTestId("math-answer-card")
    .getByRole("button", { name: "360", exact: true })
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
  await expect(summaryText).toContainText("make 360");
  await scene.screenshot({ path: `${SHOTS}/mental-strategies-solved-reduced.png` });
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
  await scene.screenshot({ path: `${SHOTS}/mental-strategies-summary-reduced.png` });

  expect(errors).toEqual([]);
});

test("reduced motion: the share-bar scene also stands still, its summary waits for a tap", async ({
  page,
  context,
}) => {
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

  // Solve forward to a target case, then pin its still frames.
  async function solveForwardTo(item: string) {
    for (let guard = 0; guard < 4; guard++) {
      const current = await page.getByTestId("math-case").getAttribute("data-item");
      if (current === item) return;
      const correct = {
        "math-number:tables:mental-strategies": "360",
      }[current!];
      await page
        .getByTestId("math-answer-card")
        .getByRole("button", { name: correct!, exact: true })
        .click();
      const close = page.getByRole("button", { name: "Close celebration" });
      if (await close.isVisible().catch(() => false)) {
        await close.click();
        await expect(close).toHaveCount(0);
      }
      await expect(page.getByTestId("math-result")).toBeVisible();
      await page.getByRole("button", { name: /Next case/ }).click();
      await expect(page.getByTestId("math-answer-card")).toBeVisible();
    }
    throw new Error(`never reached ${item}`);
  }

  async function pinStill(item: string, correct: string, slug: string, snippet: string) {
    await solveForwardTo(item);
    const scene = page.getByTestId("clue-scene");
    await expect(scene).toBeVisible();
    await expect(scene).toHaveAttribute("data-phase", "setup");
    await expect(scene).toHaveAttribute("data-still", "true");
    await expect(page.getByTestId("clue-summary-text")).toHaveCount(0);
    await scene.screenshot({ path: `${SHOTS}/${slug}-setup-reduced.png` });
    await page
      .getByTestId("math-answer-card")
      .getByRole("button", { name: correct, exact: true })
      .click();
    const close = page.getByRole("button", { name: "Close celebration" });
    if (await close.isVisible().catch(() => false)) {
      await close.click();
      await expect(close).toHaveCount(0);
    }
    await expect(page.getByTestId("math-result")).toBeVisible();
    await expect(scene).toHaveAttribute("data-phase", "solved");
    await expect(scene).toHaveAttribute("data-still", "true");
    await expect(scene).toHaveAttribute("data-summary", "idle");
    const summaryText = page.getByTestId("clue-summary-text");
    await expect(summaryText).toBeVisible();
    await expect(summaryText).toContainText(snippet);
    await expect(page.getByTestId("clue-summary-play")).toBeVisible();
    await scene.screenshot({ path: `${SHOTS}/${slug}-solved-reduced.png` });
  }

  await pinStill(
    "math-number:fractions:combine-shares",
    "13.5",
    "combine-shares",
    "13.5 coins to pay",
  );

  expect(errors).toEqual([]);
});
