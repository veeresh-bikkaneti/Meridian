import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Social studies clue scenes (wave 9) — reduced motion.
 *
 * With prefers-reduced-motion the scene renders the still frame
 * of the current phase: the setup still before the pick, the
 * solved still after it, and no Replay control (nothing can
 * move). Pins the area-squares scene end to end, then walks
 * every other Social studies case across all three bands
 * (four ages 7-10, five ages 10-18, three ages 18+).
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

const CORRECT: Record<string, string> = {
  "social-studies:region:area-by-squares": "The first field, by 4 squares",
  "social-studies:route:count-the-steps": "40 km",
  "social-studies:route:trip-clock": "3 hours",
  "social-studies:place:compass-clue": "North-east of the fountain",
  "social-studies:region:density": "Town A",
  "social-studies:route:scale-ratio": "3.5 km",
  "social-studies:route:travel-time": "6 hours",
  "social-studies:route:fastest-or-shortest": "The valley road",
  "social-studies:compare:time-zones": "2 am the next day",
  "social-studies:region:flat-map-area": "Africa is far bigger \u2014 the flat map stretches places near the poles",
  "social-studies:route:great-circle": "That curved-looking path is the shortest route on the round Earth",
  "social-studies:compare:trip-cost": "The free road, by $3",
};

async function setup(context: BrowserContext, band = "10-18") {
  await serveBuiltArtifact(context);
  await context.route("**/flags.json", (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ version: 1, flags: { pwaUpdateToast: true } }),
      contentType: "application/json; charset=utf-8",
    }),
  );
  await context.addInitScript(
    ({ key, band }) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          status: "active",
          band,
          updatedAt: new Date().toISOString(),
          changeCount: 0,
          schemaVersion: 2,
        }),
      );
    },
    { key: PROFILE_KEY, band },
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

async function openCase(page: Page) {
  await page.goto(APP_URL);
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await card.getByRole("button", { name: "Why Do We Learn This?: Start exploring" }).click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  await page.getByTestId("subject-row-social-studies").click();
  await expect(page.getByTestId("social-studies-case")).toBeVisible();
  await expect(page.getByTestId("social-studies-answer-card")).toBeVisible();
}

async function dismissCelebration(page: Page) {
  const close = page.getByRole("button", { name: "Close celebration" });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
    await expect(close).toHaveCount(0);
  }
}

async function solveForwardTo(page: Page, item: string) {
  for (let guard = 0; guard < 12; guard++) {
    const current = await page.getByTestId("social-studies-case").getAttribute("data-item");
    if (current === item) return;
    const correct = CORRECT[current!];
    await page
      .getByTestId("social-studies-answer-card")
      .getByRole("button", { name: correct!, exact: true })
      .click();
    await dismissCelebration(page);
    await expect(page.getByTestId("social-studies-result")).toBeVisible();
    await page.getByRole("button", { name: /Next case/ }).click();
    await expect(page.getByTestId("social-studies-answer-card")).toBeVisible();
  }
  throw new Error(`never reached ${item}`);
}

async function pinStill(page: Page, item: string, slug: string, snippet: string, tapFirst = false) {
  await solveForwardTo(page, item);
  const scene = page.getByTestId("clue-scene");
  await expect(scene).toBeVisible();
  await expect(scene).toHaveAttribute("data-phase", "setup");
  await expect(scene).toHaveAttribute("data-still", "true");
  await expect(page.getByTestId("clue-summary-text")).toHaveCount(0);
  await scene.screenshot({ path: `${SHOTS}/${slug}-setup-reduced.png` });
  await page
    .getByTestId("social-studies-answer-card")
    .getByRole("button", { name: CORRECT[item]!, exact: true })
    .click();
  await dismissCelebration(page);
  await expect(page.getByTestId("social-studies-result")).toBeVisible();
  await expect(scene).toHaveAttribute("data-phase", "solved");
  await expect(scene).toHaveAttribute("data-still", "true");
  await expect(scene).toHaveAttribute("data-summary", "idle");
  const summaryText = page.getByTestId("clue-summary-text");
  await expect(summaryText).toBeVisible();
  await expect(summaryText).toContainText(snippet);
  await expect(page.getByTestId("clue-summary-play")).toBeVisible();
  await scene.screenshot({ path: `${SHOTS}/${slug}-solved-reduced.png` });
  if (tapFirst) {
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
    await scene.screenshot({ path: `${SHOTS}/${slug}-summary-reduced.png` });
  }
}

test("reduced motion: area-squares still frames, summary waits for a tap", async ({ page, context }) => {
  await setup(context, "7-10");
  const errors = watchErrors(page);
  await openCase(page);
  await pinStill(page, "social-studies:region:area-by-squares", "area-squares", "The first field, by 4 squares", true);
  expect(errors).toEqual([]);
});

test("reduced motion: the other ages 7-10 kinds also stand still", async ({ page, context }) => {
  await setup(context, "7-10");
  const errors = watchErrors(page);
  await openCase(page);
  await pinStill(page, "social-studies:route:count-the-steps", "route-steps", "40 km");
  await page.getByRole("button", { name: /Next case/ }).click();
  await expect(page.getByTestId("social-studies-answer-card")).toBeVisible();
  await pinStill(page, "social-studies:route:trip-clock", "trip-clock", "3 hours");
  await page.getByRole("button", { name: /Next case/ }).click();
  await expect(page.getByTestId("social-studies-answer-card")).toBeVisible();
  await pinStill(page, "social-studies:place:compass-clue", "compass-clue", "North-east of the fountain");
  expect(errors).toEqual([]);
});

test("reduced motion: ages 10-18 kinds stand still", async ({ page, context }) => {
  await setup(context, "10-18");
  const errors = watchErrors(page);
  await openCase(page);
  await pinStill(page, "social-studies:region:density", "town-density", "Town A", true);
  await page.getByRole("button", { name: /Next case/ }).click();
  await expect(page.getByTestId("social-studies-answer-card")).toBeVisible();
  await pinStill(page, "social-studies:route:scale-ratio", "trail-scale", "3.5 km");
  await page.getByRole("button", { name: /Next case/ }).click();
  await expect(page.getByTestId("social-studies-answer-card")).toBeVisible();
  await pinStill(page, "social-studies:route:travel-time", "travel-time", "6 hours");
  await page.getByRole("button", { name: /Next case/ }).click();
  await expect(page.getByTestId("social-studies-answer-card")).toBeVisible();
  await pinStill(page, "social-studies:route:fastest-or-shortest", "two-roads", "The valley road");
  await page.getByRole("button", { name: /Next case/ }).click();
  await expect(page.getByTestId("social-studies-answer-card")).toBeVisible();
  await pinStill(page, "social-studies:compare:time-zones", "zone-clocks", "2 am the next day");
  expect(errors).toEqual([]);
});

test("reduced motion: ages 18+ kinds stand still, summaries wait for a tap", async ({ page, context }) => {
  await setup(context, "18+");
  const errors = watchErrors(page);
  await openCase(page);
  await pinStill(page, "social-studies:region:flat-map-area", "flat-map", "Africa is far bigger", true);
  await page.getByRole("button", { name: /Next case/ }).click();
  await expect(page.getByTestId("social-studies-answer-card")).toBeVisible();
  await pinStill(page, "social-studies:route:great-circle", "great-circle", "shortest route on the round Earth");
  await page.getByRole("button", { name: /Next case/ }).click();
  await expect(page.getByTestId("social-studies-answer-card")).toBeVisible();
  await pinStill(page, "social-studies:compare:trip-cost", "trip-cost", "The free road, by $3");
  expect(errors).toEqual([]);
});
