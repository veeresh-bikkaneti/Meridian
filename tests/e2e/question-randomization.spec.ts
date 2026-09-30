import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  readPhase,
  readRun,
  dropButton,
  dismissTileOverlayIfPresent,
} from "./helpers";
import type { Page } from "playwright/test";

/**
 * F4 question randomization: per-session shuffle, per-cycle reseed,
 * persistent no-repeat history. Regression target: the "started 5 times,
 * same first question all 5 times" symptom.
 */

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

/** Current question from the aim live region ("Find X."). */
async function readQuestion(page: Page): Promise<string> {
  const live = page.locator('p.sr-only[aria-live="polite"]');
  await expect(live).toContainText(/^Find .+\.$/, { timeout: 10_000 });
  const text = (await live.textContent()) ?? "";
  return text.replace(/^Find /, "").replace(/\.\s*$/, "").trim();
}

/** Drop a pin anywhere, commit, continue to the next place. */
async function playOnePlace(page: Page): Promise<void> {
  // Slow VMs can trip the map's tile-load watchdog mid-test; the overlay
  // swallows map clicks, so clear it the way a user would (Retry). The
  // watchdog can also fire between the dismiss and the click, so if the
  // pin didn't land, dismiss once more and re-click.
  await dismissTileOverlayIfPresent(page);
  await page.mouse.click(500, 400);
  try {
    await expect(dropButton(page)).toBeEnabled({ timeout: 5_000 });
  } catch {
    await dismissTileOverlayIfPresent(page);
    await page.mouse.click(500, 400);
    await expect(dropButton(page)).toBeEnabled();
  }
  await dropButton(page).click();
  await expect
    .poll(() => readPhase(page), { timeout: 20_000 })
    .toMatch(/^(story|done)$/);
  await page.getByRole("button", { name: "Next place" }).click();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
}

/** End the run via End game, then start a fresh one via Play again. */
async function restartRun(page: Page): Promise<void> {
  await page.getByRole("button", { name: "End game" }).click();
  await expect.poll(() => readPhase(page), { timeout: 10_000 }).toBe("summary");
  await page
    .getByRole("dialog", { name: "Game summary" })
    .getByRole("button", { name: "Play again" })
    .click();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  expect((await readRun(page)).index).toBe(0);
}

test("restarts deal different first questions with fresh seeds (5-restarts symptom)", async ({
  page,
}) => {
  await startGlobeRun(page);

  const firsts: string[] = [await readQuestion(page)];
  const seeds: number[] = [(await readRun(page)).seed as number];

  // Four more restarts, same as the reported symptom (5 starts, same day).
  for (let i = 0; i < 4; i++) {
    await restartRun(page);
    firsts.push(await readQuestion(page));
    seeds.push((await readRun(page)).seed as number);
  }

  // Mechanism: every restart mints a fresh per-session dealing seed.
  expect(new Set(seeds).size).toBe(5);
  // Symptom: the five first questions must not all be the same place.
  expect(new Set(firsts).size).toBeGreaterThan(1);
});

test("no repeats within a session until the pool turns over", async ({ page }) => {
  // Six map interactions on software rendering need headroom.
  test.setTimeout(180_000);
  await startGlobeRun(page);

  const questions: string[] = [await readQuestion(page)];
  for (let i = 0; i < 5; i++) {
    await playOnePlace(page);
    questions.push(await readQuestion(page));
  }

  // Six consecutive questions from one session: all distinct.
  expect(new Set(questions).size).toBe(6);
});

test("seen history persists across reload: no immediate repeats", async ({ page }) => {
  // Reload + resume on software rendering needs headroom.
  test.setTimeout(180_000);
  await startGlobeRun(page);

  const played: string[] = [await readQuestion(page)];
  await playOnePlace(page);
  played.push(await readQuestion(page));
  await playOnePlace(page);

  // The no-repeat history is persisted in localStorage, scoped to
  // edition/region and persistent across days.
  const seenKey = "meridian:seen:v2:globe:globe";
  const seenBefore = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? "[]") as string[],
    seenKey,
  );
  expect(seenBefore.length).toBeGreaterThanOrEqual(2);

  // Reload: the run resumes (same session seed) and the history survives.
  await page.reload();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");

  const seenAfter = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? "[]") as string[],
    seenKey,
  );
  expect(seenAfter.length).toBeGreaterThanOrEqual(2);

  const resumed = await readQuestion(page);
  expect(played).not.toContain(resumed);
});
