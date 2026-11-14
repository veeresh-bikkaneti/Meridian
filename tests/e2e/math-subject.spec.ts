import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Math subject screen — through the why-learn card and subject picker.
 *
 * The card is live for everyone (subjects launch, Nov 13). Its CTA
 * opens the subject picker; the Math row opens a math case dealt for
 * the player's age band (profile seeded in localStorage, the
 * band-media-variants pattern). One case per band is played through to
 * the result, which must carry the "You just used this in…" line.
 * Screenshots land in math-shots/ (outside test-results, which
 * Playwright clears).
 */
test.setTimeout(120_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";
const PROFILE_KEY = "meridian.ageProfile.v1";
const SHOTS = "math-shots";

type Band = "7-10" | "10-18" | "18+";

async function setup(context: BrowserContext, band?: Band) {
  await serveBuiltArtifact(context);
  await context.route("**/flags.json", (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ version: 1, flags: { pwaUpdateToast: true } }),
      contentType: "application/json; charset=utf-8",
    }),
  );
  if (band) {
    await context.addInitScript(
      ({ key, b }) => {
        window.localStorage.setItem(
          key,
          JSON.stringify({
            status: "active",
            band: b,
            updatedAt: new Date().toISOString(),
            changeCount: 0,
            schemaVersion: 2,
          }),
        );
      },
      { key: PROFILE_KEY, b: band },
    );
  }
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
  await card
    .getByRole("button", { name: "Why Do We Learn This?: Start exploring" })
    .click();
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

async function solveCase(page: Page, correct: string) {
  const answers = page.getByTestId("math-answer-card");
  await answers.getByRole("button", { name: correct, exact: true }).click();
  await dismissCelebration(page);
  const result = page.getByTestId("math-result");
  await expect(result).toBeVisible();
  await expect(result).toContainText("You got it!");
  await expect(page.getByTestId("math-used-in")).toContainText("You just used this in…");
}

test("no flag needed: the card is live and the picker shows the map", async ({
  page,
  context,
}) => {
  await setup(context, "7-10");
  const errors = watchErrors(page);
  await page.goto(APP_URL);
  await expect(page.getByTestId("tour-stop-geodetective")).toBeVisible();
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await card
    .getByRole("button", { name: "Why Do We Learn This?: Start exploring" })
    .click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  await expect(page.getByTestId("subject-row-math")).toBeEnabled();
  // Journals are not built yet: a disabled "Coming soon" row.
  const journals = page.getByTestId("subject-row-journals");
  await expect(journals).toBeDisabled();
  await expect(journals).toContainText("Coming soon");
  expect(errors).toEqual([]);
});

test("7-10 case: wrong pick gives kind feedback, right pick reaches the result", async ({
  page,
  context,
}) => {
  await setup(context, "7-10");
  const errors = watchErrors(page);
  await openCase(page);
  // Flag off (setup's interception carries no detectivePair): no pair.
  await expect(page.getByTestId("math-detective-pair")).toHaveCount(0);
  const mathCase = page.getByTestId("math-case");
  await expect(mathCase).toHaveAttribute("data-band", "7-10");
  await expect(mathCase).toHaveAttribute("data-item", "math-number:groups:skip-count");
  await page.screenshot({ path: `${SHOTS}/case-7-10-desktop.png` });
  await page.getByTestId("math-answer-card").screenshot({ path: `${SHOTS}/answer-card-desktop.png` });
  // A wrong pick first: kind feedback, still on the same case.
  const answers = page.getByTestId("math-answer-card");
  await answers.getByRole("button", { name: "6", exact: true }).click();
  await expect(page.getByText(/Not quite/)).toBeVisible();
  await expect(page.getByTestId("math-result")).toHaveCount(0);
  await solveCase(page, "8");
  await page.screenshot({ path: `${SHOTS}/result-7-10-desktop.png` });
  expect(errors).toEqual([]);
});

test("10-18 case plays through to the result", async ({ page, context }) => {
  await setup(context, "10-18");
  const errors = watchErrors(page);
  await openCase(page);
  const mathCase = page.getByTestId("math-case");
  await expect(mathCase).toHaveAttribute("data-band", "10-18");
  await expect(mathCase).toHaveAttribute("data-item", "math-number:tables:multi-digit");
  await solveCase(page, "1,081");
  expect(errors).toEqual([]);
});

test("18+ case plays through to the result", async ({ page, context }) => {
  await setup(context, "18+");
  const errors = watchErrors(page);
  await openCase(page);
  const mathCase = page.getByTestId("math-case");
  await expect(mathCase).toHaveAttribute("data-band", "18+");
  await expect(mathCase).toHaveAttribute("data-item", "math-number:tables:mental-strategies");
  await solveCase(page, "360");
  expect(errors).toEqual([]);
});

test("reduced motion: the case still renders and plays", async ({ page, context }) => {
  await setup(context, "10-18");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = watchErrors(page);
  await openCase(page);
  await solveCase(page, "1,081");
  expect(errors).toEqual([]);
});

/**
 * Holmes & Watson in the math case (follow-up): with detectivePair
 * forced ON by a second flags interception (registered after setup's,
 * so it wins — the detective-flag.spec.ts pattern), the pair's bench
 * strip mounts above the case, both rigs render, and answer picks
 * change the pair's poses / speaking classes. Audio itself is not
 * asserted by ear: the rig classes are the player's speaking output.
 */
async function setupPair(context: BrowserContext, band?: Band) {
  await setup(context, band);
  await context.route("**/flags.json", (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        version: 1,
        flags: { pwaUpdateToast: true, detectivePair: true },
      }),
      contentType: "application/json; charset=utf-8",
    }),
  );
}

test("detectivePair on (desktop): pair mounts, wrong pick acks, right pick celebrates", async ({
  page,
  context,
}) => {
  await setupPair(context, "7-10");
  const errors = watchErrors(page);
  await openCase(page);
  const pair = page.getByTestId("math-detective-pair");
  await expect(pair).toBeVisible();
  const holmes = pair.locator(".detective-holmes");
  const watson = pair.locator(".detective-watson");
  await expect(holmes).toBeVisible();
  await expect(watson).toBeVisible();
  // Resting poses: Holmes searching, Watson reading.
  await expect(holmes).toHaveAttribute("data-pose", "search");
  await expect(watson).toHaveAttribute("data-pose", "read");

  // Wrong pick: the event lands and Holmes takes the ack pose with
  // the speaking class while his ack clip sounds (sampled into a set
  // so a mid-clip poll is enough — the pose reverts when it drains).
  await page
    .getByTestId("math-answer-card")
    .getByRole("button", { name: "6", exact: true })
    .click();
  await expect(pair).toHaveAttribute("data-event", "wrong");
  const seenWrong = new Set<string>();
  await expect
    .poll(
      async () => {
        const cls = await holmes.getAttribute("class");
        if (cls) seenWrong.add(cls);
        return [...seenWrong].some(
          (c) => c.includes("detective-pose-ack") && c.includes("detective-speaking"),
        );
      },
      { timeout: 10_000 },
    )
    .toBe(true);

  // Right pick: Holmes celebrates while win-holmes sounds.
  await page
    .getByTestId("math-answer-card")
    .getByRole("button", { name: "8", exact: true })
    .click();
  await expect(pair).toHaveAttribute("data-event", "correct");
  const seenRight = new Set<string>();
  await expect
    .poll(
      async () => {
        const cls = await holmes.getAttribute("class");
        if (cls) seenRight.add(cls);
        return [...seenRight].some((c) => c.includes("detective-pose-celebrate-jump"));
      },
      { timeout: 10_000 },
    )
    .toBe(true);
  await dismissCelebration(page);
  await expect(page.getByTestId("math-result")).toBeVisible();
  expect(errors).toEqual([]);
});

test("detectivePair on (390px): pair visible and never covering the answer buttons", async ({
  page,
  context,
}) => {
  await setupPair(context, "7-10");
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = watchErrors(page);
  await openCase(page);
  const pair = page.getByTestId("math-detective-pair");
  await expect(pair).toBeVisible();
  await expect(pair.locator(".detective-holmes")).toBeVisible();
  await expect(pair.locator(".detective-watson")).toBeVisible();
  const pairBox = await pair.boundingBox();
  const answersBox = await page.getByTestId("math-answer-card").boundingBox();
  expect(pairBox).not.toBeNull();
  expect(answersBox).not.toBeNull();
  // The strip sits above the case in flow: its box ends before the
  // answer card's box begins, so it can never cover the buttons.
  expect(pairBox!.y + pairBox!.height).toBeLessThanOrEqual(answersBox!.y);
  expect(errors).toEqual([]);
});

test("detectivePair on (reduced motion): pair visible, still, case still plays", async ({
  page,
  context,
}) => {
  await setupPair(context, "10-18");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = watchErrors(page);
  await openCase(page);
  const pair = page.getByTestId("math-detective-pair");
  await expect(pair).toBeVisible();
  await expect(pair.locator(".detective-holmes")).toBeVisible();
  await expect(pair.locator(".detective-watson")).toBeVisible();
  // detective.css's reduced-motion block kills every rig animation:
  // the breathing bob part computes to no animation.
  const bobAnimation = await pair
    .locator('.detective-holmes [data-part="bob"]')
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(bobAnimation).toBe("none");
  await solveCase(page, "1,081");
  expect(errors).toEqual([]);
});

test("390px: Home card, case, answer card and result render on a phone", async ({
  page,
  context,
}) => {
  await setup(context, "7-10");
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = watchErrors(page);
  await page.goto(APP_URL);
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await card.screenshot({ path: `${SHOTS}/home-card-390.png` });
  await card.getByRole("button", { name: "Why Do We Learn This?: Start exploring" }).click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  await page.getByTestId("subject-row-math").click();
  await expect(page.getByTestId("math-case")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/case-7-10-390.png` });
  await solveCase(page, "8");
  await page.screenshot({ path: `${SHOTS}/result-7-10-390.png` });
  expect(errors).toEqual([]);
});
