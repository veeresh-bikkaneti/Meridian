import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * General knowledge clue scenes (wave 10) — desktop, ages 18+.
 *
 * For ages 18+, every general-knowledge item carries a short live-drawn film
 * above the text clue: the setup film sets the scene only (never
 * the answer), and the solved beat plays after a correct pick.
 * This spec walks the full 18+ deal order, screenshots the setup
 * and solved frames of every scene in the band, and pins act 3 on
 * each: after the correct pick (never a wrong one) the solved
 * case carries the narrated summary — its full script as standing
 * text in the result section, the play control in the scene card,
 * and the performance under way (data-summary). The mobile twin
 * (gk-clue-scene-18plus.mobile.spec.ts) runs the same walk at 390 px;
 * the reduced twin pins the still frames.
 */
test.setTimeout(600_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";
const PROFILE_KEY = "meridian.ageProfile.v1";
const SHOTS = "clue-scene-shots";
const PROJECT = "desktop";

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
  await page.getByTestId("subject-row-general-knowledge").click();
  await expect(page.getByTestId("general-knowledge-case")).toBeVisible();
  await expect(page.getByTestId("general-knowledge-answer-card")).toBeVisible();
}

async function dismissCelebration(page: Page) {
  const close = page.getByRole("button", { name: "Close celebration" });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
    await expect(close).toHaveCount(0);
  }
}

/** Screenshot the scene's setup frame, solve, screenshot the solved frame. */
async function filmCase(
  page: Page,
  item: string,
  correct: string,
  slug: string,
  setupLabel: string,
  wrong: string,
  summarySnippet: string,
  isLast: boolean,
) {
  const gkCase = page.getByTestId("general-knowledge-case");
  await expect(gkCase).toHaveAttribute("data-item", item);
  const scene = page.getByTestId("clue-scene");
  await expect(scene).toBeVisible();
  await expect(scene).toHaveAttribute("data-phase", "setup");
  // The setup film shows the scene only — its label names no answer.
  await expect(scene.locator("svg")).toHaveAttribute("aria-label", setupLabel);
  // Act 3 stays out of the setup phase entirely: no summary text,
  // no play control, no caption, no performance state.
  await expect(page.getByTestId("clue-summary-text")).toHaveCount(0);
  await expect(page.getByTestId("clue-summary-play")).toHaveCount(0);
  await expect(page.getByTestId("clue-scene-caption")).toHaveCount(0);
  await expect(scene).not.toHaveAttribute("data-summary", /./);
  await page.waitForTimeout(3_800);
  await scene.screenshot({ path: `${SHOTS}/${slug}-setup-${PROJECT}.png` });
  // A wrong pick changes nothing: still setup, still no summary.
  await page
    .getByTestId("general-knowledge-answer-card")
    .getByRole("button", { name: wrong, exact: true })
    .click();
  await expect(scene).toHaveAttribute("data-phase", "setup");
  await expect(page.getByTestId("clue-summary-text")).toHaveCount(0);
  await expect(page.getByTestId("clue-summary-play")).toHaveCount(0);
  await page
    .getByTestId("general-knowledge-answer-card")
    .getByRole("button", { name: correct, exact: true })
    .click();
  await dismissCelebration(page);
  await expect(page.getByTestId("general-knowledge-result")).toBeVisible();
  await expect(scene).toHaveAttribute("data-phase", "solved");
  // Act 3: the summary's full script stands in the result section,
  // its play control sits in the scene card, and the performance
  // starts itself (read-aloud unset, sound on).
  const summaryText = page.getByTestId("clue-summary-text");
  await expect(summaryText).toBeVisible();
  await expect(summaryText).toContainText(summarySnippet);
  await expect(page.getByTestId("clue-summary-play")).toBeVisible();
  await expect(scene).toHaveAttribute("data-summary", "playing");
  // The captions step as the narration lands.
  await expect
    .poll(async () => (await page.getByTestId("clue-scene-caption").innerText()).trim().length, {
      timeout: 12_000,
    })
    .toBeGreaterThan(0);
  await page.waitForTimeout(6_200);
  await scene.screenshot({ path: `${SHOTS}/${slug}-solved-${PROJECT}.png` });
  if (!isLast) {
    await page.getByRole("button", { name: /Next case/ }).click();
    await expect(page.getByTestId("general-knowledge-answer-card")).toBeVisible();
  }
}

// The full 18+ deal order: item, correct pick, screenshot slug,
// the setup label (answer-blind), one wrong pick, and a line from
// the summary's closing that must stand in the result section.
const CASES: [string, string, string, string, string, string][] = [
  [
    "general-knowledge:mixed:great-circle",
    "8,000 to 8,500 km",
    "everest-falls",
    "A globe and a flat map each carry two pins, a peak and a falls.",
    "800 to 850 km",
    "8,000 to 8,500 km",
  ],
  [
    "general-knowledge:mixed:falls-flow",
    "7.2 × 10^11 litres",
    "falls-flow",
    "A waterfall pours into its pool.",
    "7.2 × 10^9 litres",
    "7.2 × 10^11 litres",
  ],
];

test("clue scenes: every 18+ case sets up blind, solves, and narrates", async ({
  page,
  context,
}) => {
  await setup(context);
  const errors = watchErrors(page);
  await openCase(page);
  for (let i = 0; i < CASES.length; i++) {
    const [item, correct, slug, setupLabel, wrong, snippet] = CASES[i]!;
    await filmCase(page, item, correct, slug, setupLabel, wrong, snippet, i === CASES.length - 1);
  }
  expect(errors).toEqual([]);
});
