import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * GeoDetective Phase 3 deploy-gate E2E.
 *
 * Deterministic days via the `?loop-date=` seam (inert in production):
 *   2026-10-03 -> clue 5 -> New York (geonames:5128581)
 *   2026-10-04 -> clue 6 -> London   (geonames:2643743)
 *
 * The built Pages artifact is served from disk (see helpers.ts); the loop
 * data (manifest, clues, names index) ships in dist/client/loop/.
 */

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

async function openLoop(page: import("playwright/test").Page, loopDate: string) {
  await page.goto(`http://127.0.0.1:4123/Meridian/?loop-date=${loopDate}`);
  await page.getByRole("button", { name: "Solve today's mystery" }).click();
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({ timeout: 30_000 });
  // The day's first clue card is visible once the clue file loads.
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible({ timeout: 30_000 });
}

function guessBox(page: import("playwright/test").Page) {
  return page.getByRole("combobox", { name: "Guess the place" });
}

/** Type a query and pick the first matching suggestion. */
async function guess(page: import("playwright/test").Page, query: string) {
  const box = guessBox(page);
  await box.click();
  await box.fill(query);
  const option = page.getByRole("option").first();
  // The 11 MB name index parses on first focus; allow headroom on slow VMs.
  await expect(option).toBeVisible({ timeout: 30_000 });
  await option.click();
}

async function guessCount(page: import("playwright/test").Page): Promise<number> {
  return page.getByRole("region", { name: "Your guesses" }).getByRole("listitem").count().catch(() => 0);
}

test("loop-date seam pins the day; UTC date header matches", async ({ page }) => {
  await openLoop(page, "2026-10-03");
  await expect(page.getByText("October 3 · UTC")).toBeVisible();
});

test("win path: clues unlock in order, correct guess wins, share text formats", async ({
  page,
}) => {
  await openLoop(page, "2026-10-03"); // New York

  // Clue 1 visible; clue 2 locked before any guess.
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toContainText(
    "Five boroughs",
  );
  await expect(page.getByRole("article", { name: /Clue 2: Climate \(locked\)/ })).toContainText(
    "Unlocks after your next guess.",
  );

  // Wrong guess 1: Paris. Far from New York -> red square in share.
  await guess(page, "paris");
  await expect(page.getByText("Guess 2 of 5")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Your guesses" }).getByText("Paris, France"),
  ).toBeVisible();

  // Clue 2 unlocked after the first guess; clue 3 still locked.
  await expect(
    page.getByRole("article", { name: /Clue 2: Climate/ }).getByText("Unlocks after"),
  ).toHaveCount(0);
  await expect(page.getByRole("article", { name: /Clue 3: History \(locked\)/ })).toContainText(
    "Unlocks after your next guess.",
  );

  // Duplicate: Paris again must not consume a guess.
  await guess(page, "paris");
  await expect(page.getByText(/You already guessed Paris/)).toBeVisible();
  await expect(page.getByText("Guess 2 of 5")).toBeVisible();
  expect(await guessCount(page)).toBe(1);

  // Correct guess: New York City.
  await guess(page, "new york");
  await expect(page.getByRole("heading", { name: "New York City, New York, United States" })).toBeVisible();
  await expect(page.getByText("🎯 You found it!")).toBeVisible();
  await expect(page.getByText("Solved in 2 guesses.")).toBeVisible();

  // All clues revealed on a finished day (no locked cards promising a next guess).
  await expect(page.getByText("Unlocks after your next guess.")).toHaveCount(0);

  // Share text: three lines, proximity-graded grid, solved-in-N.
  const share = page.locator("pre", { hasText: "meridian geodetective" });
  await expect(share).toContainText("meridian geodetective October 3");
  await expect(share).toContainText("https://veeresh-bikkaneti.github.io/Meridian/");
  await expect(share).toContainText("🟥🟩⬜⬜⬜ solved in 2");
});

test("reload mid-game restores the day state", async ({ page }) => {
  await openLoop(page, "2026-10-03");
  await guess(page, "tokyo");
  await expect(page.getByText("Guess 2 of 5")).toBeVisible();

  await page.reload();
  // Reload-restore: the in-progress day comes back, not a reset.
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible();
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible();
  await expect(page.getByText("Guess 2 of 5")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Your guesses" }).getByText("Tokyo, Japan"),
  ).toBeVisible();
  // Clue 2 is still unlocked after the restore.
  await expect(
    page.getByRole("article", { name: /Clue 2: Climate/ }).getByText("Unlocks after"),
  ).toHaveCount(0);

  // A fresh browser context on the same pinned day starts clean.
});

test("loss path: 5 wrong guesses, giveaway shown, share says not solved", async ({
  page,
}) => {
  await openLoop(page, "2026-10-04"); // London

  for (const q of ["paris", "tokyo", "sydney", "cairo", "new york"]) {
    await guess(page, q);
  }

  await expect(page.getByText("Out of guesses")).toBeVisible();
  // The giveaway clue (tier 5) is revealed and names the landmark.
  await expect(page.getByRole("article", { name: /Clue 5: Giveaway/ })).toContainText(
    "Big Ben",
  );
  // The answer is looked up from the guess index on a loss.
  await expect(
    page.getByRole("heading", { name: "London, United Kingdom" }),
  ).toBeVisible({ timeout: 15_000 });
  // No locked cards remain on a finished day.
  await expect(page.getByText("Unlocks after your next guess.")).toHaveCount(0);

  const share = page.locator("pre", { hasText: "meridian geodetective" });
  await expect(share).toContainText("meridian geodetective October 4");
  // Proximity-graded: Paris is <500 km from London (yellow), the rest far (red).
  await expect(share).toContainText(/🟨🟥🟥🟥🟥 not solved/);
});

test("unknown guess consumes nothing; no-match message is friendly", async ({ page }) => {
  await openLoop(page, "2026-10-03");

  const box = guessBox(page);
  await box.click();
  await box.fill("xqzzy-not-a-place");
  await expect(page.getByText(/No places match/)).toBeVisible();
  // Enter with no suggestions must not submit.
  await box.press("Enter");
  await expect(page.getByText("Guess 1 of 5")).toBeVisible();
  expect(await guessCount(page)).toBe(0);
});

test("loop state is namespaced: endless-run keys untouched", async ({ page }) => {
  await openLoop(page, "2026-10-03");
  await guess(page, "paris");

  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys).toContain("meridian.loop.v1");
  expect(keys).not.toContain("meridian.run");
  expect(keys).not.toContain("meridian.drop");

  const store = await page.evaluate(() => JSON.parse(localStorage.getItem("meridian.loop.v1")!));
  expect(store["2026-10-03"].guesses).toHaveLength(1);
  expect(store["2026-10-03"].status).toBe("playing");
});
