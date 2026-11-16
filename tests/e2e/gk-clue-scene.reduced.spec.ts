import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * General knowledge clue scenes (wave 10) — reduced motion,
 * ages 10-18 and 18+.
 *
 * With prefers-reduced-motion the scene renders the still frame
 * of the current phase: the setup still before the pick, the
 * solved still after it, and no Replay control (nothing can
 * move). This spec pins every wave-10 item in both bands end to
 * end: the stack-drops, journey-line and angle-sight scenes for
 * ages 10-18, and the great-circle and flow-counter scenes for
 * ages 18+.
 *
 * Act 3 under reduced motion: the summary never auto-plays. The
 * solved still stands, the full script stands as text in the
 * result section, and the summary's own play control is offered —
 * tapping it runs the voice and captions against the still.
 */
test.setTimeout(300_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";
const PROFILE_KEY = "meridian.ageProfile.v1";
const SHOTS = "clue-scene-shots";

async function setup(context: BrowserContext, band: string) {
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
  await page.getByTestId("subject-row-general-knowledge").click();
  await expect(page.getByTestId("general-knowledge-case")).toBeVisible();
  await expect(page.getByTestId("general-knowledge-answer-card")).toBeVisible();
}

async function pinStill(
  page: Page,
  item: string,
  correct: string,
  slug: string,
  snippet: string,
  tapHear: boolean,
) {
  await expect(page.getByTestId("general-knowledge-case")).toHaveAttribute("data-item", item);
  const scene = page.getByTestId("clue-scene");
  await expect(scene).toBeVisible();
  await expect(scene).toHaveAttribute("data-phase", "setup");
  await expect(scene).toHaveAttribute("data-still", "true");
  await expect(page.getByTestId("clue-summary-text")).toHaveCount(0);
  await scene.screenshot({ path: `${SHOTS}/${slug}-setup-reduced.png` });
  await page
    .getByTestId("general-knowledge-answer-card")
    .getByRole("button", { name: correct, exact: true })
    .click();
  const close = page.getByRole("button", { name: "Close celebration" });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
    await expect(close).toHaveCount(0);
  }
  await expect(page.getByTestId("general-knowledge-result")).toBeVisible();
  await expect(scene).toHaveAttribute("data-phase", "solved");
  await expect(scene).toHaveAttribute("data-still", "true");
  await expect(scene).toHaveAttribute("data-summary", "idle");
  await expect(page.getByRole("button", { name: "↻ Replay the film" })).toHaveCount(0);
  const summaryText = page.getByTestId("clue-summary-text");
  await expect(summaryText).toBeVisible();
  await expect(summaryText).toContainText(snippet);
  await expect(page.getByTestId("clue-summary-play")).toBeVisible();
  await scene.screenshot({ path: `${SHOTS}/${slug}-solved-reduced.png` });
  if (tapHear) {
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

test("reduced motion: every 10-18 case stands still, summaries wait for a tap", async ({
  page,
  context,
}) => {
  await setup(context, "10-18");
  const errors = watchErrors(page);
  await openCase(page);
  await pinStill(
    page,
    "general-knowledge:mixed:everest-vs-falls",
    "About 80",
    "everest-stack",
    "About 80 drops",
    true,
  );
  await page.getByRole("button", { name: /Next case/ }).click();
  await expect(page.getByTestId("general-knowledge-answer-card")).toBeVisible();
  await pinStill(
    page,
    "general-knowledge:mixed:paris-sydney-flight",
    "About 20 hours",
    "paris-sydney",
    "About 20 hours",
    false,
  );
  await page.getByRole("button", { name: /Next case/ }).click();
  await expect(page.getByTestId("general-knowledge-answer-card")).toBeVisible();
  await pinStill(
    page,
    "general-knowledge:mixed:tower-angle",
    "About 1,072 feet",
    "tower-angle",
    "About 1,072 feet",
    false,
  );
  expect(errors).toEqual([]);
});

test("reduced motion: every 18+ case stands still, summaries wait for a tap", async ({
  page,
  context,
}) => {
  await setup(context, "18+");
  const errors = watchErrors(page);
  await openCase(page);
  await pinStill(
    page,
    "general-knowledge:mixed:great-circle",
    "8,000 to 8,500 km",
    "everest-falls",
    "8,000 to 8,500 km",
    true,
  );
  await page.getByRole("button", { name: /Next case/ }).click();
  await expect(page.getByTestId("general-knowledge-answer-card")).toBeVisible();
  await pinStill(
    page,
    "general-knowledge:mixed:falls-flow",
    "7.2 × 10^11 litres",
    "falls-flow",
    "7.2 × 10^11 litres",
    false,
  );
  expect(errors).toEqual([]);
});
