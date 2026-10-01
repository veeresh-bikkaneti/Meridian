import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  dismissTileOverlayIfPresent,
  readPhase,
  dropButton,
} from "./helpers";

/**
 * Repro for Veeresh's report (2026-10-01):
 *  1. Clicking the X ("Hide result") on the result card must NOT end the
 *     game — the run phase must stay "done", the restore pill must appear,
 *     and the player must be able to continue via Next place.
 *  2. The miss-subscript's educational blurb must not be ellipsis-clipped:
 *     the full blurb text must be visible (no line-clamp cutting it off).
 */

test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

type Page = import("playwright/test").Page;

async function commitMiss(page: Page): Promise<void> {
  await dismissTileOverlayIfPresent(page);
  const map = page.locator(".satellite-map");
  await expect
    .poll(() => map.getAttribute("data-tile-status"), { timeout: 30_000 })
    .toBe("ready");
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.mouse.click(500, 400);
    await expect(dropButton(page)).toBeEnabled();
    await dropButton(page).click();
    let phase: string | null = null;
    await expect
      .poll(async () => {
        phase = await readPhase(page);
        return phase;
      }, { timeout: 20_000 })
      .toMatch(/^(story|done)$/);
    if (phase === "done") return;
    // Rare hit: advance and retry on the next place.
    const btn = page.getByRole("button", { name: "Next place" });
    await btn.evaluate((el) =>
      el.scrollIntoView({ block: "nearest", behavior: "instant" as ScrollBehavior }),
    );
    await btn.click();
    await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  }
  throw new Error("commitMiss: (500, 400) hit three places in a row");
}

const resultCard = (page: Page) => page.getByRole("region", { name: "Result" });

test("X on the result card hides it without ending the game", async ({ page }) => {
  await startGlobeRun(page);
  await commitMiss(page);

  const card = resultCard(page);
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card.getByText(/(m|km) off/)).toBeVisible();

  // Issue 2: the educational blurb must not be clipped by line-clamp.
  const subscript = card.getByTestId("miss-subscript");
  await expect(subscript).toBeVisible();
  const clipped = await subscript.evaluate((el) => el.scrollHeight > el.clientHeight + 1);
  expect(clipped, "miss-subscript blurb must not be ellipsis-clipped").toBe(false);

  // Issue 1: clicking X must not end the game.
  await card.getByRole("button", { name: "Hide result" }).click();

  // Phase stays "done" — no summary screen, no return to editions.
  await expect.poll(() => readPhase(page), { timeout: 5_000 }).toBe("done");
  await expect(page.getByText("Game over")).toBeHidden();
  // Restore pill appears; the game is still continuable.
  const pill = page.getByRole("button", { name: "Show result" });
  await expect(pill).toBeVisible();

  // The dismissed state keeps a direct continue action: hiding the card must
  // never strand the run with "End game" as the only visible way forward.
  const dismissedNext = page.getByRole("button", { name: "Next place" });
  await expect(dismissedNext).toBeVisible();
  await dismissedNext.click();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");

  // And the restore-then-continue path still works on the next place.
  await commitMiss(page);
  const card2 = resultCard(page);
  await expect(card2).toBeVisible({ timeout: 30_000 });
  await card2.getByRole("button", { name: "Hide result" }).click();
  await expect(page.getByRole("button", { name: "Show result" })).toBeVisible();
  await page.getByRole("button", { name: "Show result" }).click();
  await expect(card2).toBeVisible();
  const next = card2.getByRole("button", { name: "Next place" });
  await next.evaluate((el) =>
    el.scrollIntoView({ block: "nearest", behavior: "instant" as ScrollBehavior }),
  );
  await next.click();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
});
