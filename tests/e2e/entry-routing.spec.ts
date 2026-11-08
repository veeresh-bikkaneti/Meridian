import { test, expect } from "playwright/test";
import { mkdirSync } from "node:fs";
import { APP_NO_IDLE, serveBuiltArtifact } from "./helpers";

/**
 * Entry routing — the owner's order (Veeresh, 2026-11-08): "Page by
 * default is loading GeoDetective — we should always push the player
 * onto homescreen."
 *
 * The defect: game-app used to initialise its GeoDetective / Cold
 * Trail screen state from a persisted localStorage open flag
 * (meridian.loop.open / meridian.coldtrail.open, set on card tap and
 * cleared only on explicit leave), so any later bare visit booted
 * straight into the game — and the flag alone auto-dealt a fresh case.
 *
 * The contract pinned here:
 *  (i)   a fresh bare visit lands on Home;
 *  (ii)  flag + in-flight store → Home WITH the "Resume your case"
 *        offer; tapping it reopens the seeded case at its progress;
 *  (iii) flag alone → Home, no resume offer, no auto-dealt case;
 *  (iv)  the Cold Trail flag behaves the same, and an in-flight Cold
 *        Trail case is offered as "Resume your trail" on Home;
 *  (v)   tapping the GeoDetective card on Home still enters the game
 *        (explicit intent is unchanged).
 *
 * Every scenario runs at phone / tablet / desktop widths (the owner's
 * all-devices rule) and saves a render-level screenshot per scenario
 * and width under tests/e2e/evidence/entry-routing/ — DOM assertions
 * alone do not count as evidence for this fix.
 */

const SHOTS = "tests/e2e/evidence/entry-routing";
mkdirSync(SHOTS, { recursive: true });

const WIDTHS = [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 800 },
] as const;

/**
 * The in-flight GeoDetective store proven by the entry-evidence relay
 * (~/workspace/meridian-entry-evidence): current = clue file 0,
 * status "playing", no guesses yet; totals solved 2 / lost 1, so the
 * open case is Case #4.
 */
const LOOP_STORE = JSON.stringify({
  deck: {
    deck: Array.from({ length: 387 }, (_, i) => i).filter((i) => i !== 0),
    cycle: 1,
    cycleCompleted: 0,
  },
  current: {
    index: 0,
    cycle: 1,
    guesses: [],
    status: "playing",
    cluesRevealed: 1,
    completedAt: null,
    streakEndedAt: null,
  },
  streak: 2,
  bestStreak: 3,
  totals: { solved: 2, lost: 1 },
});

/** An in-flight Cold Trail store: case 1 underway, one ring placed. */
const COLDTRAIL_STORE = JSON.stringify({
  v: 2,
  caseIndex: 0,
  stars: 3,
  solved: 0,
  current: {
    ringsPlaced: [true, false, false],
    informantOn: [false, false, false],
    ringCenters: [{ lon: 78.37, lat: 17.38 }, null, null],
    guess: null,
    revealed: false,
    scoreKm: null,
  },
});

type Seed = { loopOpen?: boolean; loopStore?: string; coldTrailOpen?: boolean; coldTrailStore?: string };

async function seedBeforeBoot(
  context: import("playwright/test").BrowserContext,
  seed: Seed,
) {
  await context.addInitScript((s: Seed) => {
    if (s.loopOpen) localStorage.setItem("meridian.loop.open", "1");
    if (s.loopStore) localStorage.setItem("meridian.loop.v2", s.loopStore);
    if (s.coldTrailOpen) localStorage.setItem("meridian.coldtrail.open", "1");
    if (s.coldTrailStore) localStorage.setItem("meridian.coldtrail.v2", s.coldTrailStore);
  }, seed);
}

async function expectHome(page: import("playwright/test").Page) {
  await expect(page.getByTestId("home-heading")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("loop-screen")).toHaveCount(0);
  await expect(page.getByTestId("coldtrail-screen")).toHaveCount(0);
}

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

for (const w of WIDTHS) {
  test(`(i) fresh profile, bare root lands on Home [${w.name}px]`, async ({ page }) => {
    await page.setViewportSize({ width: w.width, height: w.height });
    await page.goto(APP_NO_IDLE);
    await expectHome(page);
    await page.screenshot({ path: `${SHOTS}/fresh-home-${w.name}.png` });
  });

  test(`(ii) seeded loop flag + in-flight store lands on Home with Resume; Resume reopens the seeded case [${w.name}px]`, async ({
    page,
    context,
  }) => {
    test.setTimeout(240_000);
    await seedBeforeBoot(context, { loopOpen: true, loopStore: LOOP_STORE });
    await page.setViewportSize({ width: w.width, height: w.height });
    await page.goto(APP_NO_IDLE);
    await expectHome(page);
    const resume = page.getByRole("button", { name: "GeoDetective: Resume your case" });
    await expect(resume).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: `${SHOTS}/seeded-flag-store-home-resume-${w.name}.png` });

    await resume.click();
    await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({
      timeout: 30_000,
    });
    // The seeded case itself: totals 2 solved + 1 lost → Case #4, and
    // the seeded current (clue file 0, no guesses) opens at Guess 1.
    await expect(page.getByText("Case #4")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Guess 1 of 5")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("loop-map")).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: `${SHOTS}/seeded-resume-inside-case-${w.name}.png` });
  });

  test(`(iii) loop flag only, no store: Home, no resume offer, no auto-dealt case [${w.name}px]`, async ({
    page,
    context,
  }) => {
    await seedBeforeBoot(context, { loopOpen: true });
    await page.setViewportSize({ width: w.width, height: w.height });
    await page.goto(APP_NO_IDLE);
    await expectHome(page);
    await expect(
      page.getByRole("button", { name: "GeoDetective: Solve a mystery" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("button", { name: "GeoDetective: Resume your case" }),
    ).toHaveCount(0);
    // Nothing was dealt on the player's behalf: no loop store exists.
    expect(await page.evaluate(() => localStorage.getItem("meridian.loop.v2"))).toBeNull();
    await page.screenshot({ path: `${SHOTS}/flag-only-home-${w.name}.png` });
  });

  test(`(iv) seeded cold-trail flag + in-flight store lands on Home with "Resume your trail" [${w.name}px]`, async ({
    page,
    context,
  }) => {
    test.setTimeout(240_000);
    await seedBeforeBoot(context, { coldTrailOpen: true, coldTrailStore: COLDTRAIL_STORE });
    await page.setViewportSize({ width: w.width, height: w.height });
    await page.goto(APP_NO_IDLE);
    await expectHome(page);
    const resume = page.getByRole("button", { name: "Cold Trail: Resume your trail" });
    await expect(resume).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: `${SHOTS}/coldtrail-home-resume-${w.name}.png` });

    // Reachability: the offer really opens the in-flight trail case.
    await resume.click();
    await expect(page.getByTestId("coldtrail-screen")).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: `${SHOTS}/coldtrail-resume-inside-${w.name}.png` });
  });

  test(`(v) tapping the GeoDetective card on Home still enters the game [${w.name}px]`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: w.width, height: w.height });
    await page.goto(APP_NO_IDLE);
    await expectHome(page);
    await page.getByRole("button", { name: "GeoDetective: Solve a mystery" }).click();
    await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("loop-map")).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: `${SHOTS}/card-tap-enters-game-${w.name}.png` });
  });
}

test("(iv-b) cold-trail flag only, no store: Home with the plain Start entry [390px]", async ({
  page,
  context,
}) => {
  await seedBeforeBoot(context, { coldTrailOpen: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(APP_NO_IDLE);
  await expectHome(page);
  await expect(
    page.getByRole("button", { name: "Cold Trail: Start the trail" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole("button", { name: "Cold Trail: Resume your trail" }),
  ).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/coldtrail-flag-only-home-390.png` });
});
