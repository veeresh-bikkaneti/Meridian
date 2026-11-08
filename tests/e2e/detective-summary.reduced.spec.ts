import { test, expect, type Page } from "playwright/test";
import {
  serveBuiltArtifact,
  readPhase,
  commitPin,
  dismissTileOverlayIfPresent,
} from "./helpers";
import { fulfillFlagsOn, collectAudioRequests } from "./detective-u10";

/**
 * Unit B, degraded row (U9 matrix): under prefers-reduced-motion the
 * run-summary celebration is STATIC — the pair stands frozen at the
 * high-five with the score in frame, no choreography steps advance,
 * and NO detective audio is requested at all (this surface's rule:
 * reduced motion means no forced audio; the narration's own behaviour
 * is unchanged and is not detective audio). Runs in the repo's shared
 * `reduced` project (reducedMotion: "reduce").
 */

test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

async function startStateRun(page: Page): Promise<void> {
  await page.goto("http://127.0.0.1:4123/Meridian/");
  await page.getByRole("button", { name: "Choose a country" }).click();
  await expect(page.getByRole("heading", { name: "Country" })).toBeVisible();
  await page.getByRole("button", { name: "United States" }).click();
  await expect(
    page.getByRole("heading", { name: "United States" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Nebraska" }).click();
  await dismissTileOverlayIfPresent(page);
  await expect(page.locator(".satellite-map")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({
    timeout: 60_000,
  });
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
}

test("Unit B reduced-motion: static pair + score in frame, no audio requests", async ({
  page,
  context,
}) => {
  await fulfillFlagsOn(context);
  const audioRequests = collectAudioRequests(page);
  await startStateRun(page);

  // Play one place, then end the run (commitPin waits out the intro
  // beat before clicking — see detective-summary.spec.ts).
  await commitPin(page, 500, 400);
  await page.getByRole("button", { name: "Next place" }).click();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  await page.getByRole("button", { name: "End game" }).click();
  await expect.poll(() => readPhase(page), { timeout: 10_000 }).toBe("summary");

  const frame = page.getByTestId("summary-detective-celebration");
  await expect(frame).toBeVisible({ timeout: 20_000 });
  await expect(frame).toHaveAttribute("data-mode", "static");
  // Frozen at the high-five: the step never advances, the pair is
  // present, and the frame's total equals the card's total.
  await expect(frame).toHaveAttribute("data-step", "high-five");
  await expect(frame.locator("[data-detective]")).toHaveCount(2);
  await page.waitForTimeout(3000);
  await expect(frame).toHaveAttribute("data-step", "high-five");
  const frameTotal = (
    await page.getByTestId("celebration-total").textContent()
  )?.trim();
  const card = page
    .getByRole("dialog", { name: "Game summary" })
    .locator("p.text-5xl");
  expect(frameTotal).toBe((await card.textContent())?.trim());
  await expect(frame).toContainText("State");

  // No detective audio was requested anywhere in the run.
  expect(audioRequests).toEqual([]);
});
