import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Math clue scenes (pilot, feat/clue-scene-pilot) — mobile, 390 px.
 *
 * For ages 7-10, three math items carry a short live-drawn film
 * above the text clue: the setup film sets the scene only (never
 * the answer), and the solved beat plays after a correct pick.
 * This spec walks the 7-10 deal order to all three pilot items,
 * screenshots the setup and solved frames, and checks that an
 * item without a scene still shows the plain clue card. The
 * desktop twin (math-clue-scene.desktop.spec.ts) runs the same
 * walk on a wide viewport; the reduced twin pins the stills.
 */
test.setTimeout(240_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";
const PROFILE_KEY = "meridian.ageProfile.v1";
const SHOTS = "clue-scene-shots";
const PROJECT = "mobile";

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

async function openCase(page: Page) {
  await page.goto(APP_URL);
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await card.getByRole("button", { name: "Why Do We Learn This?: Start exploring" }).click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  await page.getByTestId("subject-row-math").click();
  await expect(page.getByTestId("math-case")).toBeVisible();
  await expect(page.getByTestId("math-answer-card")).toBeVisible();
}

async function dismissCelebration(page: Page) {
  const close = page.getByRole("button", { name: "Close celebration" });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
    await expect(close).toHaveCount(0);
  }
}

async function solveAndNext(page: Page, correct: string) {
  await page
    .getByTestId("math-answer-card")
    .getByRole("button", { name: correct, exact: true })
    .click();
  await dismissCelebration(page);
  await expect(page.getByTestId("math-result")).toBeVisible();
  await page.getByRole("button", { name: /Next case/ }).click();
  await expect(page.getByTestId("math-answer-card")).toBeVisible();
}

/** Screenshot the scene's setup frame, solve, screenshot the solved frame. */
async function filmCase(page: Page, item: string, correct: string, slug: string, setupLabel: string) {
  const mathCase = page.getByTestId("math-case");
  await expect(mathCase).toHaveAttribute("data-item", item);
  const scene = page.getByTestId("clue-scene");
  await expect(scene).toBeVisible();
  await expect(scene).toHaveAttribute("data-phase", "setup");
  // The setup film shows the scene only — its label names no answer.
  await expect(scene.locator("svg")).toHaveAttribute("aria-label", setupLabel);
  await page.waitForTimeout(3_800);
  await scene.screenshot({ path: `${SHOTS}/${slug}-setup-${PROJECT}.png` });
  await page
    .getByTestId("math-answer-card")
    .getByRole("button", { name: correct, exact: true })
    .click();
  await dismissCelebration(page);
  await expect(page.getByTestId("math-result")).toBeVisible();
  await expect(scene).toHaveAttribute("data-phase", "solved");
  await page.waitForTimeout(6_200);
  await scene.screenshot({ path: `${SHOTS}/${slug}-solved-${PROJECT}.png` });
  await page.getByRole("button", { name: /Next case/ }).click();
  await expect(page.getByTestId("math-answer-card")).toBeVisible();
}

test("clue scenes: setup hides the answer, solved beat plays, plain items unchanged", async ({
  page,
  context,
}) => {
  await setup(context);
  const errors = watchErrors(page);
  await openCase(page);

  // Case 1 is the coin scene.
  await filmCase(
    page,
    "math-number:groups:skip-count",
    "8",
    "skip-count",
    "Coins wait in a loose pile on a table, ready to be counted.",
  );

  // The next item has no scene: the plain clue card, unchanged.
  await expect(page.getByTestId("math-case")).toHaveAttribute(
    "data-item",
    "math-number:groups:equal-groups",
  );
  await expect(page.getByTestId("clue-scene")).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/plain-clue-${PROJECT}.png` });

  // Walk the deal order to the pencil packs (case 8).
  await solveAndNext(page, "24");
  await solveAndNext(page, "4");
  await solveAndNext(page, "345");
  await solveAndNext(page, "385");
  await solveAndNext(page, "300");
  await solveAndNext(page, "700");
  await filmCase(
    page,
    "math-number:tables:facts",
    "28",
    "facts",
    "Packs of pencils stand in a row on a shelf.",
  );

  // One plain case, then the fair-share scene (case 10).
  await solveAndNext(page, "1,008");
  await filmCase(
    page,
    "math-number:division:fair-share",
    "3",
    "fair-share",
    "A plate of snacks sits on a table, with friends waiting around it.",
  );

  expect(errors).toEqual([]);
});
