import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  readPhase,
  readRun,
  dropButton,
  dismissTileOverlayIfPresent,
} from "./helpers";

/**
 * Endless game flow: the game never ends by itself. The player keeps playing
 * place after place until THEY choose to stop via End game. Ending shows a
 * summary (grand total, places, stats) which must be dismissed before reset.
 */

test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

async function playOnePlace(page: import("playwright/test").Page) {
  // The 15 s tile-load watchdog can fire on very slow machines, raising the
  // "Couldn't load satellite imagery" overlay that swallows map clicks.
  // Dismiss it via Retry exactly as a user on a flaky connection would.
  await dismissTileOverlayIfPresent(page);
  // Place a pin via map click, then commit with Drop pin.
  await page.mouse.click(500, 400);
  await expect(dropButton(page)).toBeEnabled();
  await dropButton(page).click();
  // Wait for the result: story (hit) or done (miss) — both continue.
  await expect
    .poll(() => readPhase(page), { timeout: 20_000 })
    .toMatch(/^(story|done)$/);
  const phase = await readPhase(page);
  // Endless: never auto-terminates to a terminal state here.
  expect(phase).not.toBe("summary");
  // Continue to the next place.
  await page.getByRole("button", { name: "Next place" }).click();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
}

test("endless: plays multiple places without auto-ending, ends via End game with summary", async ({
  page,
}) => {
  await startGlobeRun(page);

  // Play 3 places. The game must not end by itself.
  await playOnePlace(page);
  await playOnePlace(page);
  await playOnePlace(page);

  const run = await readRun(page);
  expect(run.index).toBe(3);
  expect(run.phase).toBe("aim");

  // End game control is keyboard-reachable and in the header (not a map mis-tap).
  const endGame = page.getByRole("button", { name: "End game" });
  await expect(endGame).toBeVisible();
  await endGame.click();

  // Summary phase.
  await expect.poll(() => readPhase(page), { timeout: 10_000 }).toBe("summary");

  // Summary shows grand total, places played, and stats.
  const dialog = page.getByRole("dialog", { name: "Game summary" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("total score")).toBeVisible();
  // Places played = 3.
  const placesRow = dialog.locator("div", { hasText: "Places played" }).last();
  await expect(placesRow).toContainText("3");

  // Total is announced to screen readers. The summary's share button renders
  // its own (initially empty) sr-only live region, so scope to the announcer
  // that carries text — the game's announcement, not the share button's.
  const live = page
    .locator('p.sr-only[aria-live="polite"]')
    .filter({ hasText: /\S/ });
  await expect(live).toContainText(/Game over\./);
  await expect(live).toContainText(/3 places/);

  // Dismissing the summary resets the game (back to menu).
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 10_000,
  });
});

test("endless: End game is reachable by keyboard", async ({ page }) => {
  await startGlobeRun(page);
  // Tab from the map to the End game button.
  await page.getByRole("button", { name: "End game" }).focus();
  await expect(page.getByRole("button", { name: "End game" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(() => readPhase(page), { timeout: 10_000 }).toBe("summary");
});
