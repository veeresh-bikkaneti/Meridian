import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Chemistry clue scenes (wave 8, reactions and ages 18+) —
 * reduced motion.
 *
 * With prefers-reduced-motion the scene renders the still frame
 * of the current phase: the setup still before the pick, the
 * solved still after it, and no Replay control (nothing can
 * move). Pins the scale-balance scene end to end, then the
 * other two reactions kinds (bubble-reaction, rust-change),
 * solving forward through the items between them, and a second
 * walk over the ages 18+ band pins all three of its kinds
 * (glow-rate, atom-tally, column-cousins).
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
  "chemistry:states:road-salt": "It lowers the freezing point of the water",
  "chemistry:mixtures:dissolve": "It is still there, as pieces too small to see",
  "chemistry:reactions:weight": "It stays the same",
  "chemistry:states:particles": "The water, from solid to liquid to gas",
  "chemistry:water:cycle": "Into the air, a cloud, back as rain or snow",
  "chemistry:reactions:new-look": "It might be a new substance",
  "chemistry:reactions:rust": "Yes \u2014 iron exposed to oxygen and water turns to rust",
  "chemistry:materials:identify": "Whether each block dissolves in water",
  "chemistry:reactions:rate": "The one in warm water",
  "chemistry:reactions:mass": "The same count on both sides \u2014 no atom vanished",
  "chemistry:reactions:explain": "It reacts in a similar way",
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
  await page.getByTestId("subject-row-chemistry").click();
  await expect(page.getByTestId("chemistry-case")).toBeVisible();
  await expect(page.getByTestId("chemistry-answer-card")).toBeVisible();
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
    const current = await page.getByTestId("chemistry-case").getAttribute("data-item");
    if (current === item) return;
    const correct = CORRECT[current!];
    await page
      .getByTestId("chemistry-answer-card")
      .getByRole("button", { name: correct!, exact: true })
      .click();
    await dismissCelebration(page);
    await expect(page.getByTestId("chemistry-result")).toBeVisible();
    await page.getByRole("button", { name: /Next case/ }).click();
    await expect(page.getByTestId("chemistry-answer-card")).toBeVisible();
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
    .getByTestId("chemistry-answer-card")
    .getByRole("button", { name: CORRECT[item]!, exact: true })
    .click();
  await dismissCelebration(page);
  await expect(page.getByTestId("chemistry-result")).toBeVisible();
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

test("reduced motion: scale-balance still frames, summary waits for a tap", async ({ page, context }) => {
  await setup(context);
  const errors = watchErrors(page);
  await openCase(page);
  await pinStill(page, "chemistry:reactions:weight", "scale-balance", "It stays the same", true);
  expect(errors).toEqual([]);
});

test("reduced motion: the other reactions kinds also stand still", async ({
  page,
  context,
}) => {
  await setup(context);
  const errors = watchErrors(page);
  await openCase(page);
  await pinStill(page, "chemistry:reactions:new-look", "bubble-reaction", "It might be a new substance");
  await page.getByRole("button", { name: /Next case/ }).click();
  await expect(page.getByTestId("chemistry-answer-card")).toBeVisible();
  await pinStill(page, "chemistry:reactions:rust", "rust-change", "turns to rust");
  expect(errors).toEqual([]);
});

test("reduced motion: ages 18+ kinds stand still, summaries wait for a tap", async ({
  page,
  context,
}) => {
  await setup(context, "18+");
  const errors = watchErrors(page);
  await openCase(page);
  await pinStill(page, "chemistry:reactions:rate", "glow-rate", "The one in warm water", true);
  await page.getByRole("button", { name: /Next case/ }).click();
  await expect(page.getByTestId("chemistry-answer-card")).toBeVisible();
  await pinStill(page, "chemistry:reactions:mass", "atom-tally", "The same count on both sides");
  await page.getByRole("button", { name: /Next case/ }).click();
  await expect(page.getByTestId("chemistry-answer-card")).toBeVisible();
  await pinStill(page, "chemistry:reactions:explain", "column-cousins", "It reacts in a similar way");
  expect(errors).toEqual([]);
});
