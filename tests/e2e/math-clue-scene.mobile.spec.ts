import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Math clue scenes (pilot + wave 1) — mobile, 390 px.
 *
 * For ages 7-10, every math item carries a short live-drawn film
 * above the text clue: the setup film sets the scene only (never
 * the answer), and the solved beat plays after a correct pick.
 * This spec walks the full 7-10 deal order, screenshots the setup
 * and solved frames of all thirteen scenes, and pins act 3 on
 * each: after the correct pick (never a wrong one) the solved
 * case carries the narrated summary — its full script as standing
 * text in the result section, the play control in the scene card,
 * and the performance under way (data-summary). The mobile twin
 * (math-clue-scene.mobile.spec.ts) runs the same walk at 390 px;
 * the reduced twin pins the still frames.
 */
test.setTimeout(600_000);

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
  const mathCase = page.getByTestId("math-case");
  await expect(mathCase).toHaveAttribute("data-item", item);
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
    .getByTestId("math-answer-card")
    .getByRole("button", { name: wrong, exact: true })
    .click();
  await expect(scene).toHaveAttribute("data-phase", "setup");
  await expect(page.getByTestId("clue-summary-text")).toHaveCount(0);
  await expect(page.getByTestId("clue-summary-play")).toHaveCount(0);
  await page
    .getByTestId("math-answer-card")
    .getByRole("button", { name: correct, exact: true })
    .click();
  await dismissCelebration(page);
  await expect(page.getByTestId("math-result")).toBeVisible();
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
    await expect(page.getByTestId("math-answer-card")).toBeVisible();
  }
}

// The full 7-10 deal order: item, correct pick, screenshot slug,
// the setup label (answer-blind), one wrong pick, and a line from
// the summary's closing that must stand in the result section.
const CASES: [string, string, string, string, string, string][] = [
  [
    "math-number:groups:skip-count",
    "8",
    "skip-count",
    "Coins wait in a loose pile on a table, ready to be counted.",
    "6",
    "Counting in fives finds the groups fast",
  ],
  [
    "math-number:groups:equal-groups",
    "24",
    "equal-groups",
    "Boxes of pencils stand in a row on a shelf.",
    "18",
    "Four boxes of six make 24 pencils",
  ],
  [
    "math-number:tables:buses",
    "4",
    "buses",
    "Children wait in a line at the bus stop.",
    "3",
    "24 children need 4 buses",
  ],
  [
    "math-number:place:hundreds-tens-ones",
    "345",
    "hundreds-tens-ones",
    "Notes and coins wait in piles on the counter.",
    "354",
    "build 345",
  ],
  [
    "math-number:place:compare",
    "385",
    "place-compare",
    "Two routes wait side by side, their steps laid out in places.",
    "358",
    "longer route is 385 steps",
  ],
  [
    "math-number:place:round",
    "300",
    "rounding",
    "A marker waits on a line between two hundreds.",
    "200",
    "banner says 300",
  ],
  [
    "math-number:place:ten-times",
    "700",
    "ten-times",
    "Stones mark a path, each stone standing for ten steps.",
    "77",
    "70 becomes 700",
  ],
  [
    "math-number:tables:facts",
    "28",
    "facts",
    "Packs of pencils stand in a row on a shelf.",
    "11",
    "four times table at work",
  ],
  [
    "math-number:tables:big-products",
    "1,008",
    "big-products",
    "Rows of chairs wait in a hall.",
    "968",
    "800 and 208 make 1008",
  ],
  [
    "math-number:division:fair-share",
    "3",
    "fair-share",
    "A plate of snacks sits on a table, with friends waiting around it.",
    "2",
    "Sharing one by one keeps it fair",
  ],
  [
    "math-number:division:unknown-factor",
    "5",
    "unknown-factor",
    "Pencils wait in a loose pile, ready to be packed.",
    "4",
    "5 boxes for all 40 pencils",
  ],
  [
    "math-number:division:remainders",
    "5",
    "remainders",
    "Children wait in a line at the bus stop.",
    "4",
    "5 buses for all 26 children",
  ],
  [
    "math-number:division:big-quotients",
    "156",
    "big-quotients",
    "A tall pile of books waits beside empty shelves.",
    "146",
    "156 books",
  ],
];

test("clue scenes: every 7-10 case sets up blind, solves, and narrates", async ({
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
