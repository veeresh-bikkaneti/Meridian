import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Physics clue scenes (wave 6, ages 18+) — reduced motion.
 *
 * With prefers-reduced-motion the scene renders the still frame
 * of the current phase: the setup still before the pick, the
 * solved still after it, and no Replay control (nothing can
 * move). Pins the slope-pair scene end to end, then the remaining two
 * wave-6 kinds (journey-line, energy-ledger), solving forward
 * through the items between them.
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
  "physics:ramp:adult-ratio": "Boom B",
  "physics:arrive:adult-time": "3 hours",
  "physics:energy:missing": "5 units",
};

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

async function openCase(page: Page) {
  await page.goto(APP_URL);
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await card.getByRole("button", { name: "Why Do We Learn This?: Start exploring" }).click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  await page.getByTestId("subject-row-physics").click();
  await expect(page.getByTestId("physics-case")).toBeVisible();
  await expect(page.getByTestId("physics-answer-card")).toBeVisible();
}

async function dismissCelebration(page: Page) {
  const close = page.getByRole("button", { name: "Close celebration" });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
    await expect(close).toHaveCount(0);
  }
}

async function solveForwardTo(page: Page, item: string) {
  for (let guard = 0; guard < 3; guard++) {
    const current = await page.getByTestId("physics-case").getAttribute("data-item");
    if (current === item) return;
    const correct = CORRECT[current!];
    await page
      .getByTestId("physics-answer-card")
      .getByRole("button", { name: correct!, exact: true })
      .click();
    await dismissCelebration(page);
    await expect(page.getByTestId("physics-result")).toBeVisible();
    await page.getByRole("button", { name: /Next case/ }).click();
    await expect(page.getByTestId("physics-answer-card")).toBeVisible();
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
    .getByTestId("physics-answer-card")
    .getByRole("button", { name: CORRECT[item]!, exact: true })
    .click();
  await dismissCelebration(page);
  await expect(page.getByTestId("physics-result")).toBeVisible();
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

test("reduced motion: slope-pair still frames, summary waits for a tap", async ({ page, context }) => {
  await setup(context);
  const errors = watchErrors(page);
  await openCase(page);
  await pinStill(page, "physics:ramp:adult-ratio", "adult-ratio", "Boom B is steeper", true);
  expect(errors).toEqual([]);
});

test("reduced motion: wave-6 kinds also stand still, summaries wait for a tap", async ({
  page,
  context,
}) => {
  await setup(context);
  const errors = watchErrors(page);
  await openCase(page);
  await pinStill(page, "physics:arrive:adult-time", "adult-time", "3 hours");
  await page.getByRole("button", { name: /Next case/ }).click();
  await expect(page.getByTestId("physics-answer-card")).toBeVisible();
  await pinStill(page, "physics:energy:missing", "energy-missing", "5 units");
  expect(errors).toEqual([]);
});
