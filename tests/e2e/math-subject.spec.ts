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
  await expect(page.getByTestId("subject-detective-pair")).toHaveCount(0);
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
 * Holmes & Watson in the subject cases (Stream E): the pair mounts
 * ONCE in the shared SubjectCase, so every subject gets it. With
 * detectivePair forced ON by a second flags interception (registered
 * after setup's, so it wins — the detective-flag.spec.ts pattern),
 * the strip renders inside the case; picks move its signal poses.
 * Audio is asserted on the page's audio elements (registered by a
 * play() patch below), never by ear.
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
  // Track every audio element that ever plays, and the maximum
  // number sounding at once (the one-voice assertion).
  await context.addInitScript(() => {
    const w = window as unknown as {
      __audioEls: HTMLAudioElement[];
      __maxConcurrentAudio: number;
    };
    w.__audioEls = [];
    w.__maxConcurrentAudio = 0;
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      if (this instanceof HTMLAudioElement && !w.__audioEls.includes(this)) {
        w.__audioEls.push(this);
      }
      return orig.call(this);
    };
    window.setInterval(() => {
      const now = w.__audioEls.filter((a) => !a.paused && !a.ended).length;
      if (now > w.__maxConcurrentAudio) w.__maxConcurrentAudio = now;
    }, 25);
  });
}

async function openChemistryCase(page: Page) {
  await page.goto(APP_URL);
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await card
    .getByRole("button", { name: "Why Do We Learn This?: Start exploring" })
    .click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  await page.getByTestId("subject-row-chemistry").click();
  await expect(page.getByTestId("chemistry-case")).toBeVisible();
}

test("detectivePair on (desktop, 7-10): pair mounts, wrong is silent, right celebrates, never two voices", async ({
  page,
  context,
}) => {
  await setupPair(context, "7-10");
  const errors = watchErrors(page);
  await openCase(page);
  const pair = page.getByTestId("subject-detective-pair");
  await expect(pair).toBeVisible();
  const holmes = pair.locator(".detective-holmes");
  const watson = pair.locator(".detective-watson");
  await expect(holmes).toBeVisible();
  await expect(watson).toBeVisible();
  await expect(pair).toHaveAttribute("data-signal", "open");
  // Resting poses: Holmes searching, Watson reading.
  await expect(holmes).toHaveAttribute("data-pose", "search");
  await expect(watson).toHaveAttribute("data-pose", "read");

  // Wrong pick: the signal lands, the pair stays in resting poses
  // and requests NO clip (wrong = silence by the clip rules).
  const srcsBefore = await page.evaluate(() =>
    (
      window as unknown as { __audioEls: HTMLAudioElement[] }
    ).__audioEls.map((a) => a.currentSrc || a.src),
  );
  await page
    .getByTestId("math-answer-card")
    .getByRole("button", { name: "6", exact: true })
    .click();
  await expect(pair).toHaveAttribute("data-signal", "wrong");
  await page.waitForTimeout(600);
  await expect(holmes).toHaveAttribute("data-pose", "search");
  const srcsAfterWrong = await page.evaluate(() =>
    (
      window as unknown as { __audioEls: HTMLAudioElement[] }
    ).__audioEls.map((a) => a.currentSrc || a.src),
  );
  expect(srcsAfterWrong).toEqual(srcsBefore);

  // Right pick: Holmes celebrates while win-holmes sounds.
  await page
    .getByTestId("math-answer-card")
    .getByRole("button", { name: "8", exact: true })
    .click();
  await expect(pair).toHaveAttribute("data-signal", "correct");
  const seenRight = new Set<string>();
  await expect
    .poll(
      async () => {
        const cls = await holmes.getAttribute("class");
        if (cls) seenRight.add(cls);
        return [...seenRight].some(
          (c) =>
            c.includes("detective-pose-celebrate-jump") &&
            c.includes("detective-speaking"),
        );
      },
      { timeout: 10_000 },
    )
    .toBe(true);
  await dismissCelebration(page);
  await expect(page.getByTestId("math-result")).toBeVisible();

  // One voice: across the whole case, never two audio elements
  // sounding at once.
  const maxConcurrent = await page.evaluate(
    () => (window as unknown as { __maxConcurrentAudio: number }).__maxConcurrentAudio,
  );
  expect(maxConcurrent).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("detectivePair on (desktop, 7-10): solving the last item finishes — both celebrate, silently", async ({
  page,
  context,
}) => {
  await setupPair(context, "7-10");
  const errors = watchErrors(page);
  await openCase(page);
  const pair = page.getByTestId("subject-detective-pair");
  await expect(pair).toBeVisible();
  // Items 1 and 2 via the Next-case cycle, then the last item.
  await solveCase(page, "8");
  await page.getByRole("button", { name: "🔎 Next case" }).click();
  await solveCase(page, "24");
  await page.getByRole("button", { name: "🔎 Next case" }).click();
  await page
    .getByTestId("math-answer-card")
    .getByRole("button", { name: "4", exact: true })
    .click();
  await expect(pair).toHaveAttribute("data-signal", "finished");
  // Finished is visual only: BOTH rigs hold the celebrate pose.
  await expect(pair.locator(".detective-holmes")).toHaveAttribute(
    "data-pose",
    "celebrate-jump",
  );
  await expect(pair.locator(".detective-watson")).toHaveAttribute(
    "data-pose",
    "celebrate-jump",
  );
  await dismissCelebration(page);
  await expect(page.getByTestId("math-result")).toBeVisible();
  expect(errors).toEqual([]);
});

test("detectivePair on (chemistry, 10-18): the shared mount gives chemistry the pair too", async ({
  page,
  context,
}) => {
  await setupPair(context, "10-18");
  const errors = watchErrors(page);
  await openChemistryCase(page);
  const pair = page.getByTestId("subject-detective-pair");
  await expect(pair).toBeVisible();
  await expect(pair.locator(".detective-holmes")).toBeVisible();
  await expect(pair.locator(".detective-watson")).toBeVisible();
  await page
    .getByTestId("chemistry-answer-card")
    .getByRole("button", {
      name: "It lowers the freezing point of the water",
      exact: true,
    })
    .click();
  await dismissCelebration(page);
  await expect(page.getByTestId("chemistry-result")).toBeVisible();
  expect(errors).toEqual([]);
});

test("detectivePair on (18+): pair visible and the case plays to the result", async ({
  page,
  context,
}) => {
  await setupPair(context, "18+");
  const errors = watchErrors(page);
  await openCase(page);
  const pair = page.getByTestId("subject-detective-pair");
  await expect(pair).toBeVisible();
  await expect(pair.locator(".detective-holmes")).toBeVisible();
  await expect(pair.locator(".detective-watson")).toBeVisible();
  await solveCase(page, "360");
  expect(errors).toEqual([]);
});

test("detectivePair OFF: text-only parity with main — no rigs, no pair audio requests", async ({
  page,
  context,
}) => {
  await setup(context, "7-10");
  const errors = watchErrors(page);
  const pairAudioRequests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/audio/detective/")) pairAudioRequests.push(req.url());
  });
  await openCase(page);
  await solveCase(page, "8");
  await expect(page.getByTestId("subject-detective-pair")).toHaveCount(0);
  await expect(page.locator("[data-detective]")).toHaveCount(0);
  expect(pairAudioRequests).toEqual([]);
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
  const pair = page.getByTestId("subject-detective-pair");
  await expect(pair).toBeVisible();
  await expect(pair.locator(".detective-holmes")).toBeVisible();
  await expect(pair.locator(".detective-watson")).toBeVisible();
  const pairBox = await pair.boundingBox();
  const answersBox = await page.getByTestId("math-answer-card").boundingBox();
  expect(pairBox).not.toBeNull();
  expect(answersBox).not.toBeNull();
  // The strip sits above the answer card in flow: its box ends
  // before the answer card's box begins, so it can never cover the
  // buttons.
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
  const pair = page.getByTestId("subject-detective-pair");
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
