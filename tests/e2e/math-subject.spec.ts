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

/* ------------------------------------------------------------------ */
/* Holmes and Watson in the subject cases                              */
/* ------------------------------------------------------------------ */
/*
 * With prod's pair flags turned on HERE, by intercepting flags.json
 * (public/flags.json is never edited by a test): the pair stands in the
 * case, plays each band's case through to the result, and at no moment
 * are two voices sounding. A voice is an audio element under /audio/
 * that is playing; every play() start counts the others still sounding
 * (the one-voice-home pattern), and a 50 ms sampler double-checks.
 * Screenshots of the pair land in pair-shots/.
 */
const PAIR_SHOTS = "pair-shots";
const PROD_PAIR_FLAGS = {
  pwaUpdateToast: true,
  detectivePair: true,
  hostsStaging: true,
  watsonWalk: true,
  pair3d: true,
};

async function setupPair(context: BrowserContext, band: Band) {
  await setup(context, band);
  await context.route("**/flags.json", (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ version: 1, flags: PROD_PAIR_FLAGS }),
      contentType: "application/json; charset=utf-8",
    }),
  );
  await context.addInitScript(() => {
    const w = window as unknown as {
      __voiceMax: number;
      __voiceStarts: string[];
      __audios: HTMLMediaElement[];
    };
    w.__voiceMax = 0;
    w.__voiceStarts = [];
    w.__audios = [];
    const isVoice = (a: HTMLMediaElement) =>
      !a.muted && (a.currentSrc || a.src || "").includes("/audio/");
    const sounding = (except?: HTMLMediaElement) =>
      w.__audios.filter((a) => a !== except && isVoice(a) && !a.paused && !a.ended).length;
    const origPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      if (!w.__audios.includes(this)) w.__audios.push(this);
      if (isVoice(this) && (this.paused || this.ended)) {
        w.__voiceStarts.push(this.currentSrc || this.src);
        w.__voiceMax = Math.max(w.__voiceMax, sounding(this) + 1);
      }
      return origPlay.apply(this);
    };
    setInterval(() => {
      w.__voiceMax = Math.max(w.__voiceMax, sounding());
    }, 50);
  });
}

async function voices(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as { __voiceMax: number; __voiceStarts: string[] };
    return { max: w.__voiceMax, starts: w.__voiceStarts.map((s) => s.split("/audio/")[1] ?? s) };
  });
}

const BAND_CASES: Array<{ band: Band; item: string; wrong: string; correct: string }> = [
  { band: "7-10", item: "math-number:groups:skip-count", wrong: "6", correct: "8" },
  { band: "10-18", item: "math-number:tables:multi-digit", wrong: "", correct: "1,081" },
  { band: "18+", item: "math-number:tables:mental-strategies", wrong: "", correct: "360" },
];

for (const c of BAND_CASES) {
  test(`pair on, ${c.band}: Holmes and Watson in the math case, through to the result, one voice at a time`, async ({
    page,
    context,
  }) => {
    await setupPair(context, c.band);
    const errors = watchErrors(page);
    await openCase(page);
    await expect(page.getByTestId("math-case")).toHaveAttribute("data-item", c.item);
    const pair = page.getByTestId("subject-pair");
    await expect(pair).toBeVisible();
    await expect(pair).toHaveAttribute("data-state", "open");
    await expect(pair.locator('[data-detective="holmes"] svg')).toBeVisible();
    await expect(pair.locator('[data-detective="watson"] svg')).toBeVisible();
    await expect(pair.locator('[data-detective="holmes"] svg').first()).toHaveAttribute("data-pose", "search");
    await expect(pair.locator('[data-detective="watson"] svg').first()).toHaveAttribute("data-pose", "read");
    if (c.band === "7-10") {
      await page.screenshot({ path: `${PAIR_SHOTS}/pair-case-open-${c.band}-desktop.png` });
      await page.getByTestId("math-answer-card").getByRole("button", { name: c.wrong, exact: true }).click();
      await expect(pair).toHaveAttribute("data-state", "wrong");
      await expect(page.getByText(/Not quite/)).toBeVisible();
    }
    await solveCase(page, c.correct);
    await expect(pair).toHaveAttribute("data-state", /^(correct|finished)$/);
    await expect(page.getByTestId("subject-pair-celebrate")).toBeVisible();
    await expect(
      page.getByTestId("subject-pair-celebrate").locator('[data-detective="holmes"] svg').first(),
    ).toHaveAttribute("data-pose", "high-five");
    if (c.band === "7-10") {
      await page.screenshot({ path: `${PAIR_SHOTS}/pair-win-${c.band}-desktop.png` });
    }
    await page.waitForTimeout(2_500);
    const v = await voices(page);
    console.log(`[voices ${c.band}] max=${v.max} starts=${JSON.stringify(v.starts)}`);
    expect(v.max).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}

test("pair on: Watson's case-open line plays, and the win line stops it (one voice)", async ({
  page,
  context,
}) => {
  await setupPair(context, "7-10");
  const errors = watchErrors(page);
  await openCase(page);
  await solveCase(page, "8");
  // Let every voice finish (the storyteller's Home line, the first win).
  const sounding = () =>
    page.evaluate(() =>
      (window as unknown as { __audios: HTMLMediaElement[] }).__audios.filter(
        (a) => !a.muted && (a.currentSrc || a.src).includes("/audio/") && !a.paused && !a.ended,
      ).length,
    );
  await expect.poll(sounding, { timeout: 30_000 }).toBe(0);
  // Case 2 opens on a quiet channel: Watson's automatic line plays.
  await page.getByRole("button", { name: /Next case/ }).click();
  const pair = page.getByTestId("subject-pair");
  await expect(pair).toHaveAttribute("data-state", "open");
  await expect
    .poll(async () => (await voices(page)).starts.at(-1), { timeout: 10_000 })
    .toBe("detective/fixed/lets-find-clues.mp3");
  await expect(pair).toHaveAttribute("data-speaking", "watson");
  await expect(page.getByTestId("subject-pair-bubble")).toHaveText("Let's find some clues.");
  // The right pick while Watson is still mid-line: Holmes takes the voice.
  await page.getByTestId("math-answer-card").getByRole("button", { name: "24", exact: true }).click();
  await expect
    .poll(async () => (await voices(page)).starts.at(-1), { timeout: 10_000 })
    .toBe("detective/fixed/win-holmes.mp3");
  const watsonLine = await page.evaluate(() => {
    const a = (window as unknown as { __audios: HTMLMediaElement[] }).__audios.find((x) =>
      (x.currentSrc || x.src).includes("lets-find-clues"),
    );
    return a ? { paused: a.paused, ended: a.ended, at: a.currentTime, dur: a.duration } : null;
  });
  console.log(`[one-voice] watson line when Holmes spoke: ${JSON.stringify(watsonLine)}`);
  expect(watsonLine?.paused).toBe(true);
  await dismissCelebration(page);
  await expect(page.getByTestId("math-result")).toBeVisible();
  await page.waitForTimeout(2_000);
  const v = await voices(page);
  console.log(`[voices one-voice] max=${v.max} starts=${JSON.stringify(v.starts)}`);
  expect(v.max).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("pair on: Holmes and Watson in the physics case too", async ({ page, context }) => {
  await setupPair(context, "7-10");
  const errors = watchErrors(page);
  await page.goto(APP_URL);
  const card = page.getByTestId("home-card-why-learn");
  await card.scrollIntoViewIfNeeded();
  await card.getByRole("button", { name: "Why Do We Learn This?: Start exploring" }).click();
  await page.getByTestId("subject-row-physics").click();
  await expect(page.getByTestId("physics-case")).toBeVisible();
  const pair = page.getByTestId("subject-pair");
  await expect(pair).toBeVisible();
  await expect(pair).toHaveAttribute("data-state", "open");
  await expect(pair.locator('[data-detective="holmes"] svg')).toBeVisible();
  await expect(pair.locator('[data-detective="watson"] svg')).toBeVisible();
  await page.screenshot({ path: `${PAIR_SHOTS}/pair-case-open-physics-desktop.png` });
  const v = await voices(page);
  expect(v.max).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("pair on, 390px: case open with the pair, and the win moment", async ({ page, context }) => {
  await setupPair(context, "7-10");
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = watchErrors(page);
  await openCase(page);
  const pair = page.getByTestId("subject-pair");
  await expect(pair).toBeVisible();
  await pair.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${PAIR_SHOTS}/pair-case-open-7-10-390.png` });
  await solveCase(page, "8");
  await expect(page.getByTestId("subject-pair-celebrate")).toBeVisible();
  await page.getByTestId("subject-pair-celebrate").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${PAIR_SHOTS}/pair-win-7-10-390.png` });
  // Never wider than the phone: no sideways scroll.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const v = await voices(page);
  expect(v.max).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("pair on, reduced motion: still poses, the win goes straight to the high-five", async ({
  page,
  context,
}) => {
  await setupPair(context, "10-18");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = watchErrors(page);
  await openCase(page);
  const pair = page.getByTestId("subject-pair");
  await expect(pair).toBeVisible();
  await expect(page.getByTestId("detective-rig3d")).toHaveCount(0);
  await page.getByTestId("math-answer-card").getByRole("button", { name: "1,081", exact: true }).click();
  await dismissCelebration(page);
  // No jump beat: the first win frame is already the high-five.
  const holmesPose = page
    .getByTestId("subject-pair-celebrate")
    .locator('[data-detective="holmes"] svg')
    .first();
  await expect(holmesPose).toHaveAttribute("data-pose", "high-five", { timeout: 500 });
  await expect(page.locator("[data-testid=subject-pair] .detective-celebrate-spark")).toHaveCount(0);
  // The 3D layer must not start at all under reduced motion (not only
  // CSS animations off): no WebGL canvas over the SVG rigs.
  await expect(page.getByTestId("detective-rig3d")).toHaveCount(0);
  await expect(page.locator("[data-testid=subject-pair] canvas")).toHaveCount(0);
  await expect(page.getByTestId("math-result")).toBeVisible();
  expect(errors).toEqual([]);
});

test("pair off (detectivePair false): the case is text only, like main", async ({ page, context }) => {
  await setup(context, "7-10");
  const errors = watchErrors(page);
  await openCase(page);
  await expect(page.getByTestId("subject-pair-slot")).toHaveCount(0);
  await expect(page.getByTestId("subject-pair")).toHaveCount(0);
  await expect(page.locator(".detective-rig")).toHaveCount(0);
  await solveCase(page, "8");
  await expect(page.getByTestId("subject-pair")).toHaveCount(0);
  expect(errors).toEqual([]);
});
