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
