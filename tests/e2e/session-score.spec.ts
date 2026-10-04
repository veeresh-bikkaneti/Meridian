import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  readPhase,
  commitHit,
  commitMiss,
  clickNextPlace,
  dismissTileOverlayIfPresent,
  NO_IDLE,
} from "./helpers";

/**
 * Session score: the score accumulates across edition switches until the
 * player ends the game (or the session idles out). Per-edition breakdown in
 * the HUD toggle and the end-of-game summary. Idle > 2 min kills the
 * session and returns the player to the home screen.
 *
 * The functional tests run with `?idle-ms=` set to an hour: on this slow
 * harness the map/chunk startup alone can outlast the real 2-minute
 * timeout, and the idle watchdog is covered by its own dedicated tests.
 */

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

async function scoreText(page: import("playwright/test").Page): Promise<string> {
  return (await page.getByTestId("score-total").textContent()) ?? "";
}

async function sessionTotal(page: import("playwright/test").Page): Promise<number> {
  return page.evaluate(() => {
    const raw = sessionStorage.getItem("meridian.session");
    return raw ? (JSON.parse(raw) as { totalScore: number }).totalScore : -1;
  });
}

test("edition switch keeps the accumulated score (no reset to 0)", async ({ page }) => {
  test.setTimeout(240_000);
  await startGlobeRun(page, NO_IDLE);

  // Score in the globe edition: a hit banks points, a miss banks a place.
  await dismissTileOverlayIfPresent(page);
  await commitHit(page);
  const globeScore = await sessionTotal(page);
  expect(globeScore).toBeGreaterThan(0);
  expect(await scoreText(page)).toContain(`SCORE ${globeScore.toLocaleString("en-US")}`);
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");

  // Switch editions mid-session via the Editions button (no End game).
  await page.getByRole("button", { name: "Editions" }).click();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible();

  // Start a country run: the globe score must survive the switch.
  await page.getByRole("button", { name: "Choose a country" }).click();
  await page.getByRole("button", { name: "United States" }).click();
  await page.getByRole("button", { name: "Play entire United States" }).click();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  expect(await sessionTotal(page)).toBe(globeScore);
  expect(await scoreText(page)).toContain(`SCORE ${globeScore.toLocaleString("en-US")}`);

  // Scoring in the new edition adds to the session total.
  await dismissTileOverlayIfPresent(page);
  await commitMiss(page);
  expect(await sessionTotal(page)).toBe(globeScore);
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  await dismissTileOverlayIfPresent(page);
  await commitHit(page);
  const combined = await sessionTotal(page);
  expect(combined).toBeGreaterThan(globeScore);
  expect(await scoreText(page)).toContain(`SCORE ${combined.toLocaleString("en-US")}`);
});

test("HUD score toggle shows the per-edition breakdown", async ({ page }) => {
  test.setTimeout(180_000);
  await startGlobeRun(page, NO_IDLE);
  await dismissTileOverlayIfPresent(page);
  await commitHit(page);
  const globeScore = await sessionTotal(page);
  expect(globeScore).toBeGreaterThan(0);

  await page.getByTestId("score-total").click();
  const breakdown = page.getByTestId("session-score-breakdown");
  await expect(breakdown).toBeVisible();
  await expect(breakdown).toContainText("Globe");
  await expect(breakdown).toContainText(globeScore.toLocaleString("en-US"));
  await expect(breakdown).toContainText("Country");
  await expect(breakdown).toContainText("State");

  // Toggle closes.
  await page.getByTestId("score-total").click();
  await expect(breakdown).toBeHidden();
});

test("end-game summary shows the session total with per-edition breakdown", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await startGlobeRun(page, NO_IDLE);
  await dismissTileOverlayIfPresent(page);
  await commitHit(page);
  const globeScore = await sessionTotal(page);
  expect(globeScore).toBeGreaterThan(0);
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");

  // Play one place in a second edition, then end the game.
  await page.getByRole("button", { name: "Editions" }).click();
  await page.getByRole("button", { name: "Choose a country" }).click();
  await page.getByRole("button", { name: "United States" }).click();
  await page.getByRole("button", { name: "Play entire United States" }).click();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  await dismissTileOverlayIfPresent(page);
  await commitMiss(page);
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");

  await page.getByRole("button", { name: "End game" }).click();
  const dialog = page.getByRole("dialog", { name: "Game summary" });
  await expect(dialog).toBeVisible();

  const total = await sessionTotal(page);
  await expect(dialog).toContainText(total.toLocaleString("en-US"));
  const breakdown = page.getByTestId("summary-edition-breakdown");
  await expect(breakdown).toBeVisible();
  await expect(breakdown).toContainText("Globe");
  await expect(breakdown).toContainText(globeScore.toLocaleString("en-US"));
  await expect(breakdown).toContainText("Country");

  // Dismissing the summary ends the session: a new game starts at 0.
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("meridian.session")),
  ).toBeNull();
});

test("idle timeout kills the session and returns to the home screen", async ({
  page,
}) => {
  // ?idle-ms= shortens the 2-minute timeout for E2E (see session.ts).
  await page.goto("http://127.0.0.1:4123/Meridian/?idle-ms=4000");
  await page.getByRole("button", { name: "Play the globe" }).click();
  // The session starts once the region chunk loads; the kill must then
  // fire with no further input. (No aim-phase wait: chunk loading alone
  // can outlast the 4 s timeout on a slow harness.)
  await expect
    .poll(
      () => page.evaluate(() => sessionStorage.getItem("meridian.session") !== null),
      { timeout: 60_000 },
    )
    .toBe(true);
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText("Your game ended after 2 minutes of inactivity.")).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("meridian.session")),
  ).toBeNull();
  expect(
    await page.evaluate(() => sessionStorage.getItem("meridian.run")),
  ).toBeNull();
});

/**
 * Keep the session alive with inert key presses while the slow harness
 * starts up; resolves once the aim phase is reached.
 */
async function pollAimKeepAlive(
  page: import("playwright/test").Page,
  timeout = 120_000,
): Promise<void> {
  const start = Date.now();
  for (;;) {
    if ((await readPhase(page)) === "aim") return;
    if (Date.now() - start > timeout) {
      throw new Error("pollAimKeepAlive: timed out waiting for aim");
    }
    // Shift is inert in the game (arrows aim, Enter/Space commit, Esc
    // clears) — it only registers as activity for the idle watchdog.
    await page.keyboard.press("Shift");
    await page.waitForTimeout(15_000);
  }
}

test("idle warning appears before the kill and activity dismisses it", async ({
  page,
}) => {
  test.setTimeout(240_000);
  // 60 s timeout: warn at 30 s, kill at 60 s. Startup is kept alive with
  // key presses; the warning window is measured from the last one.
  await page.goto("http://127.0.0.1:4123/Meridian/?idle-ms=60000");
  await page.getByRole("button", { name: "Play the globe" }).click();
  await pollAimKeepAlive(page);

  await expect(page.getByText("Still there?")).toBeVisible({ timeout: 60_000 });
  // Any interaction dismisses the warning and keeps the session alive.
  await page.keyboard.press("Shift");
  await expect(page.getByText("Still there?")).toBeHidden({ timeout: 10_000 });
  expect(
    await page.evaluate(() => sessionStorage.getItem("meridian.session")),
  ).not.toBeNull();
});

/** The HUD pill rendering `{n} placed` next to the SCORE button. */
function placedPill(page: import("playwright/test").Page) {
  return page.getByText(/^\d+ placed$/);
}

/** Session-scoped hit count — the oracle for the placed pill. */
async function sessionHits(page: import("playwright/test").Page): Promise<number> {
  return page.evaluate(() => {
    const raw = sessionStorage.getItem("meridian.session");
    return raw ? (JSON.parse(raw) as { hits: number }).hits : -1;
  });
}

function difficultyGroup(page: import("playwright/test").Page) {
  return page.getByRole("group", {
    name: "How do you want to grow your map today?",
  });
}

/**
 * Start a globe run with a chosen difficulty band via the edition picker's
 * segmented control (Easy / Medium / Hard) — the same control a player
 * uses; the choice is carried onto the run and banked per place.
 */
async function startGlobeRunWithDifficulty(
  page: import("playwright/test").Page,
  difficulty: "Easy" | "Medium" | "Hard",
): Promise<void> {
  await page.goto(`http://127.0.0.1:4123/Meridian/?idle-ms=${NO_IDLE}`);
  const group = difficultyGroup(page);
  await expect(group.getByRole("button", { name: difficulty })).toBeVisible();
  await group.getByRole("button", { name: difficulty }).click();
  await expect(
    group.getByRole("button", { name: difficulty }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expect(page.locator(".satellite-map")).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  // Zoom-stabilize (mirrors startGlobeRun): the intro dive must settle
  // before commitHit projects the spot, or the tap can land off the map.
  const map = page.locator(".satellite-map");
  await expect
    .poll(
      async () => {
        const a = await map.getAttribute("data-zoom");
        await page.waitForTimeout(800);
        const b = await map.getAttribute("data-zoom");
        return a === b ? a : null;
      },
      { timeout: 30_000 },
    )
    .not.toBeNull();
}

test("HUD placed-counter accumulates across an edition switch", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await startGlobeRun(page, NO_IDLE);
  await dismissTileOverlayIfPresent(page);
  await commitHit(page);

  // One hit banked: the pill is session-scoped, so it reads 1 placed.
  expect(await sessionHits(page)).toBe(1);
  await expect(placedPill(page)).toHaveText("1 placed");

  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");

  // Switch editions mid-session via the Editions button (no End game).
  await page.getByRole("button", { name: "Editions" }).click();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible();
  await page.getByRole("button", { name: "Choose a country" }).click();
  await page.getByRole("button", { name: "United States" }).click();
  await page.getByRole("button", { name: "Play entire United States" }).click();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");

  // The counter survives the switch: it must NOT reset to 0 placed.
  expect(await sessionHits(page)).toBe(1);
  await expect(placedPill(page)).toHaveText("1 placed");

  // A hit in the new edition adds to the session count, not a fresh 1.
  await dismissTileOverlayIfPresent(page);
  await commitHit(page);
  expect(await sessionHits(page)).toBe(2);
  await expect(placedPill(page)).toHaveText("2 placed");
});

test("end-game summary shows per-difficulty and per-region breakdown", async ({
  page,
}) => {
  test.setTimeout(240_000);

  // Easy globe run: one hit banked into the Easy bucket.
  await startGlobeRunWithDifficulty(page, "Easy");
  await dismissTileOverlayIfPresent(page);
  await commitHit(page);
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");

  // Medium country run: switch the band on the edition menu, then play.
  await page.getByRole("button", { name: "Editions" }).click();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible();
  const group = difficultyGroup(page);
  await group.getByRole("button", { name: "Medium" }).click();
  await expect(group.getByRole("button", { name: "Medium" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Choose a country" }).click();
  await page.getByRole("button", { name: "United States" }).click();
  await page.getByRole("button", { name: "Play entire United States" }).click();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  await dismissTileOverlayIfPresent(page);
  await commitHit(page);

  // Storage oracle: the band switch really banked the hits into the right
  // buckets. (commitHit may burn a place with a miss when the spot is
  // untappable, so this asserts on hits, not places.)
  const byDifficulty = await page.evaluate(() => {
    const raw = sessionStorage.getItem("meridian.session");
    return raw
      ? (
          JSON.parse(raw) as {
            byDifficulty: Record<string, { places: number; hits: number }>;
          }
        ).byDifficulty
      : null;
  });
  expect(byDifficulty?.easy.hits).toBe(1);
  expect(byDifficulty?.medium.hits).toBe(1);

  await page.getByRole("button", { name: "End game" }).click();
  const dialog = page.getByRole("dialog", { name: "Game summary" });
  await expect(dialog).toBeVisible();

  // Per-difficulty breakdown: one row per played mode in the 8/10 (80%)
  // rate format; unplayed modes are omitted.
  const difficultyBreakdown = page.getByTestId("summary-difficulty-breakdown");
  await expect(difficultyBreakdown).toBeVisible();
  await expect(difficultyBreakdown).toContainText(/Easy[^\n]*\d+\/\d+ \(\d+%\)/);
  await expect(difficultyBreakdown).toContainText(/Medium[^\n]*\d+\/\d+ \(\d+%\)/);
  await expect(difficultyBreakdown).toContainText(/\d+\/\d+ \(\d+%\)/);

  // Per-region breakdown: the regions played, in first-seen order.
  const regionBreakdown = page.getByTestId("summary-region-breakdown");
  await expect(regionBreakdown).toBeVisible();
  await expect(regionBreakdown).toContainText("Globe");
  await expect(regionBreakdown).toContainText("United States");
});

/**
 * Share-text breakdown E2E: the end-game "Share score" button copies the
 * session payload through the same ShareButton clipboard path as
 * endgame-share.spec.ts, and the breakdown lines (per-difficulty rates,
 * per-region totals) are part of the copied text.
 */

const SHARE_SITE_URL = "https://veeresh-bikkaneti.github.io/Meridian/";

function collectShareErrors(page: import("playwright/test").Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

function expectCleanShareConsole(errors: string[]): void {
  // React #418 is a pre-existing flaky hydration warning, unrelated to this
  // feature (same filter as the question-labels and PWA specs).
  const relevant = errors.filter((e) => !e.includes("Minified React error #418"));
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

/** Init script: remove the native share sheet so the clipboard path runs. */
function noNativeShareScript(): void {
  try {
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
  } catch {
    /* navigator.share stays; the test asserts the path taken instead */
  }
}

async function newSharePage(
  browser: import("playwright/test").Browser,
): Promise<{
  context: import("playwright/test").BrowserContext;
  page: import("playwright/test").Page;
}> {
  const context = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
  });
  await serveBuiltArtifact(context);
  await context.addInitScript(noNativeShareScript);
  const page = await context.newPage();
  return { context, page };
}

interface ShareTestInputs {
  dateKey: string;
  regionName: string;
  totalScore: number;
  placesPlayed: number;
  bestStreak: number;
  byDifficulty: Record<
    string,
    { score: number; places: number; hits: number }
  >;
  regions: { regionName: string; score: number }[];
}

/** The app's session/run records, read from the storage it wrote. */
async function readShareTestInputs(
  page: import("playwright/test").Page,
): Promise<ShareTestInputs> {
  return page.evaluate(() => {
    const session = JSON.parse(sessionStorage.getItem("meridian.session") ?? "null");
    const run = JSON.parse(sessionStorage.getItem("meridian.run") ?? "null");
    return {
      dateKey: run.dateKey as string,
      regionName: run.regionName as string,
      totalScore: session.totalScore as number,
      placesPlayed: session.placesPlayed as number,
      bestStreak: session.bestStreak as number,
      byDifficulty: session.byDifficulty as Record<
        string,
        { score: number; places: number; hits: number }
      >,
      regions: session.regions as { regionName: string; score: number }[],
    };
  });
}

/**
 * Mirrors sessionShareText() for the session payload: the approved 3-line
 * contract (kept byte-identical for identical inputs), then one line per
 * played difficulty mode (easy → medium → hard), then one line of
 * per-region totals in first-seen order.
 */
function expectedSessionShareText(input: ShareTestInputs): string {
  const [year, month, day] = input.dateKey.split("-").map(Number);
  const monthName = new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
  const when =
    new Date().getUTCFullYear() === year
      ? `${monthName} ${day}`
      : `${monthName} ${day}, ${year}`;
  const streak =
    input.bestStreak >= 2 ? ` · 🔥 ${input.bestStreak} best streak` : "";
  // averagePerPlace is computed by summarizeSession, not stored on the
  // session record — mirror the computation here.
  const averagePerPlace =
    input.placesPlayed > 0 ? Math.round(input.totalScore / input.placesPlayed) : 0;
  const base =
    `meridian ${when}\n` +
    `${SHARE_SITE_URL}\n` +
    `${input.totalScore.toLocaleString("en-US")} over ${input.placesPlayed} places · ` +
    `${averagePerPlace} avg/place${streak} · ${input.regionName}`;
  const lines = [base];
  const labels: Record<string, string> = {
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
  };
  for (const mode of ["easy", "medium", "hard"] as const) {
    const bucket = input.byDifficulty[mode];
    // Unplayed modes are omitted — never shown as 0%.
    if (!bucket || bucket.places <= 0) continue;
    const rate = Math.round((100 * bucket.hits) / bucket.places);
    lines.push(
      `${labels[mode]} ${bucket.hits}/${bucket.places} ` +
        `(${rate}%) · ` +
        `${bucket.score.toLocaleString("en-US")} pts`,
    );
  }
  if (input.regions.length > 0) {
    lines.push(
      input.regions
        .map((r) => `${r.regionName} ${r.score.toLocaleString("en-US")}`)
        .join(" · "),
    );
  }
  return lines.join("\n");
}

test("share text contains the breakdown", async ({
  browser,
}: {
  browser: import("playwright/test").Browser;
}) => {
  test.setTimeout(240_000);
  const { context, page } = await newSharePage(browser);
  const errors = collectShareErrors(page);
  try {
    await startGlobeRun(page, NO_IDLE);
    await dismissTileOverlayIfPresent(page);
    await commitHit(page);
    await clickNextPlace(page);
    await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");

    // Second edition, so the breakdown has region + difficulty rows.
    await page.getByRole("button", { name: "Editions" }).click();
    await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible();
    await page.getByRole("button", { name: "Choose a country" }).click();
    await page.getByRole("button", { name: "United States" }).click();
    await page.getByRole("button", { name: "Play entire United States" }).click();
    await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
    await dismissTileOverlayIfPresent(page);
    await commitHit(page);

    await page.getByRole("button", { name: "End game" }).click();
    const dialog = page.getByRole("dialog", { name: "Game summary" });
    await expect(dialog).toBeVisible();

    const inputs = await readShareTestInputs(page);
    // commitHit may burn a place with a miss when the spot is untappable,
    // so the session can hold more places than the two guaranteed hits.
    expect(inputs.placesPlayed).toBeGreaterThanOrEqual(2);
    const expected = expectedSessionShareText(inputs);

    // The clipboard path: click "Share score" → the exact session share
    // text lands on the clipboard.
    const shareButton = dialog.getByRole("button", { name: "Share score" });
    await expect(shareButton).toBeVisible();
    await shareButton.click();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe(expected);

    // The breakdown is part of the copied text: per-difficulty rate rows
    // in the 8/10 (80%) format and the per-region totals line.
    expect(clip).toMatch(/\d+\/\d+ \(\d+%\)/);
    expect(clip).toContain("Medium");
    expect(clip).toContain("Globe");
    expect(clip).toContain("United States");

    expectCleanShareConsole(errors);
  } finally {
    await context.close();
  }
});
