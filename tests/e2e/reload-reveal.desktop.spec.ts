import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  readPhase,
  dismissTileOverlayIfPresent,
  commitMiss,
  clickNextPlace,
  resultCard,
  nextPlaceButton,
} from "./helpers";

/**
 * Reload-mid-reveal regression spec.
 *
 * A player reported: "I haven't been able to get back on to try elsewhere."
 * Root cause: `drop`/`revealDone` were React state only. Reloading during
 * the result card restored phase "done"/"story" from sessionStorage, but the
 * card renders only when `revealDone` is true — so no card, no Next place,
 * Drop pin disabled: a soft-lock ("Pin dropped. . Columbus missed.").
 *
 * The fix persists the drop to sessionStorage on pin commit. On reload the
 * app rehydrates the card when the saved drop matches the dealt place, and
 * otherwise fails safe by advancing (the interrupted place is already
 * scored in run.results — nothing lost, nothing double-counted).
 */
test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

async function startNebraskaStateRun(page) {
  await page.goto("http://127.0.0.1:4123/Meridian/");
  await page.getByRole("button", { name: "Choose a state" }).click();
  await expect(page.getByRole("heading", { name: "State" })).toBeVisible();
  await page.getByRole("button", { name: "United States" }).click();
  await expect(page.getByRole("heading", { name: "United States" })).toBeVisible();
  await page.getByRole("button", { name: "Nebraska" }).click();
  await dismissTileOverlayIfPresent(page);
  await expect(page.locator(".satellite-map")).toBeVisible();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
}

async function runResultsLength(page): Promise<number> {
  return page.evaluate(() => {
    const raw = sessionStorage.getItem("meridian.run");
    if (!raw) return -1;
    const results = (JSON.parse(raw) as { results?: unknown[] }).results;
    return Array.isArray(results) ? results.length : -1;
  });
}

async function runIndex(page): Promise<number> {
  return page.evaluate(() => {
    const raw = sessionStorage.getItem("meridian.run");
    return raw ? (JSON.parse(raw) as { index: number }).index : -1;
  });
}

test("reload during reveal: result card re-renders with Next place", async ({
  page,
}) => {
  await startNebraskaStateRun(page);
  await commitMiss(page);

  // The reveal card is showing pre-reload (sanity: the bug needs a card).
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 15_000 });
  const indexBefore = await runIndex(page);

  // Reload mid-reveal — this used to strand the run.
  await page.reload();
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 20_000 });

  // The card must re-render with a working Next place button…
  const card = resultCard(page);
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 10_000 });

  // …and the rehydrated drop must carry the real distance (the bug showed
  // the broken "Pin dropped. ." with an empty distance).
  const distancePara = card.locator("p.font-display").first();
  await expect(distancePara).toContainText("off", { timeout: 5_000 });

  // …and Next place must advance to a fresh question, not strand.
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  expect(await runIndex(page)).toBe(indexBefore + 1);
  expect(await runResultsLength(page)).toBe(1);
});

test("reload during reveal with no saved drop: fails safe to next question", async ({
  page,
}) => {
  await startNebraskaStateRun(page);
  await commitMiss(page);
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 15_000 });
  const indexBefore = await runIndex(page);
  expect(await runResultsLength(page)).toBe(1);

  // Simulate a missing/corrupted drop (e.g. storage cleared, tampered).
  await page.evaluate(() => sessionStorage.removeItem("meridian.drop"));

  await page.reload();
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 20_000 });

  // Fail-safe: the run advances to the next question instead of stranding.
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  expect(await runIndex(page)).toBe(indexBefore + 1);

  // The interrupted place was already scored pre-reload: exactly one
  // result, no duplicate, no loss.
  expect(await runResultsLength(page)).toBe(1);

  // And the run keeps working from there.
  await commitMiss(page);
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 15_000 });
  expect(await runResultsLength(page)).toBe(2);
});
