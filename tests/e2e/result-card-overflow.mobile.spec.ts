import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  readPhase,
  dropButton,
  dismissTileOverlayIfPresent,
} from "./helpers";

/**
 * Regression: result-card text overflow at 390px (owner report 2026-10-11).
 * Three failures on the same card, all layout-only:
 *  1. .verdict-headline clipped at the card's right edge (flex 1 0 auto —
 *     the no-shrink headline overflowed instead of wrapping).
 *  2. .storyteller-dock caption cut off mid-word (absolute, left-only, and
 *     the karaoke nbsp joiner made the line unbreakable).
 *  3. .share-pre last lines hidden under the "more below" scroll cue
 *     (result-body bottom padding smaller than the cue).
 *
 * Black-box: plays the globe, drops a pin, then asserts what the user SEES —
 * no clipped/overlapping text — via geometry, not DOM internals.
 */
test.setTimeout(240_000);
test.use({
  viewport: { width: 390, height: 844 },
  video: { mode: "on", size: { width: 390, height: 844 } },
});

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

test("result card: no clipped or overlapping text at 390px", async ({ page }) => {
  await startGlobeRun(page);
  await dismissTileOverlayIfPresent(page);

  // Drop a pin far from anywhere likely (miss card shows the longest headline).
  // The map tap is retried: on slow software rendering the first tap can
  // land before the canvas click handler is ready.
  await expect
    .poll(
      async () => {
        await page.mouse.click(195, 420);
        await page.waitForTimeout(800);
        return await dropButton(page).isEnabled();
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  await dropButton(page).click();
  await expect
    .poll(() => readPhase(page), { timeout: 20_000 })
    .toMatch(/^(story|done)$/);

  const card = page.locator(".result-card");
  await expect(card).toBeVisible();

  // No page-level horizontal overflow anywhere.
  const pageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(pageOverflow).toBeLessThanOrEqual(1);

  // 1. Verdict headline: the text must fit its own box (no clipping).
  const headline = page.locator(".verdict-headline");
  if ((await headline.count()) > 0) {
    const { scrollWidth, clientWidth } = await headline.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(
      scrollWidth,
      "verdict headline is clipped (scrollWidth > clientWidth)",
    ).toBeLessThanOrEqual(clientWidth + 1);
  }

  // 2. Docked storyteller banner: the bubble must sit fully inside the card.
  const dockCaption = page.locator(".storyteller-dock .storyteller-caption");
  if ((await dockCaption.count()) > 0) {
    const [capBox, cardBox] = await Promise.all([
      dockCaption.boundingBox(),
      card.boundingBox(),
    ]);
    expect(capBox, "dock caption has no box").not.toBeNull();
    expect(cardBox, "card has no box").not.toBeNull();
    if (capBox && cardBox) {
      expect(capBox.x, "dock caption spills past card left").toBeGreaterThanOrEqual(
        cardBox.x - 1,
      );
      expect(
        capBox.x + capBox.width,
        "dock caption spills past card right",
      ).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
    }
  }

  // 3. Share block: scroll the body to the bottom. The cue hides itself
  // there (moreBelow=false), so the real assertion is that the share
  // block's last line is fully inside the visible scrollport — reachable
  // and readable, never tucked under the cue's fade zone.
  const sharePre = page.locator(".share-pre");
  if ((await sharePre.count()) > 0) {
    const body = page.locator(".result-body");
    await body.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await page.waitForTimeout(400);
    const [shareBox, bodyBox] = await Promise.all([
      sharePre.boundingBox(),
      body.boundingBox(),
    ]);
    expect(shareBox, "share block has no box").not.toBeNull();
    expect(bodyBox, "result body has no box").not.toBeNull();
    if (shareBox && bodyBox) {
      expect(
        shareBox.y + shareBox.height,
        "share text's last line is cut off below the visible area",
      ).toBeLessThanOrEqual(bodyBox.y + bodyBox.height + 2);
      expect(
        shareBox.y,
        "share text's first line is cut off above the visible area",
      ).toBeGreaterThanOrEqual(bodyBox.y - 2);
    }
  }

  // Human-eyed evidence: the fixed card at top, mid-scroll (cue visible),
  // and bottom.
  await page.locator(".result-body").evaluate((el) => el.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: "/tmp/overflow-verify-top.png" });
  await page
    .locator(".result-body")
    .evaluate((el) => el.scrollTo(0, el.scrollHeight / 2));
  await page.waitForTimeout(300);
  await page.screenshot({ path: "/tmp/overflow-verify-mid.png" });
  await page.locator(".result-body").evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await page.waitForTimeout(300);
  await page.screenshot({ path: "/tmp/overflow-verify-bottom.png" });
});
