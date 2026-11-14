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

/* ---- Holmes and Watson in the subject cases (Stream E) ---------------
 * The pair mounts behind detectivePair, the same flag LoopScreen uses.
 * These tests turn it on for the context (a later route wins over the
 * setup route above), count how many media elements play at once, and
 * check the win moment. Screenshots land in the session scratchpad. */
const PAIR_FLAGS = {
  version: 1,
  flags: { pwaUpdateToast: true, detectivePair: true, hostsStaging: true },
};
const PAIR_SHOTS = "/tmp/claude-0/-home-user-Meridian/8f07725c-b633-5911-8821-ca31996281bd/scratchpad/stream-e";

async function pairFlags(context: BrowserContext) {
  await context.route("**/flags.json", (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify(PAIR_FLAGS),
      contentType: "application/json; charset=utf-8",
    }),
  );
}

/** Count how many audible media elements are playing at once (max over
 * the run). Reads each element's live `paused` and `ended` state rather
 * than its events: a pause() takes effect at once, while the `pause`
 * event fires later as a queued task, so an event-driven set would
 * over-count a voice that was already stopped. */
async function trackAudio(context: BrowserContext) {
  await context.addInitScript(() => {
    const w = window as unknown as { __maxAudio: number; __peak: string[] };
    w.__maxAudio = 0;
    w.__peak = [];
    const live = new Set<HTMLMediaElement>();
    const origPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      // Only audible media count: the muted background films are not voices.
      if (this.muted || this.volume === 0) return origPlay.call(this);
      live.add(this);
      const p = origPlay.call(this);
      p.catch(() => live.delete(this));
      const active = [...live].filter((e) => !e.paused && !e.ended);
      if (active.length > w.__maxAudio) {
        w.__maxAudio = active.length;
        w.__peak = active.map((e) => `${e.tagName}:${e.currentSrc || e.src}`);
      }
      return p;
    };
  });
}

async function maxAudio(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __maxAudio: number }).__maxAudio);
}

async function openSubject(page: Page, id: "math" | "physics") {
  await page.goto(APP_URL);
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await card
    .getByRole("button", { name: "Why Do We Learn This?: Start exploring" })
    .click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  await page.getByTestId(`subject-row-${id}`).click();
  await expect(page.getByTestId(`${id}-case`)).toBeVisible();
}

test("pair on: Holmes and Watson show in the math case, one voice at a time, through to the win", async ({
  page,
  context,
}) => {
  await setup(context, "7-10");
  await pairFlags(context);
  await trackAudio(context);
  const errors = watchErrors(page);
  await openCase(page);
  const pair = page.getByTestId("subject-pair");
  await expect(pair).toBeVisible();
  await expect(pair).toHaveAttribute("data-state", "open");
  await page.screenshot({ path: `${PAIR_SHOTS}/math-open-desktop.png` });
  await page
    .getByTestId("math-answer-card")
    .getByRole("button", { name: "6", exact: true })
    .click();
  await expect(pair).toHaveAttribute("data-state", "wrong");
  await solveCase(page, "8");
  await expect(pair).toHaveAttribute("data-state", "correct");
  await page.screenshot({ path: `${PAIR_SHOTS}/math-win-desktop.png` });
  expect(await maxAudio(page)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("pair on: the 10-18 math case plays through with the pair", async ({ page, context }) => {
  await setup(context, "10-18");
  await pairFlags(context);
  await trackAudio(context);
  const errors = watchErrors(page);
  await openCase(page);
  await expect(page.getByTestId("subject-pair")).toBeVisible();
  await solveCase(page, "1,081");
  await expect(page.getByTestId("subject-pair")).toHaveAttribute("data-state", "correct");
  expect(await maxAudio(page)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("pair on: the 18+ math case plays through with the pair", async ({ page, context }) => {
  await setup(context, "18+");
  await pairFlags(context);
  await trackAudio(context);
  const errors = watchErrors(page);
  await openCase(page);
  await expect(page.getByTestId("subject-pair")).toBeVisible();
  await solveCase(page, "360");
  await expect(page.getByTestId("subject-pair")).toHaveAttribute("data-state", "correct");
  expect(await maxAudio(page)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("pair on: the physics case shows the pair too", async ({ page, context }) => {
  await setup(context, "7-10");
  await pairFlags(context);
  await trackAudio(context);
  const errors = watchErrors(page);
  await openSubject(page, "physics");
  await expect(page.getByTestId("subject-pair")).toBeVisible();
  await expect(page.getByTestId("subject-pair")).toHaveAttribute("data-state", "open");
  expect(await maxAudio(page)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("pair off: the math case is text only, as on main", async ({ page, context }) => {
  await setup(context, "7-10");
  const errors = watchErrors(page);
  await openCase(page);
  await expect(page.getByTestId("subject-pair")).toHaveCount(0);
  await expect(page.getByTestId("math-answer-card")).toBeVisible();
  expect(errors).toEqual([]);
});

test("pair on: reduced motion still renders the pair and the case", async ({ page, context }) => {
  await setup(context, "7-10");
  await pairFlags(context);
  const errors = watchErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openCase(page);
  await expect(page.getByTestId("subject-pair")).toBeVisible();
  expect(errors).toEqual([]);
});

test("pair on: a 390 px phone shows the pair and the win moment without sideways scroll", async ({
  page,
  context,
}) => {
  await setup(context, "7-10");
  await pairFlags(context);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openCase(page);
  await expect(page.getByTestId("subject-pair")).toBeVisible();
  await page.screenshot({ path: `${PAIR_SHOTS}/math-open-390.png` });
  await solveCase(page, "8");
  await page.screenshot({ path: `${PAIR_SHOTS}/math-win-390.png` });
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
  expect(errors).toEqual([]);
});
