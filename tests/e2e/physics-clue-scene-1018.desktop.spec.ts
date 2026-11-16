import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Physics clue scenes (wave 6, ages 10-18) — desktop.
 *
 * For ages 10-18, all nine items carry a short live-drawn film
 * above the text clue: the setup film sets the scene only
 * (never the answer), and the solved beat plays after a correct
 * pick. This spec walks the full 10-18 deal order, screenshots
 * the setup and solved frames of all nine scenes, and pins
 * act 3 on each: after the correct pick (never a wrong one) the
 * solved case carries the narrated summary — its full script as
 * standing text in the result section, the play control in the
 * scene card, and the performance under way (data-summary).
 * The mobile twin
 * (physics-clue-scene-1018.mobile.spec.ts) runs the same walk
 * at 390 px; the reduced twin pins the still frames.
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
          band: "10-18",
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
  const physCase = page.getByTestId("physics-case");
  await expect(physCase).toHaveAttribute("data-item", item);
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
    .getByTestId("physics-answer-card")
    .getByRole("button", { name: wrong, exact: true })
    .click();
  await expect(scene).toHaveAttribute("data-phase", "setup");
  await expect(page.getByTestId("clue-summary-text")).toHaveCount(0);
  await expect(page.getByTestId("clue-summary-play")).toHaveCount(0);
  await page
    .getByTestId("physics-answer-card")
    .getByRole("button", { name: correct, exact: true })
    .click();
  await dismissCelebration(page);
  await expect(page.getByTestId("physics-result")).toBeVisible();
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
    await expect(page.getByTestId("physics-answer-card")).toBeVisible();
  }
}

/** Solve a case without filming it, and move on. */
async function plainCase(
  page: Page,
  item: string,
  correct: string,
  isLast: boolean,
) {
  const physCase = page.getByTestId("physics-case");
  await expect(physCase).toHaveAttribute("data-item", item);
  await page
    .getByTestId("physics-answer-card")
    .getByRole("button", { name: correct, exact: true })
    .click();
  await dismissCelebration(page);
  await expect(page.getByTestId("physics-result")).toBeVisible();
  if (!isLast) {
    await page.getByRole("button", { name: /Next case/ }).click();
    await expect(page.getByTestId("physics-answer-card")).toBeVisible();
  }
}

// The full 10-18 deal order: item, correct pick, screenshot slug
// (null walks a case plain; every wave-6 case is filmed), the
// setup label (answer-blind), one wrong pick, and a line from
// the summary's closing that must stand in the result section.
const CASES: [string, string, string | null, string, string, string][] = [
  [
    "physics:arrive:unit-rate",
    "The 8 metres in 2 seconds cart",
    "cart-race",
    "Two carts wait at the start of a track to a bridge.",
    "The 9 metres in 3 seconds cart",
    "arrives first",
  ],
  [
    "physics:ramp:slope-ratio",
    "Ramp B",
    "slope-ratio",
    "Two ramps stand on a rise and run grid.",
    "Ramp A",
    "Ramp B is steeper",
  ],
  [
    "physics:magnet:closer",
    "The closer pair",
    "magnet-closer",
    "Two pairs of magnets rest at different gaps.",
    "The farther pair",
    "closer pair pulls harder",
  ],
  [
    "physics:push:mass",
    "The lighter cart",
    "push-mass",
    "Two carts wait, one stacked with boxes.",
    "The heavier cart",
    "the lighter cart",
  ],
  [
    "physics:push:table",
    "The trial with the larger net force",
    "push-table",
    "Two trial carts wait with their push arrows.",
    "The trial with the smaller net force",
    "larger net force",
  ],
  [
    "physics:ramp:higher-stored",
    "The higher cart",
    "higher-stored",
    "Two carts rest at different heights on one hill.",
    "The lower cart",
    "the higher cart",
  ],
  [
    "physics:energy:transfer",
    "It moved into the cup",
    "energy-transfer",
    "A ball waits beside a cup on the floor.",
    "It disappeared",
    "moved into the cup",
  ],
  [
    "physics:sound:medium",
    "The air path",
    "sound-medium",
    "A bell faces two paths across a gap to an ear.",
    "The empty path",
    "the air path carries the sound",
  ],
  [
    "physics:mirror:three-ways",
    "The mirror",
    "three-ways",
    "A lamp faces a dark cloth, a clear sheet and a mirror.",
    "The dark cloth",
    "the mirror is the one that reflects",
  ],
];

test("clue scenes: every 10-18 case sets up blind, solves, and narrates", async ({
  page,
  context,
}) => {
  await setup(context);
  const errors = watchErrors(page);
  await openCase(page);
  for (let i = 0; i < CASES.length; i++) {
    const [item, correct, slug, setupLabel, wrong, snippet] = CASES[i]!;
    if (slug === null) {
      await plainCase(page, item, correct, i === CASES.length - 1);
    } else {
      await filmCase(page, item, correct, slug, setupLabel, wrong, snippet, i === CASES.length - 1);
    }
  }
  expect(errors).toEqual([]);
});
