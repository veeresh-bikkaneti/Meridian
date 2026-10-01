import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  dismissTileOverlayIfPresent,
  readPhase,
  dropButton,
} from "./helpers";

/**
 * Hit-path story regression spec.
 *
 * Veeresh (2026-10-01) believed the place blurb only shows on wrong answers
 * and asked for it on hits too. Verification showed the hit card (phase
 * "story") already renders the full story + source — this spec locks that
 * behavior so a future refactor can't silently drop it.
 */
test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

type Page = import("playwright/test").Page;

async function spotViewportPoint(
  page: Page,
): Promise<{ x: number; y: number } | null> {
  return page.locator(".satellite-map").evaluate((el) => {
    const hook = (
      el as unknown as {
        __spotScreen?: () => { x: number; y: number } | null;
      }
    ).__spotScreen;
    const s = hook?.();
    if (!s) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + s.x), y: Math.round(r.top + s.y) };
  });
}

async function tapHitsMap(page: Page, x: number, y: number): Promise<boolean> {
  return page.evaluate(
    ({ px, py }) => {
      const el = document.elementFromPoint(px, py);
      return !!el?.closest?.(".satellite-map");
    },
    { px: x, py: y },
  );
}

async function commitPin(
  page: Page,
  x: number,
  y: number,
): Promise<{ phase: string | null; committedAt: number }> {
  await dismissTileOverlayIfPresent(page);
  const map = page.locator(".satellite-map");
  await expect
    .poll(() => map.getAttribute("data-tile-status"), { timeout: 30_000 })
    .toBe("ready");
  await page.mouse.click(x, y);
  await expect(dropButton(page)).toBeEnabled();
  await dropButton(page).click();
  const committedAt = Date.now();
  let phase: string | null = null;
  await expect
    .poll(
      async () => {
        phase = await readPhase(page);
        return phase;
      },
      { timeout: 15_000 },
    )
    .toMatch(/^(story|done)$/);
  return { phase, committedAt };
}

const nextPlaceButton = (page: Page) =>
  page.getByRole("button", { name: "Next place" });

async function clickNextPlace(page: Page): Promise<void> {
  const btn = nextPlaceButton(page);
  await expect(btn).toBeVisible({ timeout: 10_000 });
  await btn.evaluate((el) =>
    el.scrollIntoView({ block: "nearest", behavior: "instant" as ScrollBehavior }),
  );
  await btn.click();
}

const resultCard = (page: Page) =>
  page.getByRole("region", { name: "Result" });

async function commitHit(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const spot = await spotViewportPoint(page);
    const inView =
      spot &&
      spot.x >= 0 &&
      spot.x <= 1440 &&
      spot.y >= 0 &&
      spot.y <= 900;
    if (inView && (await tapHitsMap(page, spot.x, spot.y))) {
      const { phase } = await commitPin(page, spot.x, spot.y);
      if (phase === "story") return;
    } else {
      // Spot not tappable: burn with a miss at (500,400) and advance.
      const { phase } = await commitPin(page, 500, 400);
      if (phase !== "done") {
        // Rare hit — still fine, just advance.
      }
    }
    await clickNextPlace(page);
    await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  }
  throw new Error("commitHit: no tappable spot in 10 attempts");
}

test("hit: the result card renders the place blurb/story, not just the score", async ({
  page,
}) => {
  await startGlobeRun(page);
  await commitHit(page);

  const card = resultCard(page);
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 5_000 });

  // The hit branch renders the story in a scrollable div (max-h-44).
  const storyPara = card.locator(".max-h-44 p");
  await expect(storyPara).toBeVisible({ timeout: 5_000 });
  const text = (await storyPara.textContent()) ?? "";
  expect(
    text.trim().length,
    `hit card story paragraph should carry the blurb, got: ${JSON.stringify(text.slice(0, 120))}`,
  ).toBeGreaterThan(40);

  // Source attribution link must be present too.
  await expect(card.getByRole("link")).toBeVisible();

  // The story scroller must be keyboard-scrollable (tabindex + labeled region).
  const scroller = card.getByRole("region", { name: "Place story" });
  await expect(scroller).toBeVisible();
  expect(await scroller.getAttribute("tabindex")).toBe("0");
});
