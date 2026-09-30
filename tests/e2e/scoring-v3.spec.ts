import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  dismissTileOverlayIfPresent,
  readPhase,
  dropButton,
} from "./helpers";

/**
 * Scoring v3 (streak engine) E2E: the question card shows the difficulty
 * chip, the header shows a running SCORE, the reveal shows the transparent
 * breakdown arithmetic, and the summary shows average-per-place + best
 * streak. The breakdown's own data attributes carry the formula inputs, so
 * the test re-derives the score in-page — no geo luck required beyond
 * landing one hit.
 */

test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

async function scoreText(page: import("playwright/test").Page): Promise<string> {
  return (await page.getByTestId("score-total").textContent()) ?? "";
}

/** The result card is a scrollable sheet (max-h-45dvh); pre-scroll the
 *  button with instant behavior because Chromium's scrollIntoViewIfNeeded
 *  (which Playwright's click uses) is pathologically slow inside this
 *  MapLibre layout. Real users scroll the sheet by touch/wheel, so this
 *  masks no production behavior. */
async function clickNextPlace(page: import("playwright/test").Page): Promise<void> {
  const nextPlace = page.getByRole("button", { name: "Next place" });
  await expect(nextPlace).toBeVisible({ timeout: 10_000 });
  await nextPlace.evaluate((el) =>
    el.scrollIntoView({ block: "nearest", behavior: "instant" as ScrollBehavior }),
  );
  await nextPlace.click();
}

/** Play places until one hits (bounded); returns after the reveal shows. */
async function playUntilHit(page: import("playwright/test").Page): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt++) {
    await dismissTileOverlayIfPresent(page);
    await page.mouse.click(500, 400);
    await expect(dropButton(page)).toBeEnabled();
    await dropButton(page).click();
    // Capture the phase inside the poll: a separate readPhase after the
    // poll can race the transition it just observed.
    let phase: string | null = null;
    await expect
      .poll(async () => {
        phase = await readPhase(page);
        return phase;
      }, { timeout: 20_000 })
      .toMatch(/^(story|done)$/);
    if (phase === "story") return;
    await clickNextPlace(page);
    await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  }
  throw new Error("no hit in 10 attempts");
}

test("scoring v3: chip, running SCORE, transparent breakdown, summary stats", async ({
  page,
}) => {
  await startGlobeRun(page);

  // Difficulty chip on the question card, MapTap-style.
  const chip = page.getByTestId("difficulty-chip");
  await expect(chip).toBeVisible();
  await expect(chip).toHaveText(/^(Easy|Moderate|Challenging|Hard|Extreme) · [\d.]+x$/);

  // Running SCORE starts at zero and is always visible.
  await expect(page.getByTestId("score-total")).toBeVisible();
  expect(await scoreText(page)).toMatch(/SCORE 0/);

  await playUntilHit(page);

  // The reveal shows the transparent arithmetic; the data attributes carry
  // the formula inputs so the test re-derives the score independently.
  const breakdown = page.getByTestId("score-breakdown");
  await expect(breakdown).toBeVisible();
  const base = Number(await breakdown.getAttribute("data-base"));
  const mult = Number(await breakdown.getAttribute("data-mult"));
  const combo = Number(await breakdown.getAttribute("data-combo"));
  const bonus = Number(await breakdown.getAttribute("data-bonus"));
  const shown = Number(await breakdown.getAttribute("data-score"));
  const expected = Math.min(400, Math.round(base * mult * combo)) + bonus;
  expect(shown).toBe(expected);
  await expect(breakdown).toHaveText(new RegExp(`= ${expected}$`));

  // The running SCORE picked up the place score.
  expect(await scoreText(page)).toMatch(/SCORE [\d,]+/);
  expect(await scoreText(page)).not.toMatch(/SCORE 0$/);

  // End the game: the summary keeps its stats and adds average + best streak.
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  await page.getByRole("button", { name: "End game" }).click();
  await expect.poll(() => readPhase(page), { timeout: 10_000 }).toBe("summary");

  const dialog = page.getByRole("dialog", { name: "Game summary" });
  await expect(dialog.getByTestId("summary-avg")).toBeVisible();
  await expect(dialog.getByTestId("summary-best-streak")).toBeVisible();
  const avg = Number(await dialog.getByTestId("summary-avg").textContent());
  expect(avg).toBeGreaterThan(0);

  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 10_000,
  });
});
